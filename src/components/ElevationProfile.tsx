import React, { useMemo } from 'react';
import { GpxRouteData } from '../utils/gpxParser';
import { Mountain, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';

interface ElevationProfileProps {
  routeData: GpxRouteData | null;
  accentColor: string;
}

export const ElevationProfile: React.FC<ElevationProfileProps> = ({
  routeData,
  accentColor,
}) => {
  if (!routeData || routeData.points.length === 0) return null;

  const { points, totalDistanceKm, elevationGainM, elevationLossM, minElevationM, maxElevationM } = routeData;

  // Sample points to prevent huge SVG DOM if there are thousands of track points
  const chartPoints = useMemo(() => {
    const validPoints = points.filter((p) => p.ele !== undefined);
    if (validPoints.length === 0) return [];

    const targetCount = 100;
    const step = Math.max(1, Math.floor(validPoints.length / targetCount));
    const sampled = [];
    for (let i = 0; i < validPoints.length; i += step) {
      sampled.push(validPoints[i]);
    }
    // Always include last point
    if (validPoints.length > 0 && sampled[sampled.length - 1] !== validPoints[validPoints.length - 1]) {
      sampled.push(validPoints[validPoints.length - 1]);
    }
    return sampled;
  }, [points]);

  if (chartPoints.length < 2) {
    return (
      <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-400 text-center">
        No elevation data recorded in this GPX file.
      </div>
    );
  }

  // Calculate SVG polyline coordinates
  const svgWidth = 400;
  const svgHeight = 120;
  const paddingX = 10;
  const paddingY = 15;

  const eleRange = Math.max(1, maxElevationM - minElevationM);

  const polylinePoints = chartPoints
    .map((p) => {
      const dist = p.distFromStartKm ?? 0;
      const x = paddingX + (dist / (totalDistanceKm || 1)) * (svgWidth - paddingX * 2);
      const ele = p.ele ?? minElevationM;
      const y = svgHeight - paddingY - ((ele - minElevationM) / eleRange) * (svgHeight - paddingY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Fill area closed polygon
  const firstX = paddingX;
  const lastX = svgWidth - paddingX;
  const bottomY = svgHeight - 4;
  const polygonPoints = `${polylinePoints} ${lastX},${bottomY} ${firstX},${bottomY}`;

  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800/90 text-neutral-200">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono">
          <Mountain className="w-3.5 h-3.5 text-amber-400" />
          ELEVATION PROFILE
        </span>
        <span className="text-[10px] font-mono text-neutral-400">
          {minElevationM}m – {maxElevationM}m
        </span>
      </div>

      {/* SVG Canvas Chart */}
      <div className="relative w-full overflow-hidden rounded-lg bg-neutral-950 border border-neutral-800">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-28 stroke-linejoin-round"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="ele-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.35" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1={paddingY} x2={svgWidth} y2={paddingY} stroke="#262626" strokeDasharray="3,3" />
          <line x1="0" y1={svgHeight / 2} x2={svgWidth} y2={svgHeight / 2} stroke="#262626" strokeDasharray="3,3" />
          <line x1="0" y1={svgHeight - paddingY} x2={svgWidth} y2={svgHeight - paddingY} stroke="#262626" strokeDasharray="3,3" />

          {/* Fill under line */}
          <polygon points={polygonPoints} fill="url(#ele-gradient)" />

          {/* Elevation Line */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke={accentColor}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>

        {/* Start / Finish labels */}
        <div className="absolute bottom-1 left-2 text-[9px] font-mono text-neutral-400">
          0.0 km
        </div>
        <div className="absolute bottom-1 right-2 text-[9px] font-mono text-neutral-400">
          {totalDistanceKm} km
        </div>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
        <div className="p-2 rounded-lg bg-neutral-950/60 border border-neutral-800/60">
          <div className="text-[9px] text-neutral-400 uppercase">GAIN</div>
          <div className="font-bold text-amber-400">+{elevationGainM}m</div>
        </div>
        <div className="p-2 rounded-lg bg-neutral-950/60 border border-neutral-800/60">
          <div className="text-[9px] text-neutral-400 uppercase">LOSS</div>
          <div className="font-bold text-neutral-300">-{elevationLossM}m</div>
        </div>
        <div className="p-2 rounded-lg bg-neutral-950/60 border border-neutral-800/60">
          <div className="text-[9px] text-neutral-400 uppercase">MAX PEAK</div>
          <div className="font-bold text-white">{maxElevationM}m</div>
        </div>
      </div>
    </div>
  );
};
