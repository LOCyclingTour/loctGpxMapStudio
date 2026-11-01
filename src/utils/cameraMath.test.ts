import test from 'node:test';
import assert from 'node:assert/strict';
import {
  zoomToAltitude,
  altitudeToZoom,
  formatAltitude,
} from './cameraMath.ts';

test('zoomToAltitude and altitudeToZoom round-trip accurately', () => {
  const targetAlt = 2500; // 2500 meters
  const lat = 47.1; // Austrian Alps latitude
  const height = 900;

  const calculatedZoom = altitudeToZoom(targetAlt, lat, height);
  assert.ok(calculatedZoom > 14 && calculatedZoom < 17, `Expected zoom ~15-16, got ${calculatedZoom}`);

  const recoveredAlt = zoomToAltitude(calculatedZoom, lat, height);
  // Should match within small rounding tolerance
  assert.ok(Math.abs(recoveredAlt - targetAlt) < 50, `Expected ~2500, got ${recoveredAlt}`);
});

test('altitude scales inversely with zoom level', () => {
  const lat = 35.0;
  const altHighZoom = zoomToAltitude(16, lat);
  const altLowZoom = zoomToAltitude(12, lat);
  // Higher zoom = closer camera = lower altitude
  assert.ok(altHighZoom < altLowZoom, 'Higher zoom should result in lower camera altitude');
  // 4 zoom levels difference = 2^4 = 16x altitude difference
  const ratio = altLowZoom / altHighZoom;
  assert.ok(ratio > 15 && ratio < 17, `Expected ~16x ratio, got ${ratio}`);
});

test('formatAltitude formats metric and imperial units', () => {
  const f1 = formatAltitude(500);
  assert.equal(f1.metric, '500m');
  assert.equal(f1.imperial, '1,640ft');

  const f2 = formatAltitude(12000);
  assert.equal(f2.metric, '12.0k m');
  assert.equal(f2.imperial, '39.4k ft');
});
