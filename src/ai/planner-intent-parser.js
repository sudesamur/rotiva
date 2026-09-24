"use strict";

const { emptyIntent } = require("./planner-intent-schema");
const { REGION_DATASETS } = require("../planner/region-datasets");

function fold(value) {
  return String(value || "").toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/g, "c").replace(/[ğĞ]/g, "g").replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o").replace(/[şŞ]/g, "s").replace(/[üÜ]/g, "u");
}

function resolveRegion(text, datasets = REGION_DATASETS) {
  const normalized = fold(text);
  const matches = Object.keys(datasets).filter((region) => {
    const parts = region.split("-").map(fold);
    return parts.some((part) => part.length >= 4 && normalized.includes(part));
  });
  return matches.length === 1 ? matches[0] : null;
}

function parseDuration(text) {
  const normalized = fold(text);
  const halfHour = normalized.match(/(\d+)\s*(?:bucuk)\s*saat/);
  if (halfHour) return Number(halfHour[1]) * 60 + 30;
  const minute = normalized.match(/(\d+)\s*dakika/);
  if (minute) return Number(minute[1]);
  const hour = normalized.match(/(\d+)\s*saat(?:im|im var|im olacak|)?/);
  return hour ? Number(hour[1]) * 60 : null;
}

function parseBudget(text) {
  const match = fold(text).match(/(\d[\d.]*)\s*(?:tl|lira)/);
  return match ? Number(match[1].replace(/\./g, "")) : null;
}

const INTEREST_PHRASES = Object.freeze([
  ["history", ["tarih", "tarihi"]], ["museum", ["muze"]], ["culture", ["kultur", "sanat"]],
  ["coffee", ["kahve", "kafe"]], ["food", ["yemek", "restoran"]], ["nature", ["park", "doga"]], ["shopping", ["alisveris", "carsi"]],
]);

function parseInterests(text) {
  const normalized = fold(text);
  return INTEREST_PHRASES.filter(([, phrases]) => phrases.some((phrase) => normalized.includes(phrase))).map(([interest]) => interest);
}

function parseWalkingPreference(text) {
  const normalized = fold(text);
  if (normalized.includes("cok yurumek istemiyorum") || normalized.includes("az yurumek istiyorum")) return "low";
  if (normalized.includes("yurumeyi seviyorum")) return "high";
  return null;
}

function parseStartTime(text) {
  const normalized = fold(text);
  const precise = normalized.match(/\b(\d{1,2})(?::(\d{2}))?['’]?(?:da|de)\s+baslayacagim/);
  if (!precise) return null;
  const hour = Number(precise[1]);
  const minute = Number(precise[2] || 0);
  return hour <= 23 && minute <= 59 ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` : null;
}

function parseRequestedActivities(text) {
  const match = text.match(/([\p{L}]+)['’]?(?:da|de)\s+([\p{L}]+)['’]?(?:i|ı|u|ü)?\s+(?:görmek|gezmek)\s+istiyorum/iu);
  return match ? [{ placeQuery: match[1], activityQuery: match[2] }] : [];
}

function parsePlannerIntent(text, datasets = REGION_DATASETS) {
  const intent = emptyIntent();
  intent.region = resolveRegion(text, datasets);
  intent.availableMinutes = parseDuration(text);
  intent.budgetTRY = parseBudget(text);
  intent.interests = parseInterests(text);
  intent.walkingPreference = parseWalkingPreference(text);
  intent.plannedStartTime = parseStartTime(text);
  intent.requestedActivities = parseRequestedActivities(text);
  if (!intent.region && /\b(?:besiktas|beyoğlu|beyoglu)\b/i.test(fold(text))) intent.ambiguities.push("unsupported_region");
  if (/sabah\s+baslayacagim/i.test(fold(text)) && !intent.plannedStartTime) intent.ambiguities.push("ambiguous_start_time");
  return intent;
}

module.exports = { fold, parsePlannerIntent, resolveRegion };
