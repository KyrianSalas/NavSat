import * as THREE from 'three';
import * as satellite from "satellite.js"
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { setupPlanetVisuals } from './planetVisuals.js';
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

// --- Raycaster for click detection ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedSatellite = null;
let isAnimatingCamera = false;

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

function getSatelliteColor(jsonData) {
    const name = jsonData.OBJECT_NAME.toUpperCase();

    // 1. Soviet / Russian (Red)
    // COSMOS, SL- (Soviet launchers), INTERCOSMOS, RESURS, OKEAN, ZARYA (ISS module)
    if (name.includes('COSMOS') || name.startsWith('SL-') ||
        name.includes('INTERCOSMOS') || name.includes('RESURS') ||
        name.includes('OKEAN') || name.includes('ZARYA')) {
        return new THREE.Color(0xff2222);
    }

        // 2. Chinese (Gold / Yellow)
    // CZ- (Long March), SHIJIAN, YAOGAN, HXMT, CSS (Chinese Space Station), SZ- (Shenzhou)
    else if (name.startsWith('CZ-') || name.includes('SHIJIAN') ||
        name.includes('YAOGAN') || name.includes('HXMT') ||
        name.includes('CSS') || name.startsWith('SZ-')) {
        return new THREE.Color(0xffcc00);
    }

        // 3. European Space Agency / Arianespace (Blue)
    // ARIANE, ENVISAT, HELIOS
    else if (name.includes('ARIANE') || name.includes('ENVISAT') || name.includes('HELIOS')) {
        return new THREE.Color(0x3388ff);
    }

        // 4. Japanese (White)
    // H-2A (Launcher), ALOS, ASTRO, AJISAI, MIDORI, XRISM
    else if (name.includes('H-2A') || name.includes('ALOS') ||
        name.includes('ASTRO') || name.includes('AJISAI') ||
        name.includes('MIDORI') || name.includes('XRISM')) {
        return new THREE.Color(0xffffff);
    }

        // 5. United States / NASA / Commercial US (Cyan/Light Blue)
    // ATLAS, DELTA, THOR, TITAN, USA, OAO, SERT, SEASAT, AQUA, HST, ACS3
    else if (name.includes('ATLAS') || name.includes('DELTA') ||
        name.includes('THOR') || name.includes('TITAN') ||
        name.startsWith('USA ') || name.includes('OAO') ||
        name.includes('SERT') || name.includes('SEASAT') ||
        name.includes('AQUA') || name.includes('HST') || name.includes('ACS3')) {
        return new THREE.Color(0x00ffff);
    }

        // 6. Indian (Orange)
    // GSLV
    else if (name.includes('GSLV')) {
        return new THREE.Color(0xff8800);
    }

    // Default Fallback for anything else (e.g., SAOCOM, ISIS, etc.) (Grey/Purple)
    return new THREE.Color(0xcc55ff);
}

function buildSatelliteMeshes() {
    Object.keys(satelliteDataMap).forEach(satId => {
        const jsonData = satelliteDataMap[satId];
        const satrec = satellite.json2satrec(jsonData);
        const satColor = getSatelliteColor(jsonData);

        const trailColors = [];
        const colorHelper = new THREE.Color();
        for (let i = 0; i < TRAIL_POINTS; i++) {
            const t = i / (TRAIL_POINTS - 1);
            const intensity = Math.pow(t, 2.0);

            colorHelper.setRGB(
                satColor.r * intensity,
                satColor.g * intensity,
                satColor.b * intensity
            );

            trailColors.push(colorHelper.r, colorHelper.g, colorHelper.b)
        }

        const trailGeo = new LineGeometry();
        trailGeo.setPositions(initialPositions);
        trailGeo.setColors(trailColors); // Or your custom colors from the previous step!

        const trailLine = new Line2(trailGeo, sharedTrailMaterial);
        scene.add(trailLine);

        const uniqueSatMaterial = new THREE.MeshBasicMaterial({color: satColor});
        const satMesh = new THREE.Mesh(sharedSatGeometry, uniqueSatMaterial);
        scene.add(satMesh);

        activeSatellites.push({
            id: satId,
            satrec: satrec,
            mesh: satMesh,
            trailGeometry: trailGeo
        });
    });
}

async function loadSatellites() {
    try {
        const jsonArray = await service.getAllSatellites("stations");

        jsonArray.forEach(satelliteObj => {
            satelliteDataMap[satelliteObj.OBJECT_ID] = satelliteObj;
        });

        console.log(`Successfully loaded ${jsonArray.length} satellites.`);
        buildSatelliteMeshes();

    } catch (error) {
        console.error("Failed to load satellites. Check if your Python server is running and CORS is enabled.", error);
    }
}

loadSatellites();


// --- 2. THE UPDATE FUNCTION ---
function updateSatellites() {
    const now = new Date();

    // Loop through every active satellite
    activeSatellites.forEach(sat => {
        const flatPositionsArray = [];

        // A. Update the Main Satellite Dot
        const posAndVel = satellite.propagate(sat.satrec, now);
        if (posAndVel.position) {
            const gmst = satellite.gstime(now);
            const posGd = satellite.eciToGeodetic(posAndVel.position, gmst);
            const r = 1 + (posGd.height / 6371);
            sat.mesh.position.set(
                r * Math.cos(posGd.latitude) * Math.cos(posGd.longitude),
                r * Math.sin(posGd.latitude),
                r * Math.cos(posGd.latitude) * Math.sin(-posGd.longitude)
            );
        }

        // B. Dynamically generate the trailing line
        for (let i = 0; i < TRAIL_POINTS; i++) {
            const timeOffsetMs = (TRAIL_POINTS - 1 - i) * (TRAIL_LENGTH_MINUTES * 60000 / TRAIL_POINTS);
            const historicalTime = new Date(now.getTime() - timeOffsetMs);
            const pastPosVel = satellite.propagate(sat.satrec, historicalTime);

            if (pastPosVel.position) {
                const pastGmst = satellite.gstime(historicalTime);
                const pastGd = satellite.eciToGeodetic(pastPosVel.position, pastGmst);
                const pastR = 1 + (pastGd.height / 6371);

                flatPositionsArray.push(
                    pastR * Math.cos(pastGd.latitude) * Math.cos(pastGd.longitude),
                    pastR * Math.sin(pastGd.latitude),
                    pastR * Math.cos(pastGd.latitude) * Math.sin(-pastGd.longitude)
                );
            } else {
                // Fallback: If SGP4 math fails for an old point, push 0,0,0 to prevent Line2 crashes
                flatPositionsArray.push(0, 0, 0);
            }
        }

        // Apply new positions to this specific satellite's trail
        sat.trailGeometry.setPositions(flatPositionsArray);
    });
}

// --- Click handling for satellite selection ---
function onCanvasClick(event) {
  // Prevent clicks during animation
  if (isAnimatingCamera) return;
  
  // Calculate mouse position in normalized device coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Update raycaster
  raycaster.setFromCamera(mouse, camera);

  // Check if any satellite is clicked - get all satellite meshes
  const satelliteMeshes = activeSatellites.map(sat => sat.mesh);
  const intersects = raycaster.intersectObjects(satelliteMeshes, true);

  if (intersects.length > 0 && !selectedSatellite) {
    // Find which satellite was clicked
    const clickedMesh = intersects[0].object;
    const clickedSat = activeSatellites.find(sat => sat.mesh === clickedMesh);
    if (clickedSat) {
      selectSatellite(clickedSat);
    }
  } else if (selectedSatellite) {
    deselectSatellite();
  }
}

function selectSatellite(sat) {
  selectedSatellite = sat;
  isAnimatingCamera = true;
  controls.enabled = false;

  // Show info box
  const infoBox = document.getElementById('infoBox');
  const satelliteDetails = document.getElementById('satelliteDetails');
  
  // Get satellite data from the selected satellite
  const satData = satelliteDataMap[sat.id];
  satelliteDetails.textContent = satData.OBJECT_NAME + '\n\nNORAD ID: ' + satData.NORAD_CAT_ID;
  infoBox.classList.add('visible');

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
  sharedTrailMaterial.resolution.set(window.innerWidth, window.innerHeight);
});

// --- Animation Loop ---

renderer.setAnimationLoop(() => {
    updateSatellites();
    planetVisuals.update();
    controls.update();
    planetVisuals.render();
});
