document.addEventListener('DOMContentLoaded', () => {
  initDesktop();
  if (window.feather) feather.replace();
});

function initDesktop() {
  const desktopIcons = document.querySelectorAll('.desktop-icon');
  const windowContainer = document.getElementById('window-container');
  const windowTemplate = document.getElementById('window-template');
  const taskbarWindows = document.getElementById('taskbar-windows');
  const taskbarClock = document.getElementById('taskbar-clock');

  const isMobile =
    window.matchMedia('(max-width: 640px)').matches ||
    window.matchMedia('(pointer: coarse)').matches;

  // ====== App state ======
  const state = {
    z: 10,
    activeWinId: null,
    winMap: new Map(), // id -> { el, taskBtn, type, title }
    nextId: 1,
    guardAwake: false,
    music: {
      ctx: null,
      current: null, // trackId
      nodes: null,   // {stop()}
      gain: null,
      startedAt: 0
    },
    taskManagerInterval: null,
  };

  // ====== Puzzle: temporary code + encrypted file ======
  const TEMP_UNLOCK_CODE = 'admin';
  const COOLDOWN_MS = 2000;
  let lockedUntil = 0;

  const ENCRYPTED_FILES = {
    'case-01': {
      filename: 'secret.png',
      imageSrc: './assets/soeder.png', // passe an
    },
  };

  // ====== Theme / wallpaper persistence ======
  const pref = {
    theme: localStorage.getItem('pref_theme') || 'dark',
    wallpaper: localStorage.getItem('pref_wallpaper') || 'default',
  };

  applyTheme(pref.theme);
  applyWallpaper(pref.wallpaper);

  // ====== Clock ======
  function updateClock() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    taskbarClock.textContent = `${hh}:${mm}`;
  }
  updateClock();
  setInterval(updateClock, 2000);

  // ====== Window creation ======
  function createWindow(type, options = {}) {
    const id = `w${state.nextId++}`;
    const windowClone = windowTemplate.content.cloneNode(true);
    const windowElement = windowClone.querySelector('.window');
    const contentContainer = windowElement.querySelector('.window-content');

    windowElement.dataset.winId = id;
    windowElement.dataset.type = type;

    const setHeader = (title, icon) => {
      windowElement.querySelector('.window-title').textContent = title;
      windowElement.querySelector('.window-icon').setAttribute('data-feather', icon);
    };

    // Insert content based on type
    switch (type) {
      case 'notes': {
        contentContainer.appendChild(document.getElementById('notes-content').content.cloneNode(true));
        setHeader('Notizen', 'file-text');
        break;
      }
      case 'explorer': {
        contentContainer.appendChild(document.getElementById('explorer-content').content.cloneNode(true));
        setHeader('Explorer', 'folder');
        break;
      }
      case 'settings': {
        contentContainer.appendChild(document.getElementById('settings-content').content.cloneNode(true));
        setHeader('Settings', 'settings');
        bindSettingsUI(windowElement);
        break;
      }
      case 'music': {
        contentContainer.appendChild(document.getElementById('music-content').content.cloneNode(true));
        setHeader('Music', 'music');
        bindMusicUI(windowElement);
        break;
      }
      case 'photo': {
        contentContainer.appendChild(document.getElementById('photo-content').content.cloneNode(true));
        setHeader('Foto', 'image');
        bindPhotoUI(windowElement);
        break;
      }
      case 'encrypted-file': {
        contentContainer.appendChild(document.getElementById('unlock-content').content.cloneNode(true));
        setHeader('Datei entsperren', 'lock');
        bindUnlockUI(windowElement, options.fileId);
        break;
      }
      case 'image-viewer': {
        contentContainer.appendChild(document.getElementById('image-view-content').content.cloneNode(true));
        setHeader(options.title || 'Bild', 'image');
        const img = windowElement.querySelector('#secret-image');
        if (img) img.src = options.src || '';
        break;
      }
      case 'taskmanager': {
        contentContainer.appendChild(document.getElementById('taskmanager-content').content.cloneNode(true));
        setHeader('Task Manager', 'cpu');
        bindTaskManagerUI(windowElement);
        break;
      }
      default:
        setHeader('Window', 'square');
        contentContainer.innerHTML = `<div class="text-sm opacity-80">Unbekannte App: ${escapeHtml(type)}</div>`;
    }

    // Default size + initial position
    if (isMobile) {
      windowElement.classList.add('mobile-window');
      windowElement.style.width = '92vw';
      windowElement.style.height = '70vh';
      windowElement.style.left = '4vw';
      windowElement.style.top = '10vh';
    } else {
      const maxLeft = Math.max(60, window.innerWidth - 560);
      const maxTop = Math.max(60, window.innerHeight - 460);
      windowElement.style.left = `${Math.floor(40 + Math.random() * (maxLeft - 40))}px`;
      windowElement.style.top = `${Math.floor(40 + Math.random() * (maxTop - 40))}px`;
    }

    // Add to DOM
    windowContainer.appendChild(windowElement);

    // Controls + z-index
    initWindowControls(windowElement);
    bringToFront(windowElement);

    // Taskbar button
    const title = windowElement.querySelector('.window-title').textContent || 'Window';
    const iconName = windowElement.querySelector('.window-icon').getAttribute('data-feather') || 'square';
    const taskBtn = addTaskbarButton({ id, title, iconName });

    state.winMap.set(id, { el: windowElement, taskBtn, type, title });

    // Feather icons re-render (window header + inside content)
    if (window.feather) feather.replace();

    return windowElement;
  }

  function addTaskbarButton({ id, title, iconName }) {
    const btn = document.createElement('button');
    btn.className = 'taskbar-btn';
    btn.type = 'button';
    btn.dataset.winId = id;
    btn.innerHTML = `
      <span class="icon-wrap"><i data-feather="${escapeAttr(iconName)}"></i></span>
      <span class="label">${escapeHtml(title)}</span>
    `;
    btn.addEventListener('click', () => {
      const entry = state.winMap.get(id);
      if (!entry) return;
      const w = entry.el;
      if (w.classList.contains('minimized')) {
        w.classList.remove('minimized');
        bringToFront(w);
      } else if (state.activeWinId === id) {
        // toggle minimize on active
        w.classList.add('minimized');
        setActive(null);
      } else {
        bringToFront(w);
      }
      refreshTaskbarActive();
    });
    taskbarWindows.appendChild(btn);
    if (window.feather) feather.replace();
    return btn;
  }

  function removeTaskbarButton(id) {
    const entry = state.winMap.get(id);
    if (!entry) return;
    entry.taskBtn?.remove();
    state.winMap.delete(id);
    if (state.activeWinId === id) state.activeWinId = null;
    refreshTaskbarActive();
  }

  function refreshTaskbarActive() {
    for (const [id, entry] of state.winMap.entries()) {
      const w = entry.el;
      const active = (state.activeWinId === id) && !w.classList.contains('minimized');
      entry.taskBtn?.classList.toggle('active', active);
    }
  }

  function setActive(idOrNull) {
    state.activeWinId = idOrNull;
    refreshTaskbarActive();
  }

  function bringToFront(windowElement) {
    state.z += 1;
    windowElement.style.zIndex = String(state.z);
    setActive(windowElement.dataset.winId || null);
  }

  // ====== Window controls (drag + buttons) ======
  function initWindowControls(windowElement) {
    const header = windowElement.querySelector('.window-header');
    const minimizeBtn = windowElement.querySelector('.window-minimize');
    const maximizeBtn = windowElement.querySelector('.window-maximize');
    const closeBtn = windowElement.querySelector('.window-close');

    windowElement.addEventListener('pointerdown', () => bringToFront(windowElement));

    // Minimize
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      windowElement.classList.add('minimized');
      setActive(null);
      refreshTaskbarActive();
    });

    // Maximize
    maximizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      windowElement.classList.toggle('maximized');
      bringToFront(windowElement);
    });

    // Close
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = windowElement.dataset.winId;
      windowElement.remove();
      if (id) removeTaskbarButton(id);
      if (windowElement.dataset.type === 'taskmanager') stopTaskManagerTicker();
    });

    // Drag with pointer events
    let dragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    header.addEventListener('pointerdown', (e) => {
      // Don't drag if clicking controls
      if (e.target.closest('button')) return;
      if (windowElement.classList.contains('maximized')) return;

      dragging = true;
      header.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(windowElement.style.left || '0', 10);
      startTop = parseInt(windowElement.style.top || '0', 10);

      windowElement.classList.add('window-dragging');
      bringToFront(windowElement);
    });

    header.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const newLeft = Math.max(0, startLeft + dx);
      const newTop = Math.max(0, startTop + dy);
      windowElement.style.left = `${newLeft}px`;
      windowElement.style.top = `${newTop}px`;
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      windowElement.classList.remove('window-dragging');
      try { header.releasePointerCapture(e.pointerId); } catch (_) {}
    };

    header.addEventListener('pointerup', endDrag);
    header.addEventListener('pointercancel', endDrag);
  }

  // ====== Desktop icon click ======
  desktopIcons.forEach((icon) => {
    icon.addEventListener('click', () => {
      const windowType = icon.getAttribute('data-window');
      const fileId = icon.getAttribute('data-file-id') || null;
      createWindow(windowType, { fileId });
    });
  });

  // ====== Start button (placeholder) ======
  document.getElementById('start-btn').addEventListener('click', () => {
    // optional: start menu
  });

  // ====== Settings binding ======
  function bindSettingsUI(windowElement) {
    const themeSel = windowElement.querySelector('#settings-theme');
    const wallSel = windowElement.querySelector('#settings-wallpaper');

    if (themeSel) themeSel.value = pref.theme;
    if (wallSel) wallSel.value = pref.wallpaper;

    themeSel?.addEventListener('change', () => {
      const v = themeSel.value;
      pref.theme = v;
      localStorage.setItem('pref_theme', v);
      applyTheme(v);
    });

    wallSel?.addEventListener('change', () => {
      const v = wallSel.value;
      pref.wallpaper = v;
      localStorage.setItem('pref_wallpaper', v);
      applyWallpaper(v);
    });
  }

  function applyTheme(theme) {
    document.body.classList.remove('theme-light');
    if (theme === 'light') {
      document.body.classList.add('theme-light');
    } else if (theme === 'system') {
      // naive: if system prefers light, apply light
      const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      if (prefersLight) document.body.classList.add('theme-light');
    }
  }

  function applyWallpaper(wallpaper) {
    document.body.dataset.wallpaper = wallpaper || 'default';
  }

  // ====== Unlock puzzle ======
  function bindUnlockUI(windowElement, fileId) {
    const codeInput = windowElement.querySelector('#unlock-code');
    const unlockBtn = windowElement.querySelector('#unlock-btn');
    const cancelBtn = windowElement.querySelector('#unlock-cancel');
    const msg = windowElement.querySelector('#unlock-msg');

    const setLocked = (locked, text = '') => {
      codeInput.disabled = locked;
      unlockBtn.disabled = locked;
      unlockBtn.classList.toggle('opacity-60', locked);
      unlockBtn.classList.toggle('cursor-not-allowed', locked);
      msg.textContent = text;
    };

    const tickCooldown = () => {
      const remaining = lockedUntil - Date.now();
      if (remaining <= 0) {
        setLocked(false, '');
        return;
      }
      setLocked(true, `Falscher Code. Warte ${(remaining / 1000).toFixed(1)}s…`);
      requestAnimationFrame(tickCooldown);
    };

    cancelBtn.addEventListener('click', () => {
      const id = windowElement.dataset.winId;
      windowElement.remove();
      if (id) removeTaskbarButton(id);
    });

    unlockBtn.addEventListener('click', () => {
      const now = Date.now();
      if (now < lockedUntil) {
        tickCooldown();
        return;
      }

      const code = (codeInput.value || '').trim();
      const file = ENCRYPTED_FILES[fileId || ''];

      if (!file) {
        msg.textContent = 'Datei nicht gefunden.';
        return;
      }
      if (!code) {
        msg.textContent = 'Bitte Code eingeben.';
        return;
      }
      if (code !== TEMP_UNLOCK_CODE) {
        lockedUntil = now + COOLDOWN_MS;
        tickCooldown();
        return;
      }

      // success -> open image window
      createWindow('image-viewer', { title: file.filename, src: file.imageSrc });
      const id = windowElement.dataset.winId;
      windowElement.remove();
      if (id) removeTaskbarButton(id);
    });
  }

  // ====== Music engine (WebAudio, no external files required) ======
  const TRACKS = [
    { id: 'ambient', name: 'Ambient Loop' },
    { id: 'synth', name: 'Chill Synth' },
    { id: 'hardrock', name: 'Hard Rock' },
  ];

  function ensureAudio() {
    if (state.music.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.value = 0.4;
    gain.connect(ctx.destination);
    state.music.ctx = ctx;
    state.music.gain = gain;
  }

  function stopMusic() {
    if (state.music.nodes) {
      try { state.music.nodes.stop(); } catch (_) {}
    }
    state.music.nodes = null;
    state.music.current = null;
    state.music.startedAt = 0;
    document.body.classList.remove('screen-shake');
    updateMusicStatus();
  }

  function playTrack(trackId) {
    ensureAudio();
    const ctx = state.music.ctx;

    // resume required on many mobile browsers
    ctx.resume?.();

    stopMusic();

    const nodes = buildTrack(trackId, ctx, state.music.gain);
    state.music.nodes = nodes;
    state.music.current = trackId;
    state.music.startedAt = performance.now();

    // hard rock effects
    if (trackId === 'hardrock') {
      document.body.classList.add('screen-shake');
      scheduleGuardWake();
    } else {
      document.body.classList.remove('screen-shake');
    }

    updateMusicStatus();
  }

  function scheduleGuardWake() {
    // wakes after ~2 seconds of continuous hardrock
    const token = Symbol('guardWake');
    state._guardWakeToken = token;

    setTimeout(() => {
      if (state._guardWakeToken !== token) return;
      if (state.music.current !== 'hardrock') return;
      if (!state.guardAwake) {
        state.guardAwake = true;
        window.dispatchEvent(new CustomEvent('guard-awake'));
      }
    }, 2000);
  }

  function buildTrack(trackId, ctx, outGain) {
    // returns { stop() }
    const nodes = [];
    const stopFns = [];

    const now = ctx.currentTime;

    // helpers
    const mkOsc = (type, freq, gainVal) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gainVal;
      osc.connect(g);
      g.connect(outGain);
      osc.start();
      nodes.push(osc, g);
      stopFns.push(() => { try { osc.stop(); } catch (_) {} });
      return { osc, g };
    };

    const mkNoise = (gainVal) => {
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.25;

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const g = ctx.createGain();
      g.gain.value = gainVal;

      src.connect(g);
      g.connect(outGain);

      src.start();
      nodes.push(src, g);
      stopFns.push(() => { try { src.stop(); } catch (_) {} });

      return { src, g };
    };

    const mkWaveshaper = (amount = 50) => {
      const ws = ctx.createWaveShaper();
      const k = typeof amount === 'number' ? amount : 50;
      const n = 44100;
      const curve = new Float32Array(n);
      const deg = Math.PI / 180;
      for (let i = 0; i < n; ++i) {
        const x = (i * 2) / n - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
      ws.curve = curve;
      ws.oversample = '4x';
      return ws;
    };

    if (trackId === 'ambient') {
      // gentle pad: two sines + slow tremolo
      const o1 = mkOsc('sine', 110, 0.08);
      const o2 = mkOsc('sine', 220, 0.05);

      // tremolo LFO -> gain modulation
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 0.18;
      lfoGain.gain.value = 0.04;
      lfo.connect(lfoGain);
      lfoGain.connect(o1.g.gain);
      lfo.start();

      nodes.push(lfo, lfoGain);
      stopFns.push(() => { try { lfo.stop(); } catch (_) {} });
    } else if (trackId === 'synth') {
      // simple arpeggio: triangle oscillator with step changes
      const main = mkOsc('triangle', 220, 0.08);
      const notes = [220, 277.18, 329.63, 440, 329.63, 277.18];
      let idx = 0;

      const interval = setInterval(() => {
        if (state.music.current !== 'synth') return;
        main.osc.frequency.setTargetAtTime(notes[idx % notes.length], ctx.currentTime, 0.01);
        idx += 1;
      }, 220);

      stopFns.push(() => clearInterval(interval));
    } else if (trackId === 'hardrock') {
      // aggressive: sawtooth + distortion + noise + "kick" pulses
      // route: osc -> waveshaper -> filter -> gain
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 110;

      const ws = mkWaveshaper(120);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1600;

      const g = ctx.createGain();
      g.gain.value = 0.10;

      osc.connect(ws);
      ws.connect(filter);
      filter.connect(g);
      g.connect(outGain);

      osc.start();
      nodes.push(osc, ws, filter, g);
      stopFns.push(() => { try { osc.stop(); } catch (_) {} });

      // noise layer
      const noise = mkNoise(0.03);

      // beat/pump
      const beatInterval = setInterval(() => {
        if (state.music.current !== 'hardrock') return;
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(0.06, t);
        g.gain.linearRampToValueAtTime(0.16, t + 0.04);
        g.gain.linearRampToValueAtTime(0.08, t + 0.16);

        noise.g.gain.cancelScheduledValues(t);
        noise.g.gain.setValueAtTime(0.01, t);
        noise.g.gain.linearRampToValueAtTime(0.05, t + 0.02);
        noise.g.gain.linearRampToValueAtTime(0.02, t + 0.18);

        // pseudo "riff" wobble
        const base = 110 + (Math.random() * 20 - 10);
        osc.frequency.setTargetAtTime(base, t, 0.01);
      }, 240);

      stopFns.push(() => clearInterval(beatInterval));
    }

    return {
      stop() {
        stopFns.forEach((fn) => fn());
      },
    };
  }

  function bindMusicUI(windowElement) {
    const status = windowElement.querySelector('#music-status');
    const stopBtn = windowElement.querySelector('#music-stop');
    const vol = windowElement.querySelector('#music-volume');
    const playBtns = windowElement.querySelectorAll('.track-play');

    const setBtnLabels = () => {
      playBtns.forEach((btn) => {
        const tid = btn.getAttribute('data-track');
        const isCurrent = (state.music.current === tid);
        btn.textContent = isCurrent ? 'Playing' : 'Play';
        btn.disabled = isCurrent;
        btn.classList.toggle('opacity-60', isCurrent);
      });
    };

    stopBtn?.addEventListener('click', () => {
      stopMusic();
      setBtnLabels();
    });

    playBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tid = btn.getAttribute('data-track');
        playTrack(tid);
        setBtnLabels();
      });
    });

    vol?.addEventListener('input', () => {
      ensureAudio();
      const v = Number(vol.value || 0) / 100;
      state.music.gain.gain.value = v;
      updateMusicStatus();
    });

    function update() {
      if (!status) return;
      const t = state.music.current;
      if (!t) status.textContent = 'aus';
      else status.textContent = `${t} läuft`;
      setBtnLabels();
    }
    windowElement._musicUpdate = update;
    update();
  }

  function updateMusicStatus() {
    // update any open music windows
    for (const [, entry] of state.winMap.entries()) {
      if (entry.type === 'music') {
        entry.el._musicUpdate?.();
      }
    }
  }

  // ====== Photo app: guard logic ======
  function bindPhotoUI(windowElement) {
    const guardState = windowElement.querySelector('#guard-state');
    const guardHint = windowElement.querySelector('#guard-hint');
    const guardAction = windowElement.querySelector('#guard-action');
    const guardSecret = windowElement.querySelector('#guard-secret');

    const render = () => {
      if (!guardState || !guardHint || !guardAction || !guardSecret) return;
      if (!state.guardAwake) {
        guardState.textContent = 'Wächter: 😴 schläft';
        guardHint.textContent = 'Spiele „Hard Rock“, um ihn aufzuwecken.';
        guardAction.classList.add('hidden');
        guardSecret.classList.add('hidden');
      } else {
        guardState.textContent = 'Wächter: 👀 wach';
        guardHint.textContent = 'Okay… du hast meine Aufmerksamkeit.';
        guardAction.classList.remove('hidden');
      }
    };

    guardAction?.addEventListener('click', () => {
      guardSecret?.classList.remove('hidden');
      guardAction.classList.add('hidden');
    });

    const onAwake = () => render();
    window.addEventListener('guard-awake', onAwake);

    // cleanup on close
    const origRemove = windowElement.remove.bind(windowElement);
    windowElement.remove = () => {
      window.removeEventListener('guard-awake', onAwake);
      origRemove();
    };

    render();
  }

  // ====== Task Manager (device info partly real, rest simulated) ======
  function bindTaskManagerUI(windowElement) {
    const dev = windowElement.querySelector('#tm-device');
    const cpuEl = windowElement.querySelector('#tm-cpu');
    const cpuBar = windowElement.querySelector('#tm-cpu-bar');
    const ramEl = windowElement.querySelector('#tm-ram');
    const ramBar = windowElement.querySelector('#tm-ram-bar');
    const netEl = windowElement.querySelector('#tm-net');
    const netBar = windowElement.querySelector('#tm-net-bar');
    const procs = windowElement.querySelector('#tm-procs');

    const nav = navigator;
    const cores = nav.hardwareConcurrency || 4;
    const mem = nav.deviceMemory; // may be undefined
    const lang = nav.language || 'unknown';
    const screenInfo = `${screen.width}×${screen.height}`;
    const platform = nav.userAgentData?.platform || nav.platform || 'unknown';

    dev.innerHTML = `
      <div><span class="opacity-70">Plattform:</span> ${escapeHtml(platform)}</div>
      <div><span class="opacity-70">Sprache:</span> ${escapeHtml(lang)}</div>
      <div><span class="opacity-70">Cores:</span> ${escapeHtml(String(cores))}</div>
      <div><span class="opacity-70">Screen:</span> ${escapeHtml(screenInfo)}</div>
      <div><span class="opacity-70">deviceMemory:</span> ${mem ? escapeHtml(String(mem)) + ' GB' : 'n/a'}</div>
    `;

    const baseCpu = 18 + Math.random() * 10;
    const baseNet = 1.2 + Math.random() * 1.5;
    const baseRam = 32 + Math.random() * 10;

    function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

    const ticker = () => {
      // simulated values
      const cpu = clamp(baseCpu + (Math.random() * 10 - 5), 1, 95);
      const net = clamp(baseNet + (Math.random() * 2.2 - 1.1), 0, 12);

      // RAM: partly real if performance.memory exists (Chrome)
      let ramPct = baseRam + (Math.random() * 8 - 4);
      const perfMem = performance?.memory;
      if (perfMem && perfMem.usedJSHeapSize && perfMem.jsHeapSizeLimit) {
        const pct = (perfMem.usedJSHeapSize / perfMem.jsHeapSizeLimit) * 100;
        // mix real+sim (so it's stable-ish but still "OS-like")
        ramPct = clamp(pct * 0.7 + ramPct * 0.3, 1, 95);
      } else {
        ramPct = clamp(ramPct, 1, 95);
      }

      cpuEl.textContent = cpu.toFixed(0);
      cpuBar.style.width = `${cpu.toFixed(0)}%`;

      ramEl.textContent = ramPct.toFixed(0);
      ramBar.style.width = `${ramPct.toFixed(0)}%`;

      netEl.textContent = net.toFixed(1);
      netBar.style.width = `${clamp((net / 12) * 100, 0, 100).toFixed(0)}%`;

      // processes = open windows
      if (procs) {
        const rows = [];
        for (const [id, entry] of state.winMap.entries()) {
          const w = entry.el;
          if (!w.isConnected) continue;

          const cpuW = clamp(Math.random() * 12, 0, 25);
          const ramW = clamp(120 + Math.random() * 380, 40, 900);

          rows.push(`
            <tr class="border-b border-gray-700/60">
              <td class="p-2">${escapeHtml(entry.title)}</td>
              <td class="p-2 text-right">${cpuW.toFixed(1)}</td>
              <td class="p-2 text-right">${ramW.toFixed(0)}</td>
              <td class="p-2 text-right">
                <button class="tm-kill px-2 py-1 rounded bg-gray-700 hover:bg-gray-600" data-kill="${escapeAttr(id)}">
                  End
                </button>
              </td>
            </tr>
          `);
        }
        procs.innerHTML = rows.join('');

        // bind kills
        procs.querySelectorAll('.tm-kill').forEach((b) => {
          b.addEventListener('click', () => {
            const wid = b.getAttribute('data-kill');
            const entry = state.winMap.get(wid);
            if (!entry) return;
            entry.el.remove();
            removeTaskbarButton(wid);
          });
        });
      }
    };

    stopTaskManagerTicker();
    state.taskManagerInterval = setInterval(ticker, 700);
    ticker();
  }

  function stopTaskManagerTicker() {
    if (state.taskManagerInterval) {
      clearInterval(state.taskManagerInterval);
      state.taskManagerInterval = null;
    }
  }

  // ====== Helpers ======
  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
  function escapeAttr(str) {
    return escapeHtml(str).replaceAll('`', '&#096;');
  }
}