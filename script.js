document.addEventListener('DOMContentLoaded', () => {
    // Initialize desktop
    initDesktop();
    feather.replace();
});

function initDesktop() {
    const desktopIcons = document.querySelectorAll('.desktop-icon');
    const windowContainer = document.getElementById('window-container');
    const windowTemplate = document.getElementById('window-template');
    
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
        
        // Set random initial position
        const maxLeft = window.innerWidth - 600;
        const maxTop = window.innerHeight - 450;
        windowElement.style.left = `${Math.max(50, Math.floor(Math.random() * maxLeft))}px`;
        windowElement.style.top = `${Math.max(50, Math.floor(Math.random() * maxTop))}px`;
        
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
        
        // Drag functionality
        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'I') return;
            
            const startX = e.clientX;
            const startY = e.clientY;
            const startLeft = parseInt(windowElement.style.left) || 0;
            const startTop = parseInt(windowElement.style.top) || 0;
            
            // Bring to front when clicked
            bringToFront(windowElement);
            
            function moveWindow(e) {
                const newLeft = startLeft + e.clientX - startX;
                const newTop = startTop + e.clientY - startY;
                
                windowElement.style.left = `${Math.max(0, newLeft)}px`;
                windowElement.style.top = `${Math.max(0, newTop)}px`;
            }
            
            function stopMoving() {
                document.removeEventListener('mousemove', moveWindow);
                document.removeEventListener('mouseup', stopMoving);
                windowElement.classList.remove('window-dragging');
            }
            
            document.addEventListener('mousemove', moveWindow);
            document.addEventListener('mouseup', stopMoving);
            
            windowElement.classList.add('window-dragging');
        });
        
        // Minimize button
        minimizeBtn.addEventListener('click', () => {
            windowElement.classList.add('minimized');
        });
        
        // Maximize button
        maximizeBtn.addEventListener('click', () => {
            windowElement.classList.toggle('maximized');
            maximizeBtn.querySelector('i').setAttribute(
                'data-feather', 
                windowElement.classList.contains('maximized') ? 'minimize-2' : 'maximize-2'
            );
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