#!/usr/bin/env node
// generate-icons.js — run once to create PWA icons
import {createCanvas} from 'canvas';
import fs from 'fs';
import path from 'path';

const sizes = [72, 96, 128, 144, 192, 512];
const dir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

sizes.forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#6c63ff';
  const radius = size * 0.22;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.fill();

  // Letter F
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.55}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', size / 2, size / 2 + size * 0.04);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(dir, `icon-${size}.png`), buffer);
  console.log(`✓ icon-${size}.png`);
});
