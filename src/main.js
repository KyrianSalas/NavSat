import * as THREE from 'three';
import * as satellite from "satellite.js"
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Boilerplate data
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

const canvas = document.getElementById('canvas');

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 3);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1.5;
controls.maxDistance = 10;

const loader = new THREE.TextureLoader();

const earthTexture = loader.load('https://unpkg.com/three-globe@2.35.0/example/img/earth-blue-marble.jpg');
const globe = new THREE.Mesh(
  new THREE.SphereGeometry(1, 64, 64),
  new THREE.MeshStandardMaterial({ map: earthTexture })
);
scene.add(globe);

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

scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 3, 5);
scene.add(dirLight);

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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
    updateISS();
    controls.update();
    renderer.render(scene, camera);
});
