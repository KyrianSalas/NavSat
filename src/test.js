import { getAllSatellites, getSatelliteById } from './api/satelliteService.js';

console.log('[DEBUG] ===== TESTING SATELLITE API WITH GROUPS =====\n');

// Test 1: Get visual satellites (brightest ~100)
console.log('[DEBUG] Test 1: Get visual satellites (default)');
try {
  const visual = await getAllSatellites('visual');
  console.log(`[DEBUG] ✓ Retrieved ${visual.length} visual satellites`);
  console.log(`[DEBUG]   Examples: ${visual.slice(0, 3).map(s => s.OBJECT_NAME).join(', ')}\n`);
} catch (error) {
  console.error('[DEBUG] ✗ Test failed:', error.message, '\n');
}

// Test 2: Get active satellites
console.log('[DEBUG] Test 2: Get active satellites');
try {
  const active = await getAllSatellites('active');
  console.log(`[DEBUG] ✓ Retrieved ${active.length} active satellites`);
  console.log(`[DEBUG]   Examples: ${active.slice(0, 3).map(s => s.OBJECT_NAME).join(', ')}\n`);
} catch (error) {
  console.error('[DEBUG] ✗ Test failed:', error.message, '\n');
}

// Test 3: Get weather satellites
console.log('[DEBUG] Test 3: Get weather satellites');
try {
  const weather = await getAllSatellites('weather');
  console.log(`[DEBUG] ✓ Retrieved ${weather.length} weather satellites`);
  console.log(`[DEBUG]   Examples: ${weather.slice(0, 3).map(s => s.OBJECT_NAME).join(', ')}\n`);
} catch (error) {
  console.error('[DEBUG] ✗ Test failed:', error.message, '\n');
}

// Test 4: Get space stations
console.log('[DEBUG] Test 4: Get space stations');
try {
  const stations = await getAllSatellites('stations');
  console.log(`[DEBUG] ✓ Retrieved ${stations.length} space stations`);
  stations.forEach(s => console.log(`[DEBUG]   - ${s.OBJECT_NAME}`));
  console.log('');
} catch (error) {
  console.error('[DEBUG] ✗ Test failed:', error.message, '\n');
}

// Test 5: Get specific satellite (ISS)
console.log('[DEBUG] Test 5: Get ISS by NORAD ID (25544)');
try {
  const iss = await getSatelliteById('25544');
  console.log('[DEBUG] ===== ISS DATA =====');
  console.log(`[DEBUG] Name: ${iss.OBJECT_NAME}`);
  console.log(`[DEBUG] NORAD ID: ${iss.NORAD_CAT_ID}`);
  console.log(`[DEBUG] Inclination: ${iss.INCLINATION}°`);
  console.log(`[DEBUG] Eccentricity: ${iss.ECCENTRICITY}`);
  console.log('[DEBUG] ===== END =====\n');
} catch (error) {
  console.error('[DEBUG] ✗ Test failed:', error.message, '\n');
}

console.log('[DEBUG] ===== ALL TESTS COMPLETE =====');
