import * as THREE from 'three';
import * as satellite from "satellite.js"
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import './test.js';
import { setupPlanetVisuals } from './planetVisuals.js';

const issJson = {
    "OBJECT_NAME": "ATLAS CENTAUR 2",
    "OBJECT_ID": "1963-047A",
    "EPOCH": "2026-02-21T01:44:49.601184",
    "MEAN_MOTION": 14.12016381,
    "ECCENTRICITY": 0.05481215,
    "INCLINATION": 30.357,
    "RA_OF_ASC_NODE": 288.5064,
    "ARG_OF_PERICENTER": 293.848,
    "MEAN_ANOMALY": 60.5614,
    "EPHEMERIS_TYPE": 0,
    "CLASSIFICATION_TYPE": "U",
    "NORAD_CAT_ID": 694,
    "ELEMENT_SET_NO": 999,
    "REV_AT_EPOCH": 12927,
    "BSTAR": 0.00012889653,
    "MEAN_MOTION_DOT": 0.00001171,
    "MEAN_MOTION_DDOT": 0
};

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

// --- Raycaster for click detection ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedSatellite = null;
let isAnimatingCamera = false;

// Converting JSON to a Satellite Record
const satrec = satellite.json2satrec(issJson);

// Creating the visual marker (the red dot)
const TRAIL_LENGTH_MINUTES = 25; // How long you want the tail to be
const TRAIL_POINTS = 150; // Smoothness of the tail
const TRAIL_UPDATE_INTERVAL_MS = 120; // Recompute trajectory ~8 times/sec instead of every frame.
const trailGeometry = new LineGeometry();
const trailPositions = new Float32Array(TRAIL_POINTS * 3);
const historicalTime = new Date();
let lastTrailUpdateMs = 0;

const initialPositions = [];
for (let i = 0; i < TRAIL_POINTS; i++) {
    initialPositions.push(0, 0, 0);
}
trailGeometry.setPositions(initialPositions);

const trailColors = [];
const colorHelper = new THREE.Color();

// Pre-calculate gradient colors (Tail -> Head)
for (let i = 0; i < TRAIL_POINTS; i++) {
    // t goes from 0.0 (tail) to 1.0 (head)
    const t = i / (TRAIL_POINTS - 1);
    // Interpolate from Black (0,0,0) to Bright Red (1,0,2)
    // Using a slight orange/yellow tint at the bright end makes it look hotter
    colorHelper.setRGB(t, t * 0.2, 0);
    trailColors.push(colorHelper.r, colorHelper.g, colorHelper.b);
}
trailGeometry.setColors(trailColors);

const trailMaterial = new LineMaterial({
    color: 0xffffff, // Use white so vertex colors show through correctly
    linewidth: 4,    // CHANGE THIS NUMBER TO MAKE IT WIDER/THINNER
    vertexColors: true, // Necessary for gradient
    dashed: false,
    alphaToCoverage: true, // Helps edges look smoother
});

trailMaterial.resolution.set(window.innerWidth, window.innerHeight);

const trailLine = new Line2(trailGeometry, trailMaterial);
scene.add(trailLine);

const issMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.015, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff2200 })
);
scene.add(issMesh);

// --- 2. THE UPDATE FUNCTION ---
function updateISS() {
    const now = new Date();
    const nowMs = now.getTime();

    // A. Update the Main Satellite Dot
    const posAndVel = satellite.propagate(satrec, now);
    if (posAndVel.position) {
        const gmst = satellite.gstime(now);
        const posGd = satellite.eciToGeodetic(posAndVel.position, gmst);
        const r = 1 + (posGd.height / 6371);
        issMesh.position.set(
            r * Math.cos(posGd.latitude) * Math.cos(posGd.longitude),
            r * Math.sin(posGd.latitude),
            r * Math.cos(posGd.latitude) * Math.sin(-posGd.longitude)
        );
    }

    // B. Dynamically generate the trailing line (Past trajectory)
    if (nowMs - lastTrailUpdateMs < TRAIL_UPDATE_INTERVAL_MS) {
        return;
    }
    lastTrailUpdateMs = nowMs;

    for (let i = 0; i < TRAIL_POINTS; i++) {
        // Calculate the historical time for this specific point in the line
        // i=0 is the oldest point (tail end), i=99 is the current position (head)
        const timeOffsetMs = (TRAIL_POINTS - 1 - i) * (TRAIL_LENGTH_MINUTES * 60000 / TRAIL_POINTS);
        historicalTime.setTime(nowMs - timeOffsetMs);

        const pastPosVel = satellite.propagate(satrec, historicalTime);
        const baseIndex = i * 3;

        if (pastPosVel.position) {
            const pastGmst = satellite.gstime(historicalTime);
            const pastGd = satellite.eciToGeodetic(pastPosVel.position, pastGmst);
            const pastR = 1 + (pastGd.height / 6371);

            trailPositions[baseIndex] = pastR * Math.cos(pastGd.latitude) * Math.cos(pastGd.longitude);
            trailPositions[baseIndex + 1] = pastR * Math.sin(pastGd.latitude);
            trailPositions[baseIndex + 2] = pastR * Math.cos(pastGd.latitude) * Math.sin(-pastGd.longitude);
        }
    }

    // Tell Three.js the trail has been updated
    trailGeometry.setPositions(trailPositions);
}

// --- Click handling for satellite selection ---
function onCanvasClick(event) {
  // Calculate mouse position in normalized device coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Update raycaster
  raycaster.setFromCamera(mouse, camera);

  // Check if satellite is clicked
  const intersects = raycaster.intersectObject(issMesh, true);

  console.log('Click detected. Intersects:', intersects.length, 'Selected:', selectedSatellite);

  if (intersects.length > 0 && !selectedSatellite) {
    console.log('Selecting satellite');
    selectSatellite();
  } else if (selectedSatellite) {
    console.log('Deselecting satellite');
    deselectSatellite();
  }
}

function selectSatellite() {
  selectedSatellite = issMesh;
  isAnimatingCamera = true;
  controls.enabled = false;

  // Show info box
  const infoBox = document.getElementById('infoBox');
  const satelliteDetails = document.getElementById('satelliteDetails');
  satelliteDetails.textContent = issJson.OBJECT_NAME + '\n\nNORAD ID: ' + issJson.NORAD_CAT_ID;
  infoBox.classList.add('visible');

  // Animate camera to focus on satellite
  const targetDistance = 2;
  const duration = 1000; // milliseconds
  const startTime = Date.now();

  const startPosition = camera.position.clone();
  const targetPosition = issMesh.position.clone().normalize().multiplyScalar(targetDistance);

  const animateCamera = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Smooth easing function
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
    camera.lookAt(issMesh.position);

    if (progress < 1) {
      requestAnimationFrame(animateCamera);
    } else {
      isAnimatingCamera = false;
    }
  };

  animateCamera();
}

function deselectSatellite() {
  selectedSatellite = null;
  isAnimatingCamera = true;
  controls.enabled = false;

  // Hide info box
  const infoBox = document.getElementById('infoBox');
  infoBox.classList.remove('visible');

  // Animate camera back to normal distance (zoom out)
  const duration = 1000; // milliseconds
  const startTime = Date.now();

  const startPosition = camera.position.clone();
  const satelliteDirection = issMesh.position.clone().normalize();
  const targetPosition = satelliteDirection.multiplyScalar(3); // Normal viewing distance

  const animateCamera = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Smooth easing function
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
    camera.lookAt(issMesh.position);

    if (progress < 1) {
      requestAnimationFrame(animateCamera);
    } else {
      isAnimatingCamera = false;
      controls.enabled = true;
    }
  };

  animateCamera();
}

// Add click event listener
document.addEventListener('click', (event) => {
  // Check if click is on the info box
  const infoBox = document.getElementById('infoBox');
  if (infoBox && infoBox.contains(event.target)) {
    return; // Don't deselect if clicking on the box
  }
  onCanvasClick(event);
});

// --- Resize Handling ---

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  planetVisuals.onResize(window.innerWidth, window.innerHeight);
  trailMaterial.resolution.set(window.innerWidth, window.innerHeight);
});

// --- Animation Loop ---

renderer.setAnimationLoop(() => {
    updateISS();
    planetVisuals.update();
    controls.update();
    planetVisuals.render();
});
