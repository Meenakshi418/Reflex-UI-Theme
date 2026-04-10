// ============================================================
// FocusFlow Content Script – All 9 Features
// ============================================================

(function () {
  'use strict';

  // ── State ───────────────────────────────────────────────────
  const state = {
    frustrationScore: 0,
    frustrationTriggered: false,
    lastScrollY: window.scrollY,
    scrollReverseCount: 0,
    rapidClickCount: 0,
    lastClickTime: 0,
    clickPositions: [],
    featureStates: {
      progressiveReveal: false,
      readingFocus: false,
      simplification: false,
      distractionFreeze: false,
      autoScroll: false,
      sectionCollapse: false,
      focusMode: false,
    },
    autoScrollInterval: null,
    readingFocusBar: null,
    panels: [],
  };

  let settings = {
    frustrationDetection: true,
    progressiveReveal: false,
    readingFocus: false,
    simplification: false,
    distractionFreeze: false,
    autoScroll: false,
    sectionCollapse: false,
    focusMode: false,
    adaptiveTheme: true,
  };

  // ── Load settings from storage ───────────────────────────────
  chrome.storage.sync.get('focusflowSettings', (data) => {
    if (data.focusflowSettings) {
      settings = { ...settings, ...data.focusflowSettings };
    }
    applyInitialSettings();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.focusflowSettings) {
      const prev = { ...settings };
      settings = { ...settings, ...changes.focusflowSettings.newValue };
      reconcileSettings(prev, settings);
    }
  });

  function applyInitialSettings() {
    if (settings.progressiveReveal) enableProgressiveReveal();
    if (settings.readingFocus) enableReadingFocus();
    if (settings.simplification) enableSimplification();
    if (settings.distractionFreeze) enableDistractionFreeze();
    if (settings.autoScroll) enableAutoScroll();
    if (settings.sectionCollapse) enableSectionCollapse();
    if (settings.focusMode) enableFocusMode();
  }

  function reconcileSettings(prev, next) {
    const toggle = (key, enableFn, disableFn) => {
      if (!prev[key] && next[key]) enableFn();
      if (prev[key] && !next[key]) disableFn();
    };
    toggle('progressiveReveal', enableProgressiveReveal, disableProgressiveReveal);
    toggle('readingFocus', enableReadingFocus, disableReadingFocus);
    toggle('simplification', enableSimplification, disableSimplification);
    toggle('distractionFreeze', enableDistractionFreeze, disableDistractionFreeze);
    toggle('autoScroll', enableAutoScroll, disableAutoScroll);
    toggle('sectionCollapse', enableSectionCollapse, disableSectionCollapse);
    toggle('focusMode', enableFocusMode, disableFocusMode);
  }

  // ════════════════════════════════════════════════════════════
  // 1. FRUSTRATION DETECTION
  // ════════════════════════════════════════════════════════════
  function setupFrustrationDetection() {
    // Scroll direction reversal detection
    window.addEventListener('scroll', () => {
      if (!settings.frustrationDetection) return;
      const currentY = window.scrollY;
      const delta = currentY - state.lastScrollY;
      if (Math.abs(delta) > 60) {
        const prevDir = state._lastScrollDir || 0;
        const newDir = delta > 0 ? 1 : -1;
        if (prevDir !== 0 && prevDir !== newDir) {
          state.scrollReverseCount++;
          addFrustration(8, 'scroll_reverse');
        }
        state._lastScrollDir = newDir;
      }
      state.lastScrollY = currentY;
    }, { passive: true });

    // Rapid / repeated clicking
    document.addEventListener('click', (e) => {
      if (!settings.frustrationDetection) return;
      const now = Date.now();
      const gap = now - state.lastClickTime;
      state.lastClickTime = now;

      // Rapid clicks (< 600 ms)
      if (gap < 600) {
        state.rapidClickCount++;
        addFrustration(10, 'rapid_click');
      }

      // Repeated clicks near same position (rage-click)
      const pos = { x: e.clientX, y: e.clientY, t: now };
      state.clickPositions.push(pos);
      state.clickPositions = state.clickPositions.filter(p => now - p.t < 3000);
      if (state.clickPositions.length >= 3) {
        const nearby = state.clickPositions.filter(p =>
          Math.abs(p.x - pos.x) < 60 && Math.abs(p.y - pos.y) < 60
        );
        if (nearby.length >= 3) {
          addFrustration(15, 'rage_click');
        }
      }
    });

    // Decay score every 5 s
    setInterval(() => {
      state.frustrationScore = Math.max(0, state.frustrationScore - 5);
      updateFrustrationBadge();
    }, 5000);
  }

  function addFrustration(points, reason) {
    state.frustrationScore = Math.min(100, state.frustrationScore + points);
    updateFrustrationBadge();
    chrome.runtime.sendMessage({ type: 'FRUSTRATION_UPDATE', score: state.frustrationScore });

    if (state.frustrationScore >= 60 && !state.frustrationTriggered) {
      state.frustrationTriggered = true;
      if (settings.adaptiveTheme) triggerAdaptiveTheme();
    }
    if (state.frustrationScore < 30) state.frustrationTriggered = false;
    themeShown = false;
  }

  function updateFrustrationBadge() {
    chrome.runtime.sendMessage({ type: 'SET_BADGE', score: state.frustrationScore });
  }

  // ════════════════════════════════════════════════════════════
  // 9. ADAPTIVE THEME (Trigger-Based)
  // ════════════════════════════════════════════════════════════
  let themeShown = false;

  function triggerAdaptiveTheme() {
    if (themeShown) return;

    themeShown = true;

    showToast('😤 Frustration detected — activating Calm Mode for you!');

    if (!state.featureStates.focusMode) enableFocusMode();
    if (!state.featureStates.readingFocus) enableReadingFocus();
    if (!state.featureStates.distractionFreeze) enableDistractionFreeze();

    // 🔥 YOUR FEATURE
    showThemeSelector();

    chrome.runtime.sendMessage({ type: 'ADAPTIVE_TRIGGERED' });
  }
  // ════════════════════════════════════════════════════════════
  // 2. PROGRESSIVE CONTENT REVEAL
  // ════════════════════════════════════════════════════════════
  function enableProgressiveReveal() {
    state.featureStates.progressiveReveal = true;
    const sections = getContentSections();
    sections.forEach((el, i) => {
      if (i === 0) return; // first section always visible
      el.classList.add('ff-hidden-section');
    });

    // Reveal on scroll proximity
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('ff-hidden-section');
          entry.target.classList.add('ff-revealed-section');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -15% 0px', threshold: 0.1 });

    sections.forEach((el, i) => {
      if (i > 0) observer.observe(el);
    });

    state._progressiveObserver = observer;
  }

  function disableProgressiveReveal() {
    state.featureStates.progressiveReveal = false;
    if (state._progressiveObserver) state._progressiveObserver.disconnect();
    document.querySelectorAll('.ff-hidden-section, .ff-revealed-section').forEach(el => {
      el.classList.remove('ff-hidden-section', 'ff-revealed-section');
    });
  }

  // ════════════════════════════════════════════════════════════
  // 3. READING LINE FOCUS
  // ════════════════════════════════════════════════════════════
  function enableReadingFocus() {
    state.featureStates.readingFocus = true;
    document.body.classList.add('ff-reading-focus-active');

    const bar = document.createElement('div');
    bar.id = 'ff-reading-bar';
    document.body.appendChild(bar);
    state.readingFocusBar = bar;

    const updateBar = () => {
      const y = window.scrollY + window.innerHeight * 0.08;
      bar.style.top = y + 'px';
    };
    updateBar();
    window.addEventListener('scroll', updateBar, { passive: true });
    state._readingScrollFn = updateBar;
  }

  function disableReadingFocus() {
    state.featureStates.readingFocus = false;
    document.body.classList.remove('ff-reading-focus-active');
    const bar = document.getElementById('ff-reading-bar');
    if (bar) bar.remove();
    if (state._readingScrollFn)
      window.removeEventListener('scroll', state._readingScrollFn);
  }

  // ════════════════════════════════════════════════════════════
  // 4. AUTO CONTENT SIMPLIFICATION
  // ════════════════════════════════════════════════════════════
  function enableSimplification() {
    state.featureStates.simplification = true;
    const paragraphs = document.querySelectorAll('article p, main p, .content p, #content p');
    paragraphs.forEach(p => {
      if (p.dataset.ffOriginal) return;
      const text = p.innerText.trim();
      if (text.split(' ').length < 40) return; // skip short paragraphs

      p.dataset.ffOriginal = p.innerHTML;
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const simplified = sentences.slice(0, Math.min(sentences.length, 4));
      const ul = document.createElement('ul');
      ul.className = 'ff-simplified-list';
      simplified.forEach(s => {
        const li = document.createElement('li');
        li.textContent = s.trim();
        ul.appendChild(li);
      });

      const toggle = document.createElement('button');
      toggle.className = 'ff-toggle-original';
      toggle.textContent = '↕ Show original';
      toggle.onclick = () => {
        const showing = p.dataset.ffShowingOriginal === 'true';
        if (showing) {
          p.innerHTML = '';
          p.appendChild(ul);
          p.appendChild(toggle);
          toggle.textContent = '↕ Show original';
          p.dataset.ffShowingOriginal = 'false';
        } else {
          p.innerHTML = p.dataset.ffOriginal;
          p.appendChild(toggle);
          p.dataset.ffShowingOriginal = 'true';
          toggle.textContent = '↕ Show simplified';
        }
      };

      p.innerHTML = '';
      p.appendChild(ul);
      p.appendChild(toggle);
    });
  }

  function disableSimplification() {
    state.featureStates.simplification = false;
    document.querySelectorAll('[data-ff-original]').forEach(p => {
      p.innerHTML = p.dataset.ffOriginal;
      delete p.dataset.ffOriginal;
    });
  }

  // ════════════════════════════════════════════════════════════
  // 5. DISTRACTION FREEZE
  // ════════════════════════════════════════════════════════════
  function enableDistractionFreeze() {
    state.featureStates.distractionFreeze = true;
    document.body.classList.add('ff-distraction-freeze');

    // Disable non-essential links and buttons
    const nonEssential = document.querySelectorAll(
      'nav a, header a:not([data-ff-essential]), .sidebar a, .ad a, .banner a, [class*="social"] a, [class*="share"] a, [class*="related"] a, [class*="recommend"] a'
    );
    nonEssential.forEach(el => {
      el.classList.add('ff-frozen-link');
      el.dataset.ffOriginalPointer = el.style.pointerEvents;
      el.style.pointerEvents = 'none';
    });
  }

  function disableDistractionFreeze() {
    state.featureStates.distractionFreeze = false;
    document.body.classList.remove('ff-distraction-freeze');
    document.querySelectorAll('.ff-frozen-link').forEach(el => {
      el.style.pointerEvents = el.dataset.ffOriginalPointer || '';
      el.classList.remove('ff-frozen-link');
    });
  }

  // ════════════════════════════════════════════════════════════
  // 6. AUTO SCROLL ASSIST
  // ════════════════════════════════════════════════════════════
  function enableAutoScroll() {
    state.featureStates.autoScroll = true;
    const speed = 0.6; // px per frame

    state.autoScrollInterval = setInterval(() => {
      if (!state.featureStates.autoScroll) return;
      window.scrollBy({ top: speed, behavior: 'instant' });

      // Stop at page bottom
      if (window.scrollY + window.innerHeight >= document.body.scrollHeight - 10) {
        disableAutoScroll();
        showToast('✅ Auto-scroll reached the end of the page.');
      }
    }, 16);

    // Pause on user interaction
    const pauseScroll = () => {
      if (state.featureStates.autoScroll) {
        clearInterval(state.autoScrollInterval);
        state._autoScrollPaused = true;
        showToast('⏸ Auto-scroll paused. Click the button to resume.');
      }
    };
    window.addEventListener('wheel', pauseScroll, { passive: true, once: true });
    window.addEventListener('touchmove', pauseScroll, { passive: true, once: true });
    window.addEventListener('keydown', pauseScroll, { once: true });
  }

  function disableAutoScroll() {
    state.featureStates.autoScroll = false;
    clearInterval(state.autoScrollInterval);
  }

  // ════════════════════════════════════════════════════════════
  // 7. SECTION COLLAPSE
  // ════════════════════════════════════════════════════════════
  function enableSectionCollapse() {
    state.featureStates.sectionCollapse = true;
    const sections = getContentSections();

    sections.forEach((section, index) => {
      if (section.dataset.ffCollapsible) return;
      section.dataset.ffCollapsible = 'true';
      section.dataset.ffSectionIndex = index;

      // Find heading inside section
      const heading = section.querySelector('h1,h2,h3,h4,h5,h6') || null;
      const titleText = heading ? heading.innerText : `Section ${index + 1}`;

      // Wrap content after heading in a collapsible div
      const wrapper = document.createElement('div');
      wrapper.className = 'ff-collapse-body';

      // Move all children except heading into wrapper
      Array.from(section.childNodes).forEach(node => {
        if (node !== heading) wrapper.appendChild(node);
      });
      section.appendChild(wrapper);

      // Create toggle button
      const btn = document.createElement('button');
      btn.className = 'ff-collapse-btn';
      btn.innerHTML = `<span class="ff-chevron">▾</span> ${titleText}`;
      btn.onclick = () => {
        const collapsed = wrapper.classList.toggle('ff-collapsed');
        btn.querySelector('.ff-chevron').textContent = collapsed ? '▸' : '▾';
      };

      section.insertBefore(btn, section.firstChild);
      if (heading) heading.style.display = 'none';

      // Collapse all except first
      if (index > 0) {
        wrapper.classList.add('ff-collapsed');
        btn.querySelector('.ff-chevron').textContent = '▸';
      }
    });
  }

  function disableSectionCollapse() {
    state.featureStates.sectionCollapse = false;
    document.querySelectorAll('[data-ff-collapsible]').forEach(section => {
      const btn = section.querySelector('.ff-collapse-btn');
      const heading = section.querySelector('h1,h2,h3,h4,h5,h6');
      const body = section.querySelector('.ff-collapse-body');

      if (btn) btn.remove();
      if (heading) heading.style.display = '';
      if (body) {
        Array.from(body.childNodes).forEach(node => section.appendChild(node));
        body.remove();
      }
      delete section.dataset.ffCollapsible;
    });
  }

  // ════════════════════════════════════════════════════════════
  // 8. FOCUS MODE (Clutter Removal)
  // ════════════════════════════════════════════════════════════
  const CLUTTER_SELECTORS = [
    'header', 'footer', 'nav', 'aside',
    '[class*="sidebar"]', '[class*="banner"]', '[class*="ads"]',
    '[class*="ad-"]', '[id*="ad-"]', '[class*="popup"]',
    '[class*="newsletter"]', '[class*="social"]', '[class*="share"]',
    '[class*="related"]', '[class*="recommend"]', '[class*="cookie"]',
    '[class*="promo"]', '[role="complementary"]', '[role="banner"]',
    'iframe:not([class*="content"])', '.advertisement',
  ];

  function enableFocusMode() {
    state.featureStates.focusMode = true;
    document.body.classList.add('ff-focus-mode');

    CLUTTER_SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!el.closest('article, main, [role="main"], .post-content, .article-body')) {
          el.classList.add('ff-clutter-hidden');
        }
      });
    });
  }

  function disableFocusMode() {
    state.featureStates.focusMode = false;
    document.body.classList.remove('ff-focus-mode');
    document.querySelectorAll('.ff-clutter-hidden').forEach(el => {
      el.classList.remove('ff-clutter-hidden');
    });
  }

  // ════════════════════════════════════════════════════════════
  // UTILITIES
  // ════════════════════════════════════════════════════════════
  function getContentSections() {
    // Try semantic sections first
    let sections = Array.from(document.querySelectorAll('article section, main section, .post-body > section'));
    if (sections.length < 2) {
      sections = Array.from(document.querySelectorAll('article > *, main > *')).filter(el =>
        ['DIV', 'SECTION', 'ASIDE', 'P', 'BLOCKQUOTE'].includes(el.tagName) &&
        el.innerText && el.innerText.trim().length > 80
      );
    }
    return sections.slice(0, 20);
  }

  function showToast(msg) {
    const existing = document.getElementById('ff-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'ff-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('ff-toast-show'), 10);
    setTimeout(() => {
      toast.classList.remove('ff-toast-show');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // ── Message bus (from popup) ─────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'GET_FRUSTRATION_SCORE') {
      chrome.runtime.sendMessage({ type: 'FRUSTRATION_UPDATE', score: state.frustrationScore });
    }
    if (msg.type === 'ENABLE_FEATURE') enableFeature(msg.feature);
    if (msg.type === 'DISABLE_FEATURE') disableFeature(msg.feature);
    if (msg.type === 'RESET_FRUSTRATION') {
      state.frustrationScore = 0;
      state.frustrationTriggered = false;
      updateFrustrationBadge();
    }
  });

  function enableFeature(f) {
    const map = {
      progressiveReveal: enableProgressiveReveal,
      readingFocus: enableReadingFocus,
      simplification: enableSimplification,
      distractionFreeze: enableDistractionFreeze,
      autoScroll: enableAutoScroll,
      sectionCollapse: enableSectionCollapse,
      focusMode: enableFocusMode,
    };
    if (map[f]) map[f]();
  }

  function disableFeature(f) {
    const map = {
      progressiveReveal: disableProgressiveReveal,
      readingFocus: disableReadingFocus,
      simplification: disableSimplification,
      distractionFreeze: disableDistractionFreeze,
      autoScroll: disableAutoScroll,
      sectionCollapse: disableSectionCollapse,
      focusMode: disableFocusMode,
    };
    if (map[f]) map[f]();
  }

  // ── Bootstrap ────────────────────────────────────────────────
  setupFrustrationDetection();

})();
