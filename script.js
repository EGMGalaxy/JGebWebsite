document.addEventListener('DOMContentLoaded', () => {
  initDesktop();
  if (window.feather) feather.replace();
});

function initDesktop() {
  const desktopIcons = document.querySelectorAll('.desktop-icon');
  const windowContainer = document.getElementById('window-container');
  const windowTemplate = document.getElementById('window-template');

  // Taskbar
  const taskbarWindows = document.getElementById('taskbar-windows');

  const isMobile =
    window.matchMedia('(max-width: 640px)').matches ||
    window.matchMedia('(pointer: coarse)').matches;

  // === TEMPORÄR: richtiger Code ===
  const TEMP_UNLOCK_CODE = 'admin';

  // === "Encrypted files" mapping ===
  // Passe imageSrc an (dein Bild muss dort liegen)
  const ENCRYPTED_FILES = {
    'case-01': {
      filename: 'secret.png',
      imageSrc: './assets/soeder.png',
    },
  };

  // Cooldown nach falschem Code (global; du kannst das auch pro-fileId machen)
  const COOLDOWN_MS = 2000;
  let lockedUntil = 0;

  // Window registry for Taskbar + Task Manager
  let winCounter = 0;
  const windowsById = new Map(); // id -> { el, type, title, icon, memMB }
  let activeWinId = null;

  function clamp(n, a, b) {
    return Math.min(b, Math.max(a, n));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function isMinimized(winEl) {
    return winEl.classList.contains('minimized');
  }

  function closeWindow(winEl) {
    if (!winEl) return;

    // stop live timers if any
    if (winEl._tmInterval) {
      clearInterval(winEl._tmInterval);
      winEl._tmInterval = null;
    }

    const id = winEl.dataset.winId;
    if (id && windowsById.has(id)) {
      const entry = windowsById.get(id);
      if (entry?.btn) entry.btn.remove();
      windowsById.delete(id);
      if (activeWinId === id) activeWinId = null;
      updateTaskbarActive();
    }

    winEl.remove();
  }

  function restoreWindow(winEl) {
    if (!winEl) return;
    winEl.classList.remove('minimized');
    bringToFront(winEl);
    updateTaskbarActive();
  }

  function createTaskbarButton(entry) {
    if (!taskbarWindows) return null;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'taskbar-btn px-2 py-1 rounded-md bg-gray-700/60 hover:bg-gray-600/80 flex items-center gap-2 max-w-[220px] min-w-[90px]';
    btn.dataset.winId = entry.id;
    btn.title = entry.title;

    const iconName = entry.icon || 'square';
    btn.innerHTML = `
      <i data-feather="${iconName}" class="shrink-0"></i>
      <span class="truncate">${entry.title}</span>
    `;

    btn.addEventListener('click', () => {
      const e = windowsById.get(entry.id);
      if (!e) return;
      if (isMinimized(e.el)) {
        restoreWindow(e.el);
      } else {
        bringToFront(e.el);
      }
    });

    taskbarWindows.appendChild(btn);
    if (window.feather) feather.replace();
    return btn;
  }

  function updateTaskbarActive() {
    if (!taskbarWindows) return;
    taskbarWindows.querySelectorAll('.taskbar-btn').forEach((btn) => {
      const id = btn.dataset.winId;
      const entry = id ? windowsById.get(id) : null;
      const minimized = entry?.el ? isMinimized(entry.el) : false;

      btn.classList.toggle('taskbar-btn-active', id === activeWinId);
      btn.classList.toggle('opacity-60', minimized);
    });
  }

  function registerWindow(winEl, type) {
    const title = winEl.querySelector('.window-title')?.textContent?.trim() || 'Window';
    const icon = winEl.querySelector('.window-icon')?.getAttribute('data-feather') || 'square';

    const id = `w${++winCounter}`;
    winEl.dataset.winId = id;
    winEl.dataset.winType = type;

    // simulated RAM footprint per window
    const baseByType = {
      notes: 110,
      explorer: 160,
      settings: 90,
      taskmanager: 140,
      'encrypted-file': 70,
      'image-viewer': 220,
    };
    const memMB = Math.round((baseByType[type] || 120) + rand(0, 80));
    winEl.dataset.memMB = String(memMB);

    const entry = { id, el: winEl, type, title, icon, memMB, btn: null };
    entry.btn = createTaskbarButton(entry);

    windowsById.set(id, entry);
    activeWinId = id;
    updateTaskbarActive();
  }

  function createWindow(type, options = {}) {
    const windowClone = windowTemplate.content.cloneNode(true);
    const windowElement = windowClone.querySelector('.window');
    const contentContainer = windowElement.querySelector('.window-content');

    switch (type) {
      case 'notes': {
        const notesContent = document.getElementById('notes-content')?.content.cloneNode(true);
        if (notesContent) contentContainer.appendChild(notesContent);
        windowElement.querySelector('.window-title').textContent = 'Notes';
        windowElement.querySelector('.window-icon').setAttribute('data-feather', 'file-text');
        break;
      }
      case 'explorer': {
        const explorerContent = document.getElementById('explorer-content')?.content.cloneNode(true);
        if (explorerContent) contentContainer.appendChild(explorerContent);
        windowElement.querySelector('.window-title').textContent = 'File Explorer';
        windowElement.querySelector('.window-icon').setAttribute('data-feather', 'folder');
        break;
      }
      case 'settings': {
        const settingsContent = document.getElementById('settings-content')?.content.cloneNode(true);
        if (settingsContent) contentContainer.appendChild(settingsContent);
        windowElement.querySelector('.window-title').textContent = 'Settings';
        windowElement.querySelector('.window-icon').setAttribute('data-feather', 'settings');
        break;
      }
      case 'taskmanager': {
        const tmTpl = document.getElementById('taskmanager-content');
        if (!tmTpl) {
          console.error('Missing template #taskmanager-content in index.html');
          break;
        }
        contentContainer.appendChild(tmTpl.content.cloneNode(true));
        windowElement.querySelector('.window-title').textContent = 'Task Manager';
        windowElement.querySelector('.window-icon').setAttribute('data-feather', 'cpu');

        // bind live updater
        bindTaskManager(windowElement);
        break;
      }
      case 'encrypted-file': {
        const unlockTpl = document.getElementById('unlock-content');
        if (!unlockTpl) {
          console.error('Missing template #unlock-content in index.html');
          break;
        }
        contentContainer.appendChild(unlockTpl.content.cloneNode(true));
        windowElement.querySelector('.window-title').textContent = 'Datei entsperren';
        windowElement.querySelector('.window-icon').setAttribute('data-feather', 'lock');

        bindUnlockUI(windowElement, options.fileId);
        break;
      }
      case 'image-viewer': {
        const imgTpl = document.getElementById('image-view-content');
        if (!imgTpl) {
          console.error('Missing template #image-view-content in index.html');
          break;
        }
        contentContainer.appendChild(imgTpl.content.cloneNode(true));
        windowElement.querySelector('.window-title').textContent = options.title || 'Bild';
        windowElement.querySelector('.window-icon').setAttribute('data-feather', 'image');

        const img = windowElement.querySelector('#secret-image');
        if (img) img.src = options.src || '';
        break;
      }
      default:
        windowElement.querySelector('.window-title').textContent = 'Window';
        windowElement.querySelector('.window-icon').setAttribute('data-feather', 'square');
    }

    // Default size + initial position
    if (isMobile) {
      windowElement.classList.add('mobile-window');
      windowElement.style.width = '92vw';
      windowElement.style.height = '70vh';
      windowElement.style.left = '4vw';
      windowElement.style.top = '10vh';
    } else {
      const maxLeft = Math.max(60, window.innerWidth - 520);
      const maxTop = Math.max(60, window.innerHeight - 420);
      windowElement.style.left = `${Math.floor(40 + Math.random() * (maxLeft - 40))}px`;
      windowElement.style.top = `${Math.floor(40 + Math.random() * (maxTop - 40))}px`;
    }

    windowContainer.appendChild(windowElement);
    initWindowControls(windowElement);
    bringToFront(windowElement);

    // register AFTER title/icon have been set
    registerWindow(windowElement, type);

    if (window.feather) feather.replace();
    return windowElement;
  }

  function bindUnlockUI(windowElement, fileId) {
    const codeInput = windowElement.querySelector('#unlock-code');
    const unlockBtn = windowElement.querySelector('#unlock-btn');
    const cancelBtn = windowElement.querySelector('#unlock-cancel');
    const msg = windowElement.querySelector('#unlock-msg');

    if (!codeInput || !unlockBtn || !cancelBtn || !msg) {
      console.error('Unlock UI elements missing. Check template #unlock-content.');
      return;
    }

    const setLocked = (locked, text = '') => {
      codeInput.disabled = locked;
      unlockBtn.disabled = locked;
      if (locked) {
        unlockBtn.classList.add('opacity-60', 'cursor-not-allowed');
      } else {
        unlockBtn.classList.remove('opacity-60', 'cursor-not-allowed');
      }
      msg.textContent = text;
    };

    cancelBtn.addEventListener('click', () => closeWindow(windowElement));

    unlockBtn.addEventListener('click', () => {
      try {
        const now = Date.now();
        if (now < lockedUntil) {
          const remaining = Math.ceil((lockedUntil - now) / 100) / 10;
          setLocked(true, `⏳ Bitte warte ${remaining.toFixed(1)}s…`);
          return;
        }

        msg.textContent = '';
        const code = (codeInput.value || '').trim();
        const file = ENCRYPTED_FILES[fileId];

        if (!file) {
          msg.textContent = '❌ Datei nicht gefunden.';
          return;
        }
        if (!code) {
          msg.textContent = 'Bitte Code eingeben.';
          return;
        }

        if (code !== TEMP_UNLOCK_CODE) {
          lockedUntil = Date.now() + COOLDOWN_MS;

          let timer = null;
          const tick = () => {
            const left = lockedUntil - Date.now();
            if (left <= 0) {
              if (timer) clearInterval(timer);
              lockedUntil = 0;
              setLocked(false, 'Du kannst es erneut versuchen.');
              codeInput.focus();
              return;
            }
            const remaining = Math.ceil(left / 100) / 10;
            setLocked(true, `❌ Falscher Code. Warte ${remaining.toFixed(1)}s…`);
          };

          tick();
          timer = setInterval(tick, 100);
          return;
        }

        // richtig -> Bild anzeigen
        createWindow('image-viewer', { title: file.filename, src: file.imageSrc });
        closeWindow(windowElement);
      } catch (e) {
        console.error(e);
        msg.textContent = '⚠️ Fehler beim Entsperren (siehe Konsole).';
      }
    });
  }

  function initWindowControls(windowElement) {
    const header = windowElement.querySelector('.window-header');
    const minimizeBtn = windowElement.querySelector('.window-minimize');
    const maximizeBtn = windowElement.querySelector('.window-maximize');
    const closeBtn = windowElement.querySelector('.window-close');

    // Drag (mouse + touch) via Pointer Events
    const startDrag = (e) => {
      if (e.target.closest('button')) return;
      if (windowElement.classList.contains('maximized')) return;

      bringToFront(windowElement);

      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = parseFloat(windowElement.style.left) || 0;
      const startTop = parseFloat(windowElement.style.top) || 0;

      windowElement.classList.add('window-dragging');

      const moveWindow = (ev) => {
        const newLeft = startLeft + (ev.clientX - startX);
        const newTop = startTop + (ev.clientY - startY);

        const maxLeft = Math.max(0, window.innerWidth - windowElement.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - windowElement.offsetHeight);

        windowElement.style.left = `${Math.min(maxLeft, Math.max(0, newLeft))}px`;
        windowElement.style.top = `${Math.min(maxTop, Math.max(0, newTop))}px`;
      };

      const stopMoving = () => {
        document.removeEventListener('pointermove', moveWindow);
        document.removeEventListener('pointerup', stopMoving);
        document.removeEventListener('pointercancel', stopMoving);
        windowElement.classList.remove('window-dragging');
      };

      document.addEventListener('pointermove', moveWindow);
      document.addEventListener('pointerup', stopMoving);
      document.addEventListener('pointercancel', stopMoving);
    };

    if (window.PointerEvent) {
      header.addEventListener(
        'pointerdown',
        (e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.preventDefault();
          startDrag(e);
        },
        { passive: false }
      );
    } else {
      header.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('button')) return;
        startDrag(e);
      });
    }

    windowElement.addEventListener('pointerdown', () => bringToFront(windowElement));

    minimizeBtn?.addEventListener('click', () => {
      windowElement.classList.add('minimized');
      updateTaskbarActive();
    });

    maximizeBtn?.addEventListener('click', () => {
      windowElement.classList.toggle('maximized');
      const iconName = windowElement.classList.contains('maximized') ? 'minimize-2' : 'maximize-2';
      maximizeBtn.innerHTML = `<i data-feather="${iconName}"></i>`;
      if (window.feather) feather.replace();
    });

    closeBtn?.addEventListener('click', () => closeWindow(windowElement));
  }

  function bringToFront(windowElement) {
    const windows = document.querySelectorAll('.window');
    let highestZIndex = 0;

    windows.forEach((win) => {
      const zIndex = parseInt(win.style.zIndex) || 10;
      if (zIndex > highestZIndex) highestZIndex = zIndex;
    });

    windowElement.style.zIndex = highestZIndex + 1;

    // active window tracking
    const id = windowElement.dataset.winId;
    if (id) activeWinId = id;
    updateTaskbarActive();
  }

  function bindTaskManager(windowElement) {
    // "Real-ish" fields from the browser + simulated extras
    const ua = navigator.userAgent || '';
    const platform = navigator.userAgentData?.platform || navigator.platform || 'Unknown';
    const lang = navigator.language || '–';
    const cores = navigator.hardwareConcurrency || '–';
    const reportedRam = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'unbekannt';

    const isPhone = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const deviceLabel = isPhone ? 'Mobile Device' : 'Desktop/Laptop';

    // very rough browser label (good enough for display)
    const browserLabel = (() => {
      if (/Edg\//.test(ua)) return 'Microsoft Edge';
      if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
      if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
      if (/Firefox\//.test(ua)) return 'Firefox';
      return 'Browser';
    })();

    const screenLabel = `${screen.width}×${screen.height} @ ${Math.round((window.devicePixelRatio || 1) * 100) / 100}x`;

    const setText = (id, text) => {
      const el = windowElement.querySelector(id);
      if (el) el.textContent = text;
    };

    setText('#tm-device', deviceLabel);
    setText('#tm-platform', platform);
    setText('#tm-browser', browserLabel);
    setText('#tm-lang', lang);
    setText('#tm-screen', screenLabel);
    setText('#tm-cores', String(cores));
    setText('#tm-ram-reported', reportedRam);

    // simulated extras (clearly labeled)
    const fakeGpus = ['NVIDIA RTX 3060', 'NVIDIA RTX 3070', 'AMD Radeon RX 6700 XT', 'Apple GPU', 'Intel Iris Xe'];
    const fakeBoards = ['X570', 'B660', 'Z790', 'M2 Board', 'OEM Mobile'];
    const fakeTemps = () => `${Math.round(rand(38, 74))}°C`;
    const extra = `GPU: ${fakeGpus[Math.floor(rand(0, fakeGpus.length))]}, Board: ${fakeBoards[Math.floor(rand(0, fakeBoards.length))]}, Temp: ${fakeTemps()}`;
    setText('#tm-extra', extra);

    // Live simulation state
    const totalRamGB = navigator.deviceMemory || 8;
    let cpu = rand(8, 32);
    let ramPct = rand(28, 62);
    let net = rand(0.2, 5.0);

    const cpuEl = windowElement.querySelector('#tm-cpu');
    const ramEl = windowElement.querySelector('#tm-ram');
    const netEl = windowElement.querySelector('#tm-net');
    const cpuBar = windowElement.querySelector('#tm-cpu-bar');
    const ramBar = windowElement.querySelector('#tm-ram-bar');
    const netBar = windowElement.querySelector('#tm-net-bar');
    const procsBody = windowElement.querySelector('#tm-procs');

    const render = () => {
      // random walk
      cpu = clamp(cpu + rand(-6, 6), 2, 95);
      ramPct = clamp(ramPct + rand(-3, 3), 15, 92);
      net = clamp(net + rand(-1.0, 1.0), 0.0, 12.0);

      const usedRam = (totalRamGB * ramPct) / 100;

      if (cpuEl) cpuEl.textContent = `${cpu.toFixed(0)}%`;
      if (ramEl) ramEl.textContent = `${usedRam.toFixed(1)} / ${totalRamGB.toFixed(0)} GB (${ramPct.toFixed(0)}%)`;
      if (netEl) netEl.textContent = `${net.toFixed(1)} Mbit/s`;

      if (cpuBar) cpuBar.style.width = `${cpu.toFixed(0)}%`;
      if (ramBar) ramBar.style.width = `${ramPct.toFixed(0)}%`;
      if (netBar) netBar.style.width = `${clamp((net / 12.0) * 100, 0, 100).toFixed(0)}%`;

      // Processes = open windows
      if (procsBody) {
        const entries = Array.from(windowsById.values());

        // distribute CPU across processes (simulated)
        const weights = entries.map(() => rand(0.2, 1.2));
        const wsum = weights.reduce((a, b) => a + b, 0) || 1;

        procsBody.innerHTML = '';
        entries.forEach((ent, i) => {
          const status = ent.el.classList.contains('minimized')
            ? 'Minimiert'
            : (ent.id === activeWinId ? 'Aktiv' : 'Offen');

          const procCpu = (cpu * (weights[i] / wsum));
          const baseMem = ent.memMB || parseInt(ent.el.dataset.memMB || '120', 10);
          const memJitter = rand(-8, 12);
          const procMem = Math.max(20, Math.round(baseMem + memJitter));

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="py-1 pr-2 whitespace-nowrap">${ent.title}</td>
            <td class="py-1 pr-2 opacity-80">${status}</td>
            <td class="py-1 pr-2">${procCpu.toFixed(1)}%</td>
            <td class="py-1 pr-2">${procMem} MB</td>
          `;
          procsBody.appendChild(tr);
        });
      }
    };

    render();
    windowElement._tmInterval = setInterval(render, 600);
  }

  // Desktop icon click handlers
  desktopIcons.forEach((icon) => {
    icon.addEventListener('click', () => {
      const windowType = icon.getAttribute('data-window');
      const fileId = icon.getAttribute('data-file-id');
      createWindow(windowType, { fileId });
    });
  });

  document.getElementById('start-btn')?.addEventListener('click', () => {
    // Optional: start menu (currently not implemented)
  });
}
