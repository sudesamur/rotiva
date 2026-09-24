"use strict";

/** Geographic helpers shared by route-engine modules. */

const EARTH_RADIUS_METERS = 6371000;

function validCoordinates(coordinates) {
  return Boolean(
    coordinates &&
      Number.isFinite(coordinates.lat) &&
      Number.isFinite(coordinates.lng),
  );
}

function metersBetween(first, second) {
  if (!validCoordinates(first) || !validCoordinates(second)) return null;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(second.lat - first.lat);
  const longitudeDelta = toRadians(second.lng - first.lng);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(first.lat)) *
      Math.cos(toRadians(second.lat)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { EARTH_RADIUS_METERS, metersBetween, validCoordinates };
