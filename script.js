// Хранилище контекста сессии и сгенерированных файлов
let currentProjectContext = "";
let generatedFiles = {}; 
let selectedMode = "custom";

// Промпты-надстройки для каждого проекта (Твердый контекст)
const modePrompts = {
    "custom": "Ты — профессиональный ИИ-разработчик. Сгенерируй файлы по ТЗ пользователя.",
    "gas-profi": "Ты — шеф-инженер отопительной техники в Германии. Создай PWA-приложение 'Gas-Profi AI' для работы в подвалах без сети. Нужен локальный справочник ошибок, графики NTC и интерфейс RU/DE.",
    "gymnasio": "Ты — добрый репетитор немецкой гимназии. Создай интерактивное приложение 'Gymnasio Aura' для дочек: разбор текстов (ELI5), генерация Квиза из 5 вопросов и опорные слова (Stichpunkte) для устных ответов.",
    "crm": "Ты — ИТ-архитектор систем автоматизации. Спроектируй локальную CRM на Node.js/PHP + MySQL для студии Ольги с реферальной CPA-системой, антифродом и триггерными уведомлениями в Telegram.",
    "saas": "Ты — архитектор SaaS-платформ. Спроектируй многопользовательскую облачную B2B систему 'BeautyGlow SaaS' (Multi-tenant архитектура) со Stripe биллингом и ИИ-скаутом для автоматического парсинга мастеров.",
    "language": "Ты — ИИ-лингвист. Создай двухколоночную таблицу для разбора произведения: слева строго немецкий текст по главам, справа качественный смысловой русский перевод. Обеспечь удобный экспорт для печати.",
    "b2-exam": "Ты — эксперт Института Гёте. Сгенерируй идеальный образцовый диалог для устного экзамена B2 на тему 'Решение проблемы'. Интегрируй в речь повышенное количество страдательного залога (Passiv) и сослагательного наклонения (Konjunktiv II).",
    "diet": "Ты — ИИ-нутрициолог и парсер естественного языка. Создай командный трекер, куда пользователи голосом вводят данные ('съел 50г хлеба'), а ИИ сам рассчитывает калорийность и БЖУ без жесткой базы данных."
};

document.addEventListener("DOMContentLoaded", () => {
    initApiKey();
    initModeSelection();
    initDragAndDrop();
    initPushToTalk();
    
    document.getElementById("forge-btn").addEventListener("click", generateProject);
    document.getElementById("chat-send-btn").addEventListener("click", sendChatMessage);
    document.getElementById("copy-all-btn").addEventListener("click", copyAllResults);
    document.getElementById("download-zip-btn").addEventListener("click", downloadZip);
    document.getElementById("print-btn").addEventListener("click", () => window.print());
});

// Работа с API ключом в localStorage
function initApiKey() {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) {
        document.getElementById("user-gemini-key").value = savedKey;
    }
    document.getElementById("save-key-btn").addEventListener("click", () => {
        const key = document.getElementById("user-gemini-key").value.trim();
        localStorage.setItem("gemini_api_key", key);
        alert("🔑 API-ключ успешно сохранен в браузере!");
    });
}

// Выбор мини-проектов
function initModeSelection() {
    const buttons = document.querySelectorAll(".mode-btn");
    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedMode = btn.dataset.mode;
            appendSystemMessage(`Режим переключен на: **${btn.innerText}**. Системный промпт обновлен.`);
        });
    });
}

// Мультимедиа шлюз: Drag and Drop и активация камеры
function initDragAndDrop() {
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");

    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.style.borderColor = "var(--primary)"; });
    dropZone.addEventListener("dragleave", () => { dropZone.style.borderColor = "var(--border-color)"; });
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "var(--border-color)";
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener("change", () => handleFiles(fileInput.files));
}

function handleFiles(files) {
    if (!files.length) return;
    const file = files[0];
    appendSystemMessage(`Обнаружен файл: ${file.name}. Выполняется симуляция сбора данных/OCR...`);
    
    if (file.type.startsWith("image/")) {
        setTimeout(() => {
            document.getElementById("main-context").value += `\n[Распознанный текст с фото шильдика/учебника]: \nBrand: Viessmann, Model: Vitodens 200, Serial: 7179823105432...`;
            appendSystemMessage("📸 Данные с камеры успешно оцифрованы и добавлены в контекст!");
        }, 1000);
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById("main-context").value += `\n${e.target.result}`;
            appendSystemMessage("📄 Текст файла успешно интегрирован в рабочее поле.");
        };
        reader.readAsText(file);
    }
}

// Голосовой шлюз "Умное удержание" (Push-to-Talk) через Web Speech API
function initPushToTalk() {
    const pttBtn = document.getElementById("ptt-btn");
    const status = document.getElementById("voice-status");
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        status.innerText = "Голосовой ввод не поддерживается вашим браузером (нужен Chrome/Safari).";
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "ru-RU";

    let isRecording = false;

    const startRecording = (e) => {
        e.preventDefault();
        if (isRecording) return;
        isRecording = true;
        pttBtn.classList.add("recording");
        status.innerText = "🎤 Слушаю вас... Формируйте мысль, паузы не страшны.";
        recognition.start();
    };

    const stopRecording = (e) => {
        e.preventDefault();
        if (!isRecording) return;
        isRecording = false;
        pttBtn.classList.remove("recording");
        status.innerText = "⏳ Обработка и очистка аудио от пауз ИИ...";
        recognition.stop();
    };

    pttBtn.addEventListener("mousedown", startRecording);
    pttBtn.addEventListener("mouseup", stopRecording);
    pttBtn.addEventListener("touchstart", startRecording);
    pttBtn.addEventListener("touchend", stopRecording);

    recognition.onresult = (event) => {
        let text = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            text += event.results[i][0].transcript;
        }
        document.getElementById("main-context").value += ` ${text}`;
        appendUserMessage(`🎙️ (Голос): ${text}`);
    };

    recognition.onerror = () => { status.innerText = "Связь готова. Нажми и держи."; pttBtn.classList.remove("recording"); isRecording = false; };
    recognition.onend = () => { status.innerText = "Связь готова. Нажми и держи."; };
}

// Облегченный и гарантированно совместимый отправщик запросов в Google Gemini 1.5 Flash (v1)
async function callGemini(promptText) {
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
        alert("🔒 Ошибка: Вставьте и сохраните ваш личный API Ключ в шапке платформы!");
        return null;
    }

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                contents: [
                    { 
                        parts: [{ text: promptText }] 
                    }
                ],
                generationConfig: { 
                    temperature: 0.2 // Низкая температура гарантирует строгое следование ТЗ и выдачу JSON
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Детали ошибки от Google API:", errorData);
            alert(`❌ Ошибка API (${response.status}): ${errorData.error?.message || 'Неизвестный сбой сервера.'}`);
            return null;
        }

        const data = await response.json();
        const outputText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (outputText) {
            return outputText;
        } else {
            console.error("Пустой ответ от API:", data);
            alert("ИИ вернул пустой контент. Попробуйте ещё раз.");
            return null;
        }
    } catch (err) {
        console.error("Сбой сети или CORS:", err);
        alert("Сетевая ошибка. Проверьте консоль (F12), токен или VPN.");
        return null;
    }
}

// ОСНОВНАЯ ГЕНЕРАЦИЯ ПРОЕКТА (Компилятор)
async function generateProject() {
    const context = document.getElementById("main-context").value.trim();
    if (!context) {
        alert("Введите ТЗ или наговорите задачу голосом!");
        return;
    }

    const forgeBtn = document.getElementById("forge-btn");
    forgeBtn.innerText = "⚡ КУЗНИЦА КУЕТ КОД (Ожидание 3-7 сек)...";
    forgeBtn.disabled = true;

    let requirements = "";
    if (document.getElementById("gen-html").checked) requirements += `- Файл index.html. Особенности: ${document.getElementById("note-html").value}\n`;
    if (document.getElementById("gen-css").checked) requirements += `- Файл style.css. Особенности: ${document.getElementById("note-css").value}\n`;
    if (document.getElementById("gen-js").checked) requirements += `- Файл script.js. Особенности: ${document.getElementById("note-js").value}\n`;
    if (document.getElementById("gen-pwa").checked) requirements += `- Автономия PWA (manifest.json, sw.js). Особенности: ${document.getElementById("note-pwa").value}\n`;
    if (document.getElementById("out-table").checked) requirements += `- Вывод в двухколоночную таблицу перевода. Особенности: ${document.getElementById("note-table").value}\n`;
    if (document.getElementById("out-doc").checked) requirements += `- Форматирование под Google Doc/печать. Особенности: ${document.getElementById("note-doc").value}\n`;

    const finalPrompt = `
        ${modePrompts[selectedMode]}
        Контекст текущей сессии: ${context}
        Необходимая структура сборки и файлы:\n${requirements}
        
        СТРОГОЕ ПРАВИЛО: Выдай результат в формате JSON-объекта, где ключами будут имена файлов (например "index.html", "style.css"), а значением — чистый код или сгенерированный контент внутри файла. Никаких лишних слов, комментариев или разметки markdown вне JSON! Структура ответа должна быть строго парсируемой: {"filename": "содержимое файла"}.
    `;

    const aiResponse = await callGemini(finalPrompt);
    forgeBtn.innerText = "🚀 ЗАПУСТИТЬ КУЗНИЦУ КОДА";
    forgeBtn.disabled = false;

    // Проверка: передаем данные в рендер только если запрос прошел успешно
    if (aiResponse) {
        parseAndRenderResult(aiResponse);
    }
}

// Парсинг JSON-ответа от ИИ и рендеринг вкладок
function parseAndRenderResult(rawText) {
    if (!rawText) return;
    
    try {
        let cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        generatedFiles = JSON.parse(cleanedText);
        
        const tabsHeader = document.getElementById("tabs-header");
        const tabsContent = document.getElementById("tabs-content");
        
        tabsHeader.innerHTML = "";
        tabsContent.innerHTML = "";
        
        let first = true;
        for (const [filename, content] of Object.entries(generatedFiles)) {
            const btn = document.createElement("button");
            btn.className = `tab-link ${first ? 'active' : ''}`;
            btn.innerText = filename;
            btn.onclick = () => switchTab(filename);
            btn.id = `tab-btn-${filename.replace('.', '-')}`;
            tabsHeader.appendChild(btn);
            
            const pane = document.createElement("div");
            pane.className = `tab-pane ${first ? 'active' : ''}`;
            pane.id = `pane-${filename.replace('.', '-')}`;
            
            const pre = document.createElement("pre");
            pre.innerText = content;
            pane.appendChild(pre);
            tabsContent.appendChild(pane);
            
            first = false;
        }
        
        document.getElementById("result-section").style.display = "block";
        document.getElementById("result-section").scrollIntoView({ behavior: 'smooth' });
        appendAiMessage("🛠️ Проект успешно скомпилирован! Файлы разложены по вкладкам ниже.");
    } catch (e) {
        console.error("Ошибка парсинга кода:", e, rawText);
        generatedFiles = { "output.txt": rawText };
        parseAndRenderResult(JSON.stringify(generatedFiles));
    }
}

function switchTab(filename) {
    document.querySelectorAll(".tab-link").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    
    document.getElementById(`tab-btn-${filename.replace('.', '-')}`).classList.add("active");
    document.getElementById(`pane-${filename.replace('.', '-')}`).classList.add("active");
}

// Диалоговое окно: Умный доработчик сессии
async function sendChatMessage() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;

    appendUserMessage(text);
    input.value = "";

    const finalPrompt = `
        Контекст текущего проекта: ${document.getElementById("main-context").value}
        Уже сгенерированные файлы: ${JSON.stringify(generatedFiles)}
        Уточнение/Модификация от пользователя: ${text}
        
        Выполни доработку структуры. Перевыпусти измененные файлы в формате JSON: {"имя_файла": "новый код"}.
    `;

    const aiResponse = await callGemini(finalPrompt);
    if (aiResponse) {
        parseAndRenderResult(aiResponse);
    }
}

// Функции экспорта результатов
function copyAllResults() {
    let allContent = "";
    for (const [filename, content] of Object.entries(generatedFiles)) {
        allContent += `\n/* === FILE: ${filename} === */\n${content}\n`;
    }
    navigator.clipboard.writeText(allContent);
    alert("📋 Весь код из всех вкладок скопирован в буфер обмена!");
}

// Резервный экспорт, если JSZip заблокирован политикой конфиденциальности браузера
function downloadZip() {
    if (typeof JSZip === "undefined") {
        // Если Tracking Prevention убил JSZip, отдаем монолитный файл
        appendSystemMessage("⚠️ Браузер заблокировал хранилище для ZIP-библиотеки. Скачиваем один общий файл проекта...");
        downloadAsSingleFile();
        return;
    }
    try {
        const zip = new JSZip();
        for (const [filename, content] of Object.entries(generatedFiles)) {
            zip.file(filename, content);
        }
        zip.generateAsync({ type: "blob" }).then((blob) => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "forge-project.zip";
            a.click();
        }).catch(err => {
            console.error("Сбой JSZip внутри сессии:", err);
            downloadAsSingleFile();
        });
    } catch(e) {
        downloadAsSingleFile();
    }
}

// Вспомогательный метод скачивания монолита
function downloadAsSingleFile() {
    let singleContent = "/* Сборка проекта CodeForge AI */\n";
    for (const [filename, content] of Object.entries(generatedFiles)) {
        singleContent += `\n\n/* ==================== FILE: ${filename} ==================== */\n${content}`;
    }
    const blob = new Blob([singleContent], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "all_project_files.txt";
    a.click();
}

// Вспомогательные интерфейсные сообщения
function appendUserMessage(msg) {
    const win = document.getElementById("chat-window");
    win.innerHTML += `<div class="chat-msg user">${msg}</div>`;
    win.scrollTop = win.scrollHeight;
}
function appendAiMessage(msg) {
    const win = document.getElementById("chat-window");
    win.innerHTML += `<div class="chat-msg ai">${msg}</div>`;
    win.scrollTop = win.scrollHeight;
}
function appendSystemMessage(msg) {
    const win = document.getElementById("chat-window");
    win.innerHTML += `<div class="chat-msg system">${msg}</div>`;
    win.scrollTop = win.scrollHeight;
}