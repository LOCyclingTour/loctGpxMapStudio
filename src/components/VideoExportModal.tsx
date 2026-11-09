import React, { useState, useRef, useEffect } from 'react';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { GpxRouteData } from '../utils/gpxParser';
import { 
  VIDEO_RESOLUTIONS, 
  ExportResolution, 
  VideoExportConfig, 
  calculateTotalFrames, 
  getSupportedVideoMimeType, 
  generateVideoFileName,
  drawTvBroadcastCardOnCanvas,
  drawElevationProfileOnCanvas,
  TvBannerPartsConfig,
  DEFAULT_TV_BANNER_PARTS,
  ElevationOverlayPosition,
  waitForMapFrame,
  drawOutroCompassRoseOnCanvas,
  drawWaypointPinsOnCanvas
} from '../utils/videoExporter';
import { 
  WaypointPinSettings, 
  DEFAULT_WAYPOINT_PIN_SETTINGS, 
  computeWaypointsRouteProgress 
} from '../utils/waypointSettings';
import { MapViewerHandle, FollowCamMode } from './MapViewer';
import { 
  CinematicIntroOutroConfig, 
  DEFAULT_INTRO_OUTRO_CONFIG,
  LineEffectType,
  getTimelineState, 
  calculateTotalSequenceDuration, 
  calculateBearing,
  calculateIntroCamera,
  calculateOutroCamera,
  isOutroRoseActive
} from '../utils/cinematicCamera';
import { getRoutePointAtProgress } from '../utils/routeFollow';
import { altitudeToZoom } from '../utils/cameraMath';
import { 
  Film, 
  Video, 
  Download, 
  Play, 
  Check, 
  X, 
  Loader2, 
  Sliders, 
  Layers, 
  Tv, 
  Sparkles, 
  RefreshCw,
  AlertCircle,
  Mountain,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Navigation,
  Compass,
  ShieldCheck,
  Zap,
  MapPin
} from 'lucide-react';

interface VideoExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeData: GpxRouteData | null;
  mapViewerRef: React.RefObject<MapViewerHandle | null>;
  accentColor: string;
  is3dTerrain: boolean;
  initialBannerParts?: TvBannerPartsConfig;
  cameraAltitudeMeters?: number;
  cameraPitch?: number;
  initialFollowMode?: FollowCamMode;
  introOutroConfig?: CinematicIntroOutroConfig;
  onIntroOutroConfigChange?: (config: CinematicIntroOutroConfig) => void;
  stageName?: string;
  onStageNameChange?: (name: string) => void;
  customTitle?: string;
  customSubtitle?: string;
  customDuration?: string;
  flythroughDurationSeconds?: number;
  waypointPinSettings?: WaypointPinSettings;
  onUpdateWaypointPinSettings?: (settings: Partial<WaypointPinSettings>) => void;
}

export const VideoExportModal: React.FC<VideoExportModalProps> = ({
  isOpen,
  onClose,
  routeData,
  mapViewerRef,
  accentColor,
  is3dTerrain,
  initialBannerParts,
  cameraAltitudeMeters,
  cameraPitch,
  initialFollowMode,
  introOutroConfig,
  onIntroOutroConfigChange,
  stageName,
  onStageNameChange,
  customTitle,
  customSubtitle,
  customDuration,
  flythroughDurationSeconds,
  waypointPinSettings,
  onUpdateWaypointPinSettings,
}) => {
  const [selectedResolution, setSelectedResolution] = useState<ExportResolution>(VIDEO_RESOLUTIONS[0]);
  const [durationSeconds, setDurationSeconds] = useState<number>(() => flythroughDurationSeconds || 15);
  const [fps, setFps] = useState<number>(30);
  const [cameraMode, setCameraMode] = useState<FollowCamMode>(() => initialFollowMode || 'calm');
  const [includeOverlay, setIncludeOverlay] = useState<boolean>(true);
  const [bannerParts, setBannerParts] = useState<TvBannerPartsConfig>(() => initialBannerParts || DEFAULT_TV_BANNER_PARTS);
  const [isCustomizingBanner, setIsCustomizingBanner] = useState<boolean>(false);
  const [includeWaypointPins, setIncludeWaypointPins] = useState<boolean>(true);
  const [currentPinSettings, setCurrentPinSettings] = useState<WaypointPinSettings>(() => waypointPinSettings || DEFAULT_WAYPOINT_PIN_SETTINGS);

  useEffect(() => {
    if (waypointPinSettings) {
      setCurrentPinSettings(waypointPinSettings);
    }
  }, [waypointPinSettings]);

  const handleUpdatePinSettings = (patch: Partial<WaypointPinSettings>) => {
    setCurrentPinSettings((prev) => {
      const updated = { ...prev, ...patch };
      onUpdateWaypointPinSettings?.(patch);
      return updated;
    });
  };

  // Cinematic Intro & Outro Configuration State (enabled by default for Video Export)
  const [introOutro, setIntroOutro] = useState<CinematicIntroOutroConfig>(
    () => ({
      ...DEFAULT_INTRO_OUTRO_CONFIG,
      enableIntro: true,
      introEnabled: true,
      enableOutro: true,
      outroEnabled: true,
      outroDurationSeconds: 4,
      outroHoldSeconds: 4,
    })
  );

  const updateIntroOutro = (partial: Partial<CinematicIntroOutroConfig>) => {
    setIntroOutro((prev) => {
      const updated = { ...prev, ...partial };
      onIntroOutroConfigChange?.(updated);
      return updated;
    });
  };

  // Sync cameraMode with current map viewer follow mode whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const activeMode = mapViewerRef.current?.getFollowMode?.() || initialFollowMode || 'calm';
      setCameraMode(activeMode);
    }
  }, [isOpen, initialFollowMode, mapViewerRef]);

  // Render Quality & Synchronous Tile Waiting Mode
  const [renderQuality, setRenderQuality] = useState<'max' | 'draft'>('max');
  const [statusDetail, setStatusDetail] = useState<string>('');
  const [videoFormat, setVideoFormat] = useState<'mp4' | 'webm'>('mp4');
  const origPixelRatioRef = useRef<number | null>(null);

  // Elevation Profile Overlay State
  const [includeElevationProfile, setIncludeElevationProfile] = useState<boolean>(true);
  const [elevationPosition, setElevationPosition] = useState<ElevationOverlayPosition>('bottom-right');

  // Recording status
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordProgress, setRecordProgress] = useState<number>(0); // 0 to 1
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [totalFrames, setTotalFrames] = useState<number>(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Hidden offscreen recording canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stopRequestedRef = useRef<boolean>(false);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, [recordedVideoUrl]);

  if (!isOpen || !routeData) return null;

  const startRecording = async () => {
    const handle = mapViewerRef.current;
    if (!handle) {
      setExportError('Map engine is not available for video capture.');
      return;
    }

    const mapCanvas = handle.getMapCanvas();
    if (!mapCanvas) {
      setExportError('Could not access MapLibre GL WebGL canvas.');
      return;
    }

    const map = handle.getMap?.();

    setExportError(null);
    setIsRecording(true);
    setRecordProgress(0);
    setCurrentFrame(0);
    setStatusDetail('Initializing 4K render pipeline & 3D tiles...');
    stopRequestedRef.current = false;

    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
      setRecordedBlob(null);
    }

    // Set up export canvas (ensuring strictly even dimensions for all video codecs)
    const exportWidth = selectedResolution.width - (selectedResolution.width % 2);
    const exportHeight = selectedResolution.height - (selectedResolution.height % 2);
    
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setExportError('Could not initialize 2D canvas context for rendering.');
      setIsRecording(false);
      return;
    }

    // Elevate MapLibre canvas pixel ratio during 4K exports for ultra-sharp vectors & tiles
    if (map) {
      origPixelRatioRef.current = map.getPixelRatio ? map.getPixelRatio() : 1;
      if (exportWidth >= 3840 || exportHeight >= 3840) {
        try {
          map.setPixelRatio?.(Math.min(2, window.devicePixelRatio || 2));
          map.resize?.();
        } catch (e) {
          // ignore
        }
      }
    }

    const restoreMapState = () => {
      handle.setLineColorOverride?.(null);
      if (map && origPixelRatioRef.current !== null) {
        try {
          map.setPixelRatio?.(origPixelRatioRef.current);
          map.resize?.();
        } catch (e) {
          // ignore
        }
        origPixelRatioRef.current = null;
      }
    };

    const hasIntroOrOutro = introOutro.introEnabled || introOutro.outroEnabled;
    const totalSequenceSeconds = hasIntroOrOutro
      ? calculateTotalSequenceDuration(durationSeconds, introOutro)
      : durationSeconds;

    const totalCalculatedFrames = calculateTotalFrames(totalSequenceSeconds, fps);
    setTotalFrames(totalCalculatedFrames);

    // Frame-Accurate Video Pipeline: Check WebCodecs + mp4-muxer support
    const hasWebCodecs = typeof window !== 'undefined' &&
      typeof (window as any).VideoEncoder === 'function' &&
      typeof (window as any).VideoFrame === 'function';

    let useMuxer = false;
    let muxer: any = null;
    let videoEncoder: any = null;
    let target: any = null;

    let encoderError: any = null;

    if (hasWebCodecs) {
      const is4K = exportWidth >= 3840 || exportHeight >= 3840;
      // Candidate codecs in order of reliability for target resolution
      // For 4K, VP9 profiles (5.1 / 5.0) are vastly more reliable across browsers than OpenH264
      const candidateCodecs = is4K
        ? [
            'vp09.00.51.08', // VP9 Profile 0, Level 5.1 (4K up to 60fps)
            'vp09.00.50.08', // VP9 Profile 0, Level 5.0 (4K 30fps)
            'avc1.640033',   // AVC High 5.1
            'avc1.640034',   // AVC High 5.2
            'vp09.00.41.08', // VP9 Level 4.1
            'av01.0.12M.08', // AV1 4K
          ]
        : [
            'avc1.64002a',   // AVC High Profile 4.2
            'avc1.4d002a',   // AVC Main Profile
            'avc1.42001f',   // AVC Baseline Profile
            'vp09.00.41.08', // VP9 Profile 0 Level 4.1
            'vp09.00.10.08', // VP9 Profile 0
          ];

      const effectiveBitrate = selectedResolution.bitrate || (is4K ? 35000000 : 16000000);

      let chosenCodec: string | null = null;
      for (const codec of candidateCodecs) {
        try {
          const testRes = await (window as any).VideoEncoder.isConfigSupported({
            codec,
            width: exportWidth,
            height: exportHeight,
            bitrate: effectiveBitrate,
            framerate: fps,
          });
          if (!testRes?.supported) continue;

          // Quick dry-run verification: actually encode 1 test frame to verify hardware/software encoder doesn't reject the resolution
          const isViable = await new Promise<boolean>((resolve) => {
            let failed = false;
            let testEnc: any = null;
            try {
              testEnc = new (window as any).VideoEncoder({
                output: () => {},
                error: () => {
                  failed = true;
                  resolve(false);
                },
              });

              const config: any = {
                codec,
                width: exportWidth,
                height: exportHeight,
                bitrate: effectiveBitrate,
                framerate: fps,
              };
              if (codec.startsWith('avc1')) {
                config.avc = { format: 'avc' };
              }

              testEnc.configure(config);

              const testCanvas = document.createElement('canvas');
              testCanvas.width = exportWidth;
              testCanvas.height = exportHeight;
              const testFrame = new (window as any).VideoFrame(testCanvas, { timestamp: 0 });
              testEnc.encode(testFrame, { keyFrame: true });
              testFrame.close();

              testEnc.flush()
                .then(() => {
                  try {
                    if (testEnc.state === 'configured') testEnc.close();
                  } catch (e) {}
                  resolve(!failed);
                })
                .catch(() => resolve(false));
            } catch (err) {
              resolve(false);
            }
          });

          if (isViable) {
            chosenCodec = codec;
            break;
          }
        } catch (e) {
          // Continue testing next candidate codec
        }
      }

      if (chosenCodec) {
        try {
          target = new ArrayBufferTarget();
          const muxCodec = chosenCodec.startsWith('vp')
            ? 'vp9'
            : (chosenCodec.startsWith('av01') ? 'av1' : 'avc');

          muxer = new Muxer({
            target,
            video: {
              codec: muxCodec,
              width: exportWidth,
              height: exportHeight,
              frameRate: fps,
            },
            fastStart: 'in-memory',
          });

          videoEncoder = new (window as any).VideoEncoder({
            output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
            error: (e: any) => {
              console.error('VideoEncoder error:', e);
              encoderError = e;
              setExportError(`Video encoding error: ${e?.message || e}`);
            },
          });

          const encoderConfig: any = {
            codec: chosenCodec,
            width: exportWidth,
            height: exportHeight,
            bitrate: effectiveBitrate,
            framerate: fps,
          };
          if (chosenCodec.startsWith('avc1')) {
            encoderConfig.avc = { format: 'avc' };
          }

          await videoEncoder.configure(encoderConfig);

          useMuxer = true;
          setVideoFormat('mp4');
        } catch (err) {
          console.warn('Failed to initialize WebCodecs VideoEncoder, falling back to MediaRecorder:', err);
          useMuxer = false;
        }
      }
    }

    // Fallback: MediaRecorder if WebCodecs is unavailable
    let mediaRecorder: MediaRecorder | null = null;
    const recordedChunks: Blob[] = [];

    if (!useMuxer) {
      const { mimeType, extension } = getSupportedVideoMimeType();
      setVideoFormat(extension === 'mp4' ? 'mp4' : 'webm');
      const stream = canvas.captureStream(fps);
      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: mimeType,
          videoBitsPerSecond: selectedResolution.bitrate || 16000000,
        });
      } catch (e) {
        try {
          mediaRecorder = new MediaRecorder(stream);
        } catch (err) {
          restoreMapState();
          setExportError('Browser does not support video encoding.');
          setIsRecording(false);
          return;
        }
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.start(500);
    }

    const numWaypoints = Math.max(2, routeData.waypoints.length);
    const totalSegments = numWaypoints - 1;
    const autoSubtitle = `${routeData.totalDistanceKm} KM (${routeData.totalDistanceMiles} MI) • +${routeData.elevationGainM}M ELEVATION`;

    const startCoord = routeData.coordinates[0];
    const finishCoord = routeData.coordinates[routeData.coordinates.length - 1];
    const prevFinishCoord = routeData.coordinates[Math.max(0, routeData.coordinates.length - 2)];
    const finishBearing = calculateBearing(prevFinishCoord[1], prevFinishCoord[0], finishCoord[1], finishCoord[0]);

    const boundsCamera = handle.getBoundsCamera?.() || {
      center: [startCoord[0], startCoord[1]] as [number, number],
      zoom: 11,
    };

    // Calculate exact initial flythrough camera parameters (guarantees C0/C1 continuity with intro dive-in)
    const point0 = getRoutePointAtProgress(routeData, 0);
    const viewportHeight = canvas.height || 1080;
    const initialFlyZoom = cameraAltitudeMeters
      ? altitudeToZoom(cameraAltitudeMeters, point0.lat, viewportHeight)
      : (map ? map.getZoom() : 13.5);
    const initialFlyPitch = is3dTerrain
      ? (cameraPitch !== undefined ? cameraPitch : (map ? map.getPitch() : 55))
      : 0;
    const initialFlyBearing = cameraMode === 'fixed'
      ? (map ? map.getBearing() : 0)
      : point0.bearing;

    let lastFlyCamera: { center: [number, number]; zoom: number; pitch: number; bearing: number } | null = null;

    // Precompute waypoint progress and preload any custom waypoint thumbnails for instant rendering
    const wptProgressMap = computeWaypointsRouteProgress(routeData);
    const imageCache = new Map<string, HTMLImageElement>();
    if (routeData.waypoints) {
      routeData.waypoints.forEach((wpt) => {
        if (wpt.imageUrl) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = wpt.imageUrl;
          imageCache.set(wpt.imageUrl, img);
        }
      });
    }

    // Frame-Accurate Capture Loop: Every frame waits for 3D tiles & elevation to be loaded
    try {
      for (let frameIdx = 0; frameIdx < totalCalculatedFrames; frameIdx++) {
        if (stopRequestedRef.current) break;

        const elapsedSeconds = frameIdx / fps;
        let effectiveRouteProgress = frameIdx / totalCalculatedFrames;
        let statusBadgeText: string | undefined = undefined;

        setRecordProgress(frameIdx / totalCalculatedFrames);
        setCurrentFrame(frameIdx + 1);
        setStatusDetail(
          renderQuality === 'max'
            ? `Syncing 3D tiles & elevation (frame ${frameIdx + 1}/${totalCalculatedFrames})...`
            : `Rendering frame ${frameIdx + 1}/${totalCalculatedFrames}...`
        );

        let currentTimeline: ReturnType<typeof getTimelineState> | null = null;

        if (!hasIntroOrOutro) {
          effectiveRouteProgress = frameIdx / totalCalculatedFrames;
          const currentSegment = Math.min(totalSegments - 1, Math.floor(effectiveRouteProgress * totalSegments));
          const segmentProgress = (effectiveRouteProgress * totalSegments) % 1;
          handle.updateProgress(currentSegment, segmentProgress, effectiveRouteProgress, false);
          
          if (handle.moveCameraToProgress) {
            const isFirstFrame = frameIdx === 0;
            handle.moveCameraToProgress(effectiveRouteProgress, isFirstFrame, cameraMode);
          }
        } else {
          const timeline = getTimelineState(
            elapsedSeconds,
            introOutro,
            durationSeconds,
            accentColor
          );
          currentTimeline = timeline;

          effectiveRouteProgress = timeline.routeProgress;

          if (timeline.phase === 'intro') {
            statusBadgeText = 'INTRO DIVE-IN';
            handle.setLineColorOverride?.(null);
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
            handle.updateProgress(0, 0, 0, false);
          } else if (timeline.phase === 'flythrough') {
            handle.setLineColorOverride?.(null);
            const currentSegment = Math.min(totalSegments - 1, Math.floor(timeline.routeProgress * totalSegments));
            const segmentProgress = (timeline.routeProgress * totalSegments) % 1;
            handle.updateProgress(currentSegment, segmentProgress, timeline.routeProgress, false);

            if (handle.moveCameraToProgress) {
              const isFirstFlyFrame = timeline.phaseProgress < (1 / (durationSeconds * fps) * 2);
              handle.moveCameraToProgress(timeline.routeProgress, isFirstFlyFrame, cameraMode);
            }

            // Continuously record camera state at every frame of flythrough for seamless outro handoff
            if (map) {
              const c = map.getCenter();
              lastFlyCamera = {
                center: [c.lng, c.lat],
                zoom: map.getZoom(),
                pitch: map.getPitch(),
                bearing: map.getBearing(),
              };
            }
          } else if (timeline.phase === 'outro-zoom') {
            statusBadgeText = '🏁 ROUTE COMPLETE';
            handle.setLineColorOverride?.(null);
            const overviewPitch = is3dTerrain ? 38 : 0;
            const startOutroCam = lastFlyCamera || {
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
            handle.updateProgress(totalSegments - 1, 1, 1, false);
          } else if (timeline.phase === 'outro-hold' || timeline.phase === 'ended') {
            statusBadgeText = '🏁 ROUTE COMPLETE';
            const overviewPitch = is3dTerrain ? 38 : 0;
            if (map) {
              map.jumpTo({
                center: boundsCamera.center,
                zoom: boundsCamera.zoom,
                bearing: 0,
                pitch: overviewPitch,
              });
            }
            handle.updateProgress(totalSegments - 1, 1, 1, false);
            if (timeline.animatedLineColor) {
              handle.setLineColorOverride?.(timeline.animatedLineColor, timeline.lineWidthBonus);
            }
          }
        }

        // Wait for all MapLibre visible tiles and elevation meshes to render to WebGL backbuffer
        const maxWaitMs = renderQuality === 'max' ? 1400 : 250;
        await waitForMapFrame(map, maxWaitMs);

        // Draw map canvas to composite export canvas
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, exportWidth, exportHeight);

        let drawW = exportWidth;
        let drawH = exportHeight;
        let drawX = 0;
        let drawY = 0;

        try {
          const mapW = mapCanvas.width;
          const mapH = mapCanvas.height;
          const mapAspect = mapW / mapH;
          const targetAspect = exportWidth / exportHeight;

          if (mapAspect > targetAspect) {
            drawW = exportHeight * mapAspect;
            drawX = (exportWidth - drawW) / 2;
          } else {
            drawH = exportWidth / mapAspect;
            drawY = (exportHeight - drawH) / 2;
          }

          ctx.drawImage(mapCanvas, drawX, drawY, drawW, drawH);
        } catch (err) {
          // In case of canvas read error
        }

        // 0. Draw Waypoint Pins (Name badges, icons, elevation tags, arrival pulses, and ground pins)
        if (includeWaypointPins && routeData.waypoints && routeData.waypoints.length > 0) {
          drawWaypointPinsOnCanvas(
            ctx,
            exportWidth,
            exportHeight,
            map,
            mapCanvas,
            drawX,
            drawY,
            drawW,
            drawH,
            routeData,
            currentPinSettings,
            accentColor,
            effectiveRouteProgress,
            wptProgressMap,
            imageCache
          );
        }

        // 1. Draw TV Lower-Third broadcast graphic
        let tvCardInfo = { cardX: 0, cardY: exportHeight, cardWidth: 0, cardHeight: 0 };
        if (includeOverlay) {
          const exportTitle = customTitle || routeData.name || 'ROUTE OVERVIEW';
          const exportDuration = customDuration || routeData.formattedDuration || '2h 15m';
          const exportSubtitle = customSubtitle || `${routeData.totalDistanceKm} KM (${routeData.totalDistanceMiles} MI) • ${exportDuration} • +${routeData.elevationGainM}M ELEVATION`;

          tvCardInfo = drawTvBroadcastCardOnCanvas(
            ctx,
            exportWidth,
            exportHeight,
            exportTitle,
            exportSubtitle,
            accentColor,
            effectiveRouteProgress,
            is3dTerrain,
            bannerParts,
            cameraAltitudeMeters,
            {
              distanceKm: routeData.totalDistanceKm,
              gainM: routeData.elevationGainM,
              duration: exportDuration,
              waypointsCount: routeData.waypoints.length,
              maxElevM: routeData.maxElevationM,
              statusBadgeText,
              stageName: stageName || 'LOCT GPX STAGE',
            }
          );
        }

        // 2. Draw Elevation Profile HUD
        if (includeElevationProfile) {
          drawElevationProfileOnCanvas(
            ctx,
            exportWidth,
            exportHeight,
            routeData,
            accentColor,
            effectiveRouteProgress,
            elevationPosition,
            tvCardInfo
          );
        }

        // 3. Draw Animated Compass Rose (Wind Rose) during outro full-route overview
        if (
          currentTimeline &&
          (currentTimeline.phase === 'outro-zoom' || currentTimeline.phase === 'outro-hold' || currentTimeline.phase === 'ended') &&
          isOutroRoseActive(introOutro)
        ) {
          const scale = exportWidth / 1920;
          const roseRadius = 66 * scale;
          const roseX = exportWidth - roseRadius - 40 * scale;
          const roseY = roseRadius + 40 * scale;

          const outroProgress = currentTimeline.phase === 'outro-zoom'
            ? currentTimeline.phaseProgress * 0.45
            : 0.45 + currentTimeline.phaseProgress * 0.55;

          const roseColor = introOutro.lineEffectType === 'rose' ? '#f43f5e' : accentColor;
          drawOutroCompassRoseOnCanvas(
            ctx,
            roseX,
            roseY,
            roseRadius,
            outroProgress,
            roseColor,
            0
          );
        }

        // 4. Encode frame with exact microsecond timestamp (zero wall-clock desync or lag)
        if (useMuxer && videoEncoder) {
          if (encoderError || videoEncoder.state !== 'configured') {
            throw new Error(
              encoderError?.message ||
              'Video encoder closed unexpectedly. Please try 1080p resolution or a lower framerate.'
            );
          }

          const timestampMicros = Math.round((frameIdx * 1_000_000) / fps);
          const durationMicros = Math.round(1_000_000 / fps);
          const isKeyFrame = frameIdx % (fps * 2) === 0;

          const videoFrame = new (window as any).VideoFrame(canvas, {
            timestamp: timestampMicros,
            duration: durationMicros,
          });

          try {
            videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
          } finally {
            videoFrame.close();
          }

          // Strict backpressure queue management: wait if encoder is busy processing previous frames (critical for 4K)
          while (videoEncoder.state === 'configured' && videoEncoder.encodeQueueSize > 2) {
            await new Promise((r) => setTimeout(r, 20));
          }
        } else {
          // MediaRecorder mode: give recorder adequate slice to grab the canvas buffer
          await new Promise((r) => setTimeout(r, Math.max(16, Math.floor(1000 / fps))));
        }

        // Periodic yield for UI updates
        if (frameIdx % 2 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      if (stopRequestedRef.current) {
        if (videoEncoder && videoEncoder.state === 'configured') {
          try { videoEncoder.close(); } catch (e) {}
        }
        restoreMapState();
        setIsRecording(false);
        return;
      }

      // Finalize video encoding
      setStatusDetail('Finalizing pristine MP4 video...');
      setRecordProgress(1);

      if (useMuxer && videoEncoder) {
        if (videoEncoder.state === 'configured') {
          await videoEncoder.flush();
          try { videoEncoder.close(); } catch (e) {}
        }
        muxer.finalize();
        const buffer = target.buffer;
        const blob = new Blob([buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedVideoUrl(url);
        setVideoFormat('mp4');
        setIsRecording(false);
        restoreMapState();
      } else if (mediaRecorder) {
        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunks, { type: mediaRecorder?.mimeType || 'video/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedBlob(blob);
          setRecordedVideoUrl(url);
          setIsRecording(false);
          restoreMapState();
        };
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }
    } catch (err: any) {
      console.error('Recording failed:', err);
      if (videoEncoder && videoEncoder.state === 'configured') {
        try { videoEncoder.close(); } catch (e) {}
      }
      restoreMapState();
      setExportError(`Export failed: ${err?.message || 'Unknown error during frame capture'}`);
      setIsRecording(false);
    }
  };

  const handleCancelRecording = () => {
    stopRequestedRef.current = true;
    const handle = mapViewerRef.current;
    handle?.setLineColorOverride?.(null);
    const map = handle?.getMap?.();
    if (map && origPixelRatioRef.current !== null) {
      try {
        map.setPixelRatio?.(origPixelRatioRef.current);
        map.resize?.();
      } catch (e) {
        // ignore
      }
      origPixelRatioRef.current = null;
    }
    setIsRecording(false);
  };

  const handleDownloadVideo = () => {
    if (!recordedVideoUrl || !routeData) return;
    const ext = videoFormat || (recordedBlob?.type.includes('mp4') ? 'mp4' : 'webm');
    const filename = generateVideoFileName(routeData.name, selectedResolution.id, ext);
    const link = document.createElement('a');
    link.href = recordedVideoUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div 
        className="relative w-full max-w-xl bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        data-testid="video-export-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white font-mono tracking-wide uppercase">
                LOCT GPX VIDEO EXPORT STUDIO
              </h2>
              <p className="text-[10px] text-neutral-400 font-mono">
                Client-side 4K/1080p WebGL Route Animation &amp; Telecast Capture
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close export modal"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-neutral-300">
          
          {exportError && (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{exportError}</span>
            </div>
          )}

          {/* If video has been recorded, show video preview and download! */}
          {recordedVideoUrl ? (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black border border-neutral-800 shadow-xl aspect-video flex items-center justify-center">
                <video
                  src={recordedVideoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 flex items-center justify-between font-mono text-[11px]">
                <div className="space-y-0.5">
                  <div className="text-white font-bold">{routeData.name}</div>
                  <div className="text-neutral-400 text-[10px]">
                    {selectedResolution.label} • {durationSeconds}s • {fps} FPS • {recordedBlob ? `${(recordedBlob.size / 1024 / 1024).toFixed(2)} MB` : ''}
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold uppercase">
                  READY
                </span>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={handleDownloadVideo}
                  aria-label="Download generated video"
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>DOWNLOAD VIDEO FILE</span>
                </button>

                <button
                  onClick={() => {
                    setRecordedVideoUrl(null);
                    setRecordedBlob(null);
                  }}
                  aria-label="Record another video"
                  className="py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>RECORD AGAIN</span>
                </button>
              </div>
            </div>
          ) : isRecording ? (
            /* Live Recording View */
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <Loader2 className="w-20 h-20 text-amber-500 animate-spin" />
                <span className="absolute font-mono font-bold text-sm text-white">
                  {Math.round(recordProgress * 100)}%
                </span>
              </div>

              <div className="space-y-1.5 max-w-md">
                <div className="flex items-center justify-center gap-2">
                  <h3 className="font-bold text-base text-white tracking-wide font-mono uppercase">
                    RECORDING ROUTE FLYTHROUGH...
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/20 text-amber-400 border border-amber-400/30">
                    {selectedResolution.badge || selectedResolution.id.toUpperCase()}
                  </span>
                </div>
                
                {statusDetail && (
                  <p className="text-amber-400 text-xs font-mono font-medium animate-pulse">
                    {statusDetail}
                  </p>
                )}

                <p className="text-neutral-400 text-[11px] font-mono">
                  Capturing frame {currentFrame} of {totalFrames} • {fps} FPS ({selectedResolution.width}×{selectedResolution.height})
                </p>

                <div className="flex items-center justify-center gap-1.5 text-[10px] text-neutral-500 font-mono">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>
                    {renderQuality === 'max'
                      ? 'Tile Sync: Active (Waiting for 3D terrain & elevation)'
                      : 'Draft Mode (Fast tile capture)'}
                  </span>
                  <span>•</span>
                  <span>Format: {videoFormat.toUpperCase()}</span>
                </div>
              </div>

              <div className="w-full max-w-md bg-neutral-900 h-2 rounded-full overflow-hidden border border-neutral-800">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-100"
                  style={{ width: `${Math.round(recordProgress * 100)}%` }}
                />
              </div>

              <button
                onClick={handleCancelRecording}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-red-400 font-mono text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel Recording
              </button>
            </div>
          ) : (
            /* Settings View */
            <div className="space-y-4">
              
              {/* Aspect Ratio / Resolution */}
              <div className="space-y-2">
                <label className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                  VIDEO FORMAT &amp; RESOLUTION
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {VIDEO_RESOLUTIONS.map((res) => (
                    <button
                      key={res.id}
                      onClick={() => setSelectedResolution(res)}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        selectedResolution.id === res.id
                          ? 'border-amber-400 bg-neutral-900 text-white shadow-md ring-1 ring-amber-400/30'
                          : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-neutral-100">{res.label}</span>
                          {res.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-amber-500/20 text-amber-400 border border-amber-400/30">
                              {res.badge}
                            </span>
                          )}
                        </div>
                        {selectedResolution.id === res.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <div className="flex items-center justify-between font-mono text-[10px] text-neutral-500">
                        <span>{res.width} × {res.height} ({res.aspectRatio})</span>
                        {res.bitrate && <span>{Math.round(res.bitrate / 1000000)} Mbps</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Flythrough Duration */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                    ANIMATION DURATION
                  </label>
                  <span className="font-mono text-xs font-bold text-amber-400">{durationSeconds} SECONDS</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 15, 20, 30].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setDurationSeconds(sec)}
                      className={`py-2 text-center rounded-xl border font-mono text-xs uppercase font-semibold transition-all cursor-pointer ${
                        durationSeconds === sec
                          ? 'border-amber-400 bg-neutral-900 text-amber-400'
                          : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Frame Rate FPS */}
              <div className="space-y-2">
                <label className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                  FRAME RATE
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[30, 60].map((frameRate) => (
                    <button
                      key={frameRate}
                      onClick={() => setFps(frameRate)}
                      className={`py-2 px-3 rounded-xl border font-mono text-xs uppercase font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        fps === frameRate
                          ? 'border-amber-400 bg-neutral-900 text-amber-400'
                          : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span>{frameRate} FPS</span>
                      <span className="text-[10px] text-neutral-500">{frameRate === 60 ? 'Ultra Smooth' : 'Standard'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Frame Render Quality & Tile Sync */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                    FRAME RENDER QUALITY &amp; TILE SYNC
                  </label>
                  <span className="font-mono text-xs font-bold text-amber-400">
                    {renderQuality === 'max' ? 'MAXIMUM QUALITY' : 'FAST DRAFT'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRenderQuality('max')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      renderQuality === 'max'
                        ? 'border-amber-400 bg-neutral-900 text-white shadow-md ring-1 ring-amber-400/30'
                        : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1.5 text-neutral-100">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                        Maximum Quality
                      </span>
                      {renderQuality === 'max' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <span className="text-[10px] text-neutral-400 leading-tight">
                      Waits for 3D elevation meshes, DEM terrain &amp; satellite tiles to fully load before capturing each frame. Zero stutter or pop-in.
                    </span>
                    <span className="text-[9px] font-mono text-amber-400/90 font-semibold mt-0.5">
                      ★ Recommended for pristine 4K video
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRenderQuality('draft')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      renderQuality === 'draft'
                        ? 'border-amber-400 bg-neutral-900 text-white shadow-md'
                        : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1.5 text-neutral-100">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        Fast Draft
                      </span>
                      {renderQuality === 'draft' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <span className="text-[10px] text-neutral-400 leading-tight">
                      Shorter tile wait timeout (up to 250ms). Faster export when you want quick preview iterations.
                    </span>
                  </button>
                </div>
              </div>

              {/* Camera Motion / Follow Mode */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-mono uppercase font-bold text-[11px] tracking-wider text-neutral-400">
                    CAMERA MOTION MODE
                  </label>
                  <span className="font-mono text-xs font-bold text-amber-400">
                    {cameraMode === 'calm' ? 'CALM FOLLOW' : cameraMode === 'fixed' ? 'STEADY CAM' : 'FIXED SCENE'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCameraMode('calm')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      cameraMode === 'calm'
                        ? 'border-amber-400 bg-neutral-900 text-white shadow-md'
                        : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <Navigation className="w-3 h-3 text-amber-400" />
                        Calm
                      </span>
                      {cameraMode === 'calm' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <span className="text-[10px] text-neutral-400 leading-tight">
                      Damped follow &amp; smooth turns
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCameraMode('fixed')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      cameraMode === 'fixed'
                        ? 'border-cyan-400 bg-neutral-900 text-white shadow-md'
                        : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <Compass className="w-3 h-3 text-cyan-400" />
                        Steady
                      </span>
                      {cameraMode === 'fixed' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <span className="text-[10px] text-neutral-400 leading-tight">
                      Locked heading (no rotation)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCameraMode('free')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      cameraMode === 'free'
                        ? 'border-neutral-400 bg-neutral-900 text-white shadow-md'
                        : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <Video className="w-3 h-3 text-neutral-300" />
                        Fixed
                      </span>
                      {cameraMode === 'free' && <Check className="w-3.5 h-3.5 text-neutral-300" />}
                    </div>
                    <span className="text-[10px] text-neutral-400 leading-tight">
                      Stationary overview vantage
                    </span>
                  </button>
                </div>
              </div>

              {/* Cinematic Intro & Outro Sequence */}
              <div className="space-y-3 p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-mono font-bold text-xs text-white">CINEMATIC INTRO &amp; OUTRO</div>
                      <div className="text-[10px] text-neutral-400">
                        World dive-in overview and full-route outro with animated line effects
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                    {calculateTotalSequenceDuration(durationSeconds, introOutro)}s TOTAL
                  </span>
                </div>

                {/* 1. Intro Dive-In */}
                <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={introOutro.introEnabled}
                        onChange={(e) => updateIntroOutro({ introEnabled: e.target.checked })}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                      <span className="font-mono font-bold text-[11px] text-neutral-200">
                        INTRO DIVE-IN
                      </span>
                    </label>
                    {introOutro.introEnabled && (
                      <span className="font-mono text-[10px] text-amber-400 font-bold">
                        {introOutro.introDurationSeconds}s DURATION
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-400 pl-6">
                    Swoops from orbital world satellite view down into the starting trailhead.
                  </p>

                  {introOutro.introEnabled && (
                    <div className="pl-6 grid grid-cols-4 gap-1.5 pt-1">
                      {[2, 3, 4, 5].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => updateIntroOutro({ introDurationSeconds: sec })}
                          className={`py-1.5 px-2 text-center rounded-lg border font-mono text-[10px] font-semibold transition-all cursor-pointer ${
                            introOutro.introDurationSeconds === sec
                              ? 'border-amber-400 bg-neutral-900 text-amber-400'
                              : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {sec}s {sec === 3 ? '(Default)' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Outro Zoom-Out & Hold */}
                <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={introOutro.outroEnabled}
                        onChange={(e) => updateIntroOutro({ outroEnabled: e.target.checked })}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                      <span className="font-mono font-bold text-[11px] text-neutral-200">
                        OUTRO FULL PATH ZOOM-OUT
                      </span>
                    </label>
                    {introOutro.outroEnabled && (
                      <span className="font-mono text-[10px] text-amber-400 font-bold">
                        {introOutro.outroHoldSeconds}s LAST VIEW HOLD
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-400 pl-6">
                    Pulls back from finish line to display the complete route in a single screen.
                  </p>

                  {introOutro.outroEnabled && (
                    <div className="pl-6 space-y-2.5 pt-1">
                      <div>
                        <div className="text-[10px] font-mono text-neutral-400 mb-1">
                          HOLD LAST OVERVIEW VIEW DURATION:
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {[2, 3, 4, 5, 6].map((sec) => (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => updateIntroOutro({ outroHoldSeconds: sec })}
                              className={`py-1.5 px-2 text-center rounded-lg border font-mono text-[10px] font-semibold transition-all cursor-pointer ${
                                introOutro.outroHoldSeconds === sec
                                  ? 'border-amber-400 bg-neutral-900 text-amber-400'
                                  : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-white'
                              }`}
                            >
                              {sec}s {sec === 4 ? '★' : ''}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Animated Compass Rose (Wind Rose) Cartographic Overlay */}
                      <div className="pt-2 border-t border-neutral-800/60 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={introOutro.showOutroRose ?? true}
                              onChange={(e) => updateIntroOutro({ showOutroRose: e.target.checked, outroRoseEnabled: e.target.checked })}
                              className="w-3.5 h-3.5 accent-rose-500 rounded cursor-pointer"
                            />
                            <span className="font-mono font-bold text-[10px] text-neutral-200 flex items-center gap-1.5">
                              <Compass className="w-3.5 h-3.5 text-rose-400" />
                              ANIMATE COMPASS ROSE (WIND ROSE) ON FULL PATH
                            </span>
                          </label>
                          <span className="text-[9px] font-mono text-rose-400 font-semibold px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                            🌹 Rose Des Vents
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 pl-5">
                          Blooms a faceted cartographic compass rose with spin-to-north entrance as route zooms out to full view.
                        </p>
                      </div>

                      {/* Line Colour Effects */}
                      <div className="pt-2 border-t border-neutral-800/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={introOutro.animateLineEffect}
                              onChange={(e) => updateIntroOutro({ animateLineEffect: e.target.checked })}
                              className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
                            />
                            <span className="font-mono font-bold text-[10px] text-neutral-200 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              ANIMATE LINE WITH COLOUR EFFECTS
                            </span>
                          </label>
                        </div>

                        {introOutro.animateLineEffect && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                            {[
                              { id: 'rose' as const, label: '🌹 Velvet Rose', desc: 'Blush & Petal Glow' },
                              { id: 'rainbow' as const, label: '🌈 Rainbow Neon', desc: 'Hue Cycle & Glow' },
                              { id: 'neon' as const, label: '⚡ Electric Neon', desc: 'Cyan-Magenta Pulse' },
                              { id: 'gold' as const, label: '✨ Champion Gold', desc: 'Golden Shimmer' },
                            ].map((eff) => (
                              <button
                                key={eff.id}
                                type="button"
                                onClick={() => updateIntroOutro({ lineEffectType: eff.id })}
                                className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                                  introOutro.lineEffectType === eff.id
                                    ? 'border-amber-400 bg-neutral-900 text-white shadow-md ring-1 ring-amber-400/30'
                                    : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-white'
                                }`}
                              >
                                <span className="font-bold text-[10px]">{eff.label}</span>
                                <span className="text-[8px] text-neutral-500">{eff.desc}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* TV Broadcast Card Toggle & Component Customization */}
              <div className="space-y-3 p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="font-mono font-bold text-xs text-white">INCLUDE TV BROADCAST HUD</div>
                      <div className="text-[10px] text-neutral-400">Renders route title, distance, and live telemetry card</div>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={includeOverlay}
                    onChange={(e) => setIncludeOverlay(e.target.checked)}
                    aria-label="Include TV Broadcast HUD in export"
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>

                {includeOverlay && (
                  <div className="pt-2 border-t border-neutral-800/80 space-y-2.5">
                    {/* Stage Name input */}
                    <div className="flex items-center gap-2">
                      <label className="font-mono uppercase font-bold text-[10px] text-neutral-400 w-24 shrink-0">
                        STAGE NAME:
                      </label>
                      <input
                        type="text"
                        value={stageName || ''}
                        placeholder="e.g. STAGE 1, QUEEN STAGE"
                        onChange={(e) => onStageNameChange?.(e.target.value)}
                        className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1 text-neutral-100 text-xs focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono uppercase font-bold text-[10px] text-neutral-400">
                        CUSTOMIZE BANNER COMPONENTS
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setBannerParts({
                              showBadge: true,
                              showTitle: true,
                              showSubtitle: true,
                              showTelemetry: true,
                              showLiveTag: true,
                              showProgressBar: true,
                              showAccentBar: true,
                            });
                          }}
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                        >
                          All On
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBannerParts({
                              showBadge: false,
                              showTitle: true,
                              showSubtitle: false,
                              showTelemetry: true,
                              showLiveTag: false,
                              showProgressBar: true,
                              showAccentBar: true,
                            });
                          }}
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                        >
                          Minimal
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCustomizingBanner(!isCustomizingBanner)}
                          className="p-1 rounded text-neutral-400 hover:text-white"
                          title="Toggle banner items checklist"
                        >
                          {isCustomizingBanner ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {isCustomizingBanner ? (
                      <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                        {[
                          { key: 'showTitle', label: 'Route Title Card' },
                          { key: 'showSubtitle', label: 'Subtitle Summary' },
                          { key: 'showBadge', label: 'Stage & 3D Badge' },
                          { key: 'showTelemetry', label: 'Telemetry Stats Grid' },
                          { key: 'showLiveTag', label: 'Live Telecast Stamp' },
                          { key: 'showProgressBar', label: 'Scrubber Progress Bar' },
                          { key: 'showAccentBar', label: 'Accent Glow Bar' },
                        ].map(({ key, label }) => {
                          const isChecked = bannerParts[key as keyof TvBannerPartsConfig];
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() =>
                                setBannerParts((prev) => ({
                                  ...prev,
                                  [key]: !prev[key as keyof TvBannerPartsConfig],
                                }))
                              }
                              className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                                isChecked
                                  ? 'border-amber-400/40 bg-neutral-900 text-neutral-100'
                                  : 'border-neutral-800 bg-neutral-950/60 text-neutral-500'
                              }`}
                            >
                              {isChecked ? (
                                <CheckSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                              )}
                              <span className="truncate">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1 font-mono text-[9px] text-neutral-400">
                        {bannerParts.showTitle && <span className="px-1.5 py-0.5 rounded bg-neutral-800">Title</span>}
                        {bannerParts.showSubtitle && <span className="px-1.5 py-0.5 rounded bg-neutral-800">Subtitle</span>}
                        {bannerParts.showBadge && <span className="px-1.5 py-0.5 rounded bg-neutral-800">Badge</span>}
                        {bannerParts.showTelemetry && <span className="px-1.5 py-0.5 rounded bg-neutral-800">Stats</span>}
                        {bannerParts.showLiveTag && <span className="px-1.5 py-0.5 rounded bg-neutral-800">Live Stamp</span>}
                        {bannerParts.showProgressBar && <span className="px-1.5 py-0.5 rounded bg-neutral-800">Scrubber</span>}
                        {bannerParts.showAccentBar && <span className="px-1.5 py-0.5 rounded bg-neutral-800">Accent Bar</span>}
                        <button
                          type="button"
                          onClick={() => setIsCustomizingBanner(true)}
                          className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 font-bold"
                        >
                          Edit &rarr;
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Elevation Profile HUD Overlay Toggle */}
              <div className="space-y-3 p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mountain className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="font-mono font-bold text-xs text-white">INCLUDE ELEVATION PROFILE HUD</div>
                      <div className="text-[10px] text-neutral-400">
                        Animated terrain gradient chart with live altitude cursor &amp; climb stats
                      </div>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={includeElevationProfile}
                    onChange={(e) => setIncludeElevationProfile(e.target.checked)}
                    aria-label="Include Elevation Profile in export video"
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>

                {includeElevationProfile && (
                  <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-mono text-neutral-400">
                      <span>HUD POSITION ON VIDEO</span>
                      <span className="text-amber-400 font-bold uppercase">{elevationPosition.replace('-', ' ')}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'bottom-right' as const, label: 'Bottom-Right' },
                        { id: 'above-tv' as const, label: 'Above TV Card' },
                        { id: 'bottom-center' as const, label: 'Bottom-Center' },
                      ].map((posOpt) => (
                        <button
                          key={posOpt.id}
                          type="button"
                          onClick={() => setElevationPosition(posOpt.id)}
                          className={`py-1.5 px-2 rounded-lg border font-mono text-[10px] uppercase font-semibold transition-all cursor-pointer ${
                            elevationPosition === posOpt.id
                              ? 'border-amber-400 bg-neutral-900 text-amber-400'
                              : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {posOpt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Waypoint Pins on Map Overlay */}
              <div className="space-y-3 p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="font-mono font-bold text-xs text-white flex items-center gap-1.5">
                        <span>WAYPOINT PINS ON MAP</span>
                        {routeData.waypoints && routeData.waypoints.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            {routeData.waypoints.length} WAYPOINTS
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        {currentPinSettings.displayMode === 'name' 
                          ? 'Renders crisp route checkpoint name badges and elevation tags'
                          : 'Renders map checkpoint pins and elevation callouts'}
                      </div>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={includeWaypointPins}
                    onChange={(e) => setIncludeWaypointPins(e.target.checked)}
                    aria-label="Include Waypoint Pins in export"
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>

                {includeWaypointPins && routeData.waypoints && routeData.waypoints.length > 0 && (
                  <div className="pt-2 border-t border-neutral-800/80 space-y-2.5">
                    {/* Display Label Selector */}
                    <div>
                      <div className="text-[10px] font-mono text-neutral-400 uppercase mb-1">
                        PIN DISPLAY LABEL:
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleUpdatePinSettings({ displayMode: 'name', pinStyle: 'badge' })}
                          className={`py-1.5 px-2 rounded-md font-bold transition-all cursor-pointer ${
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
                          className={`py-1.5 px-2 rounded-md font-bold transition-all cursor-pointer ${
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
                          className={`py-1.5 px-2 rounded-md font-bold transition-all cursor-pointer ${
                            currentPinSettings.displayMode === 'index'
                              ? 'bg-amber-500 text-black shadow-sm'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          Number (#)
                        </button>
                      </div>
                    </div>

                    {/* Appear on Approach Switch */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="font-mono font-bold text-[10px] text-neutral-200">
                          DYNAMIC APPEAR ON APPROACH
                        </span>
                        <p className="text-[9px] text-neutral-400">
                          Name badges dynamically appear with an arrival pulse as the route reaches each waypoint
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpdatePinSettings({ approachReveal: !currentPinSettings.approachReveal })}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
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
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={startRecording}
                aria-label="Start video export recording"
                className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-xl hover:shadow-amber-500/20 transition-all cursor-pointer mt-2"
              >
                <Video className="w-4 h-4" />
                <span>START RECORDING &amp; EXPORT VIDEO</span>
              </button>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
