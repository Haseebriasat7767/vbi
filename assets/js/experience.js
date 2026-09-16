/**
 * Aurelia Residences — interactive 3D model of Aurelia House.
 *
 * The house is assembled procedurally from the same coordinate system used by
 * the floor plans (see tools/build-floorplans.mjs):
 *
 *     metres.x = (planX - 565) * 0.045
 *     metres.z = (planY - 340) * 0.045
 *
 * Nothing is downloaded: geometry is primitive, materials are analytic and the
 * sky is a generated gradient. That keeps the payload small and the first
 * frame fast, while staying faithful to the drawings.
 */
import * as THREE from '../vendor/three.module.min.js';

/* ========================================================= marker anchors = */
export const MARKER_ANCHORS = {
  arrival: [-13.8, 2.6, -1.7],
  living: [-4.1, 3.6, 5.9],
  pool: [0, 0.8, 12.1],
  garden: [13.4, 2.0, -1.5]
};

const isMobile = () => window.matchMedia('(max-width: 860px)').matches;

/* ============================================================== materials = */
function createMaterials() {
  const solid = (color, roughness = 0.85, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  return {
    concrete: solid(0x4c4a45, 0.92),
    concreteDark: solid(0x36342f, 0.9),
    travertine: solid(0x8d8679, 0.76),
    stone: solid(0x3b3833, 0.85),
    wood: solid(0x6d4e30, 0.72),
    woodWarm: solid(0x8d6438, 0.66),
    dark: solid(0x14140f, 0.95),
    lawn: solid(0x2d3629, 1),
    planting: solid(0x37412f, 0.95),
    metal: new THREE.MeshStandardMaterial({ color: 0x272725, roughness: 0.42, metalness: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x9db0b7,
      roughness: 0.06,
      metalness: 0.1,
      transparent: true,
      opacity: 0.24,
      envMapIntensity: 1.6,
      side: THREE.DoubleSide,
      depthWrite: false
    }),
    glassWarm: new THREE.MeshPhysicalMaterial({
      color: 0xd9b98d,
      roughness: 0.08,
      transparent: true,
      opacity: 0.28,
      envMapIntensity: 1.4,
      side: THREE.DoubleSide,
      depthWrite: false
    }),
    balustrade: new THREE.MeshPhysicalMaterial({
      color: 0x93a6ab,
      roughness: 0.1,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false
    }),
    water: new THREE.MeshStandardMaterial({ color: 0x0a1a20, roughness: 0.07, metalness: 0.6, envMapIntensity: 1.5 }),
    sea: new THREE.MeshStandardMaterial({ color: 0x08131a, roughness: 0.13, metalness: 0.55, envMapIntensity: 1.3 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffc98f }),
    glowSoft: new THREE.MeshBasicMaterial({ color: 0xffc98f, transparent: true, opacity: 0.4 }),
    interior: new THREE.MeshStandardMaterial({
      color: 0x2b2016,
      emissive: 0xffb877,
      emissiveIntensity: 0.55,
      roughness: 0.9
    }),
    interiorFloor: new THREE.MeshStandardMaterial({
      color: 0x6d5c47,
      emissive: 0xffb877,
      emissiveIntensity: 0.2,
      roughness: 0.7
    }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x3e4b39, roughness: 1, flatShading: true }),
    foliageDark: new THREE.MeshStandardMaterial({ color: 0x2d3730, roughness: 1, flatShading: true }),
    bark: new THREE.MeshStandardMaterial({ color: 0x40362b, roughness: 0.95 })
  };
}

/* ================================================================ helpers = */
function box(w, h, d, material, [x, y, z] = [0, 0, 0], opts = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.02), Math.max(h, 0.02), Math.max(d, 0.02)), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.cast !== false;
  mesh.receiveShadow = opts.receive !== false;
  if (opts.name) mesh.name = opts.name;
  return mesh;
}

/** A block defined by its extents in metres (x, z and y ranges). */
function block(x1, x2, z1, z2, y1, y2, material, opts = {}) {
  return box(Math.abs(x2 - x1), Math.abs(y2 - y1), Math.abs(z2 - z1), material,
    [(x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2], opts);
}

function plane(w, d, material, [x, y, z]) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * One elevation of glazing: a single pane, slim mullions, head and sill.
 * Works for walls running east–west or north–south.
 */
function glazing(x1, x2, z1, z2, y1, y2, paneMaterial, mullionMaterial) {
  const group = new THREE.Group();
  const spanX = Math.abs(x2 - x1);
  const spanZ = Math.abs(z2 - z1);
  const horizontal = spanX >= spanZ;
  const w = horizontal ? spanX : 0.06;
  const d = horizontal ? 0.06 : spanZ;
  const h = Math.abs(y2 - y1);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const cy = (y1 + y2) / 2;

  group.add(box(w, h, d, paneMaterial, [cx, cy, cz], { cast: false, receive: false }));

  const span = horizontal ? spanX : spanZ;
  const divisions = Math.max(1, Math.round(span / 2.4));
  for (let i = 0; i <= divisions; i += 1) {
    const t = i / divisions;
    const px = horizontal ? x1 + (x2 - x1) * t : cx;
    const pz = horizontal ? cz : z1 + (z2 - z1) * t;
    group.add(box(0.09, h, 0.09, mullionMaterial, [px, cy, pz], { cast: false, receive: false }));
  }
  group.add(box(horizontal ? spanX : 0.12, 0.1, horizontal ? 0.12 : spanZ, mullionMaterial, [cx, y2, cz],
    { cast: false, receive: false }));
  group.add(box(horizontal ? spanX : 0.12, 0.1, horizontal ? 0.12 : spanZ, mullionMaterial, [cx, y1, cz],
    { cast: false, receive: false }));
  return group;
}

/* ========================================================== the landscape = */
function buildSite(groups, mats) {
  const site = groups.site;

  site.add(plane(340, 340, mats.dark, [0, -0.34, 0]));
  /* the water, running to the horizon on the seaward side */
  site.add(plane(420, 280, mats.sea, [0, -0.38, 160]));

  /* lawns, gardens and the paved arrival court */
  site.add(block(-20.48, -11.48, -0.45, 13.05, -0.22, 0.06, mats.lawn));
  site.add(block(11.93, 17.78, -0.45, 13.05, -0.22, 0.06, mats.lawn));
  site.add(block(-20.48, -10.58, -12.6, -4.05, -0.22, 0.07, mats.stone));
  site.add(block(13.6, 17.6, 4.4, 11.6, -0.08, 0.02, mats.water, { cast: false }));

  /* board formed boundary walls, screening the plot from the coast road */
  site.add(block(-20.48, -11.48, -12.62, -12.22, -0.22, 2.3, mats.concreteDark));
  site.add(block(-24.9, -24.5, -12.62, 3.2, -0.22, 2.3, mats.concreteDark));
  site.add(block(-20.48, -11.48, -1.2, -0.8, -0.22, 1.9, mats.concreteDark));

  /* stone path from the court to the water's edge */
  for (let i = 0; i < 9; i += 1) {
    const t = i / 8;
    site.add(block(-19.6 - t * 0.5, -17.3 - t * 0.5, -3.6 + t * 15.4, -2.0 + t * 15.4, 0.02, 0.11, mats.travertine,
      { cast: false }));
  }

  /* olives, low polygon and placed clear of the house */
  [[-19.4, -10.6, 1.0], [-14.6, -8.4, 0.85], [-22.4, 6.4, 1.15], [-16.4, 10.6, 0.9],
   [-13.6, 3.4, 0.8], [-2.6, 18.4, 1.05], [6.4, 18.8, 0.9], [14.6, -7.6, 1.0],
   [16.8, 2.6, 0.85], [13.2, 12.8, 0.95], [-6.6, -13.8, 0.8], [16.4, 9.2, 0.75]]
    .forEach(([x, z, s], index) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.28 * s, 2.1 * s, 6), mats.bark);
      trunk.position.y = 1.05 * s;
      trunk.castShadow = true;
      tree.add(trunk);
      const canopyMaterial = index % 3 === 0 ? mats.foliageDark : mats.foliage;
      for (let c = 0; c < 3; c += 1) {
        const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95 * s, 0), canopyMaterial);
        canopy.position.set((c - 1) * 0.6 * s, (2.15 + (c % 2) * 0.5) * s, (c % 2 ? 0.4 : -0.35) * s);
        canopy.rotation.set(c, c * 1.7, c * 0.6);
        canopy.scale.set(1, 0.78, 1);
        canopy.castShadow = true;
        tree.add(canopy);
      }
      tree.position.set(x, 0, z);
      tree.rotation.y = index * 0.7;
      groups.landscape.add(tree);
    });

  /* ornamental grasses, instanced */
  const bladeGeometry = new THREE.ConeGeometry(0.075, 0.95, 4);
  bladeGeometry.translate(0, 0.47, 0);
  const total = isMobile() ? 96 : 180;
  const grasses = new THREE.InstancedMesh(bladeGeometry, mats.foliage, total);
  const dummy = new THREE.Object3D();
  const bands = [
    [-11.5, -12.3, -11.7, 12.0],
    [-11.4, 17.9, 12.4, 12.9],
    [-21.0, -17.6, -11.9, -6.6],
    [14.4, 18.1, 5.2, 12.8]
  ];
  let placed = 0;
  bands.forEach(([x1, x2, z1, z2]) => {
    for (let i = 0; i < 60 && placed < total; i += 1) {
      dummy.position.set(x1 + Math.random() * (x2 - x1), 0, z1 + Math.random() * (z2 - z1));
      dummy.rotation.y = Math.random() * Math.PI;
      const s = 0.8 + Math.random() * 0.7;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      grasses.setMatrixAt(placed, dummy.matrix);
      placed += 1;
    }
  });
  grasses.count = placed;
  groups.landscape.add(grasses);

  /* low garden lighting */
  [[-18.4, 0.6], [-18.4, 6.4], [13.0, 6.4], [15.9, 1.6], [-15.8, 11.4]].forEach(([x, z]) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.18, 10), mats.glowSoft);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, 0.1, z);
    groups.lights.add(disc);
  });
}

/* ========================================================== the residence = */
function buildHouse(groups, mats) {
  const W = { w: -10.58, e: 10.58, m: -4.95, s: 1.8 };

  /* -------------------------------------------------------- ground level - */
  const ground = groups.ground;
  ground.add(block(W.w - 0.4, W.e + 0.4, -10.75, 10.4, -0.38, 0.06, mats.concreteDark, { name: 'plinth' }));

  /* north wing: garage, core, wellness */
  ground.add(block(W.w, -2.8, -10.35, -4.95, 0.06, 3.4, mats.concrete, { name: 'garage-wing' }));
  ground.add(block(-2.8, 0.6, -10.35, -4.95, 0.06, 3.46, mats.concreteDark, { name: 'core' }));
  ground.add(block(0.6, W.e, -10.35, -4.95, 0.06, 3.4, mats.concrete, { name: 'wellness-wing' }));

  /* mid band: entry gallery, kitchen, garden suite */
  ground.add(block(W.w, W.e, W.m, W.s, 0.06, 3.4, mats.wood, { name: 'mid-band' }));

  /* recessed entrance, canopy, garage door */
  ground.add(block(W.w - 0.45, W.w + 0.02, -2.7, 1.0, 0.06, 2.9, mats.dark, { cast: false, name: 'entry-recess' }));
  ground.add(block(W.w - 2.8, W.w + 0.12, -3.4, 1.6, 3.3, 3.5, mats.concrete, { name: 'entry-canopy' }));
  ground.add(box(0.22, 3.24, 0.22, mats.concrete, [W.w - 2.6, 1.68, 1.4], { name: 'canopy-post' }));
  ground.add(box(2.5, 2.7, 0.12, mats.woodWarm, [W.w - 1.35, 1.36, 0.9], { cast: false, name: 'entry-door' }));
  ground.add(box(3.0, 2.5, 0.12, mats.metal, [-7.4, 1.32, -10.42], { cast: false, name: 'garage-door' }));

  /* glazing along the garden faces of the north wing and mid band */
  ground.add(glazing(W.w + 0.05, -3.6, W.m - 0.06, W.m - 0.06, 0.9, 3.05, mats.glassWarm, mats.metal));
  ground.add(glazing(1.4, W.e - 0.3, W.m - 0.06, W.m - 0.06, 1.0, 3.05, mats.glassWarm, mats.metal));
  ground.add(glazing(W.e - 0.06, W.e - 0.06, -4.6, 1.4, 0.9, 3.05, mats.glassWarm, mats.metal));

  /* ----------------------------------------------------- living pavilion - */
  const pavilion = new THREE.Group();
  const P = { w: W.w, e: 2.45, n: 1.8, s: 9.9, top: 6.4 };

  pavilion.add(block(P.w, P.e, P.n, P.s, 0.06, 0.2, mats.travertine, { name: 'pavilion-floor' }));
  pavilion.add(block(P.w + 0.1, P.e - 0.1, P.n + 0.1, P.s - 0.1, 0.2, 0.34, mats.interiorFloor,
    { cast: false, name: 'pavilion-interior' }));
  /* a warm wall of light, so the house reads as lit from within */
  pavilion.add(block(P.w + 0.4, P.e - 0.4, P.n + 0.5, P.n + 0.85, 0.4, 6.0, mats.interior, { cast: false }));

  [[P.w + 0.4, P.n + 0.4], [P.e - 0.4, P.n + 0.4], [P.w + 0.4, P.s - 0.4], [P.e - 0.4, P.s - 0.4],
   [-4.1, P.s - 0.4], [-7.4, P.n + 0.4]]
    .forEach(([x, z]) => {
      pavilion.add(block(x - 0.24, x + 0.24, z - 0.24, z + 0.24, 0.2, P.top, mats.concrete,
        { name: 'pavilion-column' }));
    });

  pavilion.add(block(P.w - 0.5, P.e + 0.6, P.n - 0.55, P.s + 0.8, P.top, P.top + 0.44, mats.concrete,
    { name: 'pavilion-roof' }));
  pavilion.add(block(P.w - 0.5, P.e + 0.6, P.s + 0.8, P.s + 0.9, P.top - 0.26, P.top, mats.woodWarm,
    { cast: false, name: 'pavilion-fascia' }));

  pavilion.add(glazing(P.w + 0.06, P.e - 0.06, P.s - 0.06, P.s - 0.06, 0.5, P.top - 0.25, mats.glass, mats.metal));
  pavilion.add(glazing(P.w + 0.06, P.w + 0.06, P.n + 0.12, P.s - 0.12, 0.5, P.top - 0.25, mats.glass, mats.metal));
  pavilion.add(glazing(P.e - 0.06, P.e - 0.06, P.n + 0.12, P.s - 0.12, 0.5, P.top - 0.25, mats.glass, mats.metal));

  /* a few pieces of furniture, kept abstract */
  pavilion.add(block(-8.6, -4.8, 3.9, 5.4, 0.34, 0.72, mats.woodWarm, { name: 'sofa' }));
  pavilion.add(block(-8.6, -4.8, 4.6, 5.4, 0.34, 1.3, mats.woodWarm, { name: 'sofa-back' }));
  pavilion.add(block(-6.4, -3.4, 6.9, 8.1, 0.34, 0.68, mats.stone, { name: 'low-table' }));
  ground.add(pavilion);

  /* ---------------------------------------------------- dining volume ---- */
  const dining = new THREE.Group();
  dining.add(block(2.45, W.e, 1.8, 9.9, 0.06, 3.4, mats.concrete, { name: 'dining-volume' }));
  dining.add(block(2.0, W.e + 0.75, 1.35, 10.55, 3.4, 3.74, mats.concrete, { name: 'dining-roof' }));
  dining.add(glazing(2.55, W.e - 0.15, 9.72, 9.72, 0.5, 3.05, mats.glass, mats.metal));
  dining.add(glazing(W.e - 0.15, W.e - 0.15, 2.1, 9.6, 0.5, 3.05, mats.glass, mats.metal));
  dining.add(block(3.5, 8.4, 4.7, 6.4, 0.34, 0.74, mats.woodWarm, { name: 'dining-table' }));
  ground.add(dining);

  /* ----------------------------------------------- waterside deck + pool - */
  const deck = new THREE.Group();
  const pool = { x1: -9.22, x2: 9.22, z1: 11.03, z2: 15.08 };
  const deckTop = 0.15;
  deck.add(block(W.w - 0.4, W.e + 0.4, 9.9, pool.z1, 0.06, deckTop, mats.travertine, { cast: false }));
  deck.add(block(W.w - 0.4, W.e + 0.4, pool.z2, 16.45, 0.06, deckTop, mats.travertine, { cast: false }));
  deck.add(block(W.w - 0.4, pool.x1, pool.z1, pool.z2, 0.06, deckTop, mats.travertine, { cast: false }));
  deck.add(block(pool.x2, W.e + 0.4, pool.z1, pool.z2, 0.06, deckTop, mats.travertine, { cast: false }));
  deck.add(block(pool.x1, pool.x2, pool.z1, pool.z2, -0.5, -0.12, mats.concreteDark, { cast: false }));
  deck.add(block(pool.x1 + 0.06, pool.x2 - 0.06, pool.z1 + 0.06, pool.z2 - 0.06, -0.11, 0.07, mats.water,
    { cast: false, name: 'pool-water' }));
  /* flush infinity edge, and the sea beyond it */
  deck.add(block(pool.x1, pool.x2, pool.z2 - 0.08, pool.z2 + 0.03, 0.07, 0.13, mats.glowSoft,
    { cast: false, name: 'pool-lip' }));
  [[-7.4], [6.9]].forEach(([x]) => {
    deck.add(block(x - 0.42, x + 0.42, 11.9, 13.9, 0.15, 0.44, mats.woodWarm, { name: 'lounger' }));
    deck.add(block(x - 0.42, x + 0.42, 11.9, 12.4, 0.44, 0.74, mats.woodWarm, { name: 'lounger-back' }));
  });
  [[-9.2, 10.8], [9.2, 10.8], [-9.2, 15.3], [9.2, 15.3], [0, 15.3], [-4.6, 10.8], [4.6, 10.8]]
    .forEach(([x, z]) => {
      groups.lights.add(box(0.55, 0.03, 0.06, mats.glow, [x, 0.17, z], { cast: false, receive: false }));
    });
  ground.add(deck);

  /* -------------------------------------------------------- upper level - */
  const upper = groups.upper;
  const U = { w: W.w, e: W.e, n: -9.0, s: 1.8, floor: 3.4, top: 6.4 };

  upper.add(block(U.w, U.e, U.n - 0.5, U.s + 0.45, U.floor, U.floor + 0.34, mats.concrete, { name: 'upper-slab' }));
  upper.add(block(U.w, -2.5, U.n, U.s, U.floor + 0.34, U.top, mats.concrete, { name: 'upper-west' }));
  upper.add(block(-2.5, 3.83, U.n, -3.6, U.floor + 0.34, U.top, mats.wood, { name: 'upper-centre' }));
  upper.add(block(3.83, U.e, U.n, -1.58, U.floor + 0.34, U.top, mats.wood, { name: 'master-suite' }));
  upper.add(block(3.83, U.e, -1.58, U.s + 0.45, U.floor + 0.05, U.floor + 0.34, mats.travertine,
    { cast: false, name: 'master-terrace' }));
  upper.add(block(3.83, U.e, U.s + 0.31, U.s + 0.45, U.floor + 0.34, U.floor + 1.42, mats.balustrade, { cast: false }));
  upper.add(block(3.83, 3.97, -1.58, U.s + 0.45, U.floor + 0.34, U.floor + 1.42, mats.balustrade, { cast: false }));
  upper.add(block(U.w - 0.35, U.e + 0.35, U.n - 0.35, U.s + 0.6, U.top, U.top + 0.38, mats.concrete,
    { name: 'upper-roof-slab' }));

  upper.add(glazing(U.w + 0.12, -2.62, U.s - 0.05, U.s - 0.05, U.floor + 0.75, U.top - 0.3, mats.glass, mats.metal));
  upper.add(glazing(4.0, U.e - 0.12, -1.5, -1.5, U.floor + 0.75, U.top - 0.3, mats.glass, mats.metal));
  upper.add(glazing(U.w + 0.05, U.w + 0.05, U.n + 1.8, -3.8, U.floor + 0.75, U.top - 0.3, mats.glass, mats.metal));
  upper.add(glazing(U.e - 0.05, U.e - 0.05, U.n + 1.6, -1.75, U.floor + 0.75, U.top - 0.3, mats.glass, mats.metal));

  /* ------------------------------------------------------- roof terrace - */
  const roof = groups.roof;
  const R = { w: -10.23, e: 10.23, n: -8.8, s: 1.4, deck: 6.78 };

  roof.add(block(R.w - 0.5, R.e + 0.5, R.n - 0.55, R.n - 0.28, R.deck, R.deck + 0.92, mats.concreteDark,
    { name: 'parapet-north' }));
  roof.add(block(R.w - 0.5, R.w - 0.22, R.n - 0.55, R.s + 0.45, R.deck, R.deck + 0.92, mats.concreteDark,
    { name: 'parapet-west' }));
  roof.add(block(R.e + 0.22, R.e + 0.5, R.n - 0.55, R.s + 0.45, R.deck, R.deck + 0.92, mats.concreteDark,
    { name: 'parapet-east' }));
  roof.add(block(R.w - 0.5, R.e + 0.5, R.s + 0.18, R.s + 0.45, R.deck, R.deck + 0.55, mats.concreteDark,
    { name: 'parapet-south' }));

  roof.add(block(R.w + 0.3, R.e - 0.3, R.n + 0.3, R.n + 1.2, R.deck, R.deck + 0.44, mats.planting,
    { name: 'roof-planting-north' }));
  roof.add(block(R.e - 1.2, R.e - 0.3, R.n + 0.3, R.s - 0.35, R.deck, R.deck + 0.44, mats.planting,
    { name: 'roof-planting-east' }));
  roof.add(block(R.w + 0.3, R.w + 1.2, R.n + 0.3, -3.4, R.deck, R.deck + 0.44, mats.planting,
    { name: 'roof-planting-west' }));

  /* pergola over the western half */
  for (let i = 0; i < 7; i += 1) {
    const x = R.w + 1.5 + i * 1.32;
    roof.add(block(x - 0.07, x + 0.07, R.n + 1.7, R.s - 1.3, R.deck + 2.66, R.deck + 2.8, mats.woodWarm,
      { name: 'pergola-blade' }));
  }
  roof.add(block(R.w + 1.4, R.w + 1.58, R.n + 1.7, R.s - 1.3, R.deck, R.deck + 2.8, mats.woodWarm,
    { name: 'pergola-post-west' }));
  roof.add(block(R.e - 4.1, R.e - 3.92, R.n + 1.7, R.s - 1.3, R.deck, R.deck + 2.8, mats.woodWarm,
    { name: 'pergola-post-east' }));

  roof.add(block(R.e - 3.5, R.e - 0.6, R.n + 0.5, R.n + 2.3, R.deck, R.deck + 0.94, mats.stone,
    { name: 'outdoor-kitchen' }));
  roof.add(block(-2.75, 0.55, -9.0, -6.4, R.deck, R.deck + 1.6, mats.concreteDark, { name: 'stair-head' }));
  [[-8.6, -0.4], [-6.7, -0.4]].forEach(([x, z]) => {
    roof.add(block(x - 0.42, x + 0.42, z - 1.0, z + 1.0, R.deck, R.deck + 0.3, mats.woodWarm,
      { name: 'roof-lounger' }));
  });
  [[-6.4, -3.4], [-2.6, -3.4], [1.4, -3.4], [5.4, -3.4], [8.6, -3.4]].forEach(([x, z]) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), mats.glowSoft);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, R.deck + 0.03, z);
    groups.lights.add(disc);
  });
}

/* ================================================================== init = */
export async function initExperience({
  canvas,
  hotspotsContainer,
  spaces,
  reducedMotion = false,
  onSelect = () => {},
  onReady = () => {},
  onStatus = () => {},
  /* A seam for testing, and for anyone who wants a different renderer. */
  rendererFactory = (options) => new THREE.WebGLRenderer(options)
}) {
  const renderer = rendererFactory({
    canvas,
    antialias: !isMobile(),
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0d1015, 0.0078);
  const camera = new THREE.PerspectiveCamera(38, 16 / 10, 0.6, 420);

  /* ------------------------------------------------ sky, light, ambience - */
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 8;
  skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d');
  const gradient = skyCtx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#05070c');
  gradient.addColorStop(0.34, '#0e1522');
  gradient.addColorStop(0.46, '#26334a');
  gradient.addColorStop(0.5, '#60543f');
  gradient.addColorStop(0.53, '#3a3020');
  gradient.addColorStop(0.58, '#161412');
  gradient.addColorStop(1, '#0a0a09');
  skyCtx.fillStyle = gradient;
  skyCtx.fillRect(0, 0, 8, 256);
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.mapping = THREE.EquirectangularReflectionMapping;
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTexture;

  /* the generated sky doubles as a soft environment: glass, stone and water
     all need something to reflect. If it cannot be generated, the direct
     lights still carry the scene. */
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(skyTexture).texture;
    pmrem.dispose();
  } catch (error) {
    scene.environment = null;
  }

  const sun = new THREE.DirectionalLight(0xffd3a3, 2.4);
  sun.position.set(-46, 13, 26);
  sun.castShadow = true;
  const shadowSize = isMobile() ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 160;
  sun.shadow.camera.left = -36;
  sun.shadow.camera.right = 36;
  sun.shadow.camera.top = 32;
  sun.shadow.camera.bottom = -32;
  sun.shadow.bias = -0.0007;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);

  scene.add(new THREE.HemisphereLight(0x36435e, 0x181510, 0.7));

  const rim = new THREE.DirectionalLight(0x9fb6d8, 0.38);
  rim.position.set(34, 20, -30);
  scene.add(rim);

  [[-4.2, 3.4, 5.6], [6.6, 2.4, 5.0], [-6.8, 2.0, -2.2], [1.0, 5.2, -0.8], [13.0, 2.0, -1.6]]
    .forEach(([x, y, z]) => {
      const light = new THREE.PointLight(0xffc48f, 16, 20, 2);
      light.position.set(x, y, z);
      scene.add(light);
    });

  /* --------------------------------------------------------------- world - */
  const mats = createMaterials();
  const groups = {
    site: new THREE.Group(),
    landscape: new THREE.Group(),
    lights: new THREE.Group(),
    ground: new THREE.Group(),
    upper: new THREE.Group(),
    roof: new THREE.Group()
  };
  buildSite(groups, mats);
  buildHouse(groups, mats);

  const root = new THREE.Group();
  ['site', 'ground', 'upper', 'roof', 'landscape', 'lights'].forEach((key) => root.add(groups[key]));
  scene.add(root);

  /* -------------------------------------------------------------- camera - */
  const VIEW = {
    ground: { target: new THREE.Vector3(-1.5, 2.2, 2.2), radius: 44, polar: 1.16, azimuth: 0.78 },
    upper: { target: new THREE.Vector3(0.4, 5.0, -1.4), radius: 41, polar: 1.06, azimuth: 0.66 },
    roof: { target: new THREE.Vector3(-0.6, 7.3, -2.2), radius: 44, polar: 0.97, azimuth: 0.58 }
  };

  const desired = { azimuth: VIEW.ground.azimuth + 0.32, polar: VIEW.ground.polar, radius: VIEW.ground.radius * 1.18 };
  const current = { ...desired, polar: desired.polar + 0.04 };
  const target = VIEW.ground.target.clone();
  const desiredTarget = VIEW.ground.target.clone();
  const pointerGoal = { x: 0, y: 0 };
  const pointerOffset = { x: 0, y: 0 };
  let azimuthBias = 0;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function placeCamera(polar, azimuth, radius) {
    camera.position.set(
      target.x + radius * Math.sin(polar) * Math.sin(azimuth),
      target.y + radius * Math.cos(polar),
      target.z + radius * Math.sin(polar) * Math.cos(azimuth)
    );
    camera.lookAt(target);
  }
  placeCamera(current.polar, current.azimuth, current.radius);

  /* -------------------------------------------------------- interactions - */
  let autoRotate = !reducedMotion;
  let dragging = false;
  let activePointer = null;
  let lastX = 0;
  let lastY = 0;
  let pinchDistance = 0;

  function rotateBy(dx, dy) {
    const sensitivity = isMobile() ? 0.0055 : 0.0042;
    desired.azimuth -= dx * sensitivity;
    desired.polar = clamp(desired.polar - dy * 0.0033, 0.5, 1.44);
  }
  function zoomBy(factor) {
    desired.radius = clamp(desired.radius * factor, 17, 84);
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (activePointer !== null) return;
    activePointer = event.pointerId;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.classList.add('is-grabbing');
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      /* capture is optional */
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== activePointer) return;
    rotateBy(event.clientX - lastX, event.clientY - lastY);
    lastX = event.clientX;
    lastY = event.clientY;
  });

  function endPointer(event) {
    if (activePointer !== null && event.pointerId !== activePointer) return;
    dragging = false;
    activePointer = null;
    pinchDistance = 0;
    canvas.classList.remove('is-grabbing');
  }
  ['pointerup', 'pointercancel'].forEach((type) => canvas.addEventListener(type, endPointer));
  canvas.addEventListener('lostpointercapture', endPointer);

  /* Zooming with the wheel only takes over once the visitor has engaged the
     model, so the page never feels as though scrolling has stopped working. */
  let engaged = false;
  const engage = () => {
    engaged = true;
  };
  canvas.addEventListener('pointerdown', engage);
  canvas.addEventListener('focus', engage);
  canvas.addEventListener(
    'wheel',
    (event) => {
      if (!engaged) return;
      event.preventDefault();
      zoomBy(1 + clamp(event.deltaY, -120, 120) * 0.0011);
    },
    { passive: false }
  );

  canvas.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 2) return;
      dragging = false;
      const [a, b] = event.touches;
      pinchDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    },
    { passive: true }
  );
  canvas.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length !== 2 || !pinchDistance) return;
      const [a, b] = event.touches;
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (distance > 0) {
        zoomBy(pinchDistance / distance);
        pinchDistance = distance;
      }
    },
    { passive: true }
  );

  canvas.addEventListener('keydown', (event) => {
    const step = 0.1;
    switch (event.key) {
      case 'ArrowLeft':
        rotateBy(step / 0.0042 * 0.9, 0);
        break;
      case 'ArrowRight':
        rotateBy(-step / 0.0042 * 0.9, 0);
        break;
      case 'ArrowUp':
        rotateBy(0, -step / 0.0033 * 0.8);
        break;
      case 'ArrowDown':
        rotateBy(0, step / 0.0033 * 0.8);
        break;
      case '+':
      case '=':
        zoomBy(0.9);
        break;
      case '-':
      case '_':
        zoomBy(1.11);
        break;
      case 'r':
      case 'R':
        resetView();
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  /* an extremely restrained parallax with the pointer */
  if (!reducedMotion && !isMobile()) {
    canvas.addEventListener(
      'pointermove',
      (event) => {
        if (dragging) return;
        const rect = canvas.getBoundingClientRect();
        pointerGoal.x = ((event.clientX - rect.left) / rect.width - 0.5) * 0.06;
        pointerGoal.y = ((event.clientY - rect.top) / rect.height - 0.5) * 0.045;
      },
      { passive: true }
    );
    canvas.addEventListener('pointerleave', () => {
      pointerGoal.x = 0;
      pointerGoal.y = 0;
    });
  }

  /* ------------------------------------------------------------- markers - */
  const markers = spaces
    .map((space) => {
      const anchor = MARKER_ANCHORS[space.id];
      if (!anchor) return null;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hotspot';
      button.dataset.marker = space.id;
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', `${space.name} — show details`);
      const number = document.createElement('span');
      number.setAttribute('aria-hidden', 'true');
      number.textContent = space.num;
      const label = document.createElement('span');
      label.className = 'hotspot__label';
      label.textContent = space.name;
      label.setAttribute('aria-hidden', 'true');
      button.append(number, label);
      button.addEventListener('click', () => onSelect(space.id));
      hotspotsContainer.appendChild(button);
      return { id: space.id, button, position: new THREE.Vector3(anchor[0], anchor[1], anchor[2]) };
    })
    .filter(Boolean);

  hotspotsContainer.style.visibility = 'hidden';

  const projected = new THREE.Vector3();
  let lastMarkerKey = '';
  const scratch = markers.map(() => ({ x: 0, y: 0, onScreen: true, behind: false }));

  function updateMarkers() {
    if (!markers.length) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const centreDepth = camera.position.distanceTo(target);
    const keys = [];

    markers.forEach((marker, index) => {
      projected.copy(marker.position).project(camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      const onScreen = projected.z < 1 && x > -30 && x < width + 30 && y > -30 && y < height + 30;
      const depth = camera.position.distanceTo(marker.position);
      const behind = onScreen && depth > centreDepth + 7;
      scratch[index].x = x;
      scratch[index].y = y;
      scratch[index].onScreen = onScreen;
      scratch[index].behind = behind;
      keys.push(`${x.toFixed(1)},${y.toFixed(1)},${onScreen ? 1 : 0},${behind ? 1 : 0}`);
    });

    const key = keys.join('|');
    if (key === lastMarkerKey) return;
    lastMarkerKey = key;
    hotspotsContainer.style.visibility = 'visible';

    markers.forEach((marker, index) => {
      const state = scratch[index];
      marker.button.style.transform = `translate3d(${state.x.toFixed(1)}px, ${state.y.toFixed(1)}px, 0)`;
      marker.button.style.opacity = state.onScreen ? '' : '0';
      marker.button.style.pointerEvents = state.onScreen ? '' : 'none';
      marker.button.setAttribute('aria-hidden', state.onScreen ? 'false' : 'true');
      if (state.onScreen) marker.button.removeAttribute('tabindex');
      else marker.button.setAttribute('tabindex', '-1');
      marker.button.classList.toggle('is-behind', state.behind);
    });
  }

  /* -------------------------------------------------------------- levels - */
  let level = 'ground';

  function applyLevelVisibility() {
    groups.upper.visible = level !== 'ground';
    groups.roof.visible = level === 'roof';
  }

  function setLevel(next) {
    if (!VIEW[next]) return;
    level = next;
    const view = VIEW[next];
    desiredTarget.copy(view.target);
    desired.radius = view.radius;
    desired.polar = view.polar;
    desired.azimuth = view.azimuth;
    azimuthBias = 0;
    applyLevelVisibility();
  }

  /* ------------------------------------------------------------- actions - */
  function resetView() {
    const view = VIEW[level];
    desired.azimuth = view.azimuth;
    desired.polar = view.polar;
    desired.radius = view.radius;
    desiredTarget.copy(view.target);
    pointerGoal.x = 0;
    pointerGoal.y = 0;
    azimuthBias = 0;
  }

  function focus(id) {
    const marker = markers.find((m) => m.id === id);
    if (!marker) return;
    const dx = marker.position.x - target.x;
    const dz = marker.position.z - target.z;
    desired.azimuth = Math.atan2(dx, dz);
    desired.polar = clamp(desired.polar, 0.92, 1.26);
    desired.radius = clamp(desired.radius * 0.84, 19, 55);
    marker.button.setAttribute('aria-expanded', 'true');
    markers.forEach((other) => {
      if (other !== marker) other.button.setAttribute('aria-expanded', 'false');
    });
  }

  function clearSelection() {
    markers.forEach((marker) => marker.button.setAttribute('aria-expanded', 'false'));
  }

  /* keyboard and pointer users share one set of controls, so keep the canvas
     focusable and describe it accurately for assistive technology */
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute(
    'aria-label',
    'Interactive three dimensional model of Aurelia House. Arrow keys rotate the view, plus and minus zoom, R resets.'
  );

  /* ------------------------------------------------------------ resizing - */
  const frame = canvas.parentElement;
  function resize() {
    const width = frame.clientWidth;
    const height = frame.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.6 : 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(frame);

  /* ------------------------------------------------------------ the loop - */
  let onScreen = true;
  const frameObserver = new IntersectionObserver(
    (entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
    },
    { threshold: 0.02 }
  );
  frameObserver.observe(frame);

  const clock = new THREE.Clock();
  let firstFrame = true;

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!onScreen) return;

    if (autoRotate && !dragging) azimuthBias += dt * 0.05;

    const k = 1 - Math.exp(-dt * 6.5);
    current.azimuth += (desired.azimuth + azimuthBias - current.azimuth) * k;
    current.polar += (desired.polar - current.polar) * k;
    current.radius += (desired.radius - current.radius) * k;
    pointerOffset.x += (pointerGoal.x - pointerOffset.x) * k * 0.55;
    pointerOffset.y += (pointerGoal.y - pointerOffset.y) * k * 0.55;
    target.lerp(desiredTarget, 1 - Math.exp(-dt * 4));

    /* a slow breath, so the model never feels frozen */
    const breath = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.21) * 0.012;
    placeCamera(
      clamp(current.polar + breath + pointerOffset.y, 0.44, 1.48),
      current.azimuth + pointerOffset.x,
      current.radius
    );

    updateMarkers();
    renderer.render(scene, camera);

    if (firstFrame) {
      firstFrame = false;
      onReady();
    }
  }

  onStatus('Establishing the view…');
  applyLevelVisibility();
  renderer.setAnimationLoop(tick);
  requestAnimationFrame(resize);

  /* a lost context should leave the page usable, not broken */
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    onStatus('The three-dimensional view was interrupted. The gallery below shows the residence in full.');
  });

  return {
    get autoRotate() {
      return autoRotate;
    },
    setAutoRotate(value) {
      autoRotate = Boolean(value);
    },
    zoom(direction) {
      zoomBy(direction > 0 ? 1.12 : 0.89);
    },
    resetView,
    setLevel,
    focusHotspot: focus,
    clearSelection,
    setSelected(id) {
      if (id) focus(id);
      else clearSelection();
    },
    pause() {
      renderer.setAnimationLoop(null);
    },
    resume() {
      clock.getDelta();
      renderer.setAnimationLoop(tick);
    },
    dispose() {
      resizeObserver.disconnect();
      frameObserver.disconnect();
      renderer.setAnimationLoop(null);
      scene.traverse((child) => {
        if (child.isMesh && child.geometry) child.geometry.dispose();
      });
      renderer.dispose();
    }
  };
}

/* exported for tests and for anyone extending the model */
export { buildSite, buildHouse, createMaterials };

export default { initExperience, MARKER_ANCHORS };
