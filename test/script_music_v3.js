// Virtual Desktop v3
document.addEventListener('DOMContentLoaded', () => {
  try {
    initDesktop();
    if (window.feather) feather.replace();
  } catch (e) {
    console.error('Init failed:', e);
  }
});

function initDesktop() {
  const desktop = document.getElementById('desktop');
  const windowTemplate = document.getElementById('window-template');
  const windowContainer = document.getElementById('window-container');
  const taskbarItems = document.getElementById('taskbar-items');
  const clockEl = document.getElementById('clock');

  const isMobile = window.matchMedia('(max-width: 640px)').matches || window.matchMedia('(pointer: coarse)').matches;

  // ====== Fake files ======
  const TEXT_FILES = {
    'readme.txt': 'Willkommen!\n\n- Öffne die Fotos-App.\n- Starte Hard Rock in der Musik-App.\n- Schau dir Foto 1 an…',
    'hinweis.txt': 'Manche Dinge erscheinen nur, wenn der Wächter wach ist.\n\nTipp: Achte auf die Tür im Bild.'
  };

  const TEMP_UNLOCK_CODE = 'admin'; // temporär
  // ====== Wächter-Bilder (nicht in der Liste anzeigen, nur im Fotos-Flow) ======
  const GUARDIAN_SLEEP_SRC = './assets/waechter_schlaf.png';
  const GUARDIAN_AWAKE_SRC = './assets/waechter_wach.png';
  const GUARDIAN_HINT_SRC  = './assets/waechter_hinweis.png';

  // Fotos in der Bibliothek (bewusst ohne AWAKE/HINT)
  const PHOTO_LIBRARY = [
    { id: 'p1', title: 'Foto 1: Wächter', src: GUARDIAN_SLEEP_SRC },
    { id: 'p2', title: 'Foto 2: Notizen',  src: './assets/photo2.jpg' },
    { id: 'p3', title: 'Foto 3: Landschaft', src: './assets/photo3.jpg' },
  ];

  // ====== Window management ======
  let zIndex = 10;
  const windows = new Map(); // winId -> { el, type, title, icon, minimized }
  let winSeq = 0;

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function bringToFront(winEl){
    zIndex += 1;
    winEl.style.zIndex = String(zIndex);
    // active highlight in taskbar
    for (const [id, w] of windows.entries()){
      const btn = taskbarItems.querySelector(`[data-win-id="${id}"]`);
      if (btn) btn.classList.toggle('active', w.el === winEl && !w.el.classList.contains('minimized'));
    }
  }

  function createWindow(type, options = {}){
    const clone = windowTemplate.content.cloneNode(true);
    const winEl = clone.querySelector('.window');
    const content = winEl.querySelector('.window-content');
    const iconEl = winEl.querySelector('.window-icon');
    const titleEl = winEl.querySelector('.window-title');

    const winId = `w${++winSeq}`;
    winEl.dataset.winId = winId;

    // mobile default size/position
    if (isMobile){
      winEl.style.width = '92vw';
      winEl.style.height = '70vh';
      winEl.style.left = '4vw';
      winEl.style.top = '8vh';
    }

    // fill content
    if (type === 'explorer'){
      titleEl.textContent = 'Explorer';
      iconEl.setAttribute('data-feather','folder');
      content.appendChild(document.getElementById('explorer-content').content.cloneNode(true));
      bindExplorer(winEl);
    } else if (type === 'photos'){
      titleEl.textContent = 'Fotos';
      iconEl.setAttribute('data-feather','image');
      content.appendChild(document.getElementById('photos-content').content.cloneNode(true));
      bindPhotos(winEl);
    } else if (type === 'music'){
      titleEl.textContent = 'Musik';
      iconEl.setAttribute('data-feather','music');
      content.appendChild(document.getElementById('music-content').content.cloneNode(true));
      bindMusic(winEl);
    } else if (type === 'settings'){
      titleEl.textContent = 'Settings';
      iconEl.setAttribute('data-feather','settings');
      content.appendChild(document.getElementById('settings-content').content.cloneNode(true));
      bindSettings(winEl);
    } else if (type === 'taskmanager'){
      titleEl.textContent = 'Task Manager';
      iconEl.setAttribute('data-feather','activity');
      content.appendChild(document.getElementById('taskmanager-content').content.cloneNode(true));
      bindTaskManager(winEl);
    } else if (type === 'text-viewer'){
      titleEl.textContent = options.title || 'Text';
      iconEl.setAttribute('data-feather','file-text');
      content.appendChild(document.getElementById('text-view-content').content.cloneNode(true));
      const pre = winEl.querySelector('#text-viewer');
      if (pre) pre.textContent = options.text || '';
    } else if (type === 'unlock'){
      titleEl.textContent = 'Datei entsperren';
      iconEl.setAttribute('data-feather','lock');
      content.appendChild(document.getElementById('unlock-content').content.cloneNode(true));
      bindUnlock(winEl, options.fileName);
    } else {
      titleEl.textContent = 'Window';
      iconEl.setAttribute('data-feather','square');
      content.innerHTML = '<div class="p-3">Unknown window.</div>';
    }

    windowContainer.appendChild(winEl);
    windows.set(winId, { el: winEl, type, title: titleEl.textContent, icon: iconEl.getAttribute('data-feather') || 'square' });

    initWindowControls(winEl);
    initDrag(winEl);
    initResize(winEl);

    bringToFront(winEl);
    addTaskbarItem(winId);

    if (window.feather) feather.replace();
    return winEl;
  }

  function addTaskbarItem(winId){
    const w = windows.get(winId);
    if (!w) return;

    const btn = document.createElement('button');
    btn.className = 'taskbar-item';
    btn.dataset.winId = winId;
    btn.innerHTML = `<span class="flex items-center gap-2"><i data-feather="${w.icon}"></i><span class="truncate">${escapeHtml(w.title)}</span></span>`;
    btn.addEventListener('click', () => {
      if (!windows.has(winId)) return;
      const winEl = windows.get(winId).el;
      if (winEl.classList.contains('minimized')){
        winEl.classList.remove('minimized');
        bringToFront(winEl);
      } else {
        // toggle minimize
        winEl.classList.add('minimized');
      }
      updateTaskbarActive();
      if (window.feather) feather.replace();
    });
    taskbarItems.appendChild(btn);
    if (window.feather) feather.replace();
    updateTaskbarActive();
  }

  function removeTaskbarItem(winId){
    const btn = taskbarItems.querySelector(`[data-win-id="${winId}"]`);
    if (btn) btn.remove();
  }

  function updateTaskbarActive(){
    for (const [id, w] of windows.entries()){
      const btn = taskbarItems.querySelector(`[data-win-id="${id}"]`);
      if (!btn) continue;
      btn.classList.toggle('active', !w.el.classList.contains('minimized') && w.el.style.zIndex === String(zIndex));
    }
  }

  function initWindowControls(winEl){
    const winId = winEl.dataset.winId;
    const minimize = winEl.querySelector('.window-btn.minimize');
    const maximize = winEl.querySelector('.window-btn.maximize');
    const close = winEl.querySelector('.window-btn.close');

    minimize?.addEventListener('click', (e) => {
      e.stopPropagation();
      winEl.classList.add('minimized');
      updateTaskbarActive();
    });

    maximize?.addEventListener('click', (e) => {
      e.stopPropagation();
      winEl.classList.toggle('maximized');
      bringToFront(winEl);
      // swap icon safely (Feather turns into SVG)
      const iconName = winEl.classList.contains('maximized') ? 'minimize-2' : 'square';
      maximize.innerHTML = `<i data-feather="${iconName}"></i>`;
      if (window.feather) feather.replace();
    });

    close?.addEventListener('click', (e) => {
      e.stopPropagation();
      cleanupWindow(winEl);
    });
  }

  function cleanupWindow(winEl){
    const winId = winEl.dataset.winId;
    // stop app loops tied to this window
    stopTaskManagerFor(winId);
    stopPhotosFor(winId);
    stopMusicBindingsFor(winId);

    winEl.remove();
    windows.delete(winId);
    removeTaskbarItem(winId);
    updateTaskbarActive();
  }

  function initDrag(winEl){
    const header = winEl.querySelector('.window-header');
    if (!header) return;

    let dragging = false;
    let startX=0, startY=0, startLeft=0, startTop=0;

    header.addEventListener('pointerdown', (e) => {
      // don't drag when clicking buttons
      if (e.target.closest('button')) return;
      dragging = true;
      winEl.classList.add('window-dragging');
      bringToFront(winEl);

      const rect = winEl.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      header.setPointerCapture(e.pointerId);
    });

    header.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      if (winEl.classList.contains('maximized')) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const maxLeft = window.innerWidth - winEl.offsetWidth;
      const maxTop  = window.innerHeight - parseInt(getComputedStyle(document.documentElement).getPropertyValue('--taskbar-h') || '52',10) - winEl.offsetHeight;

      winEl.style.left = clamp(startLeft + dx, 0, Math.max(0,maxLeft)) + 'px';
      winEl.style.top  = clamp(startTop + dy, 0, Math.max(0,maxTop)) + 'px';
    });

    header.addEventListener('pointerup', (e) => {
      dragging = false;
      winEl.classList.remove('window-dragging');
      try { header.releasePointerCapture(e.pointerId); } catch {}
    });
  }

  function initResize(winEl){
    const handle = winEl.querySelector('.resize-handle');
    if (!handle) return;

    let resizing=false;
    let startX=0, startY=0, startW=0, startH=0;

    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      resizing = true;
      bringToFront(winEl);

      startX = e.clientX;
      startY = e.clientY;
      startW = winEl.offsetWidth;
      startH = winEl.offsetHeight;

      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', (e) => {
      if (!resizing) return;
      if (winEl.classList.contains('maximized')) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const minW = 260;
      const minH = 180;

      const maxW = window.innerWidth - winEl.getBoundingClientRect().left;
      const maxH = window.innerHeight - parseInt(getComputedStyle(document.documentElement).getPropertyValue('--taskbar-h') || '52',10) - winEl.getBoundingClientRect().top;

      const w = clamp(startW + dx, minW, Math.max(minW, maxW));
      const h = clamp(startH + dy, minH, Math.max(minH, maxH));

      winEl.style.width = w + 'px';
      winEl.style.height = h + 'px';
    });

    handle.addEventListener('pointerup', (e) => {
      resizing=false;
      try { handle.releasePointerCapture(e.pointerId); } catch {}
    });
  }

  // ====== Desktop icon click ======
  document.querySelectorAll('.desktop-icon').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-window');
      createWindow(type);
    });
  });

  // ====== Clock ======
  function tickClock(){
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    clockEl.textContent = `${hh}:${mm}`;
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ====== Settings: theme/wall ======
  const state = {
    theme: localStorage.getItem('vd_theme') || 'dark',
    wall: localStorage.getItem('vd_wall') || 'default',
    currentTrack: null,
    photos: {
      guardianAwake: false,
      hintShown: false
    }
  };

  function applyTheme(){
    if (state.theme === 'light'){
      document.body.classList.remove('bg-gray-900','text-white');
      document.body.classList.add('bg-gray-100','text-black');
    } else {
      document.body.classList.remove('bg-gray-100','text-black');
      document.body.classList.add('bg-gray-900','text-white');
    }
  }

  function applyWallpaper(){
    desktop.classList.remove('wall-default','wall-mountain','wall-beach','wall-matrix');
    desktop.classList.add(`wall-${state.wall}`);
  }

  applyTheme();
  applyWallpaper();

  // ====== Explorer ======
  function bindExplorer(winEl){
    winEl.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', () => {
        const kind = item.dataset.open;
        const file = item.dataset.file;
        if (kind === 'txt'){
          createWindow('text-viewer', { title: file, text: TEXT_FILES[file] || '(leer)' });
        } else if (kind === 'enc'){
          createWindow('unlock', { fileName: file });
        }
      });
    });
  }

  // ====== Unlock ======
  function bindUnlock(winEl, fileName){
    const input = winEl.querySelector('#unlock-code');
    const btn = winEl.querySelector('#unlock-btn');
    const cancel = winEl.querySelector('#unlock-cancel');
    const msg = winEl.querySelector('#unlock-msg');

    let lockUntil = 0;
    function setMsg(t){ msg.textContent = t; }

    cancel?.addEventListener('click', () => cleanupWindow(winEl));

    btn?.addEventListener('click', () => {
      const now = Date.now();
      if (now < lockUntil) return;

      const code = (input.value || '').trim();
      if (!code){ setMsg('Bitte Code eingeben.'); return; }

      if (code !== TEMP_UNLOCK_CODE){
        const cooldownMs = 2000;
        lockUntil = now + cooldownMs;
        input.disabled = true;
        btn.disabled = true;

        const timer = setInterval(() => {
          const left = lockUntil - Date.now();
          if (left <= 0){
            clearInterval(timer);
            input.disabled = false;
            btn.disabled = false;
            setMsg('Nochmal versuchen.');
          } else {
            setMsg(`Falscher Code. Warte ${(left/1000).toFixed(1)}s…`);
          }
        }, 100);
        return;
      }

      setMsg('✅ Entsperrt.');
      createWindow('text-viewer', { title: fileName || 'geheim.enc', text: 'Access granted.' });
      cleanupWindow(winEl);
    });
  }

  // ====== Photos ======
  const photosRuntime = new Map(); // winId -> { selectedId, imgEl, captionEl, fadeEl, listEl }

  function bindPhotos(winEl){
    const winId = winEl.dataset.winId;
    const listEl = winEl.querySelector('#photos-list');
    const imgEl = winEl.querySelector('#photo-img');
    const capEl = winEl.querySelector('#photo-caption');
    const fadeEl = winEl.querySelector('#photo-fade');

    if (!listEl || !imgEl || !capEl) return;

    photosRuntime.set(winId, { selectedId: null, listEl, imgEl, capEl, fadeEl });

    // render list
    listEl.innerHTML = '';
    for (const p of PHOTO_LIBRARY){
      const btn = document.createElement('button');
      btn.className = 'photos-item';
      btn.dataset.photoId = p.id;
      btn.innerHTML = `<img class="photos-thumb" alt="" src="${p.src}" onerror="this.style.opacity=0.2"/>
                       <div class="text-xs">${escapeHtml(p.title)}</div>`;
      btn.addEventListener('click', () => {
        state.photos.hintShown = false;
        state.photos.guardianAwake = false;
        showPhoto(winId, p.src, p.title);
      });
      listEl.appendChild(btn);
    }

    // default: first photo
    const first = PHOTO_LIBRARY[0];
    if (first) showPhoto(winId, first.src, first.title);

    // If hardrock already playing: animate guardian wake (only if currently sleep photo)
    maybeWakeGuardianIn(winId);

    // Door hotspot click
    imgEl.addEventListener('click', (e) => {
      const rt = photosRuntime.get(winId);
      if (!rt) return;

      // Only when guardian awake and hint not shown
      if (!state.photos.guardianAwake || state.photos.hintShown) return;

      const rect = imgEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // Door zone (adjust if needed)
      const inDoor = (x > 0.62 && x < 0.95 && y > 0.35 && y < 0.95);
      if (!inDoor) return;

      // swap to hint
      state.photos.hintShown = true;
      transitionSwap(rt, GUARDIAN_HINT_SRC, 'Hinweis');
    });
  }

  function showPhoto(winId, src, title){
    const rt = photosRuntime.get(winId);
    if (!rt) return;
    rt.selectedId = src;
    rt.imgEl.src = src;
    rt.capEl.textContent = title;
  }

  function transitionSwap(rt, newSrc, caption){
    if (!rt.fadeEl) {
      rt.imgEl.src = newSrc;
      rt.capEl.textContent = caption || '';
      return;
    }
    rt.fadeEl.style.opacity = '1';
    setTimeout(() => {
      rt.imgEl.src = newSrc;
      rt.capEl.textContent = caption || '';
      setTimeout(() => rt.fadeEl.style.opacity = '0', 40);
    }, 140);
  }

  function maybeWakeGuardianIn(winId){
    const rt = photosRuntime.get(winId);
    if (!rt) return;

    // Only if hardrock playing and currently showing the sleep image AND hint not shown
    if (state.currentTrack !== 'hardrock') return;
    if (state.photos.hintShown) return;

    // if already awake, keep
    if (state.photos.guardianAwake) return;

    // Only if current image is the sleep src
    const showingSleep = rt.imgEl?.src && rt.imgEl.src.includes('waechter_schlaf');
    if (!showingSleep) return;

    state.photos.guardianAwake = true;
    transitionSwap(rt, GUARDIAN_AWAKE_SRC, 'Wächter (wach)');
  }

  function maybeSleepGuardianInAll(){
    // if hardrock stopped and we haven't shown hint, go back to sleep image for any open photos windows
    if (state.currentTrack === 'hardrock') return;
    if (state.photos.hintShown) return;

    state.photos.guardianAwake = false;

    for (const [winId, rt] of photosRuntime.entries()){
      const showingAwake = rt.imgEl?.src && rt.imgEl.src.includes('waechter_wach');
      if (showingAwake){
        transitionSwap(rt, GUARDIAN_SLEEP_SRC, 'Foto 1: Wächter');
      }
    }
  }

  function stopPhotosFor(winId){
    photosRuntime.delete(winId);
  }

  // ====== Music ======
  // MP3 optional; fallback to WebAudio synth
  const audioState = {
    audioEl: null,
    ctx: null,
    nodes: null
  };

  function bindMusic(winEl){
    const winId = winEl.dataset.winId;
    const nowEl = winEl.querySelector('#music-now');
    const stopBtn = winEl.querySelector('#music-stop');
    const trackBtns = winEl.querySelectorAll('.track-btn');

    function setNow(text){
      if (nowEl) nowEl.textContent = text;
    }

    async function playTrack(track){
      stopAllAudio();

      state.currentTrack = track;
      if (track === 'hardrock') desktop.classList.add('shaking');
      else desktop.classList.remove('shaking');

      // If photos open and hardrock starts, wake guardian animation
      if (track === 'hardrock'){
        for (const winId of photosRuntime.keys()){
          maybeWakeGuardianIn(winId);
        }
      } else {
        maybeSleepGuardianInAll();
      }

      // Try MP3
      const srcMap = {
        ambient: './assets/ambient.mp3',
        synth: './assets/synth.mp3',
        hardrock: './assets/hardrock.mp3'
      };

      const trySrc = srcMap[track];
      const a = new Audio();
      a.src = trySrc;
      a.loop = true;
      a.preload = 'auto';
      a.crossOrigin = 'anonymous';

      audioState.audioEl = a;

      try {
        await a.play();
        setNow(`Spielt: ${trackLabel(track)} (MP3)`);
        return;
      } catch (err) {
        // fallback to WebAudio
        audioState.audioEl = null;
        startSynth(track);
        setNow(`Spielt: ${trackLabel(track)} (Synth)`);
      }
    }

    stopBtn?.addEventListener('click', () => {
      stopAllAudio();
      setNow('Nichts spielt');
    });

    trackBtns.forEach(b => {
      b.addEventListener('click', () => playTrack(b.dataset.track));
    });
  }

  function stopMusicBindingsFor(winId){
    // nothing persistent per-window except UI elements
  }

  function trackLabel(track){
    if (track === 'ambient') return 'Ambient';
    if (track === 'synth') return 'Chill Synth';
    if (track === 'hardrock') return 'Hard Rock';
    return track;
  }

  function stopAllAudio(){
    desktop.classList.remove('shaking');
    if (audioState.audioEl){
      try { audioState.audioEl.pause(); } catch {}
      audioState.audioEl = null;
    }
    if (audioState.ctx && audioState.ctx.state !== 'closed'){
      try { audioState.ctx.close(); } catch {}
    }
    audioState.ctx = null;
    audioState.nodes = null;

    const prev = state.currentTrack;
    state.currentTrack = null;
    if (prev === 'hardrock') maybeSleepGuardianInAll();
  }

  function startSynth(track){
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioState.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);

    if (track === 'ambient'){
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 110;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.15;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 60;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      const g = ctx.createGain();
      g.gain.value = 0.4;

      osc.connect(g);
      g.connect(master);

      osc.start(); lfo.start();

      audioState.nodes = { osc, lfo, g, master };
      return;
    }

    if (track === 'synth'){
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 220;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;

      const g = ctx.createGain();
      g.gain.value = 0.35;

      osc.connect(filter);
      filter.connect(g);
      g.connect(master);
      osc.start();

      // simple note wobble
      const seq = [220, 247, 262, 294, 262, 247];
      let i = 0;
      const int = setInterval(() => {
        if (!audioState.ctx || audioState.ctx.state === 'closed'){ clearInterval(int); return; }
        osc.frequency.setTargetAtTime(seq[i % seq.length], ctx.currentTime, 0.02);
        i++;
      }, 420);

      audioState.nodes = { osc, filter, g, master, int };
      return;
    }

    // hardrock (rough): saw + distortion + noise
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 110;

    const dist = ctx.createWaveShaper();
    dist.curve = makeDistortionCurve(260);
    dist.oversample = '4x';

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 850;
    filter.Q.value = 0.9;

    const g = ctx.createGain();
    g.gain.value = 0.55;

    osc.connect(dist);
    dist.connect(filter);
    filter.connect(g);
    g.connect(master);

    // kick-ish pulse
    const int = setInterval(() => {
      if (!audioState.ctx || audioState.ctx.state === 'closed'){ clearInterval(int); return; }
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.55, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.14);
      osc.frequency.setTargetAtTime(98 + Math.random()*22, t, 0.02);
    }, 160);

    osc.start();
    audioState.nodes = { osc, dist, filter, g, master, int };
  }

  function makeDistortionCurve(amount){
    const k = typeof amount === 'number' ? amount : 50;
    const n = 44100;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; i++){
      const x = i * 2 / n - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // ====== Settings binding ======
  function bindSettings(winEl){
    winEl.querySelectorAll('.set-theme').forEach(b => {
      b.addEventListener('click', () => {
        state.theme = b.dataset.theme;
        localStorage.setItem('vd_theme', state.theme);
        applyTheme();
      });
    });
    winEl.querySelectorAll('.set-wall').forEach(b => {
      b.addEventListener('click', () => {
        state.wall = b.dataset.wall;
        localStorage.setItem('vd_wall', state.wall);
        applyWallpaper();
      });
    });
  }

  // ====== Task Manager ======
  const tmIntervals = new Map(); // winId -> intervalId

  function bindTaskManager(winEl){
    const winId = winEl.dataset.winId;
    const devEl = winEl.querySelector('#tm-device');
    const cpuEl = winEl.querySelector('#tm-cpu');
    const ramEl = winEl.querySelector('#tm-ram');
    const netEl = winEl.querySelector('#tm-net');
    const cpuBar = winEl.querySelector('#tm-cpu-bar');
    const ramBar = winEl.querySelector('#tm-ram-bar');
    const netBar = winEl.querySelector('#tm-net-bar');
    const procTbody = winEl.querySelector('#tm-proc');

    // real-ish info
    const ua = navigator.userAgent;
    const cores = navigator.hardwareConcurrency || '–';
    const mem = navigator.deviceMemory ? `${navigator.deviceMemory} GB (Approx)` : '–';
    const lang = navigator.language || '–';
    const plat = navigator.platform || '–';
    const scr = `${window.screen.width}×${window.screen.height} (CSS px)`;

    if (devEl){
      devEl.textContent =
        `User-Agent: ${ua}\n`+
        `Platform: ${plat}\n`+
        `Language: ${lang}\n`+
        `Cores: ${cores}\n`+
        `Device Memory: ${mem}\n`+
        `Screen: ${scr}`;
    }

    // simulated baseline
    let cpu = 18 + Math.random()*10;
    let ram = 34 + Math.random()*10;
    let net = 1.2 + Math.random()*1.5;

    const id = setInterval(() => {
      cpu = clamp(cpu + (Math.random()-0.5)*7, 2, 98);
      ram = clamp(ram + (Math.random()-0.5)*4, 8, 92);
      net = clamp(net + (Math.random()-0.5)*1.6, 0, 12);

      if (cpuEl) cpuEl.textContent = `${cpu.toFixed(0)}%`;
      if (ramEl) ramEl.textContent = `${ram.toFixed(0)}%`;
      if (netEl) netEl.textContent = `${net.toFixed(1)} Mbit/s`;

      if (cpuBar) cpuBar.style.width = `${cpu.toFixed(0)}%`;
      if (ramBar) ramBar.style.width = `${ram.toFixed(0)}%`;
      if (netBar) netBar.style.width = `${clamp((net/12)*100,0,100).toFixed(0)}%`;

      // process list = windows
      if (procTbody){
        procTbody.innerHTML = '';
        for (const [id, w] of windows.entries()){
          const simCpu = clamp((Math.random()*7) + (w.type === 'taskmanager' ? 1.0 : 0.2), 0, 18);
          const simRam = clamp((Math.random()*120) + 50, 20, 360);
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="p-2">${escapeHtml(w.title)}</td>
            <td class="p-2 text-right">${simCpu.toFixed(1)}%</td>
            <td class="p-2 text-right">${simRam.toFixed(0)} MB</td>
            <td class="p-2 text-right"><button class="btn-chip" data-kill="${id}">End</button></td>
          `;
          procTbody.appendChild(tr);
        }
        procTbody.querySelectorAll('button[data-kill]').forEach(b => {
          b.addEventListener('click', () => {
            const targetId = b.dataset.kill;
            const ww = windows.get(targetId);
            if (ww) cleanupWindow(ww.el);
          });
        });
      }
    }, 450);

    tmIntervals.set(winId, id);
  }

  function stopTaskManagerFor(winId){
    const id = tmIntervals.get(winId);
    if (id) clearInterval(id);
    tmIntervals.delete(winId);
  }

  // ====== Wallpaper classes (very simple) ======
  const wallCSS = document.createElement('style');
  wallCSS.textContent = `
    #desktop.wall-default{ background: radial-gradient(circle at 20% 10%, rgba(99,102,241,0.35), transparent 55%), radial-gradient(circle at 80% 60%, rgba(34,197,94,0.22), transparent 50%); }
    #desktop.wall-mountain{ background: linear-gradient(135deg, rgba(2,6,23,1), rgba(30,41,59,1)); }
    #desktop.wall-beach{ background: linear-gradient(135deg, rgba(2,132,199,0.25), rgba(251,191,36,0.12)); }
    #desktop.wall-matrix{ background: radial-gradient(circle at 30% 20%, rgba(34,197,94,0.18), transparent 60%), linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,1)); }
  `;
  document.head.appendChild(wallCSS);

  // ====== helpers ======
  function escapeHtml(s){
    return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
}
