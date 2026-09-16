/**
 * Headless checks for the Aurelia House page.
 *
 *   npm install      (once — installs jsdom)
 *   npm test
 *
 * Three suites:
 *   1. scene  — the procedural model builds without invalid geometry
 *   2. model  — the 3D controller, markers, levels and camera API
 *   3. page   — every other behaviour, plus structural and accessibility rules
 *
 * The page suite runs against index.html in jsdom, which has no WebGL: that is
 * also how the "3D unavailable" fallback is verified.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

let JSDOM;
try {
  ({ JSDOM } = await import('jsdom'));
} catch (error) {
  console.error('jsdom is not installed. Run: npm install');
  process.exit(2);
}

const results = [];
let currentSuite = '';
const suite = (name) => {
  currentSuite = name;
  results.push(`\n── ${name} ${'─'.repeat(Math.max(0, 56 - name.length))}`);
};
const check = (name, condition, detail = '') => {
  results.push(`  ${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  return condition;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function expose(window, extra = []) {
  const keys = [
    'window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent',
    'KeyboardEvent', 'getComputedStyle', 'navigator', 'location', 'history', 'requestAnimationFrame',
    'cancelAnimationFrame', 'FormData', 'DOMRect', 'DocumentFragment', 'NodeList', ...extra
  ];
  for (const key of keys) {
    if (window[key] === undefined) continue;
    try {
      globalThis[key] = window[key];
    } catch (error) {
      Object.defineProperty(globalThis, key, { value: window[key], configurable: true });
    }
  }
  globalThis.self = window;
}

function stubObservers(window) {
  window.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; }
    observe(target) { this.target = target; }
    unobserve() {}
    disconnect() {}
  };
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia = (query) => ({
    matches: false, media: query,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}
  });
  window.Element.prototype.scrollIntoView = function scrollIntoView() {};
  window.scrollTo = () => {};
  window.devicePixelRatio = 2;
}

/* ============================================================== 1. scene == */
async function sceneSuite() {
  suite('scene — procedural model');
  const THREE = await import(resolve(root, 'assets/vendor/three.module.min.js'));
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const { buildSite, buildHouse, createMaterials, MARKER_ANCHORS } = await import(
    resolve(root, 'assets/js/experience.js')
  );

  const mats = createMaterials();
  const groups = {
    site: new THREE.Group(), landscape: new THREE.Group(), lights: new THREE.Group(),
    ground: new THREE.Group(), upper: new THREE.Group(), roof: new THREE.Group()
  };
  buildSite(groups, mats);
  buildHouse(groups, mats);

  let meshes = 0;
  let triangles = 0;
  const invalid = [];
  for (const group of Object.values(groups)) {
    group.traverse((child) => {
      if (!child.isMesh) return;
      meshes += 1;
      const geometry = child.geometry;
      triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
      for (const value of Object.values(child.geometry.parameters || {})) {
        if (typeof value === 'number' && !Number.isFinite(value)) invalid.push(child.name || 'unnamed');
      }
      if (![child.position.x, child.position.y, child.position.z].every(Number.isFinite)) {
        invalid.push(child.name || 'unnamed');
      }
    });
  }

  check('model builds without throwing', meshes > 0);
  check('geometry values are all finite', invalid.length === 0, invalid.join(', '));
  check('payload stays light (< 8k triangles)', triangles < 8000, `${Math.round(triangles)} triangles`);
  check('mesh count stays modest (< 320)', meshes < 320, `${meshes} meshes`);
  check('four marker anchors defined', Object.keys(MARKER_ANCHORS).length === 4);
  check('markers sit within the plot', Object.values(MARKER_ANCHORS)
    .every(([x, y, z]) => Math.abs(x) < 22 && y > 0 && y < 9 && Math.abs(z) < 20));
}

/* ============================================================== 2. model == */
async function modelSuite() {
  suite('model — 3D controller');
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="frame" style="width:1200px;height:750px"><canvas id="scene"></canvas></div><div id="hotspots"></div></body></html>',
    { pretendToBeVisual: true, url: 'https://example.test/' }
  );
  const { window } = dom;

  window.HTMLCanvasElement.prototype.getContext = function getContext(type) {
    if (type !== '2d') return null;
    return {
      createLinearGradient: () => ({ addColorStop() {} }),
      fillRect() {},
      set fillStyle(value) {},
      get fillStyle() { return ''; }
    };
  };
  stubObservers(window);
  expose(window, ['ResizeObserver', 'IntersectionObserver']);

  const canvas = window.document.querySelector('#scene');
  Object.defineProperty(canvas, 'clientWidth', { value: 1200 });
  Object.defineProperty(canvas, 'clientHeight', { value: 750 });
  Object.defineProperty(canvas.parentElement, 'clientWidth', { value: 1200 });
  Object.defineProperty(canvas.parentElement, 'clientHeight', { value: 750 });

  /* a stub renderer that runs the animation loop for a few frames */
  const frames = { count: 0 };
  const rendererFactory = () => ({
    outputColorSpace: '', toneMapping: 0, toneMappingExposure: 1,
    shadowMap: { enabled: false, type: 0 },
    setPixelRatio() {}, setSize() {},
    render() { frames.count += 1; },
    setAnimationLoop(loop) {
      this.loop = loop;
      if (!loop) { this.running = false; return; }
      if (this.running) return;
      this.running = true;
      let n = 0;
      const step = () => {
        if (!this.running || !this.loop || n++ > 8) return;
        this.loop();
        setTimeout(step, 0);
      };
      setTimeout(step, 0);
    },
    dispose() {}
  });

  const spaces = [
    { id: 'arrival', num: '01', name: 'Arrival Court' },
    { id: 'living', num: '02', name: 'Open Living Pavilion' },
    { id: 'pool', num: '03', name: 'Infinity Pool' },
    { id: 'garden', num: '04', name: 'Private Garden Suite' }
  ];

  let ready = 0;
  const selected = [];
  const statuses = [];
  const { initExperience } = await import(resolve(root, 'assets/js/experience.js'));
  const controller = await initExperience({
    canvas,
    hotspotsContainer: window.document.querySelector('#hotspots'),
    spaces,
    rendererFactory,
    onSelect: (id) => selected.push(id),
    onReady: () => { ready += 1; },
    onStatus: (message) => statuses.push(message)
  });
  await wait(150);

  const buttons = [...window.document.querySelectorAll('.hotspot')];
  check('controller exposes the documented API',
    ['setAutoRotate', 'zoom', 'resetView', 'setLevel', 'focusHotspot', 'clearSelection', 'dispose', 'pause', 'resume', 'autoRotate']
      .every((key) => key in controller));
  check('one labelled marker per space', buttons.length === 4
    && buttons.every((b) => b.tagName === 'BUTTON' && /show details$/.test(b.getAttribute('aria-label'))));
  check('markers are numbered in order', buttons.map((b) => b.firstElementChild.textContent).join('') === '01020304');
  check('render frames are produced', ready === 1 && frames.count > 0, `${frames.count} frames`);
  check('status reported to the preview', statuses.length === 1 && /Establishing/.test(statuses[0]));
  check('markers receive screen positions',
    buttons.every((b) => /translate3d\(/.test(b.style.transform)), buttons[0].style.transform);
  check('markers are visible once placed', window.document.querySelector('#hotspots').style.visibility === 'visible');

  const bounds = buttons.map((b) => {
    const [, x, y] = b.style.transform.match(/translate3d\((-?[\d.]+)px, (-?[\d.]+)px/) || [];
    return { x: Number(x), y: Number(y) };
  });
  check('every marker lands inside the frame',
    bounds.every((p) => p.x > 0 && p.x < 1200 && p.y > 0 && p.y < 750), JSON.stringify(bounds));

  buttons[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('marker click reports the space id', selected[0] === 'living', JSON.stringify(selected));
  controller.setSelected('pool');
  check('selection marks one panel open',
    window.document.querySelectorAll('.hotspot[aria-expanded="true"]').length === 1);
  controller.clearSelection();
  check('clearing closes every panel',
    window.document.querySelectorAll('.hotspot[aria-expanded="true"]').length === 0);

  let threw = null;
  try {
    controller.setLevel('roof');
    controller.setLevel('upper');
    controller.setLevel('ground');
    controller.setLevel('nonsense');
    controller.setAutoRotate(true);
    controller.setAutoRotate(false);
    controller.zoom(-1);
    controller.zoom(1);
    controller.resetView();
    controller.focusHotspot('pool');
    controller.focusHotspot('does-not-exist');
    controller.pause();
    controller.resume();
  } catch (error) {
    threw = error;
  }
  check('camera and level controls never throw', threw === null, threw ? String(threw) : '');
  check('auto rotate flag round-trips', controller.autoRotate === false);
  check('keyboard control is described on the canvas',
    canvas.tabIndex === 0 && /Arrow keys rotate/.test(canvas.getAttribute('aria-label')));
  controller.dispose();
  check('dispose completes', true);
}

/* =============================================================== 3. page == */
async function pageSuite() {
  suite('page — behaviour, structure, accessibility');
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'https://example.test/aurelia-house/' });
  const { window } = dom;

  stubObservers(window);
  /* jsdom has no canvas backend: report "no WebGL" quietly rather than loudly */
  window.HTMLCanvasElement.prototype.getContext = function getContext() { return null; };
  const errors = [];
  window.addEventListener('error', (event) => errors.push('window error: ' + (event.message || event.error)));
  window.onunhandledrejection = (event) => errors.push('unhandled rejection: ' + event.reason);
  expose(window, ['ResizeObserver', 'IntersectionObserver']);
  Object.defineProperty(window, 'innerHeight', { value: 900, writable: true });

  const $ = (selector) => window.document.querySelector(selector);
  const $$ = (selector) => [...window.document.querySelectorAll(selector)];

  try {
    await import(resolve(root, 'assets/js/main.js'));
  } catch (error) {
    check('main.js loads', false, error.message);
    return;
  }
  window.dispatchEvent(new window.Event('load'));
  await wait(2400);

  check('page script runs without errors', errors.length === 0, errors.join(' | '));
  check('editable config is applied', $('.site-foot a[data-config-href="mail"]').textContent === 'residences@aurelia.example');
  check('phone links are normalised', $('.site-foot a[data-config-href="tel"]').getAttribute('href') === 'tel:+34951234567');
  check('bracketed placeholders remain editable',
    $$('.distance__time').map((el) => el.textContent).join(',') === '[8 min],[15 min],[12 min],[5 min]'
    && $('[data-config="studio"]').textContent === '[STUDIO NAME]');
  check('preloader dismisses on its own', $('#preloader').classList.contains('is-done'));
  check('page scroll is released', !window.document.documentElement.classList.contains('is-locked'));

  /* CTA plumbing */
  check('primary CTAs are present and consistent',
    $$('[data-cta="viewing"]').length >= 5
    && $$('[data-cta="viewing"]').every((el) => el.tagName !== 'A' || el.getAttribute('href') === '#enquire'));
  check('secondary link points at the model', $('.link-arrow[data-scroll]').getAttribute('href') === '#residence');
  check('gallery alternative offered from the 3D panel', /View property gallery instead/.test($('.experience__alt').textContent));

  /* floor plans */
  check('three floor plans rendered', $$('.plan-panel').length === 3);
  check('ground plan shown first', !$('#panel-ground').hasAttribute('hidden') && $('#panel-upper').hasAttribute('hidden'));
  $('#tab-upper').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('tabs switch plans', !$('#panel-upper').hasAttribute('hidden') && $('#panel-ground').hasAttribute('hidden'));
  check('tab state is announced', $('#tab-upper').getAttribute('aria-selected') === 'true');
  const legend = $('#panel-upper .plan-legend__btn');
  legend.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('legend selection highlights the drawing',
    Boolean($(`#panel-upper .p-room[data-room="${legend.dataset.target}"].is-hi`))
    && legend.getAttribute('aria-pressed') === 'true');
  legend.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('legend clears again', !$(`#panel-upper .p-room[data-room="${legend.dataset.target}"].is-hi`));

  /* gallery */
  $('.gallery-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await wait(40);
  check('gallery opens in a lightbox', !$('#lightbox').hasAttribute('hidden')
    && $('#lightbox-img').getAttribute('src').includes('gallery-exterior-sunset'));
  check('lightbox captions and count', $('#lightbox-title').textContent === 'Evening light over the water'
    && $('#lightbox-count').textContent.trim() === '01 / 06');
  $('#lightbox-next').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('lightbox advances', $('#lightbox-img').getAttribute('src').includes('gallery-living-pavilion'));
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(400);
  check('lightbox closes on Escape', $('#lightbox').hasAttribute('hidden'));

  /* WebGL fallback (jsdom has no WebGL context) */
  check('3D falls back instead of showing a blank canvas',
    $('#stage-preview').classList.contains('stage__preview--fallback')
    && /unavailable|could not be loaded/i.test($('#stage-note').textContent));
  check('model controls are disabled in the fallback', $$('.stage__tools .tool').every((b) => b.disabled));
  check('level selector is disabled until the model is ready', $$('.level-btn').every((b) => b.disabled));
  check('hotspot layer stays hidden in the fallback', $('#hotspots').hasAttribute('hidden'));

  /* form */
  const form = $('#viewing-form');
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(40);
  check('empty submit is blocked and explained', $$('#viewing-form .field.has-error').length >= 4
    && $('#f-name').getAttribute('aria-invalid') === 'true');
  check('no success message before validation passes', !form.classList.contains('is-sent'));
  $('#f-name').value = 'A. Buyer';
  $('#f-email').value = 'buyer@example.com';
  $('#f-phone').value = '+34 600 000 000';
  $('#f-date').value = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  $('#f-consent').checked = true;
  $$('#viewing-form input').forEach((input) => input.dispatchEvent(new window.Event('input', { bubbles: true })));
  $('#f-consent').dispatchEvent(new window.Event('change', { bubbles: true }));
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(1400);
  check('valid submit shows the confirmation', form.classList.contains('is-sent')
    && !$('#form-success').hasAttribute('hidden')
    && /Thank you\. A residence specialist will contact you shortly\./.test($('.form__success-title').textContent));
  check('the confirmation can be reset', (() => {
    $('#form-again').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    return !form.classList.contains('is-sent') && $('#f-name').value === '';
  })());

  /* privacy sheet */
  $('[data-panel="privacy"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('privacy note opens', !$('#privacy').hasAttribute('hidden'));

  /* structural and accessibility rules */
  check('one h1 on the page', $$('h1').length === 1);
  check('heading order never skips a level', (() => {
    const levels = $$('h1,h2,h3,h4').map((h) => Number(h.tagName[1]));
    return levels.every((level, index) => index === 0 || level <= levels[index - 1] + 1);
  })());
  check('every image has alt text', $$('img').every((img) => img.hasAttribute('alt')));
  check('every control is labelled', $$('input, textarea').every((el) => Boolean(window.document.querySelector(`label[for="${el.id}"]`))));
  check('no duplicate ids', (() => {
    const ids = $$('[id]').map((el) => el.id);
    return new Set(ids).size === ids.length;
  })());
  check('structured data parses', (() => {
    try { JSON.parse($('script[type="application/ld+json"]').textContent); return true; } catch (error) { return false; }
  })());
  check('SEO title and description present',
    /Aurelia House \| Private Waterfront Residence in Marbella/.test(window.document.title)
    && /immersive 3D property experience/.test($('meta[name="description"]').getAttribute('content')));
  check('social metadata present',
    Boolean($('meta[property="og:image"]') && $('meta[name="twitter:card"]') && $('meta[property="og:title"]')));
  check('concept nature is stated on the page',
    /Concept project created for demonstration purposes/.test($('.concept-flag').textContent)
    && /Concept website for demonstration/.test($('.site-foot').textContent));
  check('no fake claims: no testimonials, awards or press logos',
    !/testimonial|award|as featured in|rated \d/i.test(html));
  check('reduced motion is respected in code', /prefers-reduced-motion/.test(readFileSync(resolve(root, 'assets/css/main.css'), 'utf8'))
    && /reduceMotion/.test(readFileSync(resolve(root, 'assets/js/main.js'), 'utf8')));
}

await sceneSuite();
await modelSuite();
await pageSuite();

console.log(results.join('\n'));
const flat = results.filter((line) => line.includes('PASS') || line.includes('FAIL'));
const failed = flat.filter((line) => line.includes('FAIL'));
console.log(`\n${flat.length - failed.length}/${flat.length} checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  failed.forEach((line) => console.log(line));
  process.exit(1);
}
