/**
 * Camera altitude and 3D projection mathematics
 */

const MAPLIBRE_DEFAULT_FOV_DEG = 37.5;
const EARTH_CIRCUMFERENCE_EQUATORIAL_M = 40075016.686; // 156543.03392 * 256

/**
 * Converts MapLibre zoom level and center latitude to camera altitude in meters above sea level
 */
export function zoomToAltitude(zoom: number, lat: number, viewportHeightPx: number = 900): number {
  const rad = (lat * Math.PI) / 180;
  const fovRad = (MAPLIBRE_DEFAULT_FOV_DEG * Math.PI) / 180;
  const fovFactor = 0.5 / Math.tan(fovRad / 2); // ~1.47255
  const metersPerPixel = (156543.03392 * Math.cos(rad)) / Math.pow(2, zoom);
  const altitude = viewportHeightPx * fovFactor * metersPerPixel;
  return Math.max(10, Math.round(altitude));
}

/**
 * Converts target camera altitude in meters to MapLibre zoom level
 */
export function altitudeToZoom(altitudeMeters: number, lat: number, viewportHeightPx: number = 900): number {
  const safeAlt = Math.max(50, altitudeMeters);
  const rad = (lat * Math.PI) / 180;
  const fovRad = (MAPLIBRE_DEFAULT_FOV_DEG * Math.PI) / 180;
  const fovFactor = 0.5 / Math.tan(fovRad / 2);
  const numerator = viewportHeightPx * fovFactor * 156543.03392 * Math.cos(rad);
  const zoom = Math.log2(numerator / safeAlt);
  // Clamp to valid MapLibre zoom limits (1 to 20)
  return Math.min(20, Math.max(1, Math.round(zoom * 100) / 100));
}

/**
 * Formats altitude into readable metric & imperial
 */
export function formatAltitude(meters: number): { metric: string; imperial: string } {
  const roundedM = Math.round(meters);
  const feet = Math.round(meters * 3.28084);
  const metricStr = roundedM >= 10000 ? `${(roundedM / 1000).toFixed(1)}k m` : `${roundedM.toLocaleString()}m`;
  const imperialStr = feet >= 10000 ? `${(feet / 1000).toFixed(1)}k ft` : `${feet.toLocaleString()}ft`;
  return { metric: metricStr, imperial: imperialStr };
}
