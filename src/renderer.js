document.addEventListener('DOMContentLoaded', function() {
    const SERVER_IP = 'evasoresfiscales.holy.gg';
    
    // Elementos principales
    const playBtn = document.getElementById('play-btn');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const statusDot = document.getElementById('status-dot');
    const statusTextEl = document.getElementById('status-text');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const ramMaxInput = document.getElementById('ram-max');
    const ramMinInput = document.getElementById('ram-min');
    const openLauncherFolderBtn = document.getElementById('open-launcher-folder-btn');
    const reinstallModsBtn = document.getElementById('reinstall-mods-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loginBtn = document.getElementById('login-btn');
    const userMenuContainer = document.getElementById('user-menu-container');
    const userAvatar = document.getElementById('user-avatar');
    const userDropdown = document.getElementById('user-dropdown');
    const userNameSpan = document.getElementById('user-name');
    const logoutBtn = document.getElementById('logout-btn');
    const newsContainer = document.getElementById('news-container');
    const copyIpBtn = document.getElementById('copy-ip-btn');

    // Nuevos elementos de ajustes
    const ramMaxSlider = document.getElementById('ram-max-slider');
    const ramMinSlider = document.getElementById('ram-min-slider');
    const ramWarning = document.getElementById('ram-warning');

    // === INICIALIZACIÓN ===
    initializeApp();

    // === FUNCIONES DE INICIALIZACIÓN ===
    function initializeApp() {
        setupEventListeners();
        setupTabs();
        initializeRAMSliders();
        loadInitialData();
    }

    function setupEventListeners() {
        // Autenticación
        loginBtn.addEventListener('click', handleLogin);
        logoutBtn.addEventListener('click', handleLogout);
        userAvatar.addEventListener('click', toggleUserDropdown);
        
        // Juego
        playBtn.addEventListener('click', handlePlay);
        
        // Ajustes
        settingsBtn.addEventListener('click', openSettings);
        closeSettingsBtn.addEventListener('click', closeSettings);
        saveSettingsBtn.addEventListener('click', saveSettings);
        
        // Utilidades
        openLauncherFolderBtn.addEventListener('click', () => window.electronAPI.openLauncherFolder());
        reinstallModsBtn.addEventListener('click', handleReinstallMods);
        copyIpBtn.addEventListener('click', handleCopyIP);
        
        // Nuevos botones de ajustes
        setupSettingsButtons();
        
        // Eventos de Electron
        setupElectronEvents();
        
        // Cerrar dropdown al hacer click fuera
        window.addEventListener('click', closeUserDropdownOutside);
    }

    function setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Remover clase active de todas las pestañas y contenidos
                document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                // Añadir clase active a la pestaña clickeada
                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab') + '-tab';
                document.getElementById(tabId).classList.add('active');
            });
        });
    }

    function initializeRAMSliders() {
        function updateRAMValues() {
            const maxVal = ramMaxSlider.value;
            const minVal = ramMinSlider.value;
            
            // Actualizar displays
            document.getElementById('ram-max-value').textContent = maxVal + ' GB';
            document.getElementById('ram-min-value').textContent = minVal + ' GB';
            
            // Sincronizar con inputs numéricos
            ramMaxInput.value = maxVal;
            ramMinInput.value = minVal;
            
            // Validar que min <= max
            if (parseInt(minVal) > parseInt(maxVal)) {
                ramWarning.classList.remove('hidden');
                ramMinSlider.value = maxVal;
                ramMinInput.value = maxVal;
                document.getElementById('ram-min-value').textContent = maxVal + ' GB';
            } else {
                ramWarning.classList.add('hidden');
            }
        }

        ramMaxSlider.addEventListener('input', updateRAMValues);
        ramMinSlider.addEventListener('input', updateRAMValues);
        ramMaxInput.addEventListener('input', (e) => {
            ramMaxSlider.value = e.target.value;
            updateRAMValues();
        });
        ramMinInput.addEventListener('input', (e) => {
            ramMinSlider.value = e.target.value;
            updateRAMValues();
        });

        // Inicializar valores
        updateRAMValues();
    }

    function setupSettingsButtons() {
        // Nuevos botones de ajustes
        document.getElementById('open-mods-folder-btn').addEventListener('click', () => {
            window.electronAPI.openModsFolder();
        });

        document.getElementById('open-logs-folder-btn').addEventListener('click', () => {
            window.electronAPI.openLogsFolder();
        });

        document.getElementById('clear-cache-btn').addEventListener('click', async () => {
            if (confirm('¿Estás seguro de que quieres limpiar la caché de Minecraft? Esto borrará archivos descargados pero no tus mods o configuraciones.')) {
                showNotification('Limpiando caché...', 'info');
                try {
                    await window.electronAPI.clearCache();
                    showNotification('Caché limpiada correctamente', 'success');
                } catch (error) {
                    showNotification('Error al limpiar la caché', 'error');
                }
            }
        });

        document.getElementById('verify-files-btn').addEventListener('click', async () => {
            showNotification('Verificando archivos del juego...', 'info');
            try {
                await window.electronAPI.verifyGameFiles();
                showNotification('Archivos verificados correctamente', 'success');
            } catch (error) {
                showNotification('Error al verificar archivos', 'error');
            }
        });

        document.getElementById('clear-account-btn').addEventListener('click', async () => {
            if (confirm('¿Estás seguro de que quieres cerrar sesión y eliminar todos los datos de la cuenta?')) {
                showNotification('Limpiando datos de cuenta...', 'info');
                try {
                    await window.electronAPI.clearAccountData();
                    await checkAuthState();
                    showNotification('Datos de cuenta eliminados', 'success');
                } catch (error) {
                    showNotification('Error al limpiar datos de cuenta', 'error');
                }
            }
        });

        document.getElementById('reset-settings-btn').addEventListener('click', async () => {
            if (confirm('¿Restablecer toda la configuración a los valores por defecto?')) {
                showNotification('Restableciendo ajustes...', 'info');
                try {
                    await window.electronAPI.resetSettings();
                    await loadSettingsIntoUI();
                    initializeRAMSliders();
                    showNotification('Ajustes restablecidos', 'success');
                } catch (error) {
                    showNotification('Error al restablecer ajustes', 'error');
                }
            }
        });
    }

    function setupElectronEvents() {
        window.electronAPI.onUpdateProgress(({ text, percentage }) => {
            updateProgress(text, percentage);
        });

        window.electronAPI.onGameClosed(() => {
            playBtn.disabled = false;
            updateProgress('¡Listo para jugar!', 100);
        });

        window.electronAPI.onUpdateAvailable(() => {
            updateProgress('¡Nueva actualización disponible! Descargando...', 0);
        });

        window.electronAPI.onUpdateDownloaded(() => {
            updateProgress('Actualización lista. Reinicia para instalar.', 100);
            if (confirm('Hay una nueva actualización lista para instalar. ¿Quieres reiniciar ahora?')) {
                window.electronAPI.restartApp();
            }
        });
    }

    // === FUNCIONES DE LA APLICACIÓN ===

    function updateProgress(text, percentage) {
        progressText.textContent = text;
        progressBar.style.width = `${percentage}%`;
    }

    async function loadInitialData() {
        await checkServerStatus();
        await loadNews();
        await checkAuthState();
        await updateSystemInfo();
    }

    async function checkServerStatus() {
        try {
            const status = await window.electronAPI.getServerStatus();
            if (status.online) {
                statusDot.className = 'status-dot online';
                statusTextEl.textContent = `En línea: ${status.players.online}`;
            } else {
                statusDot.className = 'status-dot offline';
                statusTextEl.textContent = 'Desconectado';
            }
        } catch (error) {
            console.error('Error checking server status:', error);
            statusDot.className = 'status-dot offline';
            statusTextEl.textContent = 'Error de conexión';
        }
    }

    async function loadNews() {
        try {
            const articles = await window.electronAPI.getNews();
            if (articles.length === 0) {
                newsContainer.innerHTML = '<p style="text-align: center;">No hay noticias disponibles.</p>';
                return;
            }

            let newsHTML = '';
            for (const article of articles) {
                newsHTML += `
                    <div class="news-article">
                        ${article.imageUrl ? `<img src="${article.imageUrl}" class="news-image" alt="${article.title}">` : ''}
                        <h3 class="news-title">${article.title}</h3>
                        <p class="news-meta">Por ${article.author} - ${new Date(article.date).toLocaleDateString()}</p>
                        <p class="news-content">${article.content}</p>
                    </div>
                `;
            }
            newsContainer.innerHTML = newsHTML;
        } catch (error) {
            console.error('Error loading news:', error);
            newsContainer.innerHTML = '<p style="text-align: center;">Error al cargar las noticias.</p>';
        }
    }

    async function checkAuthState() {
        setUIState('loading');
        try {
            const profile = await window.electronAPI.checkStoredSession();
            if (profile) {
                setUIState('loggedIn', profile);
                updateProgress('Sesión reanudada. Verificando archivos...', 50);
                const updateResult = await window.electronAPI.checkForUpdates();
                if (updateResult.success) {
                    playBtn.disabled = false;
                    updateProgress('¡Listo para jugar!', 100);
                } else {
                    updateProgress(`Error al actualizar: ${updateResult.error}`, 100);
                }
            } else {
                setUIState('loggedOut');
                updateProgress('Esperando inicio de sesión...', 0);
            }
        } catch (error) {
            console.error('Error checking auth state:', error);
            setUIState('loggedOut');
            updateProgress('Error al verificar sesión', 0);
        }
    }

    // === MANEJADORES DE EVENTOS ===

    async function handleLogin() {
        updateProgress('Iniciando sesión...', 25);
        try {
            const profile = await window.electronAPI.login();
            if (profile) {
                setUIState('loggedIn', profile);
                updateProgress('Sesión iniciada. Verificando archivos...', 50);
                const updateResult = await window.electronAPI.checkForUpdates();
                if (updateResult.success) {
                    playBtn.disabled = false;
                    updateProgress('¡Listo para jugar!', 100);
                } else {
                    updateProgress(`Error al actualizar: ${updateResult.error}`, 100);
                }
            } else {
                setUIState('loggedOut');
                updateProgress('Error al iniciar sesión. Inténtalo de nuevo.', 0);
            }
        } catch (error) {
            console.error('Login error:', error);
            setUIState('loggedOut');
            updateProgress('Error al iniciar sesión', 0);
        }
    }

    async function handleLogout() {
        try {
            await window.electronAPI.logout();
            userDropdown.classList.add('hidden');
            setUIState('loggedOut');
            updateProgress('Esperando inicio de sesión...', 0);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    async function handlePlay() {
        playBtn.disabled = true;
        try {
            await window.electronAPI.launch();
        } catch (error) {
            console.error('Error al lanzar el juego:', error);
            updateProgress('Error al lanzar el juego.', 100);
            playBtn.disabled = false;
        }
    }

    async function handleReinstallMods() {
        settingsModal.classList.add('hidden');
        playBtn.disabled = true;
        updateProgress('Reinstalando mods...', 0);
        try {
            await window.electronAPI.reinstallMods();
            updateProgress('Mods reinstalados correctamente', 100);
        } catch (error) {
            updateProgress('Error al reinstalar mods', 100);
        } finally {
            playBtn.disabled = false;
        }
    }

    function handleCopyIP() {
        window.electronAPI.copyToClipboard(SERVER_IP);

        const originalText = copyIpBtn.textContent;
        copyIpBtn.textContent = '¡IP Copiada!';
        copyIpBtn.disabled = true;

        setTimeout(() => {
            copyIpBtn.textContent = originalText;
            copyIpBtn.disabled = false;
        }, 2000);
    }

    // === GESTIÓN DE AJUSTES ===

    async function openSettings() {
        await loadSettingsIntoUI();
        await updateSystemInfo();
        settingsModal.classList.remove('hidden');
    }

    function closeSettings() {
        settingsModal.classList.add('hidden');
    }

    async function saveSettings() {
        const newSettings = {
            ram: { 
                max: document.getElementById('ram-max').value, 
                min: document.getElementById('ram-min').value 
            }
        };
        
        try {
            await window.electronAPI.setSettings(newSettings);
            showNotification('Ajustes guardados correctamente', 'success');
            closeSettings();
        } catch (error) {
            console.error('Error saving settings:', error);
            showNotification('Error al guardar ajustes', 'error');
        }
    }

    async function loadSettingsIntoUI() {
        try {
            const settings = await window.electronAPI.getSettings();
            document.getElementById('ram-max').value = settings.ram.max;
            document.getElementById('ram-min').value = settings.ram.min;
            document.getElementById('ram-max-slider').value = settings.ram.max;
            document.getElementById('ram-min-slider').value = settings.ram.min;
            initializeRAMSliders(); // Para actualizar los valores
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async function updateSystemInfo() {
        try {
            const systemInfo = await window.electronAPI.getSystemInfo();
            document.getElementById('total-ram').textContent = systemInfo.totalRAM + ' GB';
            document.getElementById('available-ram').textContent = systemInfo.availableRAM + ' GB';
            
            // Calcular RAM recomendada de forma más conservadora
            const recommendedMin = Math.max(1, Math.min(2, Math.floor(systemInfo.totalRAM * 0.2)));
            const recommendedMax = Math.max(2, Math.min(4, Math.floor(systemInfo.totalRAM * 0.4)));
            document.getElementById('recommended-ram').textContent = `${recommendedMin}-${recommendedMax} GB`;
        } catch (error) {
            console.error('Error getting system info:', error);
        }
    }

    // === GESTIÓN DE INTERFAZ DE USUARIO ===

    function setUIState(state, profile = null) {
        if (state === 'loading') {
            loadingOverlay.classList.remove('hidden');
            loginBtn.classList.add('hidden');
            userMenuContainer.classList.add('hidden');
            playBtn.disabled = true;
        } else if (state === 'loggedIn') {
            loadingOverlay.classList.add('hidden');
            userMenuContainer.classList.remove('hidden');
            loginBtn.classList.add('hidden');
            if (profile) {
                userNameSpan.textContent = profile.name;
                userAvatar.src = profile.avatar;
            }
            playBtn.disabled = false;
        } else if (state === 'loggedOut') {
            loadingOverlay.classList.add('hidden');
            userMenuContainer.classList.add('hidden');
            loginBtn.classList.remove('hidden');
            playBtn.disabled = true;
        }
    }

    function toggleUserDropdown() {
        userDropdown.classList.toggle('hidden');
    }

    function closeUserDropdownOutside(event) {
        if (!userMenuContainer.contains(event.target)) {
            userDropdown.classList.add('hidden');
        }
    }

    // === SISTEMA DE NOTIFICACIONES ===

    function showNotification(message, type = 'info') {
        // Crear elemento de notificación
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${getNotificationColor(type)};
            color: white;
            border-radius: 4px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(notification);
        
        // Auto-eliminar después de 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    function getNotificationColor(type) {
        switch (type) {
            case 'success': return '#27ae60';
            case 'error': return '#e74c3c';
            case 'warning': return '#f39c12';
            default: return '#3498db';
        }
    }

    document.getElementById('diagnose-mods-btn').addEventListener('click', async () => {
    const result = await window.electronAPI.diagnoseMods();
    console.log('Diagnóstico de mods:', result);
    alert(`Mods encontrados: ${result.total}\nRevisa la consola para más detalles.`);
    });
});
