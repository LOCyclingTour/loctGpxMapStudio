import { GpxRouteData, GpxWaypoint } from './gpxParser';

export type WaypointDisplayMode = 'name' | 'index' | 'both';
export type WaypointPinStyle = 'badge' | 'classic' | 'minimal';
export type WaypointPinSize = 'small' | 'medium' | 'large';

export interface WaypointPinSettings {
  displayMode: WaypointDisplayMode;
  approachReveal: boolean;
  approachDistanceKm: number; // e.g. 0.8 km
  pinStyle: WaypointPinStyle;
  pinSize: WaypointPinSize;
  showElevation: boolean;
  stayVisibleAfterArrival: boolean;
}

export const DEFAULT_WAYPOINT_PIN_SETTINGS: WaypointPinSettings = {
  displayMode: 'name',
  approachReveal: true,
  approachDistanceKm: 0.8,
  pinStyle: 'badge',
  pinSize: 'medium',
  showElevation: true,
  stayVisibleAfterArrival: true,
};

export interface WaypointProgressInfo {
  id: string;
  name: string;
  lat: number;
  lng: number;
  ele?: number;
  distFromStartKm: number;
  progressRatio: number;
}

/**
 * Computes the route progress and distance along track for each waypoint
 */
export function computeWaypointsRouteProgress(
  routeData: GpxRouteData | null
): Map<string, WaypointProgressInfo> {
  const result = new Map<string, WaypointProgressInfo>();
  if (!routeData || !routeData.waypoints || routeData.waypoints.length === 0) {
    return result;
  }

  const points = routeData.points;
  const totalDistanceKm = Math.max(0.001, routeData.totalDistanceKm || 1);

  routeData.waypoints.forEach((wpt, index) => {
    // If no track points, estimate progress evenly
    if (!points || points.length === 0) {
      const p = routeData.waypoints.length > 1 ? index / (routeData.waypoints.length - 1) : 0;
      result.set(wpt.id, {
        id: wpt.id,
        name: wpt.name,
        lat: wpt.lat,
        lng: wpt.lng,
        ele: wpt.ele,
        distFromStartKm: p * totalDistanceKm,
        progressRatio: p,
      });
      return;
    }

    // Find the track point that minimizes distance to the waypoint
    let bestDistSq = Infinity;
    let bestPoint = points[0];

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const dLat = pt.lat - wpt.lat;
      const dLng = pt.lng - wpt.lng;
      const distSq = dLat * dLat + dLng * dLng;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestPoint = pt;
      }
    }

    const distFromStartKm = bestPoint.distFromStartKm !== undefined
      ? bestPoint.distFromStartKm
      : 0;
    const progressRatio = Math.max(0, Math.min(1, distFromStartKm / totalDistanceKm));

    result.set(wpt.id, {
      id: wpt.id,
      name: wpt.name,
      lat: wpt.lat,
      lng: wpt.lng,
      ele: wpt.ele,
      distFromStartKm,
      progressRatio,
    });
  });

  return result;
}

/**
 * Determines whether a waypoint should be revealed or highlighted given current route progress
 */
export function getWaypointApproachStatus(
  currentProgress: number,
  wptDistFromStartKm: number,
  totalDistanceKm: number,
  approachDistanceKm: number = 0.8,
  stayVisible: boolean = true
): { isRevealed: boolean; isActiveArrival: boolean; isPassed: boolean } {
  const totalDist = Math.max(0.001, totalDistanceKm);
  const currentDist = Math.max(0, Math.min(1, currentProgress)) * totalDist;
  const approachThreshold = Math.max(0.1, approachDistanceKm);
  const arrivalHalfWindow = Math.min(0.35, approachThreshold * 0.4);

  const delta = wptDistFromStartKm - currentDist;

  const isApproaching = delta <= approachThreshold;
  const isPassed = delta < -arrivalHalfWindow;
  const isActiveArrival = isApproaching && !isPassed && Math.abs(delta) <= arrivalHalfWindow;

  let isRevealed = false;
  if (stayVisible) {
    // Once approached, it remains revealed
    isRevealed = currentDist >= (wptDistFromStartKm - approachThreshold);
  } else {
    isRevealed = isApproaching && delta >= -approachThreshold * 0.8;
  }

  return { isRevealed, isActiveArrival, isPassed };
}
