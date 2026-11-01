/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { parseGpx, GpxRouteData } from './utils/gpxParser';
import { SAMPLE_ROUTES, SampleRoute } from './data/sampleRoutes';
import { MapViewer, LineStyleSettings, CameraSettings, MapViewerHandle } from './components/MapViewer';
import { TvBroadcastOverlay, TvOverlayPosition, TvOverlayStyle } from './components/TvBroadcastOverlay';
import { RouteControlsDrawer, BASEMAP_OPTIONS } from './components/RouteControlsDrawer';
import { VideoExportModal } from './components/VideoExportModal';
import { TvBannerPartsConfig, DEFAULT_TV_BANNER_PARTS } from './utils/videoExporter';
import { CinematicIntroOutroConfig, DEFAULT_INTRO_OUTRO_CONFIG } from './utils/cinematicCamera';

export default function App() {
  const mapViewerRef = useRef<MapViewerHandle | null>(null);

  // Initialize with the first curated sample route (Grossglockner)
  const [activeSampleId, setActiveSampleId] = useState<string>('grossglockner');
  const [routeData, setRouteData] = useState<GpxRouteData>(() => {
    return parseGpx(SAMPLE_ROUTES[0].gpxXml);
  });

  // Line effect configuration
  const [lineStyle, setLineStyle] = useState<LineStyleSettings>({
    color: '#f59e0b', // Electric Amber
    width: 4,
    opacity: 0.95,
    dashType: 'solid',
  });

  // 3D Terrain & Camera Settings
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>({
    is3dTerrain: true,
    terrainExaggeration: 1.5,
    pitch: 58,
    bearing: 25,
    altitudeMeters: 3800,
  });

  // MapLibre Basemap style
  const [basemapStyle, setBasemapStyle] = useState<string>(BASEMAP_OPTIONS[0].url);

  // TV Broadcast lower-third overlay configuration
  const [tvStyle, setTvStyle] = useState<TvOverlayStyle>('broadcast');
  const [tvPosition, setTvPosition] = useState<TvOverlayPosition>('bottom-left');
  const [isTvOverlayVisible, setIsTvOverlayVisible] = useState(true);
  const [tvBannerParts, setTvBannerParts] = useState<TvBannerPartsConfig>(DEFAULT_TV_BANNER_PARTS);
  const [stageName, setStageName] = useState<string>('LOCT GPX STAGE');
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  // Cinematic Intro & Outro Sequence Settings (disabled by default for live player; active in Video Export Studio)
  const [introOutroConfig, setIntroOutroConfig] = useState<CinematicIntroOutroConfig>({
    enableIntro: false,
    introEnabled: false,
    introDurationSeconds: 3,
    enableOutro: false,
    outroEnabled: false,
    outroDurationSeconds: 4,
    outroHoldSeconds: 4,
    animateLineEffects: true,
    animateLineEffect: true,
    lineEffectType: 'rose',
    showOutroRose: true,
    outroRoseEnabled: true,
  });

  // Video Export Modal State
  const [isVideoExportOpen, setIsVideoExportOpen] = useState<boolean>(false);

  // Handle Loading GPX from user upload
  const handleLoadGpxString = useCallback((xmlString: string, customName?: string) => {
    try {
      const parsed = parseGpx(xmlString);
      if (customName && (!parsed.name || parsed.name === 'Custom GPX Route')) {
        parsed.name = customName.toUpperCase();
      }
      setRouteData(parsed);
      setActiveSampleId(''); // Clear active sample highlight
    } catch (err) {
      console.error('Error parsing GPX:', err);
    }
  }, []);

  // Handle switching sample route
  const handleSelectSampleRoute = useCallback((sample: SampleRoute) => {
    try {
      const parsed = parseGpx(sample.gpxXml);
      setRouteData(parsed);
      setActiveSampleId(sample.id);
    } catch (err) {
      console.error('Error loading sample route:', err);
    }
  }, []);

  // Update line styling dynamically
  const handleUpdateLineStyle = useCallback((newStyle: Partial<LineStyleSettings>) => {
    setLineStyle((prev) => ({ ...prev, ...newStyle }));
  }, []);

  // Update Waypoint photo URL
  const handleUpdateWaypointPhoto = useCallback((wptId: string, photoUrl: string) => {
    setRouteData((prev) => {
      const updatedWaypoints = prev.waypoints.map((w) => {
        if (w.id === wptId) {
          return { ...w, imageUrl: photoUrl };
        }
        return w;
      });
      return {
        ...prev,
        waypoints: updatedWaypoints,
      };
    });
  }, []);

  // Camera settings handlers
  const handleCameraChange = useCallback((partial: Partial<CameraSettings>) => {
    setCameraSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleSetCameraAltitude = useCallback((altMeters: number) => {
    setCameraSettings((prev) => ({ ...prev, altitudeMeters: altMeters }));
    mapViewerRef.current?.setAltitude(altMeters);
  }, []);

  const handleSetCameraPitch = useCallback((pitch: number) => {
    setCameraSettings((prev) => ({ ...prev, pitch }));
    mapViewerRef.current?.setPitch(pitch);
  }, []);

  const handleSetCameraBearing = useCallback((bearing: number) => {
    setCameraSettings((prev) => ({ ...prev, bearing }));
    mapViewerRef.current?.setBearing(bearing);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-neutral-950 font-sans text-neutral-100">
      {/* 1. Map Container with 3D Terrain & Camera Height (100vh) */}
      <MapViewer
        ref={mapViewerRef}
        routeData={routeData}
        lineStyle={lineStyle}
        basemapStyle={basemapStyle}
        cameraSettings={cameraSettings}
        cinematicIntroOutro={introOutroConfig}
        onCameraChange={handleCameraChange}
        onUpdateWaypointPhoto={handleUpdateWaypointPhoto}
        isDarkTheme={basemapStyle.includes('dark')}
        onOpenVideoExport={() => setIsVideoExportOpen(true)}
      />

      {/* 2. TV-Style Broadcast Lower-Third Text Overlay (Fixed over Map) */}
      {isTvOverlayVisible && (
        <TvBroadcastOverlay
          routeData={routeData}
          accentColor={lineStyle.color}
          overlayStyle={tvStyle}
          position={tvPosition}
          onPositionChange={setTvPosition}
          onStyleChange={setTvStyle}
          isDrawerOpen={isDrawerOpen}
          cameraAltitudeMeters={cameraSettings.altitudeMeters}
          is3dTerrain={cameraSettings.is3dTerrain}
          cameraPitch={cameraSettings.pitch}
          bannerParts={tvBannerParts}
          onBannerPartsChange={setTvBannerParts}
          stageName={stageName}
          onStageNameChange={setStageName}
        />
      )}

      {/* 3. Route Controls & Configuration Drawer */}
      <RouteControlsDrawer
        routeData={routeData}
        lineStyle={lineStyle}
        onUpdateLineStyle={handleUpdateLineStyle}
        basemapStyle={basemapStyle}
        onSelectBasemap={setBasemapStyle}
        onLoadGpxString={handleLoadGpxString}
        activeSampleId={activeSampleId}
        onSelectSampleRoute={handleSelectSampleRoute}
        tvStyle={tvStyle}
        onTvStyleChange={setTvStyle}
        tvPosition={tvPosition}
        onTvPositionChange={setTvPosition}
        isTvOverlayVisible={isTvOverlayVisible}
        onToggleTvOverlay={() => setIsTvOverlayVisible(!isTvOverlayVisible)}
        onUpdateWaypointPhoto={handleUpdateWaypointPhoto}
        isOpen={isDrawerOpen}
        onToggleDrawer={setIsDrawerOpen}
        cameraSettings={cameraSettings}
        onCameraChange={handleCameraChange}
        onSetCameraAltitude={handleSetCameraAltitude}
        onSetCameraPitch={handleSetCameraPitch}
        onSetCameraBearing={handleSetCameraBearing}
        onOpenVideoExport={() => setIsVideoExportOpen(true)}
        tvBannerParts={tvBannerParts}
        onTvBannerPartsChange={setTvBannerParts}
        stageName={stageName}
        onStageNameChange={setStageName}
      />

      {/* 4. Video Export Studio Modal */}
      <VideoExportModal
        isOpen={isVideoExportOpen}
        onClose={() => setIsVideoExportOpen(false)}
        routeData={routeData}
        mapViewerRef={mapViewerRef}
        accentColor={lineStyle.color}
        is3dTerrain={cameraSettings.is3dTerrain}
        initialBannerParts={tvBannerParts}
        cameraAltitudeMeters={cameraSettings.altitudeMeters}
        cameraPitch={cameraSettings.pitch}
        initialFollowMode={mapViewerRef.current?.getFollowMode?.() || 'calm'}
        introOutroConfig={introOutroConfig}
        onIntroOutroConfigChange={setIntroOutroConfig}
        stageName={stageName}
        onStageNameChange={setStageName}
      />
    </main>
  );
}
