// Mini game logic (client-only)
const adminInput = document.getElementById('adminInput');
const loadBtn = document.getElementById('loadBtn');
const clearBtn = document.getElementById('clearBtn');
const boardEl = document.getElementById('board');
const answersInfo = document.getElementById('answersInfo');
const answersInput = document.getElementById('answersInput');
// player add handled via login
const playersEl = document.getElementById('players');
const scoreTableBody = document.querySelector('#scoreTable tbody');
const roundTimer = document.getElementById('roundTimer');
const DEFAULT_ROUND_SECS = 60;
const roleSelect = document.getElementById('roleSelect');
const loginName = document.getElementById('loginName');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const STORAGE_KEY = 'mini-game-state-v1';

let currentUser = {role: null, name: null};
// Simple local admin password (change as you like)
const adminPassword = 'admin123';
// removed activeComposerId and composer-based input; board clicks append to focused input

function setAdminVisibility(visible){
  document.querySelectorAll('.admin-only').forEach(el=>{
    el.style.display = visible ? '' : 'none';
  });
}

function loginAs(role, name){
  currentUser.role = role; currentUser.name = name || '';
  if (role==='admin'){
    setAdminVisibility(true);
    loginBtn.style.display='none'; logoutBtn.style.display='inline-block';
  } else {
    setAdminVisibility(false);
    loginBtn.style.display='none'; logoutBtn.style.display='inline-block';
    // if guest, prefill player name and auto-add player if not exists
    if (name){ const exists = players.some(p=>p.name===name); if(!exists){ addPlayer(name); }}
  }
}

function logout(){
  currentUser = {role:null,name:null};
  setAdminVisibility(false);
  loginBtn.style.display='inline-block'; logoutBtn.style.display='none';
}

loginBtn.addEventListener('click', ()=>{
  const role = roleSelect.value; const name = loginName.value.trim() || (role==='admin' ? 'Admin' : 'Khách');
  if (role==='admin'){
    const pw = prompt('Nhập mật khẩu admin:');
    if (pw !== adminPassword){ alert('Mật khẩu không đúng.'); return; }
  }
  loginAs(role,name);
});
logoutBtn.addEventListener('click', ()=>{ logout(); });

// default: hide admin-only until admin logs in
setAdminVisibility(false);

let game = {
  grid: [],
  answers: [] // canonical lower-case list
};

function saveState(){
  try {
    const payload = {
      adminInput: adminInput ? adminInput.value : '',
      answersInput: answersInput ? answersInput.value : '',
      game: { grid: game.grid, answers: game.answers }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {}
}

function loadSavedState(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.adminInput !== undefined && adminInput) adminInput.value = data.adminInput;
    if (data.answersInput !== undefined && answersInput) answersInput.value = data.answersInput;
    if (data.game && Array.isArray(data.game.grid) && Array.isArray(data.game.answers)) {
      game.grid = data.game.grid;
      game.answers = data.game.answers;
      return true;
    }
  } catch (e) {}
  return false;
}

function normalizeAnswerText(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeAnswerForDisplay(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|\s)([a-z])/g, (_, prefix, letter) => prefix + letter.toUpperCase());
}

function normalizeAnswerForComparison(text) {
  return normalizeAnswerText(text).split('').sort().join('');
}

function isAnswerMatch(input, answer) {
  const normalizedInput = normalizeAnswerText(input);
  const normalizedAnswer = normalizeAnswerText(answer);
  if (!normalizedInput || !normalizedAnswer) return false;
  if (normalizedInput === normalizedAnswer) return true;
  return normalizeAnswerForComparison(input) === normalizeAnswerForComparison(answer);
}

function parseAnswerList(text) {
  if (!text) return [];
  const trimmed = String(text).trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map(a => String(a).trim()).filter(Boolean);
    }
    if (parsed && Array.isArray(parsed.answers)) {
      return parsed.answers.map(a => String(a).trim()).filter(Boolean);
    }
  } catch (e) {}

  return trimmed
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(Boolean);
}

function parseAdmin(text) {
  text = text.trim();
  if (!text) return {grid:[], answers:[]};
  try {
    const parsed = JSON.parse(text);
    if (parsed.grid && parsed.answers) {
      return {
        grid: Array.isArray(parsed.grid) ? parsed.grid.map(r=>String(r)) : [],
        answers: Array.isArray(parsed.answers) ? parsed.answers.map(a=>String(a).trim()).filter(Boolean) : []
      };
    }
  } catch(e) {
    const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
    if (lines.length===0) return {grid:[], answers:[]};
    const last = lines[lines.length-1];
    if (last.includes(',') || last.split(/\s+/).length>1) {
      const maybeAnswers = parseAnswerList(lines.join('\n'));
      const grid = lines.slice(0, lines.length-1);
      return {grid, answers:maybeAnswers};
    }
    return {grid: lines, answers: []};
  }
  return {grid:[], answers:[]};
}

function renderBoard() {
  boardEl.innerHTML = '';
  if (!game.grid.length) {
    boardEl.textContent = 'Chưa có bảng. Hãy nạp dữ liệu từ Admin.';
    answersInfo.textContent = '';
    return;
  }
  game.grid.forEach(row => {
    const r = document.createElement('div'); r.className='row';
    for (let ch of row) {
      const cell = document.createElement('div'); cell.className='cell'; cell.textContent = ch;
      cell.dataset.letter = ch;
      cell.addEventListener('click', ()=>{ onBoardLetterClick(ch, cell); });
      r.appendChild(cell);
    }
    boardEl.appendChild(r);
  });
  answersInfo.textContent = '';
}

function onBoardLetterClick(letter, cellEl){
  if (!round.active) return;
  // Append to the currently focused player's input if any
  const activeEl = document.activeElement;
  if (activeEl && activeEl.classList && activeEl.classList.contains('player-answer-entry') && !activeEl.disabled){
    activeEl.value = activeEl.value + letter;
    activeEl.focus();
  }
}

// composer selection removed; board clicks append to focused input

adminInput.addEventListener('input', saveState);
answersInput.addEventListener('input', saveState);

loadBtn.addEventListener('click', ()=>{
  const parsed = parseAdmin(adminInput.value);
  game.grid = parsed.grid;
  game.answers = parsed.answers;
  renderBoard();
  saveState();
});

clearBtn.addEventListener('click', ()=>{
  adminInput.value=''; answersInput.value=''; game.grid=[]; game.answers=[]; renderBoard();
  saveState();
});

// Players management
let players = []; // {id,name,startedAt,intervalId,inputs,elapsed,score,done}
let nextPlayerId = 1;

function createPlayerCard(player) {
  const card = document.createElement('div'); card.className='player-card'; card.id=`player-${player.id}`;
  const title = document.createElement('div'); title.innerHTML = `<strong>${player.name}</strong> <span class="small">(#${player.id})</span>`;
  card.appendChild(title);

  const controls = document.createElement('div'); controls.className='player-controls';
  const startBtn = document.createElement('button'); startBtn.textContent='Start';
  const stopBtn = document.createElement('button'); stopBtn.textContent='Submit';
  const timerSpan = document.createElement('div'); timerSpan.className='timer'; timerSpan.textContent='00:00.000';
  controls.appendChild(startBtn); controls.appendChild(stopBtn); controls.appendChild(timerSpan);
  card.appendChild(controls);

  // (Use board removed) board clicks now append to the currently focused input

  // answer entry: single-answer input (press Enter to add), and chips list
  const entryLabel = document.createElement('div'); entryLabel.className='small'; entryLabel.style.marginTop='8px'; entryLabel.textContent = 'Nhập 1 đáp án rồi nhấn Enter';
  const entryWrap = document.createElement('div'); entryWrap.style.display='flex'; entryWrap.style.gap='8px'; entryWrap.style.alignItems='center';
  const answerEntry = document.createElement('input'); answerEntry.type='text'; answerEntry.placeholder='Nhập 1 đáp án và nhấn Enter'; answerEntry.style.flex='1'; answerEntry.disabled = true; answerEntry.className='player-answer-entry';
  const chipsWrap = document.createElement('div'); chipsWrap.className='answers-chips'; chipsWrap.style.display='flex'; chipsWrap.style.flexWrap='wrap'; chipsWrap.style.gap='6px'; chipsWrap.style.marginTop='8px';
  entryWrap.appendChild(answerEntry);
  card.appendChild(entryLabel);
  card.appendChild(entryWrap);
  card.appendChild(chipsWrap);

  // player answers array
  player.answers = [];

  // handle Enter: add one answer as chip
  answerEntry.addEventListener('keydown', (ev)=>{
    if (ev.key==='Enter'){
      ev.preventDefault();
      const val = answerEntry.value.trim();
      if (!val) return;
      addAnswerChip(player.id, val, card);
      answerEntry.value='';
    }
  });


function addAnswerChip(playerId, val, card){
  const p = players.find(x=>x.id===playerId); if(!p) return;
  // prevent duplicates (case-insensitive)
  const vnorm = String(val).trim(); if(!vnorm) return;
  if ((p.answers||[]).map(a=>a.toLowerCase()).includes(vnorm.toLowerCase())) return;
  p.answers.push(vnorm);
  if (!card) card = document.getElementById(`player-${playerId}`);
  const chipsWrap = card.querySelector('.answers-chips');
  const chip = document.createElement('span'); chip.className='answer-chip'; chip.dataset.value = vnorm;
  const textSpan = document.createElement('span'); textSpan.className='text'; textSpan.textContent = vnorm; textSpan.style.cursor='pointer';
  // allow click-to-edit
  textSpan.addEventListener('click', ()=>{
    if (!chip.isConnected) return;
    const entry = document.createElement('input'); entry.type='text'; entry.value = textSpan.textContent; entry.style.minWidth='80px';
    const finish = ()=>{
      const newVal = entry.value.trim();
      if (!newVal){ entry.remove(); textSpan.style.display=''; return; }
      // update in player.answers using chip.dataset.value (original)
      const original = chip.dataset.value;
      const idx = p.answers.findIndex(a=>a.toLowerCase()===String(original).toLowerCase());
      if (idx!==-1) p.answers[idx] = newVal;
      chip.dataset.value = newVal;
      textSpan.textContent = newVal; textSpan.style.display='';
      entry.remove();
    };
    entry.addEventListener('keydown',(e)=>{ if (e.key==='Enter'){ finish(); } });
    entry.addEventListener('blur', finish);
    chip.insertBefore(entry, textSpan); textSpan.style.display='none'; entry.focus();
  });
  const btn = document.createElement('button'); btn.className='remove'; btn.textContent='✕'; btn.title='Xóa'; btn.style.marginLeft='8px';
  btn.addEventListener('click', ()=>{
    // remove from p.answers and DOM using chip.dataset.value
    const key = chip.dataset.value;
    const idx = p.answers.findIndex(a=>a.toLowerCase()===String(key).toLowerCase()); if (idx!==-1) p.answers.splice(idx,1);
    chip.remove();
  });
  chip.appendChild(textSpan);
  chip.appendChild(btn);
  chipsWrap.appendChild(chip);
}
  // events
  startBtn.addEventListener('click', ()=>{ if (!round.active) startRound(); startPlayer(player.id, timerSpan); });
  stopBtn.addEventListener('click', ()=>submitPlayer(player.id));

  return card;
}

function addPlayer(name){
  const id = nextPlayerId++;
  const p = {id, name, startedAt:null, intervalId:null, inputs:[], elapsed:0, score:0, done:false, answers:[]};
  players.push(p);
  const card = createPlayerCard(p);
  playersEl.appendChild(card);
  return p;
}

let round = {active:false,endAt:0,intervalId:null};

// enable or disable all player input fields depending on round
function setPlayerInputsEnabled(enabled){
  players.forEach(p=>{
    const card = document.getElementById(`player-${p.id}`);
    if (!card) return;
    const entry = card.querySelector('.player-answer-entry'); if (entry) entry.disabled = !enabled;
    // disable remove buttons on chips by toggling attribute
    const removeBtns = card.querySelectorAll('.answer-chip .remove');
    removeBtns.forEach(b=>b.disabled = !enabled);
      // toggle per-card buttons but keep 'Start' enabled so players can begin
      card.querySelectorAll('button').forEach(b=>{
        if (b.textContent && b.textContent.trim()==='Start'){
          // Start should be enabled so player can start the round; once clicked their state changes
          b.disabled = false;
        } else {
          b.disabled = !enabled;
        }
      });
  });
}

function startRound(){
  if (round.active) return;
  const ansText = (answersInput && answersInput.value.trim()) || '';
  if (ansText) {
    game.answers = parseAnswerList(ansText);
  }
  // reset player answers UI
  document.querySelectorAll('.player-card').forEach(card=>{
    const id = parseInt(card.id.replace('player-',''),10);
    const p = players.find(x=>x.id===id);
    if (!p) return;
    p.answers = [];
    const chipsWrap = card.querySelector('.answers-chips'); if (chipsWrap) chipsWrap.innerHTML='';
    const entry = card.querySelector('.player-answer-entry'); if (entry) entry.value='';
    // clear any temporary state
    // no assembly boxes in simplified UI
  });

  // start an open-ended round: players start their own timers and submit when ready
  round.active = true;
  roundTimer.textContent = `Đang chơi`;
  setPlayerInputsEnabled(true);
}

// Play button removed; Start button of each player will start the round and that player's timer

// no global composer keyboard handling; Enter handled per-input, Backspace default behavior

function formatTime(ms){
  const s = Math.floor(ms/1000); const mm = Math.floor(s/60); const ss = s%60; const msRem = ms%1000;
  return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(msRem).padStart(3,'0')}`;
}

function startPlayer(id, timerSpan){
  const p = players.find(x=>x.id===id); if(!p || p.done) return;
  if (p.startedAt) return; // already started
  p.startedAt = Date.now();
  p.intervalId = setInterval(()=>{
    const now = Date.now(); p.elapsed = now - p.startedAt; timerSpan.textContent = formatTime(p.elapsed);
  }, 50);
}

function submitPlayer(id){
  const p = players.find(x=>x.id===id); if(!p || p.done) return;
  // stop timer
  if (p.intervalId) clearInterval(p.intervalId);
  if (p.startedAt) p.elapsed = Date.now() - p.startedAt; else p.elapsed = 0;
  // gather answers from player's recorded answers (chips)
  const answersGiven = (p.answers || []).map(a=>String(a).toLowerCase());

  const remainingAnswers = [...game.answers];
  let correct = 0;
  for (const submittedAnswer of answersGiven) {
    const matchIndex = remainingAnswers.findIndex(answer => isAnswerMatch(submittedAnswer, answer));
    if (matchIndex !== -1) {
      correct++;
      remainingAnswers.splice(matchIndex, 1);
    }
  }
  p.score = correct; p.done = true;
  // disable entry and chip remove buttons for this player
  const card = document.getElementById(`player-${id}`);
  const entry = card.querySelector('.player-answer-entry'); if (entry) entry.disabled = true;
  const removeBtns = card.querySelectorAll('.answer-chip .remove'); removeBtns.forEach(b=>b.disabled=true);
  // mark card
  const title = card.querySelector('strong'); title.textContent = `${p.name} — Đã nộp`;
  updateScoreboard();
}

function updateScoreboard(){
  // sort by score desc, time asc
  const ranked = [...players].filter(p=>p.done).sort((a,b)=>{
    if (b.score!==a.score) return b.score - a.score;
    return a.elapsed - b.elapsed;
  });
  scoreTableBody.innerHTML='';
  ranked.forEach((p,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${p.name}</td><td>${p.score}</td><td>${formatTime(p.elapsed)}</td>`;
    scoreTableBody.appendChild(tr);
  });
}

// initial render
renderBoard();

if (loadSavedState()) {
  renderBoard();
} else {
  // convenience: prefill sample data for quick demo
  adminInput.value = JSON.stringify({grid:['KYTA','ENOC','COWR','LIME'], answers:['KYT','ONE','ROW']}, null, 2);
  loadBtn.click();
}
