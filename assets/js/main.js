/**
 * Aurelia Residences — Aurelia House
 * Page behaviour: preloader, navigation, reveals, gallery, floor plans,
 * enquiry form, and progressive loading of the 3D experience.
 *
 * Everything degrades: with JavaScript disabled the page remains complete and
 * readable; if WebGL is unavailable the static preview and gallery take over.
 */
import { site } from './site-config.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const docEl = document.documentElement;

const live = $('#live');
let announce = (msg) => { if (live) live.textContent = msg; };
if (!live) {
  const region = document.createElement('div');
  region.className = 'visually-hidden';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  document.body.appendChild(region);
  announce = (msg) => { region.textContent = msg; };
}

/* ===================================================== editable content === */
const telHref = (phone) => `tel:+${String(phone).replace(/[^\d]/g, '')}`;

function applyConfig() {
  $$('[data-config]').forEach((el) => {
    const value = site[el.dataset.config];
    if (typeof value === 'string') el.textContent = value;
  });
  $$('[data-config-time]').forEach((el) => {
    const value = site.travel[el.dataset.configTime];
    if (value) el.textContent = value;
  });
  $$('[data-config-href]').forEach((el) => {
    switch (el.dataset.configHref) {
      case 'mail':
        el.href = `mailto:${site.email}`;
        el.textContent = site.email;
        break;
      case 'tel':
        el.href = telHref(site.phone);
        el.textContent = site.phone;
        break;
      case 'whatsapp':
        el.href = `https://wa.me/${String(site.whatsapp).replace(/[^\d]/g, '')}`;
        break;
      case 'instagram':
        el.href = site.instagram;
        break;
      default:
        break;
    }
  });
}
applyConfig();

/* ============================================== media: fade in on decode === */
function warmMedia(root = document) {
  $$('.media img', root).forEach((img) => {
    const done = () => img.classList.add('is-loaded');
    if (img.complete && img.naturalWidth > 0) done();
    else {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    }
  });
}
warmMedia();

/* ============================================================== preloader == */
const preloader = $('#preloader');
const preloadBar = $('#preload-bar');
const preloadPct = $('#preload-pct');
const preloadNote = $('#preload-note');

let loadValue = 0;
let preloaderDone = false;

function setProgress(value, note) {
  loadValue = Math.max(loadValue, Math.min(100, value));
  if (preloadBar) preloadBar.style.transform = `scaleX(${loadValue / 100})`;
  if (preloadPct) preloadPct.textContent = String(Math.round(loadValue)).padStart(2, '0');
  if (note && preloadNote) preloadNote.textContent = note;
}

function finishPreloader() {
  if (preloaderDone) return;
  preloaderDone = true;
  setProgress(100);
  window.setTimeout(() => {
    if (!preloader) return;
    preloader.classList.add('is-done');
    docEl.classList.remove('is-locked');
    window.setTimeout(() => {
      preloader.hidden = true;
      if (preloadBar) preloadBar.style.transform = 'scaleX(1)';
    }, 900);
    announce('Aurelia Residences. The page is ready.');
  }, 320);
}

function runPreloader() {
  if (!preloader) return;
  docEl.classList.add('is-locked');
  const started = performance.now();
  setProgress(8, 'Preparing the residence');

  const hero = $('.hero__media img');
  const heroReady = hero
    ? (hero.complete && hero.naturalWidth
        ? Promise.resolve()
        : new Promise((res) => {
            hero.addEventListener('load', res, { once: true });
            hero.addEventListener('error', res, { once: true });
          }))
    : Promise.resolve();

  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();

  fontsReady.then(() => setProgress(52, 'Composing the view'));
  heroReady.then(() => setProgress(84));

  /* The introduction never outstays its welcome: it closes as soon as the
     hero and fonts are in, and always within 1.9 seconds. */
  Promise.race([
    Promise.all([fontsReady, heroReady]).then(() => new Promise((r) => window.setTimeout(r, 260))),
    new Promise((r) => window.setTimeout(r, 1900))
  ]).then(() => {
    const elapsed = performance.now() - started;
    window.setTimeout(() => finishPreloader(), Math.max(0, 620 - elapsed));
  });
}

if (document.readyState === 'complete') runPreloader();
else window.addEventListener('load', runPreloader, { once: true });
window.setTimeout(finishPreloader, 4200); // safety net

/* ================================================= scroll: header + nav === */
const header = $('#site-head');
let lastY = window.scrollY;
let ticking = false;

function onScroll() {
  const y = window.scrollY;

  if (header) {
    header.classList.toggle('is-stuck', y > 48);
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (goingDown && y > 760 && !$('#mobile-nav')?.hidden) {
      /* keep the bar visible while the mobile menu is open */
    } else if (goingDown && y > 760) {
      header.classList.add('is-hidden');
    } else if (goingUp || y < 200) {
      header.classList.remove('is-hidden');
    }
  }

  if (mobileCta) {
    const beyondHero = y > window.innerHeight * 0.8;
    mobileCta.classList.toggle('is-in', beyondHero && !enquiryInView);
  }

  if (heroImg && !reduceMotion && !isCoarse) {
    heroImg.style.setProperty('--py', `${Math.min(0, (y * -0.06)).toFixed(1)}px`);
  }

  lastY = y;
  ticking = false;
}
function requestScroll() {
  if (!ticking) {
    ticking = true;
    window.requestAnimationFrame(onScroll);
  }
}
window.addEventListener('scroll', requestScroll, { passive: true });

/* current section in the primary navigation */
function sectionsNav() {
  const links = $$('.nav__link');
  if (!links.length || !('IntersectionObserver' in window)) return;
  const map = new Map();
  links.forEach((link) => {
    const id = link.getAttribute('href').slice(1);
    const section = document.getElementById(id);
    if (section) map.set(section, link);
  });
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          links.forEach((l) => l.removeAttribute('aria-current'));
          map.get(entry.target)?.setAttribute('aria-current', 'true');
        }
      });
    },
    { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
  );
  map.forEach((_, section) => io.observe(section));
}
sectionsNav();

/* ==================================================== smooth scrolling === */
function headerOffset() {
  const h = header ? header.getBoundingClientRect().height : 0;
  const mobileBar = mobileCta && getComputedStyle(mobileCta).display !== 'none' ? 72 : 0;
  return h + mobileBar + 8;
}

function scrollToTarget(target, { focus = true } = {}) {
  if (!target) return;
  const top = target.getBoundingClientRect().top + window.scrollY - headerOffset();
  window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
  if (focus) {
    const hadTabIndex = target.hasAttribute('tabindex');
    if (!hadTabIndex) target.setAttribute('tabindex', '-1');
    window.setTimeout(() => {
      target.focus({ preventScroll: true });
      if (!hadTabIndex) target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }, reduceMotion ? 0 : 480);
  }
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const hash = link.getAttribute('href');
  if (hash === '#' || link.hasAttribute('data-panel')) return;
  const target = document.getElementById(hash.slice(1));
  if (!target) return;
  event.preventDefault();
  scrollToTarget(target, { focus: !target.closest('.mobile-cta') });
  history.pushState(null, '', hash);
  closeMobileNav();
});

/* ======================================================== mobile menu ==== */
const menuToggle = $('#menu-toggle');
const mobileNav = $('#mobile-nav');

function closeMobileNav() {
  if (!menuToggle || !mobileNav || mobileNav.hidden) return;
  mobileNav.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');
}
if (menuToggle && mobileNav) {
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!open));
    mobileNav.hidden = open;
    if (!open) mobileNav.querySelector('a')?.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMobileNav();
  });
  document.addEventListener('click', (event) => {
    if (mobileNav.hidden) return;
    if (!mobileNav.contains(event.target) && !menuToggle.contains(event.target)) closeMobileNav();
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) closeMobileNav();
  });
}

/* ========================================== subtle scroll-in transitions === */
function reveals() {
  const items = $$('[data-reveal]');
  if (!items.length) return;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }
  );
  items.forEach((el) => io.observe(el));
}
reveals();

/* ============================================================ parallax ==== */
const heroImg = $('.hero__media img');
const heroMedia = $('.hero__media');
const isCoarse = window.matchMedia('(hover: none)').matches;
if (heroMedia && !reduceMotion && !isCoarse) {
  let px = 0;
  let py = 0;
  let raf = null;
  heroMedia.closest('.hero')?.addEventListener(
    'pointermove',
    (event) => {
      const rect = heroMedia.getBoundingClientRect();
      px = ((event.clientX - rect.left) / rect.width - 0.5) * -22;
      py = ((event.clientY - rect.top) / rect.height - 0.5) * -14;
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        heroMedia.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
        raf = null;
      });
    },
    { passive: true }
  );
}

/* ==================================================== floor plan section == */
const plansBody = $('#plans-body');

function initPlans() {
  if (!plansBody) return;
  const tabs = $$('.plan-tabs__btn', plansBody);
  const panels = $$('.plan-panel', plansBody);
  const pinned = new Map(); // panel -> room id

  const roomsIn = (panel) => $$('.p-room', panel);
  const legendIn = (panel) => $$('.plan-legend__btn', panel);

  const highlight = (panel, roomId, on) => {
    roomsIn(panel).forEach((room) => {
      if (room.dataset.room === roomId) room.classList.toggle('is-hi', on);
    });
    legendIn(panel).forEach((btn) => {
      if (btn.dataset.target === roomId) btn.classList.toggle('is-hi', on);
    });
  };

  const clearHighlight = (panel) => {
    roomsIn(panel).forEach((room) => room.classList.remove('is-hi'));
    legendIn(panel).forEach((btn) => btn.classList.remove('is-hi'));
  };

  function selectTab(index) {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    });
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(i));
    tab.addEventListener('keydown', (event) => {
      const keys = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 };
      if (event.key === 'Home' || event.key === 'End' || keys[event.key]) {
        event.preventDefault();
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : (i + keys[event.key] + tabs.length) % tabs.length;
        selectTab(next);
        tabs[next].focus();
      }
    });
  });

  panels.forEach((panel) => {
    /* pointer / focus highlight from the drawing */
    panel.addEventListener('mouseover', (event) => {
      const room = event.target.closest('.p-room');
      if (!room) return;
      highlight(panel, room.dataset.room, true);
    });
    panel.addEventListener('mouseout', (event) => {
      const room = event.target.closest('.p-room');
      if (!room) return;
      if (pinned.get(panel) !== room.dataset.room) highlight(panel, room.dataset.room, false);
    });
    panel.addEventListener('focusin', (event) => {
      const room = event.target.closest('.p-room');
      if (room) highlight(panel, room.dataset.room, true);
    });
    panel.addEventListener('focusout', () => {
      if (!pinned.get(panel)) clearHighlight(panel);
    });

    /* legend: hover names the space, select pins the highlight */
    legendIn(panel).forEach((btn) => {
      const id = btn.dataset.target;
      const room = roomsIn(panel).find((r) => r.dataset.room === id);
      const area = $('.plan-legend__area', btn)?.textContent;
      const name = $('.plan-legend__name', btn)?.textContent;

      btn.addEventListener('mouseenter', () => highlight(panel, id, true));
      btn.addEventListener('mouseleave', () => {
        if (pinned.get(panel) !== id) highlight(panel, id, false);
      });
      btn.addEventListener('focus', () => highlight(panel, id, true));
      btn.addEventListener('blur', () => {
        if (pinned.get(panel) !== id) highlight(panel, id, false);
      });
      btn.addEventListener('click', () => {
        const isPinned = pinned.get(panel) === id;
        clearHighlight(panel);
        if (isPinned) {
          pinned.delete(panel);
          btn.setAttribute('aria-pressed', 'false');
          announce(`${name} deselected.`);
        } else {
          pinned.set(panel, id);
          highlight(panel, id, true);
          btn.setAttribute('aria-pressed', 'true');
          announce(`${name}, ${area}, highlighted on the plan.`);
        }
        if (room) room.setAttribute('aria-hidden', 'false');
      });
    });
  });

  selectTab(0);
}
initPlans();

/* ============================================================== gallery === */
const galleryButtons = $$('.gallery-btn');
const lightbox = $('#lightbox');
const lightboxImg = $('#lightbox-img');
const lightboxTitle = $('#lightbox-title');
const lightboxNote = $('#lightbox-note');
const lightboxCount = $('#lightbox-count');

const galleryItems = galleryButtons.map((btn, index) => {
  const img = $('img', btn);
  return {
    index,
    src: img?.getAttribute('src') || '',
    alt: img?.getAttribute('alt') || '',
    title: $('.gallery-cap__title', btn)?.textContent || '',
    note: $('.gallery-cap__note', btn)?.textContent || '',
    button: btn
  };
});

let lightboxIndex = 0;
let lastFocused = null;

function renderLightbox(index) {
  if (!galleryItems.length || !lightboxImg) return;
  lightboxIndex = (index + galleryItems.length) % galleryItems.length;
  const item = galleryItems[lightboxIndex];
  lightboxImg.classList.remove('is-loaded');
  lightboxImg.src = item.src;
  lightboxImg.alt = item.alt;
  const reveal = () => lightboxImg.classList.add('is-loaded');
  if (lightboxImg.complete && lightboxImg.naturalWidth) reveal();
  else lightboxImg.addEventListener('load', reveal, { once: true });
  if (lightboxTitle) lightboxTitle.textContent = item.title;
  if (lightboxNote) lightboxNote.textContent = item.note;
  if (lightboxCount) lightboxCount.textContent = `${String(lightboxIndex + 1).padStart(2, '0')} / ${String(galleryItems.length).padStart(2, '0')}`;
  announce(`${item.title}. Image ${lightboxIndex + 1} of ${galleryItems.length}.`);
}

function openLightbox(index) {
  if (!lightbox) return;
  lastFocused = document.activeElement;
  lightbox.hidden = false;
  renderLightbox(index);
  requestAnimationFrame(() => lightbox.classList.add('is-open'));
  docEl.classList.add('is-locked');
  $('#lightbox-close')?.focus({ preventScroll: true });
}

function closeLightbox() {
  if (!lightbox || lightbox.hidden) return;
  lightbox.classList.remove('is-open');
  docEl.classList.remove('is-locked');
  window.setTimeout(() => {
    lightbox.hidden = true;
  }, 320);
  if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus({ preventScroll: true });
}

galleryButtons.forEach((btn, index) => {
  btn.addEventListener('click', () => openLightbox(index));
});

if (lightbox) {
  $('#lightbox-close')?.addEventListener('click', closeLightbox);
  $('#lightbox-prev')?.addEventListener('click', () => renderLightbox(lightboxIndex - 1));
  $('#lightbox-next')?.addEventListener('click', () => renderLightbox(lightboxIndex + 1));
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (event) => {
    if (lightbox.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLightbox();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      renderLightbox(lightboxIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      renderLightbox(lightboxIndex - 1);
    } else if (event.key === 'Tab') {
      const focusable = $$('button, [href], img[tabindex]', lightbox).filter((el) => !el.hidden);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  /* swipe on touch devices */
  let touchStartX = null;
  lightbox.addEventListener('touchstart', (event) => {
    touchStartX = event.touches[0].clientX;
  }, { passive: true });
  lightbox.addEventListener('touchend', (event) => {
    if (touchStartX === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 60) renderLightbox(lightboxIndex + (delta < 0 ? 1 : -1));
    touchStartX = null;
  }, { passive: true });
}

/* ======================================================== privacy sheet === */
const privacySheet = $('#privacy');
if (privacySheet) {
  let privacyTrigger = null;
  const openPrivacy = (trigger) => {
    privacyTrigger = trigger;
    privacySheet.hidden = false;
    requestAnimationFrame(() => privacySheet.classList.add('is-open'));
    docEl.classList.add('is-locked');
    $('#privacy-close')?.focus({ preventScroll: true });
  };
  const closePrivacy = () => {
    privacySheet.classList.remove('is-open');
    docEl.classList.remove('is-locked');
    window.setTimeout(() => {
      privacySheet.hidden = true;
    }, 300);
    privacyTrigger?.focus({ preventScroll: true });
  };
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-panel="privacy"]');
    if (trigger) {
      event.preventDefault();
      openPrivacy(trigger);
      return;
    }
    if (!privacySheet.hidden && event.target === privacySheet) closePrivacy();
  });
  $('#privacy-close')?.addEventListener('click', closePrivacy);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !privacySheet.hidden) closePrivacy();
  });
}

/* ======================================================= property guide === */
const guideBtn = $('#guide-btn');
const guideNote = $('#guide-note');
if (guideBtn && guideNote) {
  guideBtn.addEventListener('click', () => {
    guideBtn.classList.add('is-demo');
    guideNote.classList.add('is-note');
    guideNote.innerHTML =
      'Property guide available on request. <a class="link-under" href="#enquire">Ask for the drawing set</a>';
    announce('The property guide is issued on request. Request a private viewing and a specialist will send it.');
    $('#enquire')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
}

/* ================================================================ form ==== */
const form = $('#viewing-form');
const dateField = $('#f-date');
if (dateField) {
  const today = new Date();
  const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  dateField.min = iso;
}

if (form) {
  const success = $('#form-success');
  const submitBtn = $('button[type="submit"]', form);

  const validators = {
    name: (value) => (value.trim().length >= 2 ? '' : 'Please tell us your name.'),
    email: (value) =>
      /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value.trim())
        ? ''
        : 'Please enter an email address we can reply to, such as name@example.com.',
    phone: (value) => (String(value).replace(/[^\d]/g, '').length >= 7 ? '' : 'Please add a number, including the country code.'),
    date: (value) => {
      if (!value) return 'Please choose a preferred date.';
      if (dateField?.min && value < dateField.min) return 'Please choose today or a future date.';
      return '';
    },
    consent: (value, field) => (field.checked ? '' : 'Please confirm we may contact you about this residence.')
  };

  const fieldWrap = (input) => input.closest('.field');
  const errorFor = (input) => $(`[data-error-for="${input.name}"]`, form);

  function setError(input, message) {
    const wrap = fieldWrap(input);
    const error = errorFor(input);
    if (wrap) wrap.classList.toggle('has-error', Boolean(message));
    if (error) {
      error.hidden = !message;
      if (message) error.textContent = message;
    }
    if (input.type === 'checkbox') input.setAttribute('aria-invalid', message ? 'true' : 'false');
    else input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validateField(input) {
    const validator = validators[input.name];
    if (!validator) return true;
    const message = validator(input.value, input);
    setError(input, message);
    return !message;
  }

  $$('input, textarea', form).forEach((input) => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      if (fieldWrap(input)?.classList.contains('has-error')) validateField(input);
    });
    input.addEventListener('change', () => {
      if (input.type === 'checkbox') validateField(input);
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const inputs = $$('input[required], textarea', form);
    let firstInvalid = null;
    inputs.forEach((input) => {
      if (!validateField(input) && !firstInvalid) firstInvalid = input;
    });

    if (firstInvalid) {
      firstInvalid.focus({ preventScroll: false });
      announce('Some details are missing. Please review the highlighted fields.');
      return;
    }

    form.classList.add('is-sending');
    if (submitBtn) submitBtn.disabled = true;

    /* Demonstration only: there is no live endpoint. Replace this with your
       CRM or form service, keeping the same success message. */
    window.setTimeout(() => {
      form.classList.remove('is-sending');
      if (submitBtn) submitBtn.disabled = false;
      form.classList.add('is-sent');
      if (success) {
        success.hidden = false;
        success.focus?.({ preventScroll: true });
      }
      announce('Thank you. A residence specialist will contact you shortly.');
      success?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }, 950);
  });

  $('#form-again')?.addEventListener('click', () => {
    form.reset();
    form.classList.remove('is-sent');
    $$('.field.has-error', form).forEach((field) => field.classList.remove('has-error'));
    $$('.field__error', form).forEach((error) => (error.hidden = true));
    if (success) success.hidden = true;
    $('#f-name')?.focus();
  });
}

/* ====================================================== sticky mobile CTA = */
const mobileCta = $('#mobile-cta');
let enquiryInView = false;

const enquiry = $('#enquire');
if (enquiry && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entryLoop: for (const entry of entries) {
        enquiryInView = entry.isIntersecting;
        break entryLoop;
      }
      requestScroll();
    },
    { threshold: 0.15 }
  );
  io.observe(enquiry);
}

/* ========================================================= 3D experience == */
const stage = $('[data-stage]');
const stageCanvas = $('#scene');
const stagePreview = $('#stage-preview');
const stageNote = $('#stage-note');
const hotspotsBox = $('#hotspots');
const stageHint = $('#stage-hint');
const toolRotate = $('#btn-rotate');
const toolZoomIn = $('#btn-zoom-in');
const toolZoomOut = $('#btn-zoom-out');
const toolReset = $('#btn-reset');

/* Marker copy — the accessible information panel for each space. */
const SPACES = [
  {
    id: 'arrival',
    num: '01',
    name: 'Arrival Court',
    text: 'Guests arrive into a shaded stone court, screened from the coast road, where the full height of the entrance wall sets the tone for the house.',
    meta: 'Ground level · Court and garage',
    image: 'assets/img/story-privacy-928.jpg',
    alt: 'A private courtyard wall at dusk with a single slot window lit from within.'
  },
  {
    id: 'living',
    num: '02',
    name: 'Open Living Pavilion',
    text: 'A double height pavilion that opens across its whole southern face, so the living room, terrace and water read as one continuous space.',
    meta: 'Ground level · 10 × 8 m, 6.4 m high',
    image: 'assets/img/gallery-living-pavilion-1376.jpg',
    alt: 'The open living pavilion with a double height oak ceiling and glass doors drawn back to the terrace.'
  },
  {
    id: 'pool',
    num: '03',
    name: 'Infinity Pool',
    text: 'Eighteen metres of still water set flush with the terrace, its far edge dissolving into the horizon at the end of the garden.',
    meta: 'Waterfront terrace · 18 × 4 m',
    image: 'assets/img/gallery-pool-terrace-1376.jpg',
    alt: 'The infinity pool at twilight, its dark stone edge meeting the sea horizon.'
  },
  {
    id: 'garden',
    num: '04',
    name: 'Private Garden Suite',
    text: 'A self-contained suite on the quiet eastern side of the house, opening onto its own planted courtyard, out of sight from the main rooms.',
    meta: 'Ground level · Suite and courtyard',
    image: 'assets/img/story-light-928.jpg',
    alt: 'Morning light crossing a concrete wall and stone floor on its way in from the eastern garden.'
  }
];

const spaceById = (id) => SPACES.find((space) => space.id === id);

const infoPanel = $('#info-panel');
const infoEmpty = $('#info-empty');
const infoDetail = $('#info-detail');
let activeSpace = null;
let experience = null;

function renderSpace(id) {
  const space = spaceById(id);
  if (!space || !infoDetail) return;
  activeSpace = id;

  $('#info-num').textContent = `${space.num} / 04`;
  $('#info-title').textContent = space.name;
  $('#info-text').textContent = space.text;
  $('#info-meta').textContent = space.meta;
  const img = $('#info-img');
  if (img) {
    img.src = space.image;
    img.alt = space.alt;
    warmMedia(infoDetail);
  }

  if (infoEmpty) infoEmpty.hidden = true;
  infoDetail.hidden = false;

  $$('[data-hotspot]').forEach((btn) => {
    const isActive = btn.dataset.hotspot === id;
    btn.setAttribute('aria-pressed', String(isActive));
    btn.classList.toggle('is-active', isActive);
  });
  /* keep the marker in the model in step with the panel */
  experience?.setSelected?.(id);

  infoDetail.focus({ preventScroll: true });
  announce(`${space.name} selected. ${space.text}`);
}

function closeSpace() {
  activeSpace = null;
  if (infoDetail) infoDetail.hidden = true;
  if (infoEmpty) infoEmpty.hidden = false;
  $$('[data-hotspot]').forEach((btn) => {
    btn.setAttribute('aria-pressed', 'false');
    btn.classList.remove('is-active');
  });
  experience?.clearSelection();
}

$$('[data-hotspot]').forEach((btn) => {
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => renderSpace(btn.dataset.hotspot));
});
$('#info-close')?.addEventListener('click', () => {
  const previous = activeSpace;
  closeSpace();
  if (previous) $(`.marker-index__btn[data-hotspot="${previous}"]`)?.focus({ preventScroll: true });
});

function setToolState(api) {
  if (!api) return;
  const hasLevels = typeof api.setLevel === 'function';
  if (!hasLevels) return;
}

/** WebGL is probed once, on a throwaway canvas, so that devices without it
    are told immediately instead of waiting for the model to be scrolled to. */
const webglAvailable = (() => {
  try {
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!context) return false;
    const lose = context.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch (error) {
    return false;
  }
})();

function modelUnavailable(reason) {
  if (stagePreview) {
    stagePreview.classList.remove('is-hidden');
    stagePreview.classList.add('stage__preview--fallback');
  }
  if (stageNote) {
    stageNote.textContent = reason;
  }
  if (hotspotsBox) hotspotsBox.hidden = true;
  if (stageHint) stageHint.hidden = true;
  [toolRotate, toolZoomIn, toolZoomOut, toolReset].forEach((btn) => {
    if (btn) btn.disabled = true;
  });
  if (stageCanvas) stageCanvas.hidden = true;
}

const FALLBACK_NOTE =
  'Three-dimensional view unavailable on this device — the gallery below shows the residence in full.';

async function startExperience() {
  if (!stageCanvas || !hotspotsBox) return;
  if (!webglAvailable) {
    modelUnavailable(FALLBACK_NOTE);
    return;
  }

  let module;
  try {
    module = await import('./experience.js');
  } catch (error) {
    modelUnavailable('Three-dimensional view could not be loaded — the gallery below shows the residence in full.');
    return;
  }

  try {
    experience = await module.initExperience({
      canvas: stageCanvas,
      hotspotsContainer: hotspotsBox,
      spaces: SPACES.map((space) => ({ id: space.id, num: space.num, name: space.name })),
      reducedMotion: reduceMotion,
      onSelect: (id) => renderSpace(id),
      onReady: () => {
        stagePreview?.classList.add('is-hidden');
        if (stageHint) {
          stageHint.hidden = false;
          window.setTimeout(() => stageHint.classList.add('is-faded'), 6000);
        }
        hotspotsBox.hidden = false;
      },
      onStatus: (message) => {
        if (stageNote) stageNote.textContent = message;
      }
    });
  } catch (error) {
    modelUnavailable('Three-dimensional view unavailable — the gallery below shows the residence in full.');
    return;
  }

  if (toolRotate && experience) {
    const initial = experience.autoRotate;
    toolRotate.setAttribute('aria-pressed', String(initial));
    toolRotate.addEventListener('click', () => {
      const next = toolRotate.getAttribute('aria-pressed') !== 'true';
      toolRotate.setAttribute('aria-pressed', String(next));
      experience.setAutoRotate(next);
      announce(next ? 'Automatic rotation on.' : 'Automatic rotation off.');
    });
  }
  toolZoomIn?.addEventListener('click', () => experience.zoom(-1));
  toolZoomOut?.addEventListener('click', () => experience.zoom(1));
  toolReset?.addEventListener('click', () => {
    experience.resetView();
    announce('Camera reset.');
  });

  $$('.level-btn').forEach((btn) => {
    btn.disabled = false;
    btn.setAttribute('aria-pressed', btn.dataset.level === 'ground' ? 'true' : 'false');
    btn.addEventListener('click', () => {
      $$('.level-btn').forEach((other) => other.setAttribute('aria-pressed', String(other === btn)));
      experience.setLevel(btn.dataset.level);
      announce(`${btn.textContent.trim()} shown.`);
    });
  });

  setToolState(experience);
}

if (stage) {
  if (!webglAvailable) {
    /* no WebGL: the static preview, the gallery and every call to action remain */
    modelUnavailable(FALLBACK_NOTE);
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          io.disconnect();
          startExperience();
        }
      },
      { rootMargin: '400px 0px' }
    );
    io.observe(stage);
  } else {
    startExperience();
  }
}

/* ============================================== reduced-motion machinery == */
if (reduceMotion) {
  toolRotate?.setAttribute('aria-pressed', 'false');
}

/* keep the page honest when the tab is backgrounded */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) experience?.pause?.();
  else experience?.resume?.();
});

/* expose for debugging and for anyone extending the demo */
window.AureliaHouse = { site, get experience() { return experience; }, renderSpace, closeSpace };
