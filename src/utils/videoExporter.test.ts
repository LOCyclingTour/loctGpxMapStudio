import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTotalFrames,
  generateVideoFileName,
  VIDEO_RESOLUTIONS,
  getSupportedVideoMimeType,
  DEFAULT_TV_BANNER_PARTS,
  drawOutroCompassRoseOnCanvas,
} from './videoExporter.ts';

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

