const CLIENT_ID = 'wp4nlqtylqr6frku7jzgay0at5r1iv';
const REDIRECT_URI = 'https://buki4.github.io/Stream-manager/';
const SCOPES = 'channel:manage:broadcast user:read:email';

const FAV_GAMES_KEY = 'twitch_manager_fav_games';
let favoriteGames = JSON.parse(localStorage.getItem(FAV_GAMES_KEY) || '[]');

let accessToken = null;
let broadcasterId = null;
let selectedGameId = null;

const loginBtn = document.getElementById('login-btn');
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const updateBtn = document.getElementById('update-btn');
const titleInput = document.getElementById('stream-title');
const gameInput = document.getElementById('stream-game');
const gameSuggestions = document.getElementById('game-suggestions');
const statusMessage = document.getElementById('status-message');
const favList = document.getElementById('favorites-list');
const randomizeBtn = document.getElementById('randomize-btn');
const titleKeyword = document.getElementById('title-keyword');
const addFavBtn = document.getElementById('favorite-btn');

// Settings Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const geminiKeyInput = document.getElementById('gemini-api-key');

geminiKeyInput.value = localStorage.getItem('gemini_api_key') || '';

settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
});

saveSettingsBtn.addEventListener('click', () => {
    const key = geminiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
    } else {
        localStorage.removeItem('gemini_api_key');
    }
    settingsModal.classList.add('hidden');
    showStatus('Настройки ИИ сохранены');
});

function renderFavorites() {
    favList.innerHTML = '';
    favoriteGames.forEach((game, index) => {
        const chip = document.createElement('div');
        chip.className = 'favorite-chip';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'chip-name';
        nameSpan.textContent = game.name;
        nameSpan.onclick = () => {
            gameInput.value = game.name;
            selectedGameId = game.id;
        };
        
        const removeSpan = document.createElement('span');
        removeSpan.textContent = '✕';
        removeSpan.className = 'remove-chip';
        removeSpan.title = 'Удалить';
        removeSpan.onclick = (e) => {
            e.stopPropagation();
            favoriteGames.splice(index, 1);
            localStorage.setItem(FAV_GAMES_KEY, JSON.stringify(favoriteGames));
            renderFavorites();
        };
        
        chip.appendChild(nameSpan);
        chip.appendChild(removeSpan);
        favList.appendChild(chip);
    });
}

addFavBtn.addEventListener('click', () => {
    if (!selectedGameId || !gameInput.value) {
        showStatus('Сначала найдите и выберите игру из выпадающего списка', true);
        return;
    }
    const exists = favoriteGames.some(g => g.id === selectedGameId);
    if (!exists) {
        favoriteGames.push({ id: selectedGameId, name: gameInput.value });
        localStorage.setItem(FAV_GAMES_KEY, JSON.stringify(favoriteGames));
        renderFavorites();
        showStatus('Добавлено в избранное!');
    } else {
        showStatus('Эта игра уже в избранном', true);
    }
});

// Gemini AI Generator
async function generateTitleFromGemini(keyword, game, level) {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        showStatus('Сначала укажите API ключ в настройках (⚙️)', true);
        settingsModal.classList.remove('hidden');
        return null;
    }

    const styleMap = {
        chill: 'Спокойное, дружелюбное, позитивное',
        bait: 'Кликбейтное, привлекающее внимание, шокирующее',
        toxic: 'Жёсткое, токсичное, рейдж, на грани нервного срыва'
    };
    
    const prompt = `Ты креативный Twitch стример. Придумай одно крутое название для стрима.
Игра: ${game}
Главная тема или слово: ${keyword}
Стиль/Настроение: ${styleMap[level]}
Правила: Ответь ТОЛЬКО самим названием стрима. Не используй кавычки. Максимум 10 слов. Сделай его звучным.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.9, maxOutputTokens: 50 }
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error(data.error);
            showStatus('Ошибка API: ' + data.error.message, true);
            return null;
        }

        if (!data.candidates || data.candidates.length === 0) {
            showStatus('Нейросеть не вернула ответ', true);
            return null;
        }
        
        const candidate = data.candidates[0];
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            showStatus('Ответ заблокирован фильтром безопасности', true);
            return null;
        }

        return candidate.content.parts[0].text.trim().replace(/^["']|["']$/g, '');
    } catch (e) {
        showStatus('Ошибка при обращении к нейросети', true);
        console.error(e);
    }
    return null;
}

randomizeBtn.addEventListener('click', async () => {
    const keyword = titleKeyword.value.trim() || 'ЧАТ';
    const gameName = gameInput.value.trim() || 'Любая игра';
    const level = document.getElementById('provocation-level').value || 'bait';
    
    randomizeBtn.disabled = true;
    randomizeBtn.textContent = '⏳';
    
    const generated = await generateTitleFromGemini(keyword, gameName, level);
    if (generated) {
        titleInput.value = generated;
    }
    
    randomizeBtn.disabled = false;
    randomizeBtn.textContent = '🎲';
});

// Check URL for token when page loads
function checkAuth() {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const urlParams = new URLSearchParams(hash.replace('#', '?'));
        accessToken = urlParams.get('access_token');
        window.history.replaceState({}, document.title, window.location.pathname);
        showApp();
        fetchUserInfo();
    }
}

loginBtn.addEventListener('click', () => {
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${encodeURIComponent(SCOPES)}`;
    window.location.href = authUrl;
});

function showApp() {
    loginSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    renderFavorites();
}

function showStatus(text, isError = false) {
    statusMessage.textContent = text;
    statusMessage.className = isError ? 'error' : 'success';
    setTimeout(() => {
        statusMessage.textContent = '';
        statusMessage.className = '';
    }, 5000);
}

// 1. Fetch User Info
async function fetchUserInfo() {
    try {
        const response = await fetch('https://api.twitch.tv/helix/users', {
            headers: {
                'Client-Id': CLIENT_ID,
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            broadcasterId = data.data[0].id;
            fetchChannelInfo();
        } else {
            showStatus('Ошибка авторизации. Попробуйте войти снова.', true);
            loginSection.classList.remove('hidden');
            appSection.classList.add('hidden');
        }
    } catch (e) {
        showStatus('Ошибка сети при получении данных профиля', true);
    }
}

// 2. Fetch Current Channel Info
async function fetchChannelInfo() {
    try {
        const response = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${broadcasterId}`, {
            headers: {
                'Client-Id': CLIENT_ID,
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            titleInput.value = data.data[0].title;
            gameInput.value = data.data[0].game_name;
            selectedGameId = data.data[0].game_id;
        }
    } catch (e) {
        console.error('Ошибка при загрузке информации канала:', e);
    }
}

// 3. Search Games
let searchTimeout;
gameInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    selectedGameId = null; 
    
    if (query.length < 2) {
        gameSuggestions.classList.add('hidden');
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(query)}`, {
                headers: {
                    'Client-Id': CLIENT_ID,
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            const data = await response.json();
            renderSuggestions(data.data || []);
        } catch (e) {
            console.error('Ошибка при поиске игр:', e);
        }
    }, 500);
});

function renderSuggestions(games) {
    gameSuggestions.innerHTML = '';
    if (games.length === 0) {
        gameSuggestions.classList.add('hidden');
        return;
    }
    
    games.slice(0, 5).forEach(game => {
        const li = document.createElement('li');
        const imgUrl = game.box_art_url.replace('{width}', '40').replace('{height}', '53');
        
        li.innerHTML = `<img src="${imgUrl}" alt="${game.name}"><span>${game.name}</span>`;
        li.addEventListener('click', () => {
            gameInput.value = game.name;
            selectedGameId = game.id;
            gameSuggestions.classList.add('hidden');
        });
        
        gameSuggestions.appendChild(li);
    });
    gameSuggestions.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
    if (e.target !== gameInput) {
        gameSuggestions.classList.add('hidden');
    }
});

// 4. Update Channel Info
updateBtn.addEventListener('click', async () => {
    if (!broadcasterId) return;
    
    updateBtn.disabled = true;
    updateBtn.textContent = 'Обновление...';
    
    try {
        const body = { title: titleInput.value };
        if (selectedGameId) {
            body.game_id = selectedGameId;
        }
        
        const response = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${broadcasterId}`, {
            method: 'PATCH',
            headers: {
                'Client-Id': CLIENT_ID,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (response.ok) {
            showStatus('Успешно обновлено!');
        } else {
            showStatus('Ошибка при обновлении. Проверьте права.', true);
        }
    } catch (e) {
        showStatus('Ошибка сети', true);
    } finally {
        updateBtn.disabled = false;
        updateBtn.textContent = 'Обновить информацию';
    }
});

checkAuth();
