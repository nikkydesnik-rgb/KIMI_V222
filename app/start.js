/**
 * Локальный сервер для Исполнительной Документации
 * Запуск: node start.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.zip': 'application/zip',
};

const server = http.createServer((req, res) => {
  // Security: prevent directory traversal
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);
  filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Try serving index.html for SPA routing
        fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, indexContent) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404: Файл не найден');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(indexContent);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500: Ошибка сервера');
      }
    } else {
      // Enable CORS and caching
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'max-age=31536000',
      });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log('  ИСПОЛНИТЕЛЬНАЯ ДОКУМЕНТАЦИЯ');
  console.log('========================================');
  console.log(`\n  Сервер запущен!`);
  console.log(`\n  Откройте в браузере:`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`\n  Для остановки нажмите Ctrl+C`);
  console.log('========================================\n');

  // Try to open browser automatically
  const { exec } = require('child_process');
  const url = `http://localhost:${PORT}`;

  const platform = process.platform;
  let command;

  if (platform === 'win32') {
    command = `start ${url}`;
  } else if (platform === 'darwin') {
    command = `open ${url}`;
  } else {
    command = `xdg-open ${url}`;
  }

  exec(command, (err) => {
    if (!err) {
      console.log('  Браузер открывается автоматически...\n');
    }
  });
});
