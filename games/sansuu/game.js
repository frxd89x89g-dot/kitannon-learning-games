/**
 * Math Balloon Game - Kitannon
 * Handles game loop, physics, input, and state management.
 *
 * Updates:
 * - Grade difficulty tiers clarified (1 easiest -> 6 hardest)
 * - Grade-based scoring tables (correct/wrong)
 * - Fix: Reset balloons on every new question (Option A) to prevent stale-answer taps
 * - Fix: Ensure initial balloons are NOT always correct (spawn a mixed initial batch)
 * - Add: Robust "Back to Sansuu Home" navigation during play and after game over
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

    // --- NEW: initial spawn per question (to avoid "first balloon always correct") ---
    initialBalloonsPC: 3,
    initialBalloonsMobile: 3,
};

// --- Grade-based scoring (B) ---
const SCORE_TABLE = {
    correct: { 1: 8, 2: 10, 3: 12, 4: 14, 5: 16, 6: 20 },
    wrong:   { 1: 2, 2: 3,  3: 4,  4: 5,  5: 6,  6: 8  }
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
const uiCombo = document.getElementById('combo-popup');
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

    // If there are spaces, prefer breaking near middle
    if (text.length > 15) {
        const mid = Math.floor(text.length / 2);
        const spaceIdx = text.lastIndexOf(' ', mid);
        if (spaceIdx > 0) {
            return text.substring(0, spaceIdx) + '\n' + text.substring(spaceIdx + 1);
        }
    }
    return text;
}

// Normalize value for comparison (decimals vs integers)
function normalize(v) {
    if (Number.isInteger(v)) return v.toString();
    // Keep 1 decimal for stable comparisons (used for Grade 5/6 if needed)
    return Number(v).toFixed(1);
}

function clampScore() {
    if (state.score < 0) state.score = 0;
}

// --- NEW: hard reset to Sansuu Home (start overlay) ---
function goToSansuuHome() {
    // Stop game safely
    state.isPlaying = false;
    state.isPaused = false;
    stopBGM();

    // Reset transient state
    state.balloons = [];
    state.spawnTimer = 0;
    state.combo = 0;
    state.timeLeft = CONFIG.gameDuration;

    // Restore overlays
    overlayGameOver.classList.add('hidden');
    overlaySettings.classList.add('hidden');
    overlayStart.classList.remove('hidden');

    // UI refresh (keep high score)
    uiTime.innerText = Math.ceil(state.timeLeft);
    uiScore.innerText = state.score;
    uiHighScore.innerText = state.highScore;
    updateCombo(0);

    // Clear feedback if showing
    if (feedbackLayer) feedbackLayer.classList.add('hidden');
}

// --- NEW: attach home/back handlers robustly (no HTML edits required) ---
function wireHomeButtons() {
    const candidates = [];

    // Known IDs (if they exist)
    const ids = [
        'home-btn', 'btn-home', 'home', 'to-home', 'to-home-btn',
        'back-btn', 'btn-back', 'back', 'quit-btn', 'end-btn', 'finish-btn',
        'close-btn', 'return-btn'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) candidates.push(el);
    });

    // Also scan buttons/links by label (Japanese)
    document.querySelectorAll('button, a').forEach(el => {
        const t = (el.textContent || '').trim();
        if (!t) return;
        if (t === 'ホーム' || t === 'もどる' || t === '戻る' || t === 'おわる' || t === '終了') {
            candidates.push(el);
        }
    });

    // De-dup
    const unique = Array.from(new Set(candidates));

    unique.forEach(el => {
        // Avoid double binding
        if (el.__kitannonHomeBound) return;
        el.__kitannonHomeBound = true;

        el.addEventListener('click', (e) => {
            // If element is a link, prevent navigation (we want overlay-home)
            e.preventDefault();
            e.stopPropagation();
            goToSansuuHome();
        }, { passive: false });
    });
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
    const openBtn = document.getElementById('settings-open-btn');
    const closeBtn = document.getElementById('settings-close-btn');

    // NOTE: If in-game settings button is broken, user requested removal earlier.
    // We will not rely on it; but if it exists and works, keep it.
    if (openBtn) openBtn.addEventListener('click', openSettings);
    if (closeBtn) closeBtn.addEventListener('click', closeSettings);

    if (overlaySettings) {
        overlaySettings.addEventListener('click', (e) => {
            if (e.target === overlaySettings) closeSettings();
        });
    }

    loadSettingsUI();

    uiHighScore.innerText = state.highScore;

    // NEW: Always wire home/back/finish buttons to return to Sansuu home overlay
    wireHomeButtons();

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
    const speedSlow = document.getElementById('speed-slow');
    const speedNormal = document.getElementById('speed-normal');
    if (speedSlow && speedNormal) {
        (state.settings.speed === 'slow' ? speedSlow : speedNormal).checked = true;
    }

    const lowGradeMode = document.getElementById('low-grade-mode');
    if (lowGradeMode) lowGradeMode.checked = state.settings.lowGrade;

    const soundToggleSet = document.getElementById('sound-toggle-settings');
    const soundToggleStart = document.getElementById('sound-toggle-start');
    if (soundToggleSet) soundToggleSet.checked = state.settings.sound;
    if (soundToggleStart) soundToggleStart.checked = state.settings.sound;
}

function saveSettings() {
    const speedSlow = document.getElementById('speed-slow');
    if (speedSlow && speedSlow.checked) state.settings.speed = 'slow';
    else state.settings.speed = 'normal';

    const lowGradeMode = document.getElementById('low-grade-mode');
    if (lowGradeMode) state.settings.lowGrade = lowGradeMode.checked;

    const soundSet = document.getElementById('sound-toggle-settings');
    const soundStart = document.getElementById('sound-toggle-start');

    const soundOn = soundSet ? soundSet.checked : state.settings.sound;
    const wasSoundOn = state.settings.sound;
    state.settings.sound = soundOn;
    if (soundStart) soundStart.checked = soundOn;

    localStorage.setItem('kitannon_math_speed', state.settings.speed);
    localStorage.setItem('kitannon_math_lowgrade', state.settings.lowGrade);
    localStorage.setItem('kitannon_math_sound', state.settings.sound);

    // Handle audio
    if (wasSoundOn && !soundOn) {
        stopBGM();
    } else if (!wasSoundOn && soundOn && state.isPlaying && !state.isPaused) {
        startBGM();
    }
}

// --- Game Logic ---

function openSettings() {
    state.isPaused = true;
    if (overlaySettings) overlaySettings.classList.remove('hidden');
    stopBGM();
}

function closeSettings() {
    if (overlaySettings) overlaySettings.classList.add('hidden');
    saveSettings();

    // Resume Game
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

    // Ensure "ホーム/もどる/おわる" buttons inside this overlay are wired
    wireHomeButtons();
}

/**
 * (A) Difficulty design by grade (question generation)
 * 1: single-digit addition, fewer carry
 * 2: two-digit add/sub with carry/borrow, result >= 0
 * 3: multiplication only (2–9)
 * 4: division exact + occasional short word problems (not too hard)
 * 5: decimals mix: + / - (1 decimal) and ×/÷ with integer; answers 1 decimal
 * 6: speed/time/distance word problems WITHOUT ×/÷ symbols; avoid easy patterns, but not too harsh
 */
function generateQuestion() {
    const g = state.settings.grade;
    let text = "";
    let ans = 0;

    // --- helpers ---
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const oneDecimal = (n) => Number(n).toFixed(1);

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    if (g === 1) {
        // 1–9 + 1–9, avoid too many carry cases
        let a = randInt(1, 9);
        let b = randInt(1, 9);
        // 70%: no carry, 30%: allow carry
        if (Math.random() < 0.7) {
            while (a + b >= 10) {
                a = randInt(1, 9);
                b = randInt(1, 9);
            }
        }
        ans = a + b;
        text = `${a} + ${b} = ?`;
    }
    else if (g === 2) {
        // Two-digit add/sub, include carry/borrow, keep result >= 0
        const isAdd = Math.random() < 0.5;
        let a = randInt(10, 99);
        let b = randInt(10, 99);

        if (isAdd) {
            ans = a + b;
            text = `${a} + ${b} = ?`;
        } else {
            // ensure a >= b
            if (b > a) [a, b] = [b, a];
            ans = a - b;
            text = `${a} - ${b} = ?`;
        }
    }
    else if (g === 3) {
        // Multiplication only (2–9)
        const a = randInt(2, 9);
        const b = randInt(2, 9);
        ans = a * b;
        text = `${a} × ${b} = ?`;
    }
    else if (g === 4) {
        // Exact division, sometimes short word problem (light)
        const divisor = randInt(2, 9);
        const quotient = randInt(2, 12);
        const dividend = divisor * quotient;

        if (Math.random() < 0.35) {
            // short word problem (still easy)
            // Example: "24こを 6人で わける。1人は なんこ？"
            text = `${dividend}こを ${divisor}人で わける。\n1人は なんこ？`;
            ans = quotient;
        } else {
            text = `${dividend} ÷ ${divisor} = ?`;
            ans = quotient;
        }
    }
    else if (g === 5) {
        // Decimals harder than simple + only, but not brutal
        // Mix:
        // - decimal +/-
        // - decimal × int
        // - divisible decimal ÷ int
        const mode = randInt(0, 2);

        if (mode === 0) {
            // decimal add/sub (1 decimal), keep >= 0 for subtraction
            let a = randInt(10, 99) / 10; // 1.0 - 9.9
            let b = randInt(10, 99) / 10;
            const isAdd = Math.random() < 0.5;

            if (isAdd) {
                ans = Number((a + b).toFixed(1));
                text = `${oneDecimal(a)} + ${oneDecimal(b)} = ?`;
            } else {
                if (b > a) [a, b] = [b, a];
                ans = Number((a - b).toFixed(1));
                text = `${oneDecimal(a)} - ${oneDecimal(b)} = ?`;
            }
        } else if (mode === 1) {
            // decimal × integer, answer 1 decimal
            const a = randInt(10, 99) / 10; // 1.0 - 9.9
            const b = randInt(2, 9);
            ans = Number((a * b).toFixed(1));
            text = `${oneDecimal(a)} × ${b} = ?`;
        } else {
            // divisible decimal ÷ integer, keep 1 decimal answer
            const b = randInt(2, 9);
            const q = randInt(10, 99) / 10; // quotient 1.0 - 9.9
            const a = Number((q * b).toFixed(1)); // dividend as 1 decimal
            ans = Number(q.toFixed(1));
            text = `${oneDecimal(a)} ÷ ${b} = ?`;
        }
    }
    else if (g === 6) {
        // Speed/time/distance word problems WITHOUT × or ÷ symbols
        // Easier than previous harsh version, but avoids "multiples of 10 exploit"
        // - Use minutes sometimes
        // - Use speeds not only multiples of 10 (even numbers like 28, 34, 42, 56...)
        // - Keep answers integer (or simple), questions short Japanese sentences

        const type = randInt(0, 2);

        // time in minutes: 30, 45, 60, 90, 120
        // But ensure distance becomes integer easily:
        // - 30, 60, 90, 120 are safe with even speeds (90 -> 1.5h, even speed => integer distance)
        // - 45 can make .75h (needs speed multiple of 4 to keep integer distance). We'll use it rarely.
        const timeChoices = (Math.random() < 0.2)
            ? [45] // rare
            : [30, 60, 90, 120];

        const minutes = pick(timeChoices);

        // speed candidates: even, not forced to be multiples of 10
        // Keep within kid-friendly range
        const speedChoices = [24, 28, 32, 34, 36, 42, 46, 48, 52, 54, 56, 62, 64, 68, 72, 74];
        let speed = pick(speedChoices);

        // if minutes == 45, require speed multiple of 4 for integer distance (0.75h)
        if (minutes === 45) {
            const speed45 = speedChoices.filter(s => s % 4 === 0);
            speed = pick(speed45);
        }

        // compute distance (km) as integer
        const hours = minutes / 60; // 0.5, 0.75, 1, 1.5, 2
        const dist = Math.round(speed * hours); // should be integer by construction

        // Build short sentences, no × ÷ signs
        if (type === 0) {
            // speed + time -> distance
            text = `時速${speed}kmで${minutes}分走る。\n何km？`;
            ans = dist;
        } else if (type === 1) {
            // distance + time -> speed
            text = `${dist}kmを${minutes}分で走った。\n時速は？`;
            // speed = dist / hours
            ans = speed;
        } else {
            // distance + speed -> time (minutes)
            text = `${dist}kmを時速${speed}kmで走る。\n何分？`;
            ans = minutes;
        }
    }

    state.question = { text, ans };

    // Display (keep wrapping logic)
    uiQuestion.innerText = formatQuestionText(text);

    // (A) IMPORTANT: Reset balloons at question switch to avoid stale taps
    resetBalloonsForNewQuestion();
}

function resetBalloonsForNewQuestion() {
    state.balloons = [];

    const mobile = isMobile();
    const count = mobile ? CONFIG.initialBalloonsMobile : CONFIG.initialBalloonsPC;

    // Spawn a small batch immediately:
    // - Exactly 1 correct balloon
    // - Others wrong
    // - Correct position randomized by order
    const correctIndex = Math.floor(Math.random() * count);

    for (let i = 0; i < count; i++) {
        state.balloons.push(new Balloon(i === correctIndex));
    }

    // Reset spawn timer so next spawns feel consistent
    state.spawnTimer = 0;
}

function updateScore(points) {
    state.score += points;
    clampScore();
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
    } else {
        // Hide when not in combo
        uiCombo.classList.add('hidden');
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
                    // keep 1 decimal wrong options around ans
                    const noise = (Math.floor(Math.random() * 9) - 4) / 10; // -0.4..+0.4
                    wrong = Number((Number(ans) + noise).toFixed(1));
                    // avoid negative / zero issues
                    if (wrong <= 0) wrong = 0.1;
                } else {
                    // integer wrong options
                    const baseRange = Math.max(5, Math.floor(Math.abs(ans) * 0.2));
                    const noise = Math.floor(Math.random() * (baseRange * 2 + 1)) - baseRange;
                    wrong = ans + noise;
                    if (wrong < 0) wrong = 0;
                }
            } while ((normalize(wrong) === normalize(ans)) && attempts < 12);

            if (attempts >= 12) wrong = isFloat ? Number((Number(ans) + 0.1).toFixed(1)) : (ans + 1);

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
        uiTime.innerText = "0";
        gameOver();
        return;
    }
    uiTime.innerText = Math.ceil(state.timeLeft);

    state.spawnTimer += dt;

    const interval = isMobile() ? CONFIG.spawnIntervalMobile : CONFIG.spawnIntervalPC;

    if (state.spawnTimer > interval) {
        state.spawnTimer = 0;
        spawnBalloon();

        // Ensure at least one correct balloon exists (playability)
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
    const correctBase = SCORE_TABLE.correct[g] || 10;
    const wrongBase = SCORE_TABLE.wrong[g] || 5;

    if (isCorrect) {
        playSound('correct');
        showCharFeedback('correct');

        // Keep combo rules, but grade-scaled base points
        // Combo bonus: gentle (so game doesn’t explode), still rewarding
        const comboBonus = Math.min(state.combo * 2, 20); // was up to 50; too big
        updateScore(correctBase + comboBonus);

        updateCombo(state.combo + 1);
        if (state.combo > 1) playSound('combo');

        generateQuestion();
    } else {
        playSound('wrong');
        showCharFeedback('wrong');

        if (!state.settings.lowGrade) {
            updateScore(-wrongBase);
        }
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