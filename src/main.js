import * as THREE from 'three';
import * as satellite from "satellite.js"
import { getUserLocation } from './services/locationService.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { setupPlanetVisuals } from './widgets/planetVisuals.js';
import { addUserLocationMarker } from './widgets/userLocationMarker.js';
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
let selectedSatellite = null;
let isAnimatingCamera = false;

// --- User location --- epic formatted comment
let location = null
getUserLocation().then(loc => {
    location = loc;
    console.log('location:', location);
}).catch(err => console.warn('Location access denied or failed:', err));
console.log('location:', location);
const projectedSatelliteScreen = new THREE.Vector3();

const infoBox = document.getElementById('infoBox');
const infoTitle = document.getElementById('infoTitle');
const infoCard = document.getElementById('infoCard');
const satelliteDetails = document.getElementById('satelliteDetails');
const fireLaserButton = document.getElementById('fireLaserButton');
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

const dummy = new THREE.Object3D();
let satInstancedMesh;
const RENDER_TRAILS_THRESHOLD = 500;

const sharedSatGeometry = new THREE.SphereGeometry(0.005, 8, 8);
const sharedSatMaterial = new THREE.MeshBasicMaterial({color: 0xffffff});

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
    const satKeys = Object.keys(satelliteDataMap);
    const numSatellites = satKeys.length;

    // 1. Create the InstancedMesh (Geometry, Material, Count)
    satInstancedMesh = new THREE.InstancedMesh(sharedSatGeometry, sharedSatMaterial, numSatellites);
    satInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    satInstancedMesh.frustumCulled = false;

    scene.add(satInstancedMesh);

    const renderTrails = numSatellites < RENDER_TRAILS_THRESHOLD;

    satKeys.forEach((satId, index) => {
        const jsonData = satelliteDataMap[satId];
        const satrec = satellite.json2satrec(jsonData);
        const satColor = getSatelliteColor(jsonData);

        // 2. Set the geopolitical color for this specific instance
        satInstancedMesh.setColorAt(index, satColor);

        let trailGeo = null;
        let trailLine = null;

        // 3. Only build heavy Line2 trails if we have a small number of satellites
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

        activeSatellites.push({
            id: satId,
            satrec: satrec,
            index: index, // Store its index in the InstancedMesh
            trailGeometry: trailGeo,
            altitudeKm: 0,
            speedKms: 0,
            angleDeg: 0
        });
    });

    // Tell Three.js we updated the colors
    satInstancedMesh.instanceColor.needsUpdate = true;
}

async function loadSatellites() {
    try {
        const jsonArray = await service.getAllSatellites("active");

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
        // A. Update the Main Satellite Dot
        const posAndVel = satellite.propagate(sat.satrec, now);
        if (posAndVel.position) {
            const gmst = satellite.gstime(now);
            const posGd = satellite.eciToGeodetic(posAndVel.position, gmst);
            const r = 1 + (posGd.height / 6371);

            const x = r * Math.cos(posGd.latitude) * Math.cos(posGd.longitude);
            const y = r * Math.sin(posGd.latitude);
            const z = r * Math.cos(posGd.latitude) * Math.sin(-posGd.longitude);

            // Set the dummy position and update the InstancedMesh at this satellite's index
            dummy.position.set(x, y, z);
            dummy.updateMatrix();
            satInstancedMesh.setMatrixAt(sat.index, dummy.matrix);

            sat.altitudeKm = posGd.height;
            if (posAndVel.velocity) {
                sat.speedKms = Math.sqrt(
                    (posAndVel.velocity.x ** 2) +
                    (posAndVel.velocity.y ** 2) +
                    (posAndVel.velocity.z ** 2)
                );
            }
            sat.angleDeg = (THREE.MathUtils.radToDeg(Math.atan2(z, x)) + 360) % 360;

            // Only do the heavy trail math if the trail geometry actually exists
            if (sat.trailGeometry) {
                const flatPositionsArray = [];
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
                        flatPositionsArray.push(0, 0, 0);
                    }
                }
                sat.trailGeometry.setPositions(flatPositionsArray);
            }
        }
    });

    // CRITICAL: Tell the GPU the matrices have moved!
    if (satInstancedMesh) {
        satInstancedMesh.instanceMatrix.needsUpdate = true;
    }
}

function getSatelliteDetailsText(sat) {
  const distanceKm = Math.max(0, sat.altitudeKm || 0);
  const speedRatio = Math.max(0, (sat.speedKms || 0) / 12.8);
  const angleDeg = ((sat.angleDeg || 0) + 360) % 360;
  return `Distance: ${Math.round(distanceKm)}km\nSpeed: ${speedRatio.toFixed(2)}x\nAngle: ${Math.round(angleDeg)}°`;
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
    const impactWorldPoint = planetVisuals.globe.localToWorld(surfaceNormal.clone().multiplyScalar(1.006));
    spawnLaserBeam(selectedSatellite.mesh.position.clone(), impactWorldPoint);
  }
}

function fireSelectedSatelliteLaser() {
  if (!selectedSatellite || isAnimatingCamera) {
    return;
  }

  const targetWorldPoint = selectedSatellite.mesh.position.clone().normalize();
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
  calloutTyping.active = true;
  infoTitle.textContent = '';
  satelliteDetails.textContent = '';
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
  if (!selectedSatellite) {
    infoBox.classList.remove('visible');
    if (fireLaserButton) {
      fireLaserButton.disabled = true;
    }
    calloutLayout.initialized = false;
    return;
  }

  // Only render callout once camera transition has settled on target.
  if (isAnimatingCamera) {
    infoBox.classList.remove('visible');
    if (fireLaserButton) {
      fireLaserButton.disabled = true;
    }
    return;
  }

  const tempMatrix = new THREE.Matrix4();
  satInstancedMesh.getMatrixAt(selectedSatellite.index, tempMatrix);
  const currentPos = new THREE.Vector3().setFromMatrixPosition(tempMatrix);

  // Project that 3D position to the 2D screen
    projectedSatelliteScreen.copy(currentPos).project(camera);

  if (projectedSatelliteScreen.z < -1 || projectedSatelliteScreen.z > 1) {
    infoBox.classList.remove('visible');
    if (fireLaserButton) {
      fireLaserButton.disabled = true;
    }
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const satX = (projectedSatelliteScreen.x * 0.5 + 0.5) * width;
  const satY = (-projectedSatelliteScreen.y * 0.5 + 0.5) * height;

  updateCalloutTyping();

  const fullTitleText = calloutTyping.titleTarget || infoTitle.textContent || '';
  const measuredTitleWidth = Math.max(120, measureCalloutTitleWidth(fullTitleText));
  const targetCalloutWidth = THREE.MathUtils.clamp(measuredTitleWidth + 36, 180, 300);

  const targetP0x = THREE.MathUtils.clamp(satX - targetCalloutWidth - 120, 24, width - targetCalloutWidth - 24);
  const targetP0y = THREE.MathUtils.clamp(satY - 100, 28, height - 170);

  if (!calloutLayout.initialized) {
    calloutLayout.initialized = true;
    calloutLayout.p0x = targetP0x;
    calloutLayout.p0y = targetP0y;
    calloutLayout.width = targetCalloutWidth;
  } else {
    const follow = isAnimatingCamera ? 0.2 : 0.35;
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

// --- Click handling for satellite selection ---
function onCanvasClick(event) {
  // Prevent clicks during animation
  if (isAnimatingCamera || !satInstancedMesh) return;
  
  // Calculate mouse position in normalized device coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Update raycaster
  raycaster.setFromCamera(mouse, camera);

  // Check if any satellite is clicked - get all satellite meshes
  const intersects = raycaster.intersectObject(satInstancedMesh);

  if (intersects.length > 0 && !selectedSatellite) {
    // Find which satellite was clicked
    const instanceId = intersects[0].instanceId;
    const clickedSat = activeSatellites.find(sat => sat.index === instanceId);
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

    // Animate camera to focus on satellite
    const targetDistance = 2;
    const duration = 1000; // milliseconds
    const startTime = Date.now();

    const startPosition = camera.position.clone();
    // Use the extracted position for our target calculations
    const targetCameraPosition = targetSatPosition.clone().normalize().multiplyScalar(targetDistance);

    const animateCamera = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Smooth easing function
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        camera.position.lerpVectors(startPosition, targetCameraPosition, easeProgress);
        camera.lookAt(targetSatPosition); // Look exactly at the satellite

        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        } else {
            isAnimatingCamera = false;
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
  selectedSatellite = null;
  isAnimatingCamera = true;
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
      isAnimatingCamera = false;
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

renderer.setAnimationLoop(() => {
    updateSatellites();
    planetVisuals.update();
    updateDestructiveEffects();
    updateSatelliteCallout();
    controls.update();
    planetVisuals.render();
});
