'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {ValidationError} = require('./domain');
const {createStore} = require('./store');

function createApp({dataFile = path.join(__dirname, '..', 'data', 'paniko.json')} = {}) {
  const store = createStore(dataFile);
  const assets = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
    '/app.js': ['app.js', 'application/javascript; charset=utf-8'],
  };
  async function bodyAsJson(req) {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 1024 * 1024) throw new ValidationError('Solicitud demasiado grande', 413);
    }
    try { return JSON.parse(body); }
    catch { throw new ValidationError('JSON inválido'); }
  }
  const send = (res, status, data) => {
    res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
    res.end(JSON.stringify(data));
  };
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname;
      if (req.method === 'GET' && assets[pathname]) {
        const [file, contentType] = assets[pathname];
        res.writeHead(200, {'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff'});
        res.end(fs.readFileSync(path.join(__dirname, '..', 'public', file)));
        return;
      }
      if (req.method === 'GET' && pathname === '/api/health') return send(res, 200, {status: 'ok'});
      if (req.method === 'GET' && pathname === '/api/ingredients') return send(res, 200, store.listIngredients());
      if (req.method === 'POST' && pathname === '/api/ingredients') return send(res, 201, store.addIngredient(await bodyAsJson(req)));
      if (req.method === 'GET' && pathname === '/api/recipes') return send(res, 200, store.listRecipes());
      if (req.method === 'POST' && pathname === '/api/recipes') return send(res, 201, store.addRecipe(await bodyAsJson(req)));
      const match = pathname.match(/^\/api\/recipes\/([a-f\d-]+)\/scale$/i);
      if (match && req.method === 'POST') {
        const body = await bodyAsJson(req);
        return send(res, 200, store.preview(match[1], body.desiredYield));
      }
      send(res, 404, {error: 'Ruta no encontrada'});
    } catch (error) {
      send(res, error instanceof ValidationError ? error.status : 500,
        {error: error instanceof ValidationError ? error.message : 'Error interno del servidor'});
    }
  });
}
module.exports = {createApp};
