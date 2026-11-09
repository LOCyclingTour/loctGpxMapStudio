import React, { useState, useRef } from 'react';
import { GpxRouteData, GpxWaypoint } from '../utils/gpxParser';
import { SAMPLE_ROUTES, SampleRoute } from '../data/sampleRoutes';
import { LineStyleSettings, CameraSettings } from './MapViewer';
import { TvOverlayPosition, TvOverlayStyle } from './TvBroadcastOverlay';
import { ElevationProfile } from './ElevationProfile';
import { formatAltitude } from '../utils/cameraMath';
import {
  Upload,
  Sliders,
  Map as MapIcon,
  MapPin,
  Mountain,
  Tv,
  Check,
  ChevronRight,
  ChevronLeft,
  Image as ImageIcon,
  Palette,
  FileText,
  Compass,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Box,
  Eye,
  Navigation,
  RotateCw,
  Film,
  CheckSquare,
  Square,
  Tag
} from 'lucide-react';
import { TvBannerPartsConfig, DEFAULT_TV_BANNER_PARTS } from '../utils/videoExporter';
import { WaypointPinSettings, DEFAULT_WAYPOINT_PIN_SETTINGS } from '../utils/waypointSettings';

interface RouteControlsDrawerProps {
  routeData: GpxRouteData | null;
  lineStyle: LineStyleSettings;
  onUpdateLineStyle: (newStyle: Partial<LineStyleSettings>) => void;
  basemapStyle: string;
  onSelectBasemap: (styleUrl: string) => void;
  onLoadGpxString: (gpxStr: string, sourceName?: string) => void;
  activeSampleId: string;
  onSelectSampleRoute: (sample: SampleRoute) => void;
  tvStyle: TvOverlayStyle;
  onTvStyleChange: (s: TvOverlayStyle) => void;
  tvPosition: TvOverlayPosition;
  onTvPositionChange: (p: TvOverlayPosition) => void;
  isTvOverlayVisible: boolean;
  onToggleTvOverlay: () => void;
  onUpdateWaypointPhoto: (wptId: string, url: string) => void;
  onFlyToWaypoint?: (wpt: GpxWaypoint) => void;
  isOpen: boolean;
  onToggleDrawer: (open: boolean) => void;
  cameraSettings: CameraSettings;
  onCameraChange: (settings: Partial<CameraSettings>) => void;
  onSetCameraAltitude: (altitudeMeters: number) => void;
  onSetCameraPitch: (pitch: number) => void;
  onSetCameraBearing: (bearing: number) => void;
  onOpenVideoExport?: () => void;
  tvBannerParts?: TvBannerPartsConfig;
  onTvBannerPartsChange?: (parts: TvBannerPartsConfig) => void;
  stageName?: string;
  onStageNameChange?: (name: string) => void;
  waypointPinSettings?: WaypointPinSettings;
  onUpdateWaypointPinSettings?: (settings: WaypointPinSettings) => void;
  customTitle?: string;
  onCustomTitleChange?: (title: string) => void;
  customSubtitle?: string;
  onCustomSubtitleChange?: (subtitle: string) => void;
  customDuration?: string;
  onCustomDurationChange?: (duration: string) => void;
  flythroughDurationSeconds?: number;
  onFlythroughDurationSecondsChange?: (seconds: number) => void;
}

import {
  BASEMAP_OPTIONS,
  SATELLITE_STYLE_DATA_URL,
  TOPO_STYLE_DATA_URL,
} from '../utils/basemapStyles';

export {
  BASEMAP_OPTIONS,
  SATELLITE_STYLE_DATA_URL,
  TOPO_STYLE_DATA_URL,
};

const PRESET_COLORS = [
  { label: 'Electric Amber', hex: '#f59e0b' },
  { label: 'Neon Cyan', hex: '#06b6d4' },
  { label: 'Tour Yellow', hex: '#eab308' },
  { label: 'Hot Pink', hex: '#ec4899' },
  { label: 'Alpine Emerald', hex: '#10b981' },
  { label: 'Crimson Red', hex: '#ef4444' },
  { label: 'Ultra Violet', hex: '#a855f7' },
  { label: 'Pure White', hex: '#ffffff' },
];

export const RouteControlsDrawer: React.FC<RouteControlsDrawerProps> = ({
  routeData,
  lineStyle,
  onUpdateLineStyle,
  basemapStyle,
  onSelectBasemap,
  onLoadGpxString,
  activeSampleId,
  onSelectSampleRoute,
  tvStyle,
  onTvStyleChange,
  tvPosition,
  onTvPositionChange,
  isTvOverlayVisible,
  onToggleTvOverlay,
  onUpdateWaypointPhoto,
  onFlyToWaypoint,
  isOpen,
  onToggleDrawer,
  cameraSettings,
  onCameraChange,
  onSetCameraAltitude,
  onSetCameraPitch,
  onSetCameraBearing,
  onOpenVideoExport,
  tvBannerParts,
  onTvBannerPartsChange,
  stageName,
  onStageNameChange,
  waypointPinSettings,
  onUpdateWaypointPinSettings,
  customTitle,
  onCustomTitleChange,
  customSubtitle,
  onCustomSubtitleChange,
  customDuration,
  onCustomDurationChange,
  flythroughDurationSeconds = 24,
  onFlythroughDurationSecondsChange,
}) => {
  const [activeTab, setActiveTab] = useState<'routes' | 'style' | '3d' | 'waypoints' | 'profile' | 'tv'>('routes');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fallback waypoint pin settings if not controlled from parent
  const [localPinSettings, setLocalPinSettings] = useState<WaypointPinSettings>(DEFAULT_WAYPOINT_PIN_SETTINGS);
  const currentPinSettings = waypointPinSettings || localPinSettings;

  const handleUpdatePinSettings = (patch: Partial<WaypointPinSettings>) => {
    const next = { ...currentPinSettings, ...patch };
    if (onUpdateWaypointPinSettings) {
      onUpdateWaypointPinSettings(next);
    } else {
      setLocalPinSettings(next);
    }
  };

  // Fallback banner parts if not controlled from parent
  const [localParts, setLocalParts] = useState<TvBannerPartsConfig>(DEFAULT_TV_BANNER_PARTS);
  const currentBannerParts = tvBannerParts || localParts;

  const handleTogglePart = (key: keyof TvBannerPartsConfig) => {
    const next = { ...currentBannerParts, [key]: !currentBannerParts[key] };
    if (onTvBannerPartsChange) {
      onTvBannerPartsChange(next);
    } else {
      setLocalParts(next);
    }
  };

  const handleSetAllParts = (val: boolean) => {
    const next: TvBannerPartsConfig = {
      showBadge: val,
      showTitle: val,
      showSubtitle: val,
      showTelemetry: val,
      showLiveTag: val,
      showProgressBar: val,
      showAccentBar: val,
    };
    if (onTvBannerPartsChange) {
      onTvBannerPartsChange(next);
    } else {
      setLocalParts(next);
    }
  };

  // Handle GPX File upload
  const handleFileUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.gpx') && !file.type.includes('xml')) {
      setUploadError('Please select a valid .gpx file.');
      return;
    }
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onLoadGpxString(content, file.name.replace(/\.gpx$/i, ''));
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read the selected file.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const formattedAlt = formatAltitude(cameraSettings.altitudeMeters);

  // Quick camera presets
  const applyCameraPreset = (name: string, altM: number, pitchDeg: number, enable3d: boolean) => {
    onCameraChange({
      is3dTerrain: enable3d,
      pitch: pitchDeg,
    });
    onSetCameraPitch(pitchDeg);
    onSetCameraAltitude(altM);
  };

  return (
    <>
      {/* Floating Toggle Button when drawer is collapsed */}
      {!isOpen && (
        <button
          onClick={() => onToggleDrawer(true)}
          aria-label="Open route controls drawer"
          className="absolute top-5 left-5 z-30 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-neutral-900/95 hover:bg-neutral-800 text-white font-semibold text-xs tracking-wider shadow-2xl backdrop-blur-md border border-neutral-700/80 cursor-pointer transition-all hover:border-amber-400"
        >
          <Sliders className="w-4 h-4 text-amber-400" />
          <span>ROUTE CONTROLS</span>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
        </button>
      )}

      {/* Main Drawer Panel */}
      <div
        className={`absolute top-0 left-0 bottom-0 z-30 w-80 sm:w-96 bg-neutral-950/95 backdrop-blur-2xl border-r border-neutral-800/90 shadow-2xl flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        data-testid="route-controls-drawer"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-800 bg-neutral-900/60">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: lineStyle.color, boxShadow: `0 0 10px ${lineStyle.color}` }} 
            />
            <span className="font-mono font-bold text-xs tracking-wider uppercase text-neutral-100">
              LOCT GPX MAP STUDIO
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenVideoExport && (
              <button
                onClick={onOpenVideoExport}
                title="Export Video"
                aria-label="Open Video Export Studio"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 font-mono text-[10px] font-bold tracking-wider transition-colors cursor-pointer"
              >
                <Film className="w-3 h-3 text-amber-400" />
                <span>EXPORT</span>
              </button>
            )}

            <button
              onClick={() => onToggleDrawer(false)}
              aria-label="Close controls drawer"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav aria-label="Controls Tabs" className="grid grid-cols-6 border-b border-neutral-800 bg-neutral-900/30 text-xs">
          <button
            onClick={() => setActiveTab('routes')}
            aria-label="Routes & Upload"
            className={`py-2 flex flex-col items-center gap-1 font-mono text-[9px] uppercase font-semibold transition-colors ${
              activeTab === 'routes'
                ? 'text-amber-400 border-b-2 border-amber-400 bg-neutral-900/60'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Routes</span>
          </button>

          <button
            onClick={() => setActiveTab('style')}
            aria-label="Line Effect Styling"
            className={`py-2 flex flex-col items-center gap-1 font-mono text-[9px] uppercase font-semibold transition-colors ${
              activeTab === 'style'
                ? 'text-amber-400 border-b-2 border-amber-400 bg-neutral-900/60'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Style</span>
          </button>

          <button
            onClick={() => setActiveTab('3d')}
            aria-label="3D & Camera Height"
            className={`py-2 flex flex-col items-center gap-1 font-mono text-[9px] uppercase font-semibold transition-colors ${
              activeTab === '3d'
                ? 'text-amber-400 border-b-2 border-amber-400 bg-neutral-900/60'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D &amp; Cam</span>
          </button>

          <button
            onClick={() => setActiveTab('waypoints')}
            aria-label="Waypoints & Photos"
            className={`py-2 flex flex-col items-center gap-1 font-mono text-[9px] uppercase font-semibold transition-colors ${
              activeTab === 'waypoints'
                ? 'text-amber-400 border-b-2 border-amber-400 bg-neutral-900/60'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Pins ({routeData?.waypoints.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            aria-label="Elevation Profile"
            className={`py-2 flex flex-col items-center gap-1 font-mono text-[9px] uppercase font-semibold transition-colors ${
              activeTab === 'profile'
                ? 'text-amber-400 border-b-2 border-amber-400 bg-neutral-900/60'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>Elev</span>
          </button>

          <button
            onClick={() => setActiveTab('tv')}
            aria-label="TV Broadcast Overlay"
            className={`py-2 flex flex-col items-center gap-1 font-mono text-[9px] uppercase font-semibold transition-colors ${
              activeTab === 'tv'
                ? 'text-amber-400 border-b-2 border-amber-400 bg-neutral-900/60'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>HUD</span>
          </button>
        </nav>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-neutral-300">
          
          {/* TAB 1: ROUTES & GPX UPLOAD */}
          {activeTab === 'routes' && (
            <div className="space-y-4">
              
              {/* GPX Drag & Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                  isDragging
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/40 hover:bg-neutral-900/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".gpx,application/gpx+xml,text/xml"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                  data-testid="gpx-file-input"
                />

                <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-2.5 text-amber-400">
                  <Upload className="w-6 h-6" />
                </div>

                <span className="font-semibold text-neutral-100 text-sm">
                  Upload GPX File
                </span>
                <span className="text-[11px] text-neutral-400 text-center mt-1">
                  Drag and drop .gpx here or click to browse
                </span>

                <span className="mt-3 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-neutral-800 text-neutral-300">
                  AUTO-EXTRACTS TRK &amp; WPT
                </span>
              </div>

              {uploadError && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-xs">
                  {uploadError}
                </div>
              )}

              {/* Sample GPX Routes */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                    CURATED SAMPLE ROUTES
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">4 INCLUDED</span>
                </div>

                <div className="space-y-2">
                  {SAMPLE_ROUTES.map((sample) => {
                    const isSelected = activeSampleId === sample.id;
                    return (
                      <button
                        key={sample.id}
                        onClick={() => onSelectSampleRoute(sample)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-neutral-900 border-amber-400/90 shadow-lg'
                            : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                            {sample.badge}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                        </div>

                        <span className="font-semibold text-neutral-100 text-sm leading-tight">
                          {sample.title}
                        </span>

                        <span className="text-[11px] text-neutral-400">
                          {sample.region}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: LINE EFFECT & BASEMAP STYLING */}
          {activeTab === 'style' && (
            <div className="space-y-5">
              
              {/* Line Color Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="custom-hex-color" className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                    LINE COLOR (line-color)
                  </label>
                  <span className="font-mono text-xs text-neutral-300">{lineStyle.color}</span>
                </div>

                {/* Preset Palette */}
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((col) => (
                    <button
                      key={col.hex}
                      onClick={() => onUpdateLineStyle({ color: col.hex })}
                      title={col.label}
                      className={`h-8 rounded-lg border flex items-center justify-center transition-all ${
                        lineStyle.color.toLowerCase() === col.hex.toLowerCase()
                          ? 'border-white scale-105 shadow-md'
                          : 'border-transparent hover:border-neutral-600'
                      }`}
                      style={{ backgroundColor: col.hex }}
                    >
                      {lineStyle.color.toLowerCase() === col.hex.toLowerCase() && (
                        <Check className={`w-3.5 h-3.5 ${col.hex === '#ffffff' ? 'text-black' : 'text-white'}`} />
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom Color Input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="custom-color-picker"
                    type="color"
                    value={lineStyle.color}
                    onChange={(e) => onUpdateLineStyle({ color: e.target.value })}
                    aria-label="Custom color picker"
                    className="w-8 h-8 rounded border border-neutral-700 bg-transparent cursor-pointer p-0"
                  />
                  <input
                    id="custom-hex-color"
                    type="text"
                    value={lineStyle.color}
                    onChange={(e) => onUpdateLineStyle({ color: e.target.value })}
                    aria-label="Hex color string"
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 font-mono text-xs text-neutral-100 uppercase"
                  />
                </div>
              </div>

              {/* Line Width Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="line-width-slider" className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                    LINE WIDTH (line-width)
                  </label>
                  <span className="font-mono text-xs text-amber-400 font-bold">{lineStyle.width}px</span>
                </div>
                <input
                  id="line-width-slider"
                  type="range"
                  min="1"
                  max="16"
                  step="1"
                  value={lineStyle.width}
                  onChange={(e) => onUpdateLineStyle({ width: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {/* Line Pattern / Dasharray */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                    LINE DASHARRAY (line-dasharray)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['solid', 'dashed', 'dotted'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => onUpdateLineStyle({ dashType: type })}
                      className={`py-2 px-3 rounded-lg border font-mono text-xs uppercase font-semibold transition-all ${
                        lineStyle.dashType === type
                          ? 'border-amber-400 bg-neutral-900 text-amber-400'
                          : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line Opacity Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="line-opacity-slider" className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                    LINE OPACITY (line-opacity)
                  </label>
                  <span className="font-mono text-xs text-neutral-300">
                    {Math.round(lineStyle.opacity * 100)}%
                  </span>
                </div>
                <input
                  id="line-opacity-slider"
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={lineStyle.opacity}
                  onChange={(e) => onUpdateLineStyle({ opacity: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {/* Smooth Edges Note */}
              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 font-mono text-[10px] text-neutral-400 space-y-1">
                <div className="text-neutral-200 font-bold uppercase">SMOOTH RENDERING APPLIED</div>
                <div>• line-join: &quot;round&quot;</div>
                <div>• line-cap: &quot;round&quot;</div>
              </div>

              {/* Basemap Selection */}
              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                  MAPLIBRE BASEMAP STYLE
                </span>
                <div className="space-y-2">
                  {BASEMAP_OPTIONS.map((mapOpt) => (
                    <button
                      key={mapOpt.id}
                      onClick={() => onSelectBasemap(mapOpt.url)}
                      className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        basemapStyle === mapOpt.url
                          ? 'border-amber-400 bg-neutral-900 text-white shadow'
                          : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white hover:border-neutral-700'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs text-neutral-100">{mapOpt.name}</div>
                        <div className="text-[10px] text-neutral-400 font-mono">{mapOpt.tag}</div>
                      </div>
                      {basemapStyle === mapOpt.url && <Check className="w-4 h-4 text-amber-400" />}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: 3D TERRAIN & CAMERA HEIGHT */}
          {activeTab === '3d' && (
            <div className="space-y-5">
              
              {/* 3D Terrain Main Toggle */}
              <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="font-mono font-bold text-xs text-white uppercase">3D TERRAIN MESH</div>
                      <div className="text-[10px] text-neutral-400">AWS Terrarium DEM Elevation</div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const next3d = !cameraSettings.is3dTerrain;
                      onCameraChange({
                        is3dTerrain: next3d,
                        pitch: next3d ? 62 : 0,
                      });
                      onSetCameraPitch(next3d ? 62 : 0);
                    }}
                    aria-label="Toggle 3D Elevation Terrain"
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      cameraSettings.is3dTerrain ? 'bg-amber-500' : 'bg-neutral-800'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                        cameraSettings.is3dTerrain ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {cameraSettings.is3dTerrain && (
                  <div className="pt-2 border-t border-neutral-800/80 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-neutral-400 uppercase">VERTICAL EXAGGERATION:</span>
                      <span className="font-bold text-amber-400">{cameraSettings.terrainExaggeration.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="3.0"
                      step="0.1"
                      value={cameraSettings.terrainExaggeration}
                      onChange={(e) => onCameraChange({ terrainExaggeration: parseFloat(e.target.value) })}
                      aria-label="Terrain elevation exaggeration"
                      className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                  </div>
                )}
              </div>

              {/* CAMERA HEIGHT (ALTITUDE) SLIDER */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <label htmlFor="cam-height-slider" className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-300">
                      CAMERA HEIGHT (ALTITUDE)
                    </label>
                  </div>
                  <div className="font-mono text-xs text-right">
                    <span className="font-bold text-cyan-400">{formattedAlt.metric}</span>
                    <span className="text-neutral-400 text-[10px] ml-1">({formattedAlt.imperial})</span>
                  </div>
                </div>

                {/* Logarithmic-style slider mapping 200m to 30,000m */}
                <input
                  id="cam-height-slider"
                  type="range"
                  min="200"
                  max="30000"
                  step="100"
                  value={cameraSettings.altitudeMeters}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    onSetCameraAltitude(val);
                    onCameraChange({ altitudeMeters: val });
                  }}
                  aria-label="Camera height altitude in meters"
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />

                <div className="flex justify-between text-[9px] font-mono text-neutral-500">
                  <span>200m (Ground)</span>
                  <span>5,000m</span>
                  <span>15,000m</span>
                  <span>30,000m (Orbit)</span>
                </div>
              </div>

              {/* CAMERA PITCH (TILT) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-300">
                    CAMERA PITCH / TILT
                  </span>
                  <span className="font-mono text-xs font-bold text-white">{cameraSettings.pitch}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="1"
                  value={cameraSettings.pitch}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    onSetCameraPitch(val);
                    onCameraChange({ pitch: val });
                  }}
                  aria-label="Camera pitch tilt angle in degrees"
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-[9px] font-mono text-neutral-500">
                  <span>0° (Top-down)</span>
                  <span>45° (Perspective)</span>
                  <span>80° (Horizon)</span>
                </div>
              </div>

              {/* CAMERA BEARING (ROTATION / HEADING) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Navigation 
                      className="w-3.5 h-3.5 text-amber-400 transition-transform" 
                      style={{ transform: `rotate(${-cameraSettings.bearing}deg)` }} 
                    />
                    <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-300">
                      BEARING / HEADING
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white">{cameraSettings.bearing}°</span>
                    <button
                      onClick={() => onSetCameraBearing(0)}
                      title="Reset North"
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white"
                    >
                      Reset N
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="359"
                  step="1"
                  value={cameraSettings.bearing}
                  onChange={(e) => onSetCameraBearing(parseInt(e.target.value))}
                  aria-label="Camera bearing rotation heading in degrees"
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {/* QUICK CAMERA ALTITUDE & 3D PRESETS */}
              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                  CINEMATIC FLIGHT PRESETS
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => applyCameraPreset('Drone', 600, 68, true)}
                    className="p-2 rounded-xl bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-400/60 text-left transition-all"
                  >
                    <div className="font-bold text-white text-[11px]">🚁 Low Drone</div>
                    <div className="text-[9px] text-neutral-400 font-mono">600m Alt • 68° Tilt</div>
                  </button>

                  <button
                    onClick={() => applyCameraPreset('Helicopter', 1800, 60, true)}
                    className="p-2 rounded-xl bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-400/60 text-left transition-all"
                  >
                    <div className="font-bold text-white text-[11px]">🏔️ Helicopter</div>
                    <div className="text-[9px] text-neutral-400 font-mono">1,800m Alt • 60° Tilt</div>
                  </button>

                  <button
                    onClick={() => applyCameraPreset('Alpine', 3500, 55, true)}
                    className="p-2 rounded-xl bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-400/60 text-left transition-all"
                  >
                    <div className="font-bold text-white text-[11px]">⛰️ Alpine Ridge</div>
                    <div className="text-[9px] text-neutral-400 font-mono">3,500m Alt • 55° Tilt</div>
                  </button>

                  <button
                    onClick={() => applyCameraPreset('Flight', 8000, 45, true)}
                    className="p-2 rounded-xl bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-400/60 text-left transition-all"
                  >
                    <div className="font-bold text-white text-[11px]">✈️ High Flight</div>
                    <div className="text-[9px] text-neutral-400 font-mono">8,000m Alt • 45° Tilt</div>
                  </button>

                  <button
                    onClick={() => applyCameraPreset('Orbit', 22000, 25, true)}
                    className="p-2 rounded-xl bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-400/60 text-left transition-all"
                  >
                    <div className="font-bold text-white text-[11px]">🛰️ Stratosphere</div>
                    <div className="text-[9px] text-neutral-400 font-mono">22,000m Alt • 25° Tilt</div>
                  </button>

                  <button
                    onClick={() => applyCameraPreset('2D Top', 5000, 0, false)}
                    className="p-2 rounded-xl bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-400/60 text-left transition-all"
                  >
                    <div className="font-bold text-white text-[11px]">🗺️ 2D Plan View</div>
                    <div className="text-[9px] text-neutral-400 font-mono">Flat 0° Pitch</div>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: WAYPOINTS & PHOTOS */}
          {activeTab === 'waypoints' && (
            <div className="space-y-4">
              {/* WAYPOINT PIN CONFIGURATION CARD */}
              <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-300">
                      Waypoint Pin Style & Behavior
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                    Configurable
                  </span>
                </div>

                {/* Display Mode (Name vs Index vs Both) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase text-neutral-400">
                    Display Label
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleUpdatePinSettings({ displayMode: 'name', pinStyle: 'badge' })}
                      className={`py-1.5 px-2 rounded-md font-bold transition-all ${
                        currentPinSettings.displayMode === 'name'
                          ? 'bg-amber-500 text-black shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Name
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdatePinSettings({ displayMode: 'both' })}
                      className={`py-1.5 px-2 rounded-md font-bold transition-all ${
                        currentPinSettings.displayMode === 'both'
                          ? 'bg-amber-500 text-black shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Both
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdatePinSettings({ displayMode: 'index' })}
                      className={`py-1.5 px-2 rounded-md font-bold transition-all ${
                        currentPinSettings.displayMode === 'index'
                          ? 'bg-amber-500 text-black shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Number (#)
                    </button>
                  </div>
                </div>

                {/* Approach Reveal Animation Switch */}
                <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] font-bold text-neutral-200">
                        Appear on Approach
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdatePinSettings({ approachReveal: !currentPinSettings.approachReveal })}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        currentPinSettings.approachReveal ? 'bg-amber-500' : 'bg-neutral-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          currentPinSettings.approachReveal ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-tight">
                    Name appears dynamically as the route approaches the waypoint with an arrival pulse.
                  </p>

                  {currentPinSettings.approachReveal && (
                    <div className="space-y-2 pt-1 pl-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                        <span>Trigger Distance:</span>
                        <span className="text-amber-400 font-bold">
                          {currentPinSettings.approachDistanceKm ?? 0.8} km
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="3.0"
                        step="0.1"
                        value={currentPinSettings.approachDistanceKm ?? 0.8}
                        onChange={(e) => handleUpdatePinSettings({ approachDistanceKm: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <div className="flex items-center justify-between text-[9px] font-mono text-neutral-500">
                        <span>0.2km (Tight)</span>
                        <span>0.8km (Standard)</span>
                        <span>3.0km (Early)</span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-neutral-300">
                          Keep visible after route passes
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdatePinSettings({ stayVisibleAfterArrival: !currentPinSettings.stayVisibleAfterArrival })}
                          className="text-neutral-400 hover:text-white"
                        >
                          {currentPinSettings.stayVisibleAfterArrival ? (
                            <CheckSquare className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-500" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pin Size & Elevation tag */}
                <div className="pt-2 border-t border-neutral-800/80 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-neutral-400 block mb-1">
                      Pin Size
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-[10px]">
                      {(['small', 'medium', 'large'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => handleUpdatePinSettings({ pinSize: sz })}
                          className={`py-1 rounded capitalize font-medium ${
                            currentPinSettings.pinSize === sz
                              ? 'bg-neutral-800 text-amber-400 font-bold'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          {sz[0].toUpperCase() + sz.slice(1, 3)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase text-neutral-400 block mb-1">
                      Elevation Tag
                    </label>
                    <button
                      type="button"
                      onClick={() => handleUpdatePinSettings({ showElevation: !currentPinSettings.showElevation })}
                      className={`w-full py-1.5 px-2 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
                        currentPinSettings.showElevation
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span>▲ Show Ele</span>
                      {currentPinSettings.showElevation && <Check className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* LIST OF WAYPOINTS */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                  Waypoints on Route ({routeData?.waypoints.length || 0})
                </span>
              </div>

              {(!routeData || routeData.waypoints.length === 0) ? (
                <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800 text-center text-neutral-400">
                  No &lt;wpt&gt; elements found in this GPX file. Upload a GPX containing waypoints or choose one of our sample routes!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {routeData.waypoints.map((wpt, idx) => (
                    <div
                      key={wpt.id}
                      className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-[10px] text-black"
                            style={{ backgroundColor: lineStyle.color }}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-bold text-neutral-100 text-xs">
                            {wpt.name}
                          </span>
                        </div>
                        {wpt.ele !== undefined && (
                          <span className="font-mono text-[10px] text-amber-400 bg-neutral-800 px-1.5 py-0.5 rounded">
                            {wpt.ele}m
                          </span>
                        )}
                      </div>

                      {/* Photo preview if present */}
                      {wpt.imageUrl ? (
                        <div className="relative rounded-lg overflow-hidden h-24 bg-neutral-950 border border-neutral-800">
                          <img
                            src={wpt.imageUrl}
                            alt={wpt.name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => {
                              const newUrl = window.prompt(`Edit image URL for "${wpt.name}":`, wpt.imageUrl);
                              if (newUrl !== null) {
                                onUpdateWaypointPhoto(wpt.id, newUrl.trim());
                              }
                            }}
                            className="absolute bottom-1 right-1 px-2 py-0.5 rounded bg-black/80 hover:bg-black text-[9px] font-mono text-white flex items-center gap-1 backdrop-blur-sm"
                          >
                            <ImageIcon className="w-2.5 h-2.5" />
                            <span>Change</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            const newUrl = window.prompt(
                              `Enter photo URL for waypoint "${wpt.name}":`,
                              'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop'
                            );
                            if (newUrl) {
                              onUpdateWaypointPhoto(wpt.id, newUrl.trim());
                            }
                          }}
                          className="w-full py-1.5 rounded-lg border border-dashed border-neutral-800 hover:border-neutral-700 bg-neutral-950/60 text-neutral-400 hover:text-white flex items-center justify-center gap-1.5 font-mono text-[10px]"
                        >
                          <ImageIcon className="w-3 h-3 text-amber-400" />
                          <span>Attach Photo URL</span>
                        </button>
                      )}

                      {wpt.desc && (
                        <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-2">
                          {wpt.desc}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 pt-1 border-t border-neutral-800/80">
                        <span>{wpt.lat.toFixed(4)}°, {wpt.lng.toFixed(4)}°</span>
                        {onFlyToWaypoint && (
                          <button
                            onClick={() => onFlyToWaypoint(wpt)}
                            className="text-amber-400 hover:text-amber-300 font-bold"
                          >
                            Focus Pin &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ELEVATION PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <ElevationProfile routeData={routeData} accentColor={lineStyle.color} />

              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2 font-mono text-[11px]">
                <div className="text-neutral-200 font-bold uppercase tracking-wider text-xs">
                  ROUTE TELEMETRY SUMMARY
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Total Distance</span>
                  <span className="font-bold text-white">{routeData?.totalDistanceKm} km ({routeData?.totalDistanceMiles} mi)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Track Points</span>
                  <span className="font-bold text-white">{routeData?.points.length} pts</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Est. Duration</span>
                  <span className="font-bold text-white">{routeData?.formattedDuration || '--'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-400">Waypoints</span>
                  <span className="font-bold text-amber-400">{routeData?.waypoints.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: TV BROADCAST HUD */}
          {activeTab === 'tv' && (
            <div className="space-y-4">
              
              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <span className="font-mono uppercase font-bold text-xs text-neutral-200">
                  SHOW TV LOWER-THIRD
                </span>
                <button
                  onClick={onToggleTvOverlay}
                  aria-label="Toggle TV overlay visibility"
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    isTvOverlayVisible ? 'bg-amber-500' : 'bg-neutral-800'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      isTvOverlayVisible ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Route Title & Subtitle Customizer */}
              <div className="space-y-3 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-amber-400">
                    TITLE & SUBTITLE
                  </span>
                  {(customTitle || customSubtitle) && (
                    <button
                      type="button"
                      onClick={() => {
                        onCustomTitleChange?.('');
                        onCustomSubtitleChange?.('');
                      }}
                      className="text-[10px] text-neutral-400 hover:text-white font-mono cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-neutral-400 block">
                    Broadcast Title
                  </label>
                  <input
                    type="text"
                    value={customTitle || ''}
                    placeholder={routeData?.name || 'ROUTE OVERVIEW'}
                    onChange={(e) => onCustomTitleChange?.(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-100 text-xs focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-neutral-400 block">
                    Broadcast Subtitle
                  </label>
                  <input
                    type="text"
                    value={customSubtitle || ''}
                    placeholder={`${routeData?.totalDistanceKm || 0} KM • ${customDuration || routeData?.formattedDuration || '2h 15m'} • +${routeData?.elevationGainM || 0}M ELEV`}
                    onChange={(e) => onCustomSubtitleChange?.(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-100 text-xs focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              {/* Route Duration in Telemetry Strip */}
              <div className="space-y-2 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-amber-400">
                    ROUTE DURATION (HUD)
                  </span>
                  {customDuration && (
                    <button
                      type="button"
                      onClick={() => onCustomDurationChange?.('')}
                      className="text-[10px] text-neutral-400 hover:text-white font-mono cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={customDuration || ''}
                  placeholder={routeData?.formattedDuration || '2h 15m'}
                  onChange={(e) => onCustomDurationChange?.(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-100 text-xs focus:outline-none focus:border-amber-400 font-mono"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[9px] text-neutral-500 font-mono uppercase">Presets:</span>
                  {['1h 30m', '2h 15m', '3h 45m', '4h 30m', '5h 00m'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onCustomDurationChange?.(preset)}
                      className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase transition-colors cursor-pointer ${
                        customDuration === preset
                          ? 'bg-amber-500 text-black font-bold'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Flythrough Playback Duration */}
              <div className="space-y-2.5 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-amber-400">
                    FLYTHROUGH PLAYBACK DURATION
                  </span>
                  <span className="font-mono text-xs font-bold text-white bg-neutral-800 px-2 py-0.5 rounded">
                    {flythroughDurationSeconds}s
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="5"
                    max="90"
                    step="1"
                    value={flythroughDurationSeconds}
                    onChange={(e) => onFlythroughDurationSecondsChange?.(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
                <div className="grid grid-cols-6 gap-1 pt-1 font-mono text-[10px]">
                  {[10, 15, 20, 24, 30, 60].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => onFlythroughDurationSecondsChange?.(sec)}
                      className={`py-1 rounded text-center transition-colors cursor-pointer ${
                        flythroughDurationSeconds === sec
                          ? 'bg-amber-500 text-black font-bold'
                          : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Stage Name Customizer */}
              <div className="space-y-2 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-amber-400">
                    STAGE BADGE NAME
                  </span>
                </div>
                <input
                  type="text"
                  value={stageName || ''}
                  placeholder="e.g. STAGE 1, QUEEN STAGE"
                  onChange={(e) => onStageNameChange?.(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-100 text-xs focus:outline-none focus:border-amber-400 font-mono"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {['STAGE 1', 'STAGE 2', 'QUEEN STAGE', 'PROLOGUE', 'FINAL STAGE', 'LOCT GPX STAGE'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onStageNameChange?.(preset)}
                      className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase transition-colors cursor-pointer ${
                        stageName === preset
                          ? 'bg-amber-500 text-black font-bold'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* TV Banner Components Customization */}
              <div className="space-y-2.5 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-amber-400">
                    BANNER COMPONENTS VISIBILITY
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetAllParts(true)}
                      className="px-2 py-0.5 rounded text-[9px] font-mono uppercase bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                    >
                      All On
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const min = {
                          showBadge: false,
                          showTitle: true,
                          showSubtitle: false,
                          showTelemetry: true,
                          showLiveTag: false,
                          showProgressBar: true,
                          showAccentBar: true,
                        };
                        if (onTvBannerPartsChange) onTvBannerPartsChange(min);
                        else setLocalParts(min);
                      }}
                      className="px-2 py-0.5 rounded text-[9px] font-mono uppercase bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                    >
                      Minimal
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  {[
                    { key: 'showTitle', label: 'Route Title Card', desc: 'Main route headline' },
                    { key: 'showSubtitle', label: 'Subtitle Summary', desc: 'Distance & waypoint text' },
                    { key: 'showBadge', label: 'Stage & 3D Badge', desc: 'Top category identifier' },
                    { key: 'showTelemetry', label: 'Telemetry Stat Strip', desc: 'Distance, gain, duration, pins' },
                    { key: 'showLiveTag', label: 'Live Telecast Stamp', desc: 'Live radio & cam altitude' },
                    { key: 'showProgressBar', label: 'Route Scrubber Bar', desc: 'Animated progress gauge' },
                    { key: 'showAccentBar', label: 'Left Accent Glow Bar', desc: 'Vertical theme color line' },
                  ].map(({ key, label, desc }) => {
                    const isChecked = currentBannerParts[key as keyof TvBannerPartsConfig];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleTogglePart(key as keyof TvBannerPartsConfig)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          isChecked
                            ? 'border-amber-400/40 bg-neutral-900 text-neutral-100'
                            : 'border-neutral-800/80 bg-neutral-950/40 text-neutral-400 hover:text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-600 shrink-0" />
                          )}
                          <div>
                            <div className="font-semibold text-xs leading-none">{label}</div>
                            <div className="text-[10px] text-neutral-400 leading-tight mt-0.5">{desc}</div>
                          </div>
                        </div>

                        <span
                          className={`w-2 h-2 rounded-full ${
                            isChecked ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]' : 'bg-neutral-700'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TV Graphic Style */}
              <div className="space-y-2">
                <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                  GRAPHIC THEME
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(['broadcast', 'sports', 'cinematic', 'telemetry'] as const).map((styleOpt) => (
                    <button
                      key={styleOpt}
                      onClick={() => onTvStyleChange(styleOpt)}
                      className={`p-2.5 rounded-xl border text-left font-mono text-xs uppercase transition-all ${
                        tvStyle === styleOpt
                          ? 'border-amber-400 bg-neutral-900 text-amber-400 font-bold'
                          : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {styleOpt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Screen Position */}
              <div className="space-y-2">
                <span className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                  VIEWPORT POSITION
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['bottom-left', 'bottom-center', 'bottom-right'] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => onTvPositionChange(pos)}
                      className={`py-2 px-1 text-center rounded-lg border font-mono text-[10px] uppercase transition-all ${
                        tvPosition === pos
                          ? 'border-amber-400 bg-neutral-900 text-amber-400 font-bold'
                          : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {pos.replace('bottom-', '')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800 text-[11px] text-neutral-400 leading-relaxed">
                The TV lower-third overlay is pure HTML/CSS anchored over the map viewport, ensuring crisp typography that stays rock-solid during camera rotation, zooming, and track scrubbing.
              </div>

            </div>
          )}

        </div>

      </div>
    </>
  );
};
