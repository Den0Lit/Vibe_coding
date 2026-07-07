let allDocs = [];
let activeFormMode = 'testcase';
const stepsField = document.getElementById('inputSteps');

// Инициализация и управление цветовой темой приложения
function initTheme() {
    const savedTheme = localStorage.getItem('qa-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeBtnUI(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('qa-theme', newTheme);
    updateThemeBtnUI(newTheme);
}

function updateThemeBtnUI(theme) {
    const icon = document.getElementById('themeIcon');
    const text = document.getElementById('themeText');
    if (theme === 'light') {
        icon.innerText = '🌙'; text.innerText = 'Тёмная тема';
    } else {
        icon.innerText = '☀️'; text.innerText = 'Светлая тема';
    }
}

// Запуск инициализации темы при загрузке скрипта
initTheme();

// Умная автоматическая нумерация списков для поля ввода шагов
stepsField.addEventListener('focus', function() { 
    if (this.value === '') { this.value = '1. '; } 
});

stepsField.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const text = this.value, caretPos = this.selectionStart;
        const textBeforeCaret = text.substring(0, caretPos), textAfterCaret = text.substring(caretPos);
        const linesBefore = textBeforeCaret.split('\n'), currentLine = linesBefore[linesBefore.length - 1];
        const match = currentLine.match(/^(\d+)\.\s(.*)/), emptyMatch = currentLine.match(/^(\d+)\.\s*$/);
        
        if (emptyMatch) {
            linesBefore[linesBefore.length - 1] = ''; this.value = linesBefore.join('\n') + textAfterCaret;
            this.selectionStart = this.selectionEnd = caretPos - currentLine.length;
        } else if (match) {
            const insertText = `\n${parseInt(match, 10) + 1}. `;
            this.value = textBeforeCaret + insertText + textAfterCaret;
            this.selectionStart = this.selectionEnd = caretPos + insertText.length;
        } else {
            this.value = textBeforeCaret + '\n' + textAfterCaret; 
            this.selectionStart = this.selectionEnd = caretPos + 1;
        }
    }
});

// Блокировка отправки формы по клику на Enter в других текстовых полях
['inputTitle', 'inputExpected'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', function(e) { 
        if (e.key === 'Enter') { e.stopPropagation(); } 
    });
});

// Адаптивное управление цветовыми акцентами формы (Индиго / Изумрудный)
function toggleFormMode(mode) {
    activeFormMode = mode;
    const tcBtn = document.getElementById('formMode-testcase'), clBtn = document.getElementById('formMode-checklist');
    const wrapperSteps = document.getElementById('wrapperSteps'), wrapperExpected = document.getElementById('wrapperExpected');
    const labelTitle = document.getElementById('labelTitle'), formPanelTitle = document.getElementById('formPanelTitle'), submitBtn = document.getElementById('submitBtn');
    const isEditing = document.getElementById('editId').value !== "";
    const textareas = ['inputTitle', 'inputSteps', 'inputExpected'];

    if (mode === 'testcase') {
        tcBtn.className = "tab-btn active-tc"; clBtn.className = "tab-btn inactive";
        wrapperSteps.style.display = 'flex'; wrapperExpected.style.display = 'flex';
        labelTitle.innerText = "Описание тест-кейса"; 
        formPanelTitle.innerText = isEditing ? "Редактирование Тест-кейса" : "Создание Тест-кейса";
        textareas.forEach(id => { document.getElementById(id).className = "qa-textarea focus-indigo"; });
        document.getElementById('inputStatus').className = "qa-select focus-indigo"; 
        submitBtn.className = "btn-submit btn-indigo";
    } else {
        clBtn.className = "tab-btn active-cl"; tcBtn.className = "tab-btn inactive";
        wrapperSteps.style.display = 'none'; wrapperExpected.style.display = 'none';
        labelTitle.innerText = "Описание проверки (пункт чек-листа)"; 
        formPanelTitle.innerText = isEditing ? "Редактирование Чек-листа" : "Создание Чек-листа";
        textareas.forEach(id => { document.getElementById(id).className = "qa-textarea focus-emerald"; });
        document.getElementById('inputStatus').className = "qa-select focus-emerald"; 
        submitBtn.className = "btn-submit btn-emerald";
    }
}
// Быстрое фоновое inline-обновление статуса из ячейки таблицы
async function updateStatusInline(id, newStatus, selectElement) {
    const doc = allDocs.find(d => d.id === id); if (!doc) return;
    const payload = { type: doc.type, title: doc.title, status: newStatus, steps: doc.steps, expected: doc.expected };
    const res = await fetch(`/api/documents/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { selectElement.className = `status-select ${newStatus}`; doc.status = newStatus; }
}

// Запрос на полное удаление строки из базы данных SQLite
async function deleteDocument(id) {
    if (!confirm("Вы уверены, что хотите удалить эту запись?")) return;
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' }); 
    if (res.ok) { fetchDocs(); }
}

// Запуск процесса редактирования записи
function startEdit(id) {
    const doc = allDocs.find(d => d.id === id); if (!doc) return;
    document.getElementById('editId').value = doc.id; 
    toggleFormMode(doc.type);
    document.getElementById('inputTitle').value = doc.title;
    document.getElementById('inputSteps').value = doc.steps || '';
    document.getElementById('inputExpected').value = doc.expected || '';
    document.getElementById('inputStatus').value = doc.status;
    
    document.getElementById('submitBtn').innerText = "Обновить запись";
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
    document.getElementById('formAnchor').scrollIntoView({ behavior: 'smooth' });
}

// Сброс формы и выход из режима редактирования
function cancelEdit() {
    document.getElementById('editId').value = ""; 
    document.getElementById('inputTitle').value = "";
    document.getElementById('inputSteps').value = ""; 
    document.getElementById('inputExpected').value = "";
    document.getElementById('inputStatus').value = "untested";
    
    document.getElementById('submitBtn').innerText = "Сохранить в базу";
    document.getElementById('cancelEditBtn').style.display = 'none'; 
    toggleFormMode(activeFormMode);
}

// Подгрузка массива актуальных документов с сервера Go
async function fetchDocs() {
    try {
        const res = await fetch('/api/documents'); 
        allDocs = await res.json() || []; 
        renderTables();
    } catch (err) { console.error(err); }
}

function renderStatusSelectHTML(id, currentStatus) {
    return `
        <select onchange="updateStatusInline(${id}, this.value, this)" class="status-select ${currentStatus}">
            <option value="untested" ${currentStatus === 'untested' ? 'selected' : ''}>Untested</option>
            <option value="passed" ${currentStatus === 'passed' ? 'selected' : ''}>Passed</option>
            <option value="failed" ${currentStatus === 'failed' ? 'selected' : ''}>Failed</option>
        </select>
    `;
}

// Отрисовка таблиц с центрированием кнопок
function renderTables() {
    const tcBody = document.getElementById('table-testcase'), clBody = document.getElementById('table-checklist');
    const testcases = allDocs.filter(d => d.type === 'testcase'), checklists = allDocs.filter(d => d.type === 'checklist');
    document.getElementById('badge-testcase').innerText = testcases.length;
    document.getElementById('badge-checklist').innerText = checklists.length;
    const noData = (cols) => `<tr><td colspan="${cols}" class="text-center" style="color: #64748b; font-weight: 500;">Данные отсутствуют</td></tr>`;

    tcBody.innerHTML = testcases.length === 0 ? noData(6) : testcases.map(doc => `
        <tr>
            <td style="text-align: center; color: #94a3b8; font-family: monospace; font-weight: 500;">${doc.id}</td>
            <td style="font-weight: 600; text-align: left;">${escapeHtml(doc.title)}</td>
            <td style="text-align: left;"><div class="steps-container">${escapeHtml(doc.steps || '—')}</div></td>
            <td style="text-align: left;">${escapeHtml(doc.expected || '—')}</td>
            <td style="text-align: center;">${renderStatusSelectHTML(doc.id, doc.status)}</td>
            <td><div class="actions-cell"><button onclick="startEdit(${doc.id})" class="btn-edit">Редактировать</button><button onclick="deleteDocument(${doc.id})" class="btn-delete" title="Удалить">🗑</button></div></td>
        </tr>
    `).join('');

    clBody.innerHTML = checklists.length === 0 ? noData(4) : checklists.map(doc => `
        <tr>
            <td style="text-align: center; color: #94a3b8; font-family: monospace; font-weight: 500;">${doc.id}</td>
            <td style="font-weight: 600; text-align: left;">${escapeHtml(doc.title)}</td>
            <td style="text-align: center;">${renderStatusSelectHTML(doc.id, doc.status)}</td>
            <td><div class="actions-cell"><button onclick="startEdit(${doc.id})" class="btn-edit">Редактировать</button><button onclick="deleteDocument(${doc.id})" class="btn-delete" title="Удалить">🗑</button></div></td>
        </tr>
    `).join('');
}

// Отправка формы (POST для создания / PUT для обновления)
document.getElementById('qaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editId').value;
    const titleInput = document.getElementById('inputTitle'), stepsInput = document.getElementById('inputSteps'), expectedInput = document.getElementById('inputExpected'), statusSelect = document.getElementById('inputStatus');
    const payload = { type: activeFormMode, title: titleInput.value.trim(), status: statusSelect.value, steps: activeFormMode === 'testcase' ? stepsInput.value.replace(/\r\n/g, '\n').trim() : '', expected: activeFormMode === 'testcase' ? expectedInput.value.trim() : '' };
    let url = '/api/documents', method = 'POST';
    if (editId !== "") { url = `/api/documents/${editId}`; method = 'PUT'; }
    const res = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { cancelEdit(); fetchDocs(); }
});

function escapeHtml(text) { return text ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ''; }

// Первичный запрос данных при загрузке приложения
fetchDocs();
