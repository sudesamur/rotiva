"use strict";

const { activityIdFor } = require("../route-engine/activity-candidate-adapter");
const { resolveRegionDataset, REGION_DATASETS } = require("../planner/region-datasets");
const { fold } = require("./planner-intent-parser");

function resolveRequestedActivities(region, requestedActivities, datasets = REGION_DATASETS) {
  const places = region ? resolveRegionDataset(region, datasets) : null;
  if (!places) return { selectedActivities: [], ambiguities: requestedActivities.map(() => "activity_region_unresolved") };
  const selectedActivities = [];
  const ambiguities = [];
  requestedActivities.forEach((request) => {
    const placeMatches = places.filter((place) => fold(place.name).includes(fold(request.placeQuery)) || fold(place.id).includes(fold(request.placeQuery)));
    const matches = placeMatches.flatMap((place) => (place.activities || [])
      .filter((activity) => fold(activity.name).includes(fold(request.activityQuery)))
      .map((activity) => ({ placeId: place.id, activityId: activityIdFor(activity) })));
    if (matches.length === 1) selectedActivities.push(matches[0]);
    else ambiguities.push(matches.length === 0 ? "activity_not_found" : "activity_ambiguous");
  });
  return { selectedActivities, ambiguities };
}

module.exports = { resolveRequestedActivities };
