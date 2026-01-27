
// Game Configuration
const CONFIG = {
    GAME_DURATION: 60, // seconds
    SPAWN_RATE_BASE: 1200, // ms
    GRAVITY: 0.1,
    APPLE_SPEED_BASE: 2,
    APPLE_SPEED_MAX: 6,
    PLAYER_SPEED: 0,
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
document.getElementById('retry-btn').addEventListener('click', startGame);
document.getElementById('gameover-back-btn').addEventListener('click', toTitle);

// Game State
let state = {
    mode: 'title',
    score: 0,
    timeLeft: 0,
    grade: 1,
    speedMode: 'normal', // normal, slow
    lastTime: 0,
    spawnTimer: 0,
    apples: [],
    question: null,
    // Bag system for questions to ensure full rotation and no repeats until exhausted
    questionBag: [],
    spawnCountSinceAnswer: 0,
    lastSpawnedChar: null
};

// Mock Assets
const imgPlayer = new Image();
imgPlayer.src = "../../assets/characters/kitannon_basket.png";

// Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let bgmOscillators = [];
let bgmInterval = null;

// ----------------------------------------------------------------
// Question Data (MEXT Compliant)
// ----------------------------------------------------------------
// Grade 1: 80 characters strict.
const GRADE_1_KANJI = [
    { r: "いち", k: "一" }, { r: "みぎ", k: "右" }, { r: "あめ", k: "雨" }, { r: "えん", k: "円" },
    { r: "おう", k: "王" }, { r: "おと", k: "音" }, { r: "した", k: "下" }, { r: "ひ (燃える)", k: "火" },
    { r: "はな", k: "花" }, { r: "かい", k: "貝" }, { r: "まなぶ", k: "学" }, { r: "き (気分)", k: "気" },
    { r: "きゅう", k: "九" }, { r: "やすみ", k: "休" }, { r: "たま", k: "玉" }, { r: "きん", k: "金" },
    { r: "そら", k: "空" }, { r: "つき", k: "月" }, { r: "いぬ", k: "犬" }, { r: "みる", k: "見" },
    { r: "ご", k: "五" }, { r: "くち", k: "口" }, { r: "がっこう", k: "校" }, { r: "ひだり", k: "左" },
    { r: "さん", k: "三" }, { r: "やま", k: "山" }, { r: "こ", k: "子" }, { r: "よん", k: "四" },
    { r: "いと", k: "糸" }, { r: "じ", k: "字" }, { r: "みみ", k: "耳" }, { r: "なな", k: "七" },
    { r: "くるま", k: "車" }, { r: "て", k: "手" }, { r: "じゅう", k: "十" }, { r: "でる", k: "出" },
    { r: "おんな", k: "女" }, { r: "ちいさい", k: "小" }, { r: "うえ", k: "上" }, { r: "もり", k: "森" },
    { r: "ひと", k: "人" }, { r: "みず", k: "水" }, { r: "ただしい", k: "正" }, { r: "いきる", k: "生" },
    { r: "あおい", k: "青" }, { r: "ゆうがた", k: "夕" }, { r: "いし", k: "石" }, { r: "あかい", k: "赤" },
    { r: "せん", k: "千" }, { r: "かわ", k: "川" }, { r: "さき", k: "先" }, { r: "はやい", k: "早" },
    { r: "くさ", k: "草" }, { r: "あし", k: "足" }, { r: "むら", k: "村" }, { r: "おおきい", k: "大" },
    { r: "おとこ", k: "男" }, { r: "たけ", k: "竹" }, { r: "なか", k: "中" }, { r: "むし", k: "虫" },
    { r: "まち", k: "町" }, { r: "てん", k: "天" }, { r: "た", k: "田" }, { r: "つち", k: "土" },
    { r: "に", k: "二" }, { r: "ひ (お日様)", k: "日" }, { r: "はいる", k: "入" }, { r: "とし", k: "年" },
    { r: "しろい", k: "白" }, { r: "はち", k: "八" }, { r: "ひゃく", k: "百" }, { r: "ぶん", k: "文" },
    { r: "き (樹木)", k: "木" }, { r: "ほん", k: "本" }, { r: "な", k: "名" }, { r: "め", k: "目" },
    { r: "たつ", k: "立" }, { r: "ちから", k: "力" }, { r: "はやし", k: "林" }, { r: "ろく", k: "六" }
];

const QUESTION_DATA = {
    1: GRADE_1_KANJI,
    2: [
        { r: "かたな", k: "刀", d: ["力", "刃"] }, { r: "ゆみ", k: "弓", d: ["引"] },
        { r: "や", k: "矢", d: ["失"] }, { r: "きた", k: "北", d: ["比"] },
        { r: "みなみ", k: "南" }, { r: "ひがし", k: "東" }, { r: "にし", k: "西" },
        { r: "はる", k: "春" }, { r: "なつ", k: "夏" },
        { r: "あき", k: "秋" }, { r: "ふゆ", k: "冬" },
        { r: "とり", k: "鳥", d: ["烏", "島"] }, { r: "うま", k: "馬" }, { r: "さかな", k: "魚" },
        { r: "そら", k: "空" }, { r: "うみ", k: "海" }, { r: "あに", k: "兄" }, { r: "あね", k: "姉" },
        { r: "おとうと", k: "弟" }, { r: "いもうと", k: "妹" }, { r: "かみ", k: "紙" }, { r: "え", k: "画" }
    ],
    3: [
        { r: "まめ", k: "豆" }, { r: "さか", k: "坂", d: ["板"] }, { r: "さら", k: "皿", d: ["血"] },
        { r: "ち (血液)", k: "血", d: ["皿"] }, { r: "かわ (皮膚)", k: "皮", d: ["波"] },
        { r: "はこ", k: "箱" }, { r: "くすり", k: "薬" }, { r: "びょうき", k: "病" },
        { r: "うん", k: "運" }, { r: "どう", k: "動" }, { r: "おもい", k: "重" },
        { r: "かるい", k: "軽" }, { r: "あつい (気温)", k: "暑" }, { r: "さむい", k: "寒" },
        { r: "とく", k: "特" }, { r: "わるい", k: "悪" }, { r: "あんしん", k: "安" }
    ],
    4: [
        { r: "あい", k: "愛" }, { r: "あん", k: "案" }, { r: "い (〜以上)", k: "以" },
        { r: "い (服)", k: "衣" }, { r: "い (順位)", k: "位" }, { r: "い (囲む)", k: "囲" },
        { r: "かんさつ", k: "観察", d: ["観祭", "観刷"] },
        { r: "せつめい", k: "説明" }, { r: "ようい", k: "用意" },
        { r: "きせつ", k: "季節" }, { r: "しぜん", k: "自然" }, { r: "しょうらい", k: "将来" },
        { r: "きかい", k: "機械" }, { r: "けんこう", k: "健康" }
    ],
    5: [
        { r: "えいせい", k: "衛星" }, { r: "ぼうえき", k: "貿易" },
        { r: "ゆしゅつ", k: "輸出" }, { r: "ゆにゅう", k: "輸入" },
        { r: "さんぎょう", k: "産業" }, { r: "こうぎょう", k: "工業" },
        { r: "きょうし", k: "教師" }, { r: "せいじ", k: "政治" },
        { r: "じょうけん", k: "条件" }, { r: "せきにん", k: "責任" }
    ],
    6: [
        // Expanded Grade 6 Jukugo
        { r: "けんぽう", k: "憲法" }, { r: "せいじ", k: "政治" }, { r: "せんきょ", k: "選挙" },
        { r: "ないかく", k: "内閣" }, { r: "うちゅう", k: "宇宙" }, { r: "れきし", k: "歴史" },
        { r: "そうり", k: "総理" }, { r: "こっかい", k: "国会" }, { r: "おうふく", k: "往復" },
        { r: "しょうぐん", k: "将軍" }, { r: "ほきゅう", k: "補給" }, { r: "かく", k: "核" },
        { r: "してい", k: "私堤" }, { r: "はい", k: "肺" }, { r: "い", k: "胃" }, { r: "ちょう", k: "腸" },
        { r: "ぞうき", k: "臓器" }, { r: "きぞう", k: "寄贈" }, { r: "しっそ", k: "質素" },
        { r: "ばんごう", k: "番号" }, { r: "ひみつ", k: "秘密" }, { r: "ほうりつ", k: "法律" },
        { r: "めいれい", k: "命令" }, { r: "やくそく", k: "約束" }, { r: "ゆうびん", k: "郵便" },
        { r: "ようじ", k: "幼児" }, { r: "ようちえん", k: "幼稚園" }, { r: "りかい", k: "理解" },
        { r: "りくつ", k: "理屈" }, { r: "りそう", k: "理想" }, { r: "りんじ", k: "臨時" },
        { r: "れいぎ", k: "礼儀" }, { r: "れいたん", k: "冷淡" }, { r: "ろうじん", k: "老人" },
        { r: "ろうどう", k: "労働" }, { r: "ろんり", k: "論理" }
    ]
};

// Helper: Get random decoys
// Strategy: Pick random Kanji from same grade that are NOT the target
function getDecoys(targetKanji, grade) {
    const pool = QUESTION_DATA[grade] || QUESTION_DATA[1];
    let decoys = [];
    let attempts = 0;
    while (decoys.length < 2 && attempts < 50) {
        attempts++;
        const rand = pool[Math.floor(Math.random() * pool.length)];
        if (rand.k !== targetKanji && !decoys.includes(rand.k)) {
            decoys.push(rand.k);
        }
    }
    return decoys;
}

// Player Object
const player = {
    x: 0,
    y: 0,
    width: 140,
    height: 140,
    targetX: 0
};

// Resizing
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    player.y = canvas.height - 150;
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

    // Speed Setting
    const speedRadios = document.getElementsByName('speed');
    for (const r of speedRadios) {
        if (r.checked) state.speedMode = r.value;
    }

    // Resume Audio
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Init State
    state.score = 0;
    state.timeLeft = CONFIG.GAME_DURATION;
    state.apples = [];
    state.mode = 'playing';
    state.lastTime = performance.now();
    state.spawnTimer = 0;

    // Init Bag
    state.questionBag = []; // Will be filled in nextQuestion
    state.spawnCountSinceAnswer = 0;
    state.lastSpawnedChar = null;

    // UI
    scoreDisplay.innerText = 0;
    timeDisplay.innerText = state.timeLeft;
    overlayStart.classList.remove('active');
    overlayGameover.classList.add('hidden');
    overlayGameover.classList.remove('active');
    overlayPause.classList.remove('active');

    startBGM();
    nextQuestion();
    requestAnimationFrame(gameLoop);
}

function nextQuestion() {
    let dataList = QUESTION_DATA[state.grade];
    if (!dataList) dataList = QUESTION_DATA[1];

    // Bag Logic
    if (state.questionBag.length === 0) {
        // Refill and shuffle
        state.questionBag = [...dataList];
        // Fisher-Yates shuffle
        for (let i = state.questionBag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [state.questionBag[i], state.questionBag[j]] = [state.questionBag[j], state.questionBag[i]];
        }
    }

    const q = state.questionBag.pop();

    state.question = {
        reading: q.r,
        answer: q.k,
        decoys: q.d ? q.d : getDecoys(q.k, state.grade)
    };

    state.spawnCountSinceAnswer = 0; // Reset guarantee
    questionText.innerText = state.question.reading;
}

function spawnApple() {
    const margin = 50;
    const x = Math.random() * (canvas.width - margin * 2) + margin;

    // Selection Logic w/ Guarantee
    let char;
    if (state.spawnCountSinceAnswer >= 3) {
        char = state.question.answer;
    } else {
        const types = [state.question.answer, ...state.question.decoys];
        if (Math.random() < 0.4) {
            char = state.question.answer;
        } else {
            char = types[Math.floor(Math.random() * types.length)];
        }
    }

    // No Repeats of falling object
    if (char === state.lastSpawnedChar) {
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
    // Grade Mods
    if (state.grade === 1) baseSpeed *= 0.8; // Base slower for G1
    if (state.grade === 6) baseSpeed *= 1.8;

    // User Setting
    if (state.speedMode === 'slow') {
        baseSpeed *= 0.7; // 30% slower
    }

    state.apples.push({
        x: x,
        y: -60,
        char: char,
        speed: baseSpeed,
        w: 60,
        h: 60,
        swayPhase: Math.random() * Math.PI * 2
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

    player.x += (player.targetX - player.x) * 0.2;
    if (player.x < 50) player.x = 50;
    if (player.x > canvas.width - 50) player.x = canvas.width - 50;

    state.spawnTimer += dt;
    let currentSpawnRate = CONFIG.SPAWN_RATE_BASE - ((60 - state.timeLeft) * 10);
    if (state.grade === 6) currentSpawnRate *= 0.6;

    if (state.spawnTimer > currentSpawnRate) {
        spawnApple();
        state.spawnTimer = 0;
    }

    for (let i = state.apples.length - 1; i >= 0; i--) {
        let apple = state.apples[i];
        apple.y += apple.speed;

        if (state.grade >= 6) {
            apple.x += Math.sin(apple.y / 50 + apple.swayPhase) * 1.5;
        }

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
    // Correctness check by Value
    if (apple.char === state.question.answer) {
        state.score += CONFIG.SCORE_CORRECT;
        showFeedback("⭕️", apple.x, apple.y);
        playSound("correct");
        nextQuestion();
    } else {
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

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 60, 60, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    if (imgPlayer.complete) {
        ctx.drawImage(imgPlayer, player.x - player.width / 2, player.y - player.height / 2, player.width, player.height);
    } else {
        ctx.fillStyle = 'green';
        ctx.fillRect(player.x - 40, player.y - 40, 80, 80);
    }

    state.apples.forEach(apple => {
        ctx.fillStyle = '#FF5252';
        ctx.beginPath();
        ctx.arc(apple.x, apple.y, 35, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#5D4037';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(apple.x, apple.y - 30);
        ctx.lineTo(apple.x + 5, apple.y - 45);
        ctx.stroke();

        ctx.fillStyle = '#66BB6A';
        ctx.beginPath();
        ctx.ellipse(apple.x + 10, apple.y - 40, 10, 5, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'white';
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

function startBGM() {
    if (!document.getElementById('sound-toggle-start').checked) return;
    if (bgmInterval) return;

    const beatLen = 0.545;
    let beat = 0;
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
