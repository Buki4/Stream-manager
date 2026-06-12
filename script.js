const CLIENT_ID = 'wp4nlqtylqr6frku7jzgay0at5r1iv';
const REDIRECT_URI = 'https://buki4.github.io/Stream-manager/';
const SCOPES = 'channel:manage:broadcast user:read:email moderator:manage:chat_settings channel:edit:commercial channel:manage:polls channel:manage:predictions';

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
const randomizeBtn = document.getElementById('randomize-title');
const titleKeyword = document.getElementById('title-keyword');
const titleLevel = document.getElementById('title-level');
const titleSource = document.getElementById('title-source');
const addFavBtn = document.getElementById('favorite-btn');

const tagsInput = document.getElementById('stream-tags');
const chatSubOnly = document.getElementById('chat-subonly');
const chatFollower = document.getElementById('chat-follower');
const chatEmote = document.getElementById('chat-emote');
const chatSlow = document.getElementById('chat-slow');
const markerBtn = document.getElementById('marker-btn');
const adBtns = document.querySelectorAll('.ad-btn');
const pollTitle = document.getElementById('poll-title');
const pollOpt1 = document.getElementById('poll-opt1');
const pollOpt2 = document.getElementById('poll-opt2');
const pollBtn = document.getElementById('poll-btn');

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
        chill: 'Спокойный стрим, дружелюбное общение, уютная атмосфера.',
        bait: 'Жесткий кликбейт, шокирующие заявления, привлекает внимание.',
        toxic: 'Игровой тильт, сгорание, бомбеж на игру, смешной рейдж.'
    };
    
    const prompt = `Ты профессиональный стример на Twitch. Твоя задача — придумать ОДНО гениальное, цепляющее и смешное название для прямого эфира.
Обязательные условия:
1. Игра: ${game}
2. Ключевое слово/тема стрима: ${keyword}
3. Настроение/Стиль: ${styleMap[level]}
4. Название должно органично включать в себя Ключевое слово. 
5. Название должно быть длинным, цепляющим (от 5 до 15 слов).
6. НЕ пиши просто одно слово. Это должно быть законченное предложение, описывающее суть стрима с интригой.
7. Ответь ТОЛЬКО самим названием. Без кавычек, без лишних приветствий.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                ],
                generationConfig: { temperature: 0.9 }
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error(data.error);
            let errorMsg = data.error.message;
            if (errorMsg.includes('high demand') || data.error.code === 503) {
                errorMsg = 'Серверы Google сейчас перегружены. Просто нажмите на кубик еще раз!';
            } else if (data.error.code === 429) {
                errorMsg = 'Вы превысили лимит запросов Google. Подождите минутку!';
            }
            showStatus('Ошибка ИИ: ' + errorMsg, true);
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

// Локальный генератор (10000+ комбинаций)
const localTemplates = {
    chill: {
        prefixes: ['Уютный стрим:', 'Добро пожаловать:', 'Расслабляемся:', 'Ламповый вечер:', 'Спокойно играем:'],
        phrases: ['общаемся с чатом', 'пьем чай и наслаждаемся', 'никакого негатива', 'чиллим под музычку', 'проходим в свое удовольствие', 'собираем компанию', 'просто отдыхаем', 'без напряга', 'теплая атмосфера', 'тихо и мирно'],
        suffixes: ['| Присоединяйся!', '| Заходи на чай', '| Рад всем', '| Уют гарантирован', '| Отдыхаем вместе']
    },
    bait: {
        prefixes: ['ШОК!', 'ВЫ НЕ ПОВЕРИТЕ:', 'СРОЧНО!', 'ЭТО КОНЕЦ:', 'ВНИМАНИЕ:'],
        phrases: ['разработчики сошли с ума', 'нашел секретный способ сломать игру', 'этот билд запретят завтра', 'меня забанят за это', 'раскрываю главную тайну', 'лучшая тактика в мире', 'ты делал это неправильно', 'абсолютная имба', 'прошел игру за 5 минут', 'сломал экономику сервера'],
        suffixes: ['😱', '🔥', '18+', '(НЕ КЛИКБЕЙТ)', 'СМОТРЕТЬ ВСЕМ']
    },
    toxic: {
        prefixes: ['КАК ЖЕ ГОРИТ:', 'НЕНАВИЖУ ЭТУ ИГРУ:', 'ХУДШИЙ ДЕНЬ:', 'Я УДАЛЯЮ ЭТО:', 'СИЛ БОЛЬШЕ НЕТ:'],
        phrases: ['опять руинят катку', 'самые тупые тиммейты', 'почему это так не работает', 'меня всё достало', 'невозможно играть', 'разбиваю клавиатуру', 'полный тильт', 'где баланс', 'отвратительный рандом', 'хватит это терпеть'],
        suffixes: ['🤬', '🗑️', '(СЛАБОНЕРВНЫМ НЕ СМОТРЕТЬ)', '| МИНУС МОРАЛЬ', '| RIP НЕРВЫ']
    }
};

function generateLocalTitle(keyword, game, level) {
    const data = localTemplates[level] || localTemplates.bait;
    const prefix = data.prefixes[Math.floor(Math.random() * data.prefixes.length)];
    const phrase = data.phrases[Math.floor(Math.random() * data.phrases.length)];
    const suffix = data.suffixes[Math.floor(Math.random() * data.suffixes.length)];
    
    // Вставляем ключевое слово или игру
    let mainPart = phrase;
    if (Math.random() > 0.5 && keyword) {
        mainPart += ` про ${keyword}`;
    }
    
    return `${prefix} ${mainPart} ${suffix}`;
}

randomizeBtn.addEventListener('click', async () => {
    const keyword = titleKeyword.value.trim();
    const gameName = gameInput.value.trim() || 'Любая игра';
    const level = titleLevel ? titleLevel.value : 'bait';
    const source = titleSource ? titleSource.value : 'ai';
    
    randomizeBtn.disabled = true;
    randomizeBtn.textContent = '⏳';
    
    let generated = '';
    
    if (source === 'local') {
        // Мгновенная генерация из локальных массивов
        generated = generateLocalTitle(keyword, gameName, level);
        // Небольшая задержка для анимации
        await new Promise(r => setTimeout(r, 300));
    } else {
        // Генерация через ИИ
        generated = await generateTitleFromGemini(keyword || 'ЧАТ', gameName, level);
    }

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
            if (data.data[0].tags) {
                tagsInput.value = data.data[0].tags.join(', ');
            }
            fetchChatSettings();
        }
    } catch (e) {
        console.error('Ошибка при загрузке информации канала:', e);
    }
}

async function fetchChatSettings() {
    try {
        const response = await fetch(`https://api.twitch.tv/helix/chat/settings?broadcaster_id=${broadcasterId}&moderator_id=${broadcasterId}`, {
            headers: {
                'Client-Id': CLIENT_ID,
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const data = await response.json();
        if (data.data && data.data.length > 0) {
            const settings = data.data[0];
            chatSubOnly.checked = settings.subscriber_mode;
            chatFollower.checked = settings.follower_mode;
            chatEmote.checked = settings.emote_mode;
            chatSlow.checked = settings.slow_mode;
        }
    } catch (e) {
        console.error('Ошибка при загрузке настроек чата:', e);
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
        
        const tagsRaw = tagsInput.value.trim();
        body.tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim().replace(/^#/, '')).filter(t => t).slice(0, 10) : [];
        
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

// 5. Chat Settings
async function updateChatSettings() {
    if (!broadcasterId) return;
    try {
        await fetch(`https://api.twitch.tv/helix/chat/settings?broadcaster_id=${broadcasterId}&moderator_id=${broadcasterId}`, {
            method: 'PATCH',
            headers: {
                'Client-Id': CLIENT_ID,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subscriber_mode: chatSubOnly.checked,
                follower_mode: chatFollower.checked,
                emote_mode: chatEmote.checked,
                slow_mode: chatSlow.checked
            })
        });
        showStatus('Настройки чата обновлены');
    } catch (e) {
        showStatus('Ошибка при обновлении чата', true);
    }
}
[chatSubOnly, chatFollower, chatEmote, chatSlow].forEach(cb => {
    if(cb) cb.addEventListener('change', updateChatSettings);
});

// 6. Markers
if(markerBtn) {
    markerBtn.addEventListener('click', async () => {
        if (!broadcasterId) return;
        try {
            const response = await fetch('https://api.twitch.tv/helix/streams/markers', {
                method: 'POST',
                headers: {
                    'Client-Id': CLIENT_ID,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: broadcasterId, description: 'Created from Manager' })
            });
            if (response.ok) showStatus('Маркер успешно установлен 📌');
            else showStatus('Ошибка установки маркера (стрим должен быть онлайн)', true);
        } catch (e) {
            showStatus('Ошибка сети', true);
        }
    });
}

// 7. Ads
adBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
        if (!broadcasterId) return;
        const duration = parseInt(btn.dataset.duration);
        try {
            const response = await fetch('https://api.twitch.tv/helix/channels/commercial', {
                method: 'POST',
                headers: {
                    'Client-Id': CLIENT_ID,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ broadcaster_id: broadcasterId, length: duration })
            });
            if (response.ok) showStatus(`Реклама на ${duration}с запущена 📺`);
            else showStatus('Ошибка запуска рекламы', true);
        } catch (e) {
            showStatus('Ошибка сети', true);
        }
    });
});

// 8. Polls
if(pollBtn) {
    pollBtn.addEventListener('click', async () => {
        if (!broadcasterId) return;
        const title = pollTitle.value.trim();
        const o1 = pollOpt1.value.trim();
        const o2 = pollOpt2.value.trim();
        if (!title || !o1 || !o2) {
            showStatus('Заполните все поля опроса', true);
            return;
        }
        
        try {
            const response = await fetch('https://api.twitch.tv/helix/polls', {
                method: 'POST',
                headers: {
                    'Client-Id': CLIENT_ID,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    broadcaster_id: broadcasterId,
                    title: title,
                    choices: [{ title: o1 }, { title: o2 }],
                    duration: 60
                })
            });
            if (response.ok) {
                showStatus('Опрос запущен на 1 минуту 📊');
                pollTitle.value = '';
                pollOpt1.value = '';
                pollOpt2.value = '';
            } else {
                showStatus('Ошибка запуска опроса', true);
            }
        } catch (e) {
            showStatus('Ошибка сети', true);
        }
    });
}

checkAuth();
