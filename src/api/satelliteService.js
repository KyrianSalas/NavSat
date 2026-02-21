const LOCAL_API_BASE = 'http://localhost:8000';
const REMOTE_API_BASE = 'https://api.navsat.co.uk'

let fallback = false;

/**
 * Fetch satellites by CelesTrak group
 * @param {string} group - CelesTrak group (visual, active, stations, weather, etc.)
 * @returns {Promise<Array>} Array of satellite data
 */
export const getAllSatellites = async (group = 'visual') => {
    const baseUrl = fallback ? REMOTE_API_BASE : LOCAL_API_BASE;
    try {
    const response = await fetch(`${baseUrl}/satellites?group=${group}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
        if (!fallback) {
            console.warn('Local API not running. Switching to Vercel...');
            fallback = true;
            const fallbackResponse = await fetch(`${REMOTE_API_BASE}/satellites?group=${group}`);
            return await fallbackResponse.json();
        }
    console.error('Error fetching satellites:', error);
    throw error;
  }
};

/**
 * Fetch a specific satellite by NORAD ID
 * @param {string} noradId - The NORAD catalog ID
 * @returns {Promise<Object>} Satellite data
 */
export const getSatelliteById = async (noradId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/satellites/${noradId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching satellite ${noradId}:`, error);
    throw error;
  }
};

/**
 * Cache satellites from the CelesTrak API
 * @param {string} group - CelesTrak group to cache
 * @returns {Promise<Object>} Cache results
 */
export const cacheSatellites = async (group = 'visual') => {
  try {
    const response = await fetch(`${API_BASE_URL}/satellites/cache?group=${group}`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error caching satellites:', error);
    throw error;
  }
};
