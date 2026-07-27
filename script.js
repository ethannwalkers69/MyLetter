/* ==========================================================================
   SECRET MESSAGE — behaviour
   Vanilla JS only. No frameworks, no libraries, no network calls.
   Organised as small, single-purpose functions so each effect can be
   read, tested and reused independently.
   ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------ *
   *  Shared helpers
   * ------------------------------------------------------------------ */

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  /** Random float in [min, max) */
  const rand = (min, max) => Math.random() * (max - min) + min;

  /** Clamp a number between two bounds */
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  /** Shorthand for a single element query */
  const $ = (selector) => document.querySelector(selector);

  /* ------------------------------------------------------------------ *
   *  Scene manager
   *  Handles which of the three <section class="scene"> is visible and
   *  triggers the fade / scale / blur transition defined in the CSS.
   * ------------------------------------------------------------------ */

  const scenes = Array.from(document.querySelectorAll('.scene'));

  function goToScene(sceneId) {
    scenes.forEach((scene) => {
      const isTarget = scene.dataset.scene === String(sceneId);
      scene.classList.toggle('is-active', isTarget);
    });
  }

  /* ------------------------------------------------------------------ *
   *  Ambient floating particles (hearts) — purely decorative
   * ------------------------------------------------------------------ */

  function spawnParticle(layer) {
    const particle = document.createElement('span');
    particle.className = 'particle';
    particle.textContent = Math.random() > 0.5 ? '♥' : '✦';

    const size = rand(10, 22);
    const duration = rand(7, 14);
    const drift = rand(-60, 60);

    particle.style.setProperty('--x', `${rand(0, 100)}%`);
    particle.style.setProperty('--size', `${size}px`);
    particle.style.setProperty('--duration', `${duration}s`);
    particle.style.setProperty('--delay', `${rand(0, 6)}s`);
    particle.style.setProperty('--drift', `${drift}px`);

    layer.appendChild(particle);
  }

  function initAmbientParticles() {
    const layer = $('#particleLayer');
    if (!layer || prefersReducedMotion) return;

    const COUNT = window.innerWidth < 600 ? 12 : 20;
    for (let i = 0; i < COUNT; i += 1) spawnParticle(layer);
  }

  /* ------------------------------------------------------------------ *
   *  Heart burst — short-lived burst of hearts from a point on screen
   * ------------------------------------------------------------------ */

  function heartBurst(originX, originY, amount = 14) {
    const layer = $('#burstLayer');
    if (!layer) return;

    for (let i = 0; i < amount; i += 1) {
      const heart = document.createElement('span');
      heart.className = 'burst-heart';
      heart.textContent = '❤';

      const angle = rand(0, Math.PI * 2);
      const distance = rand(60, 160);
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - 40; // bias upward

      heart.style.setProperty('--x', `${originX}px`);
      heart.style.setProperty('--y', `${originY}px`);
      heart.style.setProperty('--tx', `${tx}px`);
      heart.style.setProperty('--ty', `${ty}px`);
      heart.style.setProperty('--size', `${rand(16, 30)}px`);
      heart.style.setProperty('--duration', `${rand(0.7, 1.3)}s`);

      layer.appendChild(heart);
      heart.addEventListener('animationend', () => heart.remove());
    }
  }

  /* ------------------------------------------------------------------ *
   *  Confetti — a lightweight interval-driven emitter, start/stop pair
   * ------------------------------------------------------------------ */

  const confettiColors = ['var(--primary)', 'var(--secondary)', 'var(--gold)', '#ffffff'];
  let confettiIntervalId = null;

  function spawnConfettiPiece(layer) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';

    const size = rand(6, 11);
    piece.style.setProperty('--x', `${rand(0, 100)}%`);
    piece.style.setProperty('--w', `${size}px`);
    piece.style.setProperty('--h', `${size * 1.6}px`);
    piece.style.setProperty('--c', confettiColors[Math.floor(rand(0, confettiColors.length))]);
    piece.style.setProperty('--duration', `${rand(2.6, 4.2)}s`);
    piece.style.setProperty('--drift', `${rand(-80, 80)}px`);
    piece.style.setProperty('--spin', `${rand(360, 720)}deg`);

    layer.appendChild(piece);
    piece.addEventListener('animationend', () => piece.remove());
  }

  function startConfetti() {
    const layer = $('#confettiLayer');
    if (!layer || confettiIntervalId) return;

    if (prefersReducedMotion) {
      // A single gentle sprinkle instead of a continuous stream.
      for (let i = 0; i < 12; i += 1) spawnConfettiPiece(layer);
      return;
    }

    const burstNow = () => {
      for (let i = 0; i < 6; i += 1) spawnConfettiPiece(layer);
    };
    burstNow();
    confettiIntervalId = window.setInterval(burstNow, 220);
  }

  function stopConfetti() {
    if (confettiIntervalId) {
      window.clearInterval(confettiIntervalId);
      confettiIntervalId = null;
    }
  }

  /* ------------------------------------------------------------------ *
   *  Scene 1 — the dodging "No" button
   *
   *  Behaviour required:
   *   - never clickable
   *   - jumps to a random safe spot whenever a pointer/finger gets close
   *   - stays fully inside the viewport
   *   - never overlaps the "Yes" button
   *   - smooth movement + a little bounce after landing
   * ------------------------------------------------------------------ */

  function initDodgingNoButton() {
    const noBtn = $('#btnNo');
    const yesBtn = $('#btnYes');
    const buttonRow = $('.button-row');
    if (!noBtn || !yesBtn || !buttonRow) return;

    const DANGER_RADIUS = 110; // px — how close is "too close"
    const MARGIN = 16;         // keep clear of viewport edges
    let isRoaming = false;     // false while sitting in its original flex slot

    function rectsOverlap(a, b, buffer = 24) {
      return !(
        a.right + buffer < b.left ||
        a.left - buffer > b.right ||
        a.bottom + buffer < b.top ||
        a.top - buffer > b.bottom
      );
    }

    function randomSafePosition() {
      const w = noBtn.offsetWidth || 110;
      const h = noBtn.offsetHeight || 48;
      const yesRect = yesBtn.getBoundingClientRect();

      const maxLeft = window.innerWidth - w - MARGIN;
      const maxTop = window.innerHeight - h - MARGIN;

      let left = 0;
      let top = 0;
      let attempts = 0;

      do {
        left = clamp(rand(MARGIN, maxLeft), MARGIN, maxLeft);
        top = clamp(rand(MARGIN, maxTop), MARGIN, maxTop);
        attempts += 1;
      } while (
        rectsOverlap(
          { left, top, right: left + w, bottom: top + h },
          yesRect
        ) &&
        attempts < 20
      );

      return { left, top };
    }

    function relocate() {
      const { left, top } = randomSafePosition();

      if (!isRoaming) {
        // First escape: lift it out of the normal flex flow so it can
        // be positioned freely, without a visual jump.
        const startRect = noBtn.getBoundingClientRect();
        noBtn.style.left = `${startRect.left}px`;
        noBtn.style.top = `${startRect.top}px`;
        noBtn.classList.add('is-roaming');
        isRoaming = true;
        // force layout so the browser registers the start position
        // before we animate to the new one
        void noBtn.offsetWidth;
      }

      noBtn.style.left = `${left}px`;
      noBtn.style.top = `${top}px`;

      noBtn.classList.remove('is-bouncing');
      void noBtn.offsetWidth; // restart the bounce animation
      noBtn.classList.add('is-bouncing');
    }

    function distanceToButton(x, y) {
      const rect = noBtn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return Math.hypot(x - cx, y - cy);
    }

    function handlePointerMove(x, y) {
      if (distanceToButton(x, y) < DANGER_RADIUS) relocate();
    }

    // Desktop: react to the mouse approaching.
    window.addEventListener('mousemove', (e) => handlePointerMove(e.clientX, e.clientY), {
      passive: true,
    });

    // Touch devices: a finger only "approaches" on move, and can also
    // land directly on the button, so we guard both.
    window.addEventListener(
      'touchmove',
      (e) => {
        const touch = e.touches[0];
        if (touch) handlePointerMove(touch.clientX, touch.clientY);
      },
      { passive: true }
    );

    // Belt-and-braces: if a click/tap ever does land exactly on the
    // button before the above logic reacts, dodge instead of firing.
    const evade = (e) => {
      e.preventDefault();
      relocate();
    };
    noBtn.addEventListener('pointerdown', evade);
    noBtn.addEventListener('click', (e) => e.preventDefault());

    // Reposition to stay inside bounds if the viewport is resized/rotated.
    window.addEventListener('resize', () => {
      if (isRoaming) relocate();
    });
  }

  /* ------------------------------------------------------------------ *
   *  Scene 1 → Scene 2 — saying "yes"
   * ------------------------------------------------------------------ */

  function initYesButton() {
    const yesBtn = $('#btnYes');
    if (!yesBtn) return;

    yesBtn.addEventListener('click', () => {
      const rect = yesBtn.getBoundingClientRect();
      heartBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 18);

      window.setTimeout(() => goToScene(2), 250);
    });
  }

  /* ------------------------------------------------------------------ *
   *  Scene 2 — opening the envelope
   * ------------------------------------------------------------------ */

  function initEnvelope() {
    const envelope = $('#envelopeBtn');
    if (!envelope) return;

    let hasOpened = false;

    envelope.addEventListener('click', () => {
      if (hasOpened) return;
      hasOpened = true;

      envelope.classList.add('is-opening');

      const rect = envelope.getBoundingClientRect();
      heartBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 22);
      startConfetti();

      window.setTimeout(() => goToScene(3), 700);
    });
  }

  /* ------------------------------------------------------------------ *
   *  Scene 3 — closing the letter
   * ------------------------------------------------------------------ */

  function initCloseLetter() {
    const closeBtn = $('#closeLetterBtn');
    const letterCard = $('#letterCard');
    const thankYou = $('#thankYou');
    if (!closeBtn || !letterCard || !thankYou) return;

    closeBtn.addEventListener('click', () => {
      letterCard.classList.add('is-closing');

      // Confetti keeps falling for two more seconds after closing,
      // then the thank-you message appears.
      window.setTimeout(() => {
        stopConfetti();
      }, 2000);

      window.setTimeout(() => {
        letterCard.hidden = true;
        thankYou.hidden = false;
      }, 550);
    });
  }

  /* ------------------------------------------------------------------ *
   *  Boot
   * ------------------------------------------------------------------ */

  function init() {
    goToScene(1);
    initAmbientParticles();
    initDodgingNoButton();
    initYesButton();
    initEnvelope();
    initCloseLetter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
