
// Game Configuration
const CONFIG = {
    GAME_DURATION: 60, // seconds
    SPAWN_RATE_BASE: 1200, // ms
    GRAVITY: 0.1, // pixel accel (not used if constant speed, maybe speed increases)
    APPLE_SPEED_BASE: 2,
    APPLE_SPEED_MAX: 6,
    PLAYER_SPEED: 0, // Controlled by direct position usually
    SCORE_CORRECT: 10,
    SCORE_MISTAKE: -5
};

// DOM Elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const timeDisplay = document.getElementById('time-display');
const questionText = document.getElementById('question-text');
const messageOverlay = document.getElementById('message-overlay');

// Screens
const overlayStart = document.getElementById('overlay-start');
const overlayGameover = document.getElementById('overlay-gameover');
const overlayPause = document.getElementById('overlay-pause');

// Buttons
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('quit-btn').addEventListener('click', toTitle);
document.getElementById('retry-btn').addEventListener('click', startGame); // Direct retry
document.getElementById('gameover-back-btn').addEventListener('click', toTitle);

// Game State
let state = {
    mode: 'title', // title, playing, paused, gameover
    score: 0,
    timeLeft: 0,
    grade: 1,
    lastTime: 0,
    spawnTimer: 0,
    apples: [],
    question: null, // { reading: "...", answer: "...", decoys: [...] }
    questionHistory: [], // Recent q's to prevent repeats
    spawnCountSinceAnswer: 0,
    lastSpawnedChar: null
};

// Mock Assets (Loaded via HTML or Image object)
const imgPlayer = new Image();
imgPlayer.src = "../../assets/characters/kitannon_basket.png";

// Audio Context (Simple version)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let bgmOscillators = [];
let bgmInterval = null;

// ----------------------------------------------------------------
// Question Data (Grade 1-6) - Expanded & Randomness
// ----------------------------------------------------------------
const QUESTION_DATA = {
    1: [
        { r: "やま", k: "山" }, { r: "かわ", k: "川" }, { r: "き (樹木)", k: "木" }, { r: "もり", k: "森" },
        { r: "ひ (燃える)", k: "火" }, { r: "みず", k: "水" }, { r: "つち", k: "土" }, { r: "きん", k: "金" },
        { r: "つき (夜空)", k: "月" }, { r: "ひ (お日様)", k: "日" }, { r: "ひと", k: "人" }, { r: "くち", k: "口" },
        { r: "め", k: "目" }, { r: "みみ", k: "耳" }, { r: "て", k: "手" }, { r: "あし", k: "足" },
        { r: "うえ", k: "上" }, { r: "した", k: "下" }, { r: "なか", k: "中" }, { r: "おおきい", k: "大" },
        { r: "ちいさい", k: "小" }, { r: "しろ", k: "白" }, { r: "あか", k: "赤" }, { r: "あお", k: "青" },
        { r: "いぬ", k: "犬" }, { r: "ねこ", k: "猫", d: ["描"] }
    ],
    2: [
        { r: "かたな", k: "刀", d: ["力", "刃"] }, { r: "ゆみ", k: "弓", d: ["引"] },
        { r: "や", k: "矢", d: ["失"] }, { r: "きた", k: "北", d: ["比"] },
        { r: "みなみ", k: "南" }, { r: "ひがし", k: "東" }, { r: "にし", k: "西" },
        { r: "はる", k: "春" }, { r: "なつ", k: "夏" },
        { r: "あき", k: "秋" }, { r: "ふゆ", k: "冬" },
        { r: "とり", k: "鳥", d: ["烏", "島"] }, { r: "うま", k: "馬" }, { r: "さかな", k: "魚" },
        { r: "そら", k: "空" }, { r: "うみ", k: "海" }
    ],
    3: [
        { r: "まめ", k: "豆" }, { r: "さか", k: "坂", d: ["板"] }, { r: "さら", k: "皿", d: ["血"] },
        { r: "ち (血液)", k: "血", d: ["皿"] }, { r: "かわ (皮膚)", k: "皮", d: ["波"] },
        { r: "はこ", k: "箱" }, { r: "くすり", k: "薬" }, { r: "びょうき", k: "病" },
        { r: "うん", k: "運" }, { r: "どう", k: "動" }, { r: "おもい", k: "重" },
        { r: "かるい", k: "軽" }, { r: "あつい (気温)", k: "暑" }, { r: "さむい", k: "寒" }
    ],
    4: [
        { r: "あい", k: "愛" }, { r: "あん", k: "案" }, { r: "い (〜以上)", k: "以" },
        { r: "い (服)", k: "衣" }, { r: "い (順位)", k: "位" }, { r: "い (囲む)", k: "囲" },
        { r: "かんさつ", k: "観察", d: ["観祭", "観刷"] },
        { r: "せつめい", k: "説明" }, { r: "ようい", k: "用意" },
        { r: "きせつ", k: "季節" }, { r: "しぜん", k: "自然" }, { r: "しょうらい", k: "将来" }
    ],
    5: [
        // 5th grade complex
        { r: "えいせい", k: "衛星" }, { r: "ぼうえき", k: "貿易" },
        { r: "ゆしゅつ", k: "輸出" }, { r: "ゆにゅう", k: "輸入" },
        { r: "さんぎょう", k: "産業" }, { r: "こうぎょう", k: "工業" },
        { r: "きょうし", k: "教師" }, { r: "せいじ", k: "政治" }
    ],
    6: [
        // 6th grade
        { r: "けんぽう", k: "憲法" }, { r: "せいじ", k: "政治" },
        { r: "せんきょ", k: "選挙" }, { r: "ないかく", k: "内閣" },
        { r: "うちゅう", k: "宇宙" }, { r: "れきし", k: "歴史" },
        { r: "そうり", k: "総理" }, { r: "こっかい", k: "国会" }
    ]
};

// Helper to get Decoysis
function getDecoys(targetKanji, grade) {
    const pool = QUESTION_DATA[grade] || QUESTION_DATA[1];
    let decoys = [];
    let attempts = 0;

    // Find reading of target for strict exclusion
    // Note: iterating whole pool is O(N) but N is small
    // let targetReading = ... (Not easily accessible here without reverse logic, 
    // but the main issue is usually common simple kanji with same reading)

    while (decoys.length < 2 && attempts < 50) {
        attempts++;
        const rand = pool[Math.floor(Math.random() * pool.length)];

        // Basic exclusion
        if (rand.k === targetKanji || decoys.includes(rand.k)) continue;

        // Exclude if simplified reading matches (heuristic)
        // Ideally we check if `rand.r` contains the same reading kana
        // Since we added hints like "ひ (火)", strict match works for now.
        // But better is to not include "日" if answer is "火".
        // Manually: we rely on predefined 'd' arrays or just randomness.
        // If the User specifically wants "Same reading != distractor", let's try to enforce it.
        // But "Reading" string now contains hints, so they are unique.
        // e.g. "ひ (火)" vs "ひ (日)". They are different strings.
        // So checking `rand.r === current.r` handles it!
        // Wait, I don't have current.r here easily, but I can check:
        // Actually, if we randomly pick from pool, we pick objects {r, k}.
        // If picked object's k != target k, that's step 1.
        // But if picked object's r (excluding hint) is same as target r (excluding hint)...
        // This is getting complex. 
        // TRICK: Just ensure k is different. The Hint system forces the user to look for a specific Kanji.
        // If Question is "Hi (Fire)", and "Sun" falls... 
        // User knows "Sun" is "Hi" but not "Fire". So it's a valid distractor actually!
        // The user complained about "Hi" -> "Fire or Sun?".
        // If I specify "Hi (Fire)", then "Sun" is clearly WRONG.
        // So standard logic is fine IF hints are present.

        decoys.push(rand.k);
    }
    return decoys;
}

// Player Object
const player = {
    x: 0,
    y: 0,
    width: 140, // Increased size for new asset
    height: 140,
    targetX: 0
};

// Resizing
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    player.y = canvas.height - 150; // Ground position
    player.targetX = canvas.width / 2;
    player.x = canvas.width / 2;
}
window.addEventListener('resize', resize);
resize();

// Input Handling
function handleInput(e) {
    e.preventDefault();
    if (state.mode !== 'playing') return;
    let clientX;
    if (e.touches) {
        clientX = e.touches[0].clientX;
    } else {
        clientX = e.clientX;
    }
    player.targetX = clientX;
}
canvas.addEventListener('mousemove', handleInput);
canvas.addEventListener('touchmove', handleInput, { passive: false });
canvas.addEventListener('touchstart', handleInput, { passive: false });


// ----------------------------------------------------------------
// Game Logic
// ----------------------------------------------------------------

function startGame() {
    // Get settings
    const gradeSelect = document.getElementById('grade-select');
    state.grade = parseInt(gradeSelect.value);

    // Resume Audio Context if needed
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Reset state
    state.score = 0;
    state.timeLeft = CONFIG.GAME_DURATION;
    state.apples = [];
    state.mode = 'playing';
    state.lastTime = performance.now();
    state.spawnTimer = 0;
    state.questionHistory = [];
    state.spawnCountSinceAnswer = 0;
    state.lastSpawnedChar = null;

    // Update UI
    scoreDisplay.innerText = 0;
    timeDisplay.innerText = state.timeLeft;
    overlayStart.classList.remove('active');
    overlayGameover.classList.add('hidden');
    overlayGameover.classList.remove('active');
    overlayPause.classList.remove('active');

    // Start BGM
    startBGM();

    // Set First Question
    nextQuestion();

    // Start Loop
    requestAnimationFrame(gameLoop);
}

function nextQuestion() {
    let dataList = QUESTION_DATA[state.grade];
    if (!dataList) dataList = QUESTION_DATA[1];

    // Try to find a question not in history
    let q;
    let attempts = 0;
    do {
        q = dataList[Math.floor(Math.random() * dataList.length)];
        attempts++;
    } while (attempts < 10 && state.questionHistory.includes(q.k));

    // Update History (Keep last 3)
    state.questionHistory.push(q.k);
    if (state.questionHistory.length > 3) state.questionHistory.shift();

    state.question = {
        reading: q.r,
        answer: q.k,
        decoys: q.d ? q.d : getDecoys(q.k, state.grade)
    };

    state.spawnCountSinceAnswer = 0; // Reset counter for guaranteed spawn
    questionText.innerText = state.question.reading;
}

function spawnApple() {
    const margin = 50;
    const x = Math.random() * (canvas.width - margin * 2) + margin;

    // Fairness Logic
    let char;
    // Guaranteed spawn logic: if 3 apples passed without answer, force answer
    if (state.spawnCountSinceAnswer >= 3) {
        char = state.question.answer;
    } else {
        // Random pick
        const types = [state.question.answer, ...state.question.decoys];
        // Bias towards answer slightly (40%)
        if (Math.random() < 0.4) {
            char = state.question.answer;
        } else {
            // Pick decoy or extra random
            char = types[Math.floor(Math.random() * types.length)];
        }
    }

    // Prevent immediate consecutively same char
    if (char === state.lastSpawnedChar) {
        // Flip to answer if it was decoy, or decoy if was answer
        if (char === state.question.answer) {
            char = state.question.decoys[0];
        } else {
            char = state.question.answer;
        }
    }

    state.lastSpawnedChar = char;
    if (char === state.question.answer) {
        state.spawnCountSinceAnswer = 0;
    } else {
        state.spawnCountSinceAnswer++;
    }

    // Speed Logic
    let baseSpeed = CONFIG.APPLE_SPEED_BASE + (Math.random() * 2) + ((60 - state.timeLeft) / 20);
    // Grade Multipliers
    if (state.grade === 1) baseSpeed *= 0.7; // Slower for Grade 1
    if (state.grade === 6) baseSpeed *= 1.8; // Faster for Grade 6

    state.apples.push({
        x: x,
        y: -60,
        char: char,
        speed: baseSpeed,
        w: 60,
        h: 60,
        swayPhase: Math.random() * Math.PI * 2 // For G6 sway
    });
}

function update(dt) {
    state.timeLeft -= dt / 1000;
    if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        endGame();
        return;
    }
    timeDisplay.innerText = Math.floor(state.timeLeft);

    // Player Movement (Lerp)
    player.x += (player.targetX - player.x) * 0.2;
    if (player.x < 50) player.x = 50;
    if (player.x > canvas.width - 50) player.x = canvas.width - 50;

    // Spawner
    state.spawnTimer += dt;
    // Spawn rate adjustments
    let currentSpawnRate = CONFIG.SPAWN_RATE_BASE - ((60 - state.timeLeft) * 10);
    if (state.grade === 6) currentSpawnRate *= 0.6; // Faster spawn for G6

    if (state.spawnTimer > currentSpawnRate) {
        spawnApple();
        state.spawnTimer = 0;
    }

    // Update Apples
    for (let i = state.apples.length - 1; i >= 0; i--) {
        let apple = state.apples[i];
        apple.y += apple.speed;

        // Sway effect for Grade 6
        if (state.grade >= 6) {
            apple.x += Math.sin(apple.y / 50 + apple.swayPhase) * 1.5;
        }

        // Collision
        if (checkCollision(player, apple)) {
            handleCatch(apple);
            state.apples.splice(i, 1);
            continue;
        }

        if (apple.y > canvas.height) {
            state.apples.splice(i, 1);
        }
    }
}

function checkCollision(p, a) {
    const dx = p.x - a.x;
    const dy = (p.y + 20) - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < 70;
}

function handleCatch(apple) {
    // Robust Correctness Check
    if (apple.char === state.question.answer) {
        // Correct
        state.score += CONFIG.SCORE_CORRECT;
        showFeedback("⭕️", apple.x, apple.y);
        playSound("correct");
        nextQuestion();
    } else {
        // Wrong
        state.score += CONFIG.SCORE_MISTAKE;
        showFeedback("✖️", apple.x, apple.y);
        playSound("wrong");
    }
    scoreDisplay.innerText = state.score;
}

function showFeedback(text, x, y) {
    const el = document.createElement('div');
    el.innerText = text;
    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.fontSize = '3rem';
    el.style.fontWeight = 'bold';
    el.style.color = (text === '⭕️') ? 'red' : 'blue';
    el.style.pointerEvents = 'none';
    el.style.transition = 'top 1s, opacity 1s';
    document.body.appendChild(el);

    requestAnimationFrame(() => {
        el.style.top = (y - 100) + 'px';
        el.style.opacity = '0';
    });

    setTimeout(() => {
        el.remove();
    }, 1000);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Player Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 60, 60, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw Kitannon
    if (imgPlayer.complete) {
        ctx.drawImage(imgPlayer, player.x - player.width / 2, player.y - player.height / 2, player.width, player.height);
    } else {
        ctx.fillStyle = 'green';
        ctx.fillRect(player.x - 40, player.y - 40, 80, 80);
    }

    // Draw Apples
    state.apples.forEach(apple => {
        // Draw Apple Body
        ctx.fillStyle = '#FF5252';
        ctx.beginPath();
        ctx.arc(apple.x, apple.y, 35, 0, Math.PI * 2);
        ctx.fill();

        // Stem
        ctx.strokeStyle = '#5D4037';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(apple.x, apple.y - 30);
        ctx.lineTo(apple.x + 5, apple.y - 45);
        ctx.stroke();

        // Leaf
        ctx.fillStyle = '#66BB6A';
        ctx.beginPath();
        ctx.ellipse(apple.x + 10, apple.y - 40, 10, 5, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        // Text (Kanji) - UPDATED FONT
        ctx.fillStyle = 'white';
        // Stroke to make it readable
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#B71C1C';
        ctx.font = 'bold 36px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeText(apple.char, apple.x, apple.y + 2);
        ctx.fillText(apple.char, apple.x, apple.y + 2);
    });
}

function gameLoop(timestamp) {
    if (state.mode !== 'playing') return;
    const dt = timestamp - state.lastTime;
    state.lastTime = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

function endGame() {
    state.mode = 'gameover';
    stopBGM();
    overlayGameover.classList.remove('hidden');
    overlayGameover.classList.add('active');
    document.getElementById('final-score').innerText = state.score;
    // Praise logic...
    const evalEl = document.getElementById('evaluation-message');
    if (state.score < 0) evalEl.innerText = "ドンマイ！";
    else if (state.score < 50) evalEl.innerText = "いいかんじ！";
    else if (state.score < 100) evalEl.innerText = "すごい！かっこいい！";
    else evalEl.innerText = "てんさい！！";

    let hs = localStorage.getItem('kanjiApp_highScore_' + state.grade) || 0;
    if (state.score > hs) {
        hs = state.score;
        localStorage.setItem('kanjiApp_highScore_' + state.grade, hs);
    }
    document.getElementById('high-score').innerText = hs;
}

function togglePause() {
    if (state.mode === 'playing') {
        state.mode = 'paused';
        stopBGM();
        overlayPause.classList.add('active');
    } else if (state.mode === 'paused') {
        state.mode = 'playing';
        startBGM();
        state.lastTime = performance.now();
        overlayPause.classList.remove('active');
        requestAnimationFrame(gameLoop);
    }
}

function toTitle() {
    state.mode = 'title';
    stopBGM();
    overlayGameover.classList.add('hidden');
    overlayGameover.classList.remove('active');
    overlayPause.classList.remove('active');
    overlayStart.classList.add('active');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ----------------------
// Audio System (BGM & SFX)
// ----------------------

function playSound(type) {
    if (!document.getElementById('sound-toggle-start').checked) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(1400, t + 0.1);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
    } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(80, t + 0.2);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
    }
}

// Procedural BGM: Simple forest walk
function startBGM() {
    if (!document.getElementById('sound-toggle-start').checked) return;
    if (bgmInterval) return;

    // BPM 110 = ~545ms per beat. 8 beat loop.
    const beatLen = 0.545;
    let beat = 0;

    // Notes for C Major simple tune
    const scale = [261.63, 329.63, 392.00, 440.00, 392.00, 329.63, 293.66, 261.63];

    bgmInterval = setInterval(() => {
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'triangle';
        const freq = scale[beat % 8];
        osc.frequency.setValueAtTime(freq, t);

        // Envelope: soft pluck
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

        osc.start(t);
        osc.stop(t + 0.5);

        beat++;
    }, beatLen * 1000);
}

function stopBGM() {
    if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
    }
}
