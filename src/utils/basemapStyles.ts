/**
 * Basemap styles configuration and resolver for MapLibre GL
 */

export const SATELLITE_STYLE_OBJECT = {
  version: 8,
  sources: {
    'esri-sat': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'esri-sat-layer',
      type: 'raster',
      source: 'esri-sat',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export const TOPO_STYLE_OBJECT = {
  version: 8,
  sources: {
    opentopo: {
      type: 'raster',
      tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenTopoMap (CC-BY-SA)',
      maxzoom: 17,
    },
  },
  layers: [
    {
      id: 'opentopo-layer',
      type: 'raster',
      source: 'opentopo',
      minzoom: 0,
      maxzoom: 17,
    },
  ],
};

export const SATELLITE_STYLE_DATA_URL = `data:application/json;charset=utf-8,${encodeURIComponent(
  JSON.stringify(SATELLITE_STYLE_OBJECT)
)}`;

export const TOPO_STYLE_DATA_URL = `data:application/json;charset=utf-8,${encodeURIComponent(
  JSON.stringify(TOPO_STYLE_OBJECT)
)}`;

export interface BasemapOption {
  id: string;
  name: string;
  tag: string;
  url: string;
}

export const BASEMAP_OPTIONS: BasemapOption[] = [
  {
    id: 'dark-matter',
    name: 'CartoDB Dark Matter',
    tag: 'Broadcast Night',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
  {
    id: 'positron',
    name: 'CartoDB Positron',
    tag: 'Minimal Light',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
  {
    id: 'voyager',
    name: 'CartoDB Voyager',
    tag: 'Terrain & Roads',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  },
  {
    id: 'satellite',
    name: 'ESRI World Imagery',
    tag: '4K Satellite',
    url: 'satellite',
  },
  {
    id: 'topo',
    name: 'OpenTopoMap Terrain',
    tag: 'Contour Lines',
    url: 'topo',
  },
];

/**
 * Resolves a basemap style identifier or URL into a MapLibre-compatible StyleSpecification or URL string.
 * For raster styles (satellite, topo), returns the raw StyleSpecification object to avoid CORS or fetch errors.
 */
export function resolveBasemapStyle(styleIdOrUrl: string): string | object {
  if (!styleIdOrUrl) {
    return BASEMAP_OPTIONS[0].url;
  }
  if (
    styleIdOrUrl === 'satellite' ||
    styleIdOrUrl === SATELLITE_STYLE_DATA_URL ||
    styleIdOrUrl.includes('esri') ||
    styleIdOrUrl.includes('World_Imagery')
  ) {
    return SATELLITE_STYLE_OBJECT;
  }
  if (
    styleIdOrUrl === 'topo' ||
    styleIdOrUrl === TOPO_STYLE_DATA_URL ||
    styleIdOrUrl.includes('opentopo')
  ) {
    return TOPO_STYLE_OBJECT;
  }
  if (styleIdOrUrl.startsWith('data:application/json')) {
    try {
      const jsonStr = decodeURIComponent(styleIdOrUrl.split(',')[1]);
      return JSON.parse(jsonStr);
    } catch {
      return styleIdOrUrl;
    }
  }
  return styleIdOrUrl;
}
