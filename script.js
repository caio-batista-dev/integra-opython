document.addEventListener('DOMContentLoaded', () => {
    // --- MAPEAMENTO DE ELEMENTOS DO DOM ---
    const gameWrapper = document.getElementById('game-wrapper');
    const screens = {
        menu: document.getElementById('main-menu-screen'),
        selection: document.getElementById('selection-screen'),
        game: document.getElementById('game-screen'),
        evaluation: document.getElementById('evaluation-screen'),
        stats: document.getElementById('stats-screen'),
        resourceTest: document.getElementById('resource-test-screen'),
    };
    const overlays = { pause: document.getElementById('pause-overlay') };
    const feedbackFlash = document.getElementById('feedback-flash');
    const gameControls = { pauseBtn: document.getElementById('pause-btn'), returnToMenuBtn: document.getElementById('return-to-menu-btn'), voiceToggle: document.getElementById('game-voice-toggle') };
    const hud = { dias: document.getElementById('dias-restantes'), pontos: document.getElementById('pontuacao'), tempo: document.getElementById('tempo') };
    const modal = {
        element: document.getElementById('sequence-modal'), deptName: document.getElementById('modal-department-name'),
        meta: document.getElementById('modal-meta'), timerBar: document.getElementById('input-timer-bar'),
        arrowSequence: document.getElementById('modal-arrows-sequence'), characters: document.getElementById('modal-characters'),
    };
    const selectionControls = {
        grid: document.getElementById('department-selection-grid'), selectAllBtn: document.getElementById('select-all-btn'),
        clearAllBtn: document.getElementById('clear-all-btn'), startGameBtn: document.getElementById('start-game-btn'),
        backToMenuBtn: document.getElementById('back-to-menu-btn'), voiceToggle: document.getElementById('selection-voice-toggle'),
    };
    const menuControls = { playBtn: document.getElementById('play-button'), resourceTestBtn: document.getElementById('resource-test-btn') };
    const evaluationControls = { finalGrade: document.getElementById('final-grade'), viewStatsBtn: document.getElementById('view-stats-btn') };
    const statsControls = {
        time: document.getElementById('stats-time'), correct: document.getElementById('stats-correct'),
        incorrect: document.getElementById('stats-incorrect'), completed: document.getElementById('stats-completed'),
        topDeptsList: document.getElementById('top-depts-list'), restartBtn: document.getElementById('restart-button'),
    };
    const resourceTestControls = {
        output: document.getElementById('voice-output'),
        backBtn: document.getElementById('back-to-menu-from-test-btn'),
    };

    // --- DADOS E ESTADO DO JOGO ---
    const ALL_DEPARTMENTS_DATA = [
        { id: 'atendimento', name: 'Atendimento', men: 1, women: 0, color: '#007bff' },
        { id: 'camaras', name: 'Câmaras Setoriais', men: 1, women: 1, color: '#17a2b8' },
        { id: 'cieq', name: 'CIEQ – Estágio', men: 0, women: 1, color: '#28a745' },
        { id: 'comercial', name: 'Comercial', men: 1, women: 2, color: '#6f42c1' },
        { id: 'compras', name: 'Compras', men: 1, women: 0, color: '#6610f2' },
        { id: 'marketing', name: 'Marketing', men: 0, women: 1, color: '#e83e8c' },
        { id: 'projetos', name: 'Projetos', men: 1, women: 1, color: '#fd7e14' },
        { id: 'rodada', name: 'Rodada de Negócios', men: 1, women: 3, color: '#20c997' },
        { id: 'geral', name: 'Serviço Geral', men: 1, women: 2, color: '#dc3545' },
        { id: 'faturamento-receber', name: 'Faturamento/Contas a receber', men: 1, women: 1, color: '#c29b0c' },
        { id: 'financeiro-contabilidade', name: 'Financeiro/Contabilidade', men: 0, women: 3, color: '#6c757d' },
        { id: 'coord-diretoria', name: 'Diretoria Executiva/Coord. Adm.', men: 1, women: 1, color: '#343a40' },
        { id: 'historiador', name: 'Historiador', men: 1, women: 0, color: '#d65f1d' }
    ];
    const ARROW_MAP = { 'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→' };
    const ARROW_KEYS = Object.keys(ARROW_MAP);
    const INPUT_TIME_MS = 3000;
    const GAME_DURATION_SECONDS = 300;
    const BASE_WIDTH = 1280;
    const BASE_HEIGHT = 720;

    const correctSound = new Audio('correct.mp3');
    const errorSound = new Audio('error.mp3');
    correctSound.volume = 0.4;
    errorSound.volume = 0.3;

    let gameState = {};
    let timers = {};
    let isVoiceControlActive = false;
    let recognition;

    // --- LÓGICA DE RESPONSIVIDADE ---
    function resizeGame() {
        const scaleX = window.innerWidth / BASE_WIDTH;
        const scaleY = window.innerHeight / BASE_HEIGHT;
        const scale = Math.min(scaleX, scaleY);
        gameWrapper.style.transform = `scale(${scale})`;
        gameWrapper.style.left = `${(window.innerWidth - BASE_WIDTH * scale) / 2}px`;
        gameWrapper.style.top = `${(window.innerHeight - BASE_HEIGHT * scale) / 2}px`;
    }

    // --- LÓGICA DE COMANDO DE VOZ (WEB SPEECH API) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isSpeechRecognitionSupported = !!SpeechRecognition;
    const VOICE_COMMANDS = { 'cima': 'ArrowUp', 'baixo': 'ArrowDown', 'esquerda': 'ArrowLeft', 'direita': 'ArrowRight' };

    function setupSpeechRecognition() {
        if (!isSpeechRecognitionSupported) {
            console.warn("Web Speech API não é suportada neste navegador.");
            [selectionControls.voiceToggle, gameControls.voiceToggle, menuControls.resourceTestBtn].forEach(btn => btn.disabled = true);
            return;
        }
        recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            const lastResult = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
            resourceTestControls.output.textContent = `Último comando ouvido: "${lastResult}"`;
            const command = Object.keys(VOICE_COMMANDS).find(cmd => lastResult.includes(cmd));
            if (command && gameState.activeDepartment && !gameState.isPaused) {
                handleKeyPress({ key: VOICE_COMMANDS[command], preventDefault: () => {} });
            }
        };
        recognition.onerror = (event) => {
            console.error("Erro no reconhecimento de voz:", event.error);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                alert('Permissão para o microfone negada. Os comandos de voz não funcionarão.');
                toggleVoiceControls(false);
            }
        };
        recognition.onend = () => {
            if (isVoiceControlActive) {
                try { recognition.start(); } catch(e) {}
            }
        };
    }

    function toggleVoiceControls(forceState = null) {
        if (!isSpeechRecognitionSupported) return;
        isVoiceControlActive = forceState !== null ? forceState : !isVoiceControlActive;
        if (isVoiceControlActive) {
            try { recognition.start(); } catch (e) { console.error("Erro ao iniciar reconhecimento:", e); }
        } else {
            try { recognition.stop(); } catch(e) {}
        }
        [selectionControls.voiceToggle, gameControls.voiceToggle].forEach(btn => btn.classList.toggle('active', isVoiceControlActive));
    }

    // --- FUNÇÕES DE FEEDBACK ---
    function playFeedback(type) {
        const sound = type === 'correct' ? correctSound : errorSound;
        sound.currentTime = 0;
        sound.play().catch(e => {});
        feedbackFlash.className = type === 'correct' ? 'correct-flash' : 'incorrect-flash';
        setTimeout(() => { feedbackFlash.className = ''; }, 300);
    }

    // --- FUNÇÕES DE CONTROLE DE TELA E ESTADO ---
    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.add('hidden'));
        screens[screenName].classList.remove('hidden');
    }

    function togglePause(forceState = null) {
        const wasPaused = gameState.isPaused;
        gameState.isPaused = forceState !== null ? forceState : !gameState.isPaused;
        if (wasPaused === gameState.isPaused) return;
        overlays.pause.classList.toggle('hidden', !gameState.isPaused);
        gameControls.pauseBtn.textContent = gameState.isPaused ? 'Continuar (P)' : 'Pausar (P)';
        if (gameState.activeDepartment) {
            if (gameState.isPaused) {
                clearTimeout(timers.input);
                modal.timerBar.style.transition = 'none';
            } else {
                resetInputTimer();
            }
        }
    }

    function returnToMenu() {
        if (confirm('Tem certeza que deseja voltar ao menu? Todo o progresso será perdido.')) {
            cleanUpGame();
            showScreen('menu');
        }
    }

    // --- LÓGICA DA TELA DE SELEÇÃO ---
    function populateSelectionGrid() {
        selectionControls.grid.innerHTML = '';
        ALL_DEPARTMENTS_DATA.forEach((dept, index) => {
            const label = document.createElement('label');
            label.className = 'checkbox-label';
            label.style.backgroundColor = dept.color;
            label.innerHTML = `<input type="checkbox" value="${index}" checked><span class="checkbox-custom"></span>${dept.name}`;
            selectionControls.grid.appendChild(label);
        });
        updateSelectionCount();
    }

    function updateSelectionCount() {
        const checkedCount = selectionControls.grid.querySelectorAll('input:checked').length;
        selectionControls.startGameBtn.textContent = `Iniciar Jogo (${checkedCount})`;
        selectionControls.startGameBtn.disabled = checkedCount === 0;
    }

    // --- LÓGICA PRINCIPAL DO JOGO ---
    function setupNewGame() {
        const selectedIndexes = [...selectionControls.grid.querySelectorAll('input:checked')].map(cb => parseInt(cb.value));
        const selectedDepartments = selectedIndexes.map(i => ({
            ...ALL_DEPARTMENTS_DATA[i], progress: 0, originalIndex: i,
            meta: Math.floor(Math.random() * 2) + 2,
            corrects: 0, errors: 0,
        }));
        gameState = {
            score: 0, timeLeft: GAME_DURATION_SECONDS, daysLeft: 20.0, activeDepartment: null,
            currentSequence: [], currentStep: 0, isPaused: false, departments: selectedDepartments,
            totalCorrects: 0, totalIncorrects: 0, startTime: Date.now(),
        };
        showScreen('game');
        createDepartmentCards();
        updateHUD();
        startGameLoops();
        window.addEventListener('keydown', handleGlobalKeys);
        setTimeout(pickNextDepartment, 1500);
    }

    function startGameLoops() {
        clearInterval(timers.main);
        timers.main = setInterval(() => {
            // CORREÇÃO: O timer principal também pausa quando uma sequência está ativa
            if (gameState.isPaused || gameState.activeDepartment) return;
            gameState.timeLeft--;
            gameState.daysLeft -= 0.01;
            if (gameState.timeLeft <= 0 || gameState.daysLeft <= 0) endGame(false);
            updateHUD();
        }, 1000);
    }

    function updateHUD() {
        const minutes = Math.floor(gameState.timeLeft / 60);
        const seconds = gameState.timeLeft % 60;
        hud.tempo.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        hud.pontos.textContent = `${gameState.score}`;
        hud.dias.textContent = `${Math.max(0, gameState.daysLeft).toFixed(1)}`;
    }

    function createDepartmentCards() {
        const grid = document.getElementById('departments-grid');
        grid.innerHTML = '';
        gameState.departments.forEach(dept => {
            const card = document.createElement('div');
            card.className = 'department-card';
            card.id = `dept-card-${dept.originalIndex}`;
            if (dept.progress >= dept.meta) card.classList.add('completed');
            card.style.backgroundPosition = `${Math.random() * 100}% ${Math.random() * 100}%`;
            card.innerHTML = `<span class="department-name">${dept.name}</span><span class="department-meta">Meta: ${dept.progress} / ${dept.meta}</span>`;
            grid.appendChild(card);
        });
    }

    function pickNextDepartment() {
        if (gameState.isPaused) return;
        const availableDepts = gameState.departments.filter(d => d.progress < d.meta);
        if (availableDepts.length === 0) { endGame(true); return; }
        const nextDept = availableDepts[Math.floor(Math.random() * availableDepts.length)];
        startSequence(nextDept);
    }

    function startSequence(dept) {
        // CORREÇÃO: Não usamos mais gameState.isPaused aqui
        gameState.activeDepartment = dept;
        const sequenceLength = Math.floor(Math.random() * 3) + 3;
        gameState.currentSequence = Array.from({ length: sequenceLength }, () => ARROW_KEYS[Math.floor(Math.random() * ARROW_KEYS.length)]);
        gameState.currentStep = 0;
        document.getElementById(`dept-card-${dept.originalIndex}`).classList.add('active');
        modal.deptName.textContent = dept.name;
        modal.meta.textContent = `${dept.progress} / ${dept.meta}`;
        modal.element.querySelector('.modal-content').style.borderColor = dept.color;
        modal.characters.innerHTML = '';
        for (let i = 0; i < dept.men; i++) { modal.characters.innerHTML += `<img src="man.png">`; }
        for (let i = 0; i < dept.women; i++) { modal.characters.innerHTML += `<img src="woman.png">`; }
        renderArrows();
        modal.element.classList.remove('hidden');
        resetInputTimer();
        window.addEventListener('keydown', handleKeyPress);
    }

    function resetInputTimer() {
        clearTimeout(timers.input);
        modal.timerBar.style.transition = 'none';
        modal.timerBar.style.width = '100%';
        void modal.timerBar.offsetWidth;
        modal.timerBar.style.transition = `width ${INPUT_TIME_MS / 1000}s linear`;
        modal.timerBar.style.width = '0%';
        timers.input = setTimeout(() => failSequence(true), INPUT_TIME_MS);
    }

    function renderArrows() {
        modal.arrowSequence.innerHTML = gameState.currentSequence.map((key, index) => {
            let className = 'arrow-box';
            if (index < gameState.currentStep) className += ' correct';
            else if (index === gameState.currentStep) className += ' current';
            return `<div class="${className}">${ARROW_MAP[key]}</div>`;
        }).join('');
    }

    function handleGlobalKeys(e) { if (e.key.toLowerCase() === 'p') togglePause(); }

    function handleKeyPress(e) {
        // CORREÇÃO: A verificação de pausa agora funciona corretamente
        if (!gameState.activeDepartment || gameState.isPaused || !ARROW_KEYS.includes(e.key)) return;
        e.preventDefault();
        if (e.key === gameState.currentSequence[gameState.currentStep]) {
            playFeedback('correct');
            gameState.currentStep++;
            renderArrows();
            if (gameState.currentStep === gameState.currentSequence.length) {
                completeSequence();
            } else {
                resetInputTimer();
            }
        } else {
            playFeedback('incorrect');
            failSequence(false);
        }
    }

    function completeSequence() {
        const dept = gameState.activeDepartment;
        dept.progress++;
        gameState.score += 500;
        if (dept.progress === dept.meta) gameState.score += 1000;
        const sequenceLength = gameState.currentSequence.length;
        gameState.totalCorrects += sequenceLength;
        dept.corrects += sequenceLength;
        updateHUD();
        closeModal();
    }

    function failSequence(isTimeout) {
        if (isTimeout) {
            playFeedback('incorrect');
        }
        gameState.totalIncorrects++;
        if(gameState.activeDepartment) gameState.activeDepartment.errors++;
        gameState.score = Math.max(0, gameState.score - 100);
        updateHUD();
        closeModal();
    }

    function closeModal() {
        clearTimeout(timers.input);
        window.removeEventListener('keydown', handleKeyPress);
        if (gameState.activeDepartment) {
            document.getElementById(`dept-card-${gameState.activeDepartment.originalIndex}`).classList.remove('active');
        }
        modal.element.classList.add('hidden');
        createDepartmentCards();
        gameState.activeDepartment = null;
        // CORREÇÃO: Não mexemos mais em gameState.isPaused aqui
        setTimeout(pickNextDepartment, 1200);
    }

    function cleanUpGame() {
        clearInterval(timers.main);
        clearTimeout(timers.input);
        window.removeEventListener('keydown', handleGlobalKeys);
        window.removeEventListener('keydown', handleKeyPress);
        if (isVoiceControlActive) toggleVoiceControls(false);
        if (gameState.isPaused) togglePause(false);
    }

    function endGame(isVictory) {
        cleanUpGame();
        gameState.isPaused = true;
        const finalGrade = calculateFinalGrade(isVictory);
        showEvaluationScreen(finalGrade);
    }

    function calculateFinalGrade(isVictory) {
        const successfulSequences = gameState.totalCorrects / (gameState.currentSequence?.length || 3);
        const totalSequencesAttempted = successfulSequences + gameState.totalIncorrects;
        const accuracy = totalSequencesAttempted > 0 ? successfulSequences / totalSequencesAttempted : 0;
        const timeTaken = (Date.now() - gameState.startTime) / 1000;
        const timeEfficiency = Math.max(0, (GAME_DURATION_SECONDS - timeTaken) / GAME_DURATION_SECONDS);
        let grade = (accuracy * 6) + (timeEfficiency * 2);
        if (isVictory) { grade += 2; }
        return Math.max(0, Math.min(10, grade)).toFixed(1);
    }

    function showEvaluationScreen(grade) {
        evaluationControls.finalGrade.textContent = grade;
        showScreen('evaluation');
    }

    function showStatsScreen() {
        const timeTaken = Math.round((Date.now() - gameState.startTime) / 1000);
        const minutes = Math.floor(timeTaken / 60);
        const seconds = timeTaken % 60;
        statsControls.time.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        statsControls.correct.textContent = gameState.totalCorrects;
        statsControls.incorrect.textContent = gameState.totalIncorrects;
        statsControls.completed.textContent = gameState.departments.filter(d => d.progress >= d.meta).length;
        const sortedDepts = [...gameState.departments].sort((a, b) => (b.corrects - b.errors) - (a.corrects - a.errors));
        statsControls.topDeptsList.innerHTML = '';
        sortedDepts.slice(0, 3).forEach(dept => {
            const item = document.createElement('div');
            item.className = 'top-dept-item';
            item.innerHTML = `<span>${dept.name}</span><span>${dept.corrects} acertos / ${dept.errors} erros</span>`;
            statsControls.topDeptsList.appendChild(item);
        });
        showScreen('stats');
    }

    // --- EVENT LISTENERS ---
    menuControls.playBtn.addEventListener('click', () => showScreen('selection'));
    menuControls.resourceTestBtn.addEventListener('click', () => {
        showScreen('resourceTest');
        if (!isVoiceControlActive) toggleVoiceControls(true);
    });
    resourceTestControls.backBtn.addEventListener('click', () => {
        if (isVoiceControlActive) toggleVoiceControls(false);
        showScreen('menu');
    });
    selectionControls.backToMenuBtn.addEventListener('click', () => showScreen('menu'));
    selectionControls.startGameBtn.addEventListener('click', setupNewGame);
    selectionControls.selectAllBtn.addEventListener('click', () => {
        selectionControls.grid.querySelectorAll('input').forEach(cb => cb.checked = true);
        updateSelectionCount();
    });
    selectionControls.clearAllBtn.addEventListener('click', () => {
        selectionControls.grid.querySelectorAll('input').forEach(cb => cb.checked = false);
        updateSelectionCount();
    });
    selectionControls.grid.addEventListener('change', updateSelectionCount);
    selectionControls.voiceToggle.addEventListener('click', () => toggleVoiceControls());
    gameControls.voiceToggle.addEventListener('click', () => toggleVoiceControls());
    evaluationControls.viewStatsBtn.addEventListener('click', showStatsScreen);
    statsControls.restartBtn.addEventListener('click', () => {
        showScreen('menu');
        populateSelectionGrid();
    });
    gameControls.pauseBtn.addEventListener('click', () => togglePause());
    gameControls.returnToMenuBtn.addEventListener('click', returnToMenu);

    // --- INICIALIZAÇÃO ---
    window.addEventListener('resize', resizeGame);
    populateSelectionGrid();
    setupSpeechRecognition();
    resizeGame();
    showScreen('menu');
});