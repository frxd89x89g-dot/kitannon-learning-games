/**
 * Math Balloon Game - Kitannon
 * Handles game loop, physics, input, and state management.
 */

// --- Configuration & Constants ---
const CONFIG = {
    colors: ['#EF5350', '#42A5F5', '#66BB6A', '#FFCA28', '#AB47BC', '#FF7043'],

    // Spawn Settings
    spawnIntervalPC: 1.2,
    spawnIntervalMobile: 1.6, // Slower spawn on mobile

    // Balloon Travel Time (Safety: Slower on mobile)
    travelTimeNormalPC: 5.0,
    travelTimeNormalMobile: 6.5, // 30% slower
    travelTimeSlowPC: 7.0,
    travelTimeSlowMobile: 9.0,

    // Limits
    maxBalloonsPC: 8,
    maxBalloonsMobile: 5,

    // Sizing
    mobileHeightThreshold: 700,
    mobileWidthThreshold: 600,

    balloonBaseRadiusPC: 35,
    balloonBaseRadiusMobile: 45, // Larger tap target
    hitRadiusExpand: 15, // Extra invisible hit area

    gameDuration: 60, // Seconds
};

// --- Scoring Tables (grade-scaled) ---
const SCORE = {
    correct: { 1: 8, 2: 10, 3: 12, 4: 14, 5: 16, 6: 20 },
    wrong:   { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 8 },
};

// --- State Management ---
const state = {
    isPlaying: false,
    isPaused: false,
    score: 0,
    highScore: parseInt(localStorage.getItem('kitannon_math_highscore') || '0'),
    combo: 0,
    timeLeft: CONFIG.gameDuration,
    question: { text: '', ans: 0 },
    balloons: [],
    lastTime: 0,
    spawnTimer: 0,
    settings: {
        speed: localStorage.getItem('kitannon_math_speed') || 'normal',
        lowGrade: localStorage.getItem('kitannon_math_lowgrade') === 'true',
        sound: localStorage.getItem('kitannon_math_sound') !== 'false',
        grade: parseInt(localStorage.getItem('kitannon_math_grade') || '1')
    },
    canvas: { width: 0, height: 0, scale: 1 },
    assets: {
        normal: new Image(),
        correct: new Image(),
        wrong: new Image()
    }
};

// --- DOM Elements ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const uiScore = document.getElementById('score-display');
const uiQuestion = document.getElementById('question-text');
const uiTime = document.getElementById('time-display');
const uiCombo = document.getElementById('combo-popup'); // Updated to new popup
const uiComboCount = document.getElementById('combo-count');
const uiFinalScore = document.getElementById('final-score');
const uiHighScore = document.getElementById('high-score');
const overlayStart = document.getElementById('overlay-start');
const overlayGameOver = document.getElementById('overlay-gameover');
const overlaySettings = document.getElementById('overlay-settings');
const feedbackLayer = document.getElementById('char-feedback');
const feedbackImg = document.getElementById('feedback-img');

// --- Helper Functions ---
function isMobile() {
    return window.innerHeight < CONFIG.mobileHeightThreshold || window.innerWidth < CONFIG.mobileWidthThreshold;
}

// Format text for better readability on small screens
function formatQuestionText(text) {
    if (!isMobile()) return text;
    if (text.length < 12) return text;
    if (text.includes('\n')) return text;

    if (text.includes(" =")) {
        if (text.includes(" × ")) return text.replace(" × ", "\n× ");
        if (text.includes(" ÷ ")) return text.replace(" ÷ ", "\n÷ ");
    }

    if (text.length > 15) {
        const mid = Math.floor(text.length / 2);
        const spaceIdx = text.lastIndexOf(' ', mid);
        if (spaceIdx > 0) {
            return text.substring(0, spaceIdx) + '\n' + text.substring(spaceIdx + 1);
        }
    }

    return text;
}

// Normalize value for comparison (Decimals vs integers)
function normalize(v) {
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(1);
}

function rInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function round1(v) {
    return Math.round(v * 10) / 10;
}

// --- Initialization ---
function init() {
    // Load Images
    state.assets.normal.src = '../../assets/characters/kitannon_normal.png';
    state.assets.correct.src = '../../assets/characters/kitannon_correct.png';
    state.assets.wrong.src = '../../assets/characters/kitannon_wrong.png';

    // Resize Handling
    window.addEventListener('resize', handleResize);
    handleResize();

    // Event Listeners
    setupInput();
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('retry-btn').addEventListener('click', resetGame);

    // Grade Selector
    const gradeSelect = document.getElementById('grade-select');
    if (gradeSelect) {
        gradeSelect.value = state.settings.grade;
        gradeSelect.addEventListener('change', (e) => {
            state.settings.grade = parseInt(e.target.value);
            localStorage.setItem('kitannon_math_grade', state.settings.grade);
        });
    }

    // Settings UI
    document.getElementById('settings-open-btn').addEventListener('click', openSettings);
    document.getElementById('settings-close-btn').addEventListener('click', closeSettings);

    overlaySettings.addEventListener('click', (e) => {
        if (e.target === overlaySettings) closeSettings();
    });

    loadSettingsUI();

    uiHighScore.innerText = state.highScore;
    requestAnimationFrame(gameLoop);
}

function handleResize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.canvas.width = window.innerWidth;
    state.canvas.height = window.innerHeight;
    state.canvas.scale = dpr;
}

function loadSettingsUI() {
    document.getElementById(state.settings.speed === 'slow' ? 'speed-slow' : 'speed-normal').checked = true;
    document.getElementById('low-grade-mode').checked = state.settings.lowGrade;
    const soundToggleSet = document.getElementById('sound-toggle-settings');
    const soundToggleStart = document.getElementById('sound-toggle-start');
    if (soundToggleSet) soundToggleSet.checked = state.settings.sound;
    if (soundToggleStart) soundToggleStart.checked = state.settings.sound;
}

function saveSettings() {
    if (document.getElementById('speed-slow').checked) state.settings.speed = 'slow';
    else state.settings.speed = 'normal';

    state.settings.lowGrade = document.getElementById('low-grade-mode').checked;

    const soundOn = document.getElementById('sound-toggle-settings').checked;
    const wasSoundOn = state.settings.sound;
    state.settings.sound = soundOn;
    document.getElementById('sound-toggle-start').checked = soundOn;

    localStorage.setItem('kitannon_math_speed', state.settings.speed);
    localStorage.setItem('kitannon_math_lowgrade', state.settings.lowGrade);
    localStorage.setItem('kitannon_math_sound', state.settings.sound);

    if (wasSoundOn && !soundOn) {
        stopBGM();
    } else if (!wasSoundOn && soundOn && state.isPlaying && !state.isPaused) {
        startBGM();
    }
}

// --- Game Logic ---
function openSettings() {
    state.isPaused = true;
    overlaySettings.classList.remove('hidden');
    stopBGM();
}

function closeSettings() {
    overlaySettings.classList.add('hidden');
    saveSettings();

    if (state.isPlaying) {
        state.isPaused = false;
        state.lastTime = performance.now();
        if (state.settings.sound) startBGM();
    }
}

function startGame() {
    const startToggle = document.getElementById('sound-toggle-start');
    if (startToggle) state.settings.sound = startToggle.checked;
    saveSettings();

    initAudio();

    state.isPlaying = true;
    state.isPaused = false;
    state.score = 0;
    state.combo = 0;
    state.timeLeft = CONFIG.gameDuration;
    state.balloons = [];
    state.spawnTimer = 0;
    state.lastTime = performance.now();

    uiTime.innerText = Math.ceil(state.timeLeft);
    updateScore(0);
    updateCombo(0);
    generateQuestion();

    overlayStart.classList.add('hidden');
    overlayGameOver.classList.add('hidden');

    playSound('start');

    setTimeout(() => {
        if (state.isPlaying && !state.isPaused) startBGM();
    }, 500);
}

function resetGame() {
    startGame();
}

function gameOver() {
    state.isPlaying = false;
    stopBGM();

    if (state.score > state.highScore) {
        state.highScore = state.score;
        localStorage.setItem('kitannon_math_highscore', state.highScore);
    }

    uiFinalScore.innerText = state.score;
    uiHighScore.innerText = state.highScore;

    overlayGameOver.classList.remove('hidden');
    playSound('finish');
}

/**
 * Spawn initial balloons for a new question:
 * - Reset on-screen balloons (prevents "previous answer remains" bug)
 * - Make first balloon NOT always correct: spawn 1 correct + 1 wrong in random order
 */
function spawnInitialBalloons() {
    state.balloons = [];
    if (Math.random() < 0.5) {
        spawnBalloon(false);
        spawnBalloon(true);
    } else {
        spawnBalloon(true);
        spawnBalloon(false);
    }
}

/**
 * Grade difficulty tiers:
 * 1: single-digit addition (fewer hard carry)
 * 2: two-digit add/sub (with carry/borrow)
 * 3: multiplication only
 * 4: division (exact) + easy word problem low rate
 * 5: decimals (1dp) add/sub + occasional (decimal×int) or (decimal÷int) to 1dp
 * 6: speed/time/distance word problems (no × ÷ shown), minutes + varied speeds (avoid exploit)
 */
function generateQuestion() {
    const g = state.settings.grade;
    let text = "";
    let ans = 0;

    if (g === 1) {
        // Prefer non-carry to keep it friendly
        let a = rInt(1, 9);
        let b = rInt(1, 9);
        if (Math.random() < 0.65) {
            // try to keep a+b <= 9
            a = rInt(1, 8);
            b = rInt(1, 9 - a);
        }
        ans = a + b;
        text = `${a} + ${b} = ?`;
    }
    else if (g === 2) {
        const isSub = Math.random() < 0.5;
        if (!isSub) {
            // two-digit addition with carry often
            let a10 = rInt(10, 99);
            let b10 = rInt(10, 99);
            if (Math.random() < 0.6) {
                // force carry on ones digit
                const aOnes = rInt(5, 9);
                const bOnes = rInt(10 - aOnes, 9);
                const aTens = rInt(1, 9);
                const bTens = rInt(1, 9);
                a10 = aTens * 10 + aOnes;
                b10 = bTens * 10 + bOnes;
            }
            ans = a10 + b10;
            text = `${a10} + ${b10} = ?`;
        } else {
            // two-digit subtraction with borrow often, result >= 0
            let a10 = rInt(10, 99);
            let b10 = rInt(10, 99);
            if (b10 > a10) [a10, b10] = [b10, a10];

            if (Math.random() < 0.6) {
                // force borrow (ones of a < ones of b)
                const aOnes = rInt(0, 4);
                const bOnes = rInt(aOnes + 1, 9);
                const aTens = rInt(2, 9);
                const bTens = rInt(1, aTens); // keep <= aTens
                a10 = aTens * 10 + aOnes;
                b10 = bTens * 10 + bOnes;
                if (b10 > a10) [a10, b10] = [b10, a10];
            }

            ans = a10 - b10;
            text = `${a10} - ${b10} = ?`;
        }
    }
    else if (g === 3) {
        const a = rInt(2, 9);
        const b = rInt(2, 9);
        ans = a * b;
        text = `${a} × ${b} = ?`;
    }
    else if (g === 4) {
        if (Math.random() < 0.2) {
            // easy word problem (division meaning), keep numbers small
            const divisor = rInt(2, 6);
            const each = rInt(2, 9);
            const total = divisor * each;
            ans = each;
            text = `${total}こを${divisor}人で同じ数ずつ。\n1人何こ？`;
        } else {
            // exact division, slightly wider range than grade 3
            const divisor = rInt(2, 12);
            const quotient = rInt(2, 12);
            const dividend = divisor * quotient;
            ans = quotient;
            text = `${dividend} ÷ ${divisor} = ?`;
        }
    }
    else if (g === 5) {
        // Mix of:
        // A) decimal add/sub (1dp)
        // B) decimal × int
        // C) decimal ÷ int (divisible to 1dp)
        const type = rInt(1, 4); // bias toward add/sub
        if (type === 1 || type === 2) {
            let a = rInt(5, 99) / 10;  // 0.5 - 9.9
            let b = rInt(5, 99) / 10;
            if (type === 1) {
                ans = round1(a + b);
                text = `${a.toFixed(1)} + ${b.toFixed(1)} = ?`;
            } else {
                if (b > a) [a, b] = [b, a];
                ans = round1(a - b);
                text = `${a.toFixed(1)} - ${b.toFixed(1)} = ?`;
            }
        } else if (type === 3) {
            const a = rInt(5, 99) / 10; // 0.5-9.9
            const m = rInt(2, 9);
            ans = round1(a * m);
            text = `${a.toFixed(1)} × ${m} = ?`;
        } else {
            // make (a ÷ d) = 1dp exact
            const d = rInt(2, 9);
            const q = rInt(5, 99) / 10;      // 0.5-9.9
            const a = round1(q * d);         // ensures divisible to 1dp
            ans = q;
            text = `${a.toFixed(1)} ÷ ${d} = ?`;
        }
    }
    else if (g === 6) {
        // Speed/Time/Distance word problems WITHOUT showing × or ÷
        // Use minutes and varied speeds to avoid exploit
        const type = rInt(1, 3);

        // speed: 12..85 (not only multiples of 10)
        const speed = rInt(12, 85);

        // time minutes: 15..180 step 5
        const minutes = rInt(3, 36) * 5;
        const hours = minutes / 60;

        // distance in km (keep 0.1 precision)
        const distKm = round1(speed * hours);

        if (type === 1) {
            // Ask distance
            ans = distKm;
            text = `時速${speed}kmで${minutes}分進む。\n何km進む？`;
        } else if (type === 2) {
            // Ask speed (avoid giving away: use km and minutes)
            ans = speed;
            text = `${distKm.toFixed(1)}kmを${minutes}分で進む。\n時速は何km？`;
        } else {
            // Ask time in minutes (make it match our minutes so answer is integer)
            ans = minutes;
            text = `${distKm.toFixed(1)}kmを時速${speed}kmで進む。\n何分かかる？`;
        }
    }

    state.question = { text, ans };
    uiQuestion.innerText = formatQuestionText(text);

    // IMPORTANT: reset balloons for new question (A方針) + avoid "first always correct"
    spawnInitialBalloons();
}

function updateScore(points) {
    state.score += points;
    if (state.score < 0) state.score = 0;
    uiScore.innerText = state.score;
}

function updateCombo(count) {
    state.combo = count;

    if (state.combo > 1) {
        uiCombo.innerText = `${state.combo} COMBO!!`;
        uiCombo.classList.remove('hidden');
        uiCombo.classList.remove('animate');
        void uiCombo.offsetWidth; // Reflow
        uiCombo.classList.add('animate');
    }
}

class Balloon {
    constructor(isCorrect) {
        const mobile = isMobile();
        this.radius = mobile ? CONFIG.balloonBaseRadiusMobile : CONFIG.balloonBaseRadiusPC;

        const margin = this.radius * 2;
        this.x = Math.random() * (state.canvas.width - margin) + (margin / 2);
        this.y = state.canvas.height + this.radius;

        if (isCorrect) {
            this.value = state.question.ans;
        } else {
            let wrong;
            const ans = state.question.ans;
            const isFloat = !Number.isInteger(ans);
            let attempts = 0;
            do {
                attempts++;
                if (isFloat) {
                    const noise = (Math.floor(Math.random() * 10) - 5) / 10;
                    wrong = Math.round((ans + noise) * 10) / 10;
                    if (wrong <= 0.1) wrong = 0.1;
                } else {
                    const range = Math.max(5, Math.floor(ans * 0.2));
                    const noise = Math.floor(Math.random() * (range * 2)) - range;
                    wrong = ans + noise;
                    if (wrong < 0) wrong = 0;
                }
            } while ((wrong === ans || wrong < 0) && attempts < 10);

            if (attempts >= 10) wrong = ans + 1;

            this.value = wrong;
        }

        this.isCorrect = isCorrect;
        this.color = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];

        // Speed Logic
        let baseTime;
        if (state.settings.speed === 'slow') {
            baseTime = mobile ? CONFIG.travelTimeSlowMobile : CONFIG.travelTimeSlowPC;
        } else {
            baseTime = mobile ? CONFIG.travelTimeNormalMobile : CONFIG.travelTimeNormalPC;
        }

        this.speed = (state.canvas.height + this.radius * 2) / baseTime;
        this.speed *= (0.9 + Math.random() * 0.2); // +20% variance
    }

    update(dt) {
        this.y -= this.speed * dt;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(this.x - 10, this.y - 12, 6, 12, Math.PI / 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${this.radius * 0.7}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.value, this.x, this.y + 2);

        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.radius);
        ctx.lineTo(this.x, this.y + this.radius + 20);
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    isOffScreen() {
        return this.y < -this.radius - 50;
    }

    checkHit(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < (this.radius + CONFIG.hitRadiusExpand);
    }
}

function spawnBalloon(forceCorrect = false) {
    const mobile = isMobile();
    const limit = mobile ? CONFIG.maxBalloonsMobile : CONFIG.maxBalloonsPC;

    if (state.balloons.length >= limit) return;

    const hasCorrect = state.balloons.some(b => b.isCorrect);
    const shouldBeCorrect = forceCorrect || (!hasCorrect && Math.random() > 0.5);
    const mustSpawnCorrect = (!hasCorrect && state.balloons.length >= limit - 1);

    state.balloons.push(new Balloon(shouldBeCorrect || mustSpawnCorrect));
}

function gameLoop(timestamp) {
    if (!state.lastTime) state.lastTime = timestamp;
    const dt = (timestamp - state.lastTime) / 1000;
    state.lastTime = timestamp;

    if (state.isPlaying && !state.isPaused) {
        update(dt);
    }

    render();
    requestAnimationFrame(gameLoop);
}

function update(dt) {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        gameOver();
        uiTime.innerText = "0";
        return;
    }
    uiTime.innerText = Math.ceil(state.timeLeft);

    state.spawnTimer += dt;

    const interval = isMobile() ? CONFIG.spawnIntervalMobile : CONFIG.spawnIntervalPC;

    if (state.spawnTimer > interval) {
        state.spawnTimer = 0;
        spawnBalloon();

        const hasCorrect = state.balloons.some(b => b.isCorrect);
        if (!hasCorrect && state.balloons.length < 3) {
            spawnBalloon(true);
        }
    }

    for (let i = state.balloons.length - 1; i >= 0; i--) {
        const b = state.balloons[i];
        b.update(dt);

        if (b.isOffScreen()) {
            state.balloons.splice(i, 1);
            if (b.isCorrect) {
                spawnBalloon(true);
            }
        }
    }
}

function render() {
    ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    for (const b of state.balloons) {
        b.draw(ctx);
    }
}

function setupInput() {
    ['mousedown', 'touchstart'].forEach(evt => {
        canvas.addEventListener(evt, handleInput, { passive: false });
    });
}

function handleInput(e) {
    if (!state.isPlaying || state.isPaused) return;
    if (e.type === 'touchstart') e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (e.changedTouches) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    for (let i = state.balloons.length - 1; i >= 0; i--) {
        if (state.balloons[i].checkHit(x, y)) {
            handleHit(i);
            break;
        }
    }
}

function handleHit(index) {
    const balloon = state.balloons[index];
    state.balloons.splice(index, 1);

    const valStr = normalize(balloon.value);
    const ansStr = normalize(state.question.ans);
    const isCorrect = (valStr === ansStr);

    const g = state.settings.grade;

    if (isCorrect) {
        playSound('correct');
        showCharFeedback('correct');

        // Grade-based base + existing combo bonus behavior
        const base = SCORE.correct[g];
        const comboBonus = Math.min(state.combo * 5, 50);
        updateScore(base + comboBonus);

        updateCombo(state.combo + 1);
        if (state.combo > 1) playSound('combo');

        generateQuestion();
    } else {
        playSound('wrong');
        showCharFeedback('wrong');

        const penalty = state.settings.lowGrade ? 0 : SCORE.wrong[g];
        updateScore(-penalty);

        updateCombo(0);
    }
}

function showCharFeedback(type) {
    const imgUrl = type === 'correct' ? state.assets.correct.src : state.assets.wrong.src;
    feedbackImg.src = imgUrl;
    feedbackLayer.classList.remove('hidden');
    feedbackImg.style.animation = 'none';
    feedbackLayer.offsetHeight;
    feedbackImg.style.animation = null;
}

// --- Audio System & Chiptune BGM ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let bgmTimer = null;
let bgmNodes = [];

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Note frequencies (C Major Scale)
const NOTES = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25
};

const BPM = 120;
const BEAT = 60 / BPM;

const MELODY_SEQ = [
    { n: 'C4', d: 0.5 }, { n: 'E4', d: 0.5 }, { n: 'G4', d: 0.5 }, { n: 'E4', d: 0.5 },
    { n: 'F4', d: 0.5 }, { n: 'A4', d: 0.5 }, { n: 'G4', d: 1.0 },
    { n: 'E4', d: 0.5 }, { n: 'G4', d: 0.5 }, { n: 'C5', d: 0.5 }, { n: 'G4', d: 0.5 },
    { n: 'F4', d: 0.5 }, { n: 'D4', d: 0.5 }, { n: 'C4', d: 1.0 }
];

const BASS_SEQ = [
    { n: 'C3', d: 2.0 },
    { n: 'G3', d: 2.0 },
    { n: 'C3', d: 2.0 },
    { n: 'G3', d: 2.0 }
];

let nextNoteTime = 0;
let noteIndex = 0;
let bassIndex = 0;
let bassNextTime = 0;

function startBGM() {
    if (!state.settings.sound || !audioCtx) return;
    stopBGM();

    nextNoteTime = audioCtx.currentTime + 0.1;
    bassNextTime = nextNoteTime;
    noteIndex = 0;
    bassIndex = 0;

    scheduleNextNote();
}

function stopBGM() {
    if (bgmTimer) {
        clearTimeout(bgmTimer);
        bgmTimer = null;
    }
    bgmNodes.forEach(n => {
        try {
            n.stop();
            n.disconnect();
        } catch (e) { }
    });
    bgmNodes = [];
}

function scheduleNextNote() {
    if (!state.isPlaying || state.isPaused || !state.settings.sound) return;

    const lookahead = 0.1;
    const now = audioCtx.currentTime;

    while (nextNoteTime < now + lookahead) {
        const item = MELODY_SEQ[noteIndex];
        if (item.n) playTone(item.n, nextNoteTime, item.d * BEAT, 'square', 0.03);
        nextNoteTime += item.d * BEAT;
        noteIndex = (noteIndex + 1) % MELODY_SEQ.length;
    }

    while (bassNextTime < now + lookahead) {
        const item = BASS_SEQ[bassIndex];
        if (item.n) playTone(item.n, bassNextTime, item.d * BEAT, 'triangle', 0.05);
        bassNextTime += item.d * BEAT;
        bassIndex = (bassIndex + 1) % BASS_SEQ.length;
    }

    bgmTimer = setTimeout(scheduleNextNote, 50);
}

function playTone(noteName, time, duration, type, vol) {
    if (!NOTES[noteName]) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = NOTES[noteName];

    const attack = 0.02;
    const release = 0.15;
    const effectiveDur = Math.max(duration, attack + release);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + attack);
    gain.gain.setValueAtTime(vol, time + effectiveDur - release);
    gain.gain.linearRampToValueAtTime(0, time + effectiveDur);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(time);
    osc.stop(time + effectiveDur + 0.1);

    bgmNodes.push(osc);
}

function playSound(type) {
    if (!state.settings.sound) return;
    initAudio();

    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'correct') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.start(now);
        osc.stop(now + 0.3);

    } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.2);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);

        osc.start(now);
        osc.stop(now + 0.3);

    } else if (type === 'start') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.4);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);

        osc.start(now);
        osc.stop(now + 0.4);

    } else if (type === 'finish') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(523.25, now + 0.1);
        osc.frequency.setValueAtTime(523.25, now + 0.2);
        osc.frequency.setValueAtTime(659.25, now + 0.4);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.setValueAtTime(0.1, now + 0.3);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.8);

        osc.start(now);
        osc.stop(now + 0.8);

    } else if (type === 'combo') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);

        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);

        osc.start(now);
        osc.stop(now + 0.2);
    }
}

window.onload = init;