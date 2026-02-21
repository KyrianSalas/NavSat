export function createLayerToggle(labelText, layerMesh) {
  const toggleRow = document.createElement('label');
  toggleRow.className = 'sidebar-switch';

  const label = document.createElement('span');
  label.textContent = labelText;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'sidebar-switch__input';
  checkbox.checked = Boolean(layerMesh && layerMesh.visible);
  checkbox.addEventListener('change', () => {
    if (layerMesh) {
      layerMesh.visible = checkbox.checked;
    }
  });

  const slider = document.createElement('span');
  slider.className = 'sidebar-switch__slider';

  toggleRow.append(label, checkbox, slider);
  return toggleRow;
}

export function mountSatelliteSearchSection({ sidebarContent, createWidget, satelliteData, onSelectSatellite }) {
  if (!sidebarContent) {
    return;
  }

  const { container, contentArea } = createWidget('Satellite Search');
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'sidebar-search';
  searchInput.placeholder = 'Search satellites...';

  const resultsList = document.createElement('div');
  resultsList.className = 'sidebar-search-results';
  resultsList.style.maxHeight = '300px';
  resultsList.style.overflowY = 'auto';
  resultsList.style.marginTop = '10px';

  function updateResults() {
    const query = searchInput.value.toLowerCase();
    resultsList.innerHTML = '';

    if (!query.trim()) {
      return;
    }

    if (!satelliteData || !satelliteData.activeSatellites || !satelliteData.satelliteDataMap) {
      const noData = document.createElement('p');
      noData.style.color = 'rgba(109, 216, 255, 0.6)';
      noData.textContent = 'Loading satellites...';
      resultsList.appendChild(noData);
      return;
    }

    // Filter by prefix (starts with query)
    const filtered = satelliteData.activeSatellites.filter(sat => {
      const satData = satelliteData.satelliteDataMap[sat.id];
      return satData && satData.OBJECT_NAME.toLowerCase().startsWith(query);
    });

    if (filtered.length === 0) {
      const noResults = document.createElement('p');
      noResults.style.color = 'rgba(109, 216, 255, 0.6)';
      noResults.style.fontStyle = 'italic';
      noResults.textContent = 'No satellites found';
      resultsList.appendChild(noResults);
      return;
    }

    filtered.forEach(sat => {
      const satData = satelliteData.satelliteDataMap[sat.id];
      const item = document.createElement('div');
      item.className = 'sidebar-search-result-item';
      item.style.padding = '8px 12px';
      item.style.borderBottom = '1px solid rgba(24, 245, 255, 0.2)';
      item.style.color = '#6dd8ff';
      item.style.cursor = 'pointer';
      item.style.transition = 'background 0.15s ease';
      item.textContent = satData.OBJECT_NAME;
      
      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(24, 245, 255, 0.15)';
      });
      
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
      });
      
      item.addEventListener('click', () => {
        searchInput.value = '';
        resultsList.innerHTML = '';
        if (onSelectSatellite) {
          onSelectSatellite(sat);
        }
      });
      
      resultsList.appendChild(item);
    });
  }

  searchInput.addEventListener('input', updateResults);

  contentArea.append(searchInput, resultsList);
  sidebarContent.appendChild(container);
}

export function mountEnvironmentLayersSection({ sidebarContent, createWidget, environmentLayers }) {
  const { cloudLayer, atmosphereLayer } = environmentLayers || {};
  if (!sidebarContent) {
    return;
  }

  const { container, contentArea } = createWidget('Environment Layers');
  contentArea.appendChild(createLayerToggle('Clouds', cloudLayer));
  contentArea.appendChild(createLayerToggle('Atmosphere', atmosphereLayer));
  sidebarContent.appendChild(container);
}

export function mountFooterControlsSection({
  sidebar,
  postProcessing,
  centerLocationButton,
  onResetCameraView,
}) {
  const { cycleMode, getActiveMode } = postProcessing || {};
  if (!sidebar) {
    return;
  }

  const footer = document.createElement('div');
  footer.className = 'sidebar-footer';
  const leftControls = document.createElement('div');
  leftControls.className = 'sidebar-footer-left';

  if (cycleMode && getActiveMode) {
    const postFxButton = document.createElement('button');
    postFxButton.type = 'button';
    postFxButton.className = 'sidebar-postfx-button';

    const syncLabel = () => {
      const activeMode = getActiveMode();
      postFxButton.textContent = `FX ${activeMode.label}`;
    };

    postFxButton.addEventListener('click', () => {
      cycleMode();
      syncLabel();
    });

    syncLabel();
    leftControls.appendChild(postFxButton);
  }

  if (typeof onResetCameraView === 'function') {
    const resetViewButton = document.createElement('button');
    resetViewButton.type = 'button';
    resetViewButton.className = 'sidebar-reset-button';
    resetViewButton.textContent = 'Reset View';
    resetViewButton.addEventListener('click', () => {
      onResetCameraView();
    });
    leftControls.appendChild(resetViewButton);
  }

  if (leftControls.childElementCount > 0) {
    footer.appendChild(leftControls);
  }

  const locationButton = centerLocationButton || document.getElementById('centerLocationButton');
  if (locationButton) {
    footer.appendChild(locationButton);
  }

  sidebar.appendChild(footer);
}
