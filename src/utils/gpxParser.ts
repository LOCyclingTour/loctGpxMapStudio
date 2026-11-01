/**
 * GPX Parser & Geodetic calculations
 * Works in both browser (DOMParser) and Node.js test environment (regex fallback)
 */

export interface GpxTrackPoint {
  lat: number;
  lng: number;
  ele?: number;
  time?: string;
  distFromStartKm?: number;
}

export interface GpxWaypoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  ele?: number;
  desc?: string;
  cmt?: string;
  sym?: string;
  imageUrl?: string;
}

export interface GpxRouteData {
  name: string;
  description?: string;
  author?: string;
  points: GpxTrackPoint[];
  coordinates: [number, number][]; // [lng, lat] for MapLibre & GeoJSON
  waypoints: GpxWaypoint[];
  bounds: [[number, number], [number, number]]; // [[minLng, minLat], [maxLng, maxLat]]
  totalDistanceKm: number;
  totalDistanceMiles: number;
  elevationGainM: number;
  elevationLossM: number;
  minElevationM: number;
  maxElevationM: number;
  durationSeconds?: number;
  formattedDuration?: string;
}

/**
 * Calculates haversine distance in kilometers between two lat/lng coordinates
 */
export function calculateHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extracts image url if present in link, sym, or desc
 */
export function extractImageUrl(
  linkHref?: string,
  desc?: string,
  sym?: string
): string | undefined {
  if (linkHref && /\.(jpe?g|png|webp|gif|svg|avif)($|\?)/i.test(linkHref)) {
    return linkHref;
  }
  if (linkHref && (linkHref.startsWith('http://') || linkHref.startsWith('https://'))) {
    return linkHref;
  }

  const findImgUrl = (text?: string): string | undefined => {
    if (!text) return undefined;
    const match = text.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif|svg)/i);
    return match ? match[0] : undefined;
  };

  return findImgUrl(desc) || findImgUrl(sym);
}

/**
 * Formats seconds into human-readable duration (e.g. 2h 45m or 42m)
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0 || !Number.isFinite(seconds)) return '--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Parses raw GPX XML string into structured GpxRouteData
 */
export function parseGpx(xmlString: string): GpxRouteData {
  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    return parseGpxWithDOM(xmlString);
  }
  return parseGpxWithRegex(xmlString);
}

/**
 * Browser DOMParser implementation
 */
function parseGpxWithDOM(xmlString: string): GpxRouteData {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, 'application/xml');

  // Track name
  const nameEl = xml.querySelector('trk > name, rte > name, metadata > name');
  const name = nameEl?.textContent?.trim() || 'Custom GPX Route';

  const descEl = xml.querySelector('trk > desc, rte > desc, metadata > desc');
  const description = descEl?.textContent?.trim() || '';

  const authorEl = xml.querySelector('metadata > author > name');
  const author = authorEl?.textContent?.trim() || '';

  // Extract track points (trkpt or rtept)
  let ptElements = Array.from(xml.querySelectorAll('trkpt'));
  if (ptElements.length === 0) {
    ptElements = Array.from(xml.querySelectorAll('rtept'));
  }

  const rawPoints: GpxTrackPoint[] = [];
  for (const el of ptElements) {
    const lat = parseFloat(el.getAttribute('lat') || 'NaN');
    const lon = parseFloat(el.getAttribute('lon') || 'NaN');
    if (isNaN(lat) || isNaN(lon)) continue;

    const eleEl = el.querySelector('ele');
    const timeEl = el.querySelector('time');

    const ele = eleEl && eleEl.textContent ? parseFloat(eleEl.textContent) : undefined;
    const time = timeEl?.textContent?.trim() || undefined;

    rawPoints.push({
      lat,
      lng: lon,
      ele: ele !== undefined && !isNaN(ele) ? ele : undefined,
      time,
    });
  }

  // Extract waypoints (wpt)
  const wptElements = Array.from(xml.querySelectorAll('wpt'));
  const waypoints: GpxWaypoint[] = [];

  wptElements.forEach((el, index) => {
    const lat = parseFloat(el.getAttribute('lat') || 'NaN');
    const lon = parseFloat(el.getAttribute('lon') || 'NaN');
    if (isNaN(lat) || isNaN(lon)) return;

    const wName = el.querySelector('name')?.textContent?.trim() || `Waypoint ${index + 1}`;
    const eleEl = el.querySelector('ele');
    const wEle = eleEl && eleEl.textContent ? parseFloat(eleEl.textContent) : undefined;
    const wDesc = el.querySelector('desc')?.textContent?.trim() || undefined;
    const wCmt = el.querySelector('cmt')?.textContent?.trim() || undefined;
    const wSym = el.querySelector('sym')?.textContent?.trim() || undefined;

    const linkEl = el.querySelector('link');
    const linkHref = linkEl?.getAttribute('href') || linkEl?.textContent?.trim() || undefined;

    const imageUrl = extractImageUrl(linkHref, wDesc, wSym);

    waypoints.push({
      id: `wpt-${index + 1}`,
      lat,
      lng: lon,
      name: wName,
      ele: wEle !== undefined && !isNaN(wEle) ? wEle : undefined,
      desc: wDesc,
      cmt: wCmt,
      sym: wSym,
      imageUrl,
    });
  });

  return computeRouteMetrics(name, description, author, rawPoints, waypoints);
}

/**
 * Regex-based parser for Node testing & environments without DOMParser
 */
function parseGpxWithRegex(xmlString: string): GpxRouteData {
  const nameMatch = xmlString.match(/<trk>[\s\S]*?<name>(.*?)<\/name>/i) ||
                    xmlString.match(/<metadata>[\s\S]*?<name>(.*?)<\/name>/i) ||
                    xmlString.match(/<name>(.*?)<\/name>/i);
  const name = nameMatch ? nameMatch[1].trim() : 'Custom GPX Route';

  const descMatch = xmlString.match(/<desc>(.*?)<\/desc>/i);
  const description = descMatch ? descMatch[1].trim() : '';

  const rawPoints: GpxTrackPoint[] = [];
  const trkptRegex = /<(?:trkpt|rtept)\s+lat=["']([-0-9.]+)["']\s+lon=["']([-0-9.]+)["'][^>]*>([\s\S]*?)<\/(?:trkpt|rtept)>/gi;
  let match: RegExpExecArray | null;

  while ((match = trkptRegex.exec(xmlString)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    const inner = match[3];

    const eleMatch = inner.match(/<ele>([-0-9.]+)<\/ele>/i);
    const timeMatch = inner.match(/<time>(.*?)<\/time>/i);

    const ele = eleMatch ? parseFloat(eleMatch[1]) : undefined;
    const time = timeMatch ? timeMatch[1].trim() : undefined;

    if (!isNaN(lat) && !isNaN(lng)) {
      rawPoints.push({ lat, lng, ele, time });
    }
  }

  // Fallback for self-closing trkpt tags
  if (rawPoints.length === 0) {
    const selfClosingRegex = /<(?:trkpt|rtept)\s+lat=["']([-0-9.]+)["']\s+lon=["']([-0-9.]+)["'][^>]*\/>/gi;
    while ((match = selfClosingRegex.exec(xmlString)) !== null) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        rawPoints.push({ lat, lng });
      }
    }
  }

  // Extract waypoints
  const waypoints: GpxWaypoint[] = [];
  const wptRegex = /<wpt\s+lat=["']([-0-9.]+)["']\s+lon=["']([-0-9.]+)["'][^>]*>([\s\S]*?)<\/wpt>/gi;
  let wptIndex = 1;
  while ((match = wptRegex.exec(xmlString)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    const inner = match[3];

    const wNameMatch = inner.match(/<name>(.*?)<\/name>/i);
    const wEleMatch = inner.match(/<ele>([-0-9.]+)<\/ele>/i);
    const wDescMatch = inner.match(/<desc>(.*?)<\/desc>/i);
    const wCmtMatch = inner.match(/<cmt>(.*?)<\/cmt>/i);
    const wSymMatch = inner.match(/<sym>(.*?)<\/sym>/i);
    const linkMatch = inner.match(/<link\s+href=["']([^"']+)["']/i);

    const wName = wNameMatch ? wNameMatch[1].trim() : `Waypoint ${wptIndex}`;
    const wEle = wEleMatch ? parseFloat(wEleMatch[1]) : undefined;
    const wDesc = wDescMatch ? wDescMatch[1].trim() : undefined;
    const wCmt = wCmtMatch ? wCmtMatch[1].trim() : undefined;
    const wSym = wSymMatch ? wSymMatch[1].trim() : undefined;
    const linkHref = linkMatch ? linkMatch[1].trim() : undefined;

    const imageUrl = extractImageUrl(linkHref, wDesc, wSym);

    waypoints.push({
      id: `wpt-${wptIndex++}`,
      lat,
      lng,
      name: wName,
      ele: wEle,
      desc: wDesc,
      cmt: wCmt,
      sym: wSym,
      imageUrl,
    });
  }

  return computeRouteMetrics(name, description, '', rawPoints, waypoints);
}

/**
 * Computes distances, bounds, elevation statistics, and duration
 */
function computeRouteMetrics(
  name: string,
  description: string,
  author: string,
  rawPoints: GpxTrackPoint[],
  waypoints: GpxWaypoint[]
): GpxRouteData {
  if (rawPoints.length === 0) {
    // If no trackpoints but waypoints exist, construct route from waypoints
    if (waypoints.length > 0) {
      waypoints.forEach((w) => {
        rawPoints.push({ lat: w.lat, lng: w.lng, ele: w.ele });
      });
    } else {
      return {
        name,
        description,
        author,
        points: [],
        coordinates: [],
        waypoints: [],
        bounds: [
          [-180, -90],
          [180, 90],
        ],
        totalDistanceKm: 0,
        totalDistanceMiles: 0,
        elevationGainM: 0,
        elevationLossM: 0,
        minElevationM: 0,
        maxElevationM: 0,
      };
    }
  }

  let totalDistanceKm = 0;
  let minLng = rawPoints[0].lng;
  let maxLng = rawPoints[0].lng;
  let minLat = rawPoints[0].lat;
  let maxLat = rawPoints[0].lat;

  let minEle = rawPoints[0].ele ?? 0;
  let maxEle = rawPoints[0].ele ?? 0;
  let elevationGainM = 0;
  let elevationLossM = 0;

  let hasElevations = rawPoints.some((p) => p.ele !== undefined);
  if (hasElevations) {
    const validEles = rawPoints.map((p) => p.ele).filter((e): e is number => e !== undefined);
    if (validEles.length > 0) {
      minEle = Math.min(...validEles);
      maxEle = Math.max(...validEles);
    }
  }

  const coordinates: [number, number][] = [];
  rawPoints[0].distFromStartKm = 0;
  coordinates.push([rawPoints[0].lng, rawPoints[0].lat]);

  for (let i = 0; i < rawPoints.length - 1; i++) {
    const p1 = rawPoints[i];
    const p2 = rawPoints[i + 1];

    minLng = Math.min(minLng, p2.lng);
    maxLng = Math.max(maxLng, p2.lng);
    minLat = Math.min(minLat, p2.lat);
    maxLat = Math.max(maxLat, p2.lat);

    const segDist = calculateHaversineKm(p1.lat, p1.lng, p2.lat, p2.lng);
    totalDistanceKm += segDist;
    p2.distFromStartKm = totalDistanceKm;

    coordinates.push([p2.lng, p2.lat]);

    if (p1.ele !== undefined && p2.ele !== undefined) {
      const dEle = p2.ele - p1.ele;
      // Filter out tiny GPS elevation jitter (< 1.5m threshold)
      if (dEle > 1.5) {
        elevationGainM += dEle;
      } else if (dEle < -1.5) {
        elevationLossM += Math.abs(dEle);
      }
    }
  }

  // Include waypoints in bounding box
  for (const w of waypoints) {
    minLng = Math.min(minLng, w.lng);
    maxLng = Math.max(maxLng, w.lng);
    minLat = Math.min(minLat, w.lat);
    maxLat = Math.max(maxLat, w.lat);
  }

  // Calculate duration if timestamps exist
  let durationSeconds: number | undefined;
  const firstTime = rawPoints[0]?.time;
  const lastTime = rawPoints[rawPoints.length - 1]?.time;
  if (firstTime && lastTime) {
    const t0 = new Date(firstTime).getTime();
    const t1 = new Date(lastTime).getTime();
    if (!isNaN(t0) && !isNaN(t1) && t1 > t0) {
      durationSeconds = Math.round((t1 - t0) / 1000);
    }
  }

  // If no time is in GPX, estimate moving time at average hike/ride speed (e.g. 15 km/h for bike or 4.5 km/h for hike)
  if (!durationSeconds && totalDistanceKm > 0) {
    const estimatedHours = totalDistanceKm / 12; // 12 km/h average
    durationSeconds = Math.round(estimatedHours * 3600);
  }

  return {
    name,
    description,
    author,
    points: rawPoints,
    coordinates,
    waypoints,
    bounds: [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    totalDistanceMiles: Math.round(totalDistanceKm * 0.621371 * 100) / 100,
    elevationGainM: Math.round(elevationGainM),
    elevationLossM: Math.round(elevationLossM),
    minElevationM: Math.round(minEle),
    maxElevationM: Math.round(maxEle),
    durationSeconds,
    formattedDuration: durationSeconds ? formatDuration(durationSeconds) : undefined,
  };
}
