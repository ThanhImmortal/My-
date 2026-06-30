// Mini game logic (client-only)
const sb = window.supabase.createClient(
  "https://dmltqhbhkzebbvggephy.supabase.co",
  "sb_publishable_G_yv1ynyBrTRiJkB_wkkPg_xt1YtcpR"
);
const adminInput = document.getElementById('adminInput');
const loadBtn = document.getElementById('loadBtn');
const clearBtn = document.getElementById('clearBtn');
const resetBtn = document.getElementById('resetBtn');
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
const adminPasswordInput = document.getElementById('adminPasswordInput');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const STORAGE_KEY = 'mini-game-state-v1';
const PROFILE_KEY = 'mini-game-profile-v1';

let currentUser = {role: null, name: null};
let autoSaveTimer = null;
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
    if (name){ const exists = players.some(p=>p.name===name); if(!exists){ addPlayer(name); }}
  }
  updateScoreboard();
  saveState();
}

function logout(){
  currentUser = {role:null,name:null};
  setAdminVisibility(false);
  loginBtn.style.display='inline-block'; logoutBtn.style.display='none';
  if (adminPasswordInput) adminPasswordInput.value = '';
  updateScoreboard();
  saveState();
}

function updateLoginControls(){
  if (adminPasswordInput) {
    adminPasswordInput.style.display = roleSelect && roleSelect.value === 'admin' ? 'inline-block' : 'none';
  }
}

roleSelect.addEventListener('change', updateLoginControls);

loginBtn.addEventListener('click', ()=>{
  const role = roleSelect.value; const name = loginName.value.trim() || (role==='admin' ? 'Admin' : 'Khách');
  if (role==='admin'){
    const pw = adminPasswordInput ? adminPasswordInput.value : '';
    if (!pw) { alert('Vui lòng nhập mật khẩu admin.'); return; }
    if (pw !== adminPassword){ alert('Mật khẩu không đúng.'); return; }
  }
  loginAs(role,name);
});
logoutBtn.addEventListener('click', ()=>{ logout(); });

// default: hide admin-only until admin logs in
setAdminVisibility(false);
updateLoginControls();

const DEFAULT_GAME_DATA = {
  grid: [
    'MDAODUCBAHG',
    'TRACHNHIEMI',
    'OCYBERDCEKA',
    'TOEUHHIHDQD',
    'HNUTIYUDGJI',
    'EGTKETNOIMN',
    'RNHHURUNKLH',
    'OGUETLTGOET',
    'JHOAHRACTQV',
    'EENOAFJAEXT',
    'POGVOCAMPBR',
    'POPCORNIEAP'
  ],
  answers: [
    'DAO DUC',
    'TRACH NHIEM',
    'GIA DINH',
    'CONG NGHE',
    'YEU THUONG',
    'HIEU THAO',
    'KET NOI',
    'VO CAM',
    'DONG CAM',
    'GIAO TIEP'
  ]
};

let game = {
  grid: [],
  answers: [] // canonical lower-case list
};

function saveState(){
  try {
    const payload = {
      adminInput: adminInput ? adminInput.value : '',
      answersInput: answersInput ? answersInput.value : '',
      game: { grid: game.grid, answers: game.answers },
      profile: {
        role: currentUser.role,
        name: currentUser.name,
        roleSelectValue: roleSelect ? roleSelect.value : 'guest',
        loginNameValue: loginName ? loginName.value : ''
      },
      players: players.map(p => ({ ...p, answers: [...(p.answers || [])] })),
      nextPlayerId,
      round: { active: round.active },
      roundTimerText: roundTimer.textContent
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(payload.profile));
  } catch (e) {}
}

function startAutoSave(){
  stopAutoSave();
  autoSaveTimer = setInterval(() => {
    saveState();
  }, 1000);
}

function stopAutoSave(){
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}

function loadSavedState(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const profileRaw = localStorage.getItem(PROFILE_KEY);
      if (profileRaw) {
        const profile = JSON.parse(profileRaw);
        if (profile) {
          currentUser = { role: profile.role || null, name: profile.name || null };
          if (roleSelect) roleSelect.value = profile.roleSelectValue || 'guest';
          if (loginName) loginName.value = profile.loginNameValue || '';
          return true;
        }
      }
      return false;
    }
    const data = JSON.parse(raw);
    if (data.adminInput !== undefined && adminInput) adminInput.value = data.adminInput;
    if (data.answersInput !== undefined && answersInput) answersInput.value = data.answersInput;
    if (data.game && Array.isArray(data.game.grid) && Array.isArray(data.game.answers)) {
      game.grid = data.game.grid;
      game.answers = data.game.answers;
    }
    if (data.profile) {
      currentUser = { role: data.profile.role || null, name: data.profile.name || null };
      if (roleSelect) roleSelect.value = data.profile.roleSelectValue || 'guest';
      if (loginName) loginName.value = data.profile.loginNameValue || '';
    } else if (data.currentUser) {
      currentUser = { role: data.currentUser.role || null, name: data.currentUser.name || null };
    }
    if (Array.isArray(data.players)) {
      players = data.players.map(p => ({ ...p, answers: [...(p.answers || [])] }));
      nextPlayerId = typeof data.nextPlayerId === 'number' ? data.nextPlayerId : players.length + 1;
      renderPlayersFromState();
    }
    if (data.round && data.round.active) {
      round.active = true;
      roundTimer.textContent = data.roundTimerText || 'Đang chơi';
      setPlayerInputsEnabled(true);
      startRoundClock();
    } else {
      round.active = false;
      stopRoundClock();
      roundTimer.textContent = 'Sẵn sàng';
      setPlayerInputsEnabled(false);
    }
    if (currentUser.role === 'admin') {
      setAdminVisibility(true);
      loginBtn.style.display='none'; logoutBtn.style.display='inline-block';
    } else if (currentUser.role === 'guest' || currentUser.name) {
      setAdminVisibility(false);
      loginBtn.style.display='none'; logoutBtn.style.display='inline-block';
    } else {
      setAdminVisibility(false);
      loginBtn.style.display='inline-block'; logoutBtn.style.display='none';
    }
    updateScoreboard();
    return true;
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

function getAnswerKey(text) {
  return normalizeAnswerText(text).split('').sort().join('');
}

function isAnswerMatch(input, answer) {
  const normalizedInput = normalizeAnswerText(input);
  const normalizedAnswer = normalizeAnswerText(answer);
  if (!normalizedInput || !normalizedAnswer) return false;

  if (normalizedInput === normalizedAnswer) return true;

  const keyInput = getAnswerKey(input);
  const keyAnswer = getAnswerKey(answer);
  if (!keyInput || !keyAnswer) return false;

  return keyInput === keyAnswer;
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
    .split(/\n|,|;|\||\//)
    .map(item => item.trim())
    .filter(Boolean);
}

function parseAdmin(text) {
  text = text.trim();
  if (!text) return {grid:[], answers:[]};
  try {
    const parsed = JSON.parse(text);
    if (parsed.grid && parsed.answers) {
      const rawAnswers = Array.isArray(parsed.answers)
        ? parsed.answers
        : String(parsed.answers).split(/\n|,|;|\||\//);
      return {
        grid: Array.isArray(parsed.grid) ? parsed.grid.map(r=>String(r)) : [],
        answers: rawAnswers.map(a=>String(a).trim()).filter(Boolean)
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

resetBtn.addEventListener('click', ()=>{
  if (confirm('Reset dữ liệu cũ và tải lại bảng mặc định?')) {
    localStorage.removeItem(STORAGE_KEY);
    adminInput.value = JSON.stringify(DEFAULT_GAME_DATA, null, 2);
    answersInput.value = DEFAULT_GAME_DATA.answers.join(', ');
    game.grid = DEFAULT_GAME_DATA.grid;
    game.answers = DEFAULT_GAME_DATA.answers;
    renderBoard();
    saveState();
    alert('Đã reset và tải lại bảng mặc định.');
  }
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
  const entryWrap = document.createElement('div'); entryWrap.className='answer-entry-block'; entryWrap.style.display='flex'; entryWrap.style.gap='8px'; entryWrap.style.alignItems='center';
  const answerEntry = document.createElement('input'); answerEntry.type='text'; answerEntry.placeholder='Nhập 1 đáp án và nhấn Enter'; answerEntry.style.flex='1'; answerEntry.disabled = true; answerEntry.className='player-answer-entry';
  const chipsWrap = document.createElement('div'); chipsWrap.className='answers-chips'; chipsWrap.style.display='flex'; chipsWrap.style.flexWrap='wrap'; chipsWrap.style.gap='6px'; chipsWrap.style.marginTop='8px';
  entryWrap.appendChild(answerEntry);
  card.appendChild(entryLabel);
  card.appendChild(entryWrap);
  card.appendChild(chipsWrap);

  // player answers array
  if (!Array.isArray(player.answers)) {
    player.answers = [];
  }

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
  updateScoreboard();
  saveState();
  return p;
}

let round = {active:false,endAt:0,intervalId:null};

function syncRoundTimers(){
  if (!players.length) {
    updateScoreboard();
    return;
  }

  players.forEach(p => {
    if (!p.startedAt || p.done) return;
    p.elapsed = Date.now() - p.startedAt;
    const card = document.getElementById(`player-${p.id}`);
    if (!card) return;
    const timerEl = card.querySelector('.timer');
    if (timerEl) timerEl.textContent = formatTime(p.elapsed || 0);
  });
  updateScoreboard();
}

function startRoundClock(){
  stopRoundClock();
  if (!round.active) return;
  round.intervalId = setInterval(syncRoundTimers, 200);
  syncRoundTimers();
}

function stopRoundClock(){
  if (round.intervalId) {
    clearInterval(round.intervalId);
    round.intervalId = null;
  }
}

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
  startRoundClock();
  updateScoreboard();
  saveState();
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
  p.elapsed = 0;
  timerSpan.textContent = '00:00.000';
  if (round.active) {
    startRoundClock();
  }
  updateScoreboard();
  saveState();
}

function submitPlayer(id){
  const p = players.find(x=>x.id===id); if(!p || p.done) return;
  if (p.startedAt) p.elapsed = Date.now() - p.startedAt; else p.elapsed = 0;
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
  fetch("https://script.google.com/macros/s/AKfycbzgM1ZAOUm-veVrvZuwbcsETrXUOL8da0CpFhp6hMSujYOGAz2IobbaX0H0QmNy3Xph/exec", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    player: p.name,
    score: p.score,
    time: p.elapsed
  })
})
.then(r => r.text())
.then(data => {
  console.log("Đã lưu Google Sheet:", data);
})
.catch(err => {
  console.error("Lỗi Google Sheet:", err);
});
  const card = document.getElementById(`player-${id}`);
  const entry = card.querySelector('.player-answer-entry'); if (entry) entry.disabled = true;
  const removeBtns = card.querySelectorAll('.answer-chip .remove'); removeBtns.forEach(b=>b.disabled=true);
  const title = card.querySelector('strong'); title.textContent = `${p.name} — Đã nộp`;
  updateScoreboard();
  saveState();
}

function renderPlayersFromState(){
  playersEl.innerHTML = '';
  players.forEach((p) => {
    const card = createPlayerCard(p);
    playersEl.appendChild(card);
    const timerEl = card.querySelector('.timer');
    if (timerEl) timerEl.textContent = (p.done || p.startedAt) ? formatTime(p.elapsed || 0) : '00:00.000';
    const entryEl = card.querySelector('.player-answer-entry');
    if (entryEl) entryEl.disabled = !(round.active && !p.done);
    const titleEl = card.querySelector('strong');
    if (titleEl && p.done) titleEl.textContent = `${p.name} — Đã nộp`;
  });
  updateScoreboard();
}

function updateScoreboard(){
  if (!scoreTableBody) return;

  const noteEl = document.getElementById('scoreboardNote');
  if (noteEl) {
    noteEl.textContent = currentUser.role === 'admin'
      ? 'Admin đang xem bảng xếp hạng chung của tất cả người chơi.'
      : 'Bảng xếp hạng của các người chơi trong phiên này.';
  }

  const visiblePlayers = [...players];
  if (currentUser.role === 'admin' && !visiblePlayers.some(p => p.name === currentUser.name)) {
    visiblePlayers.push({
      id: 'admin-view',
      name: currentUser.name || 'Admin',
      startedAt: null,
      elapsed: 0,
      score: 0,
      done: false,
      answers: []
    });
  }

  const ranked = visiblePlayers.sort((a,b)=>{
    const doneCompare = Number(b.done) - Number(a.done);
    if (doneCompare !== 0) return doneCompare;
    if (b.done && a.done) {
      if (b.score !== a.score) return b.score - a.score;
      return a.elapsed - b.elapsed;
    }
    if (a.startedAt && b.startedAt) return a.elapsed - b.elapsed;
    if (a.startedAt !== b.startedAt) return Number(!!b.startedAt) - Number(!!a.startedAt);
    return a.name.localeCompare(b.name);
  });

  scoreTableBody.innerHTML='';
  if (!ranked.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5" class="small">Chưa có người chơi nào</td>';
    scoreTableBody.appendChild(tr);
    return;
  }

  ranked.forEach((p,i)=>{
    let status = 'Chưa bắt đầu';
    if (p.done) status = 'Đã nộp';
    else if (p.startedAt) status = 'Đang chơi';

    const scoreText = p.done ? p.score : '—';
    const timeText = (p.done || p.startedAt) ? formatTime(p.elapsed || 0) : '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${p.name}</td><td>${scoreText}</td><td>${timeText}</td><td>${status}</td>`;
    scoreTableBody.appendChild(tr);
  });
}

window.addEventListener('beforeunload', saveState);
window.addEventListener('pagehide', saveState);

function initializeApp(){
  renderBoard();
  if (loadSavedState()) {
    renderBoard();
  } else {
    adminInput.value = JSON.stringify(DEFAULT_GAME_DATA, null, 2);
    answersInput.value = DEFAULT_GAME_DATA.answers.join(', ');
    game.grid = DEFAULT_GAME_DATA.grid;
    game.answers = DEFAULT_GAME_DATA.answers;
    renderBoard();
    saveState();
  }
  startAutoSave();
}

document.addEventListener('DOMContentLoaded', initializeApp);
