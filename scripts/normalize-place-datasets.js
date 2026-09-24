"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { normalizePlace } = require("../src/data/normalize-place");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIRECTORY = path.join(ROOT, "outputs", "normalized");
const DATASETS = [
  { output: "sultanahmet-eminonu.json", input: "sultanahmet-eminonu-seed-data.json", collection: "places", sourceType: "seed", region: "sultanahmet-eminonu", coordinateVerifications: "sultanahmet-eminonu-coordinate-verifications.json" },
  { output: "kadikoy-moda.json", input: "kadikoy-moda-seed-data.json", collection: "places", sourceType: "seed", region: "kadikoy-moda" },
  { output: "karakoy-galata-taksim.json", input: "karakoy-galata-taksim-seed-data.json", collection: "places", sourceType: "seed", region: "karakoy-galata-taksim" },
  { output: "ortakoy-bebek.json", input: "ortakoy-bebek-seed-data.json", collection: "places", sourceType: "seed", region: "ortakoy-bebek" },
  { output: "uskudar-kuzguncuk.json", input: "uskudar-kuzguncuk-seed-data.json", collection: "places", sourceType: "seed", region: "uskudar-kuzguncuk" },
  { output: "fener-balat-eyup-seed.json", input: "fener-balat-eyup-seed-data.json", collection: "places", sourceType: "seed", region: "fener-balat" },
  { output: "fener-balat-eyup-venues.json", input: "fener-balat-eyup-food-coffee-venues.json", collection: "venues", sourceType: "venue", region: "fener-balat" },
];

function reportFor(dataset, places) {
  const categoryDistribution = {};
  places.forEach((place) => { categoryDistribution[place.category] = (categoryDistribution[place.category] || 0) + 1; });
  return {
    dataset: dataset.output,
    totalRecords: places.length,
    verifiedCoordinates: places.filter((place) => place.geocodeStatus === "verified").length,
    approximateCoordinates: places.filter((place) => place.geocodeStatus === "approximate").length,
    unknownCoordinates: places.filter((place) => place.geocodeStatus === "unknown").length,
    autoRouteEligible: places.filter((place) => place.autoRouteEligible).length,
    missingCost: places.filter((place) => place.costConfidence === "unknown").length,
    missingVisitDuration: places.filter((place) => place.durationMinutes === null).length,
    missingOpeningHours: places.filter((place) => !place.openingHours).length,
    categoryDistribution,
  };
}

fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
const reports = DATASETS.map((dataset) => {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "outputs", dataset.input), "utf8"));
  const verifications = dataset.coordinateVerifications
    ? JSON.parse(fs.readFileSync(path.join(ROOT, "outputs", dataset.coordinateVerifications), "utf8")).places
    : {};
  const places = raw[dataset.collection].map((place) => {
    const verification = verifications[place.id];
    return normalizePlace(verification ? { ...place, ...verification } : place, {
      dataset: raw.dataset,
      sourceType: dataset.sourceType,
      region: dataset.region,
      updatedAt: raw.updatedAt,
    });
  });
  fs.writeFileSync(path.join(OUTPUT_DIRECTORY, dataset.output), `${JSON.stringify({ schemaVersion: "1.0.0", sourceFile: dataset.input, places }, null, 2)}\n`);
  return reportFor(dataset, places);
});
fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "validation-report.json"), `${JSON.stringify({ schemaVersion: "1.0.0", reports }, null, 2)}\n`);
console.log(JSON.stringify(reports));
