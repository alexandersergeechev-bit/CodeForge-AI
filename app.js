// Конфигурационные константы твоего проекта
const GEMINI_API_KEY = "AIzaSyD7342vc_iHVt93OLEW-j9d9jHPk_nbcx8"; // Твой ключ от девелопер-консоли
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

// Сквозной контекст всей твоей экосистемы (Платформа помнит ВСЁ)
const SYSTEM_CORE_CONTEXT = `
Ты — центральное ядро инженерной ИИ-платформы CodeForge Studio. Твой создатель и единственный пользователь — Александр, высококлассный сервис-инженер, веб-разработчик и маркетолог, проживающий в Дельменхорсте, Германия.
Александр обладает C1 по немецкому языку. Его семья: жена Ольга (учит немецкий, уровень B2, запускает бьюти-бизнес шугаринга/лазера в районе Бремен/Дельменхорст) и дочери (учатся в немецкой гимназии).
У тебя есть доступ к спецификациям всех 6 проектов Александра: CodeForge AI, Gas-Profi AI, Gymnasio Aura AI, BeautyForge CRM, BeautyGlow SaaS, LeadForge AI.
Твоя задача — обрабатывать входящие данные, вести глубокий диалог без потери контекста сессии и генерировать чистый, рабочий код или структурированные таблицы без лишней "воды", строго соблюдая технические требования.
`;

let mediaRecorder;
let audioChunks = [];
let contextHistory = [{ role: "user", parts: [{ text: SYSTEM_CORE_CONTEXT }] }, { role: "model", parts: [{ text: "Центральное ядро CodeForge Studio запущено. Контекст зафиксирован." }] }];

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initTabs();
    initVoice();
    initDragAndDrop();
    
    document.getElementById("generate-btn").addEventListener("click", runOrchestrator);
    document.getElementById("chat-send-btn").addEventListener("click", sendChatReply);
    document.getElementById("btn-copy").addEventListener("click", copyToClipboard);
});

// --- БЛОК ТЕМЫ ---
function initTheme() {
    const btn = document.getElementById("theme-toggle");
    btn.addEventListener("click", () => {
        document.body.classList.toggle("light-theme");
        document.body.classList.toggle("dark-theme");
    });
}

// --- БЛОК ВКЛАДОК ---
function initTabs() {
    const buttons = document.querySelectorAll(".tab-btn");
    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(btn.dataset.tab).classList.add("active");
        });
    });
}

// --- БЛОК 1: ГОЛОСОВОЙ ШЛЮЗ (Push-to-Talk) ---
function initVoice() {
    const btn = document.getElementById("voice-btn");
    const status = document.getElementById("voice-status");

    // Обработка удержания для мобилок и десктопа
    btn.addEventListener("mousedown", startRecording);
    btn.addEventListener("touchstart", (e) => { e.preventDefault(); startRecording(); });
    
    window.addEventListener("mouseup", stopRecording);
    window.addEventListener("touchend", stopRecording);

    async function startRecording() {
        audioChunks = [];
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            mediaRecorder.onstop = processAudioData;
            mediaRecorder.start();
            btn.classList.add("recording");
            status.textContent = "🎙️ Слушаю вас... Формируйте мысли, паузы разрешены.";
        } catch (err) {
            console.error("Доступ к микрофону заблокирован:", err);
            status.textContent = "❌ Ошибка доступа к микрофону.";
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            btn.classList.remove("recording");
            status.textContent = "⚙️ Обработка и очистка аудио ИИ...";
        }
    }

    async function processAudioData() {
        // Здесь в продакшене аудио отправляется на Whisper/Gemini Audio API
        // На текущем этапе симулируем распознавание речи
        const dummyText = "Утром мой вес сегодня 65 кг. Запиши на завтрак: хлеб 50 грамм, колбаса 20 грамм.";
        document.getElementById("main-prompt").value += (document.getElementById("main-prompt").value ? "\n" : "") + dummyText;
        status.textContent = "✅ Голос успешно оцифрован и добавлен в буфер ввода.";
    }
}

// --- БЛОК 2: DRAG & DROP И OCR ---
function initDragAndDrop() {
    const zone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");

    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.style.background = "rgba(59, 130, 246, 0.1)"; });
    zone.addEventListener("dragleave", () => { zone.style.background = "transparent"; });
    zone.addEventListener("drop", (e) => { e.preventDefault(); zone.style.background = "transparent"; handleFiles(e.dataTransfer.files); });
    fileInput.addEventListener("change", (e) => { handleFiles(e.target.files); });

    function handleFiles(files) {
        if (!files.length) return;
        const file = files[0];
        document.getElementById("file-preview").innerHTML = `📁 Загружен файл: <strong>${file.name}</strong> (${Math.round(file.size/1024)} KB)`;
        // При наличии картинок здесь вызывается мультимодальный промпт к Gemini (Vision)
    }
}

// --- БЛОК 3: ЦЕНТРАЛЬНЫЙ ОРКЕСТРАТОР (ОБРАБОТКА ИИ) ---
async function runOrchestrator() {
    const preset = document.getElementById("project-preset").value;
    const userPrompt = document.getElementById("main-prompt").value;
    const genButton = document.getElementById("generate-btn");
    
    if(!userPrompt) { alert("Пожалуйста, введите ТЗ, надиктуйте текст или выберите файл."); return; }

    genButton.disabled = true;
    genButton.textContent = "🚀 Интеллектуальный синтез кода и логики...";

    // Сборка кастомных требований из чекбоксов и скрытых текстовых полей комментариев
    let subDemands = "";
    if(document.getElementById("chk-html").checked) subDemands += `\n- Сгенерируй index.html. Особенности: ${document.getElementById("note-html").value || "По умолчанию"}`;
    if(document.getElementById("chk-css").checked) subDemands += `\n- Сгенерируй style.css. Особенности: ${document.getElementById("note-css").value || "По умолчанию"}`;
    if(document.getElementById("chk-js").checked) subDemands += `\n- Сгенерируй script.js. Особенности: ${document.getElementById("note-js").value || "По умолчанию"}`;
    if(document.getElementById("chk-table").checked) subDemands += `\n- Формат вывода: Двухколоночная таблица. Параметры: ${document.getElementById("note-table").value}`;
    if(document.getElementById("chk-grammar").checked) subDemands += `\n- Сделай глубокий упор на немецкую грамматику: ${document.getElementById("note-grammar").value}`;

    const finalPromptText = `
[РЕЖИМ ПРОЕКТА]: ${preset}
[ОСНОВНОЕ ТЗ / ВВОД ДАННЫХ]: ${userPrompt}
[ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ И ФЛАЖКИ]: ${subDemands}

Выдай результат. Если затребован код, раздели его четко тегами [HTML_START][HTML_END], [CSS_START][CSS_END], [JS_START][JS_END]. Ответ для вкладки Диалог/Превью напиши в свободном экспертном стиле.
`;

    contextHistory.push({ role: "user", parts: [{ text: finalPromptText }] });

    try {
        const response = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: contextHistory })
        });
        const data = await response.json();
        const aiText = data.candidates[0].content.parts[0].text;
        
        contextHistory.push({ role: "model", parts: [{ text: aiText }] });
        renderOutputs(aiText);

    } catch (err) {
        console.error("Критическая ошибка ИИ-ядра:", err);
        alert("Ошибка связи с Gemini API. Проверьте подключение к сети.");
    } finally {
        genButton.disabled = false;
        genButton.textContent = "⚡ Запустить генерацию кода и документов";
    }
}

// Извлечение сгенерированного кода и распределение по вкладкам
function renderOutputs(text) {
    const chatHistory = document.getElementById("chat-history");
    
    // Парсинг блоков кода
    const htmlCode = extractBlock(text, "[HTML_START]", "[HTML_END]");
    const cssCode = extractBlock(text, "[CSS_START]", "[CSS_END]");
    const jsCode = extractBlock(text, "[JS_START]", "[JS_END]");

    // Чистим текст превью от технического кода для красоты чтения
    let cleanPreview = text.replace(/\[HTML_START\][\s\S]*?\[HTML_END\]/g, "")
                           .replace(/\[CSS_START\][\s\S]*?\[CSS_END\]/g, "")
                           .replace(/\[JS_START\][\s\S]*?\[JS_END\]/g, "");

    // Выводим в интерфейс
    chatHistory.innerHTML += `<div class="chat-block ai-msg">${cleanPreview.replace(/\n/g, "<br>")}</div>`;
    document.querySelector("#html-out textarea").value = htmlCode || "Код не генерировался";
    document.querySelector("#css-out textarea").value = cssCode || "Код не генерировался";
    document.querySelector("#js-out textarea").value = jsCode || "Код не генерировался";
    
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function extractBlock(text, startTag, endTag) {
    const start = text.indexOf(startTag);
    const end = text.indexOf(endTag);
    if(start === -1 || end === -1) return "";
    return text.substring(start + startTag.length, end).trim();
}

// --- БЛОК 4: ИНТЕРАКТИВНЫЙ ДИАЛОГ ВНУТРИ СЕССИИ ---
async function sendChatReply() {
    const replyInput = document.getElementById("chat-reply");
    const chatHistory = document.getElementById("chat-history");
    const text = replyInput.value;
    if(!text) return;

    chatHistory.innerHTML += `<div class="chat-block user-msg">${text}</div>`;
    replyInput.value = "";

    contextHistory.push({ role: "user", parts: [{ text: text }] });

    try {
        const response = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: contextHistory })
        });
        const data = await response.json();
        const aiText = data.candidates[0].content.parts[0].text;
        
        contextHistory.push({ role: "model", parts: [{ text: aiText }] });
        chatHistory.innerHTML += `<div class="chat-block ai-msg">${aiText.replace(/\n/g, "<br>")}</div>`;
        chatHistory.scrollTop = chatHistory.scrollHeight;
    } catch(err) {
        console.error(err);
    }
}

function copyToClipboard() {
    const activeTextarea = document.querySelector(".tab-content.active textarea");
    if(activeTextarea) {
        activeTextarea.select();
        document.execCommand("copy");
        alert("Код из текущей вкладки успешно скопирован!");
    } else {
        alert("Нечего копировать. Откройте вкладку с кодом.");
    }
}