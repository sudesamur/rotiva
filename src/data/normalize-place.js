"use strict";

const COORDINATE_STATUSES = new Set(["verified", "approximate", "unknown"]);

const CATEGORY_RULES = Object.freeze([
  { category: "palace", matches: ["palace", "saray"] },
  { category: "museum", matches: ["museum", "müze"] },
  { category: "historical", matches: ["historic", "historical", "tarihi", "history"] },
  { category: "cultural", matches: ["cultural", "culture", "art", "sanat"] },
  { category: "cafe", matches: ["cafe", "coffee", "kahve"] },
  { category: "restaurant", matches: ["restaurant", "meyhane", "yemek"] },
  { category: "park", matches: ["park", "garden", "bahçe"] },
  { category: "mosque", matches: ["mosque", "cami"] },
  { category: "church", matches: ["church", "kilise"] },
  { category: "market", matches: ["market", "çarşı", "pazar"] },
  { category: "viewpoint", matches: ["view", "manzara", "seyir"] },
]);

function normalise(value) {
  return String(value || "").trim().toLocaleLowerCase("tr-TR").replace(/_/g, "-");
}

function hasCoordinates(value) {
  return Boolean(value && Number.isFinite(value.lat) && Number.isFinite(value.lng));
}

function categoryFor(raw) {
  const terms = [raw.type, raw.category, ...(raw.tags || []), ...(raw.activities || []).flatMap((activity) => typeof activity === "string" ? [activity] : [activity.name, ...(activity.tags || [])])]
    .filter(Boolean)
    .flatMap((value) => normalise(value).split("-"));
  const rule = CATEGORY_RULES.find(({ matches }) => matches.some((term) => terms.includes(term)));
  return rule ? rule.category : "unknown";
}

function coordinateMetadata(raw) {
  const rawStatus = COORDINATE_STATUSES.has(raw.geocodeStatus) ? raw.geocodeStatus : "unknown";
  const coordinates = hasCoordinates(raw.coordinates) ? raw.coordinates : null;
  const geocodeStatus = coordinates ? rawStatus : "unknown";
  return {
    coordinates,
    geocodeStatus,
    autoRouteEligible: geocodeStatus === "verified" && raw.autoRouteEligible === true,
  };
}

function normalizeActivity(activity) {
  if (typeof activity === "string") {
    return {
      name: activity,
      durationMinutes: null,
      costTRY: null,
      costMinTRY: null,
      costMaxTRY: null,
      costConfidence: "unknown",
      tags: [],
    };
  }
  const costTRY = Number.isFinite(activity.costTRY) ? activity.costTRY : null;
  const costMinTRY = Number.isFinite(activity.costMinTRY) ? activity.costMinTRY : null;
  const costMaxTRY = Number.isFinite(activity.costMaxTRY) ? activity.costMaxTRY : null;
  const rawConfidence = normalise(activity.costConfidence);
  const costConfidence = rawConfidence === "official" || rawConfidence === "verified"
    ? "verified"
    : rawConfidence === "estimated" || rawConfidence === "editorial-estimate" || rawConfidence === "menu-source-available"
      ? "estimated"
      : "unknown";
  return {
    name: activity.name || null,
    durationMinutes: Number.isFinite(activity.durationMinutes) ? activity.durationMinutes : null,
    costTRY,
    costMinTRY,
    costMaxTRY,
    costConfidence: activity.costConfidence ? costConfidence : (costTRY !== null ? "verified" : (costMinTRY !== null || costMaxTRY !== null ? "estimated" : "unknown")),
    tags: Array.isArray(activity.tags) ? activity.tags : [],
  };
}

function estimatedVenueRange(raw) {
  const ranges = Object.values(raw.estimatedSpendTRY || {}).filter(
    (range) => Array.isArray(range) && range.length === 2 && range.every(Number.isFinite),
  );
  if (ranges.length === 0) return null;
  return { min: Math.min(...ranges.map((range) => range[0])), max: Math.max(...ranges.map((range) => range[1])) };
}

function placeCost(activities, raw) {
  const venueRange = estimatedVenueRange(raw);
  if (venueRange) {
    return { costTRY: null, costMinTRY: venueRange.min, costMaxTRY: venueRange.max, costConfidence: raw.priceConfidence === "official" ? "verified" : "estimated", costRangeTRY: [venueRange.min, venueRange.max] };
  }
  if (activities.length !== 1) return { costTRY: null, costMinTRY: null, costMaxTRY: null, costConfidence: "unknown", costRangeTRY: null };
  const activity = activities[0];
  if (activity.costTRY !== null) return { costTRY: activity.costTRY, costMinTRY: activity.costTRY, costMaxTRY: activity.costTRY, costConfidence: activity.costConfidence, costRangeTRY: null };
  if (activity.costMinTRY !== null || activity.costMaxTRY !== null) {
    return { costTRY: null, costMinTRY: activity.costMinTRY, costMaxTRY: activity.costMaxTRY, costConfidence: activity.costConfidence, costRangeTRY: [activity.costMinTRY, activity.costMaxTRY] };
  }
  return { costTRY: null, costMinTRY: null, costMaxTRY: null, costConfidence: "unknown", costRangeTRY: null };
}

function indoorOutdoor(raw, activities) {
  const terms = [...(raw.tags || []), ...activities.flatMap((activity) => activity.tags || [])].map(normalise);
  const indoor = terms.includes("kapalı-mekân");
  const outdoor = terms.includes("açık-hava");
  if (indoor && outdoor) return "mixed";
  if (indoor) return "indoor";
  if (outdoor) return "outdoor";
  return "unknown";
}

function sourceFor(raw, sourceContext) {
  const urls = raw.sources || (raw.sourceUrl ? [raw.sourceUrl] : []);
  return {
    dataset: sourceContext.dataset || null,
    sourceType: sourceContext.sourceType || "seed",
    urls,
    verificationSource: raw.verificationSource || null,
    updatedAt: sourceContext.updatedAt || null,
  };
}

function normalizePlace(raw, sourceContext = {}) {
  const activities = (raw.activities || []).map(normalizeActivity);
  const coordinate = coordinateMetadata(raw);
  const cost = placeCost(activities, raw);
  const durationMinutes = activities.length === 1 ? activities[0].durationMinutes : null;
  const openingHours = raw.openingHours || null;
  const unknownFactors = [];
  if (coordinate.geocodeStatus !== "verified") unknownFactors.push("coordinate_verification");
  if (durationMinutes === null) unknownFactors.push("visit_duration");
  if (cost.costConfidence === "unknown") unknownFactors.push("cost");
  if (!openingHours || raw.openingHoursStatus !== "verified") unknownFactors.push("opening_hours_verification");

  return {
    id: raw.id,
    name: raw.name,
    region: sourceContext.region || null,
    category: categoryFor(raw),
    type: raw.type || raw.category || "unknown",
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    coordinates: coordinate.coordinates,
    geocodeStatus: coordinate.geocodeStatus,
    autoRouteEligible: coordinate.autoRouteEligible,
    activities,
    durationMinutes,
    costTRY: cost.costTRY,
    costMinTRY: cost.costMinTRY,
    costMaxTRY: cost.costMaxTRY,
    costRangeTRY: cost.costRangeTRY,
    costConfidence: cost.costConfidence,
    openingHours,
    openingHoursStatus: raw.openingHoursStatus || "unknown",
    indoorOutdoor: indoorOutdoor(raw, activities),
    source: sourceFor(raw, sourceContext),
    unknownFactors,
  };
}

module.exports = { CATEGORY_RULES, normalizePlace };
