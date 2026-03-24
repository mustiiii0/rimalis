(function () {
  function vibrate(ms = 10) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (_err) {
      // ignore
    }
  }

  function expandAccordion(bodyId) {
    const btn = bodyId
      ? document.querySelector(`.pm-accordion__toggle[aria-controls="${CSS.escape(bodyId)}"]`)
      : null;
    if (!btn) return;
    const body = document.getElementById(bodyId);
    btn.setAttribute('aria-expanded', 'true');
    if (body) body.hidden = false;
    const section = btn.closest('.pm-accordion');
    if (section) section.classList.add('is-open');
  }

  function initAccordion() {
    const toggles = Array.from(document.querySelectorAll('.pm-accordion__toggle'));
    if (!toggles.length) return;

    function setExpanded(btn, expanded) {
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      const bodyId = btn.getAttribute('aria-controls');
      const body = bodyId ? document.getElementById(bodyId) : null;
      if (body) body.hidden = !expanded;
      const section = btn.closest('.pm-accordion');
      if (section) section.classList.toggle('is-open', expanded);
    }

    toggles.forEach((btn) => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      setExpanded(btn, expanded);
      btn.addEventListener('click', () => {
        const next = btn.getAttribute('aria-expanded') !== 'true';
        setExpanded(btn, next);
        vibrate(8);
      });
    });
  }

  function initStickyBar() {
    const bar = document.getElementById('pmStickyBar');
    const stickyPrice = document.getElementById('pmStickyPrice');
    const stickyMeta = document.getElementById('pmStickyMeta');
    const hero = document.querySelector('.pm-hero');
    if (!bar || !stickyPrice || !stickyMeta) return;

    const sourcePrice = document.getElementById('propertyPrice');
    const sourceArea = document.getElementById('featureArea');
    const sourceAreaLabel = document.getElementById('featureAreaLabel');
    const sourceRooms = document.getElementById('featureRooms');
    const sourceRoomsLabel = document.getElementById('featureRoomsLabel');

    function textOf(el) {
      return String(el?.textContent || '').trim();
    }

    function updateSticky() {
      stickyPrice.textContent = textOf(sourcePrice) || '-';

      const areaValue = textOf(sourceArea);
      const areaLabel = textOf(sourceAreaLabel);
      const roomsValue = textOf(sourceRooms);
      const roomsLabel = textOf(sourceRoomsLabel);
      const parts = [];

      if (areaValue && areaValue !== '-') {
        parts.push([areaValue, areaLabel].filter(Boolean).join(' ').trim());
      }
      if (roomsValue && roomsValue !== '-') {
        parts.push([roomsValue, roomsLabel].filter(Boolean).join(' ').trim());
      }

      stickyMeta.textContent = parts.length ? parts.join(' • ') : '-';
    }

    function setVisibility() {
      const y = window.scrollY || 0;
      const threshold = Math.max(160, (hero?.offsetHeight || 320) - 120);
      bar.hidden = y < threshold;
    }

    updateSticky();
    setVisibility();

    const observer = new MutationObserver(() => {
      updateSticky();
      setVisibility();
    });
    [sourcePrice, sourceArea, sourceAreaLabel, sourceRooms, sourceRoomsLabel].forEach((el) => {
      if (el) observer.observe(el, { childList: true, characterData: true, subtree: true });
    });

    window.addEventListener('scroll', setVisibility, { passive: true });
    window.addEventListener('rimalis:language-changed', updateSticky);
  }

  function initPanelAutoExpand() {
    const panel = document.getElementById('propertyMessagePanel');
    if (!panel) return;

    function maybeExpand() {
      if (!panel.hidden) expandAccordion('pmAgentBody');
    }

    const obs = new MutationObserver(maybeExpand);
    obs.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    maybeExpand();

    const messageBtn = document.getElementById('agentMessageBtn');
    const bottomMessageBtn = document.getElementById('bottomMessageBtn');
    [messageBtn, bottomMessageBtn].forEach((btn) => {
      btn?.addEventListener('click', () => expandAccordion('pmAgentBody'), { capture: true });
    });
  }

  function initBottomCtas() {
    const agentCallBtn = document.getElementById('agentCallBtn');
    const agentWhatsappBtn = document.getElementById('agentWhatsappBtn');
    const bottomCallBtn = document.getElementById('bottomCallBtn');
    const bottomWhatsappBtn = document.getElementById('bottomWhatsappBtn');
    const bottomMiniWrap = document.querySelector('.pm-bottom-mini');
    const bottomBar = document.querySelector('.pm-bottom-bar');
    if (!bottomCallBtn && !bottomWhatsappBtn) return;

    function refresh() {
      if (bottomCallBtn) bottomCallBtn.hidden = !agentCallBtn || Boolean(agentCallBtn.disabled);
      if (bottomWhatsappBtn) bottomWhatsappBtn.hidden = !agentWhatsappBtn || Boolean(agentWhatsappBtn.disabled);
      const hasAny = (bottomCallBtn && !bottomCallBtn.hidden) || (bottomWhatsappBtn && !bottomWhatsappBtn.hidden);
      if (bottomMiniWrap) bottomMiniWrap.style.display = hasAny ? '' : 'none';
      if (bottomBar) bottomBar.classList.toggle('pm-bottom-bar--no-mini', !hasAny);
    }

    bottomCallBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      agentCallBtn?.click();
      vibrate(10);
    });

    bottomWhatsappBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      agentWhatsappBtn?.click();
      vibrate(10);
    });

    const obs = new MutationObserver(refresh);
    if (agentCallBtn) obs.observe(agentCallBtn, { attributes: true, attributeFilter: ['disabled', 'data-phone', 'class'] });
    if (agentWhatsappBtn) obs.observe(agentWhatsappBtn, { attributes: true, attributeFilter: ['disabled', 'data-phone', 'class'] });
    refresh();
  }

  function initSimilarMore() {
    const btn = document.getElementById('pmSimilarMoreBtn');
    if (!btn) return;

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const q = String(document.getElementById('propertyLocationText')?.textContent || '').trim() ||
        String(document.getElementById('propertyAddressText')?.textContent || '').trim();
      const base = (window.location.pathname || '').includes('/templates/mobile/')
        ? '/templates/mobile/public/properties.html'
        : '/templates/public/properties.html';
      const next = q ? `${base}?q=${encodeURIComponent(q)}` : base;
      window.location.href = next;
    });
  }

  function initLazyMap() {
    const frame = document.getElementById('propertyMapFrame');
    if (!frame || frame.dataset.pmLazy !== '1') return;

    function activate() {
      if (frame.dataset.pmMapReady === '1') return;
      frame.dataset.pmMapReady = '1';
      if (frame.dataset.mapSrc) frame.src = frame.dataset.mapSrc;
    }

    if (!('IntersectionObserver' in window)) {
      activate();
      return;
    }

    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        activate();
        io.disconnect();
      }
    }, { threshold: 0.12 });
    io.observe(frame);
  }

  function initShareHaptics() {
    document.querySelectorAll('[data-share-channel]').forEach((btn) => {
      btn.addEventListener('click', () => vibrate(8));
    });
  }

  function initLightboxGestures() {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightboxImg');
    const prev = document.getElementById('lightboxPrev');
    const next = document.getElementById('lightboxNext');
    const close = document.getElementById('lightboxClose');
    if (!lightbox || !img) return;

    let scale = 1;
    let tx = 0;
    let ty = 0;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let isPinching = false;
    let isPanning = false;

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function apply() {
      img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }

    function reset() {
      scale = 1;
      tx = 0;
      ty = 0;
      apply();
    }

    function dist(t1, t2) {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.hypot(dx, dy);
    }

    function isActive() {
      return lightbox.classList.contains('active');
    }

    function shouldSwipe(dx, dy) {
      return Math.abs(dx) > 48 && Math.abs(dy) < 34;
    }

    close?.addEventListener('click', reset);
    prev?.addEventListener('click', () => {
      reset();
      vibrate(8);
    });
    next?.addEventListener('click', () => {
      reset();
      vibrate(8);
    });

    const srcObs = new MutationObserver(reset);
    srcObs.observe(img, { attributes: true, attributeFilter: ['src'] });

    lightbox.addEventListener('touchstart', (e) => {
      if (!isActive()) return;
      if (e.touches.length === 2) {
        isPinching = true;
        isPanning = false;
        pinchStartDist = dist(e.touches[0], e.touches[1]);
        pinchStartScale = scale;
        return;
      }
      if (e.touches.length !== 1) return;

      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lastX = startX;
      lastY = startY;
      isPanning = scale > 1;
      isPinching = false;
    }, { passive: true });

    lightbox.addEventListener('touchmove', (e) => {
      if (!isActive()) return;
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        if (!pinchStartDist) pinchStartDist = d;
        const nextScale = clamp(pinchStartScale * (d / pinchStartDist), 1, 3);
        scale = nextScale;
        apply();
        return;
      }

      if (e.touches.length !== 1) return;

      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = x - lastX;
      const dy = y - lastY;
      lastX = x;
      lastY = y;

      if (scale > 1 && isPanning) {
        e.preventDefault();
        tx = clamp(tx + dx, -140, 140);
        ty = clamp(ty + dy, -220, 220);
        apply();
      }
    }, { passive: false });

    lightbox.addEventListener('touchend', (e) => {
      if (!isActive()) return;
      if (isPinching) {
        isPinching = false;
        if (scale <= 1.02) reset();
        return;
      }
      if (scale > 1) return;
      if (e.changedTouches.length !== 1) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - startX;
      const dy = endY - startY;
      if (!shouldSwipe(dx, dy)) return;

      if (dx < 0) {
        window.nextImage?.();
      } else {
        window.prevImage?.();
      }
      vibrate(10);
    }, { passive: true });
  }

  function init() {
    initAccordion();
    initStickyBar();
    initPanelAutoExpand();
    initBottomCtas();
    initSimilarMore();
    initLazyMap();
    initShareHaptics();
    initLightboxGestures();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
