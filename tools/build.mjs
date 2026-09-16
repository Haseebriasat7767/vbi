/**
 * Build step for the Aurelia House page.
 *
 *   node tools/build.mjs
 *
 * Regenerates the inline floor plans in index.html between the build markers.
 * Run it after editing tools/build-floorplans.mjs or the room schedule.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const indexPath = resolve(root, 'index.html');

const START = '<!-- build:plans:start -->';
const END = '<!-- build:plans:end -->';

const plans = execFileSync(process.execPath, [resolve(here, 'build-floorplans.mjs')], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit']
}).trimEnd();

const html = readFileSync(indexPath, 'utf8');
const start = html.indexOf(START);
const end = html.indexOf(END);

if (start === -1 || end === -1) {
  console.error('Build markers not found in index.html. Expected:', START, 'and', END);
  process.exit(1);
}

const indented = plans
  .split('\n')
  .map((line) => (line.trim() ? `        ${line}` : line))
  .join('\n');

const next = `${html.slice(0, start + START.length)}\n${indented}\n        ${html.slice(end)}`;
writeFileSync(indexPath, next);
console.log(`Floor plans regenerated (${plans.length} characters) into index.html`);
