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
      logs: [],           // [ { id, type, detail, temp, date, time, photo? } ]
      medications: []     // [ { id, name, dose, freq, note, date } ]
    },
    growth: [],           // [ { id, date, height?, weight? } ]
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
    window.location.href = './youtube_trend.html';
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
  if (page === 'schedule')  { renderTodos(); renderScheduleShopLinks(); }
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
  else if (currentHTab === 'report') renderReport();
}

function switchHTab(tab) {
  currentHTab = tab;
  document.querySelectorAll('.h-tab').forEach(t => t.classList.toggle('active', t.dataset.htab === tab));
  document.querySelectorAll('.h-section').forEach(s => s.classList.remove('active'));
  const tabId = tab === 'development' ? 'dev-tab' : `${tab}-tab`;
  document.getElementById(tabId).classList.add('active');
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
    <p>${STATE.baby.name}${koreanParticle(STATE.baby.name, '이의', '의')} 발달 체크리스트예요</p>`;

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
      <div class="form-group"><label>사진 (선택)</label><input type="file" id="hf-photo" accept="image/*" capture="environment" style="font-size:12px"></div>
      <button class="btn-primary btn-full" id="hf-save">저장</button>`;
    document.getElementById('hf-save').addEventListener('click', async () => {
      const detail = document.getElementById('hf-detail').value.trim();
      if (!detail) { showToast('내용을 입력해주세요'); return; }
      const photoFile = document.getElementById('hf-photo').files[0];
      let photo = null;
      if (photoFile) photo = await compressImage(photoFile, 400, 300);
      if (!STATE.health.logs) STATE.health.logs = [];
      STATE.health.logs.push({
        id: uid(), type: document.getElementById('hf-type').value,
        detail, date: document.getElementById('hf-date').value,
        time: document.getElementById('hf-time').value, photo
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

// ── VOICE STT + INTENT ROUTER ────────────────────────────────
let voiceRecognition = null;
let voiceActive      = false;

const VOICE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'record_activity',
      description: '아기의 활동(수유, 수면, 기저귀, 산책, 울음)을 시간표에 기록합니다.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['feed', 'sleep', 'pee', 'poop', 'cry', 'walk'],
            description: 'feed=수유, sleep=수면, pee=소변, poop=대변, cry=울음, walk=산책'
          },
          time:     { type: 'string', description: '시작 시간 HH:MM (24시간). 언급 없으면 생략' },
          endTime:  { type: 'string', description: '종료 시간 HH:MM. sleep/cry/walk에만 해당' },
          amount:   { type: 'number', description: '수유량(ml). 수유일 때만' },
          feedType: { type: 'string', enum: ['분유', '모유', '혼합'], description: '수유 방법' },
          note:     { type: 'string', description: '메모나 특이사항' }
        },
        required: ['type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'save_schedule',
      description: '할일이나 예약 일정(예방접종, 병원, 이유식 재료, 쇼핑 등)을 스케줄에 저장합니다.',
      parameters: {
        type: 'object',
        properties: {
          text:     { type: 'string', description: '할일 내용 (간결하게)' },
          category: {
            type: 'string',
            enum: ['health', 'food', 'play', 'etc'],
            description: 'health=건강/병원/접종, food=이유식/음식, play=놀이/발달, etc=기타'
          }
        },
        required: ['text', 'category']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'chat_response',
      description: '아기 육아 정보 질문, 조언 요청, 일반 대화에 답변합니다.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: '사용자의 원본 메시지' }
        },
        required: ['message']
      }
    }
  }
];

function initVoice() {
  const btn = document.getElementById('nav-fab-mic');
  if (!btn) return;
  btn.addEventListener('click', () => voiceActive ? stopVoice() : startVoice());

  document.getElementById('voice-cancel')?.addEventListener('click', () => stopVoice());
  document.getElementById('voice-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'voice-overlay') stopVoice();
  });
}

function setVoiceUI(state, transcript) {
  const overlay   = document.getElementById('voice-overlay');
  const statusEl  = document.getElementById('voice-status');
  const iconEl    = document.getElementById('voice-icon');
  const transcEl  = document.getElementById('voice-transcript');
  const micBtn    = document.getElementById('nav-fab-mic');
  const overlayEl = document.getElementById('voice-overlay');

  if (state === 'hidden') {
    overlay.style.display = 'none';
    transcEl.textContent  = '';
    micBtn.classList.remove('listening', 'processing');
    overlayEl.classList.remove('processing');
    return;
  }

  overlay.style.display = 'flex';
  if (transcript !== undefined) transcEl.textContent = transcript;

  if (state === 'listening') {
    iconEl.textContent    = '🎤';
    statusEl.textContent  = '듣는 중...';
    micBtn.classList.add('listening');
    micBtn.classList.remove('processing');
    overlayEl.classList.remove('processing');
  } else if (state === 'processing') {
    iconEl.textContent    = '🧠';
    statusEl.textContent  = '분석 중...';
    micBtn.classList.remove('listening');
    micBtn.classList.add('processing');
    overlayEl.classList.add('processing');
  }
}

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast('⚠️ 음성인식은 Chrome에서 지원돼요');
    return;
  }

  voiceActive = true;
  setVoiceUI('listening');

  const rec = new SR();
  voiceRecognition = rec;
  rec.lang = 'ko-KR';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.continuous = false;

  rec.onresult = (e) => {
    const interim = Array.from(e.results).map(r => r[0].transcript).join('');
    setVoiceUI('listening', interim);

    if (e.results[e.results.length - 1].isFinal) {
      const final = interim;
      stopVoice(false);
      setVoiceUI('processing', `"${final}"`);
      processVoiceInput(final);
    }
  };

  rec.onerror = (e) => {
    stopVoice();
    const msg = e.error === 'not-allowed'
      ? '마이크 권한을 허용해주세요'
      : e.error === 'no-speech'
      ? '음성이 감지되지 않았어요'
      : e.error;
    showToast('🎤 ' + msg);
  };

  rec.onend = () => { if (voiceActive) stopVoice(); };
  rec.start();
}

function stopVoice(hideUI = true) {
  voiceActive = false;
  if (voiceRecognition) {
    try { voiceRecognition.stop(); } catch (_) {}
    voiceRecognition = null;
  }
  if (hideUI) setVoiceUI('hidden');
}

async function processVoiceInput(transcript) {
  const oaKey = localStorage.getItem('openai_api_key') || '';

  if (!oaKey) {
    setVoiceUI('hidden');
    navigate('chat');
    setTimeout(() => sendChatMessage(transcript), 200);
    showToast('💬 챗봇으로 전달했어요 (API 키 미설정)');
    return;
  }

  try {
    const babyMonths = STATE.baby ? (getAgeInfo(STATE.baby.birthDate)?.months ?? 5) : 5;
    const babyName   = STATE.baby?.name || '아기';

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${oaKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `너는 아기 육아 앱의 음성 명령 분류기야.
아기 이름: ${babyName}, 월령: ${babyMonths}개월, 현재 시각: ${nowHHMM()}.
사용자 음성 입력을 보고 반드시 아래 중 하나의 함수를 호출해:
- 수유/수면/기저귀/산책/울음 내용 → record_activity
- 할일/예약/일정 저장 요청 → save_schedule
- 질문/대화/정보 요청 → chat_response
시간 표현("방금", "지금", "30분 전" 등)은 HH:MM으로 변환해서 넣어줘.`
          },
          { role: 'user', content: transcript }
        ],
        tools: VOICE_TOOLS,
        tool_choice: 'required'
      })
    });

    const data   = await res.json();
    const tcall  = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tcall) throw new Error('no tool_call');

    const fn   = tcall.function.name;
    const args = JSON.parse(tcall.function.arguments);

    setVoiceUI('hidden');

    if      (fn === 'record_activity') handleVoiceRecord(args);
    else if (fn === 'save_schedule')   handleVoiceSchedule(args);
    else                               handleVoiceChat(transcript);

  } catch (err) {
    console.error('Voice router error', err);
    setVoiceUI('hidden');
    navigate('chat');
    setTimeout(() => sendChatMessage(transcript), 200);
    showToast('💬 챗봇으로 연결했어요');
  }
}

function handleVoiceRecord(args) {
  const dateKey = todayStr();
  const time    = args.time || nowHHMM();
  const type    = args.type;

  const log = { id: uid(), type, date: dateKey, note: args.note || '' };

  if (type === 'sleep' || type === 'cry' || type === 'walk') {
    log.startTime = time;
    if (args.endTime) log.endTime = args.endTime;
  } else {
    log.time      = time;
    log.startTime = time;
  }
  if (type === 'feed') {
    log.amount   = args.amount ? parseInt(args.amount) : null;
    log.feedType = args.feedType || '분유';
  }

  if (!STATE.logs[dateKey]) STATE.logs[dateKey] = [];
  STATE.logs[dateKey].push(log);
  STATE.logs[dateKey].sort((a, b) => (a.startTime || a.time || '').localeCompare(b.startTime || b.time || ''));
  saveState();

  const label = { feed:'수유', sleep:'수면', pee:'소변', poop:'대변', cry:'울음', walk:'산책' };
  showToast(`🎤 ${TYPE_ICONS[type]} ${label[type]} 기록 완료!`);

  navigate('timeline');
  setTimeout(buildTimeline, 100);
}

function handleVoiceSchedule(args) {
  addTodo(args.text, args.category);
  showToast(`🎤 스케줄에 추가됐어요: ${args.text}`);
  navigate('schedule');
}

function handleVoiceChat(transcript) {
  navigate('chat');
  setTimeout(() => {
    initChat();
    sendChatMessage(transcript);
  }, 200);
}

// ── RAG 지식베이스 ────────────────────────────────────────────
let RAG_CHUNKS  = null;   // [{id, text, metadata}]
let RAG_FIGURES = null;   // [{id, title, caption, image, metadata}]

async function loadRagData() {
  if (RAG_CHUNKS) return;
  try {
    const [cr, fr] = await Promise.all([
      fetch('data_for_RAG/processed/rag_chunks.json').then(r => r.json()),
      fetch('data_for_RAG/processed/rag_figures.json').then(r => r.json()),
    ]);
    RAG_CHUNKS  = cr;
    RAG_FIGURES = fr;
  } catch (e) {
    RAG_CHUNKS  = [];
    RAG_FIGURES = [];
    console.warn('RAG 데이터 로드 실패:', e);
  }
}

// TF-IDF 간략 구현 (IDF 없이 TF + 키워드 가중치)
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function buildQueryTokens(query) {
  const tokens = tokenize(query);
  const freq   = {};
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  return freq;
}

function cosineSim(queryFreq, docText) {
  const docTokens = tokenize(docText);
  const docFreq   = {};
  docTokens.forEach(t => { docFreq[t] = (docFreq[t] || 0) + 1; });

  let dot = 0, qNorm = 0, dNorm = 0;
  for (const [t, qf] of Object.entries(queryFreq)) {
    dot   += qf * (docFreq[t] || 0);
    qNorm += qf * qf;
  }
  for (const df of Object.values(docFreq)) dNorm += df * df;
  if (!qNorm || !dNorm) return 0;
  return dot / (Math.sqrt(qNorm) * Math.sqrt(dNorm));
}

function searchChunks(query, topK = 5) {
  if (!RAG_CHUNKS?.length) return [];
  const qFreq = buildQueryTokens(query);
  return RAG_CHUNKS
    .map(c => ({ ...c, score: cosineSim(qFreq, c.text) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function searchFigures(query, topK = 3) {
  if (!RAG_FIGURES?.length) return [];
  const qFreq = buildQueryTokens(query);
  return RAG_FIGURES
    .map(f => ({ ...f, score: cosineSim(qFreq, f.title + ' ' + f.caption) }))
    .filter(f => f.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// 출처 렌더링 (답변 하단에 붙임)
function renderSources(chunks, figures) {
  const refs = [];

  // 청크 출처 (중복 제거)
  const seen = new Set();
  for (const c of chunks) {
    const key = `${c.metadata.source}|${c.metadata.page}`;
    if (!seen.has(key)) {
      seen.add(key);
      const page = c.metadata.page ? ` p.${c.metadata.page}` : '';
      refs.push(`<span class="rag-ref">📖 ${c.metadata.source}${page}</span>`);
    }
  }

  // 표/그림
  const figHtml = figures.map(f => {
    const page = f.metadata.page ? ` (p.${f.metadata.page})` : '';
    const img  = f.image
      ? `<img src="data_for_RAG/processed/figures/${f.image}" class="rag-fig-img" alt="${f.title}" loading="lazy">`
      : '';
    return `<div class="rag-figure">
      ${img}
      <div class="rag-fig-title">${f.title}${page}</div>
      <div class="rag-fig-source">출처: ${f.metadata.source}</div>
    </div>`;
  }).join('');

  if (!refs.length && !figHtml) return '';
  return `<div class="rag-sources">
    <div class="rag-refs">${refs.join('')}</div>
    ${figHtml ? `<div class="rag-figures">${figHtml}</div>` : ''}
  </div>`;
}

// RAG Chat Agent: 검색 → GPT 답변 생성 → 출처 렌더링
async function ragChatAgent(userQuery) {
  await loadRagData();

  const oaKey = localStorage.getItem('openai_api_key') || '';
  const chunks  = searchChunks(userQuery, 5);
  const figures = searchFigures(userQuery, 3);

  const babyMonths = STATE.baby ? (getAgeInfo(STATE.baby.birthDate)?.months ?? null) : null;
  const babyName   = STATE.baby?.name || '아기';

  // 컨텍스트 구성
  const context = chunks.length
    ? chunks.map(c => {
        const src  = c.metadata.source;
        const page = c.metadata.page ? ` (p.${c.metadata.page})` : '';
        return `[출처: ${src}${page}]\n${c.text}`;
      }).join('\n\n---\n\n')
    : '';

  // GPT API 없으면 rule-based로 폴백
  if (!oaKey) {
    const fallback = getBotResponse(userQuery);
    return fallback + renderSources(chunks, figures);
  }

  try {
    const systemPrompt = `너는 영유아 육아 전문 챗봇이야.
아기 이름: ${babyName}, 월령: ${babyMonths != null ? babyMonths + '개월' : '미입력'}.
아래 참고 문서를 바탕으로 질문에 정확하고 실용적인 답변을 해줘.
- 항상 한국어로 답변
- 중요 키워드는 <strong>볼드</strong> 처리
- 목록은 <ul><li> 형식
- 의학적 결정은 반드시 소아청소년과 전문의 상담 권고 포함
- 없는 정보를 지어내지 마

[참고 문서]
${context || '관련 문서 없음. 일반 육아 지식으로 답변.'}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${oaKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        max_tokens:  800,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userQuery },
        ],
      }),
    });

    const data    = await res.json();
    const answer  = data.choices?.[0]?.message?.content || '답변을 생성하지 못했어요.';
    return answer + renderSources(chunks, figures);

  } catch (err) {
    console.error('RAG chat error:', err);
    return getBotResponse(userQuery) + renderSources(chunks, figures);
  }
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
  ragChatAgent(text).then(response => {
    removeTyping();
    addBotMessage(response);
  });
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

const SHOP_KEYWORDS = {
  newborn: ['황달 케어', '신생아 목욕', '배앓이 달래기', '수유 자세', '태열', '영아산통', '모유수유', '신생아 모빌'],
  '1-3':   ['흑백 모빌', '딸랑이', '배앓이', '목 가누기', '사회적 미소', '소프트 토이', '스와들링', '배 놀이'],
  '4-6':   ['이앓이', '치발기', '촉감 놀이', '이유식 준비', '뒤집기 연습', '배 놀이 매트', '오감 장난감', '목욕 장난감'],
  '7-9':   ['이유식', '집게 잡기', '기기 연습', '낯가림', '소리 장난감', '손잡이 컵', '범퍼 침대', '오뚝이'],
  '10-12': ['걸음마 보조', '첫 단어', '컵 연습', '소프트 퍼즐', '잡고 서기', '끌차', '잇몸 간식'],
  toddler: ['역할 놀이', '끌차', '큰 블록', '유아 크레용', '어린이집 가방', '유아 의자', '놀이 매트'],
};

function getShopKeywordsForAge(months) {
  if (months < 1)  return SHOP_KEYWORDS.newborn;
  if (months <= 3) return SHOP_KEYWORDS['1-3'];
  if (months <= 6) return SHOP_KEYWORDS['4-6'];
  if (months <= 9) return SHOP_KEYWORDS['7-9'];
  if (months <= 12)return SHOP_KEYWORDS['10-12'];
  return SHOP_KEYWORDS.toddler;
}

function renderScheduleShopLinks() {
  const kwEl  = document.getElementById('shop-keywords');
  const grid  = document.getElementById('shop-grid');
  const badge = document.getElementById('shop-age-badge');
  if (!kwEl || !grid) return;

  const ai = STATE.baby ? getAgeInfo(STATE.baby.birthDate) : null;
  const months = ai ? ai.months : null;

  if (badge) badge.textContent = months !== null ? `${months}개월 맞춤` : '';

  // Keyword chips
  const keywords = months !== null ? getShopKeywordsForAge(months) : SHOP_KEYWORDS['4-6'];
  kwEl.innerHTML = `<div class="kw-chips">${keywords.map(k =>
    `<button class="kw-chip" data-kw="${k}">${k}</button>`
  ).join('')}</div>`;

  // Platform quick-links (3개, age-based default query)
  const baseQ = months !== null ? `${months}개월 아기 ` : '아기 ';
  const ytUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(baseQ + '육아 정보');
  const dgUrl = 'https://www.daangn.com/search/' + encodeURIComponent(baseQ + '장난감');
  const mgUrl = 'https://momguide.co.kr/search/?q=' + encodeURIComponent('아기');

  grid.innerHTML = `
    <a class="shop-item" href="${ytUrl}" target="_blank" rel="noopener noreferrer">
      <div class="shop-item-icon shop-yt">🎬</div>
      <div class="shop-item-info"><div class="shop-item-name">YouTube</div><div class="shop-item-desc">키워드로 육아 영상 검색</div></div>
      <svg class="shop-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 6l6 6-6 6"/></svg>
    </a>
    <a class="shop-item" href="${dgUrl}" target="_blank" rel="noopener noreferrer">
      <div class="shop-item-icon shop-dg">🥕</div>
      <div class="shop-item-info"><div class="shop-item-name">당근마켓</div><div class="shop-item-desc">중고 장난감·아이템 검색</div></div>
      <svg class="shop-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 6l6 6-6 6"/></svg>
    </a>
    <a class="shop-item" href="${mgUrl}" target="_blank" rel="noopener noreferrer">
      <div class="shop-item-icon shop-mg">🧴</div>
      <div class="shop-item-info"><div class="shop-item-name">맘가이드</div><div class="shop-item-desc">성분 안전성 확인</div></div>
      <svg class="shop-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 6l6 6-6 6"/></svg>
    </a>`;
}

function initKeywordPicker() {
  const overlay = document.getElementById('kw-picker-overlay');
  if (!overlay) return;

  document.getElementById('shop-keywords')?.addEventListener('click', e => {
    const chip = e.target.closest('.kw-chip');
    if (!chip) return;
    const kw = chip.dataset.kw;
    document.getElementById('kw-picker-label').textContent = `"${kw}" 검색하기`;
    document.getElementById('kw-yt').href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(kw + ' 아기');
    document.getElementById('kw-dg').href = 'https://www.daangn.com/search/' + encodeURIComponent(kw);
    document.getElementById('kw-mg').href = 'https://momguide.co.kr/search/?q=' + encodeURIComponent(kw);
    overlay.style.display = 'flex';
  });

  document.getElementById('kw-picker-cancel')?.addEventListener('click', () => { overlay.style.display = 'none'; });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
  overlay.querySelectorAll('.kw-picker-btn').forEach(a => {
    a.addEventListener('click', () => { setTimeout(() => { overlay.style.display = 'none'; }, 200); });
  });
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

// ── REPORT ────────────────────────────────────────────────────

function compressImage(file, maxW, maxH) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        const ratio = Math.min(maxW / w, maxH / h, 1);
        w = Math.round(w * ratio); h = Math.round(h * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// WHO Growth Standards P3 / P50 / P97 (0–24 months)
const GROWTH_DATA = {
  boy: {
    height: {
      P3:  [46.1,50.2,53.2,55.3,57.0,58.4,59.7,60.9,62.1,63.3,64.5,65.6,66.7,67.7,68.7,69.7,70.6,71.5,72.4,73.3,74.2,75.1,75.9,76.8,77.7],
      P50: [49.9,54.7,58.4,61.4,63.9,65.9,67.6,69.2,70.6,72.0,73.3,74.5,75.7,76.9,78.0,79.1,80.2,81.2,82.3,83.2,84.2,85.1,86.0,86.9,87.8],
      P97: [53.4,59.0,63.2,66.8,69.4,71.9,74.0,75.9,77.7,79.3,80.9,82.4,83.8,85.1,86.4,87.7,88.9,90.1,91.3,92.5,93.7,94.9,96.0,97.2,98.3],
    },
    weight: {
      P3:  [2.5,3.4,4.4,5.1,5.6,6.1,6.4,6.7,7.0,7.2,7.4,7.6,7.8,8.0,8.2,8.4,8.6,8.7,8.9,9.1,9.2,9.4,9.5,9.7,9.8],
      P50: [3.3,4.5,5.6,6.4,7.0,7.5,7.9,8.3,8.6,8.9,9.2,9.4,9.6,9.9,10.1,10.3,10.5,10.7,10.9,11.1,11.3,11.5,11.8,12.0,12.2],
      P97: [4.4,5.8,7.1,8.0,8.7,9.3,9.8,10.3,10.7,11.0,11.4,11.7,12.0,12.3,12.6,12.9,13.2,13.5,13.8,14.1,14.4,14.7,15.0,15.3,15.6],
    }
  },
  girl: {
    height: {
      P3:  [45.6,49.2,52.1,54.2,55.9,57.4,58.7,59.9,61.0,62.2,63.3,64.4,65.4,66.4,67.4,68.3,69.3,70.2,71.1,72.0,72.8,73.7,74.5,75.4,76.2],
      P50: [49.1,53.7,57.1,59.8,62.1,64.0,65.7,67.3,68.7,70.1,71.5,72.8,74.0,75.2,76.4,77.5,78.6,79.7,80.7,81.7,82.7,83.7,84.6,85.5,86.4],
      P97: [52.9,58.1,62.1,65.2,67.8,70.0,71.9,73.7,75.3,76.9,78.4,79.9,81.3,82.7,84.0,85.3,86.6,87.9,89.1,90.3,91.5,92.6,93.7,94.8,95.9],
    },
    weight: {
      P3:  [2.4,3.2,4.0,4.7,5.1,5.5,5.8,6.1,6.3,6.5,6.7,6.9,7.1,7.2,7.4,7.6,7.8,7.9,8.1,8.2,8.4,8.6,8.7,8.9,9.0],
      P50: [3.2,4.2,5.1,5.8,6.4,6.9,7.3,7.6,7.9,8.2,8.5,8.7,9.0,9.2,9.4,9.6,9.8,10.0,10.2,10.4,10.6,10.9,11.1,11.3,11.5],
      P97: [4.2,5.5,6.6,7.5,8.2,8.8,9.3,9.8,10.2,10.5,10.9,11.2,11.5,11.8,12.1,12.4,12.7,13.0,13.2,13.5,13.8,14.0,14.3,14.6,14.8],
    }
  }
};

let reportMode  = 'week';
let growthMetric = 'height';

function calcPercentile(value, ageMonths, metric, gender) {
  const gk = gender === 'girl' ? 'girl' : 'boy';
  const d = GROWTH_DATA[gk][metric];
  const m = Math.max(0, Math.min(24, Math.round(ageMonths)));
  const p3 = d.P3[m], p50 = d.P50[m], p97 = d.P97[m];
  let pct;
  if (value <= p3)       pct = 3;
  else if (value >= p97) pct = 97;
  else if (value <= p50) pct = Math.round(3  + (value - p3)  / (p50 - p3)  * 47);
  else                   pct = Math.round(50 + (value - p50) / (p97 - p50) * 47);
  const emoji = pct <= 15 ? '⬇️' : pct >= 85 ? '⬆️' : '✅';
  const label = pct <= 15 ? `하위 ${pct}%` : pct >= 85 ? `상위 ${100 - pct}%` : `중간 범위 (${pct}번째 백분위)`;
  return { pct, emoji, label };
}

function getActivityData(days) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateStr(d);
    const logs = STATE.logs[key] || [];
    const sleepMin = logs.filter(l => l.type === 'sleep' && l.endTime).reduce((sum, l) => {
      const [sh, sm] = (l.startTime || '00:00').split(':').map(Number);
      const [eh, em] = (l.endTime   || '00:00').split(':').map(Number);
      let dur = (eh * 60 + em) - (sh * 60 + sm);
      if (dur < 0) dur += 1440;
      return sum + dur;
    }, 0);
    result.push({
      label: ['일','월','화','수','목','금','토'][d.getDay()],
      sleepMin,
      feedCount:   logs.filter(l => l.type === 'feed').length,
      diaperCount: logs.filter(l => l.type === 'pee' || l.type === 'poop').length,
    });
  }
  return result;
}

function buildDonutSVG(segments) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (total === 0) return '';
  const r = 37, cx = 54, cy = 54, circ = 2 * Math.PI * r;
  let cum = 0;
  const circles = segments.map(seg => {
    const pct = seg.value / total;
    const dash = pct * circ, gap = circ - dash;
    const rot = (cum / total) * 360 - 90;
    cum += seg.value;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="15" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" transform="rotate(${rot.toFixed(1)} ${cx} ${cy})" stroke-linecap="butt"/>`;
  }).join('');
  const legendRows = segments.map(seg => {
    const pct = Math.round(seg.value / total * 100);
    if (pct === 0) return '';
    return `<div class="donut-leg"><span class="donut-dot" style="background:${seg.color}"></span>${seg.label}<b>${pct}%</b></div>`;
  }).join('');
  return `<div class="donut-wrap">
    <svg viewBox="0 0 108 108" style="width:108px;height:108px;flex-shrink:0">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#EEEAE6" stroke-width="15"/>
      ${circles}
    </svg>
    <div class="donut-legend">${legendRows}</div>
  </div>`;
}

function buildHeatmap(days) {
  const colorMap = { sleep: '#4FAACC', feed: '#FF8040', pee: '#E6BC00', poop: '#B97A40', cry: '#E05577', walk: '#78C96E' };
  const rows = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateStr(d);
    const logs = STATE.logs[key] || [];
    const hourMap = {};
    logs.filter(l => l.type === 'sleep' && l.startTime && l.endTime).forEach(l => {
      let sh = parseInt(l.startTime), eh = parseInt(l.endTime);
      if (isNaN(sh) || isNaN(eh)) return;
      if (sh <= eh) { for (let h = sh; h <= eh; h++) hourMap[h] = 'sleep'; }
      else { for (let h = sh; h < 24; h++) hourMap[h] = 'sleep'; for (let h = 0; h <= eh; h++) hourMap[h] = 'sleep'; }
    });
    logs.filter(l => l.type !== 'sleep').forEach(l => {
      const t = (l.startTime || l.time || '').split(':')[0];
      const h = parseInt(t);
      if (!isNaN(h) && hourMap[h] === undefined) hourMap[h] = l.type;
    });
    const dow = ['일','월','화','수','목','금','토'][d.getDay()];
    const cells = Array.from({ length: 24 }, (_, h) => {
      const type = hourMap[h];
      const bg = type ? (colorMap[type] || '#78C96E') : '';
      return `<div class="heat-cell" ${bg ? `style="background:${bg}"` : ''}></div>`;
    }).join('');
    rows.push(`<div class="heat-row"><span class="heat-day">${dow}</span><div class="heat-cells">${cells}</div></div>`);
  }
  return `<div class="heatmap-wrap">
    <div class="heatmap-section-title">24시간 패턴</div>
    <div class="heat-axis"><span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>23시</span></div>
    ${rows.join('')}
  </div>`;
}

function renderActivityChart(mode) {
  const container = document.getElementById('activity-chart');
  const legendEl  = document.getElementById('activity-legend');
  if (!container) return;

  const days = mode === 'week' ? 7 : 30;
  const raw = getActivityData(days);

  let summary;
  if (mode === 'week') {
    summary = raw;
  } else {
    const avg = v => parseFloat((raw.reduce((s, d) => s + d[v], 0) / days).toFixed(1));
    summary = [{ label: '평균', sleepMin: avg('sleepMin'), feedCount: avg('feedCount'), diaperCount: avg('diaperCount') }];
  }

  // Donut data (proportion by estimated duration)
  const totalSleep  = raw.reduce((s, d) => s + d.sleepMin, 0);
  const totalFeed   = raw.reduce((s, d) => s + d.feedCount, 0) * 30;   // ~30min each
  const totalDiaper = raw.reduce((s, d) => s + d.diaperCount, 0) * 10; // ~10min each
  const totalAwake  = Math.max(0, days * 1440 - totalSleep - totalFeed - totalDiaper);

  const donutHTML = buildDonutSVG([
    { label: '수면', value: totalSleep,  color: 'var(--c-sleep)' },
    { label: '수유', value: totalFeed,   color: 'var(--c-feed)'  },
    { label: '기저귀', value: totalDiaper, color: 'var(--c-pee)' },
    { label: '기타', value: totalAwake,  color: '#E8E0D8'         },
  ]);

  const heatHTML = mode === 'week' ? buildHeatmap(7) : '';

  // Legend
  legendEl.innerHTML = [
    ['act-sleep-dot', '수면'],
    ['act-feed-dot',  '수유·식사'],
    ['act-diaper-dot','기저귀'],
  ].map(([cls, txt]) => `<div class="act-legend-item"><div class="act-legend-dot ${cls}"></div>${txt}</div>`).join('');

  const maxSleep  = Math.max(...summary.map(d => d.sleepMin), 60);
  const maxFeed   = Math.max(...summary.map(d => d.feedCount), 1);
  const maxDiaper = Math.max(...summary.map(d => d.diaperCount), 1);

  const barHTML = summary.map(d => {
    const sw = Math.round((d.sleepMin    / maxSleep)  * 55);
    const fw = Math.round((d.feedCount   / maxFeed)   * 25);
    const dw = Math.round((d.diaperCount / maxDiaper) * 20);
    const sleepH = `${Math.floor(d.sleepMin / 60)}h${d.sleepMin % 60 > 0 ? (d.sleepMin % 60) + 'm' : ''}`;
    const tip = `${sleepH} · 수유 ${d.feedCount}회 · 기저귀 ${d.diaperCount}회`;
    return `<div class="act-row">
      <div class="act-day">${d.label}</div>
      <div class="act-bar-track" title="${tip}">
        <div class="act-bar-seg act-sleep-seg"  style="width:${sw}%"></div>
        <div class="act-bar-seg act-feed-seg"   style="width:${fw}%"></div>
        <div class="act-bar-seg act-diaper-seg" style="width:${dw}%"></div>
      </div>
      <div class="act-label">${tip}</div>
    </div>`;
  }).join('');

  container.innerHTML = donutHTML + heatHTML +
    `<div class="heatmap-section-title" style="margin-top:14px">일별 기록</div>` + barHTML;
}

function renderGrowthSVG(metric) {
  const svgEl = document.getElementById('growth-svg');
  const badgeEl = document.getElementById('growth-percentile-badge');
  const recListEl = document.getElementById('growth-records');
  if (!svgEl) return;

  const gender = STATE.baby?.gender === 'girl' ? 'girl' : 'boy';
  const gd = GROWTH_DATA[gender][metric];
  const months = Array.from({ length: 25 }, (_, i) => i);

  // Chart coordinate helpers
  const L = 38, T = 14, R = 12, B = 22;
  const W = 300, H = 180;
  const cW = W - L - R, cH = H - T - B;

  const yRange = metric === 'height' ? { min: 43, max: 101 } : { min: 2, max: 16 };
  const xS = m => L + (m / 24) * cW;
  const yS = v => T + cH - ((v - yRange.min) / (yRange.max - yRange.min)) * cH;

  const polyline = (arr, color, dash, sw = 1.5) => {
    const pts = months.map(m => `${xS(m).toFixed(1)},${yS(arr[m]).toFixed(1)}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"/>`;
  };

  // Shade P3–P97 band
  const bandPts = [
    ...months.map(m => `${xS(m).toFixed(1)},${yS(gd.P97[m]).toFixed(1)}`),
    ...months.slice().reverse().map(m => `${xS(m).toFixed(1)},${yS(gd.P3[m]).toFixed(1)}`),
  ].join(' ');

  // Axis labels
  const xLabels = [0, 6, 12, 18, 24].map(m =>
    `<text x="${xS(m).toFixed(1)}" y="${(T + cH + 14).toFixed(1)}" text-anchor="middle" font-size="8" fill="#aaa">${m}m</text>`
  ).join('');
  const yTicks = metric === 'height'
    ? [50, 60, 70, 80, 90, 100]
    : [4, 6, 8, 10, 12, 14];
  const yLabels = yTicks.map(v =>
    `<line x1="${L}" y1="${yS(v).toFixed(1)}" x2="${(L + cW).toFixed(1)}" y2="${yS(v).toFixed(1)}" stroke="#f0f0f0" stroke-width="1"/>
     <text x="${(L - 3).toFixed(1)}" y="${(yS(v) + 3).toFixed(1)}" text-anchor="end" font-size="7.5" fill="#bbb">${v}</text>`
  ).join('');

  // Baby's recorded points
  const records = (STATE.growth || []).filter(r => r[metric]).sort((a, b) => a.date.localeCompare(b.date));
  let dotsSvg = '';
  let lineSvg = '';
  let latestPct = null;

  if (records.length > 0 && STATE.baby?.birthDate) {
    const birthMs = parseDate(STATE.baby.birthDate).getTime();
    const pts = records.map(r => {
      const ageMs = parseDate(r.date).getTime() - birthMs;
      const ageM  = Math.max(0, ageMs / (1000 * 60 * 60 * 24 * 30.44));
      const x = xS(Math.min(ageM, 24));
      const y = yS(Math.max(yRange.min, Math.min(yRange.max, r[metric])));
      return { x, y, ageM, val: r[metric] };
    });
    if (pts.length > 1) {
      lineSvg = `<polyline points="${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="#FF8040" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>`;
    }
    dotsSvg = pts.map(p =>
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#FF8040" stroke="white" stroke-width="1.5"/>`
    ).join('');
    const last = pts[pts.length - 1];
    latestPct = calcPercentile(last.val, last.ageM, metric, gender);
  }

  const unit = metric === 'height' ? 'cm' : 'kg';
  const metricLabel = metric === 'height' ? '키' : '몸무게';

  svgEl.innerHTML = `
    <polygon points="${bandPts}" fill="#FF8040" opacity="0.06"/>
    ${yLabels}
    ${polyline(gd.P3,  '#E8E0D8', '3,3', 1)}
    ${polyline(gd.P50, '#C8BFBA', '4,3', 1.5)}
    ${polyline(gd.P97, '#E8E0D8', '3,3', 1)}
    <text x="${xS(24) - 2}" y="${yS(gd.P97[24]) - 3}" font-size="7" fill="#C8BFBA" text-anchor="end">97</text>
    <text x="${xS(24) - 2}" y="${yS(gd.P50[24]) - 3}" font-size="7" fill="#C8BFBA" text-anchor="end">50</text>
    <text x="${xS(24) - 2}" y="${yS(gd.P3[24])  + 9}" font-size="7" fill="#C8BFBA" text-anchor="end">3</text>
    ${lineSvg}
    ${dotsSvg}
    ${xLabels}
    <line x1="${L}" y1="${T}" x2="${L}" y2="${T + cH}" stroke="#e0e0e0" stroke-width="1"/>
    <line x1="${L}" y1="${T + cH}" x2="${L + cW}" y2="${T + cH}" stroke="#e0e0e0" stroke-width="1"/>
  `;

  // Percentile badge
  if (latestPct && records.length > 0) {
    const last = records[records.length - 1];
    badgeEl.innerHTML = `<div class="growth-pct-row">
      <div class="growth-pct-icon">${latestPct.emoji}</div>
      <div>
        <div class="growth-pct-label">${metricLabel} ${last[metric]}${unit} · ${latestPct.label}</div>
        <div class="growth-pct-sub">또래 중 ${latestPct.pct}번째 백분위 (WHO 성장 기준)</div>
      </div>
    </div>`;
  } else {
    badgeEl.innerHTML = `<div class="rpt-empty" style="padding:10px">+ 기록 버튼으로 ${metricLabel}을 추가하면 곡선에 표시돼요</div>`;
  }

  // Records list
  const sorted = [...(STATE.growth || [])].filter(r => r[metric]).sort((a, b) => b.date.localeCompare(a.date));
  recListEl.innerHTML = sorted.length === 0 ? '' :
    `<div style="font-size:11px;color:var(--text-light);font-weight:700;margin-bottom:4px">기록 내역</div>` +
    sorted.map(r => `<div class="growth-rec-row">
      <span class="growth-rec-date">${r.date}</span>
      <span class="growth-rec-vals">${metric === 'height' ? `키 ${r.height}cm` : `${r.weight}kg`}</span>
      <button class="growth-rec-del" data-gid="${r.id}" aria-label="삭제">✕</button>
    </div>`).join('');
}

function renderHealthIssuesList() {
  const el = document.getElementById('rpt-issues');
  if (!el) return;
  const logs = [...(STATE.health.logs || [])].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 8);
  if (logs.length === 0) {
    el.innerHTML = '<div class="rpt-empty">건강 기록이 없어요<br>건강기록 탭에서 추가해보세요</div>';
    return;
  }
  const typeMap = { temp: '🌡️ 체온', rash: '🔴 발진', symptom: '😷 증상', other: '📝 기타' };
  el.innerHTML = logs.map(l => `
    <div class="rpt-issue-card">
      <div class="rpt-issue-top">
        <span class="rpt-issue-type">${typeMap[l.type] || l.type}</span>
        <span class="rpt-issue-date">${l.date} ${l.time}</span>
      </div>
      <div class="rpt-issue-detail">${l.detail}</div>
      ${l.photo ? `<img class="rpt-issue-photo" src="${l.photo}" alt="건강 기록 사진">` : ''}
    </div>`).join('');
}

function renderReport() {
  const infoEl = document.getElementById('rpt-baby-info');
  if (!infoEl) return;

  if (!STATE.baby) {
    infoEl.textContent = '아기 정보를 먼저 등록해주세요';
    return;
  }

  const ai = getAgeInfo(STATE.baby.birthDate);
  const ageText = ai ? `${ai.months}개월` : '';
  infoEl.textContent = `${STATE.baby.name} · ${ageText} · ${STATE.baby.gender === 'girl' ? '여아' : '남아'}`;

  renderActivityChart(reportMode);
  renderGrowthSVG(growthMetric);
  renderHealthIssuesList();
}

function initReportEvents() {
  // Mode toggle (7일 / 월 평균)
  document.getElementById('rpt-mode-seg')?.addEventListener('click', e => {
    const btn = e.target.closest('.rpt-seg-btn');
    if (!btn) return;
    reportMode = btn.dataset.rmode;
    document.querySelectorAll('#rpt-mode-seg .rpt-seg-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderActivityChart(reportMode);
  });

  // Growth metric toggle (키 / 몸무게)
  document.getElementById('rpt-gmet-seg')?.addEventListener('click', e => {
    const btn = e.target.closest('.rpt-seg-btn');
    if (!btn) return;
    growthMetric = btn.dataset.gmet;
    document.querySelectorAll('#rpt-gmet-seg .rpt-seg-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderGrowthSVG(growthMetric);
  });

  // Add growth record form toggle
  const growthForm = document.getElementById('growth-form');
  document.getElementById('add-growth-btn')?.addEventListener('click', () => {
    growthForm.style.display = growthForm.style.display === 'none' ? 'block' : 'none';
    if (growthForm.style.display === 'block') {
      document.getElementById('g-date').value = todayStr();
    }
  });
  document.getElementById('g-cancel')?.addEventListener('click', () => {
    growthForm.style.display = 'none';
  });
  document.getElementById('g-save')?.addEventListener('click', () => {
    const date   = document.getElementById('g-date').value;
    const height = parseFloat(document.getElementById('g-height').value);
    const weight = parseFloat(document.getElementById('g-weight').value);
    if (!date) { showToast('날짜를 입력해주세요'); return; }
    if (!height && !weight) { showToast('키 또는 몸무게를 입력해주세요'); return; }
    if (!STATE.growth) STATE.growth = [];
    const existing = STATE.growth.find(r => r.date === date);
    if (existing) {
      if (!isNaN(height)) existing.height = height;
      if (!isNaN(weight)) existing.weight = weight;
    } else {
      STATE.growth.push({
        id: uid(), date,
        height: isNaN(height) ? undefined : height,
        weight: isNaN(weight) ? undefined : weight,
      });
    }
    saveState();
    growthForm.style.display = 'none';
    document.getElementById('g-height').value = '';
    document.getElementById('g-weight').value = '';
    showToast('📏 성장 기록이 저장됐어요!');
    renderGrowthSVG(growthMetric);
  });

  // Delete growth record
  document.getElementById('growth-records')?.addEventListener('click', e => {
    const btn = e.target.closest('.growth-rec-del');
    if (!btn) return;
    STATE.growth = (STATE.growth || []).filter(r => r.id !== btn.dataset.gid);
    saveState();
    renderGrowthSVG(growthMetric);
  });

  // Download (print → PDF)
  document.getElementById('rpt-download')?.addEventListener('click', () => {
    switchHTab('report');
    setTimeout(() => window.print(), 200);
  });

  // Share
  function buildShareText() {
    if (!STATE.baby) return '';
    const ai = getAgeInfo(STATE.baby.birthDate);
    const ageText = ai ? `${ai.months}개월` : '';
    const last = [...(STATE.growth || [])].sort((a, b) => b.date.localeCompare(a.date))[0];
    const issues = (STATE.health.logs || []).slice(-3).map(l => `• [${l.date}] ${l.detail}`).join('\n');
    return `📋 ${STATE.baby.name} (${ageText}) 아기 리포트\n\n` +
      `📏 최근 성장\n${last ? `키 ${last.height || '-'}cm / 몸무게 ${last.weight || '-'}kg (${last.date})` : '기록 없음'}\n\n` +
      `🩺 최근 건강 이슈\n${issues || '없음'}\n\n베이비케어 앱으로 생성됨`;
  }

  function openShareSheet() {
    const text = buildShareText();
    const overlay = document.getElementById('share-overlay');
    overlay.style.display = 'flex';

    // 이메일
    document.getElementById('sh-email').onclick = () => {
      const subject = encodeURIComponent(`${STATE.baby?.name || '아기'} 리포트`);
      window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(text)}`;
      overlay.style.display = 'none';
    };

    // 카카오톡 (카카오 URL 스킴 → 미지원 시 카카오 공유 웹)
    const kakaoEl = document.getElementById('sh-kakao');
    const kakaoText = encodeURIComponent(text);
    kakaoEl.href = `kakaotalk://send?text=${kakaoText}`;
    kakaoEl.onclick = () => setTimeout(() => { overlay.style.display = 'none'; }, 300);

    // 닥터나우는 기존 href 그대로
    document.getElementById('sh-doctornow').onclick = () => { overlay.style.display = 'none'; };

    // 링크(텍스트) 복사
    document.getElementById('sh-copy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(text);
        showToast('📋 리포트 내용이 복사됐어요!');
      } catch {
        showToast('복사에 실패했어요');
      }
      overlay.style.display = 'none';
    };

    document.getElementById('sh-cancel').onclick = () => { overlay.style.display = 'none'; };
    overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };
  }

  document.getElementById('rpt-share')?.addEventListener('click', async () => {
    if (!STATE.baby) { showToast('아기 정보를 먼저 등록해주세요'); return; }
    const text = buildShareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: `${STATE.baby.name} 아기 리포트`, text });
        return;
      } catch { /* 취소 또는 미지원 */ }
    }
    openShareSheet();
  });
}

// ── MILESTONE CALENDAR ────────────────────────────────────────

const MILESTONES = [
  { m: 0,  label: 'BCG 접종',                       sub: '출생 후 4주 이내',              type: 'vaccine' },
  { m: 0,  label: 'B형간염 1차',                    sub: '출생 직후',                     type: 'vaccine' },
  { m: 1,  label: 'B형간염 2차',                    sub: '생후 1개월',                    type: 'vaccine' },
  { m: 1,  label: '영유아검진 1차',                  sub: '생후 1개월',                    type: 'check' },
  { m: 2,  label: 'DTaP·Hib·PCV·폴리오 1차',        sub: '생후 2개월 — 4종 동시접종',     type: 'vaccine' },
  { m: 2,  label: '로타바이러스 1차',                sub: '생후 2개월',                    type: 'vaccine' },
  { m: 2,  label: '영유아검진 2차',                  sub: '생후 2개월',                    type: 'check' },
  { m: 4,  label: 'DTaP·Hib·PCV·폴리오 2차',        sub: '생후 4개월 — 4종 동시접종',     type: 'vaccine' },
  { m: 4,  label: '로타바이러스 2차',                sub: '생후 4개월',                    type: 'vaccine' },
  { m: 4,  label: '영유아검진 3차',                  sub: '생후 4개월',                    type: 'check' },
  { m: 6,  label: 'DTaP·Hib·PCV·폴리오·HepB 3차',   sub: '생후 6개월 — 5종 동시접종',     type: 'vaccine' },
  { m: 6,  label: '로타바이러스 3차',                sub: '생후 6개월 (해당 제품만)',       type: 'vaccine' },
  { m: 6,  label: '이유식 시작',                     sub: '쌀미음부터 권고, 1일 1회',       type: 'food' },
  { m: 6,  label: '영유아검진 4차',                  sub: '생후 6개월',                    type: 'check' },
  { m: 7,  label: '중기 이유식',                     sub: '7~9개월, 다양한 식재료 도입',    type: 'food' },
  { m: 9,  label: '영유아검진 5차',                  sub: '생후 9개월',                    type: 'check' },
  { m: 10, label: '후기 이유식',                     sub: '10~12개월, 죽→진밥 전환',       type: 'food' },
  { m: 12, label: 'MMR·수두·Hib·PCV 4차',           sub: '생후 12~15개월',                type: 'vaccine' },
  { m: 12, label: 'A형간염 1차',                     sub: '생후 12~23개월',                type: 'vaccine' },
  { m: 12, label: '일본뇌염 1차',                    sub: '생후 12개월',                   type: 'vaccine' },
  { m: 12, label: '완료기 이유식',                   sub: '12개월~, 가족 식사 함께 시작',   type: 'food' },
  { m: 12, label: '영유아검진 6차',                  sub: '생후 12개월',                   type: 'check' },
  { m: 15, label: 'DTaP 4차',                        sub: '생후 15~18개월',                type: 'vaccine' },
  { m: 18, label: '영유아검진 7차',                  sub: '생후 18개월',                   type: 'check' },
  { m: 24, label: 'A형간염 2차',                     sub: '1차 접종 후 6개월',             type: 'vaccine' },
  { m: 24, label: '일본뇌염 2차',                    sub: '1차 접종 후 1개월',             type: 'vaccine' },
  { m: 24, label: '영유아검진 8차',                  sub: '생후 24개월',                   type: 'check' },
  { m: 36, label: '영유아검진 9차',                  sub: '생후 36개월',                   type: 'check' },
  { m: 48, label: 'DTaP 5차·폴리오 4차',             sub: '만 4~6세',                      type: 'vaccine' },
  { m: 48, label: '영유아검진 10차',                 sub: '생후 48개월',                   type: 'check' },
  { m: 54, label: '영유아검진 11차',                 sub: '생후 54개월',                   type: 'check' },
  { m: 60, label: 'MMR 2차',                         sub: '만 4~6세',                      type: 'vaccine' },
  { m: 66, label: '영유아검진 12차',                 sub: '생후 66개월',                   type: 'check' },
];

let calYear, calMonth;

function getMilestonesForMonth(birthDateStr, year, month) {
  const events = [];
  for (const ms of MILESTONES) {
    const d = new Date(birthDateStr);
    d.setMonth(d.getMonth() + ms.m);
    if (d.getFullYear() === year && d.getMonth() === month) {
      events.push({ ...ms, date: new Date(d) });
    }
  }
  return events.sort((a, b) => a.date - b.date);
}

function renderMilestoneCalendar() {
  const gridEl    = document.getElementById('cal-grid');
  const eventsEl  = document.getElementById('cal-events');
  const labelEl   = document.getElementById('cal-month-label');
  if (!gridEl) return;

  const birthStr = STATE.baby?.birthDate || null;

  if (!birthStr) {
    gridEl.innerHTML = '';
    eventsEl.innerHTML = '<div class="cal-no-baby">아기 정보를 먼저 등록해주세요 👶</div>';
    labelEl.textContent = '';
    return;
  }

  labelEl.textContent = `${calYear}년 ${calMonth + 1}월`;

  const events = getMilestonesForMonth(birthStr, calYear, calMonth);
  const dayEvents = {};
  for (const ev of events) {
    const d = ev.date.getDate();
    if (!dayEvents[d]) dayEvents[d] = new Set();
    dayEvents[d].add(ev.type);
  }

  const today      = new Date();
  const firstDow   = new Date(calYear, calMonth, 1).getDay();
  const daysInMon  = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev = new Date(calYear, calMonth, 0).getDate();

  let html = '';
  for (let i = firstDow - 1; i >= 0; i--) {
    html += `<div class="cal-cell other-month">${daysInPrev - i}</div>`;
  }
  for (let d = 1; d <= daysInMon; d++) {
    const dow = new Date(calYear, calMonth, d).getDay();
    const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;
    const cls = ['cal-cell'];
    if (isToday) cls.push('today');
    if (dow === 0) cls.push('sun');
    if (dow === 6) cls.push('sat');
    const dots = dayEvents[d]
      ? '<div class="cal-dots">' + [...dayEvents[d]].map(t => `<div class="cal-dot dot-${t}"></div>`).join('') + '</div>'
      : '';
    html += `<div class="${cls.join(' ')}">${d}${dots}</div>`;
  }
  const filled = firstDow + daysInMon;
  const tail = (7 - (filled % 7)) % 7;
  for (let d = 1; d <= tail; d++) {
    html += `<div class="cal-cell other-month">${d}</div>`;
  }
  gridEl.innerHTML = html;

  if (events.length === 0) {
    eventsEl.innerHTML = '<div class="cal-events-empty">이 달에는 일정이 없어요 🌱</div>';
  } else {
    const typeLabel = { vaccine: '💉 접종', food: '🥣 이유식', check: '🏥 검진' };
    const rows = events.map(ev => {
      const mm = ev.date.getMonth() + 1;
      const dd = ev.date.getDate();
      return `<div class="cal-event-item">
        <div class="cal-event-date type-${ev.type}">${mm}월<br>${dd}일</div>
        <div class="cal-event-info">
          <div class="cal-event-label">${ev.label}</div>
          <div class="cal-event-sub">${ev.sub}</div>
        </div>
        <div class="cal-event-badge type-${ev.type}">${typeLabel[ev.type]}</div>
      </div>`;
    }).join('');
    eventsEl.innerHTML = `<div class="cal-events-title">이달의 일정 (${events.length}건)</div>` + rows;
  }
}

function initMilestoneCalendar() {
  const today = new Date();
  calYear  = today.getFullYear();
  calMonth = today.getMonth();

  document.getElementById('cal-prev').addEventListener('click', () => {
    if (--calMonth < 0) { calMonth = 11; calYear--; }
    renderMilestoneCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    if (++calMonth > 11) { calMonth = 0; calYear++; }
    renderMilestoneCalendar();
  });

  renderMilestoneCalendar();
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
  initMilestoneCalendar();
  initReportEvents();
  initKeywordPicker();
  initVoice();

  // Refresh header every minute
  setInterval(updateHeader, 60000);
}

document.addEventListener('DOMContentLoaded', init);
