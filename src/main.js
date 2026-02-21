import * as THREE from 'three';
import * as satellite from "satellite.js"
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
// Normal map: Surface elevation detail (linear)
// Specular map: Used as inverse roughness — oceans are shiny, land is matte (linear)

const loader = new THREE.TextureLoader();

const colorMap = loader.load('https://unpkg.com/three-globe@2.35.0/example/img/earth-blue-marble.jpg');
colorMap.colorSpace = THREE.SRGBColorSpace;

const normalMap = loader.load('https://unpkg.com/three-globe@2.35.0/example/img/earth-topology.png');

const specularMap = loader.load('https://unpkg.com/three-globe@2.35.0/example/img/earth-water.png');

// --- Globe (PBR Material) ---
// metalness kept low — Earth is mostly dielectric
// roughnessMap uses the specular/water map so oceans appear glossy
// normalScale adds visible but subtle terrain relief

const globe = new THREE.Mesh(
  new THREE.SphereGeometry(1, 128, 128),
  new THREE.MeshStandardMaterial({
    map: colorMap,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: specularMap,
    roughness: 1.0,
    metalness: 0.1,
  })
);
scene.add(globe);

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
// Ambient provides soft fill; directional acts as the sun

scene.add(new THREE.AmbientLight(0xffffff, 0.3));

const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(5, 3, 5);
scene.add(sunLight);

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
    new THREE.SphereGeometry(0.01, 16, 16), // Made slightly larger to find it easier
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

        // Radius = Earth(1) + Altitude.
        // We multiply alt by a factor if we want to "exaggerate" the height for visibility
        const r = 1 + (alt / 6371);

        const x = r * Math.cos(lat) * Math.cos(lon);
        const y = r * Math.sin(lat);
        const z = r * Math.cos(lat) * Math.sin(-lon); // Negative lon matches most textures

        issMesh.position.set(x, y, z);

        // --- Update Trail ---
        // Shift existing points or just add a new one every few frames
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
    controls.update();
    renderer.render(scene, camera);
});
