import React, { useState } from 'react';
import { GpxRouteData } from '../utils/gpxParser';
import { 
  Tv, 
  MapPin, 
  Clock, 
  TrendingUp, 
  Radio, 
  Maximize2, 
  Minimize2, 
  Move,
  Edit2,
  Check,
  Sliders,
  CheckSquare,
  Square
} from 'lucide-react';
import { TvBannerPartsConfig, DEFAULT_TV_BANNER_PARTS } from '../utils/videoExporter';

export type TvOverlayStyle = 'broadcast' | 'sports' | 'cinematic' | 'telemetry';
export type TvOverlayPosition = 'bottom-left' | 'bottom-center' | 'bottom-right';

interface TvBroadcastOverlayProps {
  routeData: GpxRouteData | null;
  accentColor: string;
  overlayStyle: TvOverlayStyle;
  position: TvOverlayPosition;
  onPositionChange: (pos: TvOverlayPosition) => void;
  onStyleChange: (style: TvOverlayStyle) => void;
  currentElevation?: number;
  currentProgressPercent?: number;
  isDrawerOpen?: boolean;
  cameraAltitudeMeters?: number;
  is3dTerrain?: boolean;
  cameraPitch?: number;
  bannerParts?: TvBannerPartsConfig;
  onBannerPartsChange?: (parts: TvBannerPartsConfig) => void;
  stageName?: string;
  onStageNameChange?: (name: string) => void;
}

export const TvBroadcastOverlay: React.FC<TvBroadcastOverlayProps> = ({
  routeData,
  accentColor,
  overlayStyle,
  position,
  onPositionChange,
  onStyleChange,
  currentElevation,
  currentProgressPercent,
  isDrawerOpen = false,
  cameraAltitudeMeters,
  is3dTerrain = false,
  cameraPitch = 0,
  bannerParts,
  onBannerPartsChange,
  stageName,
  onStageNameChange,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isCustomizingParts, setIsCustomizingParts] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');

  // Editable Stage Name state
  const [localStageName, setLocalStageName] = useState('LOCT GPX STAGE');
  const currentStageName = stageName !== undefined ? stageName : localStageName;

  const handleUpdateStageName = (name: string) => {
    if (onStageNameChange) {
      onStageNameChange(name);
    } else {
      setLocalStageName(name);
    }
  };

  const [isEditingStageInline, setIsEditingStageInline] = useState(false);
  const [inlineStageVal, setInlineStageVal] = useState(currentStageName);

  React.useEffect(() => {
    if (!isEditingStageInline) {
      setInlineStageVal(currentStageName);
    }
  }, [currentStageName, isEditingStageInline]);

  // Fallback internal state if not managed by parent
  const [localParts, setLocalParts] = useState<TvBannerPartsConfig>(DEFAULT_TV_BANNER_PARTS);
  const activeParts = bannerParts || localParts;

  const updatePart = (key: keyof TvBannerPartsConfig, val: boolean) => {
    const next = { ...activeParts, [key]: val };
    if (onBannerPartsChange) {
      onBannerPartsChange(next);
    } else {
      setLocalParts(next);
    }
  };

  const setAllParts = (val: boolean) => {
    const next: TvBannerPartsConfig = {
      showBadge: val,
      showTitle: val,
      showSubtitle: val,
      showTelemetry: val,
      showLiveTag: val,
      showProgressBar: val,
      showAccentBar: val,
    };
    if (onBannerPartsChange) {
      onBannerPartsChange(next);
    } else {
      setLocalParts(next);
    }
  };

  if (!routeData) return null;

  const displayTitle = customTitle || routeData.name || 'ROUTE OVERVIEW';
  const autoSubtitle = `${routeData.totalDistanceKm} KM (${routeData.totalDistanceMiles} MI) • ${
    routeData.formattedDuration ? `${routeData.formattedDuration} • ` : ''
  }${routeData.waypoints.length} WAYPOINTS • +${routeData.elevationGainM}M ELEVATION`;

  const displaySubtitle = customSubtitle || autoSubtitle;

  const leftOffsetClass = isDrawerOpen ? 'bottom-6 left-6 md:left-[404px] items-start' : 'bottom-6 left-6 items-start';

  const positionClasses = {
    'bottom-left': leftOffsetClass,
    'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2 items-center',
    'bottom-right': 'bottom-6 right-6 items-end',
  }[position];

  if (isMinimized) {
    return (
      <div 
        className={`absolute z-30 pointer-events-auto transition-all duration-300 ${positionClasses}`}
        data-testid="tv-overlay-minimized"
      >
        <button
          onClick={() => setIsMinimized(false)}
          aria-label="Expand TV Broadcast Overlay"
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-neutral-900/90 backdrop-blur-md border border-neutral-700/80 shadow-2xl text-xs font-semibold text-neutral-200 hover:text-white hover:border-neutral-500 transition-all cursor-pointer"
        >
          <div className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: accentColor }} />
          <Tv className="w-4 h-4 text-neutral-300" />
          <span className="tracking-wider uppercase font-bold text-neutral-100">LOWER-THIRD OVERLAY</span>
          <Maximize2 className="w-3.5 h-3.5 text-neutral-400 ml-1" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="TV Broadcast Route Lower-Third"
      className={`absolute z-30 pointer-events-auto transition-all duration-300 select-none max-w-[94vw] sm:max-w-2xl ${positionClasses}`}
      data-testid="tv-broadcast-overlay"
    >
      {/* Broadcast Lower-Third Main Container */}
      <div className="group relative flex flex-col overflow-hidden rounded-xl bg-neutral-950/85 backdrop-blur-xl border border-neutral-800/90 shadow-2xl transition-all duration-300 hover:border-neutral-700/80">
        
        {/* Top Control Ribbon (subtle, accessible) */}
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-neutral-900/80 border-b border-neutral-800/80 text-[11px] font-mono tracking-wider text-neutral-400">
          <div className="flex items-center gap-2">
            {activeParts.showLiveTag && (
              <span className="flex items-center gap-1.5 text-red-500 font-bold uppercase text-[10px] tracking-widest">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                LIVE TELECAST
              </span>
            )}
            {activeParts.showLiveTag && <span className="text-neutral-600">|</span>}
            <span className="text-neutral-300 uppercase font-medium">GPS CH-1</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Position switcher */}
            <button
              onClick={() => {
                const nextPos: Record<TvOverlayPosition, TvOverlayPosition> = {
                  'bottom-left': 'bottom-center',
                  'bottom-center': 'bottom-right',
                  'bottom-right': 'bottom-left',
                };
                onPositionChange(nextPos[position]);
              }}
              title="Change overlay position"
              aria-label={`Position: ${position}. Click to cycle.`}
              className="p-1 rounded hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
            >
              <Move className="w-3 h-3" />
            </button>

            {/* Style switcher */}
            <button
              onClick={() => {
                const styles: TvOverlayStyle[] = ['broadcast', 'sports', 'cinematic', 'telemetry'];
                const next = styles[(styles.indexOf(overlayStyle) + 1) % styles.length];
                onStyleChange(next);
              }}
              title="Switch lower-third graphic style"
              aria-label={`Style: ${overlayStyle}. Click to toggle.`}
              className="px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            >
              {overlayStyle}
            </button>

            {/* Quick Customize Parts */}
            <button
              onClick={() => {
                setIsCustomizingParts(!isCustomizingParts);
                if (isEditingTitle) setIsEditingTitle(false);
              }}
              title="Customize Banner Components"
              aria-label="Customize banner parts visibility"
              className={`p-1 rounded transition-colors ${
                isCustomizingParts ? 'bg-amber-500 text-black' : 'hover:bg-neutral-800 hover:text-neutral-200'
              }`}
            >
              <Sliders className="w-3 h-3" />
            </button>

            {/* Quick Edit */}
            <button
              onClick={() => {
                setIsEditingTitle(!isEditingTitle);
                if (isCustomizingParts) setIsCustomizingParts(false);
              }}
              title="Edit Title Card"
              aria-label="Edit title card text"
              className="p-1 rounded hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
            >
              {isEditingTitle ? <Check className="w-3 h-3 text-emerald-400" /> : <Edit2 className="w-3 h-3" />}
            </button>

            {/* Minimize */}
            <button
              onClick={() => setIsMinimized(true)}
              title="Minimize lower-third"
              aria-label="Minimize lower-third"
              className="p-1 rounded hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
            >
              <Minimize2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Banner Parts Customizer Panel if active */}
        {isCustomizingParts && (
          <div className="p-3 bg-neutral-900 border-b border-neutral-800 flex flex-col gap-2.5 text-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="font-mono uppercase font-bold text-[10px] tracking-wider text-amber-400">
                DISPLAY / HIDE BANNER PARTS
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAllParts(true)}
                  className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                >
                  Show All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const minimal: TvBannerPartsConfig = {
                      showBadge: false,
                      showTitle: true,
                      showSubtitle: false,
                      showTelemetry: true,
                      showLiveTag: false,
                      showProgressBar: true,
                      showAccentBar: true,
                    };
                    if (onBannerPartsChange) onBannerPartsChange(minimal);
                    else setLocalParts(minimal);
                  }}
                  className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                >
                  Minimal
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomizingParts(false)}
                  className="p-0.5 rounded text-neutral-400 hover:text-white"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono text-[10px]">
              {[
                { key: 'showTitle', label: 'Route Title' },
                { key: 'showSubtitle', label: 'Subtitle Summary' },
                { key: 'showBadge', label: 'Stage & 3D Badge' },
                { key: 'showTelemetry', label: 'Stats Strip (KM/Elev)' },
                { key: 'showLiveTag', label: 'Live Stamp & Cam Alt' },
                { key: 'showProgressBar', label: 'Progress Scrub Bar' },
                { key: 'showAccentBar', label: 'Accent Color Line' },
              ].map(({ key, label }) => {
                const isChecked = activeParts[key as keyof TvBannerPartsConfig];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updatePart(key as keyof TvBannerPartsConfig, !isChecked)}
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      isChecked
                        ? 'border-amber-400/50 bg-amber-500/10 text-white'
                        : 'border-neutral-800 bg-neutral-950/60 text-neutral-400'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    )}
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Editing Bar if active */}
        {isEditingTitle && (
          <div className="p-3 bg-neutral-900 border-b border-neutral-800 flex flex-col gap-2.5 text-xs">
            {/* Stage Name input */}
            <div className="flex gap-2 items-center">
              <label htmlFor="overlay-custom-stage" className="text-neutral-400 font-mono text-[10px] uppercase w-16">Stage:</label>
              <input
                id="overlay-custom-stage"
                type="text"
                value={currentStageName}
                placeholder="e.g. STAGE 1, QUEEN STAGE"
                onChange={(e) => handleUpdateStageName(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-neutral-100 text-xs focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            {/* Stage Quick Presets */}
            <div className="flex items-center gap-1.5 pl-18 flex-wrap">
              <span className="text-[9px] text-neutral-500 font-mono uppercase">Presets:</span>
              {['STAGE 1', 'STAGE 2', 'QUEEN STAGE', 'PROLOGUE', 'FINAL STAGE', 'LOCT GPX STAGE'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleUpdateStageName(preset)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase transition-colors cursor-pointer ${
                    currentStageName === preset 
                      ? 'bg-amber-500 text-black font-bold' 
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              <label htmlFor="overlay-custom-title" className="text-neutral-400 font-mono text-[10px] uppercase w-16">Title:</label>
              <input
                id="overlay-custom-title"
                type="text"
                value={customTitle}
                placeholder={routeData.name}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-neutral-100 text-xs focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
            <div className="flex gap-2 items-center">
              <label htmlFor="overlay-custom-sub" className="text-neutral-400 font-mono text-[10px] uppercase w-16">Subtitle:</label>
              <input
                id="overlay-custom-sub"
                type="text"
                value={customSubtitle}
                placeholder={autoSubtitle}
                onChange={(e) => setCustomSubtitle(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-neutral-100 text-xs focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  handleUpdateStageName('LOCT GPX STAGE');
                  setCustomTitle('');
                  setCustomSubtitle('');
                }}
                className="px-2 py-0.5 rounded text-[10px] text-neutral-400 hover:text-white cursor-pointer"
              >
                Reset to Default
              </button>
              <button
                type="button"
                onClick={() => setIsEditingTitle(false)}
                className="px-2.5 py-1 rounded text-[10px] bg-amber-500 hover:bg-amber-400 text-black font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Lower-Third Core Card */}
        <div className="relative flex items-stretch">
          
          {/* TV Broadcast Left Accent Bar with Glow */}
          {activeParts.showAccentBar && (
            <div 
              className="w-2.5 sm:w-3 shrink-0 transition-colors duration-300 relative overflow-hidden"
              style={{ 
                backgroundColor: accentColor,
                boxShadow: `0 0 15px ${accentColor}80` 
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-black/30" />
            </div>
          )}

          {/* Main Lower-Third Content */}
          <div className="flex-1 p-3.5 sm:p-4 pr-5 flex flex-col justify-center min-w-0">
            
            {/* Top Category / Stage Badge (Interactive & Click-to-Edit) */}
            {activeParts.showBadge && (
              <div className="flex items-center gap-2 mb-1">
                {isEditingStageInline ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleUpdateStageName(inlineStageVal.trim() || 'LOCT GPX STAGE');
                      setIsEditingStageInline(false);
                    }}
                    className="inline-flex items-center"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={inlineStageVal}
                      onChange={(e) => setInlineStageVal(e.target.value)}
                      onBlur={() => {
                        handleUpdateStageName(inlineStageVal.trim() || 'LOCT GPX STAGE');
                        setIsEditingStageInline(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setInlineStageVal(currentStageName);
                          setIsEditingStageInline(false);
                        }
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest text-black shadow-sm font-mono outline-none ring-2 ring-white"
                      style={{ backgroundColor: accentColor, minWidth: '100px' }}
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setInlineStageVal(currentStageName);
                      setIsEditingStageInline(true);
                    }}
                    title="Click to edit Stage Name"
                    className="group/badge inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest text-black shadow-sm transition-all hover:scale-105 hover:brightness-110 active:scale-95 cursor-pointer"
                    style={{ backgroundColor: accentColor }}
                  >
                    <span>{currentStageName}</span>
                    <Edit2 className="w-2.5 h-2.5 opacity-60 group-hover/badge:opacity-100 transition-opacity" />
                  </button>
                )}
                {is3dTerrain && (
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/40">
                    3D TERRAIN ({cameraPitch}°)
                  </span>
                )}
                <span className="text-[11px] font-mono tracking-wider text-neutral-400 uppercase truncate">
                  {routeData.author ? `BY ${routeData.author}` : 'EXPEDITION PROFILE'}
                </span>
              </div>
            )}

            {/* Broadcast Bold Title */}
            {activeParts.showTitle && (
              <h1 
                className="text-lg sm:text-2xl font-black uppercase tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-tight truncate"
                style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
              >
                {displayTitle}
              </h1>
            )}

            {/* Broadcast Subtitle & Quick Stats */}
            {activeParts.showSubtitle && (
              <div className="mt-1 flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-300">
                <span className="font-semibold text-neutral-100 tracking-wide">
                  {displaySubtitle}
                </span>
              </div>
            )}

            {/* Telemetry Strip (Distance, Elev, Waypoints) */}
            {activeParts.showTelemetry && (
              <div className="mt-2.5 grid grid-cols-4 gap-2 pt-2 border-t border-neutral-800/90 text-neutral-300 font-mono text-[11px]">
                
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider text-neutral-400">DISTANCE</span>
                  <span className="font-bold text-white text-xs sm:text-sm">
                    {routeData.totalDistanceKm} <span className="text-[10px] font-normal text-neutral-400">km</span>
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider text-neutral-400">ELEV GAIN</span>
                  <span className="font-bold text-amber-400 text-xs sm:text-sm">
                    +{routeData.elevationGainM} <span className="text-[10px] font-normal text-neutral-400">m</span>
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider text-neutral-400">DURATION</span>
                  <span className="font-bold text-neutral-100 text-xs sm:text-sm">
                    {routeData.formattedDuration || '2h 15m'}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider text-neutral-400">POINTS / WP</span>
                  <span className="font-bold text-cyan-400 text-xs sm:text-sm">
                    {routeData.waypoints.length} <span className="text-[10px] font-normal text-neutral-400">pins</span>
                  </span>
                </div>

              </div>
            )}

            {/* Scrub / Progress Bar if route animation active */}
            {activeParts.showProgressBar && currentProgressPercent !== undefined && (
              <div className="mt-2 w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-150"
                  style={{ 
                    width: `${Math.min(100, Math.max(0, currentProgressPercent))}%`,
                    backgroundColor: accentColor 
                  }}
                />
              </div>
            )}

          </div>

          {/* Right Live Stamp Graphic */}
          {activeParts.showLiveTag && (
            <div className="hidden sm:flex flex-col justify-between items-end p-3 border-l border-neutral-800/80 bg-neutral-900/40 text-right min-w-[105px]">
              <div className="flex items-center gap-1 text-[10px] font-mono text-neutral-400">
                <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                <span>{is3dTerrain ? '3D DEM' : '4K GL'}</span>
              </div>
              
              {cameraAltitudeMeters !== undefined && (
                <div className="flex flex-col items-end">
                  <span className="text-[9px] uppercase font-mono text-neutral-400">CAM ALT</span>
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    {cameraAltitudeMeters >= 10000 ? `${(cameraAltitudeMeters / 1000).toFixed(1)}k m` : `${cameraAltitudeMeters.toLocaleString()}m`}
                  </span>
                </div>
              )}

              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase font-mono text-neutral-400">PEAK ELEV</span>
                <span className="text-xs font-mono font-bold text-white">
                  {routeData.maxElevationM}m
                </span>
              </div>
            </div>
          )}

        </div>

      </div>
    </aside>
  );
};
