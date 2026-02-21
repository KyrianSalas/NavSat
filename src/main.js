import * as THREE from 'three';
import * as satellite from "satellite.js"
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

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

// --- Controls ---

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1.5;
controls.maxDistance = 10;

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
      vec3 sunsetColor = vec3(0.55, 0.32, 0.18);
      totalEmissiveRadiance += sunsetColor * sunsetBand * 0.028;
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
      vec3 cloudSunsetColor = vec3(0.72, 0.44, 0.28);
      totalEmissiveRadiance += cloudSunsetColor * cloudSunsetBand * 0.06;
    #endif`
  );
};
scene.add(cloudLayer);

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

// Soft moonlight from the opposite direction keeps clouds faintly visible at night.
const moonLight = new THREE.DirectionalLight(0xb9cfff, 0.12);
moonLight.position.copy(sunLight.position).multiplyScalar(-1);
scene.add(moonLight);

const rimLight = new THREE.DirectionalLight(0x9fc9ff, 0.08);
rimLight.position.set(-4, -2, -3);
scene.add(rimLight);

// Converting JSON to a Satellite Record
const satrec = satellite.json2satrec(issJson);

// Creating the visual marker (the red dot)
const TRAIL_LENGTH_MINUTES = 25; // How long you want the tail to be
const TRAIL_POINTS = 150; // Smoothness of the tail
const trailGeometry = new LineGeometry();

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
    const flatPositionsArray = [];

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
    for (let i = 0; i < TRAIL_POINTS; i++) {
        // Calculate the historical time for this specific point in the line
        // i=0 is the oldest point (tail end), i=99 is the current position (head)
        const timeOffsetMs = (TRAIL_POINTS - 1 - i) * (TRAIL_LENGTH_MINUTES * 60000 / TRAIL_POINTS);
        const historicalTime = new Date(now.getTime() - timeOffsetMs);

        const pastPosVel = satellite.propagate(satrec, historicalTime);

        if (pastPosVel.position) {
            const pastGmst = satellite.gstime(historicalTime);
            const pastGd = satellite.eciToGeodetic(pastPosVel.position, pastGmst);
            const pastR = 1 + (pastGd.height / 6371);

            flatPositionsArray.push(
                pastR * Math.cos(pastGd.latitude) * Math.cos(pastGd.longitude),
                pastR * Math.sin(pastGd.latitude),
                pastR * Math.cos(pastGd.latitude) * Math.sin(-pastGd.longitude)
            );
        }
    }

    // Tell Three.js the trail has been updated
    trailGeometry.setPositions(flatPositionsArray);
}

// --- Resize Handling ---

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  trailMaterial.resolution.set(window.innerWidth, window.innerHeight);
});

// --- Animation Loop ---

renderer.setAnimationLoop(() => {
    updateISS();
    cloudLayer.rotation.y += 0.00008;
    controls.update();
    renderer.render(scene, camera);
});
