import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

export function buildSatelliteMeshes(params) {
    const { satelliteDataMap, scene, activeSatellites, getSatelliteColor, TRAIL_POINTS, initialPositions, sharedTrailMaterial, sharedSatGeometry } = params;
    
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
        trailGeo.setColors(trailColors);

        const trailLine = new Line2(trailGeo, sharedTrailMaterial);
        scene.add(trailLine);

        const uniqueSatMaterial = new THREE.MeshBasicMaterial({color: satColor});
        const satMesh = new THREE.Mesh(sharedSatGeometry, uniqueSatMaterial);
        scene.add(satMesh);

        activeSatellites.push({
            id: satId,
            satrec: satrec,
            mesh: satMesh,
            trailGeometry: trailGeo,
            altitudeKm: 0,
            speedKms: 0,
            angleDeg: 0
        });
    });
}