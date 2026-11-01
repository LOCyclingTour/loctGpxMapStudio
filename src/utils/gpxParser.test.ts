import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHaversineKm,
  extractImageUrl,
  formatDuration,
  parseGpx,
} from './gpxParser.ts';

test('calculateHaversineKm computes distance accurately', () => {
  // Distance from London (51.5074, -0.1278) to Paris (48.8566, 2.3522) is approx 343 km
  const dist = calculateHaversineKm(51.5074, -0.1278, 48.8566, 2.3522);
  assert.ok(dist > 340 && dist < 350, `Expected ~343km, got ${dist}`);
});

test('extractImageUrl detects image URLs in link, desc or sym', () => {
  assert.equal(
    extractImageUrl('https://example.com/photo.jpg'),
    'https://example.com/photo.jpg'
  );
  assert.equal(
    extractImageUrl(undefined, 'Scenic view at <a href="https://images.unsplash.com/summit.webp">view</a>'),
    'https://images.unsplash.com/summit.webp'
  );
  assert.equal(
    extractImageUrl(undefined, undefined, 'https://example.org/camera_icon.png'),
    'https://example.org/camera_icon.png'
  );
  assert.equal(extractImageUrl(undefined, 'Just some text', undefined), undefined);
});

test('formatDuration formats seconds into readable time', () => {
  assert.equal(formatDuration(3600 + 1800), '1h 30m');
  assert.equal(formatDuration(1500), '25m');
  assert.equal(formatDuration(0), '--');
});

test('parseGpx correctly parses GPX XML string with tracks and waypoints', () => {
  const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LOCT GPX Test">
  <metadata>
    <name>Alpine Ridge Ascent</name>
    <desc>Scenic mountain pass trail</desc>
  </metadata>
  <wpt lat="46.500" lon="11.200">
    <name>Alpine Hut Refugio</name>
    <ele>2150</ele>
    <desc>Cozy refuge with panoramic terrace</desc>
    <link href="https://images.unsplash.com/photo-alpine.jpg" />
  </wpt>
  <wpt lat="46.520" lon="11.250">
    <name>Summit Cross</name>
    <ele>2840</ele>
  </wpt>
  <trk>
    <name>Alpine Ridge Ascent</name>
    <trkseg>
      <trkpt lat="46.490" lon="11.190">
        <ele>1800</ele>
        <time>2026-10-24T08:00:00Z</time>
      </trkpt>
      <trkpt lat="46.500" lon="11.200">
        <ele>2150</ele>
        <time>2026-10-24T09:00:00Z</time>
      </trkpt>
      <trkpt lat="46.520" lon="11.250">
        <ele>2840</ele>
        <time>2026-10-24T11:00:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

  const result = parseGpx(sampleGpx);

  assert.equal(result.name, 'Alpine Ridge Ascent');
  assert.equal(result.points.length, 3);
  assert.equal(result.coordinates.length, 3);
  assert.deepEqual(result.coordinates[0], [11.190, 46.490]);
  assert.equal(result.waypoints.length, 2);
  assert.equal(result.waypoints[0].name, 'Alpine Hut Refugio');
  assert.equal(result.waypoints[0].imageUrl, 'https://images.unsplash.com/photo-alpine.jpg');
  assert.equal(result.waypoints[0].ele, 2150);

  assert.ok(result.totalDistanceKm > 0);
  assert.equal(result.elevationGainM, 1040); // (2150-1800) + (2840-2150) = 350 + 690 = 1040
  assert.equal(result.minElevationM, 1800);
  assert.equal(result.maxElevationM, 2840);
  assert.equal(result.durationSeconds, 3 * 3600);
  assert.equal(result.formattedDuration, '3h 0m');
  assert.ok(result.bounds[0][0] <= 11.190 && result.bounds[1][0] >= 11.250);
});
