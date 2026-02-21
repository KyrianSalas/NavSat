// src/widgets/stormMarkers.js
import * as THREE from 'three';
import { getActiveStorms } from '../api/weatherService.js';

export function setupStormMarkers(scene) {
    // 1. Create a single Group to hold all storms so we can easily toggle visibility
    const stormGroup = new THREE.Group();
    stormGroup.visible = true; // Default to on so judges see it!
    scene.add(stormGroup);

    const stormMeshes = [];

    // Load data asynchronously so it doesn't block the rest of your app loading
    getActiveStorms().then(storms => {
        const radius = 1.015; 

        // 2. Programmatically generate a detailed Infrared storm texture
        const canvas = document.createElement('canvas');
        canvas.width = 128; 
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const cx = 64;
        const cy = 64;
        
        // Infrared colour palette
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 64);
        gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)'); // Eye (White/Clear)
        gradient.addColorStop(0.05, 'rgba(255, 0, 255, 0.9)');  // Peak intensity (Magenta)
        gradient.addColorStop(0.15, 'rgba(139, 0, 0, 0.8)');    // Severe (Dark Red)
        gradient.addColorStop(0.3, 'rgba(255, 69, 0, 0.6)');    // Orange
        gradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.4)');   // Yellow
        gradient.addColorStop(0.7, 'rgba(50, 205, 50, 0.2)');   // Outer edge (Green)
        gradient.addColorStop(1.0, 'rgba(0, 0, 255, 0.0)');     // Transparent
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, 64, 0, Math.PI * 2);
        ctx.fill();
        
        // Add swirling bands to simulate cyclone rotation
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            const angleOffset = (i / 6) * Math.PI * 2;
            ctx.arc(cx, cy, 25 + (i * 4), angleOffset, angleOffset + Math.PI * 1.2);
            ctx.stroke();
        }

        const stormTexture = new THREE.CanvasTexture(canvas);

        // 3. Plot each storm
        storms.forEach(storm => {
            const phi = (90 - storm.latitude) * (Math.PI / 180);
            const theta = (storm.longitude + 180) * (Math.PI / 180);

            const x = -(radius * Math.sin(phi) * Math.cos(theta));
            const z = (radius * Math.sin(phi) * Math.sin(theta));
            const y = (radius * Math.cos(phi));

            // Made slightly larger so the infrared rings show up clearly
            const geometry = new THREE.PlaneGeometry(0.12, 0.12);
            const material = new THREE.MeshBasicMaterial({
                map: stormTexture,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, y, z);
            mesh.lookAt(new THREE.Vector3(0, 0, 0));
            
            mesh.userData = {
                isStorm: true,
                title: storm.title,
                date: storm.date,
                position: new THREE.Vector3(x, y, z)
            };

            // Add to our toggleable group instead of the scene directly
            stormGroup.add(mesh);
            
            stormMeshes.push({
                mesh,
                spinSpeed: (Math.random() * 0.01) + 0.005 
            });
        });
    });

    // 4. Return the group (for the UI) and the update function (for the render loop)
    return {
        group: stormGroup,
        update: () => {
            stormMeshes.forEach(stormObj => {
                stormObj.mesh.rotateZ(stormObj.spinSpeed);
            });
        }
    };
}