// Refresh only the mobile preview asset; backend data and contracts remain untouched.
// Run from any directory: node mobile/tool/sync_verified_coordinates.cjs
const fs = require('node:fs');
const path = require('node:path');
const { REGION_DATASETS } = require('../../src/planner/region-datasets');
const regions = {};
for (const [region, places] of Object.entries(REGION_DATASETS)) {
  regions[region] = Object.fromEntries(places
    .filter(p => p.geocodeStatus === 'verified' && p.autoRouteEligible === true &&
      Number.isFinite(p.coordinates?.lat) && Math.abs(p.coordinates.lat) <= 90 &&
      Number.isFinite(p.coordinates?.lng) && Math.abs(p.coordinates.lng) <= 180)
    .map(p => [p.id, { coordinates: p.coordinates, geocodeStatus: p.geocodeStatus }]));
}
fs.writeFileSync(path.join(__dirname, '../assets/data/verified_coordinates.json'), JSON.stringify({
  source: 'outputs/normalized via src/planner/region-datasets.js',
  snapshotDate: new Date().toISOString().slice(0, 10),
  regions,
}, null, 2) + '\n');
