"use strict";

const {
  getActivityPlaces,
  getAvailableActivities,
  planTrip,
} = require("../planner/planner-service");
const { interpretPlannerText } = require("../ai/planner-intent-service");
const { REGION_DATASETS } = require("../planner/region-datasets");
const { apiError, statusForError } = require("./api-error-mapper");

const MAX_JSON_BODY_BYTES = 256 * 1024;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

function regionName(regionId) {
  return regionId
    .split("-")
    .map((part) => part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1))
    .join(" ");
}

function configuredOrigins(value = process.env.PLANNER_ALLOWED_ORIGINS || "") {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": JSON_CONTENT_TYPE });
  response.end(JSON.stringify(body));
}

function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    const contentLength = Number(request.headers["content-length"]);
    if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
      reject({ code: "PAYLOAD_TOO_LARGE" });
      return;
    }
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BODY_BYTES) {
        reject({ code: "PAYLOAD_TOO_LARGE" });
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve(body === "" ? {} : JSON.parse(body));
      } catch {
        reject({ code: "INVALID_JSON" });
      }
    });
    request.on("error", () => reject({ code: "INVALID_JSON" }));
  });
}

function applyCors(request, response, allowedOrigins) {
  const origin = request.headers.origin;
  if (!origin || !allowedOrigins.includes(origin)) return;
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("vary", "Origin");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

function createApp(options = {}) {
  const datasets = options.datasets || REGION_DATASETS;
  const allowedOrigins = options.allowedOrigins || configuredOrigins();
  return async function app(request, response) {
    applyCors(request, response, allowedOrigins);
    const url = new URL(request.url, "http://localhost");
    const segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    try {
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, { success: true, status: "ok" });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/regions") {
        const regions = Object.keys(datasets).map((id) => ({
          id,
          name: regionName(id),
        }));
        sendJson(response, 200, { success: true, regions });
        return;
      }
      if (
        request.method === "GET" &&
        segments.length === 4 &&
        segments[0] === "api" &&
        segments[1] === "regions" &&
        segments[3] === "activities"
      ) {
        const result = getActivityPlaces(segments[2], datasets);
        if (!result.success) {
          sendJson(
            response,
            statusForError(result.error.code),
            apiError(result.error),
          );
          return;
        }
        sendJson(response, 200, result);
        return;
      }
      if (
        request.method === "GET" &&
        segments.length === 6 &&
        segments[0] === "api" &&
        segments[1] === "regions" &&
        segments[3] === "places" &&
        segments[5] === "activities"
      ) {
        const result = getAvailableActivities(
          segments[2],
          segments[4],
          datasets,
        );
        if (!result.success) {
          sendJson(
            response,
            statusForError(result.error.code),
            apiError(result.error),
          );
          return;
        }
        sendJson(response, 200, result);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/planner/plan") {
        const result = planTrip(await parseJsonBody(request), datasets);
        if (!result.success) {
          sendJson(
            response,
            statusForError(result.error.code),
            apiError(result.error),
          );
          return;
        }
        sendJson(response, 200, result);
        return;
      }
      if (
        request.method === "POST" &&
        url.pathname === "/api/planner/interpret"
      ) {
        const body = await parseJsonBody(request);
        if (typeof body.text !== "string" || body.text.trim() === "") {
          sendJson(
            response,
            400,
            apiError({
              code: "INVALID_INTENT_REQUEST",
              fields: [{ field: "text", reason: "required" }],
            }),
          );
          return;
        }
        sendJson(
          response,
          200,
          await interpretPlannerText(body.text, {
            datasets,
            startLocation: body.startLocation,
            parserMode: body.parserMode,
            providerType: body.providerType,
            provider: body.provider,
            openai: body.openai,
            gemini: body.gemini,
          }),
        );
        return;
      }
      sendJson(response, 404, apiError({ code: "NOT_FOUND" }));
    } catch (error) {
      const status = statusForError(error?.code);
      sendJson(response, status, apiError(error));
    }
  };
}

module.exports = { MAX_JSON_BODY_BYTES, createApp, configuredOrigins };
