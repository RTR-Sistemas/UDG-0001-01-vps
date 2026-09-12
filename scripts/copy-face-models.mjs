import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const repoRoot = path.resolve(__dirname, '..');
const srcDir = path.join(repoRoot, 'node_modules', '@vladmandic', 'face-api', 'model');
const destDir = path.join(repoRoot, 'public', 'models');

if (!fs.existsSync(srcDir)) {
  console.warn('[copy-face-models] Source models directory not found:', srcDir);
  console.warn('[copy-face-models] Did you run npm install?');
  process.exit(0);
}

ensureDir(destDir);
copyDir(srcDir, destDir);

console.log('[copy-face-models] Copied FaceAPI models to', destDir);
