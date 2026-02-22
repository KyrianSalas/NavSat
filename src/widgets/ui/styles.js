import { SIDEBAR_ID, SIDEBAR_STYLE_ID } from './constants.js';

export function ensureSidebarStyles() {
  if (document.getElementById(SIDEBAR_STYLE_ID)) {
    return;
  }

  const styleTag = document.createElement('style');
  styleTag.id = SIDEBAR_STYLE_ID;
  styleTag.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Electrolize&display=swap');

    #${SIDEBAR_ID} {
      --panel-border: rgba(150, 194, 255, 0.22);
      --panel-text: #dceafe;
      --card-bg: linear-gradient(160deg, rgba(15, 25, 46, 0.88), rgba(10, 19, 35, 0.6));
      --card-border: rgba(162, 197, 255, 0.22);
      position: fixed;
      top: 0;
      right: 0;
      width: 320px;
      height: 100vh;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      padding: 14px;
      background: linear-gradient(180deg, rgba(6, 11, 23, 0.8), rgba(9, 16, 30, 0.58));
      border-left: 1px solid var(--panel-border);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: -12px 0 36px rgba(2, 6, 16, 0.35);
      z-index: 101;
      overflow-x: hidden;
      overflow-y: auto;
      touch-action: pan-y;
      transition: width 0.2s ease, padding 0.2s ease, background 0.2s ease;
    }

    #${SIDEBAR_ID}.is-collapsed {
      width: 0;
      height: 0;
      padding: 0;
      background: transparent;
      border-left: 0;
      box-shadow: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      overflow: visible;
    }

    .sidebar-topbar {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      margin-bottom: 10px;
    }

    #${SIDEBAR_ID}.is-collapsed .sidebar-topbar {
      position: fixed;
      top: 12px;
      right: 12px;
      transform: none;
      justify-content: center;
      margin-bottom: 0;
    }

    .sidebar-collapse-toggle {
      width: 30px;
      height: 30px;
      border-radius: 10px;
      border: 1px solid rgba(166, 211, 255, 0.46);
      background: rgba(12, 28, 54, 0.75);
      color: #d9ecff;
      font-size: 15px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, transform 0.18s ease;
    }

    .sidebar-collapse-toggle:hover {
      background: rgba(20, 45, 80, 0.9);
      border-color: rgba(200, 227, 255, 0.82);
    }

    .sidebar-content {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: visible;
      padding-right: 2px;
      transition: opacity 0.14s ease, transform 0.18s ease;
    }

    .sidebar-widget {
      border-radius: 16px;
      border: 1px solid var(--card-border);
      background: var(--card-bg);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.22);
      overflow: hidden;
    }

    .sidebar-widget__title {
      margin: 0;
      padding: 12px 14px 10px;
      color: var(--panel-text);
      font-family: "Electrolize", "Segoe UI", sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      border-bottom: 1px solid rgba(162, 197, 255, 0.28);
    }

    .sidebar-widget__content {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 14px 14px;
      color: #d7e8ff;
      font-family: "Electrolize", "Segoe UI", sans-serif;
      font-size: 13px;
    }

    .sidebar-search {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(174, 207, 255, 0.34);
      border-radius: 12px;
      background: rgba(6, 14, 28, 0.72);
      color: #e7f0ff;
      padding: 10px 12px;
      font-family: "Electrolize", "Segoe UI", sans-serif;
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .sidebar-search::placeholder {
      color: rgba(194, 216, 248, 0.6);
    }

    .sidebar-search:focus {
      border-color: rgba(124, 184, 255, 0.92);
      box-shadow: 0 0 0 3px rgba(88, 152, 232, 0.16);
    }

    .sidebar-search-result-item {
      font-family: "Electrolize", "Segoe UI", sans-serif !important;
      font-size: 13px;
      letter-spacing: 0.01em;
    }

    .sidebar-search-result-item:hover {
      background: rgba(24, 245, 255, 0.12) !important;
    }

    .sidebar-search-result-item:focus-visible {
      outline: none;
      background: rgba(24, 245, 255, 0.12) !important;
    }

    .sidebar-search-results {
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      touch-action: pan-y;
    }

    .sidebar-hint {
      margin: 0;
      color: rgba(193, 214, 243, 0.68);
      font-size: 11px;
      letter-spacing: 0.02em;
    }

    .sidebar-switch {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 10px;
      color: #e4f0ff;
      font-weight: 600;
    }

    .sidebar-switch__input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .sidebar-switch__slider {
      width: 38px;
      height: 22px;
      border-radius: 999px;
      background: rgba(58, 78, 108, 0.95);
      border: 1px solid rgba(158, 189, 237, 0.42);
      position: relative;
      transition: background 0.18s ease, border-color 0.18s ease;
    }

    .sidebar-switch__slider::after {
      content: "";
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #f2f7ff;
      position: absolute;
      top: 2px;
      left: 2px;
      transition: transform 0.18s ease;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
    }

    .sidebar-switch__input:checked + .sidebar-switch__slider {
      background: rgba(69, 123, 214, 0.85);
      border-color: rgba(166, 213, 255, 0.85);
    }

    .sidebar-switch__input:checked + .sidebar-switch__slider::after {
      transform: translateX(16px);
    }

    .sidebar-field-row {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 12px;
      padding: 2px 0;
    }

    .sidebar-field-label {
      color: #e4f0ff;
      font-family: "Electrolize", "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .sidebar-field-input {
      box-sizing: border-box;
      border: 1px solid rgba(174, 207, 255, 0.34);
      border-radius: 12px;
      background: rgba(6, 14, 28, 0.72);
      color: #e7f0ff;
      padding: 8px 10px;
      font-family: "Electrolize", "Segoe UI", sans-serif;
      font-size: 13px;
      line-height: 1.2;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      font-variant-numeric: tabular-nums;
      text-align: right;
      -moz-appearance: textfield;
    }

    .sidebar-field-input::-webkit-outer-spin-button,
    .sidebar-field-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .sidebar-field-input:focus {
      border-color: rgba(124, 184, 255, 0.92);
      box-shadow: 0 0 0 3px rgba(88, 152, 232, 0.16);
    }

    .sidebar-field-input--compact {
      width: 112px;
    }

    .sidebar-footer {
      margin-top: 12px;
      border-top: 1px solid rgba(160, 193, 247, 0.22);
      padding-top: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      transition: opacity 0.14s ease, transform 0.18s ease;
    }

    .sidebar-footer-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    #${SIDEBAR_ID}.is-collapsed .sidebar-content,
    #${SIDEBAR_ID}.is-collapsed .sidebar-footer {
      display: none;
    }

    .sidebar-postfx-button {
      border: 1px solid rgba(166, 211, 255, 0.52);
      border-radius: 999px;
      background: rgba(12, 28, 54, 0.78);
      color: #e2efff;
      padding: 7px 11px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-family: "Electrolize", "Segoe UI", sans-serif;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }

    .sidebar-reset-button {
      border: 1px solid rgba(166, 211, 255, 0.52);
      border-radius: 999px;
      background: rgba(12, 28, 54, 0.78);
      color: #e2efff;
      padding: 7px 11px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-family: "Electrolize", "Segoe UI", sans-serif;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }

    .sidebar-postfx-button:hover {
      background: rgba(20, 45, 80, 0.9);
      border-color: rgba(200, 227, 255, 0.82);
    }

    .sidebar-reset-button:hover {
      background: rgba(20, 45, 80, 0.9);
      border-color: rgba(200, 227, 255, 0.82);
    }

    .tracked-group-widget {
      --panel-text: #dceafe;
      --card-bg: linear-gradient(160deg, rgba(15, 25, 46, 0.88), rgba(10, 19, 35, 0.6));
      --card-border: rgba(162, 197, 255, 0.22);
    }

    .tracked-group-widget__content {
      gap: 8px;
    }

    .tracked-group-widget__label {
      color: #e4f0ff;
      font-family: "Electrolize", "Segoe UI", sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .tracked-group-widget__select {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(174, 207, 255, 0.34);
      border-radius: 12px;
      background: rgba(6, 14, 28, 0.72);
      color: #e7f0ff;
      padding: 8px 10px;
      font-family: "Electrolize", "Segoe UI", sans-serif;
      font-size: 13px;
      outline: none;
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .tracked-group-widget__select:focus {
      border-color: rgba(124, 184, 255, 0.92);
      box-shadow: 0 0 0 3px rgba(88, 152, 232, 0.16);
    }

    .tracked-group-widget__select option {
      background: #081222;
      color: #e7f0ff;
    }

    #${SIDEBAR_ID} #centerLocationButton {
      position: static;
      inset: auto;
      width: 40px;
      height: 40px;
      margin-left: auto;
      border-radius: 12px;
      border: 1px solid rgba(173, 212, 255, 0.66);
      background: rgba(12, 32, 62, 0.84);
      color: #daf0ff;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.24);
      z-index: 0;
    }

    #${SIDEBAR_ID} #centerLocationButton:hover:enabled {
      background: rgba(18, 42, 78, 0.95);
      box-shadow: 0 10px 18px rgba(0, 0, 0, 0.3);
      transform: translateY(-1px);
    }

    #${SIDEBAR_ID} #centerLocationButton:active:enabled {
      transform: translateY(0);
    }

    #${SIDEBAR_ID} #centerLocationButton:disabled {
      background: rgba(56, 64, 76, 0.74);
      border-color: rgba(164, 174, 188, 0.5);
      color: rgba(213, 224, 236, 0.52);
      box-shadow: none;
      cursor: not-allowed;
    }

    #satelliteLegend {
      position: fixed;
      left: 14px;
      bottom: 18px;
      min-width: 190px;
      max-width: 250px;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(162, 197, 255, 0.3);
      background: linear-gradient(160deg, rgba(11, 21, 39, 0.92), rgba(7, 14, 28, 0.86));
      color: #e5f0ff;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
      font-family: "Electrolize", "Segoe UI", sans-serif;
      z-index: 90;
      pointer-events: auto;
      transition: min-width 0.18s ease, padding 0.18s ease;
    }

    #satelliteLegend.is-collapsed {
      min-width: 120px;
    }

    .satellite-legend__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }

    .satellite-legend__title {
      margin: 0;
      color: #18f5ff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .satellite-legend__toggle {
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(145, 196, 255, 0.6);
      border-radius: 4px;
      background: rgba(10, 24, 45, 0.85);
      color: #18f5ff;
      cursor: pointer;
      padding: 0;
      font-size: 11px;
      line-height: 1;
      font-family: "Electrolize", "Segoe UI", sans-serif;
    }

    .satellite-legend__toggle:hover {
      background: rgba(16, 35, 64, 0.95);
      border-color: rgba(170, 220, 255, 0.8);
    }

    .satellite-legend__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    #satelliteLegend.is-collapsed .satellite-legend__header {
      margin-bottom: 0;
    }

    #satelliteLegend.is-collapsed .satellite-legend__list {
      display: none;
    }

    .satellite-legend__item {
      display: flex;
      align-items: center;
      gap: 8px;
      line-height: 1.2;
      font-size: 11px;
      color: #e5f0ff;
    }

    .satellite-legend__swatch {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 1px solid rgba(220, 235, 255, 0.55);
      flex: 0 0 auto;
    }

    .satellite-legend__label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (max-width: 640px) {
      #${SIDEBAR_ID} {
        width: min(260px, 76vw);
        top: calc(env(safe-area-inset-top, 0px) + 8px);
        height: calc(100dvh - env(safe-area-inset-top, 0px) - 8px);
        max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 8px);
        padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px));
        overflow: hidden;
      }

      #${SIDEBAR_ID} .sidebar-content {
        flex: 1 1 auto;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }

      #${SIDEBAR_ID}.is-collapsed .sidebar-topbar {
        top: calc(env(safe-area-inset-top, 0px) + 10px);
        right: 10px;
        transform: none;
      }

      .sidebar-collapse-toggle {
        width: 26px;
        height: 26px;
        border-radius: 8px;
        font-size: 13px;
      }

      #${SIDEBAR_ID} #centerLocationButton {
        width: 34px;
        height: 34px;
        border-radius: 10px;
      }

      #satelliteLegend {
        left: 10px;
        bottom: 10px;
        min-width: 160px;
        max-width: min(210px, calc(100vw - 20px));
        padding: 8px 10px;
      }
    }
  `;

  document.head.appendChild(styleTag);
}

export function ensureTopBarStyles() {
  if (document.getElementById('topbar-style-id')) {
    return;
  }

  const styleTag = document.createElement('style');
  styleTag.id = 'topbar-style-id';
  styleTag.textContent = `
    #topBar {
      position: fixed;
      top: 10px;
      left: 12px;
      right: auto;
      height: auto;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      padding: 0;
      z-index: 50;
      background: transparent;
      border: 0;
      box-shadow: none;
      overflow: visible;
    }

    #topBar::after {
      content: none;
    }

    #topBar h1 {
      margin: 0;
      font-size: 22px;
      color: #18f5ff;
      font-weight: 700;
      font-family: Electrolize, 'Segoe UI', sans-serif;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      gap: 8px;
      position: relative;
      padding-bottom: 6px;
    }

    #topBar h1::after {
      content: "";
      position: absolute;
      left: 6px;
      width: 228%;
      bottom: 0;
      height: 3px;
      background: linear-gradient(to right, rgba(24, 245, 255, 0.7), rgba(24, 245, 255, 0));
      pointer-events: none;
    }

    #topBar a {
      color: #18f5ff;
      text-decoration: none;
      font-size: 14px;
      font-family: Electrolize, 'Segoe UI', sans-serif;
      margin-left: 24px;
      padding: 4px 8px;
      border-bottom: none;
      transition: color 0.2s ease, opacity 0.2s ease;
    }

    #topBar a:hover {
      opacity: 0.85;
    }

    #topBar a:focus-visible {
      outline: none;
      opacity: 0.85;
    }

    .header-logo {
      height: 30px;
      width: 30px;
    }

    canvas {
      display: block;
      margin-top: 0;
    }

    #top-playback-controls {
      position: absolute;
      top: 58px;
      left: 2px;
      z-index: 1000;
    }

    .playback-panel {
      width: min(248px, calc(100vw - 24px));
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 9px;
      border-radius: 10px;
      border: 1px solid rgba(154, 193, 245, 0.28);
      background: linear-gradient(160deg, rgba(13, 23, 42, 0.86), rgba(9, 17, 31, 0.62));
      box-shadow: 0 6px 14px rgba(2, 6, 16, 0.34);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      pointer-events: auto;
      font-family: "Electrolize", "Segoe UI", sans-serif;
    }

    .playback-panel.is-collapsed {
      gap: 0;
      padding-top: 7px;
      padding-bottom: 7px;
    }

    .playback-top-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }

    .playback-clock {
      text-align: left;
      color: #19f8ff;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.04em;
      min-width: 0;
      flex: 1;
    }

    .playback-clock__time {
      font-size: 1.12rem;
      line-height: 1.1;
      text-shadow: 0 0 6px rgba(26, 248, 255, 0.24);
    }

    .playback-clock__date {
      margin-top: 0;
      color: rgba(205, 224, 245, 0.58);
      font-size: 0.63rem;
      letter-spacing: 0.06em;
    }

    .playback-collapse-toggle {
      width: 20px;
      height: 20px;
      border-radius: 6px;
      border: 1px solid rgba(156, 200, 255, 0.52);
      background: rgba(11, 25, 48, 0.86);
      color: #bfeaff;
      padding: 0;
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s ease, border-color 0.15s ease;
    }

    .playback-collapse-toggle:hover {
      background: rgba(20, 45, 80, 0.9);
      border-color: rgba(200, 227, 255, 0.82);
    }

    .playback-collapse-toggle:focus-visible {
      outline: 2px solid rgba(123, 196, 255, 0.82);
      outline-offset: 1px;
    }

    .playback-content {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 1px;
      max-height: 120px;
      opacity: 1;
      overflow: hidden;
      transform: translateY(0) scaleY(1);
      transform-origin: top;
      will-change: transform, opacity;
      contain: layout paint;
      transition: transform 0.18s ease, opacity 0.14s ease;
    }

    .playback-panel.is-collapsed .playback-content {
      max-height: 0;
      opacity: 0;
      margin-top: 0;
      transform: translateY(-3px) scaleY(0.94);
      pointer-events: none;
    }

    .playback-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: rgba(207, 228, 251, 0.88);
      font-size: 0.58rem;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    .playback-meta__speed {
      color: #9fe8ff;
      font-size: 0.62rem;
    }

    .playback-slider {
      --playback-progress: 52.5%;
      width: 100%;
      margin: 1px 0;
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
      accent-color: #2c8eff;
      cursor: pointer;
    }

    .playback-slider:focus-visible {
      outline: none;
    }

    .playback-slider::-webkit-slider-runnable-track {
      height: 4px;
      border-radius: 999px;
      background:
        linear-gradient(
          90deg,
          #45a3ff 0%,
          #45a3ff var(--playback-progress),
          rgba(152, 174, 201, 0.38) var(--playback-progress),
          rgba(152, 174, 201, 0.38) 100%
        );
      border: 0;
    }

    .playback-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      margin-top: -5px;
      border-radius: 50%;
      border: 2px solid #45a3ff;
      background: #0d1a2d;
      box-shadow: none;
      transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }

    .playback-slider::-webkit-slider-thumb:hover {
      transform: scale(1.06);
      border-color: #74bdff;
      background: #13233b;
    }

    .playback-slider::-moz-range-track {
      height: 4px;
      border-radius: 999px;
      background: rgba(152, 174, 201, 0.38);
      border: 0;
    }

    .playback-slider::-moz-range-progress {
      height: 4px;
      border-radius: 999px;
      background: #45a3ff;
    }

    .playback-slider::-moz-range-thumb {
      width: 13px;
      height: 13px;
      border-radius: 50%;
      border: 2px solid #45a3ff;
      background: #0d1a2d;
      box-shadow: none;
      transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }

    .playback-buttons {
      display: grid;
      grid-template-columns: 50px 1fr;
      gap: 5px;
    }

    .playback-button {
      border: 1px solid rgba(166, 211, 255, 0.52);
      border-radius: 8px;
      background: rgba(12, 28, 54, 0.78);
      color: #e2efff;
      padding: 5px 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-family: "Electrolize", "Segoe UI", sans-serif;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
    }

    .playback-button--primary {
      border-color: rgba(129, 200, 255, 0.78);
      color: #bcecff;
      box-shadow: inset 0 0 14px rgba(30, 109, 185, 0.24);
    }

    .playback-button:hover {
      background: rgba(20, 45, 80, 0.9);
      border-color: rgba(200, 227, 255, 0.82);
    }

    .playback-button:active {
      transform: translateY(1px);
    }

    .playback-button:focus-visible {
      outline: 2px solid rgba(123, 196, 255, 0.82);
      outline-offset: 1px;
    }

    @media (max-width: 768px) {
      #top-playback-controls {
        position: fixed;
        top: auto;
        left: auto;
        right: 8px;
        bottom: 8px;
      }

      .playback-panel {
        width: min(190px, calc(100vw - 20px));
        padding: 6px 7px;
        gap: 4px;
        border-radius: 9px;
      }

      .playback-panel.is-collapsed {
        padding-top: 6px;
        padding-bottom: 6px;
      }

      .playback-clock__time {
        font-size: 0.95rem;
      }

      .playback-clock__date {
        font-size: 0.56rem;
      }

      .playback-collapse-toggle {
        width: 18px;
        height: 18px;
        border-radius: 5px;
        font-size: 11px;
      }
    }

    @media (hover: none) and (pointer: coarse) {
      .playback-content {
        gap: 8px;
      }

      .playback-slider {
        margin: 6px 0 10px;
        height: 30px;
        padding: 10px 0;
        touch-action: pan-x;
        -webkit-tap-highlight-color: transparent;
      }

      .playback-slider::-webkit-slider-runnable-track {
        height: 8px;
      }

      .playback-slider::-webkit-slider-thumb {
        width: 24px;
        height: 24px;
        margin-top: -8px;
        border-width: 3px;
      }

      .playback-slider::-moz-range-track {
        height: 8px;
      }

      .playback-slider::-moz-range-progress {
        height: 8px;
      }

      .playback-slider::-moz-range-thumb {
        width: 22px;
        height: 22px;
        border-width: 3px;
      }

      .playback-buttons {
        margin-top: 4px;
        gap: 7px;
      }

      .playback-button {
        min-height: 34px;
        padding: 8px 10px;
      }
    }
  `;

  document.head.appendChild(styleTag);
}
