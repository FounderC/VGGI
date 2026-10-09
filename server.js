'use strict';
// Optional local static server; no packages, installation, or build step.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port = Number(process.env.PORT || 8781);
const allowed = new Set(['index.html', 'style.css', 'main.js', 'model.js', 'shader.gpu',
                         'Utils/m4.js', 'Utils/trackball-rotator.js']);
const mime = {'.html': 'text/html; charset=utf-8', '.css': 'text/css',
              '.js': 'text/javascript', '.gpu': 'text/javascript'};
const server = http.createServer(function(req, res) {
    let file;
    try { file = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html'; }
    catch { res.writeHead(400); res.end('Bad request'); return; }
    if (!allowed.has(file)) { res.writeHead(404); res.end('Not found'); return; }
    fs.readFile(path.join(__dirname, file), function(error, data) {
        if (error) { res.writeHead(500); res.end('File unavailable'); return; }
        res.writeHead(200, {'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store'});
        res.end(data);
    });
});
server.on('error', function(error) { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', function() { console.log('PA1: http://127.0.0.1:' + port + '/ (Ctrl+C to stop)'); });
