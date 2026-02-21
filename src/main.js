import * as THREE from 'three';
import * as satellite from "satellite.js"
import { getUserLocation } from './services/locationService.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { setupPlanetVisuals } from './planetVisuals.js';
import { addUserLocationMarker } from './widgets/userLocationMarker.js';
import { buildSatelliteMeshes } from './widgets/buildSatelliteMeshes.js';
import { loadSatellites } from './widgets/loadSatellites.js';
import { getSatelliteColor } from './widgets/getSatelliteColor.js';
import { updateSatellites } from './widgets/updateSatellites.js';
import { updateSatelliteCallout } from './widgets/updateCallouts.js';
import { startAnimationLoop } from './widgets/startAnimationLoop.js';
import * as service from './api/satelliteService.js'


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

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 3);
const planetVisuals = setupPlanetVisuals({ scene, camera, renderer });

// --- Controls ---

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1.5;
controls.maxDistance = 10;

addUserLocationMarker(scene);

// --- Raycaster for click detection ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const selectedSatelliteRef = { current: null };
const isAnimatingCameraRef = { current: false };

// --- User location --- epic formatted comment
const location = getUserLocation();
console.log('location:', location);
const projectedSatelliteScreen = new THREE.Vector3();

const infoBox = document.getElementById('infoBox');
const infoTitle = document.getElementById('infoTitle');
const infoCard = document.getElementById('infoCard');
const satelliteDetails = document.getElementById('satelliteDetails');
const infoConnectorPath = document.getElementById('infoConnectorPath');
const infoConnectorStart = document.getElementById('infoConnectorStart');

const calloutTyping = {
  titleTarget: '',
  detailsTarget: '',
  titleIndex: 0,
  detailsIndex: 0,
  lastStepMs: 0,
  stepIntervalMs: 18,
  active: false,
};

const calloutLayout = {
  initialized: false,
  p0x: 0,
  p0y: 0,
  width: 220,
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

// The dictionary
const satelliteDataMap = {};
const activeSatellites = [];

// Creating the visual marker (the red dot)
const TRAIL_LENGTH_MINUTES = 3; // How long you want the tail to be
const TRAIL_POINTS = 5; // Smoothness of the tail

const initialPositions = [];
for (let i = 0; i < TRAIL_POINTS; i++) {
    initialPositions.push(0, 0, 0);
}

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

const sharedSatGeometry = new THREE.SphereGeometry(0.005,8,8)

loadSatellites({
    satelliteDataMap,
    scene,
    activeSatellites,
    getSatelliteColor,
    TRAIL_POINTS,
    initialPositions,
    sharedTrailMaterial,
    sharedSatGeometry
});


// --- Update Function ---
function getSatelliteDetailsText(sat) {
  const distanceKm = Math.max(0, sat.altitudeKm || 0);
  const speedRatio = Math.max(0, (sat.speedKms || 0) / 12.8);
  const angleDeg = ((sat.angleDeg || 0) + 360) % 360;
  return `Distance: ${Math.round(distanceKm)}km\nSpeed: ${speedRatio.toFixed(2)}x\nAngle: ${Math.round(angleDeg)}°`;
}

function startCalloutTyping(title, details) {
  calloutTyping.titleTarget = title;
  calloutTyping.detailsTarget = details;
  calloutTyping.titleIndex = 0;
  calloutTyping.detailsIndex = 0;
  calloutTyping.lastStepMs = performance.now();
  calloutTyping.active = true;
  infoTitle.textContent = '';
  satelliteDetails.textContent = '';
}

function startCalloutReveal() {
  calloutReveal.active = true;
  calloutReveal.startMs = performance.now();
  calloutReveal.progress = 0;
}

// --- Click handling for satellite selection ---
function onCanvasClick(event) {
  // Prevent clicks during animation
  if (isAnimatingCameraRef.current) return;
  
  // Calculate mouse position in normalized device coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Update raycaster
  raycaster.setFromCamera(mouse, camera);

  // Check if any satellite is clicked - get all satellite meshes
  const satelliteMeshes = activeSatellites.map(sat => sat.mesh);
  const intersects = raycaster.intersectObjects(satelliteMeshes, true);

  if (intersects.length > 0 && !selectedSatelliteRef.current) {
    // Find which satellite was clicked
    const clickedMesh = intersects[0].object;
    const clickedSat = activeSatellites.find(sat => sat.mesh === clickedMesh);
    if (clickedSat) {
      selectSatellite(clickedSat);
    }
  } else if (selectedSatelliteRef.current) {
    deselectSatellite();
  }
}

function selectSatellite(sat) {
  selectedSatelliteRef.current = sat;
  isAnimatingCameraRef.current = true;
  controls.enabled = false;
  calloutLayout.initialized = false;
  calloutReveal.active = false;
  calloutReveal.progress = 0;
  infoBox.classList.remove('visible');

  // Animate camera to focus on satellite
  const targetDistance = 2;
  const duration = 1000; // milliseconds
  const startTime = Date.now();

  const startPosition = camera.position.clone();
  const targetPosition = sat.mesh.position.clone().normalize().multiplyScalar(targetDistance);

  const animateCamera = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Smooth easing function
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
    camera.lookAt(sat.mesh.position);

    if (progress < 1) {
      requestAnimationFrame(animateCamera);
    } else {
      isAnimatingCameraRef.current = false;
      startCalloutReveal();
      const satData = satelliteDataMap[sat.id];
      if (satData) {
        startCalloutTyping(satData.OBJECT_NAME, getSatelliteDetailsText(sat));
      }
    }
  };

  animateCamera();
}

function deselectSatellite() {
  selectedSatelliteRef.current = null;
  isAnimatingCameraRef.current = true;
  controls.enabled = false;
  calloutTyping.active = false;
  calloutLayout.initialized = false;
  calloutReveal.active = false;
  calloutReveal.progress = 0;

  // Hide callout
  infoBox.classList.remove('visible');

  // Animate camera back to original position
  const duration = 1000; // milliseconds
  const startTime = Date.now();

  const startPosition = camera.position.clone();
  const targetPosition = new THREE.Vector3(0, 0, 3);

  const animateCamera = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Smooth easing function
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
    camera.lookAt(0, 0, 0);

    if (progress < 1) {
      requestAnimationFrame(animateCamera);
    } else {
      isAnimatingCameraRef.current = false;
      controls.enabled = true;
    }
  };

  animateCamera();
}

// Add click event listener
document.addEventListener('click', (event) => {
  onCanvasClick(event);
});

// --- Resize Handling ---

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  planetVisuals.onResize(window.innerWidth, window.innerHeight);
  sharedTrailMaterial.resolution.set(window.innerWidth, window.innerHeight);
});

// --- Animation Loop ---

startAnimationLoop({
    renderer,
    activeSatellites,
    TRAIL_POINTS,
    TRAIL_LENGTH_MINUTES,
    planetVisuals,
    selectedSatelliteRef,
    isAnimatingCameraRef,
    infoBox,
    calloutLayout,
    projectedSatelliteScreen,
    camera,
    calloutTyping,
    infoTitle,
    satelliteDetails,
    measureCalloutTitleWidth,
    calloutReveal,
    infoCard,
    infoConnectorPath,
    infoConnectorStart,
    controls
});
