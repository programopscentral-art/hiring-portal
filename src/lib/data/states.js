// State centroids in lat/lon (mainland India + key UTs).
// Used by IndiaMap to position pins. Projection bounds are tuned to match
// the inline India SVG path in IndiaMap.svelte.

export const INDIA_STATES = {
  'Andhra Pradesh':       { lon: 79.74, lat: 15.91, abbr: 'AP' },
  'Arunachal Pradesh':    { lon: 94.73, lat: 28.22, abbr: 'AR' },
  'Assam':                { lon: 92.94, lat: 26.20, abbr: 'AS' },
  'Bihar':                { lon: 85.31, lat: 25.10, abbr: 'BR' },
  'Chhattisgarh':         { lon: 81.86, lat: 21.28, abbr: 'CG' },
  'Goa':                  { lon: 74.12, lat: 15.30, abbr: 'GA' },
  'Gujarat':              { lon: 71.19, lat: 22.31, abbr: 'GJ' },
  'Haryana':              { lon: 76.09, lat: 29.06, abbr: 'HR' },
  'Himachal Pradesh':     { lon: 77.17, lat: 31.10, abbr: 'HP' },
  'Jharkhand':            { lon: 85.28, lat: 23.61, abbr: 'JH' },
  'Karnataka':            { lon: 75.71, lat: 15.32, abbr: 'KA' },
  'Kerala':               { lon: 76.27, lat: 10.85, abbr: 'KL' },
  'Madhya Pradesh':       { lon: 78.66, lat: 22.97, abbr: 'MP' },
  'Maharashtra':          { lon: 75.71, lat: 19.75, abbr: 'MH' },
  'Manipur':              { lon: 93.91, lat: 24.66, abbr: 'MN' },
  'Meghalaya':            { lon: 91.37, lat: 25.47, abbr: 'ML' },
  'Mizoram':              { lon: 92.94, lat: 23.16, abbr: 'MZ' },
  'Nagaland':             { lon: 94.56, lat: 26.16, abbr: 'NL' },
  'Odisha':               { lon: 85.10, lat: 20.95, abbr: 'OD' },
  'Punjab':               { lon: 75.34, lat: 31.15, abbr: 'PB' },
  'Rajasthan':            { lon: 74.22, lat: 27.02, abbr: 'RJ' },
  'Sikkim':               { lon: 88.51, lat: 27.53, abbr: 'SK' },
  'Tamil Nadu':           { lon: 78.66, lat: 11.13, abbr: 'TN' },
  'Telangana':            { lon: 79.02, lat: 18.11, abbr: 'TS' },
  'Tripura':              { lon: 91.99, lat: 23.94, abbr: 'TR' },
  'Uttar Pradesh':        { lon: 80.95, lat: 26.85, abbr: 'UP' },
  'Uttarakhand':          { lon: 79.02, lat: 30.07, abbr: 'UK' },
  'West Bengal':          { lon: 87.86, lat: 22.99, abbr: 'WB' },
  'Delhi':                { lon: 77.10, lat: 28.70, abbr: 'DL' },
  'Jammu and Kashmir':    { lon: 76.58, lat: 33.78, abbr: 'JK' },
  'Ladakh':               { lon: 77.57, lat: 34.15, abbr: 'LA' },
  'Puducherry':           { lon: 79.81, lat: 11.93, abbr: 'PY' },
  'Chandigarh':           { lon: 76.78, lat: 30.73, abbr: 'CH' },
};

// India bounding box — must match the projection used in india-svg.js
// (geo-to-svg.mjs script that generated the state paths).
const LON_MIN = 67.5, LON_MAX = 97.5;
const LAT_MIN = 7.5, LAT_MAX = 36.0;

// Project lat/lon to (x, y) inside the SVG viewBox, with a centered padding.
export function project(state, w, h, padding = 30) {
  const meta = INDIA_STATES[state];
  if (!meta) return null;
  const innerW = w - padding * 2;
  const innerH = h - padding * 2;
  const x = ((meta.lon - LON_MIN) / (LON_MAX - LON_MIN)) * innerW + padding;
  const y = h - (((meta.lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * innerH + padding);
  return { x, y };
}

export function abbr(state) { return INDIA_STATES[state]?.abbr || state.slice(0, 3).toUpperCase(); }
