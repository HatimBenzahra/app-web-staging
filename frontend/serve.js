import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3300;
const DIR = join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

const CACHE = {
  '.html': 'no-cache',
  '.js': 'public, max-age=31536000, immutable',
  '.css': 'public, max-age=31536000, immutable',
  '.svg': 'public, max-age=86400',
  '.png': 'public, max-age=86400',
  '.jpg': 'public, max-age=86400',
  '.jpeg': 'public, max-age=86400',
  '.webp': 'public, max-age=86400',
  '.woff2': 'public, max-age=31536000, immutable',
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const filePath = join(DIR, url.pathname === '/' ? 'index.html' : url.pathname);

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': CACHE[ext] || 'public, max-age=3600',
    });
    res.end(data);
  } catch {
    const index = await readFile(join(DIR, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(index);
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend serving on port ${PORT}`);
});
