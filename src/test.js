import { getSatelliteById } from './api/satelliteService.js';

// Test getting the ISS (NORAD ID 25544)
const testSatelliteId = '25544';

console.log(`[DEBUG] Starting test for satellite ID: ${testSatelliteId}`);

try {
  const satellite = await getSatelliteById(testSatelliteId);
  
  console.log('[DEBUG] ===== SATELLITE DATA =====');
  console.log(`[DEBUG] Name: ${satellite.OBJECT_NAME}`);
  console.log(`[DEBUG] Object ID: ${satellite.OBJECT_ID}`);
  console.log(`[DEBUG] NORAD Cat ID: ${satellite.NORAD_CAT_ID}`);
  console.log(`[DEBUG] Epoch: ${satellite.EPOCH}`);
  console.log(`[DEBUG] Mean Motion: ${satellite.MEAN_MOTION}`);
  console.log(`[DEBUG] Inclination: ${satellite.INCLINATION}`);
  console.log(`[DEBUG] Eccentricity: ${satellite.ECCENTRICITY}`);
  console.log(`[DEBUG] RA of Asc Node: ${satellite.RA_OF_ASC_NODE}`);
  console.log(`[DEBUG] Arg of Pericenter: ${satellite.ARG_OF_PERICENTER}`);
  console.log(`[DEBUG] Mean Anomaly: ${satellite.MEAN_ANOMALY}`);
  console.log('[DEBUG] ===== END =====');
  console.log('[DEBUG] ✓ Test passed!');
  
} catch (error) {
  console.error('[DEBUG] ✗ Test failed with error:', error.message);
}
