import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_WAYPOINT_PIN_SETTINGS,
  computeWaypointsRouteProgress,
  getWaypointApproachStatus,
} from './waypointSettings.ts';
import { GpxRouteData } from './gpxParser.ts';

test('DEFAULT_WAYPOINT_PIN_SETTINGS has displayMode=name and approachReveal=true', () => {
  assert.equal(DEFAULT_WAYPOINT_PIN_SETTINGS.displayMode, 'name');
  assert.equal(DEFAULT_WAYPOINT_PIN_SETTINGS.approachReveal, true);
  assert.equal(DEFAULT_WAYPOINT_PIN_SETTINGS.approachDistanceKm, 0.8);
  assert.equal(DEFAULT_WAYPOINT_PIN_SETTINGS.showElevation, true);
});

test('computeWaypointsRouteProgress correctly maps waypoints to track progress', () => {
  const dummyRoute: GpxRouteData = {
    name: 'Test Trail',
    coordinates: [[10.0, 47.0], [10.1, 47.1], [10.2, 47.2]],
    points: [
      { lat: 47.0, lng: 10.0, ele: 1000, distFromStartKm: 0 },
      { lat: 47.1, lng: 10.1, ele: 1500, distFromStartKm: 12 },
      { lat: 47.2, lng: 10.2, ele: 2000, distFromStartKm: 24 },
    ],
    waypoints: [
      { id: 'start-wpt', name: 'Start Pass', lat: 47.001, lng: 10.001, ele: 1005 },
      { id: 'mid-wpt', name: 'Mid Refuge', lat: 47.102, lng: 10.101, ele: 1510 },
      { id: 'end-wpt', name: 'Summit Peak', lat: 47.199, lng: 10.201, ele: 2000 },
    ],
    bounds: [[10.0, 47.0], [10.2, 47.2]],
    totalDistanceKm: 24,
    totalDistanceMiles: 14.9,
    elevationGainM: 1000,
    elevationLossM: 0,
    minElevationM: 1000,
    maxElevationM: 2000,
  };

  const progressMap = computeWaypointsRouteProgress(dummyRoute);
  assert.equal(progressMap.size, 3);

  const startWpt = progressMap.get('start-wpt');
  assert.ok(startWpt);
  assert.equal(startWpt.distFromStartKm, 0);
  assert.equal(startWpt.progressRatio, 0);

  const midWpt = progressMap.get('mid-wpt');
  assert.ok(midWpt);
  assert.equal(midWpt.distFromStartKm, 12);
  assert.equal(midWpt.progressRatio, 0.5);

  const endWpt = progressMap.get('end-wpt');
  assert.ok(endWpt);
  assert.equal(endWpt.distFromStartKm, 24);
  assert.equal(endWpt.progressRatio, 1);
});

test('getWaypointApproachStatus triggers approach reveal and arrival highlight', () => {
  const wptDist = 10; // km
  const totalDist = 20; // km
  const approachDist = 1.0; // km

  // 1. Far before waypoint (at 5km -> progress 0.25)
  const farBefore = getWaypointApproachStatus(0.25, wptDist, totalDist, approachDist, true);
  assert.equal(farBefore.isRevealed, false);
  assert.equal(farBefore.isActiveArrival, false);
  assert.equal(farBefore.isPassed, false);

  // 2. Approaching waypoint (at 9.3km -> progress 0.465, within 1km)
  const approaching = getWaypointApproachStatus(0.465, wptDist, totalDist, approachDist, true);
  assert.equal(approaching.isRevealed, true);
  assert.equal(approaching.isPassed, false);

  // 3. Right at arrival (at 10km -> progress 0.5)
  const arrival = getWaypointApproachStatus(0.5, wptDist, totalDist, approachDist, true);
  assert.equal(arrival.isRevealed, true);
  assert.equal(arrival.isActiveArrival, true);

  // 4. Past waypoint (at 13km -> progress 0.65)
  const passed = getWaypointApproachStatus(0.65, wptDist, totalDist, approachDist, true);
  assert.equal(passed.isRevealed, true); // stays visible
  assert.equal(passed.isActiveArrival, false);
  assert.equal(passed.isPassed, true);
});
