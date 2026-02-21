import * as THREE from 'three';
import { getUserLocation } from '../services/locationService'

/**
 * Add a marker at the user's current location on the Earth
 * @param {THREE.Scene} scene - The Three.js scene to add the marker to
 * @param {Object} options - Optional configuration
 * @param {number} options.size - Marker size (default: 0.05)
 * @param {number} options.color - Marker color in hex (default: 0xFF0000 red)
 */
export async function addUserLocationMarker(scene, options = {}) {
  const { size = 0.005, color = 0xFF0000 } = options;
  
  try {
    const location = await getUserLocation();
    const { latitude, longitude } = location;
    
    // Convert lat/lon to 3D coordinates on sphere (matching satellite positioning)
    const lat = latitude * Math.PI / 180;
    const lon = longitude * Math.PI / 180;
    const radius = 1; // Earth radius
    
    const x = radius * Math.cos(lat) * Math.cos(lon);
    const y = radius * Math.sin(lat);
    const z = radius * Math.cos(lat) * Math.sin(-lon);
    
    // Create marker (disc)
    const markerGeometry = new THREE.CylinderGeometry(size, size, 0.005, 32);
    const markerMaterial = new THREE.MeshBasicMaterial({ color });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    
    marker.position.set(x, y, z);
    // Orient disc to face outward from Earth, then rotate 90 degrees to face up
    marker.lookAt(new THREE.Vector3(0, 0, 0));
    marker.rotateX(Math.PI / 2);
    scene.add(marker);

    return { latitude, longitude, marker };
  } catch (error) {
    return null;
  }
}
