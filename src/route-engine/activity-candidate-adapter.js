"use strict";

const { normalise } = require("./interest-mapping");

const ACTIVITY_CANDIDATE_TYPE = "activity";

function activityIdFor(activity) {
  return activity.id || normalise(activity.name).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
}

function hasKnownCost(record) {
  return Number.isFinite(record.costTRY) || Number.isFinite(record.costMinTRY) ||
    Number.isFinite(record.costMaxTRY) || (Array.isArray(record.costRangeTRY) && record.costRangeTRY.some(Number.isFinite));
}

function costFields(activity, place) {
  const source = hasKnownCost(activity) ? activity : place;
  return {
    costTRY: Number.isFinite(source.costTRY) ? source.costTRY : null,
    costMinTRY: Number.isFinite(source.costMinTRY) ? source.costMinTRY : null,
    costMaxTRY: Number.isFinite(source.costMaxTRY) ? source.costMaxTRY : null,
    costRangeTRY: Array.isArray(source.costRangeTRY) ? [...source.costRangeTRY] : null,
    costConfidence: source.costConfidence || "unknown",
    costSource: source === activity ? "activity" : (hasKnownCost(place) ? "place" : "unknown"),
  };
}

function createActivityCandidate(place, activity, selectionCount = 1) {
  const activityId = activityIdFor(activity);
  return {
    id: `${place.id}::activity::${activityId}`,
    candidateType: ACTIVITY_CANDIDATE_TYPE,
    placeId: place.id,
    activityId,
    name: place.name,
    activityName: activity.name,
    category: place.category,
    type: place.type,
    region: place.region || null,
    tags: [...(place.tags || []), ...(activity.tags || [])],
    coordinates: place.coordinates,
    geocodeStatus: place.geocodeStatus,
    autoRouteEligible: place.autoRouteEligible,
    openingHours: place.openingHours,
    openingHoursStatus: place.openingHoursStatus,
    indoorOutdoor: place.indoorOutdoor,
    durationMinutes: activity.durationMinutes,
    activities: [{ ...activity }],
    allowSamePlaceMultiple: selectionCount > 1,
    sourcePlace: place,
    ...costFields(activity, place),
  };
}

function selectedActivityCounts(selectedActivities) {
  return (selectedActivities || []).reduce((counts, selection) => {
    if (!selection || !selection.placeId || !selection.activityId) return counts;
    counts.set(selection.placeId, (counts.get(selection.placeId) || 0) + 1);
    return counts;
  }, new Map());
}

function expandSelectedActivities(places, selectedActivities = []) {
  const selectionsByPlace = new Map();
  selectedActivities.forEach((selection) => {
    if (!selection || !selection.placeId || !selection.activityId) return;
    const existing = selectionsByPlace.get(selection.placeId) || new Set();
    existing.add(selection.activityId);
    selectionsByPlace.set(selection.placeId, existing);
  });
  const counts = selectedActivityCounts(selectedActivities);
  return places.flatMap((place) => {
    const selectedIds = selectionsByPlace.get(place.id);
    if (!selectedIds || (place.activities || []).length < 2) return [];
    return place.activities
      .filter((activity) => selectedIds.has(activityIdFor(activity)))
      .map((activity) => createActivityCandidate(place, activity, counts.get(place.id) || 1));
  });
}

module.exports = {
  ACTIVITY_CANDIDATE_TYPE,
  activityIdFor,
  createActivityCandidate,
  expandSelectedActivities,
};
