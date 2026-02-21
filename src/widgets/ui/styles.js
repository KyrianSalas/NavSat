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
      z-index: 20;
      overflow: hidden;
      transition: width 0.2s ease, padding 0.2s ease, background 0.2s ease;
    }

    #${SIDEBAR_ID}.is-collapsed {
      width: 64px;
      padding: 14px 8px;
      background: linear-gradient(180deg, rgba(6, 11, 23, 0.86), rgba(9, 16, 30, 0.7));
    }

    .sidebar-topbar {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      margin-bottom: 10px;
    }

    #${SIDEBAR_ID}.is-collapsed .sidebar-topbar {
      justify-content: center;
      margin-bottom: 8px;
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
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
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
      opacity: 0;
      transform: translateX(16px);
      pointer-events: none;
      user-select: none;
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
  `;

  document.head.appendChild(styleTag);
}
