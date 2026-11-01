/**
 * Cinematic Camera & Timeline Utilities for Route Flythrough Intro & Outro
 */

import { GpxRouteData } from './gpxParser';
import { interpolateAngle, calculateBearing } from './routeFollow';

export { calculateBearing };

export type LineEffectType = 'rainbow' | 'neon' | 'gold' | 'rose';

export interface CinematicIntroOutroConfig {
  enableIntro?: boolean;
  introEnabled?: boolean;
  introDurationSeconds: number; // 1 to 5 seconds
  enableOutro?: boolean;
  outroEnabled?: boolean;
  outroDurationSeconds?: number; // How many seconds the last view lasts (2 to 8s)
  outroHoldSeconds?: number;
  animateLineEffects?: boolean;
  animateLineEffect?: boolean;
  lineEffectType: LineEffectType;
  showOutroRose?: boolean;
  outroRoseEnabled?: boolean;
}

export const DEFAULT_INTRO_OUTRO_CONFIG: CinematicIntroOutroConfig = {
  enableIntro: true,
  introEnabled: true,
  introDurationSeconds: 3,
  enableOutro: true,
  outroEnabled: true,
  outroDurationSeconds: 4,
  outroHoldSeconds: 4,
  animateLineEffects: true,
  animateLineEffect: true,
  lineEffectType: 'rose',
  showOutroRose: true,
  outroRoseEnabled: true,
};

export type TimelinePhase = 'intro' | 'flythrough' | 'outro-zoom' | 'outro-hold' | 'ended';

export interface TimelineState {
  phase: TimelinePhase;
  phaseProgress: number; // 0 to 1 within current phase
  routeProgress: number; // 0 to 1 for route line drawing
  animatedLineColor?: string;
  lineWidthBonus?: number;
  isIntro: boolean;
  isOutro: boolean;
  isHoldingOutro: boolean;
}

export function isIntroActive(cfg?: CinematicIntroOutroConfig): boolean {
  if (!cfg) return false;
  if (cfg.introEnabled !== undefined && cfg.enableIntro !== undefined) {
    return cfg.introEnabled && cfg.enableIntro;
  }
  return cfg.introEnabled ?? cfg.enableIntro ?? false;
}

export function isOutroActive(cfg?: CinematicIntroOutroConfig): boolean {
  if (!cfg) return false;
  if (cfg.outroEnabled !== undefined && cfg.enableOutro !== undefined) {
    return cfg.outroEnabled && cfg.enableOutro;
  }
  return cfg.outroEnabled ?? cfg.enableOutro ?? false;
}

export function getOutroDurationSeconds(cfg?: CinematicIntroOutroConfig): number {
  if (!cfg) return 4;
  return cfg.outroHoldSeconds ?? cfg.outroDurationSeconds ?? 4;
}

export function isLineEffectActive(cfg?: CinematicIntroOutroConfig): boolean {
  if (!cfg) return false;
  if (cfg.animateLineEffect !== undefined && cfg.animateLineEffects !== undefined) {
    return cfg.animateLineEffect && cfg.animateLineEffects;
  }
  return cfg.animateLineEffect ?? cfg.animateLineEffects ?? false;
}

export function isOutroRoseActive(cfg?: CinematicIntroOutroConfig): boolean {
  if (!cfg) return true;
  if (cfg.outroRoseEnabled !== undefined && cfg.showOutroRose !== undefined) {
    return cfg.outroRoseEnabled && cfg.showOutroRose;
  }
  return cfg.outroRoseEnabled ?? cfg.showOutroRose ?? true;
}

/**
 * Smooth cubic ease-in-out curve
 */
export function cubicEaseInOut(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5 
    ? 4 * clamped * clamped * clamped 
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

/**
 * Calculates timeline state given current elapsed seconds
 */
export function getTimelineState(
  elapsedSeconds: number,
  config: CinematicIntroOutroConfig,
  mainRouteSeconds: number,
  baseColor: string = '#f59e0b'
): TimelineState {
  const introEnabled = isIntroActive(config);
  const outroEnabled = isOutroActive(config);
  const introDuration = introEnabled ? Math.max(0.5, config.introDurationSeconds) : 0;
  const outroTotalDuration = outroEnabled ? Math.max(1, getOutroDurationSeconds(config)) : 0;
  // Outro is split into zoom-out transition (~45% of outro, up to 2.0s) and hold last view
  const outroZoomDuration = Math.min(2.0, outroTotalDuration * 0.45);
  const outroHoldDuration = Math.max(0.5, outroTotalDuration - outroZoomDuration);

  // 1. Intro Phase: Dive in from world satellite view to start point
  if (introEnabled && elapsedSeconds < introDuration) {
    const p = Math.max(0, Math.min(1, elapsedSeconds / introDuration));
    return {
      phase: 'intro',
      phaseProgress: p,
      routeProgress: 0,
      isIntro: true,
      isOutro: false,
      isHoldingOutro: false,
    };
  }

  const flythroughStart = introDuration;
  const flythroughEnd = introDuration + mainRouteSeconds;

  // 2. Main Flythrough Phase
  if (elapsedSeconds < flythroughEnd) {
    const elapsedFlythrough = elapsedSeconds - flythroughStart;
    const p = Math.max(0, Math.min(1, elapsedFlythrough / Math.max(0.01, mainRouteSeconds)));
    return {
      phase: 'flythrough',
      phaseProgress: p,
      routeProgress: p,
      isIntro: false,
      isOutro: false,
      isHoldingOutro: false,
    };
  }

  // 3. Outro Phase: Zoom out to full route and hold with color effects
  if (outroEnabled) {
    const elapsedOutro = elapsedSeconds - flythroughEnd;
    const isHolding = elapsedOutro >= outroZoomDuration;

    let animatedColor: string | undefined;
    let widthBonus: number | undefined;

    if (isLineEffectActive(config)) {
      const elapsedOutroMs = elapsedOutro * 1000;
      animatedColor = getOutroAnimatedColor(config.lineEffectType, elapsedOutroMs, baseColor);
      widthBonus = 1.5 + Math.sin(elapsedOutroMs * 0.008) * 1.5;
    }

    if (elapsedOutro >= outroTotalDuration) {
      return {
        phase: 'ended',
        phaseProgress: 1,
        routeProgress: 1,
        animatedLineColor: animatedColor,
        lineWidthBonus: widthBonus,
        isIntro: false,
        isOutro: true,
        isHoldingOutro: true,
      };
    }

    if (!isHolding) {
      const p = Math.max(0, Math.min(1, elapsedOutro / Math.max(0.01, outroZoomDuration)));
      return {
        phase: 'outro-zoom',
        phaseProgress: p,
        routeProgress: 1,
        animatedLineColor: animatedColor,
        lineWidthBonus: widthBonus,
        isIntro: false,
        isOutro: true,
        isHoldingOutro: false,
      };
    } else {
      const p = Math.max(0, Math.min(1, (elapsedOutro - outroZoomDuration) / Math.max(0.01, outroHoldDuration)));
      return {
        phase: 'outro-hold',
        phaseProgress: p,
        routeProgress: 1,
        animatedLineColor: animatedColor,
        lineWidthBonus: widthBonus,
        isIntro: false,
        isOutro: true,
        isHoldingOutro: true,
      };
    }
  }

  return {
    phase: 'ended',
    phaseProgress: 1,
    routeProgress: 1,
    isIntro: false,
    isOutro: false,
    isHoldingOutro: false,
  };
}

/**
 * Calculates total sequence duration including enabled intro and outro
 */
export function calculateTotalSequenceDuration(
  mainRouteSeconds: number,
  config: CinematicIntroOutroConfig
): number {
  let total = mainRouteSeconds;
  if (isIntroActive(config)) {
    total += Math.max(0.5, config.introDurationSeconds);
  }
  if (isOutroActive(config)) {
    total += Math.max(1, getOutroDurationSeconds(config));
  }
  return Math.round(total * 10) / 10;
}

/**
 * Interpolates between two hex colors
 */
export function lerpHexColor(hex1: string, hex2: string, factor: number): string {
  const f = Math.max(0, Math.min(1, factor));
  const parseHex = (h: string) => {
    const clean = h.replace('#', '');
    const num = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const [r1, g1, b1] = parseHex(hex1);
  const [r2, g2, b2] = parseHex(hex2);

  const r = Math.round(r1 + (r2 - r1) * f);
  const g = Math.round(g1 + (g2 - g1) * f);
  const b = Math.round(b1 + (b2 - b1) * f);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Generates animated color for route line effects during outro
 */
export function getOutroAnimatedColor(
  effectType: LineEffectType,
  elapsedMs: number,
  baseColor: string = '#f59e0b'
): string {
  switch (effectType) {
    case 'rainbow': {
      // Dynamic cycling rainbow wave
      const hue = Math.round((elapsedMs * 0.15) % 360);
      return `hsl(${hue}, 100%, 60%)`;
    }
    case 'neon': {
      // Radiant electric pulse between neon cyan and hot pink
      const t = (Math.sin(elapsedMs * 0.007) + 1) / 2;
      return lerpHexColor('#06b6d4', '#ec4899', t);
    }
    case 'gold': {
      // Championship golden amber shimmer
      const t = (Math.sin(elapsedMs * 0.009) + 1) / 2;
      return lerpHexColor('#d97706', '#fef08a', t);
    }
    case 'rose': {
      // Elegant blooming velvet rose, petal pink & rose gold shimmer
      const t = (Math.sin(elapsedMs * 0.007) + 1) / 2;
      return lerpHexColor('#e11d48', '#fda4af', t);
    }
    default:
      return baseColor;
  }
}

/**
 * Computes bounding box center and estimated zoom level for full route overview
 */
export function getBoundsCenterAndZoom(
  bounds: [[number, number], [number, number]],
  viewportWidth: number = 1920,
  viewportHeight: number = 1080
): { center: [number, number]; zoom: number } {
  const [sw, ne] = bounds;
  const centerLng = (sw[0] + ne[0]) / 2;
  const centerLat = (sw[1] + ne[1]) / 2;

  const dLng = Math.max(0.001, Math.abs(ne[0] - sw[0]));
  const dLat = Math.max(0.001, Math.abs(ne[1] - sw[1]));

  // Standard mercator zoom calculation accounting for aspect ratio and padding
  const zoomX = Math.log2((360 * (viewportWidth * 0.75)) / (256 * dLng));
  const zoomY = Math.log2((180 * (viewportHeight * 0.65)) / (256 * dLat));
  const zoom = Math.max(3, Math.min(15, Math.min(zoomX, zoomY)));

  return {
    center: [centerLng, centerLat],
    zoom: Math.round(zoom * 10) / 10,
  };
}

export interface CameraTransitionState {
  center: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
}

/**
 * Calculates camera parameters during Intro Dive-In (from world overview down to start)
 */
export function calculateIntroCamera(
  progress0to1: number,
  startPoint: { lng: number; lat: number },
  startBearing: number,
  targetZoom: number = 13.0,
  targetPitch: number = 55,
  worldCenter?: [number, number],
  worldZoom: number = 3.8,
  worldPitch: number = 0,
  worldBearing: number = 0
): { center: [number, number]; zoom: number; pitch: number; bearing: number } {
  const ease = cubicEaseInOut(progress0to1);

  // If worldCenter is provided, smoothly glide from worldCenter to startPoint
  const startLng = worldCenter ? worldCenter[0] : startPoint.lng;
  const startLat = worldCenter ? worldCenter[1] : startPoint.lat;

  const currentLng = startLng + (startPoint.lng - startLng) * ease;
  const currentLat = startLat + (startPoint.lat - startLat) * ease;
  const currentZoom = worldZoom + (targetZoom - worldZoom) * ease;
  const currentPitch = worldPitch + (targetPitch - worldPitch) * ease;
  const currentBearing = interpolateAngle(worldBearing, startBearing, ease);

  return {
    center: [Math.round(currentLng * 1000000) / 1000000, Math.round(currentLat * 1000000) / 1000000],
    zoom: Math.round(currentZoom * 100) / 100,
    pitch: Math.round(currentPitch * 10) / 10,
    bearing: Math.round(currentBearing * 10) / 10,
  };
}

/**
 * Calculates camera parameters during Outro Zoom-Out (from finish camera state to full path overview)
 * Seamlessly accepts either a raw { lng, lat } finish point or the exact final camera state from flythrough
 */
export function calculateOutroCamera(
  progress0to1: number,
  finishPointOrCamera: { lng: number; lat: number } | CameraTransitionState,
  finishBearing: number,
  boundsCenter: [number, number],
  boundsZoom: number,
  finishZoom: number = 13.0,
  finishPitch: number = 55,
  targetOverviewPitch: number = 38,
  targetOverviewBearing: number = 0
): { center: [number, number]; zoom: number; pitch: number; bearing: number } {
  const ease = cubicEaseInOut(progress0to1);

  const hasCameraCenter = 'center' in finishPointOrCamera && Array.isArray((finishPointOrCamera as CameraTransitionState).center);
  const startLng = hasCameraCenter
    ? (finishPointOrCamera as CameraTransitionState).center[0]
    : (finishPointOrCamera as { lng: number; lat: number }).lng;
  const startLat = hasCameraCenter
    ? (finishPointOrCamera as CameraTransitionState).center[1]
    : (finishPointOrCamera as { lng: number; lat: number }).lat;

  const actualFinishZoom = (hasCameraCenter && (finishPointOrCamera as CameraTransitionState).zoom !== undefined)
    ? (finishPointOrCamera as CameraTransitionState).zoom!
    : finishZoom;

  const actualFinishPitch = (hasCameraCenter && (finishPointOrCamera as CameraTransitionState).pitch !== undefined)
    ? (finishPointOrCamera as CameraTransitionState).pitch!
    : finishPitch;

  const actualFinishBearing = (hasCameraCenter && (finishPointOrCamera as CameraTransitionState).bearing !== undefined)
    ? (finishPointOrCamera as CameraTransitionState).bearing!
    : finishBearing;

  const currentLng = startLng + (boundsCenter[0] - startLng) * ease;
  const currentLat = startLat + (boundsCenter[1] - startLat) * ease;
  const currentZoom = actualFinishZoom + (boundsZoom - actualFinishZoom) * ease;
  const currentPitch = actualFinishPitch + (targetOverviewPitch - actualFinishPitch) * ease;
  // Smoothly rotate to targetOverviewBearing (North: 0) along the shortest arc
  const currentBearing = interpolateAngle(actualFinishBearing, targetOverviewBearing, ease);

  return {
    center: [Math.round(currentLng * 1000000) / 1000000, Math.round(currentLat * 1000000) / 1000000],
    zoom: Math.round(currentZoom * 100) / 100,
    pitch: Math.round(currentPitch * 10) / 10,
    bearing: Math.round(currentBearing * 10) / 10,
  };
}
