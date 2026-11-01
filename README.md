# LOCT GPX Map Studio

High-fidelity GPX route visualizer with 3D terrain and camera height control, waypoint photo pins, TV broadcast lower-third overlays, and MP4/WebM video flythrough export.

## Features

- **GPX route parsing** – Load and render GPX tracks on a 3D map.
- **3D terrain** – MapLibre GL with terrain exaggeration and basemap style controls.
- **Camera height control** – Cinematic camera math with follow modes and elevation profile.
- **Waypoint photo pins** – Attach images to waypoints along the route.
- **TV broadcast overlay** – Lower-third overlays for broadcast-style presentation.
- **Video export** – Render MP4/WebM flythrough videos with `mp4-muxer`.

## Tech Stack

- React 19 + TypeScript
- Vite 8
- MapLibre GL 4.7
- @wayfarer-gl/core
- Tailwind CSS 4
- Framer Motion
- Lucide React
- Gemini AI (`@google/genai`)

## Prerequisites

- Node.js (or Bun – `bun.lock` is included)
- A Gemini API key (`GEMINI_API_KEY`)

## Run Locally

1. Install dependencies:

   ```bash
   npm install
   ```

   (or `bun install`)

2. Set the `GEMINI_API_KEY` in `.env.local` (see `.env.example`):

   ```env
   GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
   ```

3. Run the app:

   ```bash
   npm run dev
   ```

   The dev server runs on `http://localhost:3000`.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server (port 3000) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | TypeScript type check (`tsc --noEmit`) |
| `npm run test` | Run unit tests (`tsx --test src/utils/*.test.ts`) |
| `npm run clean` | Remove `dist` and `server.js` |

## Project Structure

```
src/
├── App.tsx                 # Main application shell
├── main.tsx                # Entry point
├── index.css               # Global styles
├── components/
│   ├── MapViewer.tsx       # 3D map viewer
│   ├── ElevationProfile.tsx
│   ├── RouteControlsDrawer.tsx
│   ├── TvBroadcastOverlay.tsx
│   └── VideoExportModal.tsx
├── data/
│   └── sampleRoutes.ts
└── utils/
    ├── gpxParser.ts        # GPX parsing
    ├── cameraMath.ts       # Camera math
    ├── cinematicCamera.ts  # Cinematic camera
    ├── routeFollow.ts      # Route following
    ├── basemapStyles.ts    # Basemap styles
    └── videoExporter.ts    # Video export
```

## Testing

```bash
npm run test
```

Unit tests live alongside the utilities in `src/utils/*.test.ts`.

## License

See [LICENSE](LICENSE).

