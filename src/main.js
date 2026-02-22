import * as THREE from 'three';
import * as satellite from "satellite.js"
import { getUserLocation } from './services/locationService.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { setupPlanetVisuals } from './widgets/planetVisuals.js';
import { setupSidebar } from './widgets/uiManager.js';
import { addUserLocationMarker } from './widgets/userLocationMarker.js';
import { centerToUserLocation } from './widgets/centerToUserLocation.js';
import { setupGroupSelector } from './widgets/groupSelector.js';
import { setupCountrySelector } from './widgets/countrySelector.js';
import { ensureTopBarStyles } from './widgets/ui/styles.js';
import { setupStormMarkers } from './widgets/stormMarkers.js';
import { setupSatelliteLegend } from './widgets/satelliteLegend.js';
import { setupAboutOverlay } from './widgets/aboutOverlay.js';
import * as service from './api/satelliteService.js'
import { DESCRIPTIONS } from './descriptions.js';

// Load descriptions cache
let descriptionCache = DESCRIPTIONS;
console.log(`✓ Loaded ${Object.keys(descriptionCache).length} unique descriptions from module`);

function getDescriptionForSatellite(satelliteName, noradId) {
  if (!satelliteName) return '';
  
  const upper = satelliteName.toUpperCase();
  
  // Hardcoded group descriptions (always available instantly)
  if (upper.includes('STARLINK')) return "Part of SpaceX's Starlink mega-constellation - 5,000+ satellites providing global internet connectivity.";
  if (upper.includes('ONEWEB')) return "OneWeb satellite providing global broadband coverage to underserved regions.";
  if (upper.includes('IRIDIUM')) return "Iridium communications satellite enabling calls from anywhere on Earth.";
  if (upper.includes('GLOBALSTAR')) return "GlobalStar satellite providing emergency distress beacons and mobile coverage.";
  if (upper.includes('KUIPER')) return "Amazon Kuiper satellite for global internet coverage.";
  
  // Check cache for unique descriptions
  const desc = descriptionCache[String(noradId)];
  if (desc) {
    console.log(`Found description for ${noradId}: ${desc.substring(0, 50)}...`);
  }
  return desc || '';
}

// Apply styles
ensureTopBarStyles();
setupAboutOverlay();

// --- Renderer ---

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
let suppressCanvasClickUntilMs = 0;

const isCoarsePointerDevice = window.matchMedia('(pointer: coarse)').matches;
const isSmallViewport = window.matchMedia('(max-width: 900px)').matches;
const enforcePortraitMode = isCoarsePointerDevice && isSmallViewport;
let landscapeGuard = null;

if (enforcePortraitMode) {
  landscapeGuard = document.createElement('div');
  landscapeGuard.setAttribute('aria-live', 'polite');
  Object.assign(landscapeGuard.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '100000',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '20px',
    background: 'radial-gradient(circle at center, rgba(6, 18, 40, 0.97), rgba(3, 9, 20, 0.99))',
    color: '#d9ecff',
    fontFamily: '"Electrolize", "Segoe UI", sans-serif',
    letterSpacing: '0.03em',
  });
  landscapeGuard.textContent = 'Portrait mode only. Rotate your device.';
  document.body.appendChild(landscapeGuard);

  const syncPortraitGuard = () => {
    const isLandscapeNow = window.matchMedia('(orientation: landscape)').matches;
    landscapeGuard.style.display = isLandscapeNow ? 'flex' : 'none';
  };

  syncPortraitGuard();
  window.addEventListener('resize', syncPortraitGuard);
  window.addEventListener('orientationchange', syncPortraitGuard);

  if (screen.orientation && typeof screen.orientation.lock === 'function') {
    screen.orientation.lock('portrait').catch(() => {});
  }
}

// --- Scene & Camera ---

const scene = new THREE.Scene();
const centerLocationButton = document.getElementById('centerLocationButton');
const defaultCameraPosition = new THREE.Vector3(0, 0, 3);
const defaultCameraTarget = new THREE.Vector3(0, 0, 0);


function hasValidLocation(value) {
  return Number.isFinite(value?.latitude) && Number.isFinite(value?.longitude);
}

function setCenterLocationButtonEnabled(enabled) {
  if (!centerLocationButton) {
    return;
  }

  centerLocationButton.disabled = !enabled;
  centerLocationButton.setAttribute('aria-disabled', String(!enabled));
  centerLocationButton.title = enabled ? 'Center on my location' : 'Location unavailable';
}

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.copy(defaultCameraPosition);
const planetVisuals = setupPlanetVisuals({ scene, camera, renderer });

// Sidebar will be set up after satellites load
let sidebarManager = null;
let groupSelectorConfig = null;
let countrySelectorConfig = null;
let satelliteLegend = null;
const stormSystem = setupStormMarkers(scene);

// --- SATELLITE LIMIT & CACHE STATE ---
let currentGroup = 'active';
let currentSatelliteLimit = 14000;
let fullGroupCache = []
let currentCountryFilter = 'all';

const SATELLITE_LEGEND_ITEMS = [
  { label: 'US / NASA / Starlink', color: '#00ffff' },
  { label: 'Russia / Soviet', color: '#ff2222' },
  { label: 'China', color: '#ffcc00' },
  { label: 'ESA / Europe', color: '#3388ff' },
  { label: 'Japan', color: '#ffffff' },
  { label: 'India', color: '#ff8800' },
  { label: 'Other', color: '#cc55ff' },
];

function initializeSidebar() {
  if (sidebarManager) {
    // If sidebar already exists, just skip re-initialization
    return;
  }
  
  sidebarManager = setupSidebar({
    postProcessing: {
      cycleMode: () => planetVisuals.cyclePostFxMode(),
      getActiveMode: () => planetVisuals.getActivePostFxMode(),
    },
    environmentLayers: {
      cloudLayer: planetVisuals.cloudLayer,
      atmosphereLayer: planetVisuals.atmosphereLayer,
      stormGroup: stormSystem.group,
    },
    centerLocationButton,
    onResetCameraView: () => resetCameraToStartView(),
    satelliteLimit: currentSatelliteLimit,
    onLimitChange: (newLimit) => {
        currentSatelliteLimit = newLimit;
        clearSatellites();
        loadSatellites(currentGroup);
    },
    textSpeed: calloutTextSpeedMode,
    onTextSpeedChange: (mode) => {
      applyCalloutTextSpeed(mode);
    },
    satelliteData: {
      activeSatellites,
      satelliteDataMap,
    },
    onMultiplierChange: (multiplier) => {
        timeMultiplier = multiplier;
    },
    onJumpToPresent: () => {
      virtualTimeMs = Date.now(); // Reset virtual clock to real world time
    },
    onSelectSatellite: (sat) => {
      if (typeof selectSatellite === 'function') {
        selectSatellite(sat);
      }
    },
  });
  
  // Now that sidebar is initialized, mount the group selector with the sidebar content
  if (groupSelectorConfig && sidebarManager && sidebarManager.sidebarContent) {
    setupGroupSelector({
      ...groupSelectorConfig,
      mountTarget: sidebarManager.sidebarContent,
    });
  }

  if (countrySelectorConfig && sidebarManager && sidebarManager.sidebarContent) {
    setupCountrySelector({
      ...countrySelectorConfig,
      mountTarget: sidebarManager.sidebarContent,
    });
  }

  if (!satelliteLegend) {
    satelliteLegend = setupSatelliteLegend({
      items: SATELLITE_LEGEND_ITEMS,
    });
  }
  
  return sidebarManager;
}

// --- Controls ---

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1.5;
controls.maxDistance = 10;

// Improve touch UX on mobile and prevent browser pinch-zoom hijacking.
renderer.domElement.style.touchAction = 'none';
if (window.matchMedia('(pointer: coarse)').matches) {
  controls.rotateSpeed = 0.9;
  controls.zoomSpeed = 1.15;
}
['gesturestart', 'gesturechange', 'gestureend'].forEach((eventName) => {
  renderer.domElement.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
});

function setupUiPinchZoomGuard() {
  if (!window.matchMedia('(pointer: coarse)').matches) {
    return;
  }

  const isUiTarget = (target) => {
    if (!(target instanceof Element)) {
      return false;
    }
    // Keep pinch/zoom gestures available on the 3D canvas itself.
    return !target.closest('#canvas');
  };

  const preventUiPinchZoom = (event) => {
    if (event.touches && event.touches.length > 1 && isUiTarget(event.target)) {
      suppressCanvasClickUntilMs = performance.now() + 450;
      event.preventDefault();
    }
  };

  document.addEventListener('touchstart', preventUiPinchZoom, { passive: false, capture: true });
  document.addEventListener('touchmove', preventUiPinchZoom, { passive: false, capture: true });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((eventName) => {
    document.addEventListener(eventName, (event) => {
      if (isUiTarget(event.target)) {
        suppressCanvasClickUntilMs = performance.now() + 450;
        event.preventDefault();
      }
    }, { passive: false, capture: true });
  });
}

setupUiPinchZoomGuard();

// Two-finger gestures on canvas can still produce a synthetic click afterward.
// Suppress picking briefly after any multi-touch activity.
document.addEventListener('touchstart', (event) => {
  if (event.touches && event.touches.length > 1) {
    suppressCanvasClickUntilMs = performance.now() + 450;
  }
}, { passive: true, capture: true });

document.addEventListener('touchmove', (event) => {
  if (event.touches && event.touches.length > 1) {
    suppressCanvasClickUntilMs = performance.now() + 450;
  }
}, { passive: true, capture: true });

addUserLocationMarker(scene);

// --- Raycaster for click detection ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedSatellite = null;
let selectedStorm = null;
const isAnimatingCameraRef = { current: false };
const mobileFollowMatrix = new THREE.Matrix4();
const mobileFollowSatPosition = new THREE.Vector3();
const mobileFollowDesiredCameraPosition = new THREE.Vector3();

// --- User location ---
let location = null
setCenterLocationButtonEnabled(false);
getUserLocation().then(loc => {
    location = loc;
    setCenterLocationButtonEnabled(hasValidLocation(location));
    console.log('location:', location);
}).catch(err => {
  location = null;
  setCenterLocationButtonEnabled(false);
  console.warn('Location access denied or failed:', err);
});

const projectedSatelliteScreen = new THREE.Vector3();

const infoBox = document.getElementById('infoBox');
const infoTitle = document.getElementById('infoTitle');
const infoCard = document.getElementById('infoCard');
const satelliteDetails = document.getElementById('satelliteDetails');
const fireLaserButton = document.getElementById('fireLaserButton');
const showOrbitButton = document.getElementById('showOrbitButton');
let currentOrbitLine = null;
let orbitingSatId = null;
const infoConnectorPath = document.getElementById('infoConnectorPath');
const infoConnectorStart = document.getElementById('infoConnectorStart');
let timeMultiplier = 1.0; // 1.0 = real-time, 2.0 = double speed, -2.0 = reverse
let virtualTimeMs = Date.now();
let lastFrameTimeMs = performance.now();

const calloutTyping = {
  titleTarget: '',
  detailsTarget: '',
  titleIndex: 0,
  detailsIndex: 0,
  lastStepMs: 0,
  stepIntervalMs: 18,
  active: false,
};

const textSpeedIntervals = {
  normal: 18,
  fast: 8,
};

let calloutTextSpeedMode = 'normal';

function applyCalloutTextSpeed(mode) {
  calloutTextSpeedMode = mode;

  if (mode === 'disabled') {
    calloutTyping.active = false;
    if (calloutTyping.titleTarget) {
      calloutTyping.titleIndex = calloutTyping.titleTarget.length;
      infoTitle.textContent = calloutTyping.titleTarget;
    }
    if (calloutTyping.detailsTarget) {
      calloutTyping.detailsIndex = calloutTyping.detailsTarget.length;
      satelliteDetails.textContent = calloutTyping.detailsTarget;
    }
    return;
  }

  calloutTyping.stepIntervalMs = textSpeedIntervals[mode] || textSpeedIntervals.normal;
}

const calloutLayout = {
  initialized: false,
  p0x: 0,
  p0y: 0,
  width: 320,
};

const calloutReveal = {
  active: false,
  startMs: 0,
  durationMs: 360,
  progress: 1,
};

const titleMeasureCanvas = document.createElement('canvas');
const titleMeasureContext = titleMeasureCanvas.getContext('2d');

function measureCalloutTitleWidth(text) {
  if (!titleMeasureContext || !text) {
    return 120;
  }
  titleMeasureContext.font = '700 24px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
  return titleMeasureContext.measureText(text).width;
}

// --------------- SATELLITES ---------------

const dummy = new THREE.Object3D();
let satInstancedMesh;
const RENDER_TRAILS_THRESHOLD = 500;
const MIN_SATELLITE_UPDATE_INTERVAL_MS = 16;
const MAX_SATELLITE_UPDATE_INTERVAL_MS = 80;
const MAX_TIME_MULTIPLIER_FOR_FASTEST_UPDATES = 20;
const OFFSCREEN_UPDATE_INTERVAL_MS = 450;
const OFFSCREEN_UPDATE_BATCH_SIZE = 450;
const MIN_OFFSCREEN_UPDATE_INTERVAL_MS = 90;
const MAX_OFFSCREEN_BATCH_MULTIPLIER = 4;
const SATELLITE_VISIBILITY_NDC_MARGIN = 0.35;
const SATELLITE_VISIBILITY_Z_MARGIN = 0.25;
const SATELLITE_VISIBILITY_GRACE_MS = 1000;
const EARTH_RADIUS_KM = 6371;

const sharedSatGeometry = new THREE.SphereGeometry(0.005, 8, 8);
const sharedSatMaterial = new THREE.MeshBasicMaterial({color: 0xffffff});

// The dictionary
const satelliteDataMap = {};
const activeSatellites = [];

// Creating the visual marker (the red dot)
const TRAIL_LENGTH_MINUTES = 3; // How long you want the tail to be
const TRAIL_POINTS = 5; // Smoothness of the tail
const TRAIL_STEP_MS = (TRAIL_LENGTH_MINUTES * 60000) / TRAIL_POINTS;

const initialPositions = [];
for (let i = 0; i < TRAIL_POINTS; i++) {
    initialPositions.push(0, 0, 0);
}

let lastSatelliteUpdateMs = 0;
let satelliteLoadToken = 0;
let satelliteLoadController = null;
let lastOffscreenUpdateMs = 0;
let offscreenUpdateCursor = 0;
let earthLaserHitCount = 0;
let earthExplosionTriggered = false;
let lastDestructiveEffectsUpdateMs = performance.now();
let earthResetTimeoutId = null;
const visibilityProbeNdc = new THREE.Vector3();

const sharedTrailMaterial = new LineMaterial({
    color: 0xffffff, // Use white so vertex colors show through correctly
    linewidth: 4,    // CHANGE THIS NUMBER TO MAKE IT WIDER/THINNER
    vertexColors: true, // Necessary for gradient
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    dashed: false,
    alphaToCoverage: false,
});

sharedTrailMaterial.resolution.set(window.innerWidth, window.innerHeight);

function getSatelliteCountryKey(jsonData) {
  const name = (jsonData.OBJECT_NAME || '').toUpperCase();

  // 1. Soviet / Russian
  // COSMOS, SL- (Soviet launchers), INTERCOSMOS, RESURS, OKEAN, ZARYA (ISS module)
  if (name.includes('COSMOS') || name.startsWith('SL-') ||
    name.includes('INTERCOSMOS') || name.includes('RESURS') ||
    name.includes('OKEAN') || name.includes('ZARYA')) {
    return 'russia';
  }

  // 2. Chinese
  // CZ- (Long March), SHIJIAN, YAOGAN, HXMT, CSS (Chinese Space Station), SZ- (Shenzhou)
  if (name.startsWith('CZ-') || name.includes('SHIJIAN') ||
    name.includes('YAOGAN') || name.includes('HXMT') ||
    name.includes('CSS') || name.startsWith('SZ-')) {
    return 'china';
  }

  // 3. European Space Agency / Arianespace
  // ARIANE, ENVISAT, HELIOS
  if (name.includes('ARIANE') || name.includes('ENVISAT') || 
      name.includes('HELIOS') || name.includes('ONEWEB')) {
    return 'esa';
  }

  // 4. Japanese
  // H-2A (Launcher), ALOS, ASTRO, AJISAI, MIDORI, XRISM
  if (name.includes('H-2A') || name.includes('ALOS') ||
    name.includes('ASTRO') || name.includes('AJISAI') ||
    name.includes('MIDORI') || name.includes('XRISM')) {
    return 'japan';
  }

  // 5. United States / NASA / Commercial US
  // ATLAS, DELTA, THOR, TITAN, USA, OAO, SERT, SEASAT, AQUA, HST, ACS3
  if (name.includes('ATLAS') || name.includes('DELTA') ||
    name.includes('THOR') || name.includes('TITAN') ||
    name.startsWith('USA ') || name.includes('OAO') ||
    name.includes('SERT') || name.includes('SEASAT') ||
    name.includes('AQUA') || name.includes('HST') || name.includes('ACS3') || name.includes('STARLINK')) {
    return 'us';
  }

  // 6. Indian
  // GSLV
  if (name.includes('GSLV') || name.includes('INSAT')) {
    return 'india';
  }

  return 'other';
}

function getSatelliteColorHexByCountryKey(countryKey) {
  switch (countryKey) {
    case 'russia':
      return 0xff2222;
    case 'china':
      return 0xffcc00;
    case 'esa':
      return 0x3388ff;
    case 'japan':
      return 0xffffff;
    case 'india':
      return 0xff8800;
    case 'us':
      return 0x00ffff;
    default:
      return 0xcc55ff;
  }
}

function getSatelliteColorHex(jsonData) {
  const countryKey = jsonData.countryKey || getSatelliteCountryKey(jsonData);
  return getSatelliteColorHexByCountryKey(countryKey);
}

function isSatelliteLikelyVisible(sat, nowMs) {
  if (!sat.worldPosition) {
    return true;
  }
  visibilityProbeNdc.copy(sat.worldPosition).project(camera);
  const isInExpandedViewport = (
    visibilityProbeNdc.z > (-1 - SATELLITE_VISIBILITY_Z_MARGIN) &&
    visibilityProbeNdc.z < (1 + SATELLITE_VISIBILITY_Z_MARGIN) &&
    visibilityProbeNdc.x > (-1 - SATELLITE_VISIBILITY_NDC_MARGIN) &&
    visibilityProbeNdc.x < (1 + SATELLITE_VISIBILITY_NDC_MARGIN) &&
    visibilityProbeNdc.y > (-1 - SATELLITE_VISIBILITY_NDC_MARGIN) &&
    visibilityProbeNdc.y < (1 + SATELLITE_VISIBILITY_NDC_MARGIN)
  );

  if (isInExpandedViewport) {
    sat.lastLikelyVisibleMs = nowMs;
    return true;
  }

  if (sat.lastLikelyVisibleMs && (nowMs - sat.lastLikelyVisibleMs) < SATELLITE_VISIBILITY_GRACE_MS) {
    return true;
  }

  return false;
}

function getFilteredSatelliteKeys() {
  return Object.keys(satelliteDataMap).filter((satId) => {
    if (currentCountryFilter === 'all') {
      return true;
    }
    const satData = satelliteDataMap[satId];
    if (!satData) {
      return false;
    }
    return satData.countryKey === currentCountryFilter;
  });
}

function buildSatelliteMeshes() {
  if (earthExplosionTriggered) {
    return;
  }

  const satKeys = getFilteredSatelliteKeys().slice(0, currentSatelliteLimit);
    const numSatellites = satKeys.length;
    
    // 1. CLEANUP: Remove old trails from the scene before clearing the array
    activeSatellites.forEach(sat => {
        if (sat.trailLine) {
            scene.remove(sat.trailLine);
            if (sat.trailGeometry) sat.trailGeometry.dispose();
        }
    });
    activeSatellites.length = 0;

    // 2. DISPOSE: Remove the old InstancedMesh entirely to resize for the new count
    if (satInstancedMesh) {
        scene.remove(satInstancedMesh);
        satInstancedMesh.dispose();
        // If you are using a custom material with textures, dispose it here too
    }

    // 3. INITIALISE: Create the new mesh for the current total count
    satInstancedMesh = new THREE.InstancedMesh(sharedSatGeometry, sharedSatMaterial, numSatellites);
    satInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    satInstancedMesh.frustumCulled = false;
    scene.add(satInstancedMesh);

    const now = new Date();
    const gmstNow = satellite.gstime(now);
    const renderTrails = numSatellites < RENDER_TRAILS_THRESHOLD;
    const satColor = new THREE.Color();

    // 4. POPULATE: Loop through ALL currently loaded satellites
    for (let index = 0; index < satKeys.length; index += 1) {
        const satId = satKeys[index];
        const jsonData = satelliteDataMap[satId];
        
        // Reuse parsed satrec cached during ingest.
        const satrec = jsonData.satrec;
        
        // Apply Geopolitical colour
        satColor.setHex(getSatelliteColorHexByCountryKey(jsonData.countryKey));
        satInstancedMesh.setColorAt(index, satColor);

        let trailGeo = null;
        let trailLine = null;

        // Create trails only if we are below the performance threshold
        if (renderTrails) {
            const trailColors = [];
            const colorHelper = new THREE.Color();
            for (let i = 0; i < TRAIL_POINTS; i++) {
                const t = i / (TRAIL_POINTS - 1);
                const intensity = Math.pow(t, 2.0);
                colorHelper.setRGB(satColor.r * intensity, satColor.g * intensity, satColor.b * intensity);
                trailColors.push(colorHelper.r, colorHelper.g, colorHelper.b);
            }

            trailGeo = new LineGeometry();
            trailGeo.setPositions(initialPositions);
            trailGeo.setColors(trailColors);
            trailLine = new Line2(trailGeo, sharedTrailMaterial);
            scene.add(trailLine);
        }

        // Calculate initial position for this frame
        const posAndVel = satellite.propagate(satrec, now);
        let altitudeKm = 0;
        let speedKms = 0;
        let angleDeg = 0;
        let worldPosition = null;

        if (posAndVel && posAndVel.position && !Number.isNaN(posAndVel.position.x)) {
            const posGd = satellite.eciToGeodetic(posAndVel.position, gmstNow);
            const r = 1 + (posGd.height / EARTH_RADIUS_KM);
            const x = r * Math.cos(posGd.latitude) * Math.cos(posGd.longitude);
            const y = r * Math.sin(posGd.latitude);
            const z = r * Math.cos(posGd.latitude) * Math.sin(-posGd.longitude);

            if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
                dummy.position.set(x, y, z);
                dummy.updateMatrix();
                satInstancedMesh.setMatrixAt(index, dummy.matrix);
                worldPosition = new THREE.Vector3(x, y, z);
            }

            altitudeKm = posGd.height;
            if (posAndVel.velocity && !Number.isNaN(posAndVel.velocity.x)) {
                speedKms = Math.sqrt(
                    (posAndVel.velocity.x ** 2) +
                    (posAndVel.velocity.y ** 2) +
                    (posAndVel.velocity.z ** 2)
                );
            }
            angleDeg = (THREE.MathUtils.radToDeg(Math.atan2(z, x)) + 360) % 360;
        }

        // Add to the active tracking list for the update loop
        activeSatellites.push({
            id: satId,
            satrec: satrec,
            index: index, 
            trailGeometry: trailGeo,
            trailLine: trailLine, 
            trailPositions: trailGeo ? new Float32Array(TRAIL_POINTS * 3) : null,
            altitudeKm,
            speedKms,
            angleDeg,
            worldPosition,
            lastUpdateMs: performance.now(),
        });
    }

    // 5. UPDATE GPU: Tell Three.js to send the new data to the shaders
    if (satInstancedMesh.instanceColor) {
        satInstancedMesh.instanceColor.needsUpdate = true;
    }
    satInstancedMesh.instanceMatrix.needsUpdate = true;
    lastSatelliteUpdateMs = performance.now();
    lastOffscreenUpdateMs = 0;
    offscreenUpdateCursor = 0;
}

// --- NEW CLEAR LOGIC ---
function clearSatellites() {
    clearSelectedSatelliteState();

    if (satInstancedMesh) {
        scene.remove(satInstancedMesh);
        satInstancedMesh.dispose();
        satInstancedMesh = null;
    }

    for (let i = 0; i < activeSatellites.length; i += 1) {
        const sat = activeSatellites[i];
        if (sat.trailLine) {
            scene.remove(sat.trailLine);
            sat.trailGeometry.dispose();
        }
    }

    // Wipe the arrays for the new fetch
    for (const prop of Object.getOwnPropertyNames(satelliteDataMap)) {
        delete satelliteDataMap[prop];
    }
    activeSatellites.length = 0;
}

async function loadSatellites(group = "active") {
    if (earthExplosionTriggered) {
        return;
    }

    const loadToken = ++satelliteLoadToken;
    const CHUNK_SIZE = 500;
    let loadedCount = 0;

    if (satelliteLoadController) satelliteLoadController.abort();
    satelliteLoadController = new AbortController();

    try {
        initializeSidebar();
        clearSatellites(); 

        // Keep loading until the currently selected filter has enough satellites
        // (or until the API runs out of data).
        while (true) {
            if (earthExplosionTriggered) {
                break;
            }

            const filteredCount = getFilteredSatelliteKeys().length;
            if (filteredCount >= currentSatelliteLimit) {
                break;
            }

            // For "all", only fetch what we still need. For country filtering,
            // fetch in fixed chunks so we can find enough matching satellites.
            const remainingUnfiltered = Math.max(0, currentSatelliteLimit - loadedCount);
            const limitToFetch = currentCountryFilter === 'all'
              ? Math.min(CHUNK_SIZE, remainingUnfiltered)
              : CHUNK_SIZE;

            if (limitToFetch === 0) {
              break;
            }

            const chunk = await service.getAllSatellites(group, limitToFetch, { 
                offset: loadedCount,
                signal: satelliteLoadController.signal 
            });

            if (loadToken !== satelliteLoadToken) break;
            if (earthExplosionTriggered) break;

            // If the API runs out of satellites before we hit our filtered limit, stop.
            if (!chunk || !Array.isArray(chunk) || chunk.length === 0) {
                console.log("Reached end of database before reaching limit.");
                break; 
            }

            chunk.forEach(sat => {
                sat.countryKey = getSatelliteCountryKey(sat);
                sat.satrec = satellite.json2satrec(sat);
                satelliteDataMap[sat.OBJECT_ID] = sat;
            });

            loadedCount += chunk.length;
            
            buildSatelliteMeshes(); 
            
            const nextFilteredCount = getFilteredSatelliteKeys().length;
            console.log(`Loaded ${loadedCount} total | ${nextFilteredCount} matching ${currentCountryFilter}`);

            await new Promise(r => setTimeout(r, 0)); 
        }

    } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error("Failed to load satellites.", error);
    }
}

// Cleaned up the dropdown config to remove the old cache clearing array
groupSelectorConfig = {
    initialGroup: 'active',
    onGroupChange: async (newGroup) => {
        clearSatellites();
        currentGroup = newGroup; // Keep the global group state updated
        await loadSatellites(newGroup);
    }
};
  
countrySelectorConfig = {
  initialCountry: 'all',
  countries: [
    { value: 'all', label: 'All Countries' },
    { value: 'us', label: 'US / NASA / Starlink' },
    { value: 'russia', label: 'Russia / Soviet' },
    { value: 'china', label: 'China' },
    { value: 'esa', label: 'ESA / Europe' },
    { value: 'japan', label: 'Japan' },
    { value: 'india', label: 'India' },
    { value: 'other', label: 'Other' },
  ],
  onCountryChange: async (country) => {
    currentCountryFilter = country;
    clearSelectedSatelliteState();
    await loadSatellites(currentGroup);
  }
};

loadSatellites("active");


function updateSatellites() {
    const nowMs = performance.now();
    
    // 1. VIRTUAL TIME CALCULATION
    // Calculate how much real time passed since the last frame
    const deltaRealTimeMs = nowMs - lastFrameTimeMs;
    lastFrameTimeMs = nowMs;

    // Advance the virtual clock (e.g., if multiplier is 10, time moves 10x faster)
    virtualTimeMs += deltaRealTimeMs * timeMultiplier;

    const warpFactor = Math.min(
        MAX_TIME_MULTIPLIER_FOR_FASTEST_UPDATES,
        Math.max(1, Math.abs(timeMultiplier))
    );
    const warpProgress =
        Math.log(warpFactor) / Math.log(MAX_TIME_MULTIPLIER_FOR_FASTEST_UPDATES);
    const adaptiveSatelliteUpdateIntervalMs =
        MAX_SATELLITE_UPDATE_INTERVAL_MS -
        ((MAX_SATELLITE_UPDATE_INTERVAL_MS - MIN_SATELLITE_UPDATE_INTERVAL_MS) * warpProgress);

    // 2. RATE LIMITING
    // Run less often at low warp, and approach 16ms by 20x warp.
    if ((nowMs - lastSatelliteUpdateMs) < adaptiveSatelliteUpdateIntervalMs) {
        return;
    }
    lastSatelliteUpdateMs = nowMs;

    // 3. PREPARE SATELLITE MATH
    const vTimeDate = new Date(virtualTimeMs);
    const gmstNow = satellite.gstime(vTimeDate);
    const numActive = activeSatellites.length;

    if (!satInstancedMesh) return;

    function updateSatelliteState(sat) {
        if (!sat.satrec) return false;

        const posAndVel = satellite.propagate(sat.satrec, vTimeDate);

        if (posAndVel && posAndVel.position && !Number.isNaN(posAndVel.position.x)) {
            const posGd = satellite.eciToGeodetic(posAndVel.position, gmstNow);
            const r = 1 + (posGd.height / EARTH_RADIUS_KM);

            const x = r * Math.cos(posGd.latitude) * Math.cos(posGd.longitude);
            const y = r * Math.sin(posGd.latitude);
            const z = r * Math.cos(posGd.latitude) * Math.sin(-posGd.longitude);

            dummy.position.set(x, y, z);
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            satInstancedMesh.setMatrixAt(sat.index, dummy.matrix);

            if (sat.worldPosition) {
                sat.worldPosition.set(x, y, z);
            } else {
                sat.worldPosition = new THREE.Vector3(x, y, z);
            }
            sat.lastUpdateMs = nowMs;

            if (selectedSatellite && selectedSatellite.id === sat.id) {
                sat.altitudeKm = posGd.height;
                if (posAndVel.velocity && !Number.isNaN(posAndVel.velocity.x)) {
                    sat.speedKms = Math.sqrt(
                        (posAndVel.velocity.x ** 2) +
                        (posAndVel.velocity.y ** 2) +
                        (posAndVel.velocity.z ** 2)
                    );
                }
                sat.angleDeg = (THREE.MathUtils.radToDeg(Math.atan2(z, x)) + 360) % 360;
            }

            if (sat.trailGeometry) {
                updateSatelliteTrail(sat, virtualTimeMs);
            }
            return true;
        }

        // Hide decayed or invalid satellites
        dummy.position.set(0, 0, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        satInstancedMesh.setMatrixAt(sat.index, dummy.matrix);
        sat.worldPosition = null;
        sat.lastUpdateMs = nowMs;
        return true;
    }

    const highPriority = [];
    const offscreen = [];
    for (let i = 0; i < numActive; i++) {
        const sat = activeSatellites[i];
        if (selectedSatellite && sat.id === selectedSatellite.id) {
            highPriority.push(sat);
            continue;
        }
        if (isSatelliteLikelyVisible(sat, nowMs)) {
            highPriority.push(sat);
        } else {
            offscreen.push(sat);
        }
    }

    let didUpdateMatrix = false;
    for (let i = 0; i < highPriority.length; i++) {
        didUpdateMatrix = updateSatelliteState(highPriority[i]) || didUpdateMatrix;
    }

    const adaptiveOffscreenIntervalMs = Math.max(
        MIN_OFFSCREEN_UPDATE_INTERVAL_MS,
        OFFSCREEN_UPDATE_INTERVAL_MS / warpFactor
    );
    const adaptiveBatchSize = Math.min(
        offscreen.length,
        Math.ceil(
            OFFSCREEN_UPDATE_BATCH_SIZE * Math.min(MAX_OFFSCREEN_BATCH_MULTIPLIER, Math.sqrt(warpFactor))
        )
    );

    if (offscreen.length > 0 && (nowMs - lastOffscreenUpdateMs) >= adaptiveOffscreenIntervalMs) {
        const batchSize = adaptiveBatchSize;
        for (let j = 0; j < batchSize; j++) {
            const offscreenIndex = (offscreenUpdateCursor + j) % offscreen.length;
            didUpdateMatrix = updateSatelliteState(offscreen[offscreenIndex]) || didUpdateMatrix;
        }
        offscreenUpdateCursor = (offscreenUpdateCursor + batchSize) % offscreen.length;
        lastOffscreenUpdateMs = nowMs;
    } else if (offscreen.length === 0) {
        offscreenUpdateCursor = 0;
    }

    if (didUpdateMatrix) {
        satInstancedMesh.instanceMatrix.needsUpdate = true;
    }
}
function updateSatelliteTrail(sat, currentVirtualTimeMs) {
    const trailPositions = sat.trailPositions;
    
    for (let j = 0; j < TRAIL_POINTS; j++) {
        const positionOffset = j * 3;
        
        // Calculate the "past" based on our current virtual clock
        // This ensures the trail follows the satellite even during time-warp
        const timeOffsetMs = (TRAIL_POINTS - 1 - j) * TRAIL_STEP_MS;
        const historicalTime = new Date(currentVirtualTimeMs - timeOffsetMs);
        
        const pastPosVel = satellite.propagate(sat.satrec, historicalTime);

        if (pastPosVel && pastPosVel.position && !Number.isNaN(pastPosVel.position.x)) {
            const pastGmst = satellite.gstime(historicalTime);
            const pastGd = satellite.eciToGeodetic(pastPosVel.position, pastGmst);
            const pastR = 1 + (pastGd.height / EARTH_RADIUS_KM);

            trailPositions[positionOffset] = pastR * Math.cos(pastGd.latitude) * Math.cos(pastGd.longitude);
            trailPositions[positionOffset + 1] = pastR * Math.sin(pastGd.latitude);
            trailPositions[positionOffset + 2] = pastR * Math.cos(pastGd.latitude) * Math.sin(-pastGd.longitude);
        }
    }
    
    sat.trailGeometry.setPositions(trailPositions);
}
async function getSatelliteDetailsText(sat) {
  const distanceKm = Math.max(0, sat.altitudeKm || 0);
  const speedKms = Math.max(0, sat.speedKms || 0);
  const speedKmh = speedKms * 3600;
  const speedDisplay = `${speedKms.toFixed(2)} km/s (${Math.round(speedKmh).toLocaleString('en-US')} km/h)`;
  const angleDeg = ((sat.angleDeg || 0) + 360) % 360;
  
  const satData = satelliteDataMap[sat.id];
  if (!satData) {
    return `Distance: ${Math.round(distanceKm)}km\nSpeed: ${speedDisplay}\nAngle: ${Math.round(angleDeg)}°`;
  }

  // Calculate orbital period from mean motion (revolutions per day)
  const periodMinutes = satData.MEAN_MOTION ? (1440 / satData.MEAN_MOTION) : 0;
  const periodHours = Math.floor(periodMinutes / 60);
  const periodMinsRemainder = Math.round(periodMinutes % 60);
  const periodDisplay = periodHours > 0 ? `${periodHours}h ${periodMinsRemainder}m` : `${periodMinsRemainder}m`;

  // Format epoch date (TLE epoch)
  let epochDisplay = 'N/A';
  if (satData.EPOCH) {
    try {
      const epochObj = new Date(satData.EPOCH);
      const today = new Date();
      const isToday = epochObj.toDateString() === today.toDateString();
      
      if (isToday) {
        // Show time if today
        epochDisplay = epochObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      } else {
        // Show date if not today
        epochDisplay = epochObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
    } catch (e) {
      epochDisplay = 'N/A';
    }
  }

  const inclination = satData.INCLINATION ? satData.INCLINATION.toFixed(2) : 'N/A';
  const objectId = satData.OBJECT_ID || '';

  // Launch date is not always provided in the current feed; use exact date when available,
  // otherwise fall back to launch year from COSPAR/International Designator (OBJECT_ID).
  let launchDateDisplay = 'N/A';
  if (satData.LAUNCH_DATE) {
    try {
      const launchDate = new Date(satData.LAUNCH_DATE);
      if (!isNaN(launchDate.getTime())) {
        launchDateDisplay = launchDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
    } catch (e) {
      launchDateDisplay = 'N/A';
    }
  }
  if (launchDateDisplay === 'N/A') {
    const cosparYearMatch = String(objectId).match(/^(\d{4})-\d{3}[A-Z0-9]*$/i);
    if (cosparYearMatch) {
      launchDateDisplay = `${cosparYearMatch[1]} (year)`;
    }
  }
  
  // Format eccentricity with proper exponent notation
  let eccentricity = 'N/A';
  if (satData.ECCENTRICITY) {
    const expStr = satData.ECCENTRICITY.toExponential(4);
    // Convert "1.2345e-3" to "1.2345 × 10⁻³" using Unicode superscripts
    eccentricity = expStr.replace(/e([+-]?\d+)/, (match, exp) => {
      const num = parseInt(exp);
      const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹';
      const sign = num < 0 ? '⁻' : '';
      const absNum = Math.abs(num).toString();
      const supNum = absNum.split('').map(d => superscripts[parseInt(d)]).join('');
      return ` × 10${sign}${supNum}`;
    });
  }
  
  const noradId = satData.NORAD_CAT_ID || 'N/A';
  const satName = satData.OBJECT_NAME || '';

  // Get description: always check by name first (hardcoded groups), then unique descriptions
  let description = getDescriptionForSatellite(satName, String(noradId)) || satData.DESCRIPTION || '';
  let details = '';
  if (description) {
    details += `${description}\n\n`;
  }
  details += `Distance: ${Math.round(distanceKm)}km
Speed: ${speedDisplay}
Angle: ${Math.round(angleDeg)}°

Period: ${periodDisplay}
Inclination: ${inclination}°
Eccentricity: ${eccentricity}
NORAD ID: ${noradId}
Launch Date: ${launchDateDisplay}
Last Updated: ${epochDisplay}`;

  return details;
}

const impactFxLayer = new THREE.Group();
planetVisuals.globe.add(impactFxLayer);

const activeLaserEffects = [];
const activeImpactEffects = [];
const impactAlignmentAxis = new THREE.Vector3(0, 0, 1);
const EARTH_HITS_TO_EXPLODE = 10;
const EARTH_DEBRIS_COUNT = 260;
const EARTH_DEBRIS_MIN_SPEED = 0.3;
const EARTH_DEBRIS_MAX_SPEED = 0.95;
const EARTH_DEBRIS_MIN_LIFETIME_MS = 5200;
const EARTH_DEBRIS_MAX_LIFETIME_MS = 9200;
const EARTH_SHOCKWAVE_COUNT = 4;
const EARTH_SHOCKWAVE_DURATION_MS = 1700;
const EARTH_FLASH_DURATION_MS = 720;
const EARTH_RESET_DELAY_MS = 5500;
const LASER_CHARGE_DURATION_MS = 120;
const LASER_BEAM_DURATION_MS = 320;
const LASER_CORE_RADIUS = 0.0038;
const LASER_GLOW_RADIUS = 0.0095;
const LASER_MUZZLE_RADIUS = 0.018;
const earthDebrisLayer = new THREE.Group();
scene.add(earthDebrisLayer);
const explosionFxLayer = new THREE.Group();
scene.add(explosionFxLayer);
const activeEarthDebris = [];
const activeExplosionShockwaves = [];
const activeExplosionFlashes = [];

function createEarthDebrisPiece() {
  const size = THREE.MathUtils.randFloat(0.02, 0.07);
  const geometry = new THREE.IcosahedronGeometry(size, 0);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(
      THREE.MathUtils.randFloat(0.06, 0.1),
      THREE.MathUtils.randFloat(0.28, 0.45),
      THREE.MathUtils.randFloat(0.2, 0.5)
    ),
    roughness: 0.96,
    metalness: 0.02,
    transparent: true,
    opacity: 1,
  });
  return new THREE.Mesh(geometry, material);
}

function spawnExplosionShockwave(delayMs) {
  const shockwaveGeometry = new THREE.TorusGeometry(1.06, 0.03, 10, 80);
  const shockwaveMaterial = new THREE.MeshBasicMaterial({
    color: 0xffaa66,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
  shockwave.rotation.set(
    THREE.MathUtils.randFloat(0, Math.PI),
    THREE.MathUtils.randFloat(0, Math.PI),
    THREE.MathUtils.randFloat(0, Math.PI)
  );
  explosionFxLayer.add(shockwave);
  activeExplosionShockwaves.push({
    mesh: shockwave,
    geometry: shockwaveGeometry,
    material: shockwaveMaterial,
    startMs: performance.now() + delayMs,
    durationMs: EARTH_SHOCKWAVE_DURATION_MS,
  });
}

function spawnExplosionFlash() {
  const flashGeometry = new THREE.SphereGeometry(1.15, 24, 24);
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff0d0,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const flash = new THREE.Mesh(flashGeometry, flashMaterial);
  explosionFxLayer.add(flash);
  activeExplosionFlashes.push({
    mesh: flash,
    geometry: flashGeometry,
    material: flashMaterial,
    startMs: performance.now(),
    durationMs: EARTH_FLASH_DURATION_MS,
  });
}

function clearExplosionVisuals() {
  for (let i = 0; i < activeEarthDebris.length; i += 1) {
    const debris = activeEarthDebris[i];
    earthDebrisLayer.remove(debris.mesh);
    if (debris.mesh.geometry) debris.mesh.geometry.dispose();
    if (debris.mesh.material) debris.mesh.material.dispose();
  }
  activeEarthDebris.length = 0;

  for (let i = 0; i < activeExplosionShockwaves.length; i += 1) {
    const shockwave = activeExplosionShockwaves[i];
    explosionFxLayer.remove(shockwave.mesh);
    shockwave.geometry.dispose();
    shockwave.material.dispose();
  }
  activeExplosionShockwaves.length = 0;

  for (let i = 0; i < activeExplosionFlashes.length; i += 1) {
    const flash = activeExplosionFlashes[i];
    explosionFxLayer.remove(flash.mesh);
    flash.geometry.dispose();
    flash.material.dispose();
  }
  activeExplosionFlashes.length = 0;
}

function resetEarthAfterExplosion() {
  clearExplosionVisuals();
  earthExplosionTriggered = false;
  earthLaserHitCount = 0;
  lastDestructiveEffectsUpdateMs = performance.now();
  earthResetTimeoutId = null;
  if (typeof planetVisuals.resetImpactDamage === 'function') {
    planetVisuals.resetImpactDamage();
  }

  planetVisuals.globe.visible = true;
  if (planetVisuals.cloudLayer) {
    planetVisuals.cloudLayer.visible = true;
  }
  if (planetVisuals.atmosphereLayer) {
    planetVisuals.atmosphereLayer.visible = true;
  }
  if (stormSystem && stormSystem.group) {
    stormSystem.group.visible = true;
  }

  clearOrbit();
  clearSelectedSatelliteState();
  resetCameraToDefaultViewImmediate();
  loadSatellites(currentGroup);
}

function triggerEarthExplosion() {
  if (earthExplosionTriggered) {
    return;
  }

  earthExplosionTriggered = true;
  if (satelliteLoadController) {
    satelliteLoadController.abort();
  }
  if (earthResetTimeoutId) {
    clearTimeout(earthResetTimeoutId);
  }
  clearOrbit();
  clearSelectedSatelliteState();
  planetVisuals.globe.visible = false;
  if (planetVisuals.cloudLayer) {
    planetVisuals.cloudLayer.visible = false;
  }
  if (planetVisuals.atmosphereLayer) {
    planetVisuals.atmosphereLayer.visible = false;
  }
  if (stormSystem && stormSystem.group) {
    stormSystem.group.visible = false;
  }
  if (satInstancedMesh) {
    satInstancedMesh.visible = false;
  }
  for (let i = 0; i < activeSatellites.length; i += 1) {
    if (activeSatellites[i].trailLine) {
      activeSatellites[i].trailLine.visible = false;
    }
  }
  spawnExplosionFlash();
  for (let i = 0; i < EARTH_SHOCKWAVE_COUNT; i += 1) {
    spawnExplosionShockwave(i * 130);
  }

  for (let i = 0; i < EARTH_DEBRIS_COUNT; i += 1) {
    const piece = createEarthDebrisPiece();
    const direction = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(2),
      THREE.MathUtils.randFloatSpread(2),
      THREE.MathUtils.randFloatSpread(2)
    ).normalize();
    const tangentJitter = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(0.08),
      THREE.MathUtils.randFloatSpread(0.08),
      THREE.MathUtils.randFloatSpread(0.08)
    );
    const velocity = direction
      .clone()
      .multiplyScalar(THREE.MathUtils.randFloat(EARTH_DEBRIS_MIN_SPEED, EARTH_DEBRIS_MAX_SPEED))
      .add(tangentJitter);

    piece.position.copy(direction).multiplyScalar(1.01);
    piece.rotation.set(
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      THREE.MathUtils.randFloat(0, Math.PI * 2)
    );

    earthDebrisLayer.add(piece);
    activeEarthDebris.push({
      mesh: piece,
      velocity,
      rotVelocity: new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(3.5),
        THREE.MathUtils.randFloatSpread(3.5),
        THREE.MathUtils.randFloatSpread(3.5)
      ),
      startMs: performance.now(),
      durationMs: THREE.MathUtils.randFloat(EARTH_DEBRIS_MIN_LIFETIME_MS, EARTH_DEBRIS_MAX_LIFETIME_MS),
    });
  }

  earthResetTimeoutId = setTimeout(() => {
    resetEarthAfterExplosion();
  }, EARTH_RESET_DELAY_MS);
}

function spawnLaserBeam(startWorldPoint, endWorldPoint, onImpact) {
  const direction = endWorldPoint.clone().sub(startWorldPoint);
  const totalLength = direction.length();
  if (totalLength <= 0.00001) {
    return;
  }

  direction.normalize();

  const beamCoreGeometry = new THREE.CylinderGeometry(LASER_CORE_RADIUS, LASER_CORE_RADIUS, totalLength, 8, 1, true);
  const beamCoreMaterial = new THREE.MeshBasicMaterial({
    color: 0xff8a91,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const beamGlowGeometry = new THREE.CylinderGeometry(LASER_GLOW_RADIUS, LASER_GLOW_RADIUS, totalLength, 12, 1, true);
  const beamGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4f63,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const beamCore = new THREE.Mesh(beamCoreGeometry, beamCoreMaterial);
  const beamGlow = new THREE.Mesh(beamGlowGeometry, beamGlowMaterial);
  beamCore.renderOrder = 7;
  beamGlow.renderOrder = 6;

  const beamHeadGeometry = new THREE.SphereGeometry(0.014, 14, 12);
  const beamHeadMaterial = new THREE.MeshBasicMaterial({
    color: 0xffc7cd,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const beamHead = new THREE.Mesh(beamHeadGeometry, beamHeadMaterial);
  beamHead.renderOrder = 8;

  const muzzleGeometry = new THREE.SphereGeometry(LASER_MUZZLE_RADIUS, 14, 12);
  const muzzleMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb4be,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const muzzle = new THREE.Mesh(muzzleGeometry, muzzleMaterial);
  muzzle.position.copy(startWorldPoint);
  muzzle.renderOrder = 9;

  const muzzleRingGeometry = new THREE.TorusGeometry(LASER_MUZZLE_RADIUS * 0.95, 0.0022, 8, 40);
  const muzzleRingMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7b8c,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const muzzleRing = new THREE.Mesh(muzzleRingGeometry, muzzleRingMaterial);
  muzzleRing.position.copy(startWorldPoint);
  muzzleRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  muzzleRing.renderOrder = 8;

  scene.add(beamGlow);
  scene.add(beamCore);
  scene.add(beamHead);
  scene.add(muzzle);
  scene.add(muzzleRing);

  activeLaserEffects.push({
    beamCore,
    beamCoreGeometry,
    beamCoreMaterial,
    beamGlow,
    beamGlowGeometry,
    beamGlowMaterial,
    beamHead,
    beamHeadGeometry,
    beamHeadMaterial,
    muzzle,
    muzzleGeometry,
    muzzleMaterial,
    muzzleRing,
    muzzleRingGeometry,
    muzzleRingMaterial,
    startPoint: startWorldPoint.clone(),
    direction,
    totalLength,
    startMs: performance.now(),
    chargeDurationMs: LASER_CHARGE_DURATION_MS,
    durationMs: LASER_BEAM_DURATION_MS,
    impactTriggered: false,
    onImpact: typeof onImpact === 'function' ? onImpact : null,
  });
}

function spawnImpactPulse(surfaceNormal, options = {}) {
  const innerRadius = options.innerRadius ?? 0.006;
  const outerRadius = options.outerRadius ?? 0.016;
  const color = options.color ?? 0x8f7e68;
  const durationMs = options.durationMs ?? 340;
  const startOpacity = options.startOpacity ?? 0.58;
  const scaleMultiplier = options.scaleMultiplier ?? 4;

  const pulseGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 36);
  const pulseMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: startOpacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
  pulse.position.copy(surfaceNormal).multiplyScalar(1.004);
  pulse.quaternion.setFromUnitVectors(impactAlignmentAxis, surfaceNormal);
  pulse.renderOrder = 4;
  impactFxLayer.add(pulse);

  activeImpactEffects.push({
    pulse,
    pulseGeometry,
    pulseMaterial,
    startMs: performance.now(),
    durationMs,
    startOpacity,
    scaleMultiplier,
  });
}

function updateDestructiveEffects() {
  const nowMs = performance.now();
  const deltaSec = Math.min((nowMs - lastDestructiveEffectsUpdateMs) / 1000, 0.05);
  lastDestructiveEffectsUpdateMs = nowMs;

  for (let i = activeLaserEffects.length - 1; i >= 0; i -= 1) {
    const effect = activeLaserEffects[i];
    const elapsedMs = nowMs - effect.startMs;
    const chargeProgress = THREE.MathUtils.clamp(elapsedMs / effect.chargeDurationMs, 0, 1);
    const beamProgress = THREE.MathUtils.clamp((elapsedMs - effect.chargeDurationMs) / effect.durationMs, 0, 1);

    effect.muzzle.position.copy(effect.startPoint);
    effect.muzzle.scale.setScalar(1 + (0.75 * chargeProgress));
    effect.muzzleMaterial.opacity = 0.85 * (1 - chargeProgress * 0.45);
    effect.muzzleRing.position.copy(effect.startPoint);
    effect.muzzleRing.scale.setScalar(1 + (1.8 * chargeProgress));
    effect.muzzleRingMaterial.opacity = 0.78 * (1 - chargeProgress);

    const isBeamActive = elapsedMs >= effect.chargeDurationMs;
    effect.beamCore.visible = isBeamActive;
    effect.beamGlow.visible = isBeamActive;
    effect.beamHead.visible = isBeamActive;

    if (beamProgress >= 1 && !effect.impactTriggered) {
      effect.impactTriggered = true;
      if (effect.onImpact) {
        effect.onImpact();
      }
    }

    if (elapsedMs >= effect.chargeDurationMs + effect.durationMs) {
      scene.remove(effect.beamCore);
      scene.remove(effect.beamGlow);
      scene.remove(effect.beamHead);
      scene.remove(effect.muzzle);
      scene.remove(effect.muzzleRing);
      effect.beamCoreGeometry.dispose();
      effect.beamCoreMaterial.dispose();
      effect.beamGlowGeometry.dispose();
      effect.beamGlowMaterial.dispose();
      effect.beamHeadGeometry.dispose();
      effect.beamHeadMaterial.dispose();
      effect.muzzleGeometry.dispose();
      effect.muzzleMaterial.dispose();
      effect.muzzleRingGeometry.dispose();
      effect.muzzleRingMaterial.dispose();
      activeLaserEffects.splice(i, 1);
      continue;
    }

    const traveledLength = effect.totalLength * beamProgress;
    const halfVisibleLength = Math.max(0.0001, traveledLength * 0.5);
    const centerPoint = effect.startPoint
      .clone()
      .addScaledVector(effect.direction, halfVisibleLength);
    const orientation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      effect.direction
    );

    effect.beamCore.position.copy(centerPoint);
    effect.beamGlow.position.copy(centerPoint);
    effect.beamCore.quaternion.copy(orientation);
    effect.beamGlow.quaternion.copy(orientation);
    effect.beamCore.scale.set(1, Math.max(0.0001, beamProgress), 1);
    effect.beamGlow.scale.set(1, Math.max(0.0001, beamProgress), 1);

    effect.beamHead.position.copy(effect.startPoint).addScaledVector(effect.direction, traveledLength);
    const fade = 1 - beamProgress;
    effect.beamCoreMaterial.opacity = 0.95 * fade;
    effect.beamGlowMaterial.opacity = 0.5 * fade;
    effect.beamHeadMaterial.opacity = 0.95 * fade;
    const headScale = 1 + (0.45 * fade);
    effect.beamHead.scale.setScalar(headScale);
  }

  for (let i = activeImpactEffects.length - 1; i >= 0; i -= 1) {
    const effect = activeImpactEffects[i];
    const progress = (nowMs - effect.startMs) / effect.durationMs;

    if (progress >= 1) {
      impactFxLayer.remove(effect.pulse);
      effect.pulseGeometry.dispose();
      effect.pulseMaterial.dispose();
      activeImpactEffects.splice(i, 1);
      continue;
    }

    effect.pulse.scale.setScalar(1 + progress * effect.scaleMultiplier);
    effect.pulseMaterial.opacity = effect.startOpacity * (1 - progress);
  }

  for (let i = 0; i < activeEarthDebris.length; i += 1) {
    const debris = activeEarthDebris[i];
    const progress = (nowMs - debris.startMs) / debris.durationMs;

    if (progress >= 1) {
      earthDebrisLayer.remove(debris.mesh);
      if (debris.mesh.geometry) debris.mesh.geometry.dispose();
      if (debris.mesh.material) debris.mesh.material.dispose();
      activeEarthDebris.splice(i, 1);
      i -= 1;
      continue;
    }

    debris.mesh.position.addScaledVector(debris.velocity, deltaSec);
    debris.mesh.rotation.x += debris.rotVelocity.x * deltaSec;
    debris.mesh.rotation.y += debris.rotVelocity.y * deltaSec;
    debris.mesh.rotation.z += debris.rotVelocity.z * deltaSec;
    debris.velocity.multiplyScalar(0.999);
    if (debris.mesh.material) {
      debris.mesh.material.opacity = 1 - progress;
    }
  }

  for (let i = activeExplosionShockwaves.length - 1; i >= 0; i -= 1) {
    const shockwave = activeExplosionShockwaves[i];
    const elapsedMs = nowMs - shockwave.startMs;
    if (elapsedMs < 0) {
      shockwave.mesh.visible = false;
      continue;
    }
    shockwave.mesh.visible = true;
    const progress = elapsedMs / shockwave.durationMs;
    if (progress >= 1) {
      explosionFxLayer.remove(shockwave.mesh);
      shockwave.geometry.dispose();
      shockwave.material.dispose();
      activeExplosionShockwaves.splice(i, 1);
      continue;
    }
    const eased = 1 - Math.pow(1 - progress, 2);
    const scale = 1 + (eased * 4.8);
    shockwave.mesh.scale.setScalar(scale);
    shockwave.material.opacity = 0.9 * (1 - progress);
  }

  for (let i = activeExplosionFlashes.length - 1; i >= 0; i -= 1) {
    const flash = activeExplosionFlashes[i];
    const progress = (nowMs - flash.startMs) / flash.durationMs;
    if (progress >= 1) {
      explosionFxLayer.remove(flash.mesh);
      flash.geometry.dispose();
      flash.material.dispose();
      activeExplosionFlashes.splice(i, 1);
      continue;
    }
    const size = 1 + (progress * 3.2);
    flash.mesh.scale.setScalar(size);
    flash.material.opacity = 0.95 * (1 - progress);
  }
}

function fireSatelliteLaserAt(targetWorldPoint) {
    if (earthExplosionTriggered) {
        return;
    }

    if (!selectedSatellite || !satInstancedMesh) {
      return;
    }

    const impactLocalPoint = planetVisuals.globe.worldToLocal(targetWorldPoint.clone());
    const surfaceNormal = impactLocalPoint.normalize();
    const impactWorldPoint = planetVisuals.globe.localToWorld(surfaceNormal.clone().multiplyScalar(1.006));

    const tempMatrix = new THREE.Matrix4();
    const satelliteWorldPos = new THREE.Vector3();
    satInstancedMesh.getMatrixAt(selectedSatellite.index, tempMatrix);
    satelliteWorldPos.setFromMatrixPosition(tempMatrix);

    spawnLaserBeam(satelliteWorldPos, impactWorldPoint, () => {
      if (earthExplosionTriggered) {
        return;
      }
      planetVisuals.applyImpactDamage(surfaceNormal);
      spawnImpactPulse(surfaceNormal, {
        innerRadius: 0.008,
        outerRadius: 0.03,
        color: 0xffb68a,
        durationMs: 520,
        startOpacity: 0.78,
        scaleMultiplier: 6.2,
      });
      spawnImpactPulse(surfaceNormal, {
        innerRadius: 0.004,
        outerRadius: 0.015,
        color: 0xffe2ba,
        durationMs: 300,
        startOpacity: 0.7,
        scaleMultiplier: 3.8,
      });
      earthLaserHitCount += 1;

      if (earthLaserHitCount >= EARTH_HITS_TO_EXPLODE) {
        triggerEarthExplosion();
      }
    });
}

function fireSelectedSatelliteLaser() {
    if (!selectedSatellite || isAnimatingCameraRef.current) {
        return;
    }

    // Use the same logic to find the satellite's current direction relative to Earth
    const tempMatrix = new THREE.Matrix4();
    const satPos = new THREE.Vector3();
    satInstancedMesh.getMatrixAt(selectedSatellite.index, tempMatrix);
    satPos.setFromMatrixPosition(tempMatrix);

    // Fire directly "down" from the satellite's current position toward the center of the Earth
    const targetWorldPoint = satPos.clone().normalize();
    fireSatelliteLaserAt(targetWorldPoint);
}

if (fireLaserButton) {
  fireLaserButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    fireSelectedSatelliteLaser();
  });
}

function startCalloutTyping(title, details) {
  calloutTyping.titleTarget = title;
  calloutTyping.detailsTarget = details;
  calloutTyping.titleIndex = 0;
  calloutTyping.detailsIndex = 0;
  calloutTyping.lastStepMs = performance.now();
  infoTitle.textContent = '';
  satelliteDetails.textContent = '';

  if (calloutTextSpeedMode === 'disabled') {
    applyCalloutTextSpeed('disabled');
    return;
  }

  calloutTyping.stepIntervalMs = textSpeedIntervals[calloutTextSpeedMode] || textSpeedIntervals.normal;
  calloutTyping.active = true;
}

function startCalloutReveal() {
  calloutReveal.active = true;
  calloutReveal.startMs = performance.now();
  calloutReveal.progress = 0;
}

function updateCalloutReveal() {
  if (!calloutReveal.active) {
    return calloutReveal.progress;
  }

  const elapsed = performance.now() - calloutReveal.startMs;
  const linear = THREE.MathUtils.clamp(elapsed / calloutReveal.durationMs, 0, 1);
  const eased = 1 - Math.pow(1 - linear, 3);
  calloutReveal.progress = eased;

  if (linear >= 1) {
    calloutReveal.active = false;
    calloutReveal.progress = 1;
  }

  return calloutReveal.progress;
}

function updateCalloutTyping() {
  if (!calloutTyping.active) {
    return;
  }

  const nowMs = performance.now();
  while (nowMs - calloutTyping.lastStepMs >= calloutTyping.stepIntervalMs) {
    calloutTyping.lastStepMs += calloutTyping.stepIntervalMs;

    if (calloutTyping.titleIndex < calloutTyping.titleTarget.length) {
      calloutTyping.titleIndex += 1;
      infoTitle.textContent = calloutTyping.titleTarget.slice(0, calloutTyping.titleIndex);
      continue;
    }

    if (calloutTyping.detailsIndex < calloutTyping.detailsTarget.length) {
      calloutTyping.detailsIndex += 1;
      satelliteDetails.textContent = calloutTyping.detailsTarget.slice(0, calloutTyping.detailsIndex);
      continue;
    }

    calloutTyping.active = false;
    break;
  }
}

function updateSatelliteCallout() {
  if (!selectedSatellite && !selectedStorm) {
    infoBox.classList.remove('visible');
    if (fireLaserButton) {
      fireLaserButton.disabled = true;
    }
    calloutLayout.initialized = false;
    return;
  }
  if (showOrbitButton) {
    showOrbitButton.disabled = false;
    // Update button text/active state based on whether this specific sat is orbiting
    if (selectedSatellite && orbitingSatId === selectedSatellite.id) {
        showOrbitButton.textContent = 'Hide Orbit';
        showOrbitButton.classList.add('active');
    } else {
        showOrbitButton.textContent = 'Show Orbit';
        showOrbitButton.classList.remove('active');
    }
  }
  if (isAnimatingCameraRef.current) {
    infoBox.classList.remove('visible');
    if (fireLaserButton) {
      fireLaserButton.disabled = true;
    }
    return;
  }

  let currentPos;
  
  if (selectedSatellite && satInstancedMesh) {
    const tempMatrix = new THREE.Matrix4();
    satInstancedMesh.getMatrixAt(selectedSatellite.index, tempMatrix);
    currentPos = new THREE.Vector3().setFromMatrixPosition(tempMatrix);
  } else if (selectedStorm) {
    currentPos = selectedStorm.position.clone();
  } else {
    return; 
  }

  // Project that 3D position to the 2D screen
    projectedSatelliteScreen.copy(currentPos).project(camera);

  if (projectedSatelliteScreen.z < -1 || projectedSatelliteScreen.z > 1) {
    infoBox.classList.remove('visible');
    if (fireLaserButton) {
      fireLaserButton.disabled = true;
    }
    return;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const canvasRect = renderer.domElement.getBoundingClientRect();
  const satX = canvasRect.left + (projectedSatelliteScreen.x * 0.5 + 0.5) * canvasRect.width;
  const satY = canvasRect.top + (-projectedSatelliteScreen.y * 0.5 + 0.5) * canvasRect.height;

  updateCalloutTyping();

  const fullTitleText = calloutTyping.titleTarget || infoTitle.textContent || '';
  const measuredTitleWidth = Math.max(120, measureCalloutTitleWidth(fullTitleText));
  const targetCalloutWidth = THREE.MathUtils.clamp(measuredTitleWidth + 36, 280, 420);

  const targetP0x = THREE.MathUtils.clamp(satX - targetCalloutWidth - 120, 24, viewportWidth - targetCalloutWidth - 24);
  const targetP0y = THREE.MathUtils.clamp(satY - 100, 28, viewportHeight - 170);

  if (!calloutLayout.initialized) {
    calloutLayout.initialized = true;
    calloutLayout.p0x = targetP0x;
    calloutLayout.p0y = targetP0y;
    calloutLayout.width = targetCalloutWidth;
  } else {
    const follow = isAnimatingCameraRef.current ? 0.2 : 0.35;
    calloutLayout.p0x = THREE.MathUtils.lerp(calloutLayout.p0x, targetP0x, follow);
    calloutLayout.p0y = THREE.MathUtils.lerp(calloutLayout.p0y, targetP0y, follow);
    calloutLayout.width = THREE.MathUtils.lerp(calloutLayout.width, targetCalloutWidth, 0.28);
  }

  const p0x = calloutLayout.p0x;
  const p0y = calloutLayout.p0y;
  const calloutWidth = calloutLayout.width;
  const p1x = p0x + calloutWidth;
  const p1y = p0y;

  const titleX = p0x + 16;
  const titleY = p0y - 38;
  const cardX = p0x;
  const cardY = p0y + 12;

  infoCard.style.width = `${calloutWidth}px`;

  infoTitle.style.transform = `translate(${titleX}px, ${titleY}px)`;
  infoCard.style.transform = `translate(${cardX}px, ${cardY}px)`;

  const p3x = satX;
  const p3y = satY;

  const revealProgress = updateCalloutReveal();
  const seg1Length = Math.hypot(p1x - p0x, p1y - p0y);
  const seg2Length = Math.hypot(p3x - p1x, p3y - p1y);
  const totalLength = Math.max(0.0001, seg1Length + seg2Length);
  const revealDistance = totalLength * revealProgress;

  let connectorPoints = `${p0x},${p0y} ${p0x},${p0y} ${p0x},${p0y}`;

  if (revealDistance <= seg1Length) {
    const t = seg1Length > 0 ? revealDistance / seg1Length : 1;
    const ex = THREE.MathUtils.lerp(p0x, p1x, t);
    const ey = THREE.MathUtils.lerp(p0y, p1y, t);
    connectorPoints = `${p0x},${p0y} ${ex},${ey} ${ex},${ey}`;
  } else {
    const secondDistance = revealDistance - seg1Length;
    const t = seg2Length > 0 ? THREE.MathUtils.clamp(secondDistance / seg2Length, 0, 1) : 1;
    const ex = THREE.MathUtils.lerp(p1x, p3x, t);
    const ey = THREE.MathUtils.lerp(p1y, p3y, t);
    connectorPoints = `${p0x},${p0y} ${p1x},${p1y} ${ex},${ey}`;
  }

  infoConnectorPath.setAttribute('points', connectorPoints);
  infoConnectorStart.setAttribute('cx', String(p0x));
  infoConnectorStart.setAttribute('cy', String(p0y));

  if (fireLaserButton) {
    fireLaserButton.disabled = false;
  }
  infoBox.classList.add('visible');
}

function updateMobileSelectedSatelliteFollow() {
  if (!isCoarsePointerDevice || !selectedSatellite || !satInstancedMesh) {
    return;
  }

  if (isAnimatingCameraRef.current) {
    return;
  }

  // Keep orbit preview behavior unchanged when zoomed out to show full orbit.
  if (orbitingSatId === selectedSatellite.id) {
    return;
  }

  // Selected satellite mode keeps controls disabled; follow while in this mode.
  if (controls.enabled) {
    return;
  }

  satInstancedMesh.getMatrixAt(selectedSatellite.index, mobileFollowMatrix);
  mobileFollowSatPosition.setFromMatrixPosition(mobileFollowMatrix);
  const satRadius = mobileFollowSatPosition.length();
  if (satRadius <= 0.0001) {
    return;
  }

  mobileFollowDesiredCameraPosition
    .copy(mobileFollowSatPosition)
    .normalize()
    .multiplyScalar(satRadius + 0.45);

  camera.position.lerp(mobileFollowDesiredCameraPosition, 0.18);
  camera.lookAt(0, 0, 0);
}

function onCanvasClick(event) {
  if (isAnimatingCameraRef.current) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // 1. Check for Storm clicks first
  if (stormSystem && stormSystem.group) {
      const stormIntersects = raycaster.intersectObjects(stormSystem.group.children);
      if (stormIntersects.length > 0) {
          const clickedMesh = stormIntersects[0].object;
          if (clickedMesh.userData && clickedMesh.userData.isStorm) {
              selectStorm(clickedMesh.userData);
              return;
          }
      }
  }

  // 2. Check for Satellite clicks
  if (satInstancedMesh) {
      const intersects = raycaster.intersectObject(satInstancedMesh);
      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;
        const clickedSat = activeSatellites[instanceId];
        if (clickedSat && clickedSat !== selectedSatellite) {
          selectSatellite(clickedSat);
        }
        return;
      }
  }

  if (selectedSatellite || selectedStorm) {
      deselectSatellite();
  }
}
// Called when the user clicks a satellite
function selectSatellite(sat) {
    if (isAnimatingCameraRef.current) {
        return;
    }
  if (sidebarManager && window.matchMedia('(max-width: 640px)').matches) {
    sidebarManager.setCollapsed(true);
  }
  selectedSatellite = sat;
  selectedStorm = null;
  isAnimatingCameraRef.current = true;
  controls.enabled = false;
  calloutLayout.initialized = false;
  calloutReveal.active = false;
  calloutReveal.progress = 0;
  infoBox.classList.remove('visible');

  // Animate camera to focus on satellite
    const tempMatrix = new THREE.Matrix4();
    const targetSatPosition = new THREE.Vector3();

    // Get the matrix for this specific satellite index
    satInstancedMesh.getMatrixAt(sat.index, tempMatrix);
    // Extract the position vector from that matrix
    targetSatPosition.setFromMatrixPosition(tempMatrix);

    // Zoom into the satellite
    const zoomDistance = 0.45; // How close to get to satellite
    const duration = 1000; // milliseconds
    const startTime = Date.now();

    const startPosition = camera.position.clone();
    // Position camera near the satellite, slightly offset outward from Earth center
    var targetCameraPosition = targetSatPosition.clone().normalize().multiplyScalar(targetSatPosition.length() + zoomDistance);

    const animateCamera = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Smooth easing function
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        camera.position.lerpVectors(startPosition, targetCameraPosition, easeProgress);
        camera.lookAt(0, 0, 0); // Look back towards Earth

        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        } else {
            isAnimatingCameraRef.current = false;
            startCalloutReveal();
            const satData = satelliteDataMap[sat.id];
            if (satData) {
                getSatelliteDetailsText(sat).then(detailsText => {
                    startCalloutTyping(satData.OBJECT_NAME, detailsText);
                });
            }
        }
    };

    animateCamera();
}


function selectStorm(stormData) {
    if (isAnimatingCameraRef.current) return;
    
    selectedStorm = stormData;
    selectedSatellite = null; 
    
    isAnimatingCameraRef.current = true;
    controls.enabled = false;
    calloutLayout.initialized = false;
    calloutReveal.active = false;
    calloutReveal.progress = 0;
    infoBox.classList.remove('visible');

    const targetDistance = 2;
    const duration = 1000;
    const startTime = Date.now();

    const startPosition = camera.position.clone();
    const targetCameraPosition = stormData.position.clone().normalize().multiplyScalar(targetDistance);

    const animateCamera = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        camera.position.lerpVectors(startPosition, targetCameraPosition, easeProgress);
        camera.lookAt(stormData.position); 

        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        } else {
            isAnimatingCameraRef.current = false;
            startCalloutReveal();
            
            // Format the NASA date nicely for the UI card
            const dateStr = new Date(stormData.date).toLocaleDateString();
            startCalloutTyping(stormData.title, `Type: Severe Weather\nDetected: ${dateStr}`);
        }
    };

    animateCamera();
}


function animateCameraToDefaultView() {
  isAnimatingCameraRef.current = true;
  controls.enabled = false;

  const duration = 1000;
  const startTime = Date.now();
  const startPosition = camera.position.clone();
  const startTarget = controls.target.clone();

  const animateCamera = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(startPosition, defaultCameraPosition, easeProgress);
    controls.target.lerpVectors(startTarget, defaultCameraTarget, easeProgress);
    camera.lookAt(controls.target);

    if (progress < 1) {
      requestAnimationFrame(animateCamera);
      return;
    }

    camera.position.copy(defaultCameraPosition);
    controls.target.copy(defaultCameraTarget);
    camera.lookAt(defaultCameraTarget);
    controls.update();
    isAnimatingCameraRef.current = false;
    controls.enabled = true;
  };

  animateCamera();
}

function resetCameraToDefaultViewImmediate() {
  // On touch devices, re-enabling controls on a later frame helps clear
  // any in-progress gesture state that can survive abrupt camera jumps.
  controls.enabled = false;
  isAnimatingCameraRef.current = true;
  camera.position.copy(defaultCameraPosition);
  controls.target.copy(defaultCameraTarget);
  camera.lookAt(defaultCameraTarget);
  controls.update();
  requestAnimationFrame(() => {
    controls.update();
    controls.enabled = true;
    isAnimatingCameraRef.current = false;
  });
}

function clearSelectedSatelliteState() {
  selectedSatellite = null;
  selectedStorm = null;
  calloutTyping.active = false;
  calloutLayout.initialized = false;
  calloutReveal.active = false;
  calloutReveal.progress = 0;
  infoBox.classList.remove('visible');
  if (fireLaserButton) {
    fireLaserButton.disabled = true;
  }
  if (showOrbitButton) {
    showOrbitButton.disabled = true;
  }
}

function resetCameraToStartView() {
  if (isAnimatingCameraRef.current) {
    return;
  }

  clearSelectedSatelliteState();
  animateCameraToDefaultView();
}

function deselectSatellite() {
  if (!selectedSatellite && !selectedStorm) {
    return;
  }

  if (isAnimatingCameraRef.current) {
    return;
  }

  clearSelectedSatelliteState();
  animateCameraToDefaultView();
}

// Only pick satellites/storms when clicking directly on the 3D canvas.
renderer.domElement.addEventListener('click', (event) => {
  if (performance.now() < suppressCanvasClickUntilMs) {
    return;
  }
  onCanvasClick(event);
});

// Center to user location button
if (centerLocationButton) {
  centerLocationButton.addEventListener('click', () => {
    if (hasValidLocation(location)) {
      centerToUserLocation({
        camera,
        controls,
        latitude: location.latitude,
        longitude: location.longitude,
        isAnimatingCameraRef
      });
    } else {
      console.warn('User location not available');
    }
  });
}

// --- Resize Handling ---

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  planetVisuals.onResize(window.innerWidth, window.innerHeight);
  sharedTrailMaterial.resolution.set(window.innerWidth, window.innerHeight);
});



// 2. Add helper to clear the orbit
function clearOrbit() {
  if (currentOrbitLine) {
    scene.remove(currentOrbitLine);
    if (currentOrbitLine.geometry) currentOrbitLine.geometry.dispose();
    currentOrbitLine = null;
  }
  orbitingSatId = null;
  if (showOrbitButton) {
    showOrbitButton.textContent = 'Show Orbit';
    showOrbitButton.classList.remove('active');
  }
}

// 3. Add function to generate full orbital path points
function generateOrbitPoints(satrec, periodMinutes) {
  const points = [];
  const segments = 120; // smoothness of the circle
  const startMs = virtualTimeMs; // Use the current simulation time as start
  
  for (let i = 0; i <= segments; i++) {
    const timeOffset = (i / segments) * periodMinutes * 60 * 1000;
    const time = new Date(startMs + timeOffset);
    const posAndVel = satellite.propagate(satrec, time);
    
    if (posAndVel.position) {
      const gmst = satellite.gstime(time);
      const posGd = satellite.eciToGeodetic(posAndVel.position, gmst);
      const r = 1 + (posGd.height / EARTH_RADIUS_KM);
      
      points.push(
        r * Math.cos(posGd.latitude) * Math.cos(posGd.longitude),
        r * Math.sin(posGd.latitude),
        r * Math.cos(posGd.latitude) * Math.sin(-posGd.longitude)
      );
    }
  }
  return points;
}

// 4. Update selectSatellite or camera logic to handle the "Zoom Out"
function zoomToOrbit(sat) {
  isAnimatingCameraRef.current = true;
  controls.enabled = false;
  
  const tempMatrix = new THREE.Matrix4();
  const satPos = new THREE.Vector3();
  satInstancedMesh.getMatrixAt(sat.index, tempMatrix);
  satPos.setFromMatrixPosition(tempMatrix);

  // Zoom further out to see the full orbit (roughly 3.0 units from center)
  const targetCameraPos = satPos.clone().normalize().multiplyScalar(3.2);
  const startTime = Date.now();
  const startPos = camera.position.clone();

  const animate = () => {
    const progress = Math.min((Date.now() - startTime) / 1000, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    camera.position.lerpVectors(startPos, targetCameraPos, ease);
    camera.lookAt(0, 0, 0);
    if (progress < 1) requestAnimationFrame(animate);
    else {
      isAnimatingCameraRef.current = false;
      controls.enabled = true;
    }
  };
  animate();
}

// 5. Wire up the button event listener
showOrbitButton.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!selectedSatellite) return;

  if (orbitingSatId === selectedSatellite.id) {
    clearOrbit();
  } else {
    // Clear existing orbit if another was selected
    clearOrbit();
    
    const satData = satelliteDataMap[selectedSatellite.id];
    const period = satData.MEAN_MOTION ? (1440 / satData.MEAN_MOTION) : 90;
    const points = generateOrbitPoints(selectedSatellite.satrec, period);
    
    const geometry = new LineGeometry();
    geometry.setPositions(points);
    
    const material = new LineMaterial({
      color: getSatelliteColorHex(satData),
      linewidth: 2,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      transparent: true,
      opacity: 0.6
    });

    currentOrbitLine = new Line2(geometry, material);
    scene.add(currentOrbitLine);
    orbitingSatId = selectedSatellite.id;
    
    showOrbitButton.textContent = 'Hide Orbit';
    showOrbitButton.classList.add('active');
    
    zoomToOrbit(selectedSatellite);
  }
});

// --- Animation Loop ---

renderer.setAnimationLoop(() => {
    updateSatellites();
    updateMobileSelectedSatelliteFollow();
    if (sidebarManager) {
        sidebarManager.updateSimulationClock(virtualTimeMs);
    }
    planetVisuals.update();
    updateDestructiveEffects();
    updateSatelliteCallout();
    stormSystem.update();
    controls.update();
    planetVisuals.render();
});
