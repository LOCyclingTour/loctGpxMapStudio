import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTotalFrames,
  generateVideoFileName,
  VIDEO_RESOLUTIONS,
  getSupportedVideoMimeType,
  DEFAULT_TV_BANNER_PARTS,
  drawOutroCompassRoseOnCanvas,
  isPointInFrontOfCamera,
  drawWaypointPinsOnCanvas,
  colorWithAlpha,
} from './videoExporter.ts';
import { DEFAULT_WAYPOINT_PIN_SETTINGS } from './waypointSettings.ts';

test('calculateTotalFrames calculates frames from duration and fps', () => {
  assert.equal(calculateTotalFrames(10, 30), 300);
  assert.equal(calculateTotalFrames(20, 60), 1200);
  assert.equal(calculateTotalFrames(0, 30), 1);
});

test('generateVideoFileName formats clean filenames', () => {
  const f1 = generateVideoFileName('Grossglockner High Alpine Pass', '1080p', 'webm');
  assert.equal(f1, 'grossglockner_high_alpine_pass_loct_1080p.webm');

  const f2 = generateVideoFileName('Mount Fuji - 5th Station (Summit)', 'vertical', 'mp4');
  assert.equal(f2, 'mount_fuji_5th_station_summit_loct_vertical.mp4');
});

test('VIDEO_RESOLUTIONS contains standard presets including 4K Ultra HD', () => {
  assert.ok(VIDEO_RESOLUTIONS.length >= 6);
  const r4k = VIDEO_RESOLUTIONS.find((r) => r.id === '4k');
  assert.ok(r4k);
  assert.equal(r4k?.width, 3840);
  assert.equal(r4k?.height, 2160);

  const r1080 = VIDEO_RESOLUTIONS.find((r) => r.id === '1080p');
  assert.ok(r1080);
  assert.equal(r1080?.width, 1920);
  assert.equal(r1080?.height, 1080);

  const rVert = VIDEO_RESOLUTIONS.find((r) => r.id === 'vertical');
  assert.ok(rVert);
  assert.equal(rVert?.width, 1080);
  assert.equal(rVert?.height, 1920);
});

test('getSupportedVideoMimeType falls back safely when window is not defined', () => {
  const res = getSupportedVideoMimeType();
  assert.ok(res.mimeType.includes('video/'));
  assert.ok(['webm', 'mp4'].includes(res.extension));
});

test('DEFAULT_TV_BANNER_PARTS has all standard elements enabled by default', () => {
  assert.equal(DEFAULT_TV_BANNER_PARTS.showTitle, true);
  assert.equal(DEFAULT_TV_BANNER_PARTS.showSubtitle, true);
  assert.equal(DEFAULT_TV_BANNER_PARTS.showBadge, true);
  assert.equal(DEFAULT_TV_BANNER_PARTS.showTelemetry, true);
  assert.equal(DEFAULT_TV_BANNER_PARTS.showLiveTag, true);
  assert.equal(DEFAULT_TV_BANNER_PARTS.showProgressBar, true);
  assert.equal(DEFAULT_TV_BANNER_PARTS.showAccentBar, true);
});

test('VIDEO_RESOLUTIONS includes vertical 4K preset', () => {
  const v4k = VIDEO_RESOLUTIONS.find((r) => r.id === 'vertical-4k');
  assert.ok(v4k);
  assert.equal(v4k?.width, 2160);
  assert.equal(v4k?.height, 3840);
  assert.equal(v4k?.aspectRatio, '9:16');
});

test('drawOutroCompassRoseOnCanvas handles boundary progress safely', () => {
  // Should return early if progress is 0 without error
  drawOutroCompassRoseOnCanvas(null as any, 100, 100, 50, 0);
  drawOutroCompassRoseOnCanvas(null as any, 100, 100, 50, -0.5);
  assert.ok(true);
});

test('isPointInFrontOfCamera handles edge cases safely', () => {
  // Gracefully handles missing map or transform
  assert.equal(isPointInFrontOfCamera(null, 10, 45), true);
  assert.equal(isPointInFrontOfCamera({}, 10, 45), true);

  // When transform matrix has positive W, point is in front
  const mockMap = {
    transform: {
      worldSize: 512,
      pixelMatrix: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1 // w = 1 > 0
      ]
    }
  };
  assert.equal(isPointInFrontOfCamera(mockMap, 0, 0), true);

  // When transform matrix has negative W, point is behind camera
  const mockMapBehind = {
    transform: {
      worldSize: 512,
      pixelMatrix: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, -1 // w = -1 < 0
      ]
    }
  };
  assert.equal(isPointInFrontOfCamera(mockMapBehind, 0, 0), false);
});

test('drawWaypointPinsOnCanvas handles empty, null or valid route data without error', () => {
  // Null / empty routes should return gracefully
  drawWaypointPinsOnCanvas(
    null as any, 1920, 1080, null, null as any, 0, 0, 1920, 1080, null, DEFAULT_WAYPOINT_PIN_SETTINGS, '#f59e0b', 0.5
  );

  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    fillText: () => {},
    measureText: (text: string) => ({ width: text.length * 8 }),
  };

  const mockMap = {
    getCanvas: () => ({ clientWidth: 1920, clientHeight: 1080 }),
    transform: { width: 1920, height: 1080 },
    project: ([lng, lat]: [number, number]) => ({ x: 500, y: 400 }),
  };

  const mockRoute = {
    name: 'Sample Route',
    totalDistanceKm: 10,
    totalDistanceMiles: 6.2,
    elevationGainM: 350,
    elevationLossM: 350,
    maxElevationM: 1200,
    minElevationM: 850,
    points: [],
    coordinates: [[10, 45]],
    waypoints: [
      { id: 'wpt-1', name: 'Trailhead Checkpoint', lat: 45.1, lng: 10.1, ele: 900 },
      { id: 'wpt-2', name: 'Alpine Peak', lat: 45.2, lng: 10.2, ele: 1200 }
    ],
  };

  // Name pin mode (badge)
  drawWaypointPinsOnCanvas(
    mockCtx as any,
    1920,
    1080,
    mockMap,
    { width: 1920, height: 1080 } as any,
    0,
    0,
    1920,
    1080,
    mockRoute as any,
    { ...DEFAULT_WAYPOINT_PIN_SETTINGS, displayMode: 'name', approachReveal: false },
    '#f59e0b',
    0.5
  );

  // Both mode
  drawWaypointPinsOnCanvas(
    mockCtx as any,
    1920,
    1080,
    mockMap,
    { width: 1920, height: 1080 } as any,
    0,
    0,
    1920,
    1080,
    mockRoute as any,
    { ...DEFAULT_WAYPOINT_PIN_SETTINGS, displayMode: 'both', approachReveal: false },
    '#f59e0b',
    0.5
  );

  // Index mode
  drawWaypointPinsOnCanvas(
    mockCtx as any,
    1920,
    1080,
    mockMap,
    { width: 1920, height: 1080 } as any,
    0,
    0,
    1920,
    1080,
    mockRoute as any,
    { ...DEFAULT_WAYPOINT_PIN_SETTINGS, displayMode: 'index', approachReveal: false },
    '#f59e0b',
    0.5
  );

  assert.ok(true);
});

test('colorWithAlpha converts hex and rgb colors accurately', () => {
  assert.equal(colorWithAlpha('#ec4899', 0.5), 'rgba(236, 72, 153, 0.5)');
  assert.equal(colorWithAlpha('#f0a', 0.25), 'rgba(255, 0, 170, 0.25)');
  assert.equal(colorWithAlpha('rgb(236, 72, 153)', 0.8), 'rgba(236, 72, 153, 0.8)');
  assert.equal(colorWithAlpha('hotpink', 0.4), 'hotpink');
});

test('drawWaypointPinsOnCanvas honors custom pink accentColor instead of hardcoded yellow', () => {
  const usedColors: string[] = [];
  const makeTrackedCtx = () => {
    let _fill: any = '';
    let _stroke: any = '';
    let _shadow: any = '';
    return {
      get fillStyle() { return _fill; },
      set fillStyle(v: any) { _fill = v; if (typeof v === 'string') usedColors.push(v); },
      get strokeStyle() { return _stroke; },
      set strokeStyle(v: any) { _stroke = v; if (typeof v === 'string') usedColors.push(v); },
      get shadowColor() { return _shadow; },
      set shadowColor(v: any) { _shadow = v; if (typeof v === 'string') usedColors.push(v); },
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      fillText: () => {},
      measureText: (text: string) => ({ width: text.length * 8 }),
    };
  };

  const mockMap = {
    getCanvas: () => ({ clientWidth: 1920, clientHeight: 1080 }),
    transform: { width: 1920, height: 1080 },
    project: () => ({ x: 500, y: 400 }),
  };

  const mockRoute = {
    name: 'Pink Route',
    totalDistanceKm: 10,
    totalDistanceMiles: 6.2,
    elevationGainM: 350,
    elevationLossM: 350,
    maxElevationM: 1200,
    minElevationM: 850,
    points: [
      { lat: 45.0, lng: 10.0, ele: 900, distFromStartKm: 0 },
      { lat: 45.1, lng: 10.1, ele: 1200, distFromStartKm: 5 },
      { lat: 45.2, lng: 10.2, ele: 1000, distFromStartKm: 10 },
    ],
    coordinates: [[10.0, 45.0], [10.1, 45.1], [10.2, 45.2]],
    waypoints: [
      { id: 'wpt-1', name: 'Pink Summit', lat: 45.1, lng: 10.1, ele: 1200 },
    ],
  };

  const pink = '#ec4899';
  for (const mode of ['name', 'both', 'index'] as const) {
    drawWaypointPinsOnCanvas(
      makeTrackedCtx() as any,
      1920,
      1080,
      mockMap,
      { width: 1920, height: 1080 } as any,
      0,
      0,
      1920,
      1080,
      mockRoute as any,
      { ...DEFAULT_WAYPOINT_PIN_SETTINGS, displayMode: mode, showElevation: true, approachReveal: true },
      pink,
      0.5 // exact arrival at 5km / 10km so arrival styling is exercised too
    );
  }

  assert.ok(usedColors.some((c) => c.toLowerCase() === pink || c.includes('236, 72, 153')));
  assert.equal(
    usedColors.some((c) => c.toLowerCase().includes('#fbbf24') || c.toLowerCase().includes('#f59e0b') || c.includes('245, 158, 11') || c.includes('251, 191, 36')),
    false
  );
});



