// src/widgets/uiManager.js

import { SIDEBAR_ID } from './ui/constants.js';
import { ensureSidebarStyles } from './ui/styles.js';
import { createWidget as makeWidget } from './ui/widgetFactory.js';
import { createSidebarShell } from './ui/sidebarShell.js';
import { setupGroupSelector } from './groupSelector.js';
import {
  mountEnvironmentLayersSection,
  mountFooterControlsSection,
  mountSatelliteSearchSection,
  mountSatelliteSettingsSection
} from './ui/sections.js';

export class UIManager {
  constructor({ 
    postProcessing, 
    environmentLayers, 
    centerLocationButton, 
    onResetCameraView, 
    satelliteData, 
    onSelectSatellite,
    satelliteLimit,
    onLimitChange,
    textSpeed,
    onTextSpeedChange
  }) {
    this.postProcessing = postProcessing;
    this.environmentLayers = environmentLayers;
    this.centerLocationButton = centerLocationButton;
    this.onResetCameraView = onResetCameraView;
    this.satelliteData = satelliteData;
    this.onSelectSatellite = onSelectSatellite;
    
    this.satelliteLimit = satelliteLimit;
    this.onLimitChange = onLimitChange;
    this.textSpeed = textSpeed;
    this.onTextSpeedChange = onTextSpeedChange;

    this.sidebar = null;
    this.sidebarContent = null;
    this.collapseButton = null;
    this.sidebarShell = null;
    this.isCollapsed = false;
  }

  createWidget(title) {
    return makeWidget(title);
  }

  createSidebarContainer() {
    this.sidebarShell = createSidebarShell({
      sidebarId: SIDEBAR_ID,
      initialCollapsed: true,
      onToggleCollapsed: (collapsed) => {
        this.isCollapsed = collapsed;
      },
    });

    this.sidebar = this.sidebarShell.sidebar;
    this.sidebarContent = this.sidebarShell.sidebarContent;
    this.collapseButton = this.sidebarShell.collapseButton;
    this.isCollapsed = this.sidebarShell.isCollapsed();
  }

  setCollapsed(collapsed) {
    if (!this.sidebarShell) {
      return;
    }

    this.sidebarShell.setCollapsed(collapsed);
    this.isCollapsed = this.sidebarShell.isCollapsed();
  }

  mountSatelliteSearchWidget() {
    mountSatelliteSearchSection({
      sidebarContent: this.sidebarContent,
      createWidget: (title) => this.createWidget(title),
      satelliteData: this.satelliteData,
      onSelectSatellite: this.onSelectSatellite,
    });
  }

  // New method for rendering the limit input widget
  mountSatelliteSettingsWidget() {
    mountSatelliteSettingsSection({
      sidebarContent: this.sidebarContent,
      createWidget: (title) => this.createWidget(title),
      initialLimit: this.satelliteLimit,
      onLimitChange: this.onLimitChange,
      initialTextSpeed: this.textSpeed,
      onTextSpeedChange: this.onTextSpeedChange,
    });
  }

  mountEnvironmentLayersWidget() {
    mountEnvironmentLayersSection({
      sidebarContent: this.sidebarContent,
      createWidget: (title) => this.createWidget(title),
      environmentLayers: this.environmentLayers,
    });
  }

  mountFooterControls() {
    mountFooterControlsSection({
      sidebar: this.sidebar,
      postProcessing: this.postProcessing,
      centerLocationButton: this.centerLocationButton,
      onResetCameraView: this.onResetCameraView,
    });
  }

  mount() {
    ensureSidebarStyles();
    this.createSidebarContainer();
    
    // Mount widgets in the desired visual order
    this.mountSatelliteSearchWidget();
    this.mountSatelliteSettingsWidget(); 
    this.mountEnvironmentLayersWidget();
    this.mountFooterControls();
  }
}

export function setupSidebar(config) {
  const uiManager = new UIManager(config);
  uiManager.mount();
  return uiManager;
}