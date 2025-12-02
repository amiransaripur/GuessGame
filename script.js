// script.js — compact & stable version
const MAX_WORDS_PER_ROUND = 30;
const ROUND_SECONDS = 180; // 3 minutes

let db = {words:[]};
let teams = [];
let currentTeamIndex = 0;
let roundsPerTeam = 3;
let currentRoundOfTeam = [0,0,0];

let wordsPool = [];
let roundQueue = [];
let skipQueue = [];
let currentWord = null;

let roundStartScore = 0; // snapshot of team's score at start of round
let mainTimer = 0;
let timerJob = null;

const el = id => document.getElementById(id);

// load DB
fetch('database.json')
  .then(r=>r.json())
  .then(j=>{
    db = j || {words:[]};
    wordsPool = (db.words || []).slice();
    shuffle(wordsPool);
  })
  .catch(e=>{
    alert('دیتابیس بارگذاری نشد: ' + e);
  });

function shuffle(a){ for(let i=a.length-1;i>0;i--){ const r=Math.floor(Math.random()*(i+1)); [a[i],a[r]]=[a[r],a[i]]; } }

function fmt(sec){ const m=Math.floor(sec/60), s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

function resetState(){
  currentTeamIndex = 0;
  currentRoundOfTeam = [0,0,0];
  wordsPool = (db.words || []).slice();
  shuffle(wordsPool);
}

// UI updates
function updateMeta(){
  el('roundInfo').innerText = `${currentRoundOfTeam[currentTeamIndex]+1}/${roundsPerTeam}`;
  el('teamInfo').innerText = teams[currentTeamIndex]?.name || '-';
}
function updateRoundInfo(){
  el('teamTurn').innerText = teams[currentTeamIndex].name;
  el('roundNumber').innerText = currentRoundOfTeam[currentTeamIndex] + 1;
}
function updateScores(){
  const ul = el('scoreList'); ul.innerHTML='';
  teams.forEach((t,i)=>{ const mark = (i===currentTeamIndex)?' ← نوبت':''; const li=document.createElement('li'); li.innerText=`${t.name}: ${t.score} ${mark}`; ul.appendChild(li); });
  el('teamRoundPlayed').innerText = currentRoundOfTeam[currentTeamIndex];
}

// prepare words
function prepareRoundWords(){
  roundQueue = [];
  for(let i=0;i<MAX_WORDS_PER_ROUND && wordsPool.length>0;i++){
    const w = wordsPool.shift();
    roundQueue.push({
      word: w.word || 'Unknown',
      definition: w.definition || '',
      score: Number(w.score) || 1
    });
  }
  skipQueue = [];
  el('wordsLeft').innerText = roundQueue.length;
  el('skipCount').innerText = 0;
}

// update timer bar
function setTimerBar(){
  const bar = el('timerBar');
  const pct = Math.max(0, Math.min(1, mainTimer / ROUND_SECONDS));
  bar.style.width = `${pct*100}%`;
}

// next word and bonus rule
function nextWord(){
  if(roundQueue.length === 0){
    if(skipQueue.length > 0){
      roundQueue = skipQueue.slice();
      skipQueue = [];
    } else {
      // no words left
      if(mainTimer > 0){
        teams[currentTeamIndex].score += 5;
        updateScores();
        alert(`👏 تیم ${teams[currentTeamIndex].name} همهٔ کلمات را قبل از پایان زمان تمام کرد!\n+5 امتیاز`);
        // end round cleanly
        endRound();
        return;
      }
      currentWord = null;
      el('cardBox').innerText = '---';
      el('curWordScore').innerText = '0';
      el('wordsLeft').innerText = 0;
      el('skipCount').innerText = 0;
      return;
    }
  }

  currentWord = roundQueue.shift();
  currentWord.score = Number(currentWord.score) || 1;

  // animate simple (repaint)
  el('cardBox').classList.remove('flip');
  void el('cardBox').offsetWidth;
  el('cardBox').classList.add('flip');

  el('cardBox').innerText = currentWord.word;
  el('curWordScore').innerText = currentWord.score;
  el('wordsLeft').innerText = roundQueue.length;
  el('skipCount').innerText = skipQueue.length;
}

// start round
function startRound(){
  if(currentRoundOfTeam[currentTeamIndex] >= roundsPerTeam){
    alert('این تیم همه راندهایش را بازی کرده.');
    return;
  }
  if(roundQueue.length === 0) prepareRoundWords();
  // snapshot start score
  roundStartScore = teams[currentTeamIndex].score || 0;

  el('roundControl').classList.add('hidden');
  el('game').classList.remove('hidden');
  el('roundResult').classList.add('hidden');
  el('btnNextTeam').classList.add('hidden');

  enableControls(true);

  mainTimer = ROUND_SECONDS;
  el('mainTimer').innerText = fmt(mainTimer);
  setTimerBar();

  nextWord();

  if(timerJob) clearInterval(timerJob);
  timerJob = setInterval(()=>{
    mainTimer--;
    el('mainTimer').innerText = fmt(mainTimer);
    setTimerBar();
    if(mainTimer <= 0){
      clearInterval(timerJob); timerJob = null;
      endRound();
    }
  },1000);

  updateRoundInfo();
  updateScores();
}

// button handlers
function onCorrect(){
  if(!currentWord) return;
  teams[currentTeamIndex].score += Number(currentWord.score) || 1;
  updateScores();
  nextWord();
}

function onSkip(){
  if(!currentWord) return;
  skipQueue.push(currentWord);
  el('skipCount').innerText = skipQueue.length;
  nextWord();
}

function onDefine(){
  if(!currentWord) return;
  // penalty
  teams[currentTeamIndex].score -= 1;
  updateScores();
  alert('تعریف:\n' + (currentWord.definition || 'ندارد'));
  // after alert, continue to next word (timer continues)
  nextWord();
}

// end round
function endRound(){
  enableControls(false);
  // stop timer if running
  if(timerJob){ clearInterval(timerJob); timerJob = null; }

  currentRoundOfTeam[currentTeamIndex]++;

  // show result panel with per-round points
  const roundPoints = teams[currentTeamIndex].score - roundStartScore;
  el('resultTeam').innerText = teams[currentTeamIndex].name;
  el('resultRoundScore').innerText = roundPoints >= 0 ? `+${roundPoints}` : `${roundPoints}`;
  el('resultTotalScore').innerText = teams[currentTeamIndex].score;

  el('roundResult').classList.remove('hidden');
  el('game').classList.add('hidden');

  // if all done -> change button text
  if(currentRoundOfTeam.every(r => r >= roundsPerTeam)){
    el('btnStartNext').innerText = 'پایان بازی';
  } else {
    el('btnStartNext').innerText = 'شروع نوبت بعدی';
  }
}

// next team (after teacher sees result and presses start next)
function onStartNext(){
  // find next team with remaining rounds
  let found = false;
  for(let i=1;i<=teams.length;i++){
    const nx = (currentTeamIndex + i) % teams.length;
    if(currentRoundOfTeam[nx] < roundsPerTeam){
      currentTeamIndex = nx;
      found = true;
      break;
    }
  }
  if(!found){
    // all done
    endGame();
    return;
  }
  // prepare for next team
  if(roundQueue.length === 0 && wordsPool.length > 0) prepareRoundWords();
  el('roundResult').classList.add('hidden');
  el('roundControl').classList.remove('hidden');
  updateRoundInfo();
  updateScores();
}

// next team button in-game (if teacher presses)
function onNextTeam(){
  if(timerJob){ clearInterval(timerJob); timerJob = null; }
  // same selection logic
  for(let i=1;i<=teams.length;i++){
    const nx = (currentTeamIndex + i) % teams.length;
    if(currentRoundOfTeam[nx] < roundsPerTeam){
      currentTeamIndex = nx; break;
    }
  }
  if(roundQueue.length === 0 && wordsPool.length > 0) prepareRoundWords();
  el('game').classList.add('hidden');
  el('roundControl').classList.remove('hidden');
  updateRoundInfo();
  updateScores();
}

// end game
function endGame(){
  el('roundControl').classList.add('hidden');
  el('game').classList.add('hidden');
  el('roundResult').classList.add('hidden');

  let html = '<ol>';
  teams.forEach(t => html += `<li>${t.name}: ${t.score}</li>`);
  html += '</ol>';
  el('finalScores').innerHTML = html;
  el('final').classList.remove('hidden');
}

// controls
function enableControls(v){
  el('btnCorrect').disabled = !v;
  el('btnSkip').disabled = !v;
  el('btnDefine').disabled = !v;
}

// init
document.addEventListener('DOMContentLoaded', ()=>{
  el('btnLoadSample').addEventListener('click', ()=>{
    el('t1').value='تیم آبی'; el('t2').value='تیم قرمز'; el('t3').value='تیم سبز';
  });
  el('btnStart').addEventListener('click', ()=>{
    const n1 = el('t1').value.trim()||'تیم ۱';
    const n2 = el('t2').value.trim()||'تیم ۲';
    const n3 = el('t3').value.trim()||'تیم ۳';
    teams = [{name:n1,score:0},{name:n2,score:0},{name:n3,score:0}];
    resetState();
    el('setup').classList.add('hidden');
    el('roundControl').classList.remove('hidden');
    updateRoundInfo(); updateScores();
  });

  el('btnStartRound').addEventListener('click', startRound);
  el('btnCorrect').addEventListener('click', onCorrect);
  el('btnSkip').addEventListener('click', onSkip);
  el('btnDefine').addEventListener('click', onDefine);
  el('btnNextTeam').addEventListener('click', onNextTeam);
  el('btnStartNext').addEventListener('click', onStartNext);
  el('btnRestart').addEventListener('click', ()=>location.reload());
});
