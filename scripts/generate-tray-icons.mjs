#!/usr/bin/env node
/**
 * Writes the macOS menu bar (template) icons into electron/assets/.
 *
 * A template image must be black with an alpha channel: macOS recolours it for
 * light, dark and highlighted menu bars. So this draws the brand lens (a ring
 * with one highlight dot, the geometry in public/logo-icon.svg) in pure black,
 * antialiased by supersampling, and encodes the PNG with node:zlib. No
 * dependencies, no image tools. A neutral shape: nothing here depicts the habit.
 *
 *   node scripts/generate-tray-icons.mjs
 *
 * Output is committed; rerun only if the logo geometry changes.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'electron', 'assets');

// Logo geometry, in the 96-unit box of public/logo-icon.svg.
const RING_OUTER = 30;
const RING_INNER = 16;
const DOT = { dx: 6, dy: -6, r: 5 };
const SPAN = RING_OUTER * 2; // the lens is 60 units wide
const SUPERSAMPLE = 8;

/** Coverage (0..1) of the lens at a point given in logo units from the centre. */
function covered(x, y) {
  const d = Math.hypot(x, y);
  if (d <= RING_OUTER && d >= RING_INNER) return true;
  return Math.hypot(x - DOT.dx, y - DOT.dy) <= DOT.r;
}

function render(size) {
  // The lens fills the canvas with half a pixel of margin at 1x.
  const unitsPerPixel = SPAN / (size - 1);
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const fx = px + (sx + 0.5) / SUPERSAMPLE - size / 2;
          const fy = py + (sy + 0.5) / SUPERSAMPLE - size / 2;
          if (covered(fx * unitsPerPixel, fy * unitsPerPixel)) hits++;
        }
      }
      const i = (py * size + px) * 4;
      rgba[i] = 0;
      rgba[i + 1] = 0;
      rgba[i + 2] = 0;
      rgba[i + 3] = Math.round((hits / (SUPERSAMPLE * SUPERSAMPLE)) * 255);
    }
  }
  return rgba;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(outDir, { recursive: true });
for (const [name, size] of [['trayTemplate.png', 16], ['trayTemplate@2x.png', 32]]) {
  writeFileSync(path.join(outDir, name), encodePng(size, render(size)));
  console.log(`wrote electron/assets/${name} (${size}x${size})`);
}
