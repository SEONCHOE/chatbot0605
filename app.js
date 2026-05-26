/* ============================================================
   BABY LOG — app.js
   Vanilla JS, no dependencies, localStorage persistence
   ============================================================ */

'use strict';

// ── Constants ────────────────────────────────────────────────
const STORAGE_KEY = 'babylog_v1';

const TYPE_LABELS = {
  sleep: '수면', feed: '수유', pee: '소변',
  poop: '대변', cry: '울음', walk: '산책'
};
const TYPE_ICONS = {
  sleep: '😴', feed: '🍼', pee: '💧',
  poop: '💩', cry: '😢', walk: '🌿'
};
const CAT_LABELS = {
  vaccine: '예방접종', formula: '분유', solid: '이유식', other: '기타'
};

// ── Default State ────────────────────────────────────────────
function defaultState() {
  return {
    baby: null,           // { name, birthDate, gender }
    logs: {},             // { 'YYYY-MM-DD': [ logObj, … ] }
    todos: [],            // [ { id, text, category, completed, createdAt } ]
    health: {
      logs: [],           // [ { id, type, detail, temp, date, time } ]
      medications: []     // [ { id, name, dose, freq, note, date } ]
    },
    development: {}       // { 'milestone-id': true }
  };
}

// ── State & Storage ──────────────────────────────────────────
let STATE = defaultState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) STATE = Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { /* first launch */ }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE)); } catch (e) {}
}

// ── Utility helpers ──────────────────────────────────────────
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return localDateStr(new Date());
}

function fmtDateKey(date) {
  if (typeof date === 'string') return date;
  return localDateStr(date);
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtDisplayDate(dateStr) {
  const d = parseDate(dateStr);
  const days = ['일','월','화','수','목','금','토'];
  const today = todayStr();
  const label = dateStr === today ? ' (오늘)' :
                dateStr === shiftDate(today, -1) ? ' (어제)' : '';
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})${label}`;
}

function shiftDate(dateStr, delta) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + delta);
  return localDateStr(d);
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function hmToMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minToHM(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function fmtDuration(startHHMM, endHHMM) {
  let diff = hmToMin(endHHMM) - hmToMin(startHHMM);
  if (diff <= 0) diff += 1440;
  const h = Math.floor(diff / 60), m = diff % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getAgeInfo(birthDateStr) {
  if (!birthDateStr) return null;
  const birth = parseDate(birthDateStr);
  const now = new Date();
  const diffMs = now - birth;
  const diffDays = Math.floor(diffMs / 86400000);
  const weeks = Math.floor(diffDays / 7);
  const remDays = diffDays % 7;
  // months (approx)
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months--;
  if (months < 0) months = 0;
  const lastMonthDate = new Date(birth.getFullYear(), birth.getMonth() + months, birth.getDate());
  const monthRemDays = Math.floor((now - lastMonthDate) / 86400000);
  return { diffDays, weeks, remDays, months, monthRemDays };
}

// ── Toast ─────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ── Navigation ────────────────────────────────────────────────
let currentPage = 'home';

function navigate(page) {
  if (page === 'info') {
    window.location.href = '../youtube_trend/dist/index.html';
    return;
  }
  if (currentPage === page) return;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });
  document.getElementById(`page-${page}`).classList.add('active');
  const navBtn = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navBtn) { navBtn.classList.add('active'); navBtn.setAttribute('aria-current','page'); }
  currentPage = page;

  // Render page content
  if (page === 'home')      renderHome();
  if (page === 'timeline')  renderTimeline();
  if (page === 'schedule')  renderTodos();
  if (page === 'health')    renderHealth();
}

// ── Header ────────────────────────────────────────────────────
function updateHeader() {
  const nameEl  = document.getElementById('header-name');
  const ageEl   = document.getElementById('header-age');
  const dateEl  = document.getElementById('header-date');
  const avatarEl= document.getElementById('header-avatar');

  // date
  const d = new Date();
  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const days   = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
  dateEl.innerHTML = `${months[d.getMonth()]} ${d.getDate()}일<br>${days[d.getDay()]}`;

  if (!STATE.baby) { nameEl.textContent = '베이비'; ageEl.textContent = '정보 설정 필요'; return; }
  nameEl.textContent = STATE.baby.name;
  avatarEl.textContent = STATE.baby.gender === 'boy' ? '👦' : '👧';

  const ai = getAgeInfo(STATE.baby.birthDate);
  if (ai) {
    ageEl.textContent = ai.months < 1
      ? `D+${ai.diffDays} · ${ai.weeks}주 ${ai.remDays}일`
      : `D+${ai.diffDays} · ${ai.months}개월 ${ai.monthRemDays}일`;
  }
}

// ── HOME PAGE ─────────────────────────────────────────────────
function renderHome() {
  updateBabyHeroCard();
  renderHomeUpcoming();
  renderAlerts();
}

function getTodayLogs() {
  return (STATE.logs[todayStr()] || []);
}

function updateBabyHeroCard() {
  const heroAvatar = document.getElementById('hero-avatar');
  const heroName   = document.getElementById('hero-name');
  const heroPills  = document.getElementById('hero-pills');
  const bhsFeed    = document.getElementById('bhs-feed');
  const bhsSleep   = document.getElementById('bhs-sleep');
  const bhsDiaper  = document.getElementById('bhs-diaper');
  if (!heroAvatar) return;

  if (!STATE.baby) {
    heroName.textContent = '베이비';
    heroPills.innerHTML = '<span class="hero-pill">정보 설정 필요</span>';
    bhsFeed.textContent = bhsSleep.textContent = bhsDiaper.textContent = '—';
    return;
  }

  heroAvatar.textContent = STATE.baby.gender === 'boy' ? '👦' : '👧';
  heroName.textContent = STATE.baby.name;

  const ai = getAgeInfo(STATE.baby.birthDate);
  if (ai) {
    const ageText = ai.months < 1
      ? `D+${ai.diffDays} · ${ai.weeks}주 ${ai.remDays}일`
      : `${ai.months}개월 ${ai.monthRemDays}일`;
    heroPills.innerHTML =
      `<span class="hero-pill">${ageText}</span>` +
      `<span class="hero-pill">${STATE.baby.gender === 'girl' ? '👧 여아' : '👦 남아'}</span>`;
  }

  const logs = getTodayLogs();
  const feedCount = logs.filter(l => l.type === 'feed').length;
  let sleepMin = 0;
  logs.filter(l => l.type === 'sleep' && l.endTime).forEach(l => {
    let d = hmToMin(l.endTime) - hmToMin(l.startTime);
    if (d < 0) d += 1440;
    sleepMin += d;
  });
  const sh = Math.floor(sleepMin / 60), sm = sleepMin % 60;
  const diaperCount = logs.filter(l => l.type === 'pee' || l.type === 'poop').length;

  bhsFeed.textContent   = feedCount   || '—';
  bhsSleep.textContent  = sleepMin === 0 ? '—' : (sh > 0 ? `${sh}h ${sm}m` : `${sm}m`);
  bhsDiaper.textContent = diaperCount || '—';
}

function renderHomeUpcoming() {
  const container = document.getElementById('home-upcoming-list');
  if (!container) return;
  const open = (STATE.todos || []).filter(t => !t.completed).slice(0, 3);
  if (!open.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>스케줄에서 항목을 추가해보세요</p></div>`;
    return;
  }
  const catMeta = {
    vaccine: { icon: '💉', cls: 'cat-vaccine', label: '예방접종' },
    formula: { icon: '🍼', cls: 'cat-formula', label: '분유/수유' },
    solid:   { icon: '🥣', cls: 'cat-solid',   label: '이유식' },
    other:   { icon: '📌', cls: 'cat-other',   label: '기타' }
  };
  container.innerHTML = open.map(t => {
    const c = catMeta[t.category] || catMeta.other;
    return `<div class="upcoming-item">
      <div class="upcoming-cat-icon ${c.cls}">${c.icon}</div>
      <div class="upcoming-text">
        <div class="upcoming-title">${escHtml(t.text)}</div>
        <div class="upcoming-cat">${c.label}</div>
      </div>
    </div>`;
  }).join('');
}

function renderRecentLogs() {
  const container = document.getElementById('recent-logs-list');
  const allLogs = [];
  // collect from last 3 days
  for (let i = 0; i < 3; i++) {
    const dateKey = shiftDate(todayStr(), -i);
    (STATE.logs[dateKey] || []).forEach(l => allLogs.push({ ...l, dateKey }));
  }
  allLogs.sort((a,b) => {
    const ta = a.dateKey + ' ' + (a.startTime || a.time || '00:00');
    const tb = b.dateKey + ' ' + (b.startTime || b.time || '00:00');
    return tb.localeCompare(ta);
  });
  const recent = allLogs.slice(0, 6);

  if (recent.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>아직 기록이 없어요<br>위 버튼으로 첫 기록을 남겨보세요!</p></div>`;
    return;
  }
  container.innerHTML = recent.map(l => {
    const timeStr = l.startTime || l.time || '';
    let detail = TYPE_LABELS[l.type];
    if (l.type === 'feed' && l.amount) detail += ` ${l.amount}ml`;
    if (l.type === 'sleep' && l.endTime) detail += ` (${fmtDuration(l.startTime, l.endTime)})`;
    if (l.type === 'poop' && l.color) detail += ` · ${l.color}`;
    const note = l.note ? `<span class="log-note">${escHtml(l.note)}</span>` : '';
    return `<div class="log-item">
      <div class="log-dot ${l.type}"></div>
      <span class="log-time">${timeStr}</span>
      <span class="log-text">${TYPE_ICONS[l.type]} ${detail}</span>
      ${note}
    </div>`;
  }).join('');
}

function renderAlerts() {
  const container = document.getElementById('today-alerts');
  const alerts = [];

  if (STATE.baby) {
    const ai = getAgeInfo(STATE.baby.birthDate);
    if (ai) {
      // Vaccination reminders by month
      const vaccineAlerts = getVaccinationAlerts(ai.months, ai.diffDays);
      alerts.push(...vaccineAlerts);
      // Formula amount change
      const formulaAlert = getFormulaAlert(ai.months);
      if (formulaAlert) alerts.push(formulaAlert);
      // Solid food start
      if (ai.months >= 5 && ai.months <= 7) {
        alerts.push({ icon: '🥣', text: '이유식 시작 시기입니다! 챗봇에서 자세한 정보를 확인하세요.' });
      }
    }
  }

  if (alerts.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:12px"><div class="empty-icon" style="font-size:28px">🔕</div><p style="font-size:12px">오늘은 특별한 알림이 없어요</p></div>`;
    return;
  }
  container.innerHTML = alerts.slice(0, 3).map(a =>
    `<div class="alert-item"><span class="alert-icon">${a.icon}</span><span class="alert-text">${a.text}</span></div>`
  ).join('');
}

function getVaccinationAlerts(months, days) {
  const schedule = [
    { at: 0,  msg: '출생 시 BCG, B형간염 1차 접종이 필요해요' },
    { at: 1,  msg: 'B형간염 2차 접종 시기예요' },
    { at: 2,  msg: 'DTaP·폴리오·Hib·폐렴구균·로타 1차 접종 시기예요' },
    { at: 4,  msg: 'DTaP·폴리오·Hib·폐렴구균·로타 2차 접종 시기예요' },
    { at: 6,  msg: 'DTaP·폴리오·B형간염 3차 접종 시기예요' },
    { at: 12, msg: 'MMR·수두·Hib·폐렴구균 4차 접종 시기예요' },
    { at: 15, msg: 'DTaP 4차 접종 시기예요' },
    { at: 18, msg: 'A형간염 1차 접종 시기예요' }
  ];
  return schedule
    .filter(s => s.at === months)
    .map(s => ({ icon: '💉', text: s.msg }));
}

function getFormulaAlert(months) {
  const changes = [
    { at: 1,  msg: '분유량 90~120ml, 하루 6~7회로 늘려주세요' },
    { at: 2,  msg: '분유량 120~150ml로 늘려주세요' },
    { at: 3,  msg: '분유량 150~180ml로 늘려주세요' },
    { at: 4,  msg: '분유량 150~210ml, 하루 4~5회로 조절해요' },
    { at: 6,  msg: '이유식 시작과 함께 분유량을 서서히 줄여요' }
  ];
  const found = changes.find(c => c.at === months);
  return found ? { icon: '🍼', text: found.msg } : null;
}

// ── TIMELINE PAGE ─────────────────────────────────────────────
let timelineDate = todayStr();

function renderTimeline() {
  document.getElementById('timeline-date-display').textContent = fmtDisplayDate(timelineDate);
  buildTimeline();
}

function buildTimeline() {
  const axisEl = document.getElementById('tl-axis');
  const bodyEl = document.getElementById('tl-body');

  // Build hour axis & gridlines
  let axisHtml = '', bodyHtml = '';
  for (let h = 0; h < 24; h++) {
    const top = h * 60;
    const label = h === 0 ? '자정' : h < 12 ? `${h}시` : h === 12 ? '정오' : `${h}시`;
    axisHtml += `<div class="tl-hour-label" style="top:${top}px">${label}</div>`;
    bodyHtml += `<div class="tl-gridline" style="top:${top}px"></div>`;
  }

  // Current time line (only for today)
  if (timelineDate === todayStr()) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    bodyHtml += `<div class="tl-now-line" style="top:${nowMin}px"></div>`;
  }

  // Activity blocks
  const logs = (STATE.logs[timelineDate] || []);
  if (logs.length === 0) {
    bodyHtml += `<div class="tl-empty-msg"><div class="empty-icon">📅</div><p>이 날의 기록이 없어요<br>+ 버튼으로 추가해보세요</p></div>`;
  }

  logs.forEach(log => {
    const startMin = hmToMin(log.startTime || log.time || '00:00');
    let endMin = log.endTime ? hmToMin(log.endTime) : null;

    let top, height;
    if (endMin !== null) {
      let dur = endMin - startMin;
      if (dur <= 0) dur += 1440;
      top = startMin; height = Math.max(dur, 24);
    } else {
      top = startMin; height = 28;
    }

    let label = TYPE_ICONS[log.type] + ' ' + TYPE_LABELS[log.type];
    if (log.type === 'feed' && log.amount) label += ` ${log.amount}ml`;
    if (log.type === 'sleep' && log.endTime) label += ` (${fmtDuration(log.startTime, log.endTime)})`;
    if (log.type === 'walk' && log.endTime) label += ` (${fmtDuration(log.startTime, log.endTime)})`;

    bodyHtml += `<div class="tl-block ${log.type}"
      style="top:${top}px; height:${height}px;"
      data-id="${log.id}" title="${label}">
      ${height >= 28 ? label : TYPE_ICONS[log.type]}
    </div>`;
  });

  axisEl.innerHTML = axisHtml;
  bodyEl.innerHTML = bodyHtml;

  // Scroll to current time or 6am
  const wrapper = document.getElementById('timeline-scroll-wrapper');
  const scrollTarget = timelineDate === todayStr()
    ? Math.max(0, (new Date().getHours() * 60 + new Date().getMinutes()) - 120)
    : 6 * 60;
  setTimeout(() => wrapper.scrollTop = scrollTarget, 50);
}

// ── ADD LOG MODAL ─────────────────────────────────────────────
let currentLogType = 'sleep';

function openAddLog(type) {
  currentLogType = type || 'sleep';
  // set active tab
  document.querySelectorAll('.type-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.type === currentLogType);
  });
  renderLogForm(currentLogType);
  openModal('add-log-modal');
}

function renderLogForm(type) {
  const now = nowHHMM();
  const end = minToHM((hmToMin(now) + 60) % 1440);
  let html = '';

  if (type === 'sleep') {
    html = `
      <div class="time-row">
        <div class="form-group"><label>시작 시간</label><input type="time" id="lf-start" value="${now}"></div>
        <div class="form-group"><label>종료 시간</label><input type="time" id="lf-end" value="${end}"></div>
      </div>
      <div class="form-group"><label>메모</label><textarea id="lf-note" placeholder="특이사항을 입력하세요"></textarea></div>
      <button class="btn-primary btn-full" id="lf-save">😴 수면 기록 저장</button>`;
  } else if (type === 'feed') {
    html = `
      <div class="form-group"><label>수유 시간</label><input type="time" id="lf-time" value="${now}"></div>
      <div class="form-group"><label>수유량 (ml)</label><input type="number" id="lf-amount" placeholder="예: 120" min="0" max="500"></div>
      <div class="form-group">
        <label>수유 방법</label>
        <select id="lf-feedtype">
          <option value="분유">🍼 분유</option>
          <option value="모유">🤱 모유</option>
          <option value="혼합">💛 혼합</option>
        </select>
      </div>
      <div class="form-group"><label>메모</label><textarea id="lf-note" placeholder="특이사항을 입력하세요"></textarea></div>
      <button class="btn-primary btn-full" id="lf-save">🍼 수유 기록 저장</button>`;
  } else if (type === 'pee') {
    html = `
      <div class="form-group"><label>시간</label><input type="time" id="lf-time" value="${now}"></div>
      <div class="form-group"><label>메모</label><textarea id="lf-note" placeholder="특이사항을 입력하세요"></textarea></div>
      <button class="btn-primary btn-full" id="lf-save">💧 소변 기록 저장</button>`;
  } else if (type === 'poop') {
    html = `
      <div class="form-group"><label>시간</label><input type="time" id="lf-time" value="${now}"></div>
      <div class="form-group">
        <label>색상</label>
        <select id="lf-color">
          <option value="노란색">노란색 (정상)</option>
          <option value="황록색">황록색</option>
          <option value="갈색">갈색</option>
          <option value="검은색">검은색 (주의)</option>
          <option value="붉은색">붉은색 (주의)</option>
          <option value="흰색">흰색 (주의)</option>
        </select>
      </div>
      <div class="form-group"><label>메모</label><textarea id="lf-note" placeholder="특이사항을 입력하세요"></textarea></div>
      <button class="btn-primary btn-full" id="lf-save">💩 대변 기록 저장</button>`;
  } else if (type === 'cry') {
    html = `
      <div class="time-row">
        <div class="form-group"><label>시작 시간</label><input type="time" id="lf-start" value="${now}"></div>
        <div class="form-group"><label>종료 시간</label><input type="time" id="lf-end" value="${end}"></div>
      </div>
      <div class="form-group">
        <label>원인 (추정)</label>
        <select id="lf-reason">
          <option value="">알 수 없음</option>
          <option value="배고픔">배고픔</option>
          <option value="기저귀">기저귀</option>
          <option value="졸림">졸림</option>
          <option value="배앓이">배앓이</option>
          <option value="안아달라">안아달라</option>
        </select>
      </div>
      <div class="form-group"><label>메모</label><textarea id="lf-note" placeholder="특이사항을 입력하세요"></textarea></div>
      <button class="btn-primary btn-full" id="lf-save">😢 울음 기록 저장</button>`;
  } else if (type === 'walk') {
    html = `
      <div class="time-row">
        <div class="form-group"><label>출발 시간</label><input type="time" id="lf-start" value="${now}"></div>
        <div class="form-group"><label>귀가 시간</label><input type="time" id="lf-end" value="${end}"></div>
      </div>
      <div class="form-group"><label>메모</label><textarea id="lf-note" placeholder="날씨, 특이사항 등"></textarea></div>
      <button class="btn-primary btn-full" id="lf-save">🌿 산책 기록 저장</button>`;
  }

  document.getElementById('log-form-content').innerHTML = html;

  document.getElementById('lf-save').addEventListener('click', () => saveLog(currentLogType));
}

function saveLog(type) {
  const dateKey = currentPage === 'timeline' ? timelineDate : todayStr();
  const note = (document.getElementById('lf-note')?.value || '').trim();
  let log = { id: uid(), type, date: dateKey, note };

  if (type === 'sleep' || type === 'cry' || type === 'walk') {
    const start = document.getElementById('lf-start')?.value;
    const end   = document.getElementById('lf-end')?.value;
    if (!start) { showToast('시작 시간을 입력해주세요'); return; }
    log.startTime = start;
    if (end) log.endTime = end;
  } else {
    const t = document.getElementById('lf-time')?.value;
    if (!t) { showToast('시간을 입력해주세요'); return; }
    log.time = t; log.startTime = t;
  }

  if (type === 'feed') {
    log.amount   = parseInt(document.getElementById('lf-amount')?.value || 0) || null;
    log.feedType = document.getElementById('lf-feedtype')?.value || '분유';
  }
  if (type === 'poop') {
    log.color = document.getElementById('lf-color')?.value || '';
  }
  if (type === 'cry') {
    log.reason = document.getElementById('lf-reason')?.value || '';
  }

  if (!STATE.logs[dateKey]) STATE.logs[dateKey] = [];
  STATE.logs[dateKey].push(log);
  // sort by startTime
  STATE.logs[dateKey].sort((a,b) => (a.startTime||a.time||'').localeCompare(b.startTime||b.time||''));
  saveState();

  closeModal('add-log-modal');
  showToast(`${TYPE_ICONS[type]} ${TYPE_LABELS[type]} 기록이 저장됐어요!`);

  if (currentPage === 'home')     renderHome();
  if (currentPage === 'timeline') buildTimeline();
}

// ── SCHEDULE / TODO ───────────────────────────────────────────
let todoFilter = 'all';

function renderTodos(filter) {
  if (filter !== undefined) todoFilter = filter;

  const list = document.getElementById('todo-list');
  const emptyEl = document.getElementById('todo-empty');
  const filtered = todoFilter === 'all'
    ? STATE.todos
    : STATE.todos.filter(t => t.category === todoFilter);

  // Update category tab active state
  document.querySelectorAll('.cat-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.cat === todoFilter);
  });

  // Remove existing todo items (preserve empty state placeholder)
  list.querySelectorAll('.todo-item').forEach(el => el.remove());

  if (filtered.length === 0) {
    emptyEl.style.display = '';
    return;
  }
  emptyEl.style.display = 'none';

  // Sort: incomplete first, then by createdAt desc
  const sorted = [...filtered].sort((a,b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return b.createdAt - a.createdAt;
  });

  sorted.forEach(todo => {
    const el = document.createElement('div');
    el.className = `todo-item${todo.completed ? ' completed' : ''}`;
    el.dataset.id = todo.id;
    el.setAttribute('role', 'listitem');
    el.innerHTML = `
      <div class="todo-check${todo.completed ? ' checked' : ''}" data-check="${todo.id}" aria-label="${todo.completed ? '완료 취소' : '완료 처리'}">
        ${todo.completed ? '✓' : ''}
      </div>
      <div class="todo-info">
        <div class="todo-text">${escHtml(todo.text)}</div>
        <div class="todo-meta">
          <span class="todo-badge badge-${todo.category}">${CAT_LABELS[todo.category]}</span>
          <button class="todo-ask-btn" data-ask="${todo.category}" aria-label="챗봇에게 묻기">💬 챗봇에게 묻기</button>
        </div>
      </div>
      <div class="todo-actions">
        <button class="todo-delete-btn" data-delete="${todo.id}" aria-label="삭제">✕</button>
      </div>`;
    list.insertBefore(el, emptyEl);
  });
}

function addTodo(text, category) {
  const trimmed = text.trim();
  if (!trimmed) { showToast('내용을 입력해주세요'); return; }
  const todo = { id: uid(), text: trimmed, category, completed: false, createdAt: Date.now() };
  STATE.todos.unshift(todo);
  saveState();
  renderTodos();
  showToast('✅ 항목이 추가됐어요!');
}

function toggleTodo(id) {
  const t = STATE.todos.find(t => t.id === id);
  if (!t) return;
  t.completed = !t.completed;
  saveState();

  const el = document.querySelector(`.todo-item[data-id="${id}"]`);
  if (el) {
    el.classList.toggle('completed', t.completed);
    const check = el.querySelector('.todo-check');
    if (check) {
      check.classList.toggle('checked', t.completed);
      check.textContent = t.completed ? '✓' : '';
    }
    const textEl = el.querySelector('.todo-text');
    if (textEl) textEl.style.textDecoration = t.completed ? 'line-through' : '';
  }
  showToast(t.completed ? '✓ 완료 처리됐어요!' : '↩ 완료가 취소됐어요');
}

function deleteTodo(id) {
  const el = document.querySelector(`.todo-item[data-id="${id}"]`);
  if (el) {
    el.classList.add('removing');
    setTimeout(() => {
      STATE.todos = STATE.todos.filter(t => t.id !== id);
      saveState();
      renderTodos();
    }, 300);
  }
}

// ── HEALTH PAGE ───────────────────────────────────────────────
let currentHTab = 'development';

function renderHealth() {
  if (currentHTab === 'development') renderDevelopment();
  else if (currentHTab === 'logs')   renderHealthLogs();
  else if (currentHTab === 'medication') renderMedication();
}

function switchHTab(tab) {
  currentHTab = tab;
  document.querySelectorAll('.h-tab').forEach(t => t.classList.toggle('active', t.dataset.htab === tab));
  document.querySelectorAll('.h-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`${tab === 'development' ? 'dev' : tab}-tab`).classList.add('active');
  renderHealth();
}

function renderDevelopment() {
  const banner = document.getElementById('dev-age-banner');
  const listEl = document.getElementById('milestone-list');

  if (!STATE.baby) {
    banner.innerHTML = '<h3>아기 정보를 설정해주세요</h3>';
    listEl.innerHTML = '';
    return;
  }
  const ai = getAgeInfo(STATE.baby.birthDate);
  if (!ai) return;

  banner.innerHTML = `
    <h3>현재 ${ai.months}개월 (${ai.weeks}주)</h3>
    <p>${STATE.baby.name}${koreanParticle(STATE.baby.name, '이의', '의')} 발달 체크리스트예요</p>
    ${makeExternalLinks(ai.months + '개월 아기 발달 장난감')}`;

  const milestones = getMilestones(ai.months);
  let html = '';
  milestones.forEach(group => {
    html += `<div class="milestone-group" role="group" aria-label="${group.title}">
      <div class="milestone-group-title">${group.icon} ${group.title}</div>`;
    group.items.forEach(item => {
      const checked = STATE.development[item.id] || false;
      html += `<div class="milestone-item" role="listitem" data-milestone="${item.id}" aria-checked="${checked}" tabindex="0">
        <div class="milestone-check${checked ? ' done' : ''}" aria-hidden="true">${checked ? '✓' : ''}</div>
        <span class="milestone-text">${item.text}</span>
      </div>`;
    });
    html += '</div>';
  });
  if (!html) html = '<div class="empty-state"><div class="empty-icon">🌱</div><p>현재 연령의 발달 체크리스트를<br>준비 중이에요</p></div>';
  listEl.innerHTML = html;
}

function getMilestones(months) {
  const m = months;
  const all = [
    {
      minM: 0, maxM: 1,
      title: '1개월 미만', icon: '🌱',
      items: [
        { id: 'ms_01_1', text: '빛과 소리에 반응해요' },
        { id: 'ms_01_2', text: '엎드리면 고개를 살짝 들어요' },
        { id: 'ms_01_3', text: '울음으로 의사를 표현해요' },
        { id: 'ms_01_4', text: '엄마 목소리를 알아들어요' }
      ]
    },
    {
      minM: 1, maxM: 3,
      title: '1~2개월', icon: '😊',
      items: [
        { id: 'ms_12_1', text: '사회적 미소가 시작돼요' },
        { id: 'ms_12_2', text: '목을 더 오래 들 수 있어요' },
        { id: 'ms_12_3', text: '소리에 고개를 돌려요' },
        { id: 'ms_12_4', text: '옹알이가 시작돼요' }
      ]
    },
    {
      minM: 3, maxM: 5,
      title: '3~4개월', icon: '🙌',
      items: [
        { id: 'ms_34_1', text: '목을 잘 가눠요 (목 가누기 완성)' },
        { id: 'ms_34_2', text: '손을 쥐었다 폈다 해요' },
        { id: 'ms_34_3', text: '소리 내어 웃어요 (웃음 소리)' },
        { id: 'ms_34_4', text: '물체를 눈으로 추적해요' },
        { id: 'ms_34_5', text: '뒤집기를 시도해요 (배→등)' }
      ]
    },
    {
      minM: 5, maxM: 7,
      title: '5~6개월', icon: '🤸',
      items: [
        { id: 'ms_56_1', text: '양방향 뒤집기가 돼요' },
        { id: 'ms_56_2', text: '장난감을 손으로 집어요' },
        { id: 'ms_56_3', text: '이름을 부르면 반응해요' },
        { id: 'ms_56_4', text: '도움 없이 잠깐 앉을 수 있어요' },
        { id: 'ms_56_5', text: '자음을 포함한 옹알이를 해요' }
      ]
    },
    {
      minM: 7, maxM: 10,
      title: '7~9개월', icon: '🧗',
      items: [
        { id: 'ms_79_1', text: '혼자서 앉을 수 있어요' },
        { id: 'ms_79_2', text: '기기 시작해요' },
        { id: 'ms_79_3', text: '낯선 사람을 경계해요 (낯가림)' },
        { id: 'ms_79_4', text: '가구를 잡고 서려 해요' },
        { id: 'ms_79_5', text: '짝짜꿍, 빠이빠이를 따라 해요' }
      ]
    },
    {
      minM: 10, maxM: 12,
      title: '10~11개월', icon: '🚶',
      items: [
        { id: 'ms_1012_1', text: '잡고 일어서요' },
        { id: 'ms_1012_2', text: '집게 잡기가 돼요 (엄지+검지)' },
        { id: 'ms_1012_3', text: '첫 단어가 나와요 (엄마, 아빠 등)' },
        { id: 'ms_1012_4', text: '짝짜꿍, 까꿍 게임을 즐겨요' },
        { id: 'ms_1012_5', text: '손가락으로 원하는 것을 가리켜요' }
      ]
    },
    {
      minM: 12, maxM: 18,
      title: '12~15개월', icon: '🌟',
      items: [
        { id: 'ms_1215_1', text: '혼자 서 있을 수 있어요' },
        { id: 'ms_1215_2', text: '첫 걸음마를 시작해요' },
        { id: 'ms_1215_3', text: '컵으로 물을 마셔요' },
        { id: 'ms_1215_4', text: '3~5개 단어를 사용해요' },
        { id: 'ms_1215_5', text: '간단한 지시를 이해해요' }
      ]
    },
    {
      minM: 18, maxM: 25,
      title: '18~24개월', icon: '🏃',
      items: [
        { id: 'ms_1824_1', text: '뛰기 시작해요' },
        { id: 'ms_1824_2', text: '두 단어를 조합해요 (엄마 줘, 아빠 가)' },
        { id: 'ms_1824_3', text: '계단을 기어오르거나 올라가요' },
        { id: 'ms_1824_4', text: '20개 이상의 단어를 사용해요' },
        { id: 'ms_1824_5', text: '혼자 숟가락을 사용해요' }
      ]
    }
  ];

  return all.filter(g => m >= g.minM && m < g.maxM);
}

function renderHealthLogs() {
  const container = document.getElementById('health-logs-list');
  const logs = STATE.health.logs;
  if (!logs || logs.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🌡️</div><p>건강 기록이 없어요<br>체온, 피부 발진 등을 기록해보세요</p></div>`;
    return;
  }
  const sorted = [...logs].sort((a,b) => (b.date + b.time).localeCompare(a.date + a.time));
  container.innerHTML = sorted.map(l => `
    <div class="health-log-item" role="listitem">
      <span class="hl-badge ${l.type}">${hlBadgeLabel(l.type)}</span>
      <div>
        <div class="hl-detail">${escHtml(l.detail)}</div>
        <div class="hl-time">${l.date} ${l.time}</div>
      </div>
    </div>`).join('');
}

function hlBadgeLabel(type) {
  return { temp:'체온', rash:'피부', symptom:'증상', other:'기타' }[type] || type;
}

function renderMedication() {
  const container = document.getElementById('medication-list');
  const meds = STATE.health.medications;
  if (!meds || meds.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">💊</div><p>복약 정보가 없어요<br>처방된 약 정보를 기록해보세요</p></div>`;
    return;
  }
  const sorted = [...meds].sort((a,b) => b.date.localeCompare(a.date));
  container.innerHTML = sorted.map(m => `
    <div class="med-item" role="listitem">
      <div class="med-name">💊 ${escHtml(m.name)}</div>
      <div class="med-detail">
        ${m.dose ? `${escHtml(m.dose)} · ` : ''}${m.freq ? escHtml(m.freq) : ''}
        ${m.note ? ` · ${escHtml(m.note)}` : ''}
        <span style="margin-left:4px;color:var(--text-light);font-size:11px">${m.date}</span>
      </div>
    </div>`).join('');
}

// Health log modal
function openHealthModal(type) {
  const titleEl = document.getElementById('health-modal-title');
  const formEl  = document.getElementById('health-log-form');
  const now = nowHHMM();
  const today = todayStr();

  if (type === 'health') {
    titleEl.textContent = '건강 기록 추가';
    formEl.innerHTML = `
      <div class="form-group">
        <label>기록 유형</label>
        <select id="hf-type">
          <option value="temp">🌡️ 체온</option>
          <option value="rash">🔴 피부 발진</option>
          <option value="symptom">😷 증상</option>
          <option value="other">📝 기타</option>
        </select>
      </div>
      <div class="form-group"><label>상세 내용</label><textarea id="hf-detail" placeholder="예: 37.8℃, 좌측 뺨에 발진 등" rows="3"></textarea></div>
      <div class="time-row">
        <div class="form-group"><label>날짜</label><input type="date" id="hf-date" value="${today}"></div>
        <div class="form-group"><label>시간</label><input type="time" id="hf-time" value="${now}"></div>
      </div>
      <button class="btn-primary btn-full" id="hf-save">저장</button>`;
    document.getElementById('hf-save').addEventListener('click', () => {
      const detail = document.getElementById('hf-detail').value.trim();
      if (!detail) { showToast('내용을 입력해주세요'); return; }
      if (!STATE.health.logs) STATE.health.logs = [];
      STATE.health.logs.push({
        id: uid(), type: document.getElementById('hf-type').value,
        detail, date: document.getElementById('hf-date').value,
        time: document.getElementById('hf-time').value
      });
      saveState(); closeModal('health-log-modal');
      showToast('🌡️ 건강 기록이 저장됐어요!');
      renderHealthLogs();
    });
  } else if (type === 'medication') {
    titleEl.textContent = '복약 정보 추가';
    formEl.innerHTML = `
      <div class="form-group"><label>약 이름</label><input type="text" id="hf-medname" placeholder="예: 타이레놀 시럽, 훼스탈 등"></div>
      <div class="time-row">
        <div class="form-group"><label>1회 용량</label><input type="text" id="hf-dose" placeholder="예: 5ml"></div>
        <div class="form-group"><label>복용 횟수</label><input type="text" id="hf-freq" placeholder="예: 하루 3회"></div>
      </div>
      <div class="form-group"><label>메모</label><textarea id="hf-note" placeholder="처방병원, 복약 목적 등"></textarea></div>
      <div class="form-group"><label>처방일</label><input type="date" id="hf-date" value="${today}"></div>
      <button class="btn-primary btn-full" id="hf-save">저장</button>`;
    document.getElementById('hf-save').addEventListener('click', () => {
      const name = document.getElementById('hf-medname').value.trim();
      if (!name) { showToast('약 이름을 입력해주세요'); return; }
      if (!STATE.health.medications) STATE.health.medications = [];
      STATE.health.medications.push({
        id: uid(), name,
        dose: document.getElementById('hf-dose').value.trim(),
        freq: document.getElementById('hf-freq').value.trim(),
        note: document.getElementById('hf-note').value.trim(),
        date: document.getElementById('hf-date').value
      });
      saveState(); closeModal('health-log-modal');
      showToast('💊 복약 정보가 저장됐어요!');
      renderMedication();
    });
  }
  openModal('health-log-modal');
}

// ── CHATBOT ───────────────────────────────────────────────────
let botReady = false;

function initChat() {
  if (botReady) return;
  botReady = true;
  addBotMessage('안녕하세요! 👋\n베이비케어 도우미예요.\n예방접종, 이유식, 분유량, 발달 등 궁금한 것을 무엇이든 물어보세요!');
}

function addUserMessage(text) {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg user';
  div.innerHTML = `<div class="msg-bubble">${escHtml(text)}</div>`;
  msgs.appendChild(div);
  scrollChat();
}

function addBotMessage(html) {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.innerHTML = `<div class="msg-avatar">🤱</div><div class="msg-bubble">${html}</div>`;
  msgs.appendChild(div);
  scrollChat();
}

function showTyping() {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.id = 'typing-indicator';
  div.innerHTML = `<div class="msg-avatar">🤱</div><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  msgs.appendChild(div);
  scrollChat();
}

function removeTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function scrollChat() {
  const msgs = document.getElementById('chat-messages');
  setTimeout(() => msgs.scrollTop = msgs.scrollHeight, 30);
}

function sendChatMessage(text) {
  if (!text.trim()) return;
  document.getElementById('chat-input').value = '';
  addUserMessage(text);
  showTyping();
  setTimeout(() => {
    removeTyping();
    const response = getBotResponse(text);
    addBotMessage(response);
  }, 800 + Math.random() * 400);
}

function getBotResponse(text) {
  const t = text.toLowerCase();
  const babyMonths = STATE.baby ? (getAgeInfo(STATE.baby.birthDate)?.months ?? null) : null;
  const babyName   = STATE.baby?.name || '아기';

  // ── 예방접종 ─────────────────────────────────────────────
  if (t.includes('예방접종') || t.includes('접종') || t.includes('백신') || t.includes('bcg') || t.includes('dtap')) {
    if (t.includes('bcg') || t.includes('결핵')) {
      return `<h4>💉 BCG (결핵) 접종</h4>
<ul>
<li><strong>접종 시기:</strong> 출생 후 4주 이내 권장</li>
<li><strong>접종 방법:</strong> 피내 주사 (왼쪽 팔 위쪽)</li>
<li><strong>비용:</strong> 국가 필수 – 무료</li>
<li><strong>부작용:</strong> 접종 부위 흉터 (2~3개월 내 형성)</li>
</ul>
<strong>💡 팁:</strong> 접종 후 2~3주 뒤 작은 붉은 혹이 생기는 것은 정상이에요.`;
    }
    if (t.includes('로타') || t.includes('rota')) {
      return `<h4>💉 로타바이러스 접종</h4>
<ul>
<li><strong>로타릭스 (2가):</strong> 2, 4개월 (2회)</li>
<li><strong>로타텍 (5가):</strong> 2, 4, 6개월 (3회)</li>
<li><strong>비용:</strong> 선택 접종 – 유료 (병원마다 다름)</li>
<li><strong>접종 방법:</strong> 경구 복용 (먹는 백신)</li>
</ul>
<strong>💡 팁:</strong> 두 종류를 섞어서 맞으면 안 되고, 처음 맞은 종류로 끝까지 맞춰야 해요.`;
    }
    // General vaccine schedule
    return `<h4>💉 국가 필수 예방접종 일정</h4>
<table>
<tr><th>시기</th><th>접종 종류</th></tr>
<tr><td>출생~4주</td><td>BCG (결핵), B형간염 1차</td></tr>
<tr><td>1개월</td><td>B형간염 2차</td></tr>
<tr><td>2개월</td><td>DTaP·폴리오·Hib·폐렴구균·로타 1차</td></tr>
<tr><td>4개월</td><td>DTaP·폴리오·Hib·폐렴구균·로타 2차</td></tr>
<tr><td>6개월</td><td>DTaP·폴리오·B형간염 3차, 로타 3차(로타텍)</td></tr>
<tr><td>12~15개월</td><td>MMR·수두·Hib 4차·폐렴구균 4차</td></tr>
<tr><td>12~23개월</td><td>A형간염 1·2차, 일본뇌염</td></tr>
<tr><td>15~18개월</td><td>DTaP 4차</td></tr>
<tr><td>4~6세</td><td>DTaP 5차, 폴리오 4차, MMR 2차</td></tr>
</table>
${babyMonths !== null ? `<br><strong>${babyName}이는 현재 ${babyMonths}개월</strong>이에요. 위 표에서 해당 시기를 확인해보세요!` : ''}
<br>💡 예방접종 도우미: <strong>질병관리청 예방접종도우미 앱</strong>에서 접종 내역을 확인·관리할 수 있어요.`;
  }

  // ── 이유식 ────────────────────────────────────────────────
  if (t.includes('이유식') || t.includes('이유') || t.includes('solid') || t.includes('레시피') || t.includes('처음 먹')) {
    if (t.includes('레시피') || t.includes('만들')) {
      return `<h4>🥣 초기 이유식 기본 레시피</h4>
<strong>쌀미음 (생후 6개월~)</strong>
<ul>
<li>쌀 10g + 물 100ml</li>
<li>쌀을 30분 불린 후 믹서에 갈기</li>
<li>냄비에 약불로 저어가며 10분 익히기</li>
<li>체에 걸러 부드럽게 완성</li>
</ul>
<strong>단호박 미음</strong>
<ul>
<li>단호박 20g (껍질 제거) + 쌀미음</li>
<li>단호박을 쪄서 체에 거른 후 쌀미음에 섞기</li>
</ul>
<strong>💡 주의:</strong> 한 가지 재료를 3~4일 먹여 알레르기 반응을 확인하세요!`;
    }
    if (t.includes('시작') || t.includes('언제')) {
      return `<h4>🥣 이유식 시작 시기</h4>
<ul>
<li><strong>WHO 권장:</strong> 생후 <strong>6개월</strong>부터 시작</li>
<li><strong>최소:</strong> 4개월 이전에는 절대 시작하지 않아요</li>
</ul>
<strong>이유식 시작 신호:</strong>
<ul>
<li>✅ 목을 잘 가눠요</li>
<li>✅ 도움 받아 앉을 수 있어요</li>
<li>✅ 음식에 관심을 보여요</li>
<li>✅ 혀로 음식을 밀어내지 않아요</li>
</ul>
<strong>단계별 가이드:</strong>
<ul>
<li>📌 <strong>초기 (6~7개월):</strong> 쌀미음, 채소 미음 — 한 가지씩 3~4일</li>
<li>📌 <strong>중기 (7~9개월):</strong> 으깬 채소+고기, 2~3가지 혼합</li>
<li>📌 <strong>후기 (9~11개월):</strong> 무른밥, 손가락 음식 도입</li>
<li>📌 <strong>완료기 (12개월~):</strong> 어른 음식과 비슷하게</li>
</ul>
${babyMonths !== null ? `<br>💡 <strong>${babyName}이는 ${babyMonths}개월</strong>이에요. ${babyMonths >= 6 ? '이유식을 시작할 수 있는 시기예요!' : `약 ${6 - babyMonths}개월 후 이유식을 시작하면 돼요.`}` : ''}`;
    }
    return `<h4>🥣 이유식 기초 가이드</h4>
<strong>초기 이유식 (6~7개월)</strong>
<ul>
<li>묽은 미음 형태 (쌀:물 = 1:10)</li>
<li>하루 1~2회, 처음엔 1~2 숟가락</li>
<li>새 재료는 3~4일 간격으로 도입</li>
</ul>
<strong>중기 이유식 (7~9개월)</strong>
<ul>
<li>죽 형태 (쌀:물 = 1:7)</li>
<li>하루 2회, 60~120ml</li>
<li>고기 (닭, 소) 반드시 포함</li>
</ul>
<strong>후기 이유식 (9~12개월)</strong>
<ul>
<li>무른밥 (쌀:물 = 1:5)</li>
<li>하루 3회, 120~180ml</li>
<li>손가락 음식 시도</li>
</ul>
<strong>⚠️ 첫 돌 전 주의 식품:</strong> 꿀, 생우유, 견과류, 갑각류`;
  }

  // ── 분유 ──────────────────────────────────────────────────
  if (t.includes('분유') || t.includes('수유량') || t.includes('수유 횟수') || t.includes('얼마나 줘')) {
    return `<h4>🍼 월령별 분유량 가이드</h4>
<table>
<tr><th>월령</th><th>1회 수유량</th><th>하루 횟수</th></tr>
<tr><td>0~1개월</td><td>60~90ml</td><td>7~8회</td></tr>
<tr><td>1~2개월</td><td>90~120ml</td><td>6~7회</td></tr>
<tr><td>2~3개월</td><td>120~150ml</td><td>5~6회</td></tr>
<tr><td>3~4개월</td><td>150~180ml</td><td>5회</td></tr>
<tr><td>4~6개월</td><td>150~210ml</td><td>4~5회</td></tr>
<tr><td>6개월~</td><td>이유식 병행, 서서히 감소</td><td>3~4회</td></tr>
</table>
${babyMonths !== null ? formulaAdvice(babyMonths, babyName) : ''}
<br>💡 <strong>적정 수유량 공식:</strong> 체중(kg) × 150~200ml = 하루 총 수유량`;
  }

  // ── 모유 ──────────────────────────────────────────────────
  if (t.includes('모유') || t.includes('모유수유') || t.includes('젖')) {
    return `<h4>🤱 모유수유 가이드</h4>
<ul>
<li><strong>수유 빈도:</strong> 생후 초기 2~3시간마다 (하루 8~12회)</li>
<li><strong>수유 시간:</strong> 한 쪽 10~20분, 양쪽 번갈아가며</li>
<li><strong>배고픔 신호:</strong> 빠는 행동, 입 움직임, 손을 빠는 것 → 울기 전에 수유하세요</li>
<li><strong>충분한 수유 확인:</strong> 하루 소변 6회 이상, 체중 증가</li>
</ul>
<strong>모유 보관:</strong>
<ul>
<li>실온: 4시간 이내</li>
<li>냉장: 3~5일</li>
<li>냉동: 3~6개월</li>
</ul>`;
  }

  // ── 수면 ──────────────────────────────────────────────────
  if (t.includes('수면') || t.includes('잠') || t.includes('수면 교육') || t.includes('통잠') || t.includes('밤중 수유')) {
    if (t.includes('교육') || t.includes('통잠')) {
      return `<h4>😴 수면 교육 가이드</h4>
<strong>월령별 수면 시간:</strong>
<ul>
<li>0~3개월: 총 14~17시간 (불규칙)</li>
<li>4~6개월: 총 12~16시간, 밤 통잠 가능</li>
<li>6~12개월: 총 12~14시간, 낮잠 2~3회</li>
<li>1~2세: 총 11~14시간, 낮잠 1~2회</li>
</ul>
<strong>수면 환경 만들기:</strong>
<ul>
<li>✅ 일정한 수면 루틴 (목욕 → 수유 → 책 → 취침)</li>
<li>✅ 어둡고 조용한 환경 (백색소음 도움)</li>
<li>✅ 적정 온도 20~22℃</li>
<li>✅ 졸리지만 깨어있을 때 눕혀요</li>
</ul>
<strong>대표 수면 교육법:</strong>
<ul>
<li><strong>페이딩법:</strong> 점점 개입을 줄이는 방법 (부드러움)</li>
<li><strong>퍼버법:</strong> 점진적 소거법 (4~6개월 이후)</li>
</ul>`;
    }
    return `<h4>😴 월령별 수면 패턴</h4>
<table>
<tr><th>월령</th><th>총 수면</th><th>밤잠</th><th>낮잠</th></tr>
<tr><td>0~1개월</td><td>14~17h</td><td>불규칙</td><td>불규칙</td></tr>
<tr><td>2~3개월</td><td>14~16h</td><td>4~6h 연속</td><td>3~4회</td></tr>
<tr><td>4~6개월</td><td>12~15h</td><td>6~8h</td><td>2~3회</td></tr>
<tr><td>6~9개월</td><td>12~14h</td><td>8~10h</td><td>2회</td></tr>
<tr><td>9~12개월</td><td>12~13h</td><td>9~11h</td><td>1~2회</td></tr>
</table>
${babyMonths !== null ? `<br>💡 <strong>${babyName}이는 ${babyMonths}개월</strong>이니까 하루 약 ${sleepRecommendation(babyMonths)} 수면이 필요해요.` : ''}`;
  }

  // ── 발달 ──────────────────────────────────────────────────
  if (t.includes('발달') || t.includes('뒤집기') || t.includes('걷기') || t.includes('말') || t.includes('옹알이') || t.includes('앉기')) {
    if (babyMonths !== null) {
      const milestones = getMilestones(babyMonths);
      if (milestones.length > 0) {
        const g = milestones[0];
        const items = g.items.map(i => `<li>${i.text}</li>`).join('');
        const sq = `${babyMonths}개월 아기 발달 장난감`;
        return `<h4>👶 ${babyName}이의 발달 체크 (${babyMonths}개월)</h4>
<strong>${g.icon} 이 시기에 할 수 있어야 해요:</strong>
<ul>${items}</ul>
<br>💡 건강 탭 → 발달체크에서 체크리스트를 확인하고 기록할 수 있어요!<br><br>
⚠️ 발달이 걱정된다면 <strong>소아과 전문의</strong>에게 상담받아보세요.
<br><br>🎮 <strong>이 시기 장난감 찾기:</strong>
${makeExternalLinks(sq)}`;
      }
    }
    return `<h4>👶 주요 발달 이정표</h4>
<ul>
<li><strong>2개월:</strong> 사회적 미소, 목 들기</li>
<li><strong>4개월:</strong> 소리 내어 웃기, 뒤집기 시도</li>
<li><strong>6개월:</strong> 뒤집기, 도움 받아 앉기, 옹알이</li>
<li><strong>9개월:</strong> 혼자 앉기, 기기, 낯가림</li>
<li><strong>12개월:</strong> 잡고 서기, 첫 단어, 집게 잡기</li>
<li><strong>15개월:</strong> 혼자 걷기, 4~6 단어</li>
<li><strong>24개월:</strong> 뛰기, 두 단어 조합</li>
</ul>`;
  }

  // ── 피부 ──────────────────────────────────────────────────
  if (t.includes('피부') || t.includes('발진') || t.includes('태열') || t.includes('아토피') || t.includes('습진')) {
    return `<h4>🔴 아기 피부 트러블 가이드</h4>
<strong>신생아 여드름 (신생아 여드름)</strong>
<ul><li>생후 2~4주 나타나는 정상적인 반응</li><li>특별한 치료 불필요, 2~3개월 내 자연 소실</li></ul>
<strong>기저귀 발진</strong>
<ul><li>기저귀를 자주 갈아주고 엉덩이를 건조하게 유지</li><li>아연 산화물 크림 (알로에 또는 수딩크림) 사용</li><li>48시간 내 호전 없으면 소아과 방문</li></ul>
<strong>태열 / 영아 습진</strong>
<ul><li>보습제를 하루 2회 이상 충분히 발라요</li><li>목욕은 10분 이내, 미지근한 물</li><li>증상 심하면 소아과 방문 (스테로이드 연고 처방)</li></ul>
💡 <strong>피부 기록</strong>은 건강 탭 → 건강기록에서 남겨두면 소아과 방문 시 도움돼요!`;
  }

  // ── 열 ────────────────────────────────────────────────────
  if (t.includes('열') || t.includes('체온') || t.includes('발열') || t.includes('해열')) {
    return `<h4>🌡️ 아기 열 대처 가이드</h4>
<strong>정상 체온:</strong> 36.5~37.5℃
<br><br>
<strong>열 단계별 대응:</strong>
<ul>
<li><strong>37.5~38℃:</strong> 경과 관찰, 수분 공급</li>
<li><strong>38~38.5℃:</strong> 옷 느슨하게, 미지근한 물 수건</li>
<li><strong>38.5℃ 이상:</strong> 해열제 사용 (타이레놀 시럽)</li>
</ul>
<strong>즉시 병원 방문:</strong>
<ul>
<li>⚠️ 생후 3개월 미만 38℃ 이상</li>
<li>⚠️ 39℃ 이상 2일 이상 지속</li>
<li>⚠️ 경련, 호흡 곤란, 발진 동반</li>
</ul>
<strong>해열제 사용:</strong> 4~6시간 간격, 체중 kg × 10~15mg`;
  }

  // ── 배앓이 / 콜릭 ─────────────────────────────────────────
  if (t.includes('배앓이') || t.includes('콜릭') || t.includes('많이 울') || t.includes('배가 아')) {
    return `<h4>😭 영아 배앓이 (콜릭) 대처법</h4>
<strong>콜릭이란?</strong>
<ul><li>생후 2주~3~4개월에 하루 3시간 이상, 주 3일 이상 이유 없이 울음</li><li>정확한 원인 불명, 4개월 이후 자연스럽게 호전</li></ul>
<strong>달래는 방법:</strong>
<ul>
<li>🤱 세로로 안고 부드럽게 흔들기</li>
<li>🎶 백색소음 (청소기, 선풍기 소리)</li>
<li>🚗 카시트에 태우고 드라이브</li>
<li>💆 배를 시계 방향으로 마사지</li>
<li>🌿 따뜻한 수건을 배에 올려두기</li>
</ul>
💡 부모도 지치면 잠깐 자리를 비워 숨 고르기를 해요. 아기는 괜찮아요.`;
  }

  // ── 장난감 / 교구 추천 ───────────────────────────────────
  if (t.includes('장난감') || t.includes('교구') || t.includes('놀이') || t.includes('추천')) {
    const sq = babyMonths !== null ? `${babyMonths}개월 아기 발달 장난감` : '아기 발달 장난감 추천';
    return `<h4>🎮 ${babyMonths !== null ? babyMonths + '개월 ' : ''}아기 장난감 추천</h4>
<strong>이 시기 발달에 좋은 장난감:</strong>
${getToySuggestions(babyMonths)}
<br>🔍 <strong>직접 찾아보기:</strong>
${makeExternalLinks(sq)}`;
  }

  // ── 영아 안전 ─────────────────────────────────────────────
  if (t.includes('안전') || t.includes('사고') || t.includes('추락') || t.includes('질식')) {
    return `<h4>🛡️ 영아 안전 수칙</h4>
<strong>수면 안전:</strong>
<ul>
<li>아기는 등을 바닥에 대고 단단한 침대에서 재워요</li>
<li>소프트 침구, 베개, 범퍼는 사용하지 않아요</li>
<li>동침은 가능하면 피하고, 같은 방 다른 침대 권장</li>
</ul>
<strong>일반 안전:</strong>
<ul>
<li>차 안에서는 항상 카시트를 사용해요</li>
<li>욕조에서 절대 눈을 떼지 않아요</li>
<li>작은 물건, 코드, 비닐봉지 주의</li>
<li>일산화탄소 경보기 설치</li>
</ul>`;
  }

  // ── 기본 응답 ─────────────────────────────────────────────
  const basics = [
    { keys: ['안녕', '처음', '시작'], ans: '안녕하세요! 😊 저는 베이비케어 도우미예요.\n무엇이든 편하게 물어보세요!\n\n💡 아래 주제들을 물어보실 수 있어요:\n💉 예방접종 일정\n🥣 이유식 시작/레시피\n🍼 분유량\n😴 수면 패턴\n👶 발달 체크\n🌡️ 열 대처 방법' },
    { keys: ['고마', '감사', '도움'], ans: '도움이 됐다니 기뻐요! 💛\n육아 하시느라 정말 고생이 많으세요. 언제든 궁금한 것이 있으면 물어보세요!' },
    { keys: ['힘들', '지쳐', '피곤', '못 자'], ans: '😢 정말 수고 많으세요.\n육아는 세상에서 가장 힘든 일 중 하나예요.\n잠깐이라도 쉴 시간을 꼭 만들어보세요.\n배우자, 가족의 도움을 요청하는 것도 용기 있는 일이에요. 파이팅! 💪' }
  ];
  for (const b of basics) {
    if (b.keys.some(k => t.includes(k))) return b.ans.replace(/\n/g, '<br>');
  }

  return `아직 그 내용은 잘 모르지만 도움이 되고 싶어요! 😊<br><br>아래 주제로 질문해 보시겠어요?<br>💉 예방접종 · 🥣 이유식 · 🍼 분유량 · 😴 수면 · 👶 발달 · 🌡️ 열 대처`;
}

function formulaAdvice(months, name) {
  if (months <= 1) return `<br>💡 <strong>${name}이는 ${months}개월</strong>이에요. 1회 60~90ml, 하루 7~8회 수유가 적당해요.`;
  if (months <= 2) return `<br>💡 <strong>${name}이는 ${months}개월</strong>이에요. 1회 90~120ml, 하루 6~7회 수유가 적당해요.`;
  if (months <= 4) return `<br>💡 <strong>${name}이는 ${months}개월</strong>이에요. 1회 150~180ml, 하루 5회 수유가 적당해요.`;
  if (months <= 6) return `<br>💡 <strong>${name}이는 ${months}개월</strong>이에요. 1회 150~210ml, 하루 4~5회 수유가 적당해요.`;
  return `<br>💡 <strong>${name}이는 ${months}개월</strong>이에요. 이유식과 병행하며 분유량을 서서히 줄여나가요.`;
}

function sleepRecommendation(months) {
  if (months < 3)  return '14~17시간';
  if (months < 6)  return '12~16시간';
  if (months < 12) return '12~14시간';
  return '11~14시간';
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
}

// ── Escape HTML ───────────────────────────────────────────────
function makeExternalLinks(query) {
  const yt = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
  const dg = 'https://www.daangn.com/search/' + encodeURIComponent(query);
  const mg = 'https://momguide.co.kr/search/?q=' + encodeURIComponent(query);
  return '<div class="ext-links">' +
    '<a class="ext-btn ext-youtube" href="' + yt + '" target="_blank" rel="noopener noreferrer">🎬 YouTube</a>' +
    '<a class="ext-btn ext-daangn" href="' + dg + '" target="_blank" rel="noopener noreferrer">🥕 당근마켓</a>' +
    '<a class="ext-btn ext-momsguide" href="' + mg + '" target="_blank" rel="noopener noreferrer">🧴 맘가이드</a>' +
    '</div>';
}

function getToySuggestions(months) {
  if (months === null) return '<ul><li>월령에 맞는 장난감을 추천해드려요</li></ul>';
  if (months < 3)  return '<ul><li>🎠 흑백 모빌 (시각 발달)</li><li>🔔 딸랑이 (청각 발달)</li><li>🧸 소프트 토이</li></ul>';
  if (months < 6)  return '<ul><li>🦷 치발기 (구강기)</li><li>📖 흑백 헝겊 책</li><li>🤸 배 놀이 매트</li></ul>';
  if (months < 9)  return '<ul><li>🎯 오뚝이</li><li>🎵 버튼 소리 장난감</li><li>🧱 소프트 블록</li></ul>';
  if (months < 12) return '<ul><li>🧩 소프트 블록 세트</li><li>🎹 피아노 매트</li><li>🏀 천 공</li></ul>';
  if (months < 18) return '<ul><li>🚗 끌차/밀차</li><li>🧩 간단한 퍼즐 (4~6조각)</li><li>🏺 모양 맞추기 장난감</li></ul>';
  return '<ul><li>🎭 역할놀이 세트</li><li>🧱 큰 블록 (듀플로 등)</li><li>🖍️ 유아용 크레용 + 스케치북</li></ul>';
}

function koreanParticle(name, withConsonant, withVowel) {
  if (!name) return withVowel;
  const code = name.charCodeAt(name.length - 1);
  if (code >= 0xAC00 && code <= 0xD7A3) {
    return (code - 0xAC00) % 28 !== 0 ? withConsonant : withVowel;
  }
  return withVowel;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Setup (first launch) ──────────────────────────────────────
function handleSetup(e) {
  e.preventDefault();
  const name  = document.getElementById('baby-name-input').value.trim();
  const birth = document.getElementById('baby-birth-input').value;
  const gender = document.querySelector('.gender-btn.active')?.dataset.gender || 'girl';

  if (!name)  { showToast('아기 이름을 입력해주세요'); return; }
  if (!birth) { showToast('생년월일을 입력해주세요'); return; }
  if (birth > todayStr()) { showToast('생년월일이 오늘보다 미래일 수 없어요'); return; }

  STATE.baby = { name, birthDate: birth, gender };
  saveState();
  closeModal('setup-modal');
  updateHeader();
  renderHome();
  updateBabyHeroCard();
  showToast(`👶 ${name}${koreanParticle(name, '이의', '의')} 기록을 시작해요!`);
}

// ── Event Listeners ───────────────────────────────────────────
function attachEvents() {

  // Setup form
  document.getElementById('setup-form').addEventListener('submit', handleSetup);
  document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Header baby info (re-open setup)
  document.getElementById('header-baby-info').addEventListener('click', () => {
    if (STATE.baby) {
      document.getElementById('baby-name-input').value = STATE.baby.name;
      document.getElementById('baby-birth-input').value = STATE.baby.birthDate;
      document.querySelectorAll('.gender-btn').forEach(b => b.classList.toggle('active', b.dataset.gender === STATE.baby.gender));
    }
    openModal('setup-modal');
  });

  // Hero edit button (same as header baby info)
  document.getElementById('hero-edit-btn')?.addEventListener('click', () => {
    if (STATE.baby) {
      document.getElementById('baby-name-input').value = STATE.baby.name;
      document.getElementById('baby-birth-input').value = STATE.baby.birthDate;
      document.querySelectorAll('.gender-btn').forEach(b => b.classList.toggle('active', b.dataset.gender === STATE.baby.gender));
    }
    openModal('setup-modal');
  });

  // Bottom nav (data-page 있는 버튼만 — <a> 태그 제외)
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Center FAB: mic (STT — UI only for now)
  document.getElementById('nav-fab-mic')?.addEventListener('click', () => {
    showToast('🎤 음성 기록 기능은 준비중이에요!');
  });

  // Quick add buttons (home)
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => openAddLog(btn.dataset.type));
  });

  // See all buttons (multiple)
  document.querySelectorAll('.see-all-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Log type tabs
  document.getElementById('log-type-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.type-tab');
    if (!tab) return;
    document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentLogType = tab.dataset.type;
    renderLogForm(currentLogType);
  });

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  // Close modal on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && overlay.id !== 'setup-modal') {
        closeModal(overlay.id);
      }
    });
  });

  // Timeline date navigation
  document.getElementById('prev-date').addEventListener('click', () => {
    timelineDate = shiftDate(timelineDate, -1);
    renderTimeline();
  });
  document.getElementById('next-date').addEventListener('click', () => {
    if (timelineDate >= todayStr()) { showToast('오늘 이후의 날짜는 볼 수 없어요'); return; }
    timelineDate = shiftDate(timelineDate, 1);
    renderTimeline();
  });

  // Timeline FAB
  document.getElementById('timeline-add-btn').addEventListener('click', () => openAddLog('sleep'));

  // Timeline block click (delete)
  document.getElementById('tl-body').addEventListener('click', (e) => {
    const block = e.target.closest('.tl-block');
    if (!block) return;
    const id = block.dataset.id;
    if (confirm('이 기록을 삭제할까요?')) {
      const dateKey = timelineDate;
      if (STATE.logs[dateKey]) {
        STATE.logs[dateKey] = STATE.logs[dateKey].filter(l => l.id !== id);
        saveState();
        buildTimeline();
        showToast('기록이 삭제됐어요');
      }
    }
  });

  // Schedule / Todo
  const addTodoBtn = document.getElementById('add-todo-btn');
  const todoInput  = document.getElementById('todo-input');
  function doAddTodo() {
    addTodo(todoInput.value, document.getElementById('todo-cat-select').value);
    todoInput.value = '';
  }
  addTodoBtn.addEventListener('click', doAddTodo);
  todoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAddTodo(); } });

  // Todo list delegated events
  document.getElementById('todo-list').addEventListener('click', (e) => {
    const checkEl  = e.target.closest('[data-check]');
    const deleteEl = e.target.closest('[data-delete]');
    const askEl    = e.target.closest('[data-ask]');

    if (checkEl)  toggleTodo(checkEl.dataset.check);
    if (deleteEl) deleteTodo(deleteEl.dataset.delete);
    if (askEl) {
      const cat = askEl.dataset.ask;
      const questions = {
        vaccine: '예방접종 일정 알려줘',
        formula: '월령별 분유량 알려줘',
        solid:   '이유식 언제 시작해요?',
        other:   '아기 건강 정보 알려줘'
      };
      navigate('chat');
      setTimeout(() => sendChatMessage(questions[cat] || '아기 정보 알려줘'), 300);
    }
  });

  // Schedule category tabs
  document.getElementById('schedule-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.cat-tab');
    if (!tab) return;
    renderTodos(tab.dataset.cat);
  });

  // Health tabs
  document.getElementById('health-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.h-tab');
    if (!tab) return;
    switchHTab(tab.dataset.htab);
  });

  // Add health log buttons
  document.getElementById('add-health-btn').addEventListener('click', () => openHealthModal('health'));
  document.getElementById('add-med-btn').addEventListener('click', () => openHealthModal('medication'));

  // Development milestone click
  document.getElementById('milestone-list').addEventListener('click', (e) => {
    const item = e.target.closest('.milestone-item');
    if (!item) return;
    const id = item.dataset.milestone;
    STATE.development[id] = !STATE.development[id];
    saveState();
    renderDevelopment();
    showToast(STATE.development[id] ? '✓ 발달 항목을 완료했어요!' : '↩ 발달 항목이 취소됐어요');
  });

  // Chatbot quick replies
  document.getElementById('quick-replies').addEventListener('click', (e) => {
    const btn = e.target.closest('.qr-btn');
    if (!btn) return;
    sendChatMessage(btn.dataset.msg);
  });

  // Chat send
  const chatInput = document.getElementById('chat-input');
  const chatSend  = document.getElementById('chat-send-btn');
  function doSend() {
    const val = chatInput.value.trim();
    if (val) sendChatMessage(val);
  }
  chatSend.addEventListener('click', doSend);
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSend(); } });

  // Page change → init chat
  document.querySelector('.nav-item[data-page="chat"]').addEventListener('click', () => {
    setTimeout(initChat, 100);
  });
}

// ── Pre-populate sample todos if first launch ─────────────────
function maybeAddSampleTodos() {
  if (STATE.todos.length > 0) return;
  const samples = [
    { text: 'BCG 접종 (출생 후 4주 이내)', category: 'vaccine' },
    { text: 'B형간염 2차 접종 (1개월)', category: 'vaccine' },
    { text: '이유식 시작 알아보기', category: 'solid' }
  ];
  samples.forEach(s => {
    STATE.todos.push({ id: uid(), text: s.text, category: s.category, completed: false, createdAt: Date.now() });
  });
  saveState();
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  loadState();

  // Show or skip setup modal
  if (STATE.baby) {
    closeModal('setup-modal');
  }

  attachEvents();
  updateHeader();
  renderHome();
  maybeAddSampleTodos();

  // Refresh header every minute
  setInterval(updateHeader, 60000);
}

document.addEventListener('DOMContentLoaded', init);
