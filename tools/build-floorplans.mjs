/**
 * Aurelia Residences — floor plan generator.
 *
 * Produces the three inline SVG plans used in "A plan made for living".
 * All three levels are drawn on one plan grid so the drawings stay consistent
 * with the 3D massing in assets/js/experience.js:
 *
 *   metres = (planX - 565) * 0.045        (plan x = west -> east)
 *   metres = (planY - 340) * 0.045        (plan y = north -> south, +z in 3D)
 *
 * Usage:  node tools/build-floorplans.mjs > /tmp/plans.html
 */

const S = 0.045; // metres per plan unit
const toM2 = (w, h) => Math.round(w * h * S * S);

const PLOT = { x: 15, y: 15, w: 970, h: 740 };
const VIEW = { w: 1000, h: 780 };
const FRAME = { nw: [60, 60], se: [940, 720] };

const LEVELS = [
  {
    id: 'ground',
    name: 'Ground level',
    desc:
      'Ground level plan: arrival court, garage, wellness room, kitchen, private garden suite, the double height living pavilion and the infinity pool at the water.',
    rooms: [
      { x: 110, y: 60, w: 220, h: 190, type: 'outdoor', label: 'Arrival court', note: 'Stone court' },
      { x: 330, y: 110, w: 140, h: 120, type: 'room', label: 'Garage', note: 'Two cars' },
      { x: 470, y: 110, w: 90, h: 120, type: 'service', label: 'Utility', note: 'Plant' },
      { x: 560, y: 110, w: 100, h: 120, type: 'core', label: 'Lift + stair' },
      { x: 660, y: 110, w: 70, h: 120, type: 'room', label: 'Wellness', note: 'Spa' },
      { x: 730, y: 110, w: 70, h: 120, type: 'service', label: 'WC' },
      { x: 330, y: 230, w: 120, h: 150, type: 'room', label: 'Entry gallery' },
      { x: 450, y: 230, w: 210, h: 150, type: 'room', label: 'Kitchen + pantry' },
      { x: 660, y: 230, w: 140, h: 150, type: 'room', label: 'Garden suite', note: 'Ensuite' },
      { x: 800, y: 230, w: 160, h: 150, type: 'outdoor', label: 'Private garden' },
      { x: 330, y: 380, w: 290, h: 180, type: 'room', label: 'Living pavilion', note: 'Double height' },
      { x: 620, y: 380, w: 180, h: 180, type: 'room', label: 'Dining room' },
      { x: 330, y: 555, w: 470, h: 150, type: 'outdoor', label: 'Pool deck', note: 'Travertine' },
      { x: 360, y: 585, w: 410, h: 90, type: 'pool', label: 'Infinity pool', note: '18 × 4 m' },
      { x: 110, y: 330, w: 200, h: 300, type: 'green', label: 'Garden', note: 'Olive and grass' },
      { x: 840, y: 390, w: 120, h: 220, type: 'green', label: 'Water garden' }
    ],
    openings: [
      [330, 130, 330, 165],
      [380, 110, 440, 110],
      [330, 430, 330, 470],
      [660, 240, 660, 280],
      [800, 270, 800, 310],
      [380, 555, 480, 555],
      [660, 555, 740, 555],
      [470, 380, 560, 380]
    ]
  },
  {
    id: 'upper',
    name: 'Upper level',
    desc:
      'Upper level plan: master suite with its own terrace over the garden, two garden bedrooms, a family room, a fourth bedroom and the double height void over the living pavilion.',
    rooms: [
      { x: 330, y: 140, w: 130, h: 120, type: 'room', label: 'Bedroom 02', note: 'Ensuite' },
      { x: 330, y: 260, w: 130, h: 120, type: 'room', label: 'Bedroom 03', note: 'Ensuite' },
      { x: 460, y: 140, w: 100, h: 120, type: 'core', label: 'Lift + stair' },
      { x: 460, y: 260, w: 100, h: 120, type: 'room', label: 'Family room' },
      { x: 560, y: 140, w: 80, h: 120, type: 'room', label: 'Bedroom 04', note: 'Ensuite' },
      { x: 560, y: 260, w: 80, h: 120, type: 'service', label: 'Bath + dressing' },
      { x: 640, y: 150, w: 160, h: 130, type: 'room', label: 'Master suite', note: 'Ensuite' },
      { x: 640, y: 290, w: 160, h: 90, type: 'outdoor', label: 'Master terrace' },
      { x: 330, y: 380, w: 290, h: 180, type: 'void', label: 'Void over pavilion' },
      { x: 620, y: 380, w: 180, h: 180, type: 'green', label: 'Planted roof', note: 'Over dining' }
    ],
    openings: [
      [460, 140, 460, 175],
      [560, 170, 560, 210],
      [640, 175, 640, 215],
      [330, 330, 330, 360],
      [660, 290, 660, 320]
    ]
  },
  {
    id: 'roof',
    name: 'Roof terrace',
    desc:
      'Roof terrace plan: pergola shaded dining, outdoor kitchen, sun deck, planted edges and the stair and lift head, above the upper level.',
    rooms: [
      { x: 360, y: 170, w: 410, h: 180, type: 'outdoor', label: 'Roof terrace', note: 'Travertine' },
      { x: 460, y: 140, w: 110, h: 120, type: 'core', label: 'Stair + lift head' },
      { x: 380, y: 250, w: 180, h: 90, type: 'shade', label: 'Pergola' },
      { x: 620, y: 180, w: 140, h: 80, type: 'room', label: 'Outdoor kitchen' },
      { x: 770, y: 180, w: 50, h: 80, type: 'service', label: 'Shower' },
      { x: 620, y: 280, w: 180, h: 80, type: 'outdoor', label: 'Sun deck' },
      { x: 330, y: 120, w: 470, h: 30, type: 'green', label: 'Planted edge' },
      { x: 330, y: 170, w: 30, h: 180, type: 'green', label: 'Planted edge' },
      { x: 330, y: 380, w: 290, h: 180, type: 'green', label: 'Planted roof', note: 'Over pavilion' }
    ],
    openings: []
  }
];

/* ---------------------------------------------------------------- markup --- */

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Gross internal area of a level, from its enclosed rooms only. */
function interiorArea(level) {
  return level.rooms
    .filter((room) => ['room', 'core', 'service'].includes(room.type))
    .reduce((total, room) => total + room.w * room.h * S * S, 0);
}

/** External terrace area, used for the roof level. */
function terraceArea(level) {
  return level.rooms
    .filter((room) => ['outdoor', 'shade'].includes(room.type))
    .reduce((total, room) => total + room.w * room.h * S * S, 0);
}

/** Caption under each drawing: internal for the floors, terrace for the roof. */
function captionFor(level) {
  const interior = Math.round(interiorArea(level));
  if (level.id === 'roof') {
    return `${level.name} · approximately ${Math.round(terraceArea(level))} m² of terrace · drawn at 1:200`;
  }
  return `${level.name} · approximately ${interior} m² internal · drawn at 1:200`;
}

function labelBlock(room) {
  const cx = room.x + room.w / 2;
  const cy = room.y + room.h / 2;
  const small = room.h < 100 || room.w < 100;
  const note = room.note && !small;
  const out = [
    `<text class="p-label" x="${cx}" y="${cy - (note ? 4 : 0)}" text-anchor="middle">${esc(room.label.toUpperCase())}</text>`
  ];
  if (note) out.push(`<text class="p-note" x="${cx}" y="${cy + 15}" text-anchor="middle">${esc(room.note)}</text>`);
  return out.join('');
}

function roomMarkup(room) {
  const id = slug(room.label);
  const area = toM2(room.w, room.h);
  return [
    `<g class="p-room p-room--${room.type}" data-room="${id}">`,
    `<rect class="p-room__rect" x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}"/>`,
    labelBlock(room),
    `<title>${esc(`${room.label}, ${area} square metres`)}</title>`,
    `</g>`
  ].join('');
}

function openingMarkup([x1, y1, x2, y2]) {
  return `<rect class="p-opening" x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.max(
    Math.abs(x2 - x1),
    4
  )}" height="${Math.max(Math.abs(y2 - y1), 4)}"/>`;
}

function planSvg(level, index) {
  const n = String(index + 1).padStart(2, '0');
  const rooms = level.rooms.map(roomMarkup).join('');
  const openings = (level.openings || []).map(openingMarkup).join('');
  const legend = level.rooms
    .map((room) => {
      const id = slug(room.label);
      const area = toM2(room.w, room.h);
      return `<li class="plan-legend__row"><button type="button" class="plan-legend__btn" aria-pressed="false" data-target="${id}"><span class="plan-legend__name">${esc(
        room.label
      )}</span><span class="plan-legend__area">${area} m²</span></button></li>`;
    })
    .join('');

  return `
      <div class="plan-panel" id="panel-${level.id}" role="tabpanel" aria-labelledby="tab-${level.id}" tabindex="0" data-level="${level.id}"${
        index === 0 ? '' : ' hidden'
      }>
        <figure class="plan-figure">
          <svg class="plan" viewBox="0 0 ${VIEW.w} ${VIEW.h}" role="img" aria-labelledby="plan-${level.id}-title plan-${level.id}-desc" preserveAspectRatio="xMidYMid meet">
            <title id="plan-${level.id}-title">${esc(level.name)} plan — Aurelia House</title>
            <desc id="plan-${level.id}-desc">${esc(level.desc)}</desc>
            <g class="p-plot"><rect x="${PLOT.x}" y="${PLOT.y}" width="${PLOT.w}" height="${PLOT.h}" rx="2"/></g>
            <g class="p-rooms">${rooms}</g>
            <g class="p-openings">${openings}</g>
            <g class="p-frame" aria-hidden="true">
              <path d="M60 60 h120 M60 60 v120" class="p-corner"/>
              <path d="M940 60 h-120 M940 60 v120" class="p-corner"/>
              <path d="M60 ${FRAME.se[1]} h120 M60 ${FRAME.se[1]} v-120" class="p-corner"/>
              <path d="M940 ${FRAME.se[1]} h-120 M940 ${FRAME.se[1]} v-120" class="p-corner"/>
              <g transform="translate(60 100)">
                <path class="p-north" d="M0 -18 L7 10 L0 4 L-7 10 Z"/>
                <text class="p-north-text" x="0" y="30" text-anchor="middle">N</text>
              </g>
              <text class="p-level" x="940" y="76" text-anchor="end">${esc(level.name.toUpperCase())} — ${n} / 03</text>
              <text class="p-scale" x="940" y="${FRAME.se[1]}" text-anchor="end">0 — 5 — 10 m</text>
            </g>
          </svg>
          <figcaption class="plan-figure__cap">${esc(captionFor(level))}</figcaption>
        </figure>
        <div class="plan-legend">
          <p class="plan-legend__title">Spaces on this level</p>
          <ul class="plan-legend__list">${legend}</ul>
        </div>
      </div>`;
}

const tabs = LEVELS.map((level, i) => {
  const area = Math.round(interiorArea(level));
  return `<button type="button" role="tab" id="tab-${level.id}" class="plan-tabs__btn" aria-controls="panel-${level.id}" aria-selected="${
    i === 0
  }" tabindex="${i === 0 ? 0 : -1}"><span class="plan-tabs__idx">0${i + 1}</span><span class="plan-tabs__name">${
    level.name
  }</span><span class="plan-tabs__area">${level.id === 'roof' ? 'Terrace' : `${area} m²`}</span></button>`;
}).join('');

const panels = LEVELS.map(planSvg).join('\n');
const totals = LEVELS.map((level) => `${level.name}: ${Math.round(interiorArea(level))} m² internal`);

process.stdout.write(
  `<div class="plan-tabs" role="tablist" aria-label="Floor plans">${tabs}</div>\n      ${panels}\n`
);
process.stderr.write(`\n${totals.join('\n')}\n`);
