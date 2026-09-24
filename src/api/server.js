"use strict";

const http = require("node:http");
const { createApp } = require("./app");

const DEFAULT_PORT = 3000;

function configuredPort(value = process.env.PORT) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : DEFAULT_PORT;
}

function startServer(port = configuredPort()) {
  const server = http.createServer(createApp());
  server.listen(port, () => process.stdout.write(`Planner API listening on port ${port}\n`));
  return server;
}

if (require.main === module) startServer();

module.exports = { DEFAULT_PORT, configuredPort, startServer };
