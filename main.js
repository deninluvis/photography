/* =============================================
   Portfolio — Denin Luvis
   main.js — nav, reveal, and auto-populating galleries
   ============================================= */

const REPO = 'deninluvis/photography';
const BRANCH = 'main';
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
const CACHE_TTL_MS = 10 * 60 * 1000;

// ── Nav scroll state ──
const nav = document.getElementById('nav');
const setNavState = () => nav.classList.toggle('scrolled', window.scrollY > 8);
setNavState();
window.addEventListener('scroll', setNavState, { passive: true });

// ── Mobile nav toggle ──
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', String(open));
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// ── Scroll reveal ──
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── Gallery: auto-populate from /images/<folder> via the GitHub Contents API ──
// Each entry is either a CMS-authored <slug>.json file (title + image + extra
// fields like location/camera or description/link) or, as a fallback, a bare
// image file dropped in without one — those just get a filename-derived title.

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatCaption(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+[-_\s]*/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function rawUrl(path) {
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

async function fetchGalleryEntries(folder) {
  const cacheKey = `gallery-cache-v2-${folder}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey));
    if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.entries;
  } catch (e) {}

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/images/${folder}?ref=${BRANCH}`);
    if (!res.ok) return [];
    const listing = await res.json();

    const jsonFiles = listing.filter(item => item.type === 'file' && item.name.toLowerCase().endsWith('.json'));
    const imageFiles = listing.filter(item => item.type === 'file' && IMAGE_EXT.some(ext => item.name.toLowerCase().endsWith(ext)));

    const jsonEntries = await Promise.all(jsonFiles.map(async item => {
      try {
        const r = await fetch(item.download_url);
        if (!r.ok) return null;
        const data = await r.json();
        if (!data.image) return null;
        return {
          key: item.name,
          url: rawUrl(data.image),
          title: data.title || formatCaption(data.image.split('/').pop()),
          location: data.location || '',
          camera: data.camera || '',
          description: data.description || '',
          link: data.link || '',
          imagePath: data.image,
        };
      } catch (e) {
        return null;
      }
    }));

    const referenced = new Set(jsonEntries.filter(Boolean).map(e => e.imagePath));

    const fallbackEntries = imageFiles
      .filter(item => !referenced.has(`images/${folder}/${item.name}`))
      .map(item => ({
        key: item.name,
        url: item.download_url,
        title: formatCaption(item.name),
        location: '', camera: '', description: '', link: '',
        imagePath: `images/${folder}/${item.name}`,
      }));

    const entries = [...jsonEntries.filter(Boolean), ...fallbackEntries]
      .sort((a, b) => b.key.localeCompare(a.key, undefined, { numeric: true }));

    try { sessionStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), entries })); } catch (e) {}
    return entries;
  } catch (e) {
    return [];
  }
}

function renderGallery(sectionId, entries) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const grid = section.querySelector('.gallery-grid');
  const empty = section.querySelector('.gallery-empty');
  if (!entries.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  grid.innerHTML = entries.map((entry, i) => `
    <button class="gallery-tile reveal" data-index="${i}" aria-label="Open ${escapeHtml(entry.title)}">
      <img src="${entry.url}" alt="${escapeHtml(entry.title)}" loading="lazy" />
      <span class="gallery-tile-caption mono">${escapeHtml(entry.title)}</span>
    </button>
  `).join('');
  grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
  grid.querySelectorAll('.gallery-tile').forEach(tile => {
    tile.addEventListener('click', () => openLightbox(entries, Number(tile.dataset.index)));
  });
}

// ── Lightbox ──
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxCounter = document.getElementById('lightbox-counter');
const lightboxDetail = document.getElementById('lightbox-detail');
const lightboxLink = document.getElementById('lightbox-link');
let lightboxEntries = [];
let lightboxIndex = 0;

function showLightboxImage() {
  const entry = lightboxEntries[lightboxIndex];
  lightboxImg.style.opacity = 0;
  setTimeout(() => {
    lightboxImg.src = entry.url;
    lightboxImg.alt = entry.title;
    lightboxCaption.textContent = entry.title;
    lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxEntries.length}`;

    const metaLine = [entry.location, entry.camera].filter(Boolean).join(' · ');
    lightboxDetail.textContent = metaLine || entry.description || '';
    lightboxDetail.hidden = !lightboxDetail.textContent;

    if (entry.link) {
      lightboxLink.href = entry.link;
      lightboxLink.hidden = false;
    } else {
      lightboxLink.hidden = true;
    }

    lightboxImg.style.opacity = 1;
  }, 120);
}

function openLightbox(entries, index) {
  lightboxEntries = entries;
  lightboxIndex = index;
  showLightboxImage();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

function nextImage() { lightboxIndex = (lightboxIndex + 1) % lightboxEntries.length; showLightboxImage(); }
function prevImage() { lightboxIndex = (lightboxIndex - 1 + lightboxEntries.length) % lightboxEntries.length; showLightboxImage(); }

document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox-next').addEventListener('click', nextImage);
document.getElementById('lightbox-prev').addEventListener('click', prevImage);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') nextImage();
  if (e.key === 'ArrowLeft') prevImage();
});

let touchStartX = 0;
lightbox.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
lightbox.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 50) { dx > 0 ? prevImage() : nextImage(); }
}, { passive: true });

// ── Hero background: feature the latest photography shot once available ──
function setHeroBackground(entries) {
  if (!entries.length) return;
  const hero = document.getElementById('hero');
  const pick = entries[0];
  const im = new Image();
  im.onload = () => {
    hero.style.setProperty('--hero-image', `url("${pick.url}")`);
    hero.classList.add('has-image');
  };
  im.src = pick.url;
}

// ── Init ──
(async () => {
  const [photos, engineering] = await Promise.all([
    fetchGalleryEntries('photography'),
    fetchGalleryEntries('engineering'),
  ]);
  renderGallery('photography', photos);
  renderGallery('engineering', engineering);
  setHeroBackground(photos);
})();
