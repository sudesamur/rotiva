"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const FRONTEND_PORT = 5173;
const FRONTEND_ROOT = path.resolve(__dirname);
const MIME_TYPES = Object.freeze({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" });

function configuredPort(value = process.env.FRONTEND_PORT) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : FRONTEND_PORT;
}

function runtimeConfig() {
  const apiBaseUrl = process.env.VITE_API_BASE_URL || process.env.PLANNER_API_BASE_URL || "http://127.0.0.1:3000";
  return `window.PLANNER_API_BASE_URL = ${JSON.stringify(apiBaseUrl)};`;
}

function createFrontendServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === "/runtime-config.js") {
      response.writeHead(200, { "content-type": MIME_TYPES[".js"] });
      response.end(runtimeConfig());
      return;
    }
    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const target = path.resolve(FRONTEND_ROOT, `.${requestedPath}`);
    if (!target.startsWith(FRONTEND_ROOT) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "content-type": MIME_TYPES[path.extname(target)] || "application/octet-stream" });
    fs.createReadStream(target).pipe(response);
  });
}

if (require.main === module) {
  const server = createFrontendServer();
  server.listen(configuredPort(), () => process.stdout.write(`Planner frontend listening on port ${configuredPort()}\n`));
}

module.exports = { FRONTEND_PORT, createFrontendServer, runtimeConfig };
