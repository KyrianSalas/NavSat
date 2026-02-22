const ABOUT_OVERLAY_STYLE_ID = 'about-overlay-style-id';

function ensureAboutOverlayStyles() {
  if (document.getElementById(ABOUT_OVERLAY_STYLE_ID)) {
    return;
  }

  const styleTag = document.createElement('style');
  styleTag.id = ABOUT_OVERLAY_STYLE_ID;
  styleTag.textContent = `
    body.about-overlay-open {
      overflow: hidden;
    }

    #aboutOverlay {
      position: fixed;
      inset: 0;
      display: block;
      background: transparent;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s ease;
      z-index: 1200;
    }

    #aboutOverlay.is-open {
      opacity: 1;
      pointer-events: auto;
    }

    .about-overlay__surface {
      width: 100%;
      height: 100%;
    }

    .about-overlay__frame {
      width: 100%;
      height: 100%;
      border: 0;
      background: #000;
    }

    @media (max-width: 768px) {
      #aboutOverlay {
        overscroll-behavior: contain;
      }

      .about-overlay__surface,
      .about-overlay__frame {
        height: 100dvh;
      }
    }
  `;

  document.head.appendChild(styleTag);
}

function isPrimaryUnmodifiedClick(event) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function setupAboutOverlay() {
  const aboutLink = document.querySelector('#topBar a[href="#about"], #topBar a[href="/about"], #topBar a[href="/about.html"]');
  if (!aboutLink) {
    return null;
  }

  ensureAboutOverlayStyles();
  aboutLink.setAttribute('aria-haspopup', 'dialog');
  aboutLink.setAttribute('aria-expanded', 'false');

  const overlay = document.createElement('div');
  overlay.id = 'aboutOverlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="about-overlay__surface" role="dialog" aria-modal="true" aria-label="About NavSat">
      <iframe class="about-overlay__frame" title="About NavSat" loading="lazy" data-src="/about.html"></iframe>
    </div>
  `;

  document.body.appendChild(overlay);

  const frame = overlay.querySelector('.about-overlay__frame');

  function openOverlay() {
    if (frame && !frame.getAttribute('src')) {
      frame.setAttribute('src', frame.getAttribute('data-src') || '/about.html');
    }
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    aboutLink.setAttribute('aria-expanded', 'true');
    document.body.classList.add('about-overlay-open');
  }

  function closeOverlay() {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    aboutLink.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('about-overlay-open');
  }

  function syncWithHash() {
    if (window.location.hash === '#about') {
      openOverlay();
    } else {
      closeOverlay();
    }
  }

  function closeViaHistoryOrState() {
    if (window.location.hash === '#about') {
      window.history.back();
    } else {
      closeOverlay();
    }
  }

  function wireBackToMapLinkInFrame() {
    if (!frame) {
      return;
    }
    try {
      const frameDocument = frame.contentDocument;
      if (!frameDocument) {
        return;
      }
      const backLink = frameDocument.querySelector('#backToMapLink, a[href="/"], a[href="/index.html"]');
      if (!backLink || backLink.dataset.overlayBound === 'true') {
        return;
      }
      backLink.dataset.overlayBound = 'true';
      backLink.addEventListener('click', (event) => {
        if (!isPrimaryUnmodifiedClick(event)) {
          return;
        }
        event.preventDefault();
        closeViaHistoryOrState();
      });
    } catch (error) {
      // Ignore cross-origin/iframe access errors.
    }
  }

  aboutLink.addEventListener('click', (event) => {
    if (!isPrimaryUnmodifiedClick(event)) {
      return;
    }
    event.preventDefault();
    if (window.location.hash !== '#about') {
      window.location.hash = 'about';
    } else {
      openOverlay();
    }
  });

  frame.addEventListener('load', wireBackToMapLinkInFrame);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('is-open')) {
      closeViaHistoryOrState();
    }
  });

  window.addEventListener('hashchange', syncWithHash);
  syncWithHash();

  return {
    open: openOverlay,
    close: closeOverlay,
  };
}
