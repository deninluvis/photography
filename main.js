/* =============================================
   Portfolio — Denin Luvis
   main.js — nav, reveal, and auto-populating galleries
   Shared across all pages; every page-specific block below
   guards itself against that page not having the element.
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
  document.body.classList.toggle('nav-open', open);
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

// The CMS stores image fields relative to wherever that entry's media_folder
// points (usually just a bare filename), not always a full repo path —
// normalize whatever it gives us against the field's expected folder.
function resolveAssetPath(raw, fallbackFolder) {
  if (!raw) return null;
  const clean = raw.replace(/^\.?\//, '');
  return clean.includes('/') ? clean : `${fallbackFolder}/${clean}`;
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
        const imagePath = resolveAssetPath(data.image, `images/${folder}`);
        return {
          key: item.name,
          url: rawUrl(imagePath),
          title: data.title || formatCaption(imagePath.split('/').pop()),
          location: data.location || '',
          camera: data.camera || '',
          description: data.description || '',
          link: data.link || '',
          imagePath,
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

// ── Lightbox (only present on pages with a gallery) ──
const lightbox = document.getElementById('lightbox');
let lightboxImg, lightboxCaption, lightboxCounter, lightboxDetail, lightboxLink;
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

if (lightbox) {
  lightboxImg = document.getElementById('lightbox-img');
  lightboxCaption = document.getElementById('lightbox-caption');
  lightboxCounter = document.getElementById('lightbox-counter');
  lightboxDetail = document.getElementById('lightbox-detail');
  lightboxLink = document.getElementById('lightbox-link');

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
}

// ── Home page settings, managed via the CMS as two separate files:
// content/home.json (pinned hero photos) and content/highlights.json
// (the curated Highlighted Photos list) ──
async function fetchJson(path, fallback) {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`);
    return res.ok ? await res.json() : fallback;
  } catch (e) {
    return fallback;
  }
}

async function fetchHomeSettings() {
  const [home, highlightsData] = await Promise.all([
    fetchJson('content/home.json', {}),
    fetchJson('content/highlights.json', {}),
  ]);

  const toHighlightEntries = (list, orientation) => (Array.isArray(list) ? list : [])
    .filter(h => h && h.image)
    .slice(0, 3)
    .map(h => {
      const imagePath = resolveAssetPath(h.image, 'images/photography');
      return {
        url: rawUrl(imagePath),
        title: formatCaption(imagePath.split('/').pop()),
        orientation,
        location: '', camera: '', description: '', link: '',
        imagePath,
      };
    });
  const highlights = [
    ...toHighlightEntries(highlightsData.highlightsPortrait, 'portrait'),
    ...toHighlightEntries(highlightsData.highlightsLandscape, 'landscape'),
  ];

  return {
    hero: {
      desktop: home.heroImage ? rawUrl(resolveAssetPath(home.heroImage, 'images/site')) : null,
      mobile: home.heroImageMobile ? rawUrl(resolveAssetPath(home.heroImageMobile, 'images/site')) : null,
    },
    highlights,
  };
}

function applyHeroImage(url, cssVar) {
  if (!url) return;
  const hero = document.getElementById('hero');
  const im = new Image();
  im.onload = () => {
    hero.style.setProperty(cssVar, `url("${url}")`);
    hero.classList.add('has-image');
  };
  im.src = url;
}

// Interleave portrait/landscape (rather than trusting CMS entry order) so
// the fixed bento slots in the grid pack cleanly regardless of the order
// photos were added in.
function interleaveByOrientation(entries) {
  const portraits = entries.filter(e => e.orientation === 'portrait');
  const landscapes = entries.filter(e => e.orientation === 'landscape');
  const ordered = [];
  const max = Math.max(portraits.length, landscapes.length);
  for (let i = 0; i < max; i++) {
    if (portraits[i]) ordered.push(portraits[i]);
    if (landscapes[i]) ordered.push(landscapes[i]);
  }
  return ordered;
}

function renderHighlights(sectionId, rawEntries) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const grid = section.querySelector('.highlights-grid');
  const empty = section.querySelector('.gallery-empty');
  if (!rawEntries.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  const entries = interleaveByOrientation(rawEntries);
  grid.innerHTML = entries.map((entry, i) => `
    <button class="gallery-tile highlight-tile ${entry.orientation} reveal" data-index="${i}" aria-label="Open ${escapeHtml(entry.title)}">
      <img src="${entry.url}" alt="${escapeHtml(entry.title)}" loading="lazy" />
      <span class="gallery-tile-caption mono">${escapeHtml(entry.title)}</span>
    </button>
  `).join('');
  grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
  grid.querySelectorAll('.gallery-tile').forEach(tile => {
    tile.addEventListener('click', () => openLightbox(entries, Number(tile.dataset.index)));
  });
}

// ── Init: fetch only what the current page actually needs ──
const LATEST_PREVIEW_COUNT = 6;

(async () => {
  const heroEl = document.getElementById('hero');
  const photoSection = document.getElementById('photography');
  const engSection = document.getElementById('engineering');
  const highlightsSection = document.getElementById('highlights');
  const latestEngSection = document.getElementById('latest-engineering');

  const needPhotos = photoSection || heroEl;
  const needEngineering = engSection || latestEngSection;
  const needHomeSettings = heroEl || highlightsSection;

  const [photos, engineering, homeSettings] = await Promise.all([
    needPhotos ? fetchGalleryEntries('photography') : Promise.resolve([]),
    needEngineering ? fetchGalleryEntries('engineering') : Promise.resolve([]),
    needHomeSettings ? fetchHomeSettings() : Promise.resolve({ hero: {}, highlights: [] }),
  ]);

  if (photoSection) renderGallery('photography', photos);
  if (engSection) renderGallery('engineering', engineering);
  if (highlightsSection) {
    const photoByPath = new Map(photos.map(p => [p.imagePath, p]));
    const highlights = homeSettings.highlights.map(h => {
      const match = photoByPath.get(h.imagePath);
      return match ? { ...h, title: match.title, location: match.location, camera: match.camera } : h;
    });
    renderHighlights('highlights', highlights);
  }
  if (latestEngSection) renderGallery('latest-engineering', engineering.slice(0, LATEST_PREVIEW_COUNT));
  if (heroEl) {
    applyHeroImage(homeSettings.hero.desktop || (photos[0] && photos[0].url), '--hero-image');
    applyHeroImage(homeSettings.hero.mobile, '--hero-image-mobile');
  }
})();
