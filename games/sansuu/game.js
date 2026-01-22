/**
 * Math Balloon Game - Kitannon
 * FINAL STABLE VERSION with Home Navigation
 */

/* ========= CONFIG ========= */
const CONFIG = {
  colors: ['#EF5350','#42A5F5','#66BB6A','#FFCA28','#AB47BC','#FF7043'],
  spawnIntervalPC:1.2,
  spawnIntervalMobile:1.6,
  travelPC:5.0,
  travelMobile:6.5,
  maxPC:8,
  maxMobile:5,
  mobileW:600,
  mobileH:700,
  rPC:35,
  rMobile:45,
  hit:15,
  time:60
};

const SCORE = {
  ok:{1:8,2:10,3:12,4:14,5:16,6:18},
  ng:{1:0,2:2,3:3,4:4,5:5,6:6}
};

/* ========= STATE ========= */
const state={
  playing:false,
  score:0,
  combo:0,
  time:CONFIG.time,
  q:{t:'',a:null},
  b:[],
  last:0,
  spawn:0,
  grade:+localStorage.getItem('kitannon_math_grade')||1
};

/* ========= DOM ========= */
const c=document.getElementById('game-canvas');
const x=c.getContext('2d');
const uiS=document.getElementById('score-display');
const uiT=document.getElementById('time-display');
const uiQ=document.getElementById('question-text');
const oStart=document.getElementById('overlay-start');
const oEnd=document.getElementById('overlay-gameover');

/* ========= UTIL ========= */
const mob=()=>innerWidth<CONFIG.mobileW||innerHeight<CONFIG.mobileH;
const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const norm=v=>Number.isInteger(v)?v:v.toFixed(1);

/* ========= INIT ========= */
onload=()=>{
  resize();
  addEventListener('resize',resize);
  document.getElementById('start-btn').onclick=start;
  document.getElementById('retry-btn').onclick=start;
  injectHomeBtn();
  requestAnimationFrame(loop);
};

function resize(){
  const d=devicePixelRatio||1;
  c.width=innerWidth*d;
  c.height=innerHeight*d;
  x.setTransform(d,0,0,d,0,0);
}

/* ========= HOME ========= */
function goHome(){
  state.playing=false;
  state.b=[];
  state.time=CONFIG.time;
  oEnd.classList.add('hidden');
  oStart.classList.remove('hidden');
}

function injectHomeBtn(){
  if(document.getElementById('home-float'))return;
  const b=document.createElement('button');
  b.id='home-float';
  b.textContent='ホーム';
  Object.assign(b.style,{
    position:'fixed',left:'10px',top:'10px',zIndex:9999,
    padding:'8px 14px',borderRadius:'999px',
    border:'1px solid #ccc',background:'#fff',fontWeight:'700'
  });
  b.onclick=goHome;
  document.body.appendChild(b);
}

/* ========= GAME ========= */
function start(){
  state.playing=true;
  state.score=0;
  state.combo=0;
  state.time=CONFIG.time;
  state.b=[];
  state.spawn=0;
  state.last=performance.now();
  oStart.classList.add('hidden');
  oEnd.classList.add('hidden');
  nextQ();
}

function end(){
  state.playing=false;
  oEnd.classList.remove('hidden');
}

/* ========= QUESTIONS ========= */
function nextQ(){
  state.b=[];
  let t,a,g=state.grade;

  if(g===1){let x=rnd(1,9),y=rnd(1,9);t=`${x}+${y}`;a=x+y;}
  else if(g===2){let x=rnd(10,99),y=rnd(1,x);t=Math.random()<.5?`${x}+${y}`:`${x}-${y}`;a=t.includes('+')?x+y:x-y;}
  else if(g===3){let x=rnd(2,9),y=rnd(2,9);t=`${x}×${y}`;a=x*y;}
  else if(g===4){let d=rnd(2,9),v=rnd(2,9);t=`${d*v}÷${d}`;a=v;}
  else if(g===5){
    if(Math.random()<.5){let x=rnd(1,99)/10,y=rnd(1,99)/10;t=`${x.toFixed(1)}+${y.toFixed(1)}`;a=+(x+y).toFixed(1);}
    else{let x=rnd(2,9),y=rnd(1,9)/10;t=`${y.toFixed(1)}×${x}`;a=+(x*y).toFixed(1);}
  }
  else{
    let s=rnd(20,80),m=[15,20,30,45][rnd(0,3)];
    t=`時速${s}kmで${m}分`;a=+(s*(m/60)).toFixed(1);
  }

  state.q={t,a};
  uiQ.textContent=t;
  Math.random()<.5?(spawn(false),spawn(true)):(spawn(true),spawn(false));
}

/* ========= BALLOON ========= */
class B{
  constructor(ok){
    this.ok=ok;
    this.v=ok?state.q.a:wrong();
    this.r=mob()?CONFIG.rMobile:CONFIG.rPC;
    this.x=rnd(this.r,innerWidth-this.r);
    this.y=innerHeight+this.r;
    this.s=(innerHeight+this.r*2)/(mob()?CONFIG.travelMobile:CONFIG.travelPC);
    this.c=CONFIG.colors[rnd(0,5)];
  }
  u(d){this.y-=this.s*d;}
  d(){
    x.beginPath();x.arc(this.x,this.y,this.r,0,7);
    x.fillStyle=this.c;x.fill();
    x.fillStyle='#fff';x.font=`bold ${this.r*.7}px sans-serif`;
    x.textAlign='center';x.textBaseline='middle';
    x.fillText(this.v,this.x,this.y);
  }
  h(px,py){return Math.hypot(px-this.x,py-this.y)<this.r+CONFIG.hit;}
}
const wrong=()=>{let a=state.q.a;return Number.isInteger(a)?a+rnd(-5,5)||a+1:+(a+(Math.random()<.5?-0.1:0.1)).toFixed(1);};
const spawn=o=>state.b.push(new B(o));

/* ========= LOOP ========= */
function loop(t){
  let d=(t-state.last)/1000;state.last=t;
  if(state.playing){
    state.time-=d;
    if(state.time<=0)end();
    uiT.textContent=Math.ceil(state.time);
    state.spawn+=d;
    if(state.spawn>(mob()?CONFIG.spawnIntervalMobile:CONFIG.spawnIntervalPC)){
      state.spawn=0;spawn(false);
    }
    for(let i=state.b.length-1;i>=0;i--){
      state.b[i].u(d);
      if(state.b[i].y<-50)state.b.splice(i,1);
    }
  }
  draw();requestAnimationFrame(loop);
}
function draw(){x.clearRect(0,0,innerWidth,innerHeight);state.b.forEach(b=>b.d());}

/* ========= INPUT ========= */
c.addEventListener('pointerdown',e=>{
  if(!state.playing)return;
  const r=c.getBoundingClientRect();
  const px=e.clientX-r.left,py=e.clientY-r.top;
  for(let i=state.b.length-1;i>=0;i--){
    if(state.b[i].h(px,py)){
      const b=state.b.splice(i,1)[0];
      if(norm(b.v)===norm(state.q.a)){
        state.score+=SCORE.ok[state.grade];
        state.combo++;nextQ();
      }else{
        state.score=Math.max(0,state.score-SCORE.ng[state.grade]);
        state.combo=0;
      }
      uiS.textContent=state.score;
      break;
    }
  }
});