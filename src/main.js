import * as THREE from 'three';
import * as satellite from "satellite.js"
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
      float nightMask = 1.0 - smoothstep(-0.15, 0.08, sunNdotL);
      totalEmissiveRadiance *= pow(nightMask, 1.5);
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
  })
);
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

const rimLight = new THREE.DirectionalLight(0x9fc9ff, 0.08);
rimLight.position.set(-4, -2, -3);
scene.add(rimLight);

// Converting JSON to a Satellite Record
const satrec = satellite.json2satrec(issJson);

// Creating the visual marker (the red dot)
const MAX_POINTS = 500;
const trailGeometry = new THREE.BufferGeometry();
const trailVertices = new Float32Array(MAX_POINTS * 3);
trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailVertices, 3));
const trailMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
const trailLine = new THREE.Line(trailGeometry, trailMaterial);
scene.add(trailLine);

const issMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.01, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
scene.add(issMesh);

let trailIndex = 0;

function updateISS() {
    const now = new Date();
    const positionAndVelocity = satellite.propagate(satrec, now);
    const positionEci = positionAndVelocity.position;

    if (positionEci) {
        const gmst = satellite.gstime(now);
        const positionGd = satellite.eciToGeodetic(positionEci, gmst);

        const lon = positionGd.longitude;
        const lat = positionGd.latitude;
        const alt = positionGd.height;

        const r = 1 + (alt / 6371);

        const x = r * Math.cos(lat) * Math.cos(lon);
        const y = r * Math.sin(lat);
        const z = r * Math.cos(lat) * Math.sin(-lon);

        issMesh.position.set(x, y, z);

        trailVertices[trailIndex * 3] = x;
        trailVertices[trailIndex * 3 + 1] = y;
        trailVertices[trailIndex * 3 + 2] = z;

        trailIndex = (trailIndex + 1) % MAX_POINTS;
        trailGeometry.attributes.position.needsUpdate = true;
    } else {
        console.error("Satellite math failed. Check TLE strings.");
    }
}

// --- Resize Handling ---

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Animation Loop ---

renderer.setAnimationLoop(() => {
    updateISS();
    cloudLayer.rotation.y += 0.00008;
    controls.update();
    renderer.render(scene, camera);
});
