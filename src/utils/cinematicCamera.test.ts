import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTotalSequenceDuration,
  getTimelineState,
  cubicEaseInOut,
  getOutroAnimatedColor,
  calculateIntroCamera,
  calculateOutroCamera,
  getBoundsCenterAndZoom,
  DEFAULT_INTRO_OUTRO_CONFIG,
  isOutroRoseActive,
} from './cinematicCamera.ts';

test('calculateTotalSequenceDuration combines main route with intro and outro durations', () => {
  const cfg = {
    ...DEFAULT_INTRO_OUTRO_CONFIG,
    enableIntro: true,
    introDurationSeconds: 3,
    enableOutro: true,
    outroDurationSeconds: 4,
  };
  assert.equal(calculateTotalSequenceDuration(15, cfg), 22);

  // When intro is disabled
  const noIntro = { ...cfg, enableIntro: false };
  assert.equal(calculateTotalSequenceDuration(15, noIntro), 19);

  // When outro is disabled
  const noOutro = { ...cfg, enableOutro: false };
  assert.equal(calculateTotalSequenceDuration(15, noOutro), 18);
});

test('getTimelineState transitions through intro, flythrough, outro-zoom, and outro-hold phases', () => {
  const cfg = {
    ...DEFAULT_INTRO_OUTRO_CONFIG,
    enableIntro: true,
    introDurationSeconds: 3,
    enableOutro: true,
    outroDurationSeconds: 4,
  };
  const mainSec = 10;

  // At 1.5s (middle of 3s intro)
  const sIntro = getTimelineState(1.5, cfg, mainSec);
  assert.equal(sIntro.phase, 'intro');
  assert.equal(sIntro.isIntro, true);
  assert.equal(sIntro.isOutro, false);
  assert.equal(sIntro.routeProgress, 0);

  // At 8s (middle of flythrough, elapsed from 3s is 5s / 10s = 0.5)
  const sFly = getTimelineState(8, cfg, mainSec);
  assert.equal(sFly.phase, 'flythrough');
  assert.equal(sFly.isIntro, false);
  assert.equal(sFly.isOutro, false);
  assert.equal(sFly.routeProgress, 0.5);

  // At 13.5s (in outro zoom out, 0.5s into outro)
  const sZoom = getTimelineState(13.5, cfg, mainSec);
  assert.equal(sZoom.phase, 'outro-zoom');
  assert.equal(sZoom.isOutro, true);
  assert.equal(sZoom.isHoldingOutro, false);
  assert.equal(sZoom.routeProgress, 1);
  assert.ok(sZoom.animatedLineColor);

  // At 16s (in outro hold, > 1.8s into outro)
  const sHold = getTimelineState(16, cfg, mainSec);
  assert.equal(sHold.phase, 'outro-hold');
  assert.equal(sHold.isHoldingOutro, true);
  assert.equal(sHold.routeProgress, 1);
  assert.ok(sHold.animatedLineColor);
});

test('cubicEaseInOut clamps at boundaries and accelerates smoothly', () => {
  assert.equal(cubicEaseInOut(0), 0);
  assert.equal(cubicEaseInOut(1), 1);
  assert.equal(cubicEaseInOut(0.5), 0.5);
  assert.ok(cubicEaseInOut(0.2) < 0.2); // S-curve ease-in
  assert.ok(cubicEaseInOut(0.8) > 0.8); // S-curve ease-out
});

test('getOutroAnimatedColor generates rainbow, neon, gold, and rose colors', () => {
  const rainbow = getOutroAnimatedColor('rainbow', 1000);
  assert.ok(rainbow.startsWith('hsl('));

  const neon = getOutroAnimatedColor('neon', 1000);
  assert.ok(neon.startsWith('rgb('));

  const gold = getOutroAnimatedColor('gold', 1000);
  assert.ok(gold.startsWith('rgb('));

  const rose = getOutroAnimatedColor('rose', 1000);
  assert.ok(rose.startsWith('rgb('));
});

test('isOutroRoseActive respects configuration', () => {
  assert.equal(isOutroRoseActive(undefined), true);
  assert.equal(isOutroRoseActive({ ...DEFAULT_INTRO_OUTRO_CONFIG, showOutroRose: true }), true);
  assert.equal(isOutroRoseActive({ ...DEFAULT_INTRO_OUTRO_CONFIG, showOutroRose: false }), false);
  assert.equal(isOutroRoseActive({ ...DEFAULT_INTRO_OUTRO_CONFIG, outroRoseEnabled: false }), false);
});

test('calculateIntroCamera dives from world view down to start point and pitch', () => {
  const startPoint = { lng: 12.34, lat: 47.56 };
  const camStart = calculateIntroCamera(0, startPoint, 90, 13.0, 55);
  assert.equal(camStart.zoom, 3.8);
  assert.equal(camStart.pitch, 0);

  const camEnd = calculateIntroCamera(1, startPoint, 90, 13.0, 55);
  assert.equal(camEnd.zoom, 13.0);
  assert.equal(camEnd.pitch, 55);
  assert.equal(camEnd.bearing, 90);
});

test('calculateOutroCamera zooms out from finish point to bounds center and overview pitch', () => {
  const finish = { lng: 12.5, lat: 47.6 };
  const boundsCenter: [number, number] = [12.2, 47.3];
  const camStart = calculateOutroCamera(0, finish, 90, boundsCenter, 10.5, 13.0, 55, 38);
  assert.equal(camStart.zoom, 13.0);
  assert.equal(camStart.pitch, 55);

  const camEnd = calculateOutroCamera(1, finish, 90, boundsCenter, 10.5, 13.0, 55, 38);
  assert.equal(camEnd.zoom, 10.5);
  assert.equal(camEnd.pitch, 38);
  assert.equal(camEnd.center[0], 12.2);
  assert.equal(camEnd.center[1], 47.3);
});

test('getBoundsCenterAndZoom computes bounding center and zoom for route', () => {
  const bounds: [[number, number], [number, number]] = [[12.0, 47.0], [13.0, 48.0]];
  const res = getBoundsCenterAndZoom(bounds);
  assert.equal(res.center[0], 12.5);
  assert.equal(res.center[1], 47.5);
  assert.ok(res.zoom > 6 && res.zoom < 12);
});

test('calculateOutroCamera seamlessly preserves exact flythrough camera state at progress 0', () => {
  const transitionCam = {
    center: [12.456, 47.789] as [number, number],
    zoom: 13.25,
    pitch: 58.4,
    bearing: 215.3,
  };
  const boundsCenter: [number, number] = [12.2, 47.3];
  const camStart = calculateOutroCamera(0, transitionCam, 90, boundsCenter, 10.5, 14.8, 50, 38);
  assert.equal(camStart.center[0], 12.456);
  assert.equal(camStart.center[1], 47.789);
  assert.equal(camStart.zoom, 13.25);
  assert.equal(camStart.pitch, 58.4);
  assert.equal(camStart.bearing, 215.3);

  const camEnd = calculateOutroCamera(1, transitionCam, 90, boundsCenter, 10.5, 14.8, 50, 38);
  assert.equal(camEnd.center[0], 12.2);
  assert.equal(camEnd.center[1], 47.3);
  assert.equal(camEnd.zoom, 10.5);
  assert.equal(camEnd.pitch, 38);
  assert.equal(camEnd.bearing, 0);
});

