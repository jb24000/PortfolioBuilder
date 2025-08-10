// Enhanced Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const currentPath = window.location.pathname;
        const basePath = currentPath.includes('/PortfolioBuilder/') ? '/PortfolioBuilder/' : '/';
        const swPath = basePath + 'sw.js';
        
        navigator.serviceWorker.register(swPath, { scope: basePath })
            .then(reg => {
                console.log('SW registered with scope:', reg.scope);
                
                // Check for updates
                reg.addEventListener('updatefound', () => {
                    console.log('New service worker version available');
                    const newWorker = reg.installing;
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New version available, could show update prompt
                            console.log('New version ready');
                        }
                    });
                });
                
                // Listen for controller change (when new SW takes over)
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    console.log('New service worker took control');
                    window.location.reload();
                });
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
                const installBtn = document.getElementById('floatingInstallBtn');
                if (installBtn) installBtn.style.display = 'none';
            });
    });
}

// Enhanced PWA Installation
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('Install prompt triggered');
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install prompts
    document.getElementById('installPrompt').classList.add('show');
    installButton.style.display = 'flex';
    
    // Log install prompt criteria
    console.log('Install prompt criteria met');
});

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            console.log('User choice:', choiceResult.outcome);
            if (choiceResult.outcome === 'accepted') {
                installButton.style.display = 'none';
                console.log('PWA installation accepted');
            }
            deferredPrompt = null;
            document.getElementById('installPrompt').classList.remove('show');
        });
    } else {
        console.log('No install prompt available');
        // Fallback: show manual install instructions
        alert('To install this app:\n\n1. Chrome: Menu → More Tools → Create Shortcut → ✓ Open as window\n2. Edge: Menu → Apps → Install this site as an app\n3. Firefox: Address bar → Install icon');
    }
}

// Enhanced Project Data Management with Offline Support
async function collectProjectData() {
    try {
        projectData.title = document.getElementById('projectTitle').value;
        projectData.author = document.getElementById('authorName').value;
        projectData.authorTitle = document.getElementById('authorTitle').value;
        projectData.website = document.getElementById('websiteUrl').value || 'jb24000.github.io';
        projectData.intro = document.getElementById('projectIntro').value;
        projectData.tools = document.getElementById('toolsConcepts').value;
        projectData.reflection = document.getElementById('projectReflection').value;
        projectData.lastModified = new Date().toISOString();
        
        projectData.steps = [];
        const stepItems = document.querySelectorAll('.step-item');
        
        const promises = [];
        
        stepItems.forEach((step, index) => {
            const title = step.querySelector('.step-title').value;
            const description = step.querySelector('.step-description').value;
            const imageInput = step.querySelector('.step-image');
            
            projectData.steps.push({
                title: title,
                description: description,
                image: null
            });
            
            if (imageInput.files && imageInput.files[0]) {
                const promise = new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        projectData.steps[index].image = e.target.result;
                        resolve();
                    };
                    reader.readAsDataURL(imageInput.files[0]);
                });
                promises.push(promise);
            }
        });
        
        await Promise.all(promises);
        
        // Cache project data for offline access
        await cacheProjectData(projectData);
        
        return true;
    } catch (error) {
        console.error('Error collecting project data:', error);
        return false;
    }
}

// Cache project data using Service Worker
async function cacheProjectData(project) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {
            const messageChannel = new MessageChannel();
            
            messageChannel.port1.onmessage = (event) => {
                console.log('Project cached for offline use');
            };
            
            navigator.serviceWorker.controller.postMessage(
                { type: 'CACHE_PROJECT', data: { project } },
                [messageChannel.port2]
            );
        } catch (error) {
            console.error('Failed to cache project data:', error);
        }
    }
}

// Enhanced offline detection
function checkOnlineStatus() {
    const isOnline = navigator.onLine;
    console.log('Online status:', isOnline);
    
    // Update UI based on connection status
    const offlineIndicator = document.getElementById('offlineIndicator');
    if (offlineIndicator) {
        offlineIndicator.style.display = isOnline ? 'none' : 'block';
    }
    
    return isOnline;
}

// Listen for online/offline events
window.addEventListener('online', () => {
    console.log('Connection restored');
    checkOnlineStatus();
    // Sync any pending data
    syncPendingData();
});

window.addEventListener('offline', () => {
    console.log('Connection lost');
    checkOnlineStatus();
    showOfflineNotification();
});

function showOfflineNotification() {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: #333; color: white; 
                    padding: 15px; border-radius: 8px; z-index: 10000; max-width: 300px;">
            📡 You're offline. Your work is being saved locally.
            <button onclick="this.parentElement.remove()" style="float: right; background: none; 
                    border: none; color: white; cursor: pointer;">✕</button>
        </div>
    `;
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

async function syncPendingData() {
    // Sync any pending project data when connection is restored
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {
            navigator.serviceWorker.controller.postMessage({ type: 'SYNC_DATA' });
        } catch (error) {
            console.error('Failed to sync data:', error);
        }
    }
}

// Enhanced initialization
window.addEventListener('load', () => {
    checkOnlineStatus();
    loadFromLocalStorage();
    
    if (document.querySelectorAll('.step-item').length === 0) {
        addStep();
    }
    
    // Check install prompt status after a delay
    setTimeout(() => {
        if (!deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
            console.log('Install prompt not available yet, checking criteria...');
            // Log helpful debugging info
            console.log('HTTPS:', location.protocol === 'https:');
            console.log('Service Worker:', 'serviceWorker' in navigator);
            console.log('Manifest:', document.querySelector('link[rel="manifest"]') !== null);
        }
    }, 3000);
});
