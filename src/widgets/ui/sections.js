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

  const RESULT_ROW_HEIGHT_PX = 36;
  const RESULT_OVERSCAN_ROWS = 8;

  const { container, contentArea } = createWidget('Satellite Search');
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'sidebar-search';
  searchInput.placeholder = 'Search satellites...';

  const resultsList = document.createElement('div');
  resultsList.className = 'sidebar-search-results';
  resultsList.style.maxHeight = '300px';
  resultsList.style.overflowY = 'auto';
  resultsList.style.overscrollBehavior = 'contain';
  resultsList.style.webkitOverflowScrolling = 'touch';
  resultsList.style.touchAction = 'pan-y';
  resultsList.style.marginTop = '10px';
  resultsList.style.position = 'relative';
  resultsList.style.border = '1px solid rgba(24, 245, 255, 0.16)';
  resultsList.style.borderRadius = '8px';
  resultsList.style.background = 'rgba(8, 20, 40, 0.35)';
  resultsList.style.display = 'none';

  const virtualSpacer = document.createElement('div');
  const virtualContent = document.createElement('div');
  virtualContent.style.position = 'absolute';
  virtualContent.style.left = '0';
  virtualContent.style.right = '0';
  virtualContent.style.top = '0';
  virtualContent.style.willChange = 'transform';
  resultsList.append(virtualSpacer, virtualContent);

  let entriesCache = [];
  let entriesCacheKey = '';
  let visibleEntries = [];
  let renderRafId = 0;
  let touchStartY = 0;
  let touchMoved = false;

  function getEntriesCacheKey() {
    if (!satelliteData || !satelliteData.activeSatellites || !satelliteData.satelliteDataMap) {
      return '';
    }
    const { activeSatellites } = satelliteData;
    const midIndex = Math.floor(activeSatellites.length / 2);
    const q1Index = Math.floor(activeSatellites.length / 4);
    const q3Index = Math.floor(activeSatellites.length * 0.75);
    const firstId = activeSatellites[0]?.id || '';
    const q1Id = activeSatellites[q1Index]?.id || '';
    const midId = activeSatellites[midIndex]?.id || '';
    const q3Id = activeSatellites[q3Index]?.id || '';
    const lastId = activeSatellites[activeSatellites.length - 1]?.id || '';
    return `${activeSatellites.length}:${firstId}:${q1Id}:${midId}:${q3Id}:${lastId}`;
  }

  function getAllEntries() {
    if (!satelliteData || !satelliteData.activeSatellites || !satelliteData.satelliteDataMap) {
      return null;
    }

    const cacheKey = getEntriesCacheKey();
    if (cacheKey && cacheKey === entriesCacheKey && entriesCache.length > 0) {
      return entriesCache;
    }

    const builtEntries = [];
    for (let i = 0; i < satelliteData.activeSatellites.length; i += 1) {
      const sat = satelliteData.activeSatellites[i];
      const satData = satelliteData.satelliteDataMap[sat.id];
      if (!satData || !satData.OBJECT_NAME) {
        continue;
      }

      const objectName = satData.OBJECT_NAME;
      builtEntries.push({
        sat,
        objectName,
        objectNameLower: objectName.toLowerCase(),
      });
    }

    builtEntries.sort((a, b) => a.objectName.localeCompare(b.objectName));
    entriesCache = builtEntries;
    entriesCacheKey = cacheKey;
    return entriesCache;
  }

  function setResultsVisible(visible) {
    resultsList.style.display = visible ? 'block' : 'none';
  }

  function renderMessage(text, italic = false) {
    setResultsVisible(true);
    virtualSpacer.style.height = '0px';
    virtualContent.style.transform = 'translateY(0)';
    virtualContent.innerHTML = '';
    const message = document.createElement('p');
    message.textContent = text;
    message.style.margin = '8px 10px';
    message.style.color = 'rgba(109, 216, 255, 0.7)';
    if (italic) {
      message.style.fontStyle = 'italic';
    }
    virtualContent.appendChild(message);
  }

  function renderVisibleRows() {
    renderRafId = 0;

    const total = visibleEntries.length;
    if (total === 0) {
      renderMessage('No satellites found', true);
      return;
    }

    const viewportHeight = resultsList.clientHeight || 300;
    const scrollTop = resultsList.scrollTop;
    const start = Math.max(0, Math.floor(scrollTop / RESULT_ROW_HEIGHT_PX) - RESULT_OVERSCAN_ROWS);
    const end = Math.min(
      total,
      Math.ceil((scrollTop + viewportHeight) / RESULT_ROW_HEIGHT_PX) + RESULT_OVERSCAN_ROWS
    );

    virtualSpacer.style.height = `${total * RESULT_ROW_HEIGHT_PX}px`;
    virtualContent.style.transform = `translateY(${start * RESULT_ROW_HEIGHT_PX}px)`;
    virtualContent.innerHTML = '';

    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i += 1) {
      const entry = visibleEntries[i];
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'sidebar-search-result-item';
      item.dataset.index = String(i);
      item.style.display = 'block';
      item.style.width = '100%';
      item.style.height = `${RESULT_ROW_HEIGHT_PX}px`;
      item.style.padding = '8px 12px';
      item.style.border = 'none';
      item.style.borderBottom = '1px solid rgba(24, 245, 255, 0.18)';
      item.style.background = 'transparent';
      item.style.color = '#6dd8ff';
      item.style.cursor = 'pointer';
      item.style.textAlign = 'left';
      item.style.transition = 'background 0.15s ease';
      item.style.whiteSpace = 'nowrap';
      item.style.overflow = 'hidden';
      item.style.textOverflow = 'ellipsis';
      item.textContent = entry.objectName;
      fragment.appendChild(item);
    }

    virtualContent.appendChild(fragment);
  }

  function scheduleRender() {
    if (renderRafId) {
      return;
    }
    renderRafId = requestAnimationFrame(renderVisibleRows);
  }

  function applyQuery(queryValue) {
    const allEntries = getAllEntries();
    if (!allEntries) {
      renderMessage('Loading satellites...');
      return;
    }

    setResultsVisible(true);
    const normalized = queryValue.trim().toLowerCase();
    if (!normalized) {
      visibleEntries = allEntries;
    } else {
      visibleEntries = allEntries.filter((entry) => entry.objectNameLower.startsWith(normalized));
    }

    resultsList.scrollTop = 0;
    scheduleRender();
  }

  function clearResults() {
    visibleEntries = [];
    setResultsVisible(false);
    virtualSpacer.style.height = '0px';
    virtualContent.style.transform = 'translateY(0)';
    virtualContent.innerHTML = '';
  }

  function onSelectEntry(index) {
    const entry = visibleEntries[index];
    if (!entry) {
      return;
    }

    searchInput.value = '';
    clearResults();
    if (onSelectSatellite) {
      onSelectSatellite(entry.sat);
    }
  }

  resultsList.addEventListener('scroll', scheduleRender);

  resultsList.addEventListener('touchstart', (event) => {
    const touch = event.touches && event.touches[0];
    touchStartY = touch ? touch.clientY : 0;
    touchMoved = false;
  }, { passive: true });

  resultsList.addEventListener('touchmove', (event) => {
    const touch = event.touches && event.touches[0];
    if (!touch) {
      return;
    }
    if (Math.abs(touch.clientY - touchStartY) > 7) {
      touchMoved = true;
    }
  }, { passive: true });

  virtualContent.addEventListener('click', (event) => {
    if (touchMoved) {
      return;
    }
    const target = event.target.closest('.sidebar-search-result-item');
    if (!target || !target.dataset.index) {
      return;
    }
    const index = Number(target.dataset.index);
    if (Number.isInteger(index) && index >= 0) {
      onSelectEntry(index);
    }
  });

  searchInput.addEventListener('focus', () => {
    applyQuery(searchInput.value);
  });
  searchInput.addEventListener('input', () => {
    applyQuery(searchInput.value);
  });
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      searchInput.value = '';
      clearResults();
      searchInput.blur();
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (!container.contains(event.target)) {
      clearResults();
    }
  });

  contentArea.append(searchInput, resultsList);
  sidebarContent.appendChild(container);
}

export function mountSatelliteSettingsSection({
  sidebarContent,
  createWidget,
  initialLimit,
  onLimitChange,
  initialTextSpeed,
  onTextSpeedChange
}) {
  if (!sidebarContent) return;

  const { container, contentArea } = createWidget('Satellite Settings');

  const row = document.createElement('div');
  row.className = 'sidebar-field-row';

  const label = document.createElement('label');
  label.className = 'sidebar-field-label';
  label.textContent = 'Render Limit:';
  label.htmlFor = 'satellite-render-limit-input';

  const input = document.createElement('input');
  input.id = 'satellite-render-limit-input';
  input.className = 'sidebar-field-input sidebar-field-input--compact';
  input.type = 'number';
  input.min = '10';
  input.max = '20000';
  input.step = '500';
  input.value = initialLimit || 1000;
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', 'Render limit');

  input.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && onLimitChange) {
      onLimitChange(val);
    }
  });

  row.appendChild(label);
  row.appendChild(input);
  contentArea.appendChild(row);

  const speedRow = document.createElement('div');
  speedRow.className = 'sidebar-field-row';

  const speedLabel = document.createElement('label');
  speedLabel.className = 'sidebar-field-label';
  speedLabel.textContent = 'Text Speed:';
  speedLabel.htmlFor = 'satellite-text-speed-select';

  const speedSelect = document.createElement('select');
  speedSelect.id = 'satellite-text-speed-select';
  speedSelect.className = 'sidebar-field-input';

  const speedOptions = [
    { value: 'normal', label: 'Normal' },
    { value: 'fast', label: 'Fast' },
    { value: 'disabled', label: 'Disable' },
  ];

  speedOptions.forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.label;
    if (option.value === (initialTextSpeed || 'normal')) {
      opt.selected = true;
    }
    speedSelect.appendChild(opt);
  });

  speedSelect.addEventListener('change', (e) => {
    if (onTextSpeedChange) {
      onTextSpeedChange(e.target.value);
    }
  });

  speedRow.appendChild(speedLabel);
  speedRow.appendChild(speedSelect);
  contentArea.appendChild(speedRow);
  sidebarContent.appendChild(container);
}

export function mountEnvironmentLayersSection({ sidebarContent, createWidget, environmentLayers }) {
  // We added stormGroup to the destructured object here
  const { cloudLayer, atmosphereLayer, stormGroup } = environmentLayers || {};
  if (!sidebarContent) {
    return;
  }

  const { container, contentArea } = createWidget('Environment Layers');
  contentArea.appendChild(createLayerToggle('Clouds', cloudLayer));
  contentArea.appendChild(createLayerToggle('Atmosphere', atmosphereLayer));
  
  // This line hooks up the Severe Weather UI toggle to the 3D storm group
  contentArea.appendChild(createLayerToggle('Severe Weather', stormGroup)); 
  
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

/**
 * Mounts the Playback Control section under the Top Bar
 */
export function mountPlaybackSection({ onMultiplierChange, onJumpToPresent }) {
  const DEFAULT_MULTIPLIER = 1;
  const MIN_MULTIPLIER = -20;
  const MAX_MULTIPLIER = 20;

  const wrapper = document.createElement('div');
  wrapper.id = 'top-playback-controls';
  wrapper.className = 'playback-panel';
  wrapper.setAttribute('data-collapsed', 'false');

  function preventPlaybackPinchZoom(event) {
    if (event.touches && event.touches.length > 1) {
      event.preventDefault();
    }
  }

  if (window.matchMedia('(pointer: coarse)').matches) {
    // Keep one-finger slider/scroll gestures, but block two-finger pinch zoom on this panel.
    wrapper.addEventListener('touchstart', preventPlaybackPinchZoom, { passive: false });
    wrapper.addEventListener('touchmove', preventPlaybackPinchZoom, { passive: false });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((eventName) => {
      wrapper.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
    });
  }

  const topRow = document.createElement('div');
  topRow.className = 'playback-top-row';

  const clockContainer = document.createElement('div');
  clockContainer.className = 'playback-clock';

  const clockTime = document.createElement('div');
  clockTime.className = 'playback-clock__time';

  const clockDate = document.createElement('div');
  clockDate.className = 'playback-clock__date';

  clockContainer.append(clockTime, clockDate);

  const collapseButton = document.createElement('button');
  collapseButton.type = 'button';
  collapseButton.className = 'playback-collapse-toggle';
  collapseButton.setAttribute('aria-label', 'Collapse time controls');
  collapseButton.setAttribute('aria-expanded', 'true');
  collapseButton.title = 'Collapse time controls';
  collapseButton.textContent = '-';

  topRow.append(clockContainer, collapseButton);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(MIN_MULTIPLIER);
  slider.max = String(MAX_MULTIPLIER);
  slider.step = '0.1';
  slider.value = String(DEFAULT_MULTIPLIER);
  slider.className = 'playback-slider';
  slider.setAttribute('aria-label', 'Time speed multiplier');

  const metaRow = document.createElement('div');
  metaRow.className = 'playback-meta';

  const speedLabel = document.createElement('span');
  speedLabel.className = 'playback-meta__label';
  speedLabel.textContent = 'Speed';

  const speedValue = document.createElement('span');
  speedValue.className = 'playback-meta__speed';

  metaRow.append(speedLabel, speedValue);

  const btnContainer = document.createElement('div');
  btnContainer.className = 'playback-buttons';
  const controlsBody = document.createElement('div');
  controlsBody.className = 'playback-content';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = '1x';
  resetBtn.className = 'playback-button';

  const jumpBtn = document.createElement('button');
  jumpBtn.type = 'button';
  jumpBtn.textContent = 'Jump to Now';
  jumpBtn.className = 'playback-button playback-button--primary';

  function formatMultiplier(value) {
    const rounded = Math.round(value * 10) / 10;
    if (Math.abs(rounded) < 0.05) {
      return '0';
    }
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function syncSpeedUI(rawValue) {
    const value = Number.parseFloat(rawValue);
    const min = Number.parseFloat(slider.min);
    const max = Number.parseFloat(slider.max);
    const progress = ((value - min) / (max - min)) * 100;
    slider.style.setProperty('--playback-progress', `${progress}%`);
    speedValue.textContent = `${formatMultiplier(value)}x`;
    return value;
  }

  function emitMultiplier() {
    onMultiplierChange(syncSpeedUI(slider.value));
  }

  function setCollapsed(collapsed) {
    const isCollapsed = Boolean(collapsed);
    wrapper.classList.toggle('is-collapsed', isCollapsed);
    wrapper.setAttribute('data-collapsed', String(isCollapsed));
    collapseButton.setAttribute('aria-expanded', String(!isCollapsed));
    collapseButton.title = isCollapsed ? 'Expand time controls' : 'Collapse time controls';
    collapseButton.textContent = isCollapsed ? '+' : '-';
  }

  // Event Listeners
  slider.addEventListener('input', emitMultiplier);
  slider.addEventListener('change', emitMultiplier);
  collapseButton.addEventListener('click', () => {
    setCollapsed(!wrapper.classList.contains('is-collapsed'));
  });
  resetBtn.addEventListener('click', () => {
    slider.value = String(DEFAULT_MULTIPLIER);
    emitMultiplier();
  });
  jumpBtn.addEventListener('click', () => onJumpToPresent());

  syncSpeedUI(slider.value);
  btnContainer.append(resetBtn, jumpBtn);
  controlsBody.append(metaRow, slider, btnContainer);
  wrapper.append(topRow, controlsBody);
  const isMobileViewport = window.matchMedia('(max-width: 680px)').matches;
  setCollapsed(isMobileViewport);

  return {
    element: wrapper,
    updateClock: (ts) => {
      const date = new Date(ts);
      clockTime.textContent = date.toLocaleTimeString('en-GB');
      clockDate.textContent = date.toLocaleDateString('en-GB');
    },
    setSlider: (val) => {
      slider.value = String(val);
      syncSpeedUI(slider.value);
    }
  };
}
