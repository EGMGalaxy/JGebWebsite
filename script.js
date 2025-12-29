document.addEventListener('DOMContentLoaded', () => {
  initDesktop();
  if (window.feather) feather.replace();
});

function initDesktop() {
  const desktopIcons = document.querySelectorAll('.desktop-icon');
  const windowContainer = document.getElementById('window-container');
  const windowTemplate = document.getElementById('window-template');

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
  const COOLDOWN_MS = 3000;
  let lockedUntil = 0;

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

    cancelBtn.addEventListener('click', () => windowElement.remove());

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
          // Cooldown 2s
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
        windowElement.remove();
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

    minimizeBtn?.addEventListener('click', () => windowElement.classList.add('minimized'));

    maximizeBtn?.addEventListener('click', () => {
      windowElement.classList.toggle('maximized');
      const iconName = windowElement.classList.contains('maximized') ? 'minimize-2' : 'maximize-2';
      maximizeBtn.innerHTML = `<i data-feather="${iconName}"></i>`;
      if (window.feather) feather.replace();
    });

    closeBtn?.addEventListener('click', () => windowElement.remove());
  }

  function bringToFront(windowElement) {
    const windows = document.querySelectorAll('.window');
    let highestZIndex = 0;

    windows.forEach((win) => {
      const zIndex = parseInt(win.style.zIndex) || 10;
      if (zIndex > highestZIndex) highestZIndex = zIndex;
    });

    windowElement.style.zIndex = highestZIndex + 1;
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
    // Optional: start menu
  });
}
