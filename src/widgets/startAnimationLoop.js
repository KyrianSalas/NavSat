import { updateSatellites } from './updateSatellites.js';
import { updateSatelliteCallout } from './updateCallouts.js';

export function startAnimationLoop(params) {
    const {
        renderer,
        activeSatellites,
        TRAIL_POINTS,
        TRAIL_LENGTH_MINUTES,
        planetVisuals,
        selectedSatelliteRef,
        isAnimatingCameraRef,
        infoBox,
        calloutLayout,
        projectedSatelliteScreen,
        camera,
        calloutTyping,
        infoTitle,
        satelliteDetails,
        measureCalloutTitleWidth,
        calloutReveal,
        infoCard,
        infoConnectorPath,
        infoConnectorStart,
        controls
    } = params;

    renderer.setAnimationLoop(() => {
        updateSatellites({ activeSatellites, TRAIL_POINTS, TRAIL_LENGTH_MINUTES });
        planetVisuals.update();
        updateSatelliteCallout({
            selectedSatellite: selectedSatelliteRef.current,
            isAnimatingCamera: isAnimatingCameraRef.current,
            infoBox,
            calloutLayout,
            projectedSatelliteScreen,
            camera,
            calloutTyping,
            infoTitle,
            satelliteDetails,
            measureCalloutTitleWidth,
            calloutReveal,
            infoCard,
            infoConnectorPath,
            infoConnectorStart
        });
        controls.update();
        planetVisuals.render();
    });
}
