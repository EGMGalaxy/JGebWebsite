document.addEventListener('DOMContentLoaded', () => {
    // Initialize desktop
    initDesktop();
    feather.replace();
});

function initDesktop() {
    const desktopIcons = document.querySelectorAll('.desktop-icon');
    const windowContainer = document.getElementById('window-container');
    const windowTemplate = document.getElementById('window-template');

    const isMobile = window.matchMedia('(max-width: 640px)').matches || window.matchMedia('(pointer: coarse)').matches;

    
    // Create window from template
    function createWindow(type) {
        const windowClone = windowTemplate.content.cloneNode(true);
        const windowElement = windowClone.querySelector('.window');
        const contentContainer = windowElement.querySelector('.window-content');
        
        // Set window properties based on type
        switch(type) {
            case 'notes':
                const notesContent = document.getElementById('notes-content').content.cloneNode(true);
                contentContainer.appendChild(notesContent);
                windowElement.querySelector('.window-title').textContent = 'Notes';
                windowElement.querySelector('.window-icon').setAttribute('data-feather', 'file-text');
                break;
            case 'explorer':
                const explorerContent = document.getElementById('explorer-content').content.cloneNode(true);
                contentContainer.appendChild(explorerContent);
                windowElement.querySelector('.window-title').textContent = 'File Explorer';
                windowElement.querySelector('.window-icon').setAttribute('data-feather', 'folder');
                break;
            case 'settings':
                const settingsContent = document.getElementById('settings-content').content.cloneNode(true);
                contentContainer.appendChild(settingsContent);
                windowElement.querySelector('.window-title').textContent = 'Settings';
                windowElement.querySelector('.window-icon').setAttribute('data-feather', 'settings');
                break;
        }
        // Default size + initial position
        if (isMobile) {
            // Smaller window on mobile (still movable)
            windowElement.classList.add('mobile-window');
            windowElement.style.width = '92vw';
            windowElement.style.height = '70vh';
            windowElement.style.left = '4vw';
            windowElement.style.top = '10vh';
        } else {
            // Random initial position on desktop
            const maxLeft = Math.max(60, window.innerWidth - 520);
            const maxTop = Math.max(60, window.innerHeight - 420);
            windowElement.style.left = `${Math.floor(40 + Math.random() * (maxLeft - 40))}px`;
            windowElement.style.top = `${Math.floor(40 + Math.random() * (maxTop - 40))}px`;
        }
        // Add to DOM
        windowContainer.appendChild(windowElement);
        
        // Initialize window controls
        initWindowControls(windowElement);
        
        // Bring to front
        bringToFront(windowElement);
        
        // Feather icons
        feather.replace();
        
        return windowElement;
    }
    
    // Initialize window controls (drag, resize, buttons)
    function initWindowControls(windowElement) {
        const header = windowElement.querySelector('.window-header');
        const minimizeBtn = windowElement.querySelector('.window-minimize');
        const maximizeBtn = windowElement.querySelector('.window-maximize');
        const closeBtn = windowElement.querySelector('.window-close');
        
        
        // Drag functionality (mouse + touch) via Pointer Events
        const startDrag = (e) => {
            // Don't start dragging when interacting with window buttons (incl. Feather's SVG)
            if (e.target.closest('button')) return;

            // If the window is maximized, ignore drag (feels more "OS-like")
            if (windowElement.classList.contains('maximized')) return;

            // Bring to front when grabbed
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
            header.addEventListener('pointerdown', (e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                e.preventDefault(); // avoid scroll/selection conflicts
                startDrag(e);
            }, { passive: false });
        } else {
            // Fallback for very old browsers
            header.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                if (e.target.closest('button')) return;
                startDrag(e);
            });
        }

        // Bring to front when interacting anywhere in the window
        windowElement.addEventListener('pointerdown', () => bringToFront(windowElement));
        // Minimize button
        minimizeBtn.addEventListener('click', () => {
            windowElement.classList.add('minimized');
        });
        
        // Maximize button
        maximizeBtn.addEventListener('click', () => {
            windowElement.classList.toggle('maximized');

            // Feather replaces <i> with <svg>, so don't rely on querySelector('i') here.
            const iconName = windowElement.classList.contains('maximized') ? 'minimize-2' : 'maximize-2';
            maximizeBtn.innerHTML = `<i data-feather="${iconName}"></i>`;
            feather.replace();
        });
// Close button
        closeBtn.addEventListener('click', () => {
            windowElement.remove();
        });
    }
    
    // Bring window to front
    function bringToFront(windowElement) {
        const windows = document.querySelectorAll('.window');
        let highestZIndex = 0;
        
        windows.forEach(win => {
            const zIndex = parseInt(win.style.zIndex) || 10;
            if (zIndex > highestZIndex) highestZIndex = zIndex;
        });
        
        windowElement.style.zIndex = highestZIndex + 1;
    }
    
    // Desktop icon click handlers
    desktopIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            const windowType = icon.getAttribute('data-window');
            createWindow(windowType);
        });
    });
    
    // Start button handler
    document.getElementById('start-btn').addEventListener('click', () => {
        // You could add a start menu here
    });
}