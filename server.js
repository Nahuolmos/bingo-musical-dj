/* server.js — Servidor estático + proxy CORS para Music Bingo DJ.
 *
 * Sirve los archivos del proyecto y expone /proxy?url=<encoded> para
 * reenviar peticiones a APIs externas (Deezer, iTunes, etc.) con
 * cabeceras CORS, solucionando el bloqueo de origen 'null' al abrir
 * index.html en file://.
 *
 * Uso:
 *   node server.js                 # puerto 8000
 *   PORT=3000 node server.js       # puerto personalizado
 *
 * Luego abrir: http://localhost:8000/index.html
 * (en lugar de doble-click sobre index.html)
 */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var urlModule = require('url');
var https = require('https');

var PORT = process.env.PORT || 8000;
var ROOT = __dirname;

// Tipos MIME básicos
var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.tsv': 'text/tab-separated-values; charset=utf-8',
  '.ico': 'image/x-icon'
};

function mimeFor(fileName) {
  var ext = path.extname(fileName).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function serveFile(res, filePath) {
  fs.readFile(filePath, function (err, content) {
    if (err) {
      if (err.code === 'ENOENT') {
        // Intentar servir index.html para rutas sin archivo (SPA fallback)
        if (filePath !== path.join(ROOT, 'index.html')) {
          fs.readFile(path.join(ROOT, 'index.html'), function (e2, idx) {
            if (e2) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('404 No encontrado');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(idx, 'utf-8');
            }
          });
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 No encontrado');
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Error interno');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeFor(filePath) });
    res.end(content, 'utf-8');
  });
}

function proxyRequest(res, parsedUrl) {
  var target = parsedUrl.query.url;
  if (!target) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Falta parámetro ?url=');
    return;
  }

  // Solo permitir http(s):// para evitar peticiones locales arbitrarias
  if (!/^https?:\/\//i.test(target)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Solo URLs http(s) permitidas');
    return;
  }

  var lib = target.indexOf('https://') === 0 ? https : http;
  var targetUrl = urlModule.parse(target);

  var options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (lib === https ? 443 : 80),
    path: targetUrl.path || '/',
    method: 'GET',
    headers: {
      'User-Agent': 'music-bingo-dj-proxy/1.0'
    }
  };

  var req = lib.request(options, function (proxyRes) {
    var chunks = [];
    proxyRes.on('data', function (chunk) { chunks.push(chunk); });
    proxyRes.on('end', function () {
      var body = Buffer.concat(chunks);
      var headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': proxyRes.headers['content-type'] || 'application/json'
      };
      res.writeHead(proxyRes.statusCode || 200, headers);
      res.end(body);
    });
  });

  req.on('error', function (e) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Error proxy: ' + e.message);
  });

  req.end();
}

function handleOPTIONS(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end();
}

var server = http.createServer(function (req, res) {
  var parsed = urlModule.parse(req.url, true);
  var pathname = parsed.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    handleOPTIONS(res);
    return;
  }

  // Ruta de proxy para APIs externas
  if (pathname === '/proxy') {
    proxyRequest(res, parsed);
    return;
  }

  // Archivos estáticos
  var filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  // Evitar salir del directorio raíz (path traversal)
  var normalized = path.normalize(filePath);
  if (normalized.indexOf(path.normalize(ROOT)) !== 0) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Prohibido');
    return;
  }
  serveFile(res, filePath);
});

server.listen(PORT, function () {
  console.log('Music Bingo DJ servidor en http://localhost:' + PORT + '/');
  console.log('Abrí: http://localhost:' + PORT + '/index.html');
  console.log('Proxy CORS disponible en: http://localhost:' + PORT + '/proxy?url=<url-encoded>');
  console.log('Presioná Ctrl+C para detener.');
});
