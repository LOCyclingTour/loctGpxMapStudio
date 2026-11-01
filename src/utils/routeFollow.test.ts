import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBearing,
  angleDelta,
  interpolateAngle,
  getRoutePointAtProgress,
  findNearestElevation,
} from './routeFollow.ts';

test('calculateBearing calculates cardinal headings accurately', () => {
  // Moving North: lat increases, lng stays 0
  const north = calculateBearing(0, 0, 0, 1);
  assert.equal(Math.round(north), 0);

  // Moving East: lng increases, lat stays 0
  const east = calculateBearing(0, 0, 1, 0);
  assert.equal(Math.round(east), 90);

  // Moving South: lat decreases, lng stays 0
  const south = calculateBearing(0, 1, 0, 0);
  assert.equal(Math.round(south), 180);

  // Moving West: lng decreases, lat stays 0
  const west = calculateBearing(1, 0, 0, 0);
  assert.equal(Math.round(west), 270);
});

test('angleDelta handles modular wrap-around', () => {
  assert.equal(angleDelta(350, 10), 20);
  assert.equal(angleDelta(10, 350), -20);
  assert.equal(angleDelta(0, 180), 180);
});

test('interpolateAngle smoothly moves between bearings', () => {
  assert.equal(Math.round(interpolateAngle(350, 10, 0.5)), 0);
  assert.equal(Math.round(interpolateAngle(0, 90, 0.5)), 45);
});

test('getRoutePointAtProgress interpolates coordinates and bearings along track', () => {
  const dummyRoute = {
    points: [
      { lat: 47.0, lng: 12.0, ele: 1000, distFromStartKm: 0 },
      { lat: 47.0, lng: 12.1, ele: 1500, distFromStartKm: 10 },
      { lat: 47.1, lng: 12.1, ele: 2000, distFromStartKm: 20 },
    ],
    coordinates: [
      [12.0, 47.0],
      [12.1, 47.0],
      [12.1, 47.1],
    ] as [number, number][],
    totalDistanceKm: 20,
    waypoints: [
      { id: 'w1', name: 'Start', lat: 47.0, lng: 12.0 },
      { id: 'w2', name: 'Finish', lat: 47.1, lng: 12.1 },
    ],
  };

  // Progress 0
  const p0 = getRoutePointAtProgress(dummyRoute, 0);
  assert.equal(p0.lat, 47.0);
  assert.equal(p0.lng, 12.0);
  assert.equal(p0.ele, 1000);
  assert.ok(p0.bearing >= 80 && p0.bearing <= 100); // Heading East

  // Progress 0.25 (middle of first leg)
  const p25 = getRoutePointAtProgress(dummyRoute, 0.25);
  assert.equal(p25.lat, 47.0);
  assert.equal(Math.round(p25.lng * 100) / 100, 12.05);
  assert.equal(p25.ele, 1250);

  // Progress 1.0 (finish)
  const p100 = getRoutePointAtProgress(dummyRoute, 1);
  assert.equal(p100.lat, 47.1);
  assert.equal(p100.lng, 12.1);
  assert.equal(p100.ele, 2000);
  assert.ok(p100.bearing >= 350 || p100.bearing <= 10); // Heading North
});

test('findNearestElevation looks up exact waypoint elevation and falls back to track points', () => {
  const dummyRoute = {
    waypoints: [
      { id: 'w1', name: 'Valley Start', lat: 47.001, lng: 12.001, ele: 850 },
      { id: 'w2', name: 'Alpine Peak', lat: 47.123, lng: 12.456, ele: 2450 },
    ],
    points: [
      { lat: 47.050, lng: 12.100, ele: 1200 },
      { lat: 47.080, lng: 12.200, ele: 1800 },
    ],
  };

  // Exact or very close to waypoint
  assert.equal(findNearestElevation(12.456, 47.123, dummyRoute), 2450);
  assert.equal(findNearestElevation(12.0012, 47.0011, dummyRoute), 850);

  // Close to track point
  assert.equal(findNearestElevation(12.2001, 47.0801, dummyRoute), 1800);

  // Far away point returns null
  assert.equal(findNearestElevation(15.0, 50.0, dummyRoute), null);

  // Null routeData returns null
  assert.equal(findNearestElevation(12.0, 47.0, null), null);
});

