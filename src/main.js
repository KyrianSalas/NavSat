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
import { select } from 'three/tsl';

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

addUserLocationMarker(scene);

// --- Raycaster for click detection ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedSatellite = null;
let selectedStorm = null;
const isAnimatingCameraRef = { current: false };

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
const SATELLITE_UPDATE_INTERVAL_MS = 120;
const OFFSCREEN_UPDATE_INTERVAL_MS = 450;
const OFFSCREEN_UPDATE_BATCH_SIZE = 450;
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
  const name = jsonData.OBJECT_NAME.toUpperCase();

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

function getSatelliteColorHex(jsonData) {
  const countryKey = getSatelliteCountryKey(jsonData);
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

function isSatelliteLikelyVisible(sat) {
  if (!sat.worldPosition) {
    return true;
  }
  visibilityProbeNdc.copy(sat.worldPosition).project(camera);
  return (
    visibilityProbeNdc.z > -1 &&
    visibilityProbeNdc.z < 1 &&
    visibilityProbeNdc.x > -1.1 &&
    visibilityProbeNdc.x < 1.1 &&
    visibilityProbeNdc.y > -1.1 &&
    visibilityProbeNdc.y < 1.1
  );
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
    return getSatelliteCountryKey(satData) === currentCountryFilter;
  });
}

function buildSatelliteMeshes() {
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
        
        // Convert JSON TLE data to a satellite record
        const satrec = satellite.json2satrec(jsonData);
        
        // Apply Geopolitical colour
        satColor.setHex(getSatelliteColorHex(jsonData));
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

            // If the API runs out of satellites before we hit our filtered limit, stop.
            if (!chunk || !Array.isArray(chunk) || chunk.length === 0) {
                console.log("Reached end of database before reaching limit.");
                break; 
            }

            chunk.forEach(sat => {
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

    // 2. RATE LIMITING
    // We still limit the heavy math to ~120ms intervals for performance
    if ((nowMs - lastSatelliteUpdateMs) < SATELLITE_UPDATE_INTERVAL_MS) {
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
        if (isSatelliteLikelyVisible(sat)) {
            highPriority.push(sat);
        } else {
            offscreen.push(sat);
        }
    }

    let didUpdateMatrix = false;
    for (let i = 0; i < highPriority.length; i++) {
        didUpdateMatrix = updateSatelliteState(highPriority[i]) || didUpdateMatrix;
    }

    if (offscreen.length > 0 && (nowMs - lastOffscreenUpdateMs) >= OFFSCREEN_UPDATE_INTERVAL_MS) {
        const batchSize = Math.min(offscreen.length, OFFSCREEN_UPDATE_BATCH_SIZE);
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

  const details = `Distance: ${Math.round(distanceKm)}km
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

function spawnLaserBeam(startWorldPoint, endWorldPoint) {
  const beamGeometry = new THREE.BufferGeometry().setFromPoints([startWorldPoint, endWorldPoint]);
  const beamMaterial = new THREE.LineBasicMaterial({
    color: 0xff5f66,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const beam = new THREE.Line(beamGeometry, beamMaterial);
  scene.add(beam);

  activeLaserEffects.push({
    beam,
    beamGeometry,
    beamMaterial,
    startMs: performance.now(),
    durationMs: 190,
  });
}

function spawnImpactPulse(surfaceNormal) {
  const pulseGeometry = new THREE.RingGeometry(0.006, 0.016, 36);
  const pulseMaterial = new THREE.MeshBasicMaterial({
    color: 0x8f7e68,
    transparent: true,
    opacity: 0.58,
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
    durationMs: 340,
  });
}

function updateDestructiveEffects() {
  const nowMs = performance.now();

  for (let i = activeLaserEffects.length - 1; i >= 0; i -= 1) {
    const effect = activeLaserEffects[i];
    const progress = (nowMs - effect.startMs) / effect.durationMs;

    if (progress >= 1) {
      scene.remove(effect.beam);
      effect.beamGeometry.dispose();
      effect.beamMaterial.dispose();
      activeLaserEffects.splice(i, 1);
      continue;
    }

    effect.beamMaterial.opacity = 0.95 * (1 - progress);
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

    effect.pulse.scale.setScalar(1 + progress * 4);
    effect.pulseMaterial.opacity = 0.58 * (1 - progress);
  }
}

function fireSatelliteLaserAt(targetWorldPoint) {
    const impactLocalPoint = planetVisuals.globe.worldToLocal(targetWorldPoint.clone());
    const surfaceNormal = impactLocalPoint.normalize();

    planetVisuals.applyImpactDamage(surfaceNormal);
    spawnImpactPulse(surfaceNormal);

    if (selectedSatellite) {
        // 1. EXTRACT POSITION FROM INSTANCED MESH
        const tempMatrix = new THREE.Matrix4();
        const satelliteWorldPos = new THREE.Vector3();
        satInstancedMesh.getMatrixAt(selectedSatellite.index, tempMatrix);
        satelliteWorldPos.setFromMatrixPosition(tempMatrix);

        // 2. USE EXTRACTED POSITION
        const impactWorldPoint = planetVisuals.globe.localToWorld(surfaceNormal.clone().multiplyScalar(1.006));
        spawnLaserBeam(satelliteWorldPos, impactWorldPoint);
    }
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

// Add click event listener
document.addEventListener('click', (event) => {
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
