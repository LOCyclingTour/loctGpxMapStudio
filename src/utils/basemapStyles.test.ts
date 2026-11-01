import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveBasemapStyle,
  BASEMAP_OPTIONS,
  SATELLITE_STYLE_OBJECT,
  TOPO_STYLE_OBJECT,
} from './basemapStyles.ts';

test('resolveBasemapStyle returns raw StyleSpecification for satellite', () => {
  const resolved = resolveBasemapStyle('satellite');
  assert.equal(typeof resolved, 'object');
  assert.equal((resolved as any).sources['esri-sat'] !== undefined, true);
  assert.deepEqual(resolved, SATELLITE_STYLE_OBJECT);
});

test('resolveBasemapStyle returns raw StyleSpecification for topo', () => {
  const resolved = resolveBasemapStyle('topo');
  assert.equal(typeof resolved, 'object');
  assert.equal((resolved as any).sources['opentopo'] !== undefined, true);
  assert.deepEqual(resolved, TOPO_STYLE_OBJECT);
});

test('resolveBasemapStyle passes through remote HTTP JSON style URLs', () => {
  const cartoUrl = BASEMAP_OPTIONS[0].url;
  const resolved = resolveBasemapStyle(cartoUrl);
  assert.equal(typeof resolved, 'string');
  assert.equal(resolved, cartoUrl);
});

test('resolveBasemapStyle decodes data: URLs if passed', () => {
  const dummyObj = { version: 8, sources: {}, layers: [] };
  const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dummyObj))}`;
  const resolved = resolveBasemapStyle(dataUrl);
  assert.equal(typeof resolved, 'object');
  assert.deepEqual(resolved, dummyObj);
});
