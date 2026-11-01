/**
 * Video Exporter utilities and canvas compositing helpers
 */

export interface ExportResolution {
  id: '4k' | '1080p' | '720p' | 'vertical-4k' | 'vertical' | 'square';
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
  bitrate?: number;
  badge?: string;
}

export const VIDEO_RESOLUTIONS: ExportResolution[] = [
  { id: '4k', label: '4K Ultra HD (16:9)', width: 3840, height: 2160, aspectRatio: '16:9', bitrate: 35000000, badge: '4K ULTRA' },
  { id: '1080p', label: '1080p Full HD (16:9)', width: 1920, height: 1080, aspectRatio: '16:9', bitrate: 16000000, badge: 'FHD' },
  { id: 'vertical-4k', label: '4K Vertical Reel (9:16)', width: 2160, height: 3840, aspectRatio: '9:16', bitrate: 35000000, badge: '4K REEL' },
  { id: 'vertical', label: '1080p Vertical Reel (9:16)', width: 1080, height: 1920, aspectRatio: '9:16', bitrate: 16000000, badge: 'REEL' },
  { id: '720p', label: '720p HD (16:9)', width: 1280, height: 720, aspectRatio: '16:9', bitrate: 8000000 },
  { id: 'square', label: 'Square Post (1:1)', width: 1080, height: 1080, aspectRatio: '1:1', bitrate: 12000000 },
];

export interface VideoExportConfig {
  resolutionId: '4k' | '1080p' | '720p' | 'vertical-4k' | 'vertical' | 'square';
  durationSeconds: number; // 10, 15, 20, 30
  fps: number; // 30 or 60
  includeOverlay: boolean;
  quality: 'high' | 'medium';
}

/**
 * Calculates total frames to capture
 */
export function calculateTotalFrames(durationSeconds: number, fps: number): number {
  return Math.max(1, Math.round(durationSeconds * fps));
}

/**
 * Waits for MapLibre map to finish loading tiles and rendering the current frame to the WebGL canvas.
 * This guarantees pristine terrain, vector tiles, and satellite imagery without blank tiles or stutter.
 */
export async function waitForMapFrame(
  map: any,
  maxWaitMs: number = 1000
): Promise<{ waitedMs: number; tilesLoaded: boolean }> {
  if (!map) return { waitedMs: 0, tilesLoaded: true };

  const startTime = Date.now();

  return new Promise((resolve) => {
    let resolved = false;

    const finish = (tilesLoaded: boolean) => {
      if (resolved) return;
      resolved = true;

      // Ensure the browser renders the painted WebGL backbuffer to the DOM canvas
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve({
            waitedMs: Date.now() - startTime,
            tilesLoaded,
          });
        });
      });
    };

    // Failsafe timeout so export never hangs indefinitely if a single tile is slow or 404
    const timer = setTimeout(() => {
      finish(map.areTilesLoaded?.() ?? true);
    }, maxWaitMs);

    // If tiles are already fully loaded, trigger a repaint and resolve as soon as render completes
    if (map.areTilesLoaded?.() && map.loaded?.()) {
      map.triggerRepaint?.();
      map.once('render', () => {
        clearTimeout(timer);
        finish(true);
      });
      return;
    }

    // If tiles are still loading, wait for the 'idle' event (all visible tiles downloaded & rendered)
    const onIdle = () => {
      clearTimeout(timer);
      finish(true);
    };

    map.once('idle', onIdle);
    map.triggerRepaint?.();
  });
}

/**
 * Finds the best supported video MIME type in the current browser
 */
export function getSupportedVideoMimeType(): { mimeType: string; extension: string } {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { mimeType: 'video/webm', extension: 'webm' };
  }

  const candidateTypes = [
    { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];

  for (const item of candidateTypes) {
    if (MediaRecorder.isTypeSupported(item.mime)) {
      return { mimeType: item.mime, extension: item.ext };
    }
  }

  return { mimeType: 'video/webm', extension: 'webm' };
}

/**
 * Generates video export filename
 */
export function generateVideoFileName(routeName: string, resId: string, ext: string): string {
  const sanitized = routeName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'route';
  return `${sanitized}_loct_${resId}.${ext}`;
}

export interface TvBannerPartsConfig {
  showBadge: boolean;
  showTitle: boolean;
  showSubtitle: boolean;
  showTelemetry: boolean;
  showLiveTag: boolean;
  showProgressBar: boolean;
  showAccentBar: boolean;
}

export const DEFAULT_TV_BANNER_PARTS: TvBannerPartsConfig = {
  showBadge: true,
  showTitle: true,
  showSubtitle: true,
  showTelemetry: true,
  showLiveTag: true,
  showProgressBar: true,
  showAccentBar: true,
};

export type ElevationOverlayPosition = 'bottom-right' | 'above-tv' | 'bottom-center' | 'top-right';

/**
 * Composites the TV Lower-Third broadcast graphic directly onto a 2D canvas with customizable parts
 */
export function drawTvBroadcastCardOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  subtitle: string,
  accentColor: string,
  progressRatio: number,
  is3d: boolean = false,
  bannerParts: TvBannerPartsConfig = DEFAULT_TV_BANNER_PARTS,
  cameraAltitudeMeters?: number,
  routeStats?: { distanceKm: number; gainM: number; duration?: string; waypointsCount: number; maxElevM?: number; statusBadgeText?: string; stageName?: string }
): { cardX: number; cardY: number; cardWidth: number; cardHeight: number } {
  // If no parts are enabled, don't draw anything
  const hasAnyPart = Object.values(bannerParts).some(Boolean);
  if (!hasAnyPart) {
    return { cardX: 0, cardY: height, cardWidth: 0, cardHeight: 0 };
  }

  ctx.save();

  // Scale dimensions relative to 1080p
  const scale = width / 1920;
  const cardWidth = Math.min(width * 0.58, 800 * scale);
  const borderRadius = 14 * scale;

  // Calculate dynamic card height depending on which parts are visible
  let innerHeight = 20 * scale; // base padding top & bottom
  if (bannerParts.showBadge) innerHeight += 26 * scale;
  if (bannerParts.showTitle) innerHeight += 38 * scale;
  if (bannerParts.showSubtitle) innerHeight += 24 * scale;
  if (bannerParts.showTelemetry) innerHeight += 48 * scale;
  if (bannerParts.showProgressBar) innerHeight += 12 * scale;

  const cardHeight = Math.max(50 * scale, innerHeight);
  const cardX = 40 * scale;
  const cardY = height - cardHeight - 40 * scale;

  // Background panel with dark broadcast translucency
  ctx.fillStyle = 'rgba(10, 10, 10, 0.90)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 25 * scale;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 10 * scale;

  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, borderRadius);
  ctx.fill();

  // Border outline
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();

  // Left accent color bar with glow
  const barWidth = bannerParts.showAccentBar ? 10 * scale : 0;
  if (bannerParts.showAccentBar) {
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, barWidth, cardHeight, [borderRadius, 0, 0, borderRadius]);
    ctx.fill();
  }

  const textLeft = cardX + barWidth + (bannerParts.showAccentBar ? 22 * scale : 20 * scale);
  let cursorY = cardY + 16 * scale;

  // 1. Stage Badge & 3D Tag
  if (bannerParts.showBadge) {
    ctx.fillStyle = accentColor;
    const badgeLabel = routeStats?.statusBadgeText || routeStats?.stageName || 'LOCT GPX STAGE';
    ctx.font = `bold ${Math.round(10 * scale)}px monospace`;
    const textMeasure = ctx.measureText ? ctx.measureText(badgeLabel).width : 100 * scale;
    const badgeWidth = Math.max(118 * scale, textMeasure + 16 * scale);
    const badgeHeight = 20 * scale;
    ctx.beginPath();
    ctx.roundRect(textLeft, cursorY, badgeWidth, badgeHeight, 4 * scale);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.fillText(badgeLabel, textLeft + 8 * scale, cursorY + 14 * scale);

    if (is3d) {
      const d3X = textLeft + badgeWidth + 8 * scale;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.beginPath();
      ctx.roundRect(d3X, cursorY, 82 * scale, badgeHeight, 4 * scale);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.font = `bold ${Math.round(9 * scale)}px monospace`;
      ctx.fillText('3D TERRAIN', d3X + 7 * scale, cursorY + 14 * scale);
    }

    // Live Red Telecast Indicator / Live Tag
    if (bannerParts.showLiveTag) {
      const rightTagX = cardX + cardWidth - 115 * scale;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(rightTagX, cursorY + 10 * scale, 4 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ef4444';
      ctx.font = `bold ${Math.round(10 * scale)}px monospace`;
      ctx.fillText('LIVE TELECAST', rightTagX + 10 * scale, cursorY + 14 * scale);
    }

    cursorY += 26 * scale;
  } else if (bannerParts.showLiveTag) {
    // Show live tag alone in top-right if badge is off
    const rightTagX = cardX + cardWidth - 115 * scale;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(rightTagX, cursorY + 10 * scale, 4 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.font = `bold ${Math.round(10 * scale)}px monospace`;
    ctx.fillText('LIVE TELECAST', rightTagX + 10 * scale, cursorY + 14 * scale);
  }

  // 2. Bold Title
  if (bannerParts.showTitle) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(24 * scale)}px 'Inter', sans-serif`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6 * scale;
    cursorY += 22 * scale;
    ctx.fillText(title.toUpperCase(), textLeft, cursorY);
    ctx.shadowColor = 'transparent';
    cursorY += 10 * scale;
  }

  // 3. Subtitle / Summary Stats
  if (bannerParts.showSubtitle) {
    ctx.fillStyle = '#d1d5db';
    ctx.font = `600 ${Math.round(12.5 * scale)}px 'Inter', sans-serif`;
    cursorY += 14 * scale;
    ctx.fillText(subtitle, textLeft, cursorY);
    cursorY += 8 * scale;
  }

  // 4. Telemetry Stat Grid (Distance, Elev Gain, Duration, Points)
  if (bannerParts.showTelemetry && routeStats) {
    cursorY += 10 * scale;
    // Thin divider line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(textLeft, cursorY);
    ctx.lineTo(cardX + cardWidth - 20 * scale, cursorY);
    ctx.stroke();

    cursorY += 16 * scale;
    const colWidth = (cardWidth - barWidth - 60 * scale) / 4;

    const stats = [
      { label: 'DISTANCE', val: `${routeStats.distanceKm} km`, color: '#ffffff' },
      { label: 'ELEV GAIN', val: `+${routeStats.gainM} m`, color: '#f59e0b' },
      { label: 'EST. TIME', val: routeStats.duration || '--', color: '#e5e7eb' },
      { label: 'PINS / WP', val: `${routeStats.waypointsCount} pts`, color: '#06b6d4' },
    ];

    stats.forEach((st, i) => {
      const colX = textLeft + i * colWidth;
      ctx.fillStyle = '#9ca3af';
      ctx.font = `bold ${Math.round(8.5 * scale)}px monospace`;
      ctx.fillText(st.label, colX, cursorY);

      ctx.fillStyle = st.color;
      ctx.font = `bold ${Math.round(12 * scale)}px monospace`;
      ctx.fillText(st.val, colX, cursorY + 14 * scale);
    });

    cursorY += 20 * scale;
  }

  // 5. Dynamic Route Progress Scrub Bar at bottom of card
  if (bannerParts.showProgressBar) {
    const barY = cardY + cardHeight - 8 * scale;
    const barW = cardWidth - barWidth - 36 * scale;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.roundRect(textLeft, barY, barW, 4 * scale, 2 * scale);
    ctx.fill();

    // Active progress fill
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.roundRect(
      textLeft,
      barY,
      Math.max(4 * scale, barW * Math.min(1, Math.max(0, progressRatio))),
      4 * scale,
      2 * scale
    );
    ctx.fill();
  }

  ctx.restore();

  return { cardX, cardY, cardWidth, cardHeight };
}

/**
 * Composites the Elevation Profile HUD directly onto the export canvas
 */
export function drawElevationProfileOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  routeData: {
    points: { lat: number; lng: number; ele?: number; distFromStartKm?: number }[];
    totalDistanceKm: number;
    elevationGainM: number;
    elevationLossM?: number;
    minElevationM: number;
    maxElevationM: number;
  },
  accentColor: string,
  progressRatio: number,
  position: ElevationOverlayPosition = 'bottom-right',
  tvCardInfo?: { cardX: number; cardY: number; cardWidth: number; cardHeight: number }
): void {
  // Need points with elevation data
  const validPoints = routeData.points.filter((p) => p.ele !== undefined);
  if (validPoints.length < 2) return;

  ctx.save();

  const scale = width / 1920;
  const cardWidth = Math.min(width * 0.44, 560 * scale);
  const cardHeight = 168 * scale;
  const borderRadius = 14 * scale;

  // Determine HUD coordinates based on position
  let cardX = width - cardWidth - 40 * scale;
  let cardY = height - cardHeight - 40 * scale;

  if (position === 'above-tv' && tvCardInfo && tvCardInfo.cardHeight > 0) {
    cardX = tvCardInfo.cardX;
    cardY = tvCardInfo.cardY - cardHeight - 14 * scale;
  } else if (position === 'bottom-center') {
    cardX = (width - cardWidth) / 2;
    cardY = height - cardHeight - 40 * scale;
  } else if (position === 'top-right') {
    cardX = width - cardWidth - 40 * scale;
    cardY = 40 * scale;
  }

  // Background panel with dark broadcast translucency
  ctx.fillStyle = 'rgba(10, 10, 10, 0.90)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 25 * scale;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 10 * scale;

  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, borderRadius);
  ctx.fill();

  // Border outline
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();

  // Header: Title & Elevation Range
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(11 * scale)}px monospace`;
  ctx.fillText('▲ ELEVATION PROFILE', cardX + 18 * scale, cardY + 22 * scale);

  ctx.fillStyle = '#9ca3af';
  ctx.font = `${Math.round(10 * scale)}px monospace`;
  const rangeText = `${routeData.minElevationM}m – ${routeData.maxElevationM}m (Gain +${routeData.elevationGainM}m)`;
  const rangeMetrics = ctx.measureText(rangeText);
  ctx.fillText(rangeText, cardX + cardWidth - rangeMetrics.width - 18 * scale, cardY + 22 * scale);

  // Chart Inner Plot Area
  const chartX = cardX + 18 * scale;
  const chartY = cardY + 36 * scale;
  const chartW = cardWidth - 36 * scale;
  const chartH = 88 * scale;

  // Horizontal Grid Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1 * scale;
  ctx.setLineDash([4 * scale, 4 * scale]);
  [0.25, 0.5, 0.75].forEach((pct) => {
    const gy = chartY + chartH * pct;
    ctx.beginPath();
    ctx.moveTo(chartX, gy);
    ctx.lineTo(chartX + chartW, gy);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Sample points to ~100 for clean rendering
  const sampleTarget = 100;
  const step = Math.max(1, Math.floor(validPoints.length / sampleTarget));
  const sampled: { dist: number; ele: number }[] = [];

  for (let i = 0; i < validPoints.length; i += step) {
    sampled.push({
      dist: validPoints[i].distFromStartKm ?? 0,
      ele: validPoints[i].ele ?? routeData.minElevationM,
    });
  }
  const lastPt = validPoints[validPoints.length - 1];
  sampled.push({
    dist: lastPt.distFromStartKm ?? routeData.totalDistanceKm,
    ele: lastPt.ele ?? routeData.minElevationM,
  });

  const totalDist = Math.max(0.1, routeData.totalDistanceKm || sampled[sampled.length - 1].dist || 1);
  const eleRange = Math.max(1, routeData.maxElevationM - routeData.minElevationM);

  const plotPoints = sampled.map((p) => {
    const px = chartX + (p.dist / totalDist) * chartW;
    const py = chartY + chartH - ((p.ele - routeData.minElevationM) / eleRange) * (chartH - 8 * scale);
    return { x: px, y: py, ele: p.ele, dist: p.dist };
  });

  // Fill gradient area below the line
  if (plotPoints.length > 1) {
    const grad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
    grad.addColorStop(0, `${accentColor}70`); // 44% opacity
    grad.addColorStop(1, `${accentColor}05`); // transparent fade

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(plotPoints[0].x, chartY + chartH);
    plotPoints.forEach((pt) => {
      ctx.lineTo(pt.x, pt.y);
    });
    ctx.lineTo(plotPoints[plotPoints.length - 1].x, chartY + chartH);
    ctx.closePath();
    ctx.fill();

    // Polyline stroke
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5 * scale;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(plotPoints[0].x, plotPoints[0].y);
    for (let i = 1; i < plotPoints.length; i++) {
      ctx.lineTo(plotPoints[i].x, plotPoints[i].y);
    }
    ctx.stroke();
  }

  // Dynamic Current Position Needle & Current Altitude Tag
  const clampedProgress = Math.min(1, Math.max(0, progressRatio));
  const currentDist = clampedProgress * totalDist;
  const currentNeedleX = chartX + clampedProgress * chartW;

  // Find or interpolate current elevation
  let currentElevation = routeData.minElevationM;
  for (let i = 0; i < plotPoints.length - 1; i++) {
    const p1 = plotPoints[i];
    const p2 = plotPoints[i + 1];
    if (currentDist >= p1.dist && currentDist <= p2.dist) {
      const segSpan = p2.dist - p1.dist;
      const t = segSpan > 0 ? (currentDist - p1.dist) / segSpan : 0;
      currentElevation = Math.round(p1.ele + t * (p2.ele - p1.ele));
      break;
    }
  }

  const currentNeedleY = chartY + chartH - ((currentElevation - routeData.minElevationM) / eleRange) * (chartH - 8 * scale);

  // Vertical needle indicator line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.5 * scale;
  ctx.setLineDash([3 * scale, 3 * scale]);
  ctx.beginPath();
  ctx.moveTo(currentNeedleX, chartY);
  ctx.lineTo(currentNeedleX, chartY + chartH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Glowing point on profile curve
  ctx.fillStyle = accentColor;
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 8 * scale;
  ctx.beginPath();
  ctx.arc(currentNeedleX, currentNeedleY, 5 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.arc(currentNeedleX, currentNeedleY, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Floating Altitude Badge over needle
  const altTagText = `${currentElevation}m`;
  ctx.font = `bold ${Math.round(9.5 * scale)}px monospace`;
  const tagMetrics = ctx.measureText(altTagText);
  const tagW = tagMetrics.width + 12 * scale;
  const tagH = 17 * scale;
  let tagX = currentNeedleX - tagW / 2;
  tagX = Math.max(chartX, Math.min(chartX + chartW - tagW, tagX));
  const tagY = Math.max(cardY + 8 * scale, currentNeedleY - tagH - 6 * scale);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.roundRect(tagX, tagY, tagW, tagH, 3 * scale);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(altTagText, tagX + 6 * scale, tagY + 12 * scale);

  // Bottom Axis Labels
  const bottomLabelY = cardY + cardHeight - 12 * scale;
  ctx.fillStyle = '#9ca3af';
  ctx.font = `${Math.round(9 * scale)}px monospace`;
  ctx.fillText('0.0 KM', chartX, bottomLabelY);

  const midDistText = `CURRENT: ${currentDist.toFixed(1)} KM`;
  const midMetrics = ctx.measureText(midDistText);
  ctx.fillStyle = accentColor;
  ctx.fillText(midDistText, cardX + (cardWidth - midMetrics.width) / 2, bottomLabelY);

  const endDistText = `${totalDist.toFixed(1)} KM`;
  const endMetrics = ctx.measureText(endDistText);
  ctx.fillStyle = '#9ca3af';
  ctx.fillText(endDistText, chartX + chartW - endMetrics.width, bottomLabelY);

  ctx.restore();
}

/**
 * Draws an animated classic cartographic Compass Rose (Rose des vents / Wind Rose) for the outro.
 * Displays blooming faceted cardinal needles, gold & rose outer rings, True North fleur-de-lis,
 * and smooth spin-and-settle entrance during route zoom-out and overview hold.
 */
export function drawOutroCompassRoseOnCanvas(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  progress: number, // 0 to 1 during outro
  accentColor: string = '#f43f5e',
  bearing: number = 0
): void {
  if (progress <= 0) return;

  ctx.save();

  // Entrance scaling & smooth settling rotation
  // Progress 0..0.45 is the blooming spin entry, 0.45..1.0 is the elegant resting state
  const enterT = Math.min(1, progress / 0.45);
  // Cubic ease for organic bloom
  const scale = enterT < 0.5 
    ? 4 * enterT * enterT * enterT 
    : 1 - Math.pow(-2 * enterT + 2, 3) / 2;

  // Gentle entry spin: starts at 60 degrees and settles into True North (0)
  const initialAngleOffset = (1 - enterT) * (Math.PI / 3);
  const currentRotation = (bearing * Math.PI) / 180 + initialAngleOffset;

  // Subtle breathing pulse in holding phase
  const holdPulse = progress > 0.45 ? 1 + Math.sin(progress * Math.PI * 4) * 0.03 : 1;
  const effectiveRadius = radius * scale * holdPulse;

  if (effectiveRadius <= 1) {
    ctx.restore();
    return;
  }

  const alpha = Math.min(1, enterT * 1.5);
  ctx.globalAlpha = alpha;

  ctx.translate(centerX, centerY);

  // Background subtle dark vignette circle to enhance contrast against bright satellite tiles
  const bgGrad = ctx.createRadialGradient(0, 0, effectiveRadius * 0.2, 0, 0, effectiveRadius * 1.25);
  bgGrad.addColorStop(0, 'rgba(10, 10, 15, 0.75)');
  bgGrad.addColorStop(0.7, 'rgba(10, 10, 15, 0.60)');
  bgGrad.addColorStop(1, 'rgba(10, 10, 15, 0)');
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.arc(0, 0, effectiveRadius * 1.25, 0, Math.PI * 2);
  ctx.fill();

  // Rotate entire rose to match current compass heading (typically 0 / North)
  ctx.rotate(currentRotation);

  // 1. Outer decorative degree dial
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = Math.max(1, effectiveRadius * 0.015);
  ctx.beginPath();
  ctx.arc(0, 0, effectiveRadius * 0.95, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Middle accent ring (Rose Gold / Accent)
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = Math.max(1.5, effectiveRadius * 0.022);
  ctx.beginPath();
  ctx.arc(0, 0, effectiveRadius * 0.85, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Degree tick marks around outer dial (16 points of the compass)
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8;
    const isMajor = i % 4 === 0;
    const isMedium = i % 2 === 0;
    const innerR = isMajor ? effectiveRadius * 0.78 : (isMedium ? effectiveRadius * 0.82 : effectiveRadius * 0.85);
    const outerR = effectiveRadius * 0.93;
    
    ctx.strokeStyle = isMajor ? '#ffffff' : (isMedium ? accentColor : 'rgba(255, 255, 255, 0.4)');
    ctx.lineWidth = isMajor ? Math.max(1.5, effectiveRadius * 0.02) : Math.max(1, effectiveRadius * 0.01);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
    ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
    ctx.stroke();
  }

  // Helper to draw a faceted diamond needle
  const drawFacetedNeedle = (tipAngle: number, length: number, baseWidth: number, brightColor: string, darkColor: string) => {
    const cosT = Math.cos(tipAngle);
    const sinT = Math.sin(tipAngle);
    const cosB = Math.cos(tipAngle + Math.PI / 2);
    const sinB = Math.sin(tipAngle + Math.PI / 2);

    const tipX = cosT * length;
    const tipY = sinT * length;
    const leftX = cosB * (baseWidth / 2);
    const leftY = sinB * (baseWidth / 2);
    const rightX = -leftX;
    const rightY = -leftY;

    // Right facet (Illuminated)
    ctx.fillStyle = brightColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fill();

    // Left facet (Shaded)
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.closePath();
    ctx.fill();
  };

  // 4. Intercardinal Needles (NE, SE, SW, NW) - shorter
  const intercardinalLen = effectiveRadius * 0.62;
  const intercardinalBase = effectiveRadius * 0.16;
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + (i * Math.PI) / 2;
    drawFacetedNeedle(angle, intercardinalLen, intercardinalBase, 'rgba(255, 255, 255, 0.75)', 'rgba(20, 20, 28, 0.85)');
  }

  // 5. Cardinal Needles (East, South, West)
  const cardinalLen = effectiveRadius * 0.82;
  const cardinalBase = effectiveRadius * 0.22;
  drawFacetedNeedle(0, cardinalLen, cardinalBase, '#e2e8f0', '#1e293b'); // East
  drawFacetedNeedle(Math.PI / 2, cardinalLen, cardinalBase, '#e2e8f0', '#1e293b'); // South
  drawFacetedNeedle(Math.PI, cardinalLen, cardinalBase, '#e2e8f0', '#1e293b'); // West

  // 6. North Cardinal Needle - Radiant Velvet Rose / Gold Highlight
  const northLen = effectiveRadius * 0.98;
  const northBase = effectiveRadius * 0.24;
  drawFacetedNeedle(
    -Math.PI / 2, // North is pointing upward (-Y)
    northLen,
    northBase,
    accentColor, // Radiant bright Rose/Gold
    '#881337' // Deep Velvet Maroon / Shaded Rose
  );

  // Fleur-de-lis / Crown on North Needle Tip
  const tipY = -northLen;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, tipY - effectiveRadius * 0.12);
  ctx.lineTo(effectiveRadius * 0.05, tipY);
  ctx.lineTo(0, tipY - effectiveRadius * 0.03);
  ctx.lineTo(-effectiveRadius * 0.05, tipY);
  ctx.closePath();
  ctx.fill();

  // 7. Center Jewel Pivot
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 0, effectiveRadius * 0.14, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = Math.max(1.5, effectiveRadius * 0.025);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, effectiveRadius * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // 8. Cardinal Letters (N, E, S, W)
  const fontSize = Math.max(9, Math.round(effectiveRadius * 0.16));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // N (North)
  ctx.fillStyle = accentColor;
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 8;
  ctx.fillText('N', 0, -effectiveRadius * 1.12);

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e2e8f0';
  // E (East)
  ctx.fillText('E', effectiveRadius * 1.10, 0);
  // S (South)
  ctx.fillText('S', 0, effectiveRadius * 1.10);
  // W (West)
  ctx.fillText('W', -effectiveRadius * 1.10, 0);

  ctx.restore();
}

