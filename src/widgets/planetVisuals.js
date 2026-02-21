import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createPlanetDeformation } from './planetDeformation.js';

export function setupPlanetVisuals({ scene, camera, renderer }) {
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

  function applyPostFxMode(mode) {
    activePostFxMode = mode;

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
  applyPostFxMode(activePostFxMode);

  function cyclePostFxMode() {
    postFxModeIndex = (postFxModeIndex + 1) % POST_FX_MODES.length;
    applyPostFxMode(POST_FX_MODES[postFxModeIndex]);
    return activePostFxMode;
  }

  function getActivePostFxMode() {
    return activePostFxMode;
  }

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

  const cloudColorMap = loader.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/fair_clouds_4k.png');
  cloudColorMap.colorSpace = THREE.SRGBColorSpace;
  cloudColorMap.anisotropy = maxAnisotropy;

  const cloudAlphaMap = loader.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/fair_clouds_4k.png');
  cloudAlphaMap.colorSpace = THREE.NoColorSpace;
  cloudAlphaMap.anisotropy = maxAnisotropy;

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
    shader.uniforms.crustLayerColor = { value: new THREE.Color(0x635746) };
    shader.uniforms.upperMantleLayerColor = { value: new THREE.Color(0x4d402d) };
    shader.uniforms.lowerMantleLayerColor = { value: new THREE.Color(0x3b3127) };
    shader.uniforms.coreLayerColor = { value: new THREE.Color(0x2f2622) };
    shader.uniforms.damageDepthScale = { value: 0.22 };
    shader.uniforms.surfaceRadius = { value: 1.0 };

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vDamageLocalPosition;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vDamageLocalPosition = position;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vDamageLocalPosition;
      uniform vec3 crustLayerColor;
      uniform vec3 upperMantleLayerColor;
      uniform vec3 lowerMantleLayerColor;
      uniform vec3 coreLayerColor;
      uniform float damageDepthScale;
      uniform float surfaceRadius;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      float damageDepth = max(0.0, surfaceRadius - length(vDamageLocalPosition));
      float damageDepthT = clamp(damageDepth / damageDepthScale, 0.0, 1.0);
      float damageExposure = smoothstep(0.014, 0.072, damageDepth);

      vec3 layerColor = crustLayerColor;
      layerColor = mix(layerColor, upperMantleLayerColor, smoothstep(0.22, 0.46, damageDepthT));
      layerColor = mix(layerColor, lowerMantleLayerColor, smoothstep(0.46, 0.78, damageDepthT));
      layerColor = mix(layerColor, coreLayerColor, smoothstep(0.78, 1.0, damageDepthT));

      diffuseColor.rgb = mix(diffuseColor.rgb, layerColor, damageExposure);
      diffuseColor.rgb *= mix(1.0, 0.84, damageExposure);`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float roughnessFactor = roughness;
      #ifdef USE_ROUGHNESSMAP
        vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
        roughnessFactor *= clamp(1.0 - texelRoughness.g, 0.4, 1.0);
      #endif
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      #if NUM_DIR_LIGHTS > 0
        float sunNdotL = dot(normal, directionalLights[0].direction);
        float nightMask = 1.0 - smoothstep(-0.30, 0.18, sunNdotL);
        totalEmissiveRadiance *= nightMask * (1.0 - damageExposure);

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
        float cloudSunsetBand =
          smoothstep(-0.40, -0.06, sunNdotL) *
          (1.0 - smoothstep(0.06, 0.30, sunNdotL));
        vec3 cloudSunsetColor = vec3(0.46, 0.31, 0.22);
        totalEmissiveRadiance += cloudSunsetColor * cloudSunsetBand * 0.02;
      #endif`
    );
  };
  scene.add(cloudLayer);
  const planetDeformation = createPlanetDeformation({ globe, cloudLayer });

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

  const atmosphereLayer = new THREE.Mesh(
    new THREE.SphereGeometry(1.022, 128, 128),
    new THREE.ShaderMaterial({
      uniforms: atmosphereUniforms,
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;

        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
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
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    })
  );
  scene.add(atmosphereLayer);

  const starCount = 2000;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) {
    starPositions[i] = (Math.random() - 0.5) * 200;
  }

  // Use a soft circular sprite so stars render as glows, not square pixels.
  const starSpriteCanvas = document.createElement('canvas');
  starSpriteCanvas.width = 64;
  starSpriteCanvas.height = 64;
  const starSpriteContext = starSpriteCanvas.getContext('2d');

  if (starSpriteContext) {
    const center = starSpriteCanvas.width / 2;
    const gradient = starSpriteContext.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.45)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    starSpriteContext.fillStyle = gradient;
    starSpriteContext.fillRect(0, 0, starSpriteCanvas.width, starSpriteCanvas.height);
  }

  const starSpriteTexture = new THREE.CanvasTexture(starSpriteCanvas);
  starSpriteTexture.colorSpace = THREE.SRGBColorSpace;
  starSpriteTexture.generateMipmaps = true;
  starSpriteTexture.minFilter = THREE.LinearMipMapLinearFilter;
  starSpriteTexture.magFilter = THREE.LinearFilter;

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.17,
      map: starSpriteTexture,
      alphaMap: starSpriteTexture,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  scene.add(stars);

  scene.add(new THREE.HemisphereLight(0x8fb8ff, 0x1f120a, 0.05));

  const sunLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sunLight.position.set(5, 3, 5);
  scene.add(sunLight);

  const moonLight = new THREE.DirectionalLight(0xb9cfff, 0.12);
  moonLight.position.copy(sunLight.position).multiplyScalar(-1);
  scene.add(moonLight);

  const rimLight = new THREE.DirectionalLight(0x9fc9ff, 0.08);
  rimLight.position.set(-4, -2, -3);
  scene.add(rimLight);

  const sunDirectionScene = new THREE.Vector3();
  const SUN_LIGHT_DISTANCE = 8;

  // Keeps illumination aligned with real UTC time.
  function updateRealTimeSun(date = new Date()) {
    const julianDay = satellite.jday(date);
    const { rsun } = satellite.sunPos(julianDay);
    const gmst = satellite.gstime(date);
    const sunEcf = satellite.eciToEcf(
      { x: rsun[0], y: rsun[1], z: rsun[2] },
      gmst
    );

    // Scene axes differ from ECF: X->X, Z->Y, -Y->Z.
    sunDirectionScene.set(sunEcf.x, sunEcf.z, -sunEcf.y);
    if (sunDirectionScene.lengthSq() < 1e-12) {
      return;
    }

    sunDirectionScene.normalize();
    sunLight.position.copy(sunDirectionScene).multiplyScalar(SUN_LIGHT_DISTANCE);
    moonLight.position.copy(sunDirectionScene).multiplyScalar(-SUN_LIGHT_DISTANCE * 0.95);
  }

  const atmosphereSunDirection = new THREE.Vector3();
  function updateAtmosphereSunDirection() {
    atmosphereSunDirection.copy(sunLight.position).normalize();
    atmosphereUniforms.sunDirection.value.copy(atmosphereSunDirection);
  }
  updateRealTimeSun();
  updateAtmosphereSunDirection();

  function update() {
    cloudLayer.rotation.y += 0.00008;
    updateRealTimeSun();
    planetDeformation.update();
    updateAtmosphereSunDirection();
  }

  function render() {
    if (activePostFxMode.usePostProcessing) {
      composer.render();
      return;
    }
    renderer.render(scene, camera);
  }

  function onResize(width, height) {
    composer.setSize(width, height);
    if (activePostFxMode.usePostProcessing) {
      bloomPass.setSize(
        width * activePostFxMode.bloomResolutionScale,
        height * activePostFxMode.bloomResolutionScale
      );
    }
  }

  return {
    applyImpactDamage: planetDeformation.applyImpactDamage,
    globe,
    cloudLayer,
    atmosphereLayer,
    cyclePostFxMode,
    getActivePostFxMode,
    update,
    render,
    onResize,
  };
}
