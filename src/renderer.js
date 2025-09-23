document.addEventListener('DOMContentLoaded', function() {
    const SERVER_IP = 'evasoresfiscales.holy.gg';
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

    function updateProgress(text, percentage) {
        progressText.textContent = text;
        progressBar.style.width = `${percentage}%`;
    }

    window.electronAPI.onUpdateProgress(({ text, percentage }) => {
        updateProgress(text, percentage);
    });

    window.electronAPI.onGameClosed(() => {
        playBtn.disabled = false;
        updateProgress('¡Listo para jugar!', 100);
    });

    async function checkServerStatus() {
        const status = await window.electronAPI.getServerStatus();
        if (status.online) {
            statusDot.className = 'status-dot online';
            statusTextEl.textContent = `En línea: ${status.players.online}`;
        } else {
            statusDot.className = 'status-dot offline';
            statusTextEl.textContent = 'Desconectado';
        }
    }

    // --- GESTIÓN DE ESTADO DE LA UI ---
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
            userNameSpan.textContent = profile.name;
            userAvatar.src = profile.avatar;
        } else if (state === 'loggedOut') {
            loadingOverlay.classList.add('hidden');
            userMenuContainer.classList.add('hidden');
            loginBtn.classList.remove('hidden');
            playBtn.disabled = true;
        }
    }

    loginBtn.addEventListener('click', async () => {
        updateProgress('Iniciando sesión...', 25);
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
    });

    logoutBtn.addEventListener('click', async () => {
        await window.electronAPI.logout();
        userDropdown.classList.add('hidden');
        setUIState('loggedOut');
        updateProgress('Esperando inicio de sesión...', 0);
    });

    userAvatar.addEventListener('click', () => {
        userDropdown.classList.toggle('hidden');
    });

    window.addEventListener('click', (event) => {
        if (!userMenuContainer.contains(event.target)) {
            userDropdown.classList.add('hidden');
        }
    });

    playBtn.addEventListener('click', async () => {
        playBtn.disabled = true;
        try {
            await window.electronAPI.launch();
        } catch (error) {
            console.error('Error al lanzar el juego:', error);
            updateProgress('Error al lanzar el juego.', 100);
        } finally {
        }
    });

    settingsBtn.addEventListener('click', async () => {
        const settings = await window.electronAPI.getSettings();
        ramMaxInput.value = settings.ram.max;
        ramMinInput.value = settings.ram.min;
        settingsModal.classList.remove('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    saveSettingsBtn.addEventListener('click', () => {
        const newSettings = {
            ram: { max: ramMaxInput.value, min: ramMinInput.value }
        };
        window.electronAPI.setSettings(newSettings);
        settingsModal.classList.add('hidden');
    });

    openLauncherFolderBtn.addEventListener('click', () => window.electronAPI.openLauncherFolder());

    reinstallModsBtn.addEventListener('click', async () => {
        settingsModal.classList.add('hidden');
        playBtn.disabled = true;
        await window.electronAPI.reinstallMods();
        playBtn.disabled = false;
    });

    async function loadNews() {
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
    }

    copyIpBtn.addEventListener('click', () => {
        window.electronAPI.copyToClipboard(SERVER_IP);

        const originalText = copyIpBtn.textContent;
        copyIpBtn.textContent = '¡IP Copiada!';
        copyIpBtn.disabled = true;

        setTimeout(() => {
            copyIpBtn.textContent = originalText;
            copyIpBtn.disabled = false;
        }, 2000);
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

    checkServerStatus();
    loadNews();

    (async () => {
        setUIState('loading');
        const profile = await window.electronAPI.checkStoredSession();
        if (profile) {
            setUIState('loggedIn', profile);
            updateProgress('Sesión reanudada. Verificando archivos...', 50);
            const updateResult = await window.electronAPI.checkForUpdates();
            if (updateResult.success) {
                playBtn.disabled = false;
                updateProgress('¡Listo para jugar!', 100);
            }
        } else {
            setUIState('loggedOut');
            updateProgress('Esperando inicio de sesión...', 0);
        }
    })();
});