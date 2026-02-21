import * as THREE from 'three';
import * as satellite from "satellite.js"
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import './test.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

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

const POST_FX_MODES = [
  {
    key: 'low',
    label: 'Low',
    usePostProcessing: false,
    bloomResolutionScale: 0.75,
    bloomThreshold: 0.30,
    bloomStrength: 0.0,
    bloomRadius: 0.0,
  },
  {
    key: 'medium',
    label: 'Medium',
    usePostProcessing: true,
    bloomResolutionScale: 0.75,
    bloomThreshold: 0.26,
    bloomStrength: 0.25,
    bloomRadius: 0.34,
  },
  {
    key: 'high',
    label: 'High',
    usePostProcessing: true,
    bloomResolutionScale: 1.0,
    bloomThreshold: 0.22,
    bloomStrength: 0.32,
    bloomRadius: 0.40,
  },
];
let postFxModeIndex = 1;
let activePostFxMode = POST_FX_MODES[postFxModeIndex];

// --- Post Processing ---

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(
    window.innerWidth * activePostFxMode.bloomResolutionScale,
    window.innerHeight * activePostFxMode.bloomResolutionScale
  )
);
bloomPass.threshold = activePostFxMode.bloomThreshold;
bloomPass.strength = activePostFxMode.bloomStrength;
bloomPass.radius = activePostFxMode.bloomRadius;
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

const postFxToggleButton = document.createElement('button');
postFxToggleButton.style.position = 'fixed';
postFxToggleButton.style.top = '16px';
postFxToggleButton.style.left = '16px';
postFxToggleButton.style.padding = '8px 12px';
postFxToggleButton.style.border = '1px solid rgba(180, 215, 255, 0.45)';
postFxToggleButton.style.borderRadius = '10px';
postFxToggleButton.style.background = 'rgba(8, 18, 34, 0.7)';
postFxToggleButton.style.color = '#d7ecff';
postFxToggleButton.style.fontFamily = 'system-ui, -apple-system, Segoe UI, sans-serif';
postFxToggleButton.style.fontSize = '12px';
postFxToggleButton.style.fontWeight = '600';
postFxToggleButton.style.letterSpacing = '0.01em';
postFxToggleButton.style.cursor = 'pointer';
postFxToggleButton.style.zIndex = '12';
document.body.appendChild(postFxToggleButton);

function applyPostFxMode(mode) {
  activePostFxMode = mode;
  postFxToggleButton.textContent = `Post FX: ${mode.label}`;

  if (!mode.usePostProcessing) {
    bloomPass.enabled = false;
    outputPass.enabled = false;
    return;
  }

  bloomPass.enabled = true;
  outputPass.enabled = true;
  bloomPass.threshold = mode.bloomThreshold;
  bloomPass.strength = mode.bloomStrength;
  bloomPass.radius = mode.bloomRadius;
  bloomPass.setSize(
    window.innerWidth * mode.bloomResolutionScale,
    window.innerHeight * mode.bloomResolutionScale
  );
}

postFxToggleButton.addEventListener('click', () => {
  postFxModeIndex = (postFxModeIndex + 1) % POST_FX_MODES.length;
  applyPostFxMode(POST_FX_MODES[postFxModeIndex]);
});

applyPostFxMode(activePostFxMode);

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

// --- Texture Loading ---
// Color map: Blue Marble (sRGB)
// Normal map: Tangent-space Earth normals (linear / no color space)
// Specular map: Used as inverse roughness — oceans are shiny, land is matte (linear)

const loader = new THREE.TextureLoader();

const colorMap = loader.load('https://unpkg.com/three-globe@2.35.0/example/img/earth-blue-marble.jpg');
colorMap.colorSpace = THREE.SRGBColorSpace;

const normalMap = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_normal_2048.jpg');
normalMap.colorSpace = THREE.NoColorSpace;

const specularMap = loader.load('https://unpkg.com/three-globe@2.35.0/example/img/earth-water.png');

const cityLightsMap = loader.load('https://unpkg.com/three-globe@2.35.0/example/img/earth-night.jpg');
cityLightsMap.colorSpace = THREE.SRGBColorSpace;

const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
colorMap.anisotropy = maxAnisotropy;
normalMap.anisotropy = maxAnisotropy;
specularMap.anisotropy = maxAnisotropy;
cityLightsMap.anisotropy = maxAnisotropy;

// 4K cloud texture with transparency for a detailed atmospheric shell.
const cloudColorMap = loader.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/fair_clouds_4k.png');
cloudColorMap.colorSpace = THREE.SRGBColorSpace;
cloudColorMap.anisotropy = maxAnisotropy;

const cloudAlphaMap = loader.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/fair_clouds_4k.png');
cloudAlphaMap.colorSpace = THREE.NoColorSpace;
cloudAlphaMap.anisotropy = maxAnisotropy;

// --- Globe (PBR Material) ---
// metalness kept low — Earth is mostly dielectric
// roughnessMap uses the specular/water map so oceans appear glossy
// normalScale adds visible but subtle terrain relief

const globe = new THREE.Mesh(
  new THREE.SphereGeometry(1, 128, 128),
  new THREE.MeshStandardMaterial({
    map: colorMap,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughnessMap: specularMap,
    roughness: 0.9,
    metalness: 0.02,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: cityLightsMap,
    emissiveIntensity: 1.6,
  })
);
globe.material.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <roughnessmap_fragment>',
    `
    float roughnessFactor = roughness;
    #ifdef USE_ROUGHNESSMAP
      vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
      // Invert the green channel so water (white) becomes smooth (0.0) and land (black) becomes rough (1.0)
      // Clamp slightly so ocean is not a perfect mirror.
      roughnessFactor *= clamp(1.0 - texelRoughness.g, 0.4, 1.0);
    #endif
    `
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
    #if NUM_DIR_LIGHTS > 0
      float sunNdotL = dot(normal, directionalLights[0].direction);

      // Wider and softer city-light transition through civil/nautical twilight.
      float nightMask = 1.0 - smoothstep(-0.30, 0.18, sunNdotL);
      totalEmissiveRadiance *= nightMask;

      // Broad, low-intensity sunset haze around the terminator (avoids a hard red stripe).
      float sunsetBand =
        smoothstep(-0.32, -0.02, sunNdotL) *
        (1.0 - smoothstep(0.03, 0.24, sunNdotL));
      vec3 sunsetColor = vec3(0.35, 0.22, 0.14);
      totalEmissiveRadiance += sunsetColor * sunsetBand * 0.012;
    #endif`
  );
};
scene.add(globe);

const cloudLayer = new THREE.Mesh(
  new THREE.SphereGeometry(1.01, 192, 192),
  new THREE.MeshStandardMaterial({
    map: cloudColorMap,
    alphaMap: cloudAlphaMap,
    transparent: true,
    opacity: 0.88,
    alphaTest: 0.05,
    depthWrite: false,
    roughness: 0.9,
    metalness: 0.0,
    displacementMap: cloudAlphaMap,
    displacementScale: 0.004,
    displacementBias: -0.0015,
    emissive: new THREE.Color(0xaec6e4),
    emissiveIntensity: 0.035,
  })
);
cloudLayer.material.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
    #if NUM_DIR_LIGHTS > 0
      float sunNdotL = dot(normal, directionalLights[0].direction);

      // Clouds carry warm scattering slightly deeper into the night side.
      float cloudSunsetBand =
        smoothstep(-0.40, -0.06, sunNdotL) *
        (1.0 - smoothstep(0.06, 0.30, sunNdotL));
      vec3 cloudSunsetColor = vec3(0.46, 0.31, 0.22);
      totalEmissiveRadiance += cloudSunsetColor * cloudSunsetBand * 0.02;
    #endif`
  );
};
scene.add(cloudLayer);

// --- Atmosphere Halo (Fresnel Glow) ---

const atmosphereUniforms = {
  sunDirection: { value: new THREE.Vector3(1, 0, 0) },
  dayColor: { value: new THREE.Color(0x6e9de6) },
  twilightColor: { value: new THREE.Color(0xd7b48c) },
  nightColor: { value: new THREE.Color(0x1d2e4f) },
  intensity: { value: 0.20 },
  rimPower: { value: 2.3 },
  rimStart: { value: 0.012 },
  alphaMax: { value: 0.18 },
};

const atmosphereVertexShader = `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const atmosphereFragmentShader = `
  uniform vec3 sunDirection;
  uniform vec3 dayColor;
  uniform vec3 twilightColor;
  uniform vec3 nightColor;
  uniform float intensity;
  uniform float rimPower;
  uniform float rimStart;
  uniform float alphaMax;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normalDir = normalize(vWorldNormal);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 sunDir = normalize(sunDirection);

    float rimRaw = 1.0 - max(dot(normalDir, viewDirection), 0.0);
    float rim = pow(rimRaw, rimPower);
    rim = smoothstep(rimStart, 1.0, rim);

    float sunAmount = dot(normalDir, sunDir);
    float day = smoothstep(-0.05, 0.55, sunAmount);
    float twilight = smoothstep(-0.30, 0.04, sunAmount) * (1.0 - smoothstep(0.04, 0.34, sunAmount));
    float night = 1.0 - smoothstep(-0.20, 0.12, sunAmount);

    vec3 color =
      dayColor * day +
      twilightColor * twilight * 0.35 +
      nightColor * night * 0.35;

    float alpha = rim * (0.08 + day * 0.82 + twilight * 0.48 + night * 0.30) * intensity;
    alpha = clamp(alpha, 0.0, alphaMax);
    gl_FragColor = vec4(color, alpha);
  }
`;

const atmosphereLayer = new THREE.Mesh(
  new THREE.SphereGeometry(1.022, 128, 128),
  new THREE.ShaderMaterial({
    uniforms: atmosphereUniforms,
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  })
);
scene.add(atmosphereLayer);

// --- Starfield ---
// 2000 random points scattered in a large cube around the scene

const starCount = 2000;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) {
  starPositions[i] = (Math.random() - 0.5) * 200;
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.15 })
);
scene.add(stars);

// --- Lighting ---
// Hemisphere approximates sky/ground bounce while directional acts as the sun.
scene.add(new THREE.HemisphereLight(0x8fb8ff, 0x1f120a, 0.05));

const sunLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
sunLight.position.set(5, 3, 5);
scene.add(sunLight);

const atmosphereSunDirection = new THREE.Vector3();
function updateAtmosphereSunDirection() {
  atmosphereSunDirection.copy(sunLight.position).normalize();
  atmosphereUniforms.sunDirection.value.copy(atmosphereSunDirection);
}
updateAtmosphereSunDirection();

// Soft moonlight from the opposite direction keeps clouds faintly visible at night.
const moonLight = new THREE.DirectionalLight(0xb9cfff, 0.12);
moonLight.position.copy(sunLight.position).multiplyScalar(-1);
scene.add(moonLight);

const rimLight = new THREE.DirectionalLight(0x9fc9ff, 0.08);
rimLight.position.set(-4, -2, -3);
scene.add(rimLight);

// --------------- SATELLITES ---------------

// The dictionary
const satelliteDataMap = {};
const activeSatellites = [];

// Creating the visual marker (the red dot)
const TRAIL_LENGTH_MINUTES = 5; // How long you want the tail to be
const TRAIL_POINTS = 20; // Smoothness of the tail

const initialPositions = [];
for (let i = 0; i < TRAIL_POINTS; i++) {
    initialPositions.push(0, 0, 0);
}

const sharedTrailMaterial = new LineMaterial({
    color: 0xffffff, // Use white so vertex colors show through correctly
    linewidth: 4,    // CHANGE THIS NUMBER TO MAKE IT WIDER/THINNER
    vertexColors: true, // Necessary for gradient
    dashed: false,
    alphaToCoverage: true, // Helps edges look smoother
});

sharedTrailMaterial.resolution.set(window.innerWidth, window.innerHeight);

const sharedSatGeometry = new THREE.SphereGeometry(0.015,16,16)

function getSatelliteColor(jsonData) {
    const revsPerDay = jsonData.MEAN_MOTION;

    // Keep GEO and MEO just in case you add other data types later!
    if (revsPerDay > 0.9 && revsPerDay < 1.1) return new THREE.Color(0x00ff00); // GEO (Green)
    if (revsPerDay > 1.9 && revsPerDay < 2.2) return new THREE.Color(0x00aaff); // MEO (Blue)

    // Detailed LEO Breakdown for your specific dataset
    if (revsPerDay >= 11 && revsPerDay < 13) {
        return new THREE.Color(0xcc00ff); // Purple (~11-12 revs/day - Higher LEO)
    }
    else if (revsPerDay >= 13 && revsPerDay < 14) {
        return new THREE.Color(0x00ffff); // Cyan (~13 revs/day)
    }
    else if (revsPerDay >= 14 && revsPerDay < 15) {
        return new THREE.Color(0xffff00); // Yellow (~14 revs/day - Very common)
    }
    else if (revsPerDay >= 15 && revsPerDay < 16) {
        return new THREE.Color(0xff6600); // Orange (~15 revs/day - Very common, lower altitude)
    }
    else if (revsPerDay >= 16) {
        return new THREE.Color(0xff0000); // Red (16+ revs/day - Extremely fast, very low altitude)
    }

    return new THREE.Color(0xffffff); // Catch-all Fallback (White)
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
            colorHelper.setRGB(satColor.r * t, satColor.g * t, satColor.b * t);
            trailColors.push(colorHelper.r, colorHelper.g, colorHelper.b);
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
        const response = await fetch('https://bris-hack-project-2026.vercel.app/satellites');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const jsonArray = await response.json();

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
  composer.setSize(window.innerWidth, window.innerHeight);
  if (activePostFxMode.usePostProcessing) {
    bloomPass.setSize(
      window.innerWidth * activePostFxMode.bloomResolutionScale,
      window.innerHeight * activePostFxMode.bloomResolutionScale
    );
  }
  sharedTrailMaterial.resolution.set(window.innerWidth, window.innerHeight);
});

// --- Animation Loop ---

renderer.setAnimationLoop(() => {
    updateSatellites();
    cloudLayer.rotation.y += 0.00008;
    updateAtmosphereSunDirection();
    controls.update();
    if (activePostFxMode.usePostProcessing) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
});
