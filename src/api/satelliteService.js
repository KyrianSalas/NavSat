const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Fetch all satellites from the cache
 * @returns {Promise<Array>} Array of satellite data
 */
export const getAllSatellites = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/satellites`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
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
 * @returns {Promise<Object>} Cache results
 */
export const cacheSatellites = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/satellites/cache`, {
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
