import * as THREE from 'three';

export function createPlanetDeformation({ globe, cloudLayer }) {
  globe.geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
  cloudLayer.geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
  const baseRadiusByMesh = new WeakMap();

  function getBaseRadii(mesh) {
    let baseRadii = baseRadiusByMesh.get(mesh);
    if (baseRadii) {
      return baseRadii;
    }

    const positionArray = mesh.geometry.getAttribute('position').array;
    baseRadii = new Float32Array(positionArray.length / 3);
    for (let i = 0; i < baseRadii.length; i += 1) {
      const offset = i * 3;
      const x = positionArray[offset];
      const y = positionArray[offset + 1];
      const z = positionArray[offset + 2];
      baseRadii[i] = Math.sqrt((x * x) + (y * y) + (z * z));
    }

    baseRadiusByMesh.set(mesh, baseRadii);
    return baseRadii;
  }

  function applyDamageToMesh(mesh, centerDirection, {
    craterAngle,
    craterDepth,
    rimLift,
    pitAngle,
    pitDepth,
    minRadius,
    maxRadiusOffset,
    maxInwardStep,
    maxOutwardStep,
  }) {
    const geometry = mesh.geometry;
    const positionAttribute = geometry.getAttribute('position');
    const positionArray = positionAttribute.array;
    const vertexCount = positionAttribute.count;
    const baseRadii = getBaseRadii(mesh);

    const cosCrater = Math.cos(craterAngle);
    const hasPit = pitAngle > 0;
    const cosPit = hasPit ? Math.cos(pitAngle) : -2;
    const craterDenominator = Math.max(0.0001, 1 - cosCrater);
    const pitDenominator = Math.max(0.0001, 1 - cosPit);

    for (let i = 0; i < vertexCount; i += 1) {
      const offset = i * 3;
      const x = positionArray[offset];
      const y = positionArray[offset + 1];
      const z = positionArray[offset + 2];
      const currentRadius = Math.sqrt((x * x) + (y * y) + (z * z));
      if (currentRadius <= 0.00001) {
        continue;
      }
      const baseRadius = baseRadii[i];
      const maxRadius = baseRadius + maxRadiusOffset;
      const boundedCurrentRadius = THREE.MathUtils.clamp(currentRadius, minRadius, maxRadius);

      const nx = x / currentRadius;
      const ny = y / currentRadius;
      const nz = z / currentRadius;
      const dot = (nx * centerDirection.x) + (ny * centerDirection.y) + (nz * centerDirection.z);
      if (dot < cosCrater) {
        continue;
      }

      const craterT = THREE.MathUtils.clamp((dot - cosCrater) / craterDenominator, 0, 1);
      const bowl = craterDepth * Math.pow(craterT, 1.8);

      const rimCenter = 0.40;
      const rimWidth = 0.20;
      const rimT = (craterT - rimCenter) / rimWidth;
      const rim = rimLift * Math.exp(-(rimT * rimT));

      let desiredRadius = boundedCurrentRadius - bowl + rim;

      if (hasPit && dot > cosPit) {
        const pitT = THREE.MathUtils.clamp((dot - cosPit) / pitDenominator, 0, 1);
        desiredRadius -= pitDepth * Math.pow(pitT, 1.5);
      }

      desiredRadius = THREE.MathUtils.clamp(desiredRadius, minRadius, maxRadius);
      const radiusDelta = desiredRadius - boundedCurrentRadius;
      const clampedDelta = THREE.MathUtils.clamp(radiusDelta, -maxInwardStep, maxOutwardStep);
      const nextRadius = boundedCurrentRadius + clampedDelta;
      const scale = nextRadius / currentRadius;
      positionArray[offset] = x * scale;
      positionArray[offset + 1] = y * scale;
      positionArray[offset + 2] = z * scale;
    }

    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.getAttribute('normal').needsUpdate = true;
    geometry.computeBoundingSphere();
  }

  function applyImpactDamage(localImpactDirection) {
    const centerDirection = localImpactDirection.clone().normalize();

    applyDamageToMesh(globe, centerDirection, {
      craterAngle: 0.15,
      craterDepth: 0.058,
      rimLift: 0.012,
      pitAngle: 0.03,
      pitDepth: 0.026,
      minRadius: 0.80,
      maxRadiusOffset: 0.014,
      maxInwardStep: 0.05,
      maxOutwardStep: 0.004,
    });

    applyDamageToMesh(cloudLayer, centerDirection, {
      craterAngle: 0.16,
      craterDepth: 0.022,
      rimLift: 0.0,
      pitAngle: 0.034,
      pitDepth: 0.01,
      minRadius: 0.90,
      maxRadiusOffset: 0.005,
      maxInwardStep: 0.025,
      maxOutwardStep: 0.001,
    });
  }

  return {
    applyImpactDamage,
    update: () => {},
  };
}
