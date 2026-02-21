import * as THREE from 'three';

/**
 * Center camera on user's location with smooth animation
 * @param {Object} params - Configuration object
 * @param {THREE.Camera} params.camera - The camera to animate
 * @param {THREE.Controls} params.controls - OrbitControls instance
 * @param {number} params.latitude - User's latitude in degrees
 * @param {number} params.longitude - User's longitude in degrees
 * @param {Object} params.isAnimatingCameraRef - Reference object for animation state
 * @param {number} params.targetDistance - Distance from surface (default: 1.2)
 * @param {number} params.duration - Animation duration in ms (default: 1500)
 */
export function centerToUserLocation(params) {
  const {
    camera,
    controls,
    latitude = null,
    longitude = null,
    isAnimatingCameraRef,
    targetDistance = 2,
    duration = 1500
  } = params;

  if (isAnimatingCameraRef.current) {
    return; // Don't start if already animating
  }

  // 3D coords conversion
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180;
  
  const x = targetDistance * Math.cos(lat) * Math.cos(lon);
  const y = targetDistance * Math.sin(lat);
  const z = targetDistance * Math.cos(lat) * Math.sin(-lon);

  isAnimatingCameraRef.current = true;
  controls.enabled = false;

  const startTime = Date.now();
  const startPosition = camera.position.clone();
  const targetPosition = new THREE.Vector3(x, y, z);
  
  // Surface point at user's location
  const surfacePoint = targetPosition.clone().normalize();
  
  // Start and target for controls (keep orbiting around Earth center)
  const startControlsTarget = controls.target.clone();
  const targetControlsTarget = new THREE.Vector3(0, 0, 0);

  const animateCamera = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Smooth easing function
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
    controls.target.lerpVectors(startControlsTarget, targetControlsTarget, easeProgress);
    camera.lookAt(controls.target);

    if (progress < 1) {
      requestAnimationFrame(animateCamera);
    } else {
      isAnimatingCameraRef.current = false;
      controls.enabled = true;
      controls.update();
    }
  };

  animateCamera();
}
