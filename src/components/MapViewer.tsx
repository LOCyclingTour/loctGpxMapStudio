import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { WayfarerMap } from '@wayfarer-gl/core';
import { GpxRouteData, GpxWaypoint } from '../utils/gpxParser';
import { zoomToAltitude, altitudeToZoom, formatAltitude } from '../utils/cameraMath';
import { getRoutePointAtProgress, findNearestElevation, angleDelta, interpolateAngle, calculateBearing } from '../utils/routeFollow';
import { resolveBasemapStyle } from '../utils/basemapStyles';
import { 
  CinematicIntroOutroConfig, 
  DEFAULT_INTRO_OUTRO_CONFIG, 
  getTimelineState, 
  calculateTotalSequenceDuration, 
  calculateIntroCamera, 
  calculateOutroCamera, 
  getBoundsCenterAndZoom,
  CameraTransitionState,
  isOutroRoseActive
} from '../utils/cinematicCamera';
import { 
  Compass, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  Camera, 
  Play, 
  Pause, 
  RotateCcw,
  Sparkles,
  Box,
  Eye,
  Video,
  Navigation
} from 'lucide-react';

export interface LineStyleSettings {
  color: string;
  width: number;
  opacity: number;
  dashType: 'solid' | 'dashed' | 'dotted';
}

export type FollowCamMode = 'calm' | 'fixed' | 'free';

export interface CameraSettings {
  is3dTerrain: boolean;
  terrainExaggeration: number;
  pitch: number;
  bearing: number;
  altitudeMeters: number;
}

export interface MapViewerHandle {
  setAltitude: (meters: number) => void;
  setPitch: (pitch: number) => void;
  setBearing: (bearing: number) => void;
  fitBounds: () => void;
  getMapCanvas: () => HTMLCanvasElement | null;
  getMap: () => maplibregl.Map | null;
  updateProgress: (segmentIndex: number, progress: number, overallProgress?: number, shouldMoveCamera?: boolean) => void;
  moveCameraToProgress: (progress: number, snapImmediately?: boolean, modeOverride?: FollowCamMode) => void;
  getFollowMode: () => FollowCamMode;
  setFollowMode: (mode: FollowCamMode) => void;
  setLineColorOverride: (color: string | null, widthBonus?: number) => void;
  getBoundsCamera: () => { center: [number, number]; zoom: number };
}

interface MapViewerProps {
  routeData: GpxRouteData | null;
  lineStyle: LineStyleSettings;
  basemapStyle: string;
  cameraSettings: CameraSettings;
  cinematicIntroOutro?: CinematicIntroOutroConfig;
  onCameraChange?: (settings: Partial<CameraSettings>) => void;
  onSelectWaypoint?: (wpt: GpxWaypoint) => void;
  onUpdateWaypointPhoto?: (wptId: string, photoUrl: string) => void;
  onFitToBounds?: () => void;
  isDarkTheme?: boolean;
  onOpenVideoExport?: () => void;
}

export const MapViewer = React.forwardRef<MapViewerHandle, MapViewerProps>(({
  routeData,
  lineStyle,
  basemapStyle,
  cameraSettings,
  cinematicIntroOutro,
  onCameraChange,
  onSelectWaypoint,
  onUpdateWaypointPhoto,
  isDarkTheme = true,
  onOpenVideoExport,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wayfarerRef = useRef<WayfarerMap | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const travelerMarkerRef = useRef<maplibregl.Marker | null>(null);
  const isInternalCameraUpdate = useRef<boolean>(false);
  const routeDataRef = useRef<GpxRouteData | null>(routeData);

  useEffect(() => {
    routeDataRef.current = routeData;
  }, [routeData]);
  
  // Animation & Camera follow state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0 to 1
  const [followMode, setFollowMode] = useState<FollowCamMode>('calm');
  const [outroRoseVisible, setOutroRoseVisible] = useState<{ active: boolean; progress: number; color?: string } | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastFlyCameraRef = useRef<{ center: [number, number]; zoom: number; pitch: number; bearing: number } | null>(null);

  // Get line dash array configuration
  const getDashArray = useCallback((dashType: 'solid' | 'dashed' | 'dotted'): number[] | undefined => {
    switch (dashType) {
      case 'dashed':
        return [3, 2];
      case 'dotted':
        return [1, 2];
      case 'solid':
      default:
        return undefined;
    }
  }, []);

  // Fit bounds helper
  const fitRouteBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || !routeData || routeData.coordinates.length === 0) return;

    try {
      map.fitBounds(routeData.bounds, {
        padding: { top: 90, bottom: 140, left: 80, right: 80 },
        maxZoom: 15,
        duration: 1200,
        pitch: cameraSettings.is3dTerrain ? 55 : 0,
      });
    } catch (err) {
      console.warn('Error fitting bounds:', err);
    }
  }, [routeData, cameraSettings.is3dTerrain]);

  const setAltitude = useCallback((altMeters: number) => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    const height = containerRef.current?.clientHeight || 900;
    const targetZoom = altitudeToZoom(altMeters, center.lat, height);
    isInternalCameraUpdate.current = true;
    map.jumpTo({
      zoom: targetZoom,
    });
    isInternalCameraUpdate.current = false;
  }, []);

  const setPitch = useCallback((pitchDeg: number) => {
    const map = mapRef.current;
    if (!map) return;
    isInternalCameraUpdate.current = true;
    map.jumpTo({
      pitch: pitchDeg,
    });
    isInternalCameraUpdate.current = false;
  }, []);

  const setBearing = useCallback((bearingDeg: number) => {
    const map = mapRef.current;
    if (!map) return;
    isInternalCameraUpdate.current = true;
    map.jumpTo({
      bearing: bearingDeg,
    });
    isInternalCameraUpdate.current = false;
  }, []);

  const lastTravelerCoordsRef = useRef<{ lng: number; lat: number; ele?: number } | null>(null);

  // Initialize or re-create native WebGL layers for the route traveler beacon and dot
  const initTravelerLayers = useCallback((map: maplibregl.Map) => {
    if (!map) return;
    const sourceId = 'current-traveler-point-source';

    const coords = lastTravelerCoordsRef.current
      ? [lastTravelerCoordsRef.current.lng, lastTravelerCoordsRef.current.lat]
      : (routeData?.coordinates[0] || [0, 0]);

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: coords,
              },
              properties: {},
            },
          ],
        },
      });
    }

    // 1. Radar wave pulsing halo (radiates outward on the 3D terrain surface)
    if (!map.getLayer('current-traveler-pulse')) {
      map.addLayer({
        id: 'current-traveler-pulse',
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 16,
          'circle-color': lineStyle.color,
          'circle-opacity': 0.35,
          'circle-pitch-alignment': 'map',
        },
      });
    }

    // 2. Diffuse soft glow halo
    if (!map.getLayer('current-traveler-glow')) {
      map.addLayer({
        id: 'current-traveler-glow',
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 12,
          'circle-color': lineStyle.color,
          'circle-opacity': 0.6,
          'circle-blur': 0.5,
          'circle-pitch-alignment': 'map',
        },
      });
    }

    // 3. Crisp white ring with colored outline
    if (!map.getLayer('current-traveler-ring')) {
      map.addLayer({
        id: 'current-traveler-ring',
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 7.5,
          'circle-color': '#ffffff',
          'circle-stroke-color': lineStyle.color,
          'circle-stroke-width': 3.5,
          'circle-pitch-alignment': 'map',
        },
      });
    }

    // 4. Inner illuminated center dot
    if (!map.getLayer('current-traveler-dot')) {
      map.addLayer({
        id: 'current-traveler-dot',
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 3.5,
          'circle-color': lineStyle.color,
          'circle-pitch-alignment': 'map',
        },
      });
    }
  }, [lineStyle.color, routeData]);

  // Clean up all markers, popups, and traveler layers
  const cleanupMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => {
      try {
        marker.remove();
      } catch (e) {
        // Ignore
      }
    });
    markersRef.current = [];

    if (travelerMarkerRef.current) {
      try {
        travelerMarkerRef.current.remove();
      } catch (e) {
        // Ignore
      }
      travelerMarkerRef.current = null;
    }

    const map = mapRef.current;
    if (map) {
      try {
        if (map.getLayer('current-traveler-dot')) map.removeLayer('current-traveler-dot');
        if (map.getLayer('current-traveler-ring')) map.removeLayer('current-traveler-ring');
        if (map.getLayer('current-traveler-glow')) map.removeLayer('current-traveler-glow');
        if (map.getLayer('current-traveler-pulse')) map.removeLayer('current-traveler-pulse');
        if (map.getSource('current-traveler-point-source')) map.removeSource('current-traveler-point-source');
      } catch (e) {
        // Ignore
      }
    }
  }, []);

  // Render or update the active traveler navigation beacon directly on the route in WebGL
  // Using native WebGL circle layers ensures exact 3D terrain elevation clamping and alignment with the route line
  const renderTravelerMarker = useCallback((lng: number, lat: number, ele?: number) => {
    lastTravelerCoordsRef.current = { lng, lat, ele };
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource('current-traveler-point-source') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            properties: { elevation: ele },
          },
        ],
      });
    } else {
      initTravelerLayers(map);
    }
  }, [initTravelerLayers]);

  // Synchronize map camera and traveler marker with current route progress
  const moveCameraToRouteProgress = useCallback((
    progress: number, 
    snapImmediately: boolean = false, 
    modeOverride?: FollowCamMode
  ) => {
    const map = mapRef.current;
    if (!map || !routeData || routeData.coordinates.length === 0) return;

    const pointInfo = getRoutePointAtProgress(routeData, progress);

    // 1. Position active traveler beacon with 3D elevation
    renderTravelerMarker(pointInfo.lng, pointInfo.lat, pointInfo.ele);

    const activeMode = modeOverride ?? followMode;

    // 2. Drive MapLibre Camera if Follow Cam is enabled
    if (activeMode !== 'free') {
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      const currentBearing = map.getBearing();
      const viewportHeight = containerRef.current?.clientHeight || 900;

      // Camera height (altitude in meters) dictates follow zoom level accurately
      const followZoom = cameraSettings.altitudeMeters
        ? altitudeToZoom(cameraSettings.altitudeMeters, pointInfo.lat, viewportHeight)
        : (currentZoom < 11.0 ? 13.0 : currentZoom);

      const targetPitch = cameraSettings.is3dTerrain
        ? (cameraSettings.pitch !== undefined ? cameraSettings.pitch : 55)
        : 0;

      let targetLng = pointInfo.lng;
      let targetLat = pointInfo.lat;
      let targetBearing = currentBearing;

      if (snapImmediately) {
        // Immediate snap (on slider scrub, initial play start, or frame 0 of video export)
        targetLng = pointInfo.lng;
        targetLat = pointInfo.lat;
        if (activeMode === 'calm') {
          targetBearing = pointInfo.bearing;
        }
      } else {
        // Smooth damped movement during playback or video export:
        // Position damping (12% catchup) absorbs micro-wiggles on real GPS tracks
        const posDamping = 0.12;
        const dLng = pointInfo.lng - currentCenter.lng;
        const dLat = pointInfo.lat - currentCenter.lat;
        targetLng = currentCenter.lng + dLng * posDamping;
        targetLat = currentCenter.lat + dLat * posDamping;

        if (activeMode === 'calm') {
          // Smooth rotation without deadband freezing:
          // 0.04 damping (~0.35s stabilization) provides silky, stabilized turns that follow the trail heading
          targetBearing = interpolateAngle(currentBearing, pointInfo.bearing, 0.04);
        } else {
          // 'fixed' mode: maintain current compass orientation without spinning
          targetBearing = currentBearing;
        }
      }

      isInternalCameraUpdate.current = true;
      map.jumpTo({
        center: [targetLng, targetLat],
        bearing: targetBearing,
        pitch: targetPitch,
        zoom: followZoom,
      });
      isInternalCameraUpdate.current = false;
    }
  }, [
    routeData, 
    followMode, 
    cameraSettings.is3dTerrain, 
    cameraSettings.pitch, 
    cameraSettings.altitudeMeters, 
    renderTravelerMarker
  ]);

  // Calculate route bounding center and overview zoom level
  const getBoundsCamera = useCallback((): { center: [number, number]; zoom: number } => {
    const map = mapRef.current;
    if (!routeData || routeData.coordinates.length === 0) return { center: [0, 0], zoom: 10 };
    if (map) {
      try {
        const cam = map.cameraForBounds(routeData.bounds, {
          padding: { top: 90, bottom: 140, left: 80, right: 80 },
        });
        if (cam && cam.center) {
          const centerObj = maplibregl.LngLat.convert(cam.center);
          return {
            center: [centerObj.lng, centerObj.lat],
            zoom: cam.zoom ?? 10.5,
          };
        }
      } catch (e) {
        // Fallback
      }
    }
    const width = containerRef.current?.clientWidth || 1920;
    const height = containerRef.current?.clientHeight || 1080;
    return getBoundsCenterAndZoom(routeData.bounds, width, height);
  }, [routeData]);

  // Dynamic route line color override for outro celebration effects
  const setLineColorOverride = useCallback((color: string | null, widthBonus: number = 0) => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const effectiveColor = color || lineStyle.color;
      const effectiveWidth = Math.max(lineStyle.width + (color ? widthBonus : 0), 2);
      if (map.getLayer('route-layer')) {
        map.setPaintProperty('route-layer', 'line-color', effectiveColor);
      }
      if (map.getLayer('progress-layer')) {
        map.setPaintProperty('progress-layer', 'line-color', effectiveColor);
        map.setPaintProperty('progress-layer', 'line-width', Math.max(effectiveWidth + 2, 4));
      }
      if (map.getLayer('stops-layer')) {
        map.setPaintProperty('stops-layer', 'circle-color', effectiveColor);
      }
      if (map.getLayer('current-traveler-pulse')) {
        map.setPaintProperty('current-traveler-pulse', 'circle-color', effectiveColor);
      }
      if (map.getLayer('current-traveler-dot')) {
        map.setPaintProperty('current-traveler-dot', 'circle-color', effectiveColor);
      }
    } catch (e) {
      // Ignore
    }
  }, [lineStyle]);

  React.useImperativeHandle(ref, () => ({
    setAltitude,
    setPitch,
    setBearing,
    fitBounds: fitRouteBounds,
    getMapCanvas: () => {
      return (containerRef.current?.querySelector('canvas.maplibregl-canvas') as HTMLCanvasElement) || null;
    },
    getMap: () => mapRef.current,
    updateProgress: (segmentIndex: number, progress: number, overallProgress?: number, shouldMoveCamera: boolean = true) => {
      wayfarerRef.current?.updateProgress(segmentIndex, progress);
      const computedOverall = overallProgress !== undefined
        ? overallProgress
        : (routeData ? (segmentIndex + progress) / Math.max(1, (routeData.waypoints?.length || 2) - 1) : 0);
      setPlaybackProgress(computedOverall);
      if (shouldMoveCamera) {
        moveCameraToRouteProgress(computedOverall);
      }
    },
    moveCameraToProgress: (progress: number, snapImmediately?: boolean, modeOverride?: FollowCamMode) => {
      moveCameraToRouteProgress(progress, snapImmediately, modeOverride);
    },
    getFollowMode: () => followMode,
    setFollowMode: (mode: FollowCamMode) => setFollowMode(mode),
    setLineColorOverride,
    getBoundsCamera,
  }), [setAltitude, setPitch, setBearing, fitRouteBounds, moveCameraToRouteProgress, routeData, followMode, setLineColorOverride, getBoundsCamera]);

  // Apply or remove 3D Terrain DEM mesh
  const applyTerrain = useCallback((map: maplibregl.Map, enabled: boolean, exaggeration: number) => {
    const doApply = () => {
      if (!map) return;
      if (!map.isStyleLoaded()) {
        map.once('style.load', doApply);
        return;
      }

      try {
        if (enabled) {
          if (!map.getSource('terrain-dem')) {
            map.addSource('terrain-dem', {
              type: 'raster-dem',
              tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
              encoding: 'terrarium',
              tileSize: 256,
              maxzoom: 15,
            });
          }
          map.setTerrain({ source: 'terrain-dem', exaggeration });

          // Wrap terrain elevation calculation with route elevation fallback so waypoint pins
          // are immediately projected to the mountain surface even before DEM raster tiles finish streaming
          const terrain = (map as any).terrain;
          if (terrain && !terrain.__gpxElevationWrapped) {
            const origGetElevation = terrain.getElevationForLngLatZoom.bind(terrain);
            terrain.getElevationForLngLatZoom = function (coordOrLngLat: any, zoom?: number) {
              const demVal = origGetElevation(coordOrLngLat, zoom);
              if (demVal !== null && demVal !== undefined && Math.abs(demVal) > 0.001) {
                return demVal;
              }
              const lng = coordOrLngLat?.lng ?? (Array.isArray(coordOrLngLat) ? coordOrLngLat[0] : coordOrLngLat?.x);
              const lat = coordOrLngLat?.lat ?? (Array.isArray(coordOrLngLat) ? coordOrLngLat[1] : coordOrLngLat?.y);
              if (typeof lng === 'number' && typeof lat === 'number') {
                const fallback = findNearestElevation(lng, lat, routeDataRef.current);
                if (fallback !== null && fallback !== undefined) {
                  const ex = typeof terrain.exaggeration === 'number' ? terrain.exaggeration : exaggeration;
                  return fallback * ex;
                }
              }
              return demVal ?? 0;
            };
            terrain.__gpxElevationWrapped = true;
          }

          // Trigger immediate marker projection refresh
          markersRef.current.forEach((m) => (m as any)._update?.());
        } else {
          if (map.getTerrain()) {
            map.setTerrain(null);
          }
          markersRef.current.forEach((m) => (m as any)._update?.());
        }
      } catch (err) {
        console.warn('Error applying 3D terrain:', err);
      }
    };

    doApply();
  }, []);

  // Render Waypoint Markers & Popups
  const renderWaypointMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !routeData) return;

    cleanupMarkers();

    routeData.waypoints.forEach((wpt, index) => {
      const pinEl = document.createElement('div');
      pinEl.className = 'custom-wpt-marker-wrap';
      pinEl.setAttribute('role', 'button');
      pinEl.setAttribute('tabindex', '0');
      pinEl.setAttribute('aria-label', `Waypoint ${index + 1}: ${wpt.name}`);

      const hasPhoto = Boolean(wpt.imageUrl);

      pinEl.innerHTML = `
        <div class="custom-wpt-pin ${hasPhoto ? 'has-photo' : ''}">
          <div class="pin-inner" style="border-color: ${lineStyle.color}">
            ${
              hasPhoto
                ? `<img src="${wpt.imageUrl}" alt="${wpt.name}" class="pin-thumb" />`
                : `<span class="pin-index">${index + 1}</span>`
            }
          </div>
          <div class="pin-pulse" style="background-color: ${lineStyle.color}"></div>
          <div class="pin-arrow" style="border-top-color: ${lineStyle.color}"></div>
          <div class="pin-ground-dot" style="background-color: ${lineStyle.color}"></div>
        </div>
      `;

      const popupCard = document.createElement('div');
      popupCard.className = 'broadcast-popup-content';

      const photoHtml = wpt.imageUrl
        ? `
          <div class="popup-photo-container">
            <img src="${wpt.imageUrl}" alt="${wpt.name}" class="popup-img" />
            <div class="popup-badge">WAYPOINT #${index + 1}</div>
          </div>
        `
        : `
          <div class="popup-no-photo-header">
            <div class="popup-badge">WAYPOINT #${index + 1}</div>
          </div>
        `;

      const eleHtml = wpt.ele !== undefined
        ? `<div class="popup-stat-tag">▲ ${wpt.ele}m ELEVATION</div>`
        : '';

      const descHtml = wpt.desc || wpt.cmt
        ? `<p class="popup-desc">${wpt.desc || wpt.cmt}</p>`
        : '<p class="popup-desc italic opacity-60">Scenic route checkpoint</p>';

      popupCard.innerHTML = `
        ${photoHtml}
        <div class="popup-body">
          <h3 class="popup-title">${wpt.name}</h3>
          <div class="popup-meta">
            ${eleHtml}
            <span class="popup-coords">${wpt.lat.toFixed(4)}°, ${wpt.lng.toFixed(4)}°</span>
          </div>
          ${descHtml}
          <div class="popup-footer">
            <button class="popup-photo-btn" id="photo-btn-${wpt.id}">
              ${hasPhoto ? '✎ Change Photo' : '+ Attach Photo URL'}
            </button>
          </div>
        </div>
      `;

      const photoBtn = popupCard.querySelector(`#photo-btn-${wpt.id}`);
      if (photoBtn) {
        photoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const newUrl = window.prompt(
            `Enter image URL for "${wpt.name}":`,
            wpt.imageUrl || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop'
          );
          if (newUrl && onUpdateWaypointPhoto) {
            onUpdateWaypointPhoto(wpt.id, newUrl.trim());
          }
        });
      }

      const popup = new maplibregl.Popup({
        offset: [0, -32],
        closeButton: true,
        closeOnClick: false,
        maxWidth: '320px',
        className: 'broadcast-maplibregl-popup',
      }).setDOMContent(popupCard);

      const marker = new maplibregl.Marker({
        element: pinEl,
        anchor: 'bottom',
        pitchAlignment: 'viewport',
        rotationAlignment: 'viewport',
      })
        .setLngLat([wpt.lng, wpt.lat])
        .setPopup(popup)
        .addTo(map);

      // Keep waypoint pins crisp and visible on 3D terrain
      marker.setOpacity('1', '0.85');

      // Explicitly project to 3D elevation immediately
      (marker as any)._update?.();

      pinEl.addEventListener('click', () => {
        if (onSelectWaypoint) {
          onSelectWaypoint(wpt);
        }
      });

      markersRef.current.push(marker);
    });
  }, [routeData, lineStyle.color, cleanupMarkers, onSelectWaypoint, onUpdateWaypointPhoto]);

  // Setup Camera Listeners to report live Altitude, Pitch, Bearing to parent
  const attachCameraListeners = useCallback((map: maplibregl.Map) => {
    const handleMove = () => {
      if (isInternalCameraUpdate.current || !onCameraChange) return;
      const center = map.getCenter();
      const zoom = map.getZoom();
      const pitch = Math.round(map.getPitch());
      const bearing = Math.round(((map.getBearing() % 360) + 360) % 360);
      const viewportHeight = containerRef.current?.clientHeight || 900;
      const altMeters = zoomToAltitude(zoom, center.lat, viewportHeight);

      onCameraChange({
        altitudeMeters: altMeters,
        pitch,
        bearing,
      });
    };

    map.on('move', handleMove);
  }, [onCameraChange]);

  // Helper to sync line and traveler paint properties on the map
  const syncLinePaintProperties = useCallback((map: maplibregl.Map) => {
    try {
      if (map.getLayer('route-layer')) {
        map.setPaintProperty('route-layer', 'line-color', lineStyle.color);
        map.setPaintProperty('route-layer', 'line-width', lineStyle.width);
        map.setPaintProperty('route-layer', 'line-opacity', lineStyle.opacity);

        const dashArray = getDashArray(lineStyle.dashType);
        if (dashArray) {
          map.setPaintProperty('route-layer', 'line-dasharray', dashArray);
        } else {
          map.setPaintProperty('route-layer', 'line-dasharray', [1, 0]);
        }
      }

      if (map.getLayer('progress-layer')) {
        map.setPaintProperty('progress-layer', 'line-color', lineStyle.color);
        map.setPaintProperty('progress-layer', 'line-width', Math.max(lineStyle.width + 2, 4));
        map.setPaintProperty('progress-layer', 'line-opacity', lineStyle.opacity);
      }

      if (map.getLayer('current-traveler-pulse')) {
        map.setPaintProperty('current-traveler-pulse', 'circle-color', lineStyle.color);
      }
      if (map.getLayer('current-traveler-glow')) {
        map.setPaintProperty('current-traveler-glow', 'circle-color', lineStyle.color);
      }
      if (map.getLayer('current-traveler-ring')) {
        map.setPaintProperty('current-traveler-ring', 'circle-stroke-color', lineStyle.color);
      }
      if (map.getLayer('current-traveler-dot')) {
        map.setPaintProperty('current-traveler-dot', 'circle-color', lineStyle.color);
      }
      if (map.getLayer('stops-layer')) {
        map.setPaintProperty('stops-layer', 'circle-color', lineStyle.color);
        map.setPaintProperty('stops-layer', 'circle-pitch-alignment', 'map');
      }
    } catch (err) {
      console.warn('Error setting paint property:', err);
    }
  }, [lineStyle, getDashArray]);

  const activeBasemapRef = useRef<string>(basemapStyle);

  // Initialize WayfarerMap (only when routeData changes or on initial mount)
  useEffect(() => {
    if (!containerRef.current || !routeData) return;

    if (wayfarerRef.current) {
      try {
        cleanupMarkers();
        wayfarerRef.current.destroy();
      } catch (err) {
        console.warn('Error destroying wayfarer instance:', err);
      }
      wayfarerRef.current = null;
      mapRef.current = null;
    }

    const wayfarerPoints = routeData.waypoints.map((wpt, idx) => ({
      coordinates: [wpt.lng, wpt.lat] as [number, number],
      properties: {
        slug: wpt.id,
        name: wpt.name,
        index: idx,
        elevation: wpt.ele,
      },
    }));

    if (wayfarerPoints.length < 2 && routeData.coordinates.length >= 2) {
      wayfarerPoints.unshift({
        coordinates: routeData.coordinates[0],
        properties: { slug: 'start', name: 'Start', index: 0, elevation: routeData.points[0]?.ele },
      });
      wayfarerPoints.push({
        coordinates: routeData.coordinates[routeData.coordinates.length - 1],
        properties: { slug: 'finish', name: 'Finish', index: wayfarerPoints.length, elevation: routeData.points[routeData.points.length - 1]?.ele },
      });
    }

    const dashArray = getDashArray(lineStyle.dashType);
    const resolvedStyle = resolveBasemapStyle(basemapStyle);
    activeBasemapRef.current = basemapStyle;

    const wayfarerInstance = new WayfarerMap(containerRef.current, {
      data: {
        line: routeData.coordinates,
        point: wayfarerPoints,
      },
      styleLight: resolvedStyle as any,
      styleDark: resolvedStyle as any,
      darkMode: isDarkTheme,
      interactive: true,
      silentMode: true, // Prevents Wayfarer's animation loop from hijacking camera and resetting 3D pitch/bearing
      autoZoom: false, // Prevents Wayfarer from resetting user or follow camera zoom
      preserveDrawingBuffer: true,
      maxPitch: 85,
      pitch: cameraSettings.pitch,
      bearing: cameraSettings.bearing,
      routeLayer: {
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': lineStyle.color,
          'line-width': lineStyle.width,
          'line-opacity': lineStyle.opacity,
          ...(dashArray ? { 'line-dasharray': dashArray } : {}),
        },
      },
      progressLayer: {
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': lineStyle.color,
          'line-width': Math.max(lineStyle.width + 2, 4),
          'line-opacity': lineStyle.opacity,
        },
      },
      stopsLayer: {
        paint: {
          'circle-radius': 5,
          'circle-color': lineStyle.color,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-pitch-alignment': 'map',
        },
      },
      onMapLoaded: (mapInstance) => {
        mapRef.current = mapInstance;
        (window as any).__map = mapInstance;
        applyTerrain(mapInstance, cameraSettings.is3dTerrain, cameraSettings.terrainExaggeration);
        initTravelerLayers(mapInstance);
        renderWaypointMarkers();
        fitRouteBounds();
        moveCameraToRouteProgress(playbackProgress, false);
        attachCameraListeners(mapInstance);
      },
    });

    wayfarerRef.current = wayfarerInstance;

    const nativeMap = wayfarerInstance.getMap();
    if (nativeMap) {
      mapRef.current = nativeMap;
      (window as any).__map = nativeMap;

      // Keep 3D markers pinned at 60 FPS as camera rotates, pitches, or when DEM elevation tiles arrive
      const updateAllMarkers = () => {
        markersRef.current.forEach((m) => (m as any)._update?.());
      };

      const handleSourceData = (e: any) => {
        if (e?.sourceId === 'terrain-dem' || e?.dataType === 'source') {
          updateAllMarkers();
        }
      };

      nativeMap.on('sourcedata', handleSourceData);
      nativeMap.on('render', updateAllMarkers);

      // When style finishes loading (initial or after map.setStyle), re-attach 3D terrain, layers, markers
      const onStyleLoaded = () => {
        applyTerrain(nativeMap, cameraSettings.is3dTerrain, cameraSettings.terrainExaggeration);
        if (wayfarerRef.current) {
          (wayfarerRef.current as any).addLayers?.();
          const numWaypoints = Math.max(2, routeData.waypoints.length);
          const totalSegments = numWaypoints - 1;
          const currentSegment = Math.min(
            totalSegments - 1,
            Math.floor(playbackProgress * totalSegments)
          );
          const segmentProgress = (playbackProgress * totalSegments) % 1;
          wayfarerRef.current.updateProgress(currentSegment, segmentProgress);
        }
        syncLinePaintProperties(nativeMap);
        initTravelerLayers(nativeMap);
        renderWaypointMarkers();
      };

      nativeMap.on('style.load', onStyleLoaded);

      return () => {
        nativeMap.off('sourcedata', handleSourceData);
        nativeMap.off('render', updateAllMarkers);
        nativeMap.off('style.load', onStyleLoaded);
        cleanupMarkers();
        if (wayfarerRef.current) {
          try {
            wayfarerRef.current.destroy();
          } catch (e) {
            // Ignore
          }
          wayfarerRef.current = null;
          mapRef.current = null;
        }
      };
    }

    return () => {
      cleanupMarkers();
      if (wayfarerRef.current) {
        try {
          wayfarerRef.current.destroy();
        } catch (e) {
          // Ignore
        }
        wayfarerRef.current = null;
        mapRef.current = null;
      }
    };
  }, [routeData]);

  // Seamless Basemap Style Switching via map.setStyle without destroying map or losing camera state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (activeBasemapRef.current === basemapStyle) return;
    activeBasemapRef.current = basemapStyle;

    const resolved = resolveBasemapStyle(basemapStyle);
    try {
      map.setStyle(resolved as any);
    } catch (err) {
      console.warn('Error updating map style:', err);
    }
  }, [basemapStyle]);

  // Synchronize 3D Terrain state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyTerrain(map, cameraSettings.is3dTerrain, cameraSettings.terrainExaggeration);
  }, [cameraSettings.is3dTerrain, cameraSettings.terrainExaggeration, applyTerrain]);

  // Update Paint Properties Dynamically on underlying MapLibre map instance without reloading
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncLinePaintProperties(map);
  }, [syncLinePaintProperties]);

  // Ambient Radar pulse wave animation on 3D terrain
  useEffect(() => {
    let animId: number;
    const pulseLoop = () => {
      const map = mapRef.current;
      if (map && map.getLayer('current-traveler-pulse')) {
        const t = (Date.now() % 1600) / 1600; // 0 to 1
        const radius = 9 + t * 18; // expands from 9px to 27px
        const opacity = Math.max(0, 0.5 * (1 - t)); // fades from 0.5 to 0
        try {
          map.setPaintProperty('current-traveler-pulse', 'circle-radius', radius);
          map.setPaintProperty('current-traveler-pulse', 'circle-opacity', opacity);
        } catch (e) {
          // Ignore if transitioning styles
        }
      }
      animId = requestAnimationFrame(pulseLoop);
    };

    animId = requestAnimationFrame(pulseLoop);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  // Re-render markers if waypoint photos change
  useEffect(() => {
    renderWaypointMarkers();
  }, [routeData?.waypoints, lineStyle.color, renderWaypointMarkers]);

  // Listen for user manual drag on map canvas to unlock follow cam if desired
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleDragStart = () => {
      // If user drags map manually during playback, unlock follow mode
      if (isPlaying) {
        setFollowMode('free');
      }
    };

    map.on('dragstart', handleDragStart);
    return () => {
      map.off('dragstart', handleDragStart);
    };
  }, [isPlaying]);

  // Animation Playback Loop: Updates Wayfarer route progress AND drives MapLibre camera tracking
  useEffect(() => {
    if (!isPlaying || !wayfarerRef.current || !routeData || routeData.coordinates.length < 2) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      return;
    }

    const cfg = cinematicIntroOutro || {
      introEnabled: false,
      introDurationSeconds: 3,
      outroEnabled: false,
      outroDurationSeconds: 2,
      outroHoldSeconds: 4,
      animateLineEffect: false,
      lineEffectType: 'rainbow' as const,
    };

    const hasIntroOrOutro = cfg.introEnabled || cfg.outroEnabled;
    const baseFlythroughSeconds = 24;
    const totalDurationSeconds = hasIntroOrOutro
      ? calculateTotalSequenceDuration(baseFlythroughSeconds, cfg)
      : baseFlythroughSeconds;

    const startCoord = routeData.coordinates[0];
    const finishCoord = routeData.coordinates[routeData.coordinates.length - 1];
    const prevFinishCoord = routeData.coordinates[Math.max(0, routeData.coordinates.length - 2)];
    const finishBearing = calculateBearing(prevFinishCoord[1], prevFinishCoord[0], finishCoord[1], finishCoord[0]);

    const boundsCamera = getBoundsCamera();

    // Exact initial camera state for flythrough (to ensure 100% seamless C0 and C1 transition from intro dive-in)
    const point0 = getRoutePointAtProgress(routeData, 0);
    const viewportHeight = containerRef.current?.clientHeight || 900;
    const initialFlyZoom = cameraSettings.altitudeMeters
      ? altitudeToZoom(cameraSettings.altitudeMeters, point0.lat, viewportHeight)
      : (mapRef.current?.getZoom() ?? 13.5);
    const initialFlyPitch = cameraSettings.is3dTerrain
      ? (cameraSettings.pitch !== undefined ? cameraSettings.pitch : 55)
      : 0;
    const initialFlyBearing = followMode === 'fixed'
      ? (mapRef.current?.getBearing() ?? cameraSettings.bearing ?? 0)
      : point0.bearing;

    let startTime: number | null = null;
    let isFirstFlythrough = true;
    const initialPlayback = playbackProgress;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsedSeconds = (timestamp - startTime) / 1000;

      if (!hasIntroOrOutro) {
        const progressDelta = elapsedSeconds / baseFlythroughSeconds;
        const current = (initialPlayback + progressDelta) % 1;

        setPlaybackProgress(current);

        if (wayfarerRef.current) {
          const numWaypoints = Math.max(2, routeData.waypoints.length);
          const totalSegments = numWaypoints - 1;
          const currentSegment = Math.min(
            totalSegments - 1,
            Math.floor(current * totalSegments)
          );
          const segmentProgress = (current * totalSegments) % 1;

          wayfarerRef.current.updateProgress(currentSegment, segmentProgress);
        }

        // Smoothly drive map camera and active traveler beacon along the route path
        moveCameraToRouteProgress(current);

        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Cinematic intro / flythrough / outro timeline sequence
      const timeline = getTimelineState(
        elapsedSeconds,
        cfg,
        baseFlythroughSeconds,
        lineStyle.color
      );

      if (timeline.phase === 'ended') {
        setIsPlaying(false);
        setLineColorOverride(null);
        setPlaybackProgress(1);
        return;
      }

      const map = mapRef.current;
      setPlaybackProgress(timeline.routeProgress);

      if (timeline.phase === 'intro') {
        setLineColorOverride(null);
        setOutroRoseVisible(null);
        // Dives smoothly from high altitude to the EXACT initial flythrough camera position, bearing, zoom, and pitch
        const cam = calculateIntroCamera(
          timeline.phaseProgress,
          { lng: point0.lng, lat: point0.lat },
          initialFlyBearing,
          initialFlyZoom,
          initialFlyPitch,
          boundsCamera.center
        );
        if (map) {
          map.jumpTo(cam);
        }
        renderTravelerMarker(point0.lng, point0.lat, point0.ele);
        if (wayfarerRef.current) {
          wayfarerRef.current.updateProgress(0, 0);
        }
      } else if (timeline.phase === 'flythrough') {
        setLineColorOverride(null);
        setOutroRoseVisible(null);
        if (wayfarerRef.current) {
          const numWaypoints = Math.max(2, routeData.waypoints.length);
          const totalSegments = numWaypoints - 1;
          const currentSegment = Math.min(
            totalSegments - 1,
            Math.floor(timeline.routeProgress * totalSegments)
          );
          const segmentProgress = (timeline.routeProgress * totalSegments) % 1;
          wayfarerRef.current.updateProgress(currentSegment, segmentProgress);
        }
        moveCameraToRouteProgress(timeline.routeProgress, isFirstFlythrough);
        isFirstFlythrough = false;

        // Continuously record camera state at every frame of flythrough for seamless outro handoff
        if (map) {
          const c = map.getCenter();
          lastFlyCameraRef.current = {
            center: [c.lng, c.lat],
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            bearing: map.getBearing(),
          };
        }
      } else if (timeline.phase === 'outro-zoom') {
        setLineColorOverride(null);
        if (isOutroRoseActive(cfg)) {
          setOutroRoseVisible({
            active: true,
            progress: timeline.phaseProgress * 0.45,
            color: timeline.animatedLineColor || lineStyle.color,
          });
        }

        const overviewPitch = cameraSettings.is3dTerrain ? 38 : 0;
        const startOutroCam = lastFlyCameraRef.current || {
          center: [finishCoord[0], finishCoord[1]] as [number, number],
          zoom: initialFlyZoom,
          pitch: initialFlyPitch,
          bearing: finishBearing,
        };

        // Smoothly pull back camera starting from the EXACT final flythrough position and orientation
        const cam = calculateOutroCamera(
          timeline.phaseProgress,
          startOutroCam,
          startOutroCam.bearing ?? finishBearing,
          boundsCamera.center,
          boundsCamera.zoom,
          startOutroCam.zoom ?? initialFlyZoom,
          startOutroCam.pitch ?? initialFlyPitch,
          overviewPitch,
          0
        );
        if (map) {
          map.jumpTo(cam);
        }
        if (wayfarerRef.current) {
          const totalSegments = Math.max(1, routeData.waypoints.length - 1);
          wayfarerRef.current.updateProgress(totalSegments - 1, 1);
        }
        renderTravelerMarker(finishCoord[0], finishCoord[1], finishBearing);
      } else if (timeline.phase === 'outro-hold') {
        if (isOutroRoseActive(cfg)) {
          setOutroRoseVisible({
            active: true,
            progress: 0.45 + timeline.phaseProgress * 0.55,
            color: timeline.animatedLineColor || lineStyle.color,
          });
        }
        const overviewPitch = cameraSettings.is3dTerrain ? 38 : 0;
        if (map) {
          map.jumpTo({
            center: boundsCamera.center,
            zoom: boundsCamera.zoom,
            bearing: 0,
            pitch: overviewPitch,
          });
        }
        if (timeline.animatedLineColor) {
          setLineColorOverride(timeline.animatedLineColor, timeline.lineWidthBonus);
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      setLineColorOverride(null);
      setOutroRoseVisible(null);
    };
  }, [
    isPlaying,
    routeData,
    moveCameraToRouteProgress,
    cinematicIntroOutro,
    cameraSettings.is3dTerrain,
    cameraSettings.pitch,
    getBoundsCamera,
    renderTravelerMarker,
    setLineColorOverride,
  ]);

  const handleManualScrub = (newProgress: number) => {
    setLineColorOverride(null);
    setPlaybackProgress(newProgress);
    if (wayfarerRef.current && routeData) {
      const numWaypoints = Math.max(2, routeData.waypoints.length);
      const totalSegments = numWaypoints - 1;
      const currentSegment = Math.min(
        totalSegments - 1,
        Math.floor(newProgress * totalSegments)
      );
      const segmentProgress = (newProgress * totalSegments) % 1;
      wayfarerRef.current.updateProgress(currentSegment, segmentProgress);
    }
    // Update map camera & traveler marker to scrubbed position immediately
    moveCameraToRouteProgress(newProgress, true);
  };

  const handleTogglePlay = () => {
    if (!isPlaying) {
      setLineColorOverride(null);
      // If at end of route, restart from beginning
      const nextProgress = playbackProgress >= 0.99 ? 0 : playbackProgress;
      if (nextProgress !== playbackProgress) {
        handleManualScrub(0);
      }
      if (followMode === 'free') {
        setFollowMode('calm');
      }
      moveCameraToRouteProgress(nextProgress, true);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      setLineColorOverride(null);
      isInternalCameraUpdate.current = false;
    }
  };

  // Toggle 3D Terrain quickly from HUD
  const toggle3d = () => {
    if (!onCameraChange) return;
    const next3d = !cameraSettings.is3dTerrain;
    const nextPitch = next3d ? 62 : 0;
    onCameraChange({
      is3dTerrain: next3d,
      pitch: nextPitch,
    });
    if (mapRef.current) {
      isInternalCameraUpdate.current = true;
      mapRef.current.easeTo({
        pitch: nextPitch,
        duration: 600,
      });
      setTimeout(() => {
        isInternalCameraUpdate.current = false;
      }, 650);
    }
  };

  const formattedAlt = formatAltitude(cameraSettings.altitudeMeters);

  return (
    <div className="relative w-full h-full min-h-[100vh] overflow-hidden bg-neutral-950">
      {/* Wayfarer Map Container */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 w-full h-full"
        data-testid="wayfarer-map-container"
      />

      {/* Top Floating Map Controls (Fit to route, 3D Toggle, Camera Altitude, Zoom) */}
      <div className="absolute top-5 right-5 z-20 flex flex-col gap-2 items-end">
        
        {/* Fit to Route Primary Button */}
        <button
          onClick={fitRouteBounds}
          data-testid="fit-to-route-button"
          aria-label="Fit map view to route bounds"
          className="group flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-white font-semibold text-xs tracking-wide shadow-2xl backdrop-blur-md border border-neutral-700/80 transition-all cursor-pointer hover:border-amber-400/70"
        >
          <Compass className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
          <span>Fit to Route</span>
        </button>

        {/* Export Video Button */}
        {onOpenVideoExport && (
          <button
            onClick={onOpenVideoExport}
            data-testid="export-video-button"
            aria-label="Export route flythrough as video"
            className="group flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs tracking-wide shadow-2xl backdrop-blur-md transition-all cursor-pointer shadow-amber-500/20"
          >
            <Video className="w-4 h-4 text-black group-hover:scale-110 transition-transform" />
            <span>EXPORT VIDEO</span>
          </button>
        )}

        {/* 3D Terrain Quick Toggle Button */}
        <button
          onClick={toggle3d}
          data-testid="toggle-3d-button"
          aria-label={cameraSettings.is3dTerrain ? 'Switch to 2D flat map' : 'Switch to 3D terrain model'}
          className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide shadow-2xl backdrop-blur-md border transition-all cursor-pointer ${
            cameraSettings.is3dTerrain
              ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-amber-500/10'
              : 'bg-neutral-900/90 border-neutral-700/80 text-neutral-300 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Box className={`w-4 h-4 ${cameraSettings.is3dTerrain ? 'text-amber-400 animate-spin-slow' : 'text-neutral-400'}`} />
          <span>{cameraSettings.is3dTerrain ? '3D TERRAIN ON' : 'ENABLE 3D'}</span>
        </button>

        {/* Live Camera Height / Altitude Badge */}
        <div 
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800 text-[11px] font-mono shadow-xl text-neutral-300"
          title="Current camera height above terrain"
        >
          <Eye className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-neutral-400 text-[10px] uppercase">ALT:</span>
          <span className="font-bold text-white">{formattedAlt.metric}</span>
          <span className="text-[10px] text-neutral-400">({formattedAlt.imperial})</span>
        </div>

        {/* Zoom Controls */}
        <div className="flex flex-col rounded-xl overflow-hidden bg-neutral-900/90 border border-neutral-700/80 backdrop-blur-md shadow-2xl">
          <button
            onClick={() => mapRef.current?.zoomIn({ duration: 300 })}
            aria-label="Zoom in"
            className="p-2.5 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors border-b border-neutral-800"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut({ duration: 300 })}
            aria-label="Zoom out"
            className="p-2.5 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Fly-Through Broadcast Animation Controller Bar (Floating Center Top) */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 hidden md:flex items-center gap-3 px-4 py-2 rounded-full bg-neutral-950/85 backdrop-blur-md border border-neutral-800 shadow-2xl text-xs font-mono">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-amber-400 tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          WAYFARER ENGINE
        </span>
        
        <div className="h-3 w-px bg-neutral-800" />

        <button
          onClick={handleTogglePlay}
          aria-label={isPlaying ? 'Pause route animation' : 'Play route flythrough animation'}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold cursor-pointer transition-colors shadow-sm"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 text-amber-400" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>FLYTHROUGH</span>
            </>
          )}
        </button>

        {/* Follow Camera Mode Selector */}
        <div className="flex items-center bg-neutral-900/90 rounded-full p-0.5 border border-neutral-800 text-[10px]">
          <button
            onClick={() => {
              setFollowMode('calm');
              moveCameraToRouteProgress(playbackProgress, true);
            }}
            title="Calm Follow: Smooth, dampened camera tracking that moves gently without dizzying spins"
            aria-label="Calm Follow camera mode"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
              followMode === 'calm'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/10'
                : 'text-neutral-400 hover:text-white border border-transparent'
            }`}
          >
            <Navigation className="w-3 h-3 text-amber-400" />
            <span>CALM</span>
          </button>
          <button
            onClick={() => {
              setFollowMode('fixed');
              moveCameraToRouteProgress(playbackProgress, true);
            }}
            title="Steady Cam: Smoothly tracks traveler position with locked compass heading (zero spinning)"
            aria-label="Steady camera follow mode"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
              followMode === 'fixed'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/10'
                : 'text-neutral-400 hover:text-white border border-transparent'
            }`}
          >
            <Compass className="w-3 h-3 text-cyan-400" />
            <span>STEADY</span>
          </button>
          <button
            onClick={() => setFollowMode('free')}
            title="Free Cam: Unlock manual camera navigation"
            aria-label="Free manual camera mode"
            className={`flex items-center gap-1 px-2 py-1 rounded-full font-semibold transition-all cursor-pointer ${
              followMode === 'free'
                ? 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                : 'text-neutral-500 hover:text-white border border-transparent'
            }`}
          >
            <span>FREE</span>
          </button>
        </div>

        <input
          type="range"
          min="0"
          max="1"
          step="0.005"
          value={playbackProgress}
          onChange={(e) => handleManualScrub(parseFloat(e.target.value))}
          aria-label="Route scrub progress"
          className="w-28 sm:w-40 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
        />

        <span className="text-[10px] text-neutral-400 w-9 text-right">
          {Math.round(playbackProgress * 100)}%
        </span>

        <button
          onClick={() => handleManualScrub(0)}
          title="Reset animation to start"
          aria-label="Reset route flythrough animation"
          className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Animated Cartographic Compass Rose (Wind Rose) HUD during Outro Sequence */}
      {outroRoseVisible?.active && (
        <div 
          className="absolute top-20 left-6 z-20 pointer-events-none transition-all duration-700 animate-in fade-in zoom-in-75 flex flex-col items-center gap-1 p-3 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-rose-500/40 shadow-2xl shadow-rose-950/60"
          data-testid="outro-compass-rose-hud"
        >
          <div className="relative w-20 h-20 flex items-center justify-center">
            {/* Outer subtle breathing ring */}
            <div 
              className="absolute inset-0 rounded-full border border-rose-400/40 animate-ping opacity-20"
              style={{ animationDuration: '3s' }}
            />
            <div className="absolute inset-1 rounded-full border border-rose-500/60" />
            <div className="absolute inset-2.5 rounded-full border border-dashed border-white/20" />
            
            {/* SVG Compass Rose with cardinal points & needle */}
            <svg 
              viewBox="0 0 100 100" 
              className="w-full h-full transform transition-transform duration-700 ease-out"
              style={{
                transform: `rotate(${Math.max(0, (1 - Math.min(1, (outroRoseVisible.progress || 0) / 0.45)) * 60)}deg)`
              }}
            >
              {/* Intercardinal Points */}
              <polygon points="50,50 46,46 50,22 54,46" fill="rgba(255,255,255,0.7)" />
              <polygon points="50,50 46,46 50,22 50,50" fill="rgba(30,41,59,0.85)" />

              <polygon points="50,50 54,46 78,50 54,54" fill="rgba(255,255,255,0.7)" />
              <polygon points="50,50 54,46 78,50 50,50" fill="rgba(30,41,59,0.85)" />

              <polygon points="50,50 54,54 50,78 46,54" fill="rgba(255,255,255,0.7)" />
              <polygon points="50,50 54,54 50,78 50,50" fill="rgba(30,41,59,0.85)" />

              <polygon points="50,50 46,54 22,50 46,46" fill="rgba(255,255,255,0.7)" />
              <polygon points="50,50 46,54 22,50 50,50" fill="rgba(30,41,59,0.85)" />

              {/* East, South, West Cardinal needles */}
              <polygon points="50,50 50,42 88,50" fill="#e2e8f0" />
              <polygon points="50,50 50,58 88,50" fill="#1e293b" />

              <polygon points="50,50 42,50 50,88" fill="#e2e8f0" />
              <polygon points="50,50 58,50 50,88" fill="#1e293b" />

              <polygon points="50,50 50,58 12,50" fill="#e2e8f0" />
              <polygon points="50,50 50,42 12,50" fill="#1e293b" />

              {/* North Cardinal needle in radiant Velvet Rose */}
              <polygon points="50,50 41,50 50,10" fill="#f43f5e" />
              <polygon points="50,50 59,50 50,10" fill="#881337" />

              {/* Fleur-de-lis / North Arrow Tip */}
              <polygon points="50,4 53,10 50,8 47,10" fill="#ffffff" />

              {/* Center Pivot Ring */}
              <circle cx="50" cy="50" r="6" fill="#0f172a" stroke="#f43f5e" strokeWidth="2" />
              <circle cx="50" cy="50" r="2.5" fill="#ffffff" />
            </svg>

            {/* Cardinal Labels */}
            <span className="absolute top-0 text-[10px] font-bold font-mono text-rose-400 drop-shadow">N</span>
            <span className="absolute right-0 text-[9px] font-bold font-mono text-neutral-300">E</span>
            <span className="absolute bottom-0 text-[9px] font-bold font-mono text-neutral-300">S</span>
            <span className="absolute left-0 text-[9px] font-bold font-mono text-neutral-300">W</span>
          </div>

          <div className="flex flex-col items-center text-center">
            <span className="text-[9px] font-mono font-bold tracking-wider text-rose-400 uppercase">
              WIND ROSE • 0° N
            </span>
            <span className="text-[8px] font-mono text-neutral-400">
              FULL ROUTE OVERVIEW
            </span>
          </div>
        </div>
      )}

    </div>
  );
});

MapViewer.displayName = 'MapViewer';
