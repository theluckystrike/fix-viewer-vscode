'use strict';
// Generates icon.png (128x128) and images/screenshot.png (1400x900) for FIX Protocol Viewer.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const crcT = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => {
  const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t), d]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([l, td, c]);
};
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function writePng(filePath, W, H, px) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(filePath, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

function makeCanvas(W, H) {
  const px = Buffer.alloc(W * H * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    const k = a / 255;
    px[i] = Math.round(px[i] * (1 - k) + r * k);
    px[i + 1] = Math.round(px[i + 1] * (1 - k) + g * k);
    px[i + 2] = Math.round(px[i + 2] * (1 - k) + b * k);
    px[i + 3] = Math.max(px[i + 3], a);
  };
  const rect = (x0, y0, w, h, col, r = 3, a = 255) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const dx = Math.max(x0 + r - x, 0, x - (x0 + w - 1 - r));
      const dy = Math.max(y0 + r - y, 0, y - (y0 + h - 1 - r));
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r) set(x, y, col, d > r - 1 ? Math.round(a * (r - d)) : a);
    }
  };
  return { px, set, rect };
}

// 1. Icon (128x128): Dark navy badge with FIX tag=value order book bars (buy green, sell red, header cyan)
{
  const W = 128, H = 128, R = 22;
  const { px, set, rect } = makeCanvas(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = Math.max(R - x, 0, x - (W - 1 - R)), dy = Math.max(R - y, 0, y - (H - 1 - R));
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= R) set(x, y, mix(hex('#172133'), hex('#0B111E'), y / H), d > R - 1 ? Math.round(255 * (R - d)) : 255);
  }
  rect(16, 16, 96, 14, hex('#38BDF8'), 4);
  rect(16, 36, 26, 12, hex('#64748B'), 3); rect(46, 36, 66, 12, hex('#22C55E'), 3);
  rect(16, 54, 26, 12, hex('#64748B'), 3); rect(46, 54, 52, 12, hex('#22C55E'), 3);
  rect(16, 72, 26, 12, hex('#64748B'), 3); rect(46, 72, 60, 12, hex('#EF4444'), 3);
  rect(16, 90, 26, 12, hex('#64748B'), 3); rect(46, 90, 42, 12, hex('#F59E0B'), 3);
  rect(16, 108, 96, 6, hex('#334155'), 2);
  writePng(path.join(__dirname, '..', 'icon.png'), W, H, px);
}

// 2. Screenshot preview (1400x900)
{
  const W = 1400, H = 900;
  const { px, rect } = makeCanvas(W, H);
  rect(0, 0, W, H, hex('#1E1E1E'), 0);
  rect(0, 0, W, 44, hex('#252526'), 0);
  rect(16, 12, 240, 20, hex('#38BDF8'), 4);
  rect(270, 14, 180, 16, hex('#475569'), 3);
  // Summary chips
  for (let i = 0; i < 6; i++) rect(16 + i * 145, 58, 132, 24, i === 5 ? hex('#15803D') : hex('#334155'), 10);
  // Toolbar
  rect(16, 94, 340, 28, hex('#2D2D30'), 3);
  rect(368, 94, 160, 28, hex('#2D2D30'), 3);
  rect(540, 94, 80, 28, hex('#0E639C'), 3);
  rect(640, 94, 160, 28, hex('#3B82F6'), 3);
  rect(812, 94, 160, 28, hex('#3B82F6'), 3);
  // Left table pane
  rect(16, 140, 900, 720, hex('#1B1F2A'), 4);
  rect(16, 140, 900, 34, hex('#252C3D'), 2);
  for (let r = 0; r < 16; r++) {
    const y = 184 + r * 40;
    rect(24, y, 884, 32, r === 1 ? hex('#264F78') : (r % 2 === 0 ? hex('#1E2433') : hex('#1B1F2A')), 2);
    rect(34, y + 10, 40, 12, hex('#94A3B8'), 2);
    rect(90, y + 10, 130, 12, hex('#CBD5E1'), 2);
    rect(240, y + 10, 140, 12, r % 4 === 3 ? hex('#EF4444') : hex('#38BDF8'), 2);
    rect(400, y + 10, 130, 12, hex('#94A3B8'), 2);
    rect(550, y + 10, 70, 12, hex('#F8FAFC'), 2);
    rect(640, y + 10, 50, 12, r % 2 === 0 ? hex('#22C55E') : hex('#F87171'), 2);
    rect(710, y + 10, 80, 12, hex('#E2E8F0'), 2);
    rect(810, y + 10, 80, 12, hex('#34D399'), 2);
  }
  // Right tag inspector pane
  rect(932, 140, 452, 720, hex('#1B1F2A'), 4);
  rect(932, 140, 452, 34, hex('#252C3D'), 2);
  for (let r = 0; r < 15; r++) {
    const y = 188 + r * 42;
    rect(948, y, 42, 14, hex('#38BDF8'), 2);
    rect(1002, y, 130, 14, hex('#E2E8F0'), 2);
    rect(1144, y, 110, 14, hex('#FBBF24'), 2);
    rect(1266, y, 102, 14, hex('#94A3B8'), 2);
  }
  fs.mkdirSync(path.join(__dirname, '..', 'images'), { recursive: true });
  writePng(path.join(__dirname, '..', 'images', 'screenshot.png'), W, H, px);
}
console.log('Generated icon.png and images/screenshot.png');
