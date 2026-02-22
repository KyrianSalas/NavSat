const LOCAL_API_BASE = 'http://localhost:8000';
const REMOTE_API_BASE = 'https://api.navsat.co.uk';
const LOCAL_REQUEST_TIMEOUT_MS = 1100;
const SATELLITE_CACHE_TTL_MS = 60_000;

let fallback = false;
const satelliteGroupCache = new Map();
const inflightSatelliteRequests = new Map();

function buildSatellitesUrl(baseUrl, group, limit, offset = 0) {
  const params = new URLSearchParams({ group, limit, offset });
  return `${baseUrl}/satellites?${params.toString()}`;
}

function getCachedGroup(group) {
  const cached = satelliteGroupCache.get(group);
  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expiresAt) {
    satelliteGroupCache.delete(group);
    return null;
  }

  return cached.data;
}

function setCachedGroup(group, data) {
  satelliteGroupCache.set(group, {
    data,
    expiresAt: Date.now() + SATELLITE_CACHE_TTL_MS,
  });
}

function createRequestController(externalSignal) {
  const controller = new AbortController();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', () => {
        controller.abort(externalSignal.reason);
      }, { once: true });
    }
  }
  return controller;
}

async function fetchJson(url, { signal, timeoutMs } = {}) {
  const controller = createRequestController(signal);
  let timeoutId = null;

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(new Error(`Timeout fetching ${url}`));
    }, timeoutMs);
  }

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

// 2. Pass limit through the fallback handler
async function fetchSatellitesWithFallback(group, limit, offset, signal) {
  const remoteUrl = buildSatellitesUrl(REMOTE_API_BASE, group, limit, offset);
  console.log(remoteUrl);
  if (fallback) {
    return fetchJson(remoteUrl, { signal });
  }

  const localUrl = buildSatellitesUrl(LOCAL_API_BASE, group, limit, offset);
  try {
    return await fetchJson(localUrl, {
      signal,
      timeoutMs: LOCAL_REQUEST_TIMEOUT_MS,
    });
  } catch (localError) {
    if (localError?.name === 'AbortError') {
      throw localError;
    }
    console.warn('Local API unavailable. Falling back to remote API...');
    fallback = true;
    return fetchJson(remoteUrl, { signal });
  }
}

/**
 * Fetch satellites by CelesTrak group
 */
export const getAllSatellites = async (group = 'visual', limit = 1000, options = {}) => {
  // 1. Extract offset from options, default to 0
  const { signal = undefined, forceRefresh = false, offset = 0 } = options;
  
  // 2. Include offset in the cache key so chunks are cached uniquely
  const cacheKey = `${group}-${limit}-${offset}`;

  if (!forceRefresh) {
    const cached = getCachedGroup(cacheKey);
    if (cached) return cached;
  }

  const canDeduplicate = !signal && !forceRefresh;
  if (canDeduplicate) {
    const existingRequest = inflightSatelliteRequests.get(cacheKey);
    if (existingRequest) return existingRequest;
  }

  const requestPromise = (async () => {
    try {
      // 3. Pass offset into the fetch handler
      const data = await fetchSatellitesWithFallback(group, limit, offset, signal);
      setCachedGroup(cacheKey, data);
      return data;
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('Error fetching satellites:', error);
      }
      throw error;
    }
  })();

  if (!canDeduplicate) return requestPromise;

  inflightSatelliteRequests.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inflightSatelliteRequests.delete(cacheKey);
  }
};

/**
 * Fetch a specific satellite by NORAD ID
 * @param {string} noradId - The NORAD catalog ID
 * @returns {Promise<Object>} Satellite data
 */
export const getSatelliteById = async (noradId) => {
  try {
    const baseUrl = fallback ? REMOTE_API_BASE : LOCAL_API_BASE;
    return await fetchJson(`${baseUrl}/satellites/${noradId}`);
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
export const cacheSatellites = async (group = 'visual', limit=1000) => {
  try {
    const baseUrl = fallback ? REMOTE_API_BASE : LOCAL_API_BASE;
    const response = await fetch(`${baseUrl}/satellites/cache?group=${group}&limit=${limit}`, {
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