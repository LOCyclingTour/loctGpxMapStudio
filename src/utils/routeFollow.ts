/**
 * Route camera tracking, position interpolation, and smooth bearing mathematics
 */

import { GpxRouteData, GpxTrackPoint } from './gpxParser';

export interface RouteProgressPoint {
  lng: number;
  lat: number;
  ele?: number;
  bearing: number;
  distFromStartKm: number;
  segmentIndex: number;
  segmentProgress: number;
}

/**
 * Calculates initial geodetic bearing from (lng1, lat1) to (lng2, lat2) in degrees [0, 360)
 */
export function calculateBearing(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const rad = Math.PI / 180;
  const phi1 = lat1 * rad;
  const phi2 = lat2 * rad;
  const deltaLambda = (lng2 - lng1) * rad;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

/**
 * Calculates shortest angular difference in degrees (-180 to +180)
 */
export function angleDelta(fromDeg: number, toDeg: number): number {
  let diff = (toDeg - fromDeg) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

/**
 * Smoothly interpolates an angle from current to target
 */
export function interpolateAngle(fromDeg: number, toDeg: number, alpha: number): number {
  const delta = angleDelta(fromDeg, toDeg);
  return (fromDeg + delta * Math.max(0, Math.min(1, alpha)) + 360) % 360;
}

/**
 * Binary search to find point index where distFromStartKm <= targetDist
 */
function findSegmentIndex(points: GpxTrackPoint[], targetDist: number): number {
  let low = 0;
  let high = points.length - 2;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const d1 = points[mid].distFromStartKm ?? 0;
    const d2 = points[mid + 1].distFromStartKm ?? d1;

    if (targetDist >= d1 && targetDist <= d2) {
      return mid;
    }
    if (targetDist < d1) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return Math.max(0, Math.min(points.length - 2, low));
}

/**
 * Interpolates exact position, elevation, and heading along a route at progress ratio (0 to 1)
 */
export function getRoutePointAtProgress(
  routeData: Pick<GpxRouteData, 'points' | 'coordinates' | 'totalDistanceKm' | 'waypoints'>,
  progressRatio: number
): RouteProgressPoint {
  const points = routeData.points;
  const waypointsCount = Math.max(2, routeData.waypoints?.length || 2);
  const totalSegments = waypointsCount - 1;

  const clampedProgress = Math.max(0, Math.min(1, Number.isFinite(progressRatio) ? progressRatio : 0));
  const segmentIndex = Math.min(totalSegments - 1, Math.floor(clampedProgress * totalSegments));
  const segmentProgress = (clampedProgress * totalSegments) % 1;

  // Fallback if no points or only 1 point
  if (!points || points.length === 0) {
    const coord = routeData.coordinates?.[0] || [0, 0];
    return {
      lng: coord[0],
      lat: coord[1],
      bearing: 0,
      distFromStartKm: 0,
      segmentIndex,
      segmentProgress,
    };
  }

  if (points.length === 1) {
    return {
      lng: points[0].lng,
      lat: points[0].lat,
      ele: points[0].ele,
      bearing: 0,
      distFromStartKm: 0,
      segmentIndex,
      segmentProgress,
    };
  }

  const totalDist = Math.max(0.001, routeData.totalDistanceKm || points[points.length - 1].distFromStartKm || 1);
  const targetDist = clampedProgress * totalDist;

  // 1. Locate segment for current position
  const segIdx = findSegmentIndex(points, targetDist);
  const p1 = points[segIdx];
  const p2 = points[segIdx + 1];

  const d1 = p1.distFromStartKm ?? 0;
  const d2 = p2.distFromStartKm ?? d1;
  const segLen = d2 - d1;
  const frac = segLen > 0 ? Math.max(0, Math.min(1, (targetDist - d1) / segLen)) : 0;

  const curLng = p1.lng + frac * (p2.lng - p1.lng);
  const curLat = p1.lat + frac * (p2.lat - p1.lat);

  let curEle: number | undefined;
  if (p1.ele !== undefined && p2.ele !== undefined) {
    curEle = p1.ele + frac * (p2.ele - p1.ele);
  } else {
    curEle = p1.ele ?? p2.ele;
  }

  // 2. Calculate forward bearing using lookahead point for calm, smooth trajectory
  // Lookahead window is calibrated (0.5km to 2.5km, ~4% of total distance) to filter out
  // micro-switchbacks and GPS noise on real routes while capturing the overarching direction
  const lookaheadWindow = Math.max(0.5, Math.min(2.5, totalDist * 0.04));
  const lookaheadDist = Math.min(totalDist, targetDist + lookaheadWindow);
  let targetBearing = 0;

  if (lookaheadDist > targetDist + 0.0001) {
    const aheadIdx = findSegmentIndex(points, lookaheadDist);
    const ap1 = points[aheadIdx];
    const ap2 = points[aheadIdx + 1];
    const ad1 = ap1.distFromStartKm ?? 0;
    const ad2 = ap2.distFromStartKm ?? ad1;
    const aLen = ad2 - ad1;
    const aFrac = aLen > 0 ? Math.max(0, Math.min(1, (lookaheadDist - ad1) / aLen)) : 0;
    const aheadLng = ap1.lng + aFrac * (ap2.lng - ap1.lng);
    const aheadLat = ap1.lat + aFrac * (ap2.lat - ap1.lat);

    targetBearing = calculateBearing(curLng, curLat, aheadLng, aheadLat);
  } else {
    // Near or at finish: calculate bearing from behind point with matching smooth window
    const behindWindow = Math.max(0.3, Math.min(1.8, totalDist * 0.03));
    const behindDist = Math.max(0, targetDist - behindWindow);
    const bIdx = findSegmentIndex(points, behindDist);
    const bp1 = points[bIdx];
    const bp2 = points[bIdx + 1];
    const bd1 = bp1.distFromStartKm ?? 0;
    const bd2 = bp2.distFromStartKm ?? bd1;
    const bLen = bd2 - bd1;
    const bFrac = bLen > 0 ? Math.max(0, Math.min(1, (behindDist - bd1) / bLen)) : 0;
    const behindLng = bp1.lng + bFrac * (bp2.lng - bp1.lng);
    const behindLat = bp1.lat + bFrac * (bp2.lat - bp1.lat);

    targetBearing = calculateBearing(behindLng, behindLat, curLng, curLat);
  }

  return {
    lng: curLng,
    lat: curLat,
    ele: curEle !== undefined ? Math.round(curEle) : undefined,
    bearing: Math.round(targetBearing),
    distFromStartKm: Math.round(targetDist * 100) / 100,
    segmentIndex,
    segmentProgress,
  };
}

/**
 * Fast lookup for elevation from route data (waypoints or track points) given (lng, lat)
 */
export function findNearestElevation(
  lng: number,
  lat: number,
  routeData: Pick<GpxRouteData, 'waypoints' | 'points'> | null | undefined,
  maxToleranceDegrees: number = 0.01
): number | null {
  if (!routeData) return null;

  // 1. First check waypoints (most relevant for pin placement)
  if (routeData.waypoints && routeData.waypoints.length > 0) {
    for (const wpt of routeData.waypoints) {
      if (wpt.ele !== undefined && Number.isFinite(wpt.ele)) {
        const dLng = Math.abs(wpt.lng - lng);
        const dLat = Math.abs(wpt.lat - lat);
        if (dLng < maxToleranceDegrees && dLat < maxToleranceDegrees) {
          return wpt.ele;
        }
      }
    }
  }

  // 2. Fall back to track points
  if (routeData.points && routeData.points.length > 0) {
    let bestDistSq = maxToleranceDegrees * maxToleranceDegrees;
    let bestEle: number | null = null;
    for (const pt of routeData.points) {
      if (pt.ele !== undefined && Number.isFinite(pt.ele)) {
        const dLng = pt.lng - lng;
        const dLat = pt.lat - lat;
        const distSq = dLng * dLng + dLat * dLat;
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestEle = pt.ele;
        }
      }
    }
    if (bestEle !== null) return bestEle;
  }

  return null;
}

