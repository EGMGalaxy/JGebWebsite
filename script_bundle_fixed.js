// Virtual Desktop v4
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

  // If these are missing, nothing else can work.
  if (!desktop || !windowTemplate || !windowContainer || !taskbarItems || !clockEl) {
    throw new Error('Missing core DOM nodes (#desktop/#window-template/#window-container/#taskbar-items/#clock).');
  }

  const isMobile = window.matchMedia('(max-width: 640px)').matches || window.matchMedia('(pointer: coarse)').matches;

  // ====== Game / unlock state ======
  const GAME_BEST_KEY = 'vd_game_best';
  const CLUE2_UNLOCK_KEY = 'vd_clue2_unlocked';
  const CLUE2_UNLOCK_AT_KEY = 'vd_clue2_unlocked_at';
  // Lege dieses Bild optional in ./assets ab. Es wird erst nach einem neuen Highscore sichtbar.
  const CLUE2_SRC = './assets/loesung_teil2.png';

  // ====== Fake files ======
  const TEXT_FILES = {
    'readme.txt': 'Willkommen!\n\n- Öffne die Fotos-App.\n- die Musik-App \n- Spiele ein Spiel \n ABER ÖFFNE NICHT DIE GESPERRTE DATEI',
    'hinweis.txt': '-auf der Venus ist ein Tag länger als ein Jahr.\n Rotation: 243 Erdtage  Umlauf: 225 Erdtage\n\n-der typische Tannenduft ist wie der “Schrei” der Bäume\n\n-ich glaube ich habe hex und dez vermischt bei meinem lieblingswort\n\n-zwei zufällige ganze Zahlen sind mit ca. 60,8% Wahrscheinlichkeit teilerfremd (genau: 6/π²).\n\n-ein gemischtes 52er-Kartendeck hat 52! mögliche Reihenfolgen (≈ 8,07×10^67) – praktisch jede Mischung ist einzigartig.\n\n-mein Lieblingswort ist 53+107+69+69 hier stehen noch ein paar zufällige worte damit man es nicht an der größe der absätze sieht\n\n-ozeanische “Wellen” können unter Wasser viel größer sein als an der Oberfläche: Interne Wellen laufen entlang von Dichteschichten und können hunderte Meter Amplitude erreichen.\n\n-banach–tarski: Rein mathematisch kann man (mit Auswahlaxiom) eine Kugel so zerlegen, dass man daraus zwei gleich große Kugeln “zusammensetzen” kann – hat nichts mit realer Physik zu tun.\n\n-meine lieblingzahl ist die zahl 29 \n\n-neutrinos: Von der Sonne fliegen pro Sekunde grob ~10^14 durch deinen Körper, weil sie fast nie wechselwirken.\n\n-wombats machen tatsächlich würfelförmigen Kot – wegen spezieller Mechanik im Darm.\n\n-die Wahrscheinlichkeit, dass du beim Mischen zwei identische Kartendeck-Reihenfolgen bekommst, ist astronomisch klein (Birthday-Problem hilft beim Abschätzen, aber praktisch: “niemals”).\n',

  };

  const TEMP_UNLOCK_CODE = 'mono_Sk111270'; // temporär
  // Bild, das nach erfolgreichem Entsperren angezeigt wird (Datei in ./assets ablegen)
  const UNLOCKED_IMAGE_SRC = './assets/soeder.png';
  // ====== Wächter-Bilder (nicht in der Liste anzeigen, nur im Fotos-Flow) ======
  const GUARDIAN_SLEEP_SRC = './assets/waechter_schlaf.png';
  const GUARDIAN_AWAKE_SRC = './assets/waechter_wach.png';
  const GUARDIAN_HINT_SRC  = './assets/waechter_hinweis.png';

  // Fotos in der Bibliothek (bewusst ohne AWAKE/HINT)
  const PHOTO_LIBRARY = [
    { id: 'p1', title: 'Foto 1: Wächter', src: GUARDIAN_SLEEP_SRC },    { id: 'p3', title: 'Foto 3: Landschaft', src: './assets/foto3.png' },
  ];

  // ====== Window management ======
  let zIndex = 10;
  const windows = new Map(); // winId -> { el, type, title, icon, minimized }
  let winSeq = 0;
  let cascadeSeq = 0;
  const CASCADE_STEP_DESKTOP = 26;
  const CASCADE_STEP_MOBILE = 10;


  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function applyCascadePosition(winEl){
    cascadeSeq += 1;
    const step = isMobile ? CASCADE_STEP_MOBILE : CASCADE_STEP_DESKTOP;
    const maxShift = isMobile ? 28 : 260;
    const shift = ((cascadeSeq - 1) * step) % maxShift;

    // default base
    let leftPx = isMobile ? Math.round(window.innerWidth * 0.04 + shift) : (80 + shift);
    let topPx  = isMobile ? Math.round(window.innerHeight * 0.08 + shift * 0.6) : (60 + shift);

    // apply initial
    winEl.style.left = leftPx + 'px';
    winEl.style.top = topPx + 'px';

    // clamp inside viewport (keep taskbar visible)
    const pad = 8;
    const taskbarPad = 56;
    const rect = winEl.getBoundingClientRect();
    const maxLeft = Math.max(pad, window.innerWidth - rect.width - pad);
    const maxTop  = Math.max(pad, window.innerHeight - rect.height - taskbarPad);

    leftPx = clamp(leftPx, pad, maxLeft);
    topPx  = clamp(topPx, pad, maxTop);

    winEl.style.left = leftPx + 'px';
    winEl.style.top = topPx + 'px';
  }


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
      bindPhotos(winEl, options);
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
    } else if (type === 'notes'){
      titleEl.textContent = 'Notizen';
      iconEl.setAttribute('data-feather','file-text');
      content.appendChild(document.getElementById('notes-content').content.cloneNode(true));
      bindNotes(winEl);
    } else if (type === 'text-viewer'){
      titleEl.textContent = options.title || 'Text';
      iconEl.setAttribute('data-feather','file-text');
      content.appendChild(document.getElementById('text-view-content').content.cloneNode(true));
      const pre = winEl.querySelector('#text-viewer');
      if (pre) pre.textContent = options.text || '';
    } else if (type === 'image-viewer'){
      titleEl.textContent = options.title || 'Bild';
      iconEl.setAttribute('data-feather','image');
      content.appendChild(document.getElementById('image-view-content').content.cloneNode(true));
      const img = winEl.querySelector('#image-viewer');
      const cap = winEl.querySelector('#image-caption');
      if (img) img.src = options.src || '';
      if (cap) cap.textContent = options.caption || '';

      const root = winEl.querySelector('.img-view-root');
      if (root && options.fullbleed){
        root.classList.add('fullbleed');
      }
    } else if (type === 'game'){
      titleEl.textContent = 'Spiel';
      iconEl.setAttribute('data-feather','heart');
      if (!isMobile){ winEl.style.width = '720px'; winEl.style.height = '560px'; }

      content.appendChild(document.getElementById('game-content').content.cloneNode(true));
      bindGame(winEl);
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


    // Special initial sizing overrides
    if (type === 'image-viewer' && options?.variant === 'note') {
      if (isMobile) {
        // square 1:1 that fits on screen (leave room for taskbar and header)
        const maxSide = Math.min(window.innerWidth * 0.92, window.innerHeight - 110);
        const side = Math.max(220, Math.floor(maxSide));
        winEl.style.width = side + 'px';
        winEl.style.height = side + 'px';
      } else {
        winEl.style.width = '300px';
        winEl.style.height = '300px';
      }
    }

    windowContainer.appendChild(winEl);
    applyCascadePosition(winEl);

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
    stopGameFor(winId);

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
      const file = btn.getAttribute('data-file');
      const photoId = btn.getAttribute('data-photo-id');
      createWindow(type, { fileName: file, photoId });
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
        } else if (kind === 'photo'){
          // notiz.png soll direkt als bildfüllendes Fenster öffnen
          if ((file || '').toLowerCase() === 'notiz.png'){
            createWindow('image-viewer', { title: file, src: './assets/notiz.png', caption: '', fullbleed: true, variant: 'note' });
          } else {
            const photoId = item.dataset.photoId;
            createWindow('photos', { photoId });
          }
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

      setMsg('Entsperrt.');
      // Öffne danach direkt ein Bild-Fenster.
      // Falls ./assets/entsperrt.png nicht existiert, siehst du nur ein kaputtes Bild-Icon –
      // dann ersetze UNLOCKED_IMAGE_SRC oben durch eine Datei, die du wirklich hast.
      createWindow('image-viewer', {
        title: fileName || 'geheim.enc',
        src: UNLOCKED_IMAGE_SRC,
        caption: 'Entschlüsselt.'
      });
      cleanupWindow(winEl);
    });
  }

  function bindNotes(winEl){
    const ta = winEl.querySelector('#notes-text');
    if (!ta) return;
    const KEY = 'vd_notes_text';
    ta.value = localStorage.getItem(KEY) || '';
    ta.addEventListener('input', () => {
      localStorage.setItem(KEY, ta.value);
    });
  }

  // ====== Photos ======
  const photosRuntime = new Map(); // winId -> { selectedId, imgEl, captionEl, fadeEl, listEl }

  // ====== Game ======
  const gameRuntime = new Map(); // winId -> { raf, running, keys, player, bullets, ... }

  function bindPhotos(winEl, options = {}){
    const winId = winEl.dataset.winId;
    const listEl = winEl.querySelector('#photos-list');
    const imgEl = winEl.querySelector('#photo-img');
    const capEl = winEl.querySelector('#photo-caption');
    const fadeEl = winEl.querySelector('#photo-fade');

    if (!listEl || !imgEl || !capEl) return;

    photosRuntime.set(winId, { selectedId: null, listEl, imgEl, capEl, fadeEl });

    // visible library (extra clue appears only after unlock)
    const visibleLibrary = [...PHOTO_LIBRARY];
    if (isClue2Unlocked()){
      visibleLibrary.push({ id: 'clue2', title: 'Foto: Zusatz-Hinweis', src: CLUE2_SRC });
    }

    // render list
    listEl.innerHTML = '';
    for (const p of visibleLibrary){
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

    // open requested photo or default to first
    const requested = options.photoId ? visibleLibrary.find(p => p.id === options.photoId) : null;
    const first = requested || visibleLibrary[0];
    if (first) showPhoto(winId, first.src, first.title);

    // If hardrock already playing: animate guardian wake (only if currently sleep photo)
    maybeWakeGuardianIn(winId);
    // ===== Zoom/Pan (Wheel + Pinch) + Tür-Hotspot (funktioniert trotz Zoom) =====
    const stageEl = winEl.querySelector('.photos-stage');
    if (!stageEl) return;

    const zoom = { scale: 1, tx: 0, ty: 0 };
    const pointers = new Map();
    let dragging = { active:false, moved:false, startX:0, startY:0, startTx:0, startTy:0 };
    let pinching = { active:false, startDist:0, startScale:1, startTx:0, startTy:0, midX:0, midY:0, imgX:0, imgY:0 };

    function applyTransform(){
      imgEl.style.transform = `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`;
    }

    function clampPan(){
      const lay = photosRuntime.get(winId)?.layout;
      if (!lay) return;

      const scaledW = lay.dw * zoom.scale;
      const scaledH = lay.dh * zoom.scale;

      // If the scaled image fits, lock to center (no pan)
      if (scaledW <= lay.sw) zoom.tx = 0;
      else {
        const minLeft = lay.sw - scaledW;
        const maxLeft = 0;
        const minTx = minLeft - lay.baseLeft;
        const maxTx = maxLeft - lay.baseLeft;
        zoom.tx = clamp(zoom.tx, minTx, maxTx);
      }

      if (scaledH <= lay.sh) zoom.ty = 0;
      else {
        const minTop = lay.sh - scaledH;
        const maxTop = 0;
        const minTy = minTop - lay.baseTop;
        const maxTy = maxTop - lay.baseTop;
        zoom.ty = clamp(zoom.ty, minTy, maxTy);
      }
    }

    function relayout(){
      const sw = stageEl.clientWidth;
      const sh = stageEl.clientHeight;
      const nw = imgEl.naturalWidth || 1;
      const nh = imgEl.naturalHeight || 1;

      const aspect = nw / nh;
      let dw, dh;
      if ((sw / sh) > aspect){
        dh = sh;
        dw = dh * aspect;
      } else {
        dw = sw;
        dh = dw / aspect;
      }

      const baseLeft = (sw - dw) / 2;
      const baseTop  = (sh - dh) / 2;

      // lock the image box to the "contain" rect and transform inside it
      imgEl.style.position = 'absolute';
      imgEl.style.left = `${baseLeft}px`;
      imgEl.style.top  = `${baseTop}px`;
      imgEl.style.width = `${dw}px`;
      imgEl.style.height = `${dh}px`;

      const rt = photosRuntime.get(winId);
      if (rt) rt.layout = { sw, sh, dw, dh, baseLeft, baseTop };

      clampPan();
      applyTransform();
    }

    function resetZoom(){
      zoom.scale = 1;
      zoom.tx = 0;
      zoom.ty = 0;
      clampPan();
      applyTransform();
    }

    // expose to shared helpers
    const rtNow = photosRuntime.get(winId);
    if (rtNow){
      rtNow.zoom = zoom;
      rtNow.stageEl = stageEl;
      rtNow.resetZoom = resetZoom;
      rtNow.relayout = relayout;
    }

    // initial layout
    if (imgEl.complete) relayout();
    else imgEl.onload = () => relayout();

    const ro = new ResizeObserver(() => relayout());
    ro.observe(stageEl);
    winEl.addEventListener('remove', () => ro.disconnect());

    stageEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!photosRuntime.get(winId)?.layout) return;

      const rect = stageEl.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const lay = photosRuntime.get(winId).layout;

      const imgX = (sx - (lay.baseLeft + zoom.tx)) / zoom.scale;
      const imgY = (sy - (lay.baseTop + zoom.ty)) / zoom.scale;

      const factor = e.deltaY < 0 ? 1.10 : 0.90;
      const nextScale = clamp(zoom.scale * factor, 1, 4);

      zoom.tx = sx - lay.baseLeft - imgX * nextScale;
      zoom.ty = sy - lay.baseTop  - imgY * nextScale;
      zoom.scale = nextScale;

      clampPan();
      applyTransform();
    }, { passive: false });

    function dist(a,b){
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.hypot(dx,dy);
    }

    stageEl.addEventListener('pointerdown', (e) => {
      stageEl.setPointerCapture(e.pointerId);
      const rect = stageEl.getBoundingClientRect();
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      pointers.set(e.pointerId, p);

      dragging.active = true;
      dragging.moved = false;
      dragging.startX = p.x;
      dragging.startY = p.y;
      dragging.startTx = zoom.tx;
      dragging.startTy = zoom.ty;

      if (pointers.size === 2){
        const pts = [...pointers.values()];
        pinching.active = true;
        pinching.startDist = dist(pts[0], pts[1]);
        pinching.startScale = zoom.scale;
        pinching.startTx = zoom.tx;
        pinching.startTy = zoom.ty;

        pinching.midX = (pts[0].x + pts[1].x)/2;
        pinching.midY = (pts[0].y + pts[1].y)/2;

        const lay = photosRuntime.get(winId)?.layout;
        if (lay){
          pinching.imgX = (pinching.midX - (lay.baseLeft + zoom.tx)) / zoom.scale;
          pinching.imgY = (pinching.midY - (lay.baseTop  + zoom.ty)) / zoom.scale;
        }
      }
    });

    stageEl.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      const rect = stageEl.getBoundingClientRect();
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      pointers.set(e.pointerId, p);

      const lay = photosRuntime.get(winId)?.layout;
      if (!lay) return;

      if (pointers.size === 2){
        const pts = [...pointers.values()];
        const d = dist(pts[0], pts[1]);
        if (pinching.startDist > 0){
          const ratio = d / pinching.startDist;
          const nextScale = clamp(pinching.startScale * ratio, 1, 4);

          // zoom around the pinch midpoint
          zoom.scale = nextScale;
          zoom.tx = pinching.midX - lay.baseLeft - pinching.imgX * nextScale;
          zoom.ty = pinching.midY - lay.baseTop  - pinching.imgY * nextScale;

          clampPan();
          applyTransform();
        }
        dragging.moved = true;
        return;
      }

      // one-finger/mouse drag pan (only meaningful when zoomed)
      const dx = p.x - dragging.startX;
      const dy = p.y - dragging.startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragging.moved = true;

      if (zoom.scale > 1.001){
        zoom.tx = dragging.startTx + dx;
        zoom.ty = dragging.startTy + dy;
        clampPan();
        applyTransform();
      }
    });

    stageEl.addEventListener('pointerup', (e) => {
      pointers.delete(e.pointerId);
      try { stageEl.releasePointerCapture(e.pointerId); } catch {}

      // end pinch if needed
      if (pointers.size < 2) pinching.active = false;

      const rect = stageEl.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      // Treat as click if we didn't move
      if (!dragging.moved){
        handleSceneClick(sx, sy);
      }

      dragging.active = false;
      dragging.moved = false;
    });

    stageEl.addEventListener('pointercancel', (e) => {
      pointers.delete(e.pointerId);
      dragging.active = false;
      dragging.moved = false;
      pinching.active = false;
    });

    // double click / double tap = reset zoom
    stageEl.addEventListener('dblclick', () => resetZoom());

    function handleSceneClick(sx, sy){
      // Only when guardian awake + hardrock playing + hint not shown + currently showing the awake image
      if (state.currentTrack !== 'hardrock') return;
      if (!state.photos.guardianAwake || state.photos.hintShown) return;

      const rt = photosRuntime.get(winId);
      if (!rt || !rt.layout) return;

      const showingAwake = rt.imgEl?.src && rt.imgEl.src.includes('waechter_wach');
      if (!showingAwake) return;

      const lay = rt.layout;

      const u = (sx - (lay.baseLeft + zoom.tx)) / (lay.dw * zoom.scale);
      const v = (sy - (lay.baseTop  + zoom.ty)) / (lay.dh * zoom.scale);

      if (u < 0 || u > 1 || v < 0 || v > 1) return;

      // Door zone (adjust if needed)
      const inDoor = (u > 0.62 && u < 0.95 && v > 0.35 && v < 0.95);
      if (!inDoor) return;

      state.photos.hintShown = true;
      transitionSwap(rt, GUARDIAN_HINT_SRC, 'Hinweis');
    }
  }

    function showPhoto(winId, src, title){
    const rt = photosRuntime.get(winId);
    if (!rt) return;

    rt.selectedId = src;

    // reset zoom/pan when changing the photo
    if (rt.resetZoom) rt.resetZoom();

    // load + relayout when the image is ready
    rt.imgEl.onload = () => {
      if (rt.relayout) rt.relayout();
    };

    rt.imgEl.src = src;
    rt.capEl.textContent = title;
  }

    function transitionSwap(rt, newSrc, caption){
    if (!rt) return;

    // reset zoom/pan for the cinematic swap
    if (rt.resetZoom) rt.resetZoom();

    if (!rt.fadeEl) {
      rt.imgEl.onload = () => { if (rt.relayout) rt.relayout(); };
      rt.imgEl.src = newSrc;
      rt.capEl.textContent = caption || '';
      return;
    }

    rt.fadeEl.style.opacity = '1';
    setTimeout(() => {
      rt.imgEl.onload = () => { if (rt.relayout) rt.relayout(); };
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

  // ====== Game: simple dodge (Undertale-ish) ======
  function getBestScore(){
    const raw = localStorage.getItem(GAME_BEST_KEY);
    if (raw && !Number.isNaN(Number(raw))) return Number(raw);
    // Default: falls noch kein Highscore existiert
    const initial = 12;
    localStorage.setItem(GAME_BEST_KEY, String(initial));
    return initial;
  }

  function setBestScore(v){
    localStorage.setItem(GAME_BEST_KEY, String(v));
  }

  function isClue2Unlocked(){
    const flag = localStorage.getItem(CLUE2_UNLOCK_KEY) === '1';
    if (!flag) return false;

    const atRaw = localStorage.getItem(CLUE2_UNLOCK_AT_KEY);
    const at = atRaw == null ? NaN : Number(atRaw);

    // Legacy/buggy state: unlocked flag set but no "at" value -> treat as locked to avoid early reveal
    if (!Number.isFinite(at) || at <= 0){
      localStorage.removeItem(CLUE2_UNLOCK_KEY);
      localStorage.removeItem(CLUE2_UNLOCK_AT_KEY);
      return false;
    }

    // If best is missing for some reason, still allow if we have an "at"
    const best = getBestScore();
    return at <= best;
  }

  function unlockClue2(newBest){
    if (isClue2Unlocked()) return;
    localStorage.setItem(CLUE2_UNLOCK_KEY, '1');
    localStorage.setItem(CLUE2_UNLOCK_AT_KEY, String(newBest || getBestScore()));
    refreshOpenPhotosLibraries();
    // Show the newly unlocked image once
    createWindow('image-viewer', {
      title: 'Zusatz-Hinweis',
      src: CLUE2_SRC,
      caption: 'Freigeschaltet: dieses Bild erscheint jetzt auch in der Fotos-App.'
    });
  }

  function refreshOpenPhotosLibraries(){
    for (const [id, rt] of photosRuntime.entries()){
      const win = windows.get(id);
      if (!win) continue;
      if (win.type !== 'photos') continue;
      // re-bind by recreating list in-place
      const listEl = rt.listEl;
      if (!listEl) continue;
      const visibleLibrary = [...PHOTO_LIBRARY];
      if (isClue2Unlocked()){
        visibleLibrary.push({ id: 'clue2', title: 'Foto: Zusatz-Hinweis', src: CLUE2_SRC });
      }
      listEl.innerHTML = '';
      for (const p of visibleLibrary){
        const btn = document.createElement('button');
        btn.className = 'photos-item';
        btn.dataset.photoId = p.id;
        btn.innerHTML = `<img class="photos-thumb" alt="" src="${p.src}" onerror="this.style.opacity=0.2"/>
                         <div class="text-xs">${escapeHtml(p.title)}</div>`;
        btn.addEventListener('click', () => {
          state.photos.hintShown = false;
          state.photos.guardianAwake = false;
          showPhoto(id, p.src, p.title);
        });
        listEl.appendChild(btn);
      }
    }
    if (window.feather) feather.replace();
  }

  function bindGame(winEl){
    const winId = winEl.dataset.winId;
    const canvas = winEl.querySelector('#game-canvas');
    const startBtn = winEl.querySelector('#game-start');
    const scoreEl = winEl.querySelector('#game-score');
    const bestEl = winEl.querySelector('#game-best');
    const msgEl = winEl.querySelector('#game-msg');

    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const keys = new Set();
    const player = { x: canvas.width/2, y: canvas.height*0.7, r: 8, speed: 260 };

    // Make the canvas fit the window (and react to resize/scale)
    const stageEl = canvas.closest('.game-stage') || canvas.parentElement;
    function resizeCanvas(){
      const rect = stageEl.getBoundingClientRect();
      const w = Math.max(260, Math.floor(rect.width));
      const h = Math.max(220, Math.floor(rect.height));
      if (w <= 0 || h <= 0) return;
      if (canvas.width !== w || canvas.height !== h){
        const rx = player.x / (canvas.width || 1);
        const ry = player.y / (canvas.height || 1);
        canvas.width = w;
        canvas.height = h;
        player.x = clamp(rx * w, player.r, w - player.r);
        player.y = clamp(ry * h, player.r, h - player.r);
      }
    }

    // ResizeObserver works on desktop + mobile; fallback to window resize
    let ro = null;
    try{
      ro = new ResizeObserver(() => resizeCanvas());
      ro.observe(stageEl);
    } catch(_e){
      window.addEventListener('resize', resizeCanvas);
    }
    resizeCanvas();

    const bullets = [];
    let running = false;
    let raf = 0;
    let last = 0;
    let t = 0;
    let score = 0;
    let best = getBestScore();

    const target = best + 1;
    if (bestEl) bestEl.textContent = String(best);
    if (msgEl) msgEl.textContent = `Ziel: ${target} Sekunden überleben.`;

    function setMsg(s){ if (msgEl) msgEl.textContent = s; }
    function setScore(v){ if (scoreEl) scoreEl.textContent = String(v); }

    function reset(){
      bullets.length = 0;
      player.x = canvas.width/2;
      player.y = canvas.height*0.7;
      t = 0;
      score = 0;
      setScore(0);
    }

    function spawnBullet(opts = {}){
      // spawn from random edge (optionally aimed at the player)
      const edge = Math.floor(Math.random()*4);
      let x, y, vx, vy;

      const baseSp = 130 + Math.random()*170;
      const ramp = Math.min(260, t*9); // gets harder over time
      const sp = baseSp + ramp;

      if (edge === 0){ x = Math.random()*canvas.width; y = -14; vx = (Math.random()-0.5)*70; vy = sp; }
      else if (edge === 1){ x = canvas.width+14; y = Math.random()*canvas.height; vx = -sp; vy = (Math.random()-0.5)*70; }
      else if (edge === 2){ x = Math.random()*canvas.width; y = canvas.height+14; vx = (Math.random()-0.5)*70; vy = -sp; }
      else { x = -14; y = Math.random()*canvas.height; vx = sp; vy = (Math.random()-0.5)*70; }

      if (opts.aim){
        const dx = player.x - x;
        const dy = player.y - y;
        const len = Math.hypot(dx, dy) || 1;
        const jitter = (Math.random()-0.5) * 0.22; // slight randomness so it isn't perfect
        const ux = (dx/len) * Math.cos(jitter) - (dy/len) * Math.sin(jitter);
        const uy = (dx/len) * Math.sin(jitter) + (dy/len) * Math.cos(jitter);
        vx = ux * sp;
        vy = uy * sp;
      }

      bullets.push({ x, y, vx, vy, r: 7 + Math.random()*6 });
    }

    function collide(){
      for (const b of bullets){
        const dx = b.x - player.x;
        const dy = b.y - player.y;
        const rr = (b.r + player.r);
        if (dx*dx + dy*dy <= rr*rr) return true;
      }
      return false;
    }

    function drawHeart(x, y, size){
      // simple heart path
      ctx.beginPath();
      const s = size;
      ctx.moveTo(x, y + s*0.35);
      ctx.bezierCurveTo(x - s*0.9, y - s*0.2, x - s*0.55, y - s*0.95, x, y - s*0.45);
      ctx.bezierCurveTo(x + s*0.55, y - s*0.95, x + s*0.9, y - s*0.2, x, y + s*0.35);
      ctx.closePath();
      ctx.fill();
    }

    function loop(ts){
      if (!running) return;
      const dt = Math.min(0.033, (ts - last)/1000 || 0);
      last = ts;
      t += dt;
      score = Math.floor(t);
      setScore(score);

      // movement
      const dx = (keys.has('ArrowRight') || keys.has('d')) - (keys.has('ArrowLeft') || keys.has('a'));
      const dy = (keys.has('ArrowDown') || keys.has('s')) - (keys.has('ArrowUp') || keys.has('w'));
      player.x = clamp(player.x + dx*player.speed*dt, player.r, canvas.width - player.r);
      player.y = clamp(player.y + dy*player.speed*dt, player.r, canvas.height - player.r);

      // spawn bullets
      const spawnRate = 1.0 + Math.min(4.0, t*0.16);
      // regular spawns
      while (Math.random() < spawnRate*dt){
        spawnBullet();
      }
      // aimed shots kick in after a few seconds
      const aimRate = t < 6 ? 0 : (0.15 + Math.min(0.55, (t-6)*0.035));
      if (Math.random() < aimRate*dt){
        spawnBullet({ aim: true });
      }
      // occasional burst
      const burstRate = t < 10 ? 0 : 0.10;
      if (Math.random() < burstRate*dt){
        spawnBullet();
        spawnBullet();
      }

      // update bullets
      for (const b of bullets){
        b.x += b.vx*dt;
        b.y += b.vy*dt;
      }
      // cull
      for (let i = bullets.length - 1; i >= 0; i--){
        const b = bullets[i];
        if (b.x < -40 || b.x > canvas.width+40 || b.y < -40 || b.y > canvas.height+40) bullets.splice(i,1);
      }

      // draw
      ctx.clearRect(0,0,canvas.width,canvas.height);
      // arena
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(6,6,canvas.width-12,canvas.height-12);

      // bullets
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const b of bullets){
        ctx.beginPath();
        ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
        ctx.fill();
      }

      // player heart
      ctx.fillStyle = 'rgba(239,68,68,0.95)';
      drawHeart(player.x, player.y, player.r);

      // collision
      if (collide()){
        running = false;
        cancelAnimationFrame(raf);
        setMsg(`Game Over. Score: ${score}s`);

        const prevBest = best;
        if (score > best){
          best = score;
          setBestScore(best);
          if (bestEl) bestEl.textContent = String(best);
          setMsg(`Neuer Highscore: ${best}s. Freigeschaltet.`);
          unlockClue2(best);
        } else {
          setMsg(`Game Over. Score: ${score}s. Ziel: ${prevBest+1}s`);
        }
        return;
      }

      raf = requestAnimationFrame(loop);
    }

    function start(){
      if (running) return;
      best = getBestScore();
      if (bestEl) bestEl.textContent = String(best);
      reset();
      running = true;
      last = performance.now();
      setMsg(`Ziel: ${best+1} Sekunden überleben.`);
      raf = requestAnimationFrame(loop);
    }

    // keyboard
    const onKeyDown = (e) => {
      keys.add(e.key);
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
    };
    const onKeyUp = (e) => { keys.delete(e.key); };
    window.addEventListener('keydown', onKeyDown, { passive:false });
    window.addEventListener('keyup', onKeyUp);

    // touch / pointer: follow finger inside canvas
    const onPointerMove = (e) => {
      if (!running) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width/rect.width);
      const y = (e.clientY - rect.top) * (canvas.height/rect.height);
      player.x = clamp(x, player.r, canvas.width - player.r);
      player.y = clamp(y, player.r, canvas.height - player.r);
    };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      onPointerMove(e);
    });
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', (e) => {
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
    });

    startBtn?.addEventListener('click', start);

    gameRuntime.set(winId, {
      stop: () => {
        running = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        try{ if (ro) ro.disconnect(); } catch {}
        window.removeEventListener('resize', resizeCanvas);
      }
    });
  }

  function stopGameFor(winId){
    const rt = gameRuntime.get(winId);
    if (rt && rt.stop) rt.stop();
    gameRuntime.delete(winId);
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
    const gpuEl = winEl.querySelector('#tm-gpu');
    const netEl = winEl.querySelector('#tm-net');
    const cpuBar = winEl.querySelector('#tm-cpu-bar');
    const ramBar = winEl.querySelector('#tm-ram-bar');
    const gpuBar = winEl.querySelector('#tm-gpu-bar');
    const netBar = winEl.querySelector('#tm-net-bar');
    const procTbody = winEl.querySelector('#tm-proc');

    // real-ish info
    const ua = navigator.userAgent;
    const cores = navigator.hardwareConcurrency || '–';
    const mem = navigator.deviceMemory ? `${navigator.deviceMemory} GB (Approx)` : '–';
    const lang = navigator.language || '–';
    const plat = navigator.platform || '–';
    const scr = `${window.screen.width}×${window.screen.height} (CSS px)`;

    // some extra (simulated) hardware names for atmosphere
    const CPU_NAMES = ['Intel Core i7-12700K', 'AMD Ryzen 5 5600X', 'Intel Core i5-13600K', 'AMD Ryzen 7 5800X3D', 'Apple M2'];
    const GPU_NAMES = ['NVIDIA RTX 3060', 'NVIDIA RTX 4070', 'AMD Radeon RX 6600', 'Intel Arc A750', 'Apple GPU'];
    const MOBO_NAMES = ['ASUS TUF B550-PLUS', 'MSI MAG Z690 TOMAHAWK', 'Gigabyte B760M DS3H', 'ASRock X570 Steel Legend', 'Dell OEM Board'];

    const fakeCPU = CPU_NAMES[Math.floor(Math.random()*CPU_NAMES.length)];
    const fakeGPU = GPU_NAMES[Math.floor(Math.random()*GPU_NAMES.length)];
    const fakeMB  = MOBO_NAMES[Math.floor(Math.random()*MOBO_NAMES.length)];

    if (devEl){
      devEl.textContent =
        `CPU: ${fakeCPU} (simuliert)\n`+
        `GPU: ${fakeGPU} (simuliert)\n`+
        `Motherboard: ${fakeMB} (simuliert)\n\n`+
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
    let gpu = 22 + Math.random()*10;
    let net = 1.2 + Math.random()*1.5;

    const id = setInterval(() => {
      cpu = clamp(cpu + (Math.random()-0.5)*7, 2, 98);
      ram = clamp(ram + (Math.random()-0.5)*4, 8, 92);
      gpu = clamp(gpu + (Math.random()-0.5)*6, 1, 99);
      net = clamp(net + (Math.random()-0.5)*1.6, 0, 12);

      if (cpuEl) cpuEl.textContent = `${cpu.toFixed(0)}%`;
      if (ramEl) ramEl.textContent = `${ram.toFixed(0)}%`;
      if (gpuEl) gpuEl.textContent = `${gpu.toFixed(0)}%`;
      if (netEl) netEl.textContent = `${net.toFixed(1)} Mbit/s`;

      if (cpuBar) cpuBar.style.width = `${cpu.toFixed(0)}%`;
      if (ramBar) ramBar.style.width = `${ram.toFixed(0)}%`;
      if (gpuBar) gpuBar.style.width = `${gpu.toFixed(0)}%`;
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
