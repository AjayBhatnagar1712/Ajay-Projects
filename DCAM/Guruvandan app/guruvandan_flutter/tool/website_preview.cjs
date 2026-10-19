const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const workspace = path.resolve(__dirname, '..');
const roots = process.env.WEBSITE_PUBLIC ? [path.resolve(process.env.WEBSITE_PUBLIC)] : [path.join(workspace, 'web'), path.join(workspace, 'build', 'web')];
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relativePath = pathname.replace(/^\/+/, '') || 'index.html';
    let filename;
    for (const root of roots) {
      const candidate = path.resolve(root, relativePath);
      if (!candidate.startsWith(root + path.sep) && candidate !== root) continue;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) { filename = candidate; break; }
      const indexFile = path.join(candidate, 'index.html');
      if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) { filename = indexFile; break; }
    }
    if (!filename && !path.extname(relativePath)) filename = path.join(roots[0], 'index.html');
    if (!filename) { response.writeHead(404); response.end('Not found'); return; }
    const extension = path.extname(filename);
    const size = fs.statSync(filename).size;
    const headers = {'Content-Type': extension === '.mp4' ? 'video/mp4' : extension === '.mjs' ? 'text/javascript' : types[extension] || 'application/octet-stream', 'Cache-Control':extension === '.mp4' ? 'public, max-age=3600' : 'no-store', 'Accept-Ranges':'bytes'};
    const range = request.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match && match[1] ? Number(match[1]) : match && match[2] ? Math.max(0, size - Number(match[2])) : NaN;
      const end = match && match[1] && match[2] ? Math.min(Number(match[2]),size - 1) : size - 1;
      if (!Number.isFinite(start) || start > end || start >= size) { response.writeHead(416,{'Content-Range':`bytes */${size}`}); response.end(); return; }
      response.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${size}`});
      if (request.method === 'HEAD') { response.end(); return; }
      fs.createReadStream(filename,{start,end}).pipe(response);
    } else {
      response.writeHead(200,{...headers,'Content-Length':size});
      if (request.method === 'HEAD') { response.end(); return; }
      fs.createReadStream(filename).pipe(response);
    }
  } catch {
    response.writeHead(400);
    response.end('Bad request');
  }
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Website preview: http://127.0.0.1:${process.env.PORT || 4173}`));
