// ===== 에코 퀴-즈 · controller / view (vanilla ESM) =====
import {
  pickGame, buildChoices, scoreFor, tierFor, cleanNickname,
  QUESTIONS_PER_GAME, MAX_SCORE,
} from './quiz.js';
import { fetchLeaderboard, submitScore } from './leaderboard.js';

const app = document.getElementById('app');
const KEYS = ['A', 'B', 'C', 'D'];

const state = {
  all: [],
  nickname: '',
  game: null, // { questions, index, results: [], score }
  view: null, // { q, choices, correctIndex, attempt, done }
  lbCache: null, // 마지막 리더보드 + 활성화 여부
};

// ---------- utils ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- sound (WebAudio, 8-bit) ----------
const sound = (() => {
  let ctx = null;
  let muted = localStorage.getItem('echo:muted') === '1';
  const ensure = () => {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const beep = (freq, start, dur, type = 'square', gain = 0.05) => {
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur);
  };
  return {
    toggle() { muted = !muted; localStorage.setItem('echo:muted', muted ? '1' : '0'); return muted; },
    isMuted: () => muted,
    click() { if (!muted) beep(440, 0, 0.05, 'square', 0.03); },
    correct() { if (muted) return; beep(660, 0, 0.08); beep(880, 0.08, 0.12); },
    wrong() { if (muted) return; beep(180, 0, 0.18, 'sawtooth', 0.06); },
    clear() { if (muted) return; [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.1, 0.14, 'square', 0.05)); },
  };
})();

function syncMuteBtn() {
  const b = document.getElementById('mute');
  if (b) b.textContent = sound.isMuted() ? '🔇' : '🔊';
}
document.getElementById('mute').addEventListener('click', () => { sound.toggle(); syncMuteBtn(); });
syncMuteBtn();

// ---------- screens ----------
function renderStart(prefill = '') {
  state.game = null; state.view = null;
  app.innerHTML = `
    <div class="title">
      <h1>에코 퀴-즈</h1>
      <div class="sub">ECHO QUIZ · 심초음파 100문항 챌린지</div>
    </div>
    <div class="panel">
      <label class="label" for="nick">▶ 닉네임을 입력하세요 (최대 12자)</label>
      <input id="nick" class="input" maxlength="12" autocomplete="off" spellcheck="false"
             placeholder="EX) 심초음파마스터" value="${esc(prefill)}" />
      <div class="err" id="nick-err"></div>
      <div class="start-actions">
        <button class="btn btn-primary" id="start">▶ START</button>
        <button class="btn btn-ghost" id="to-lb">🏆 리더보드 보기</button>
      </div>
      <div class="hint">랜덤 10문제 · 틀리면 한 번 더 기회 · 정답 위치는 매번 바뀝니다</div>
    </div>`;
  const input = document.getElementById('nick');
  const err = document.getElementById('nick-err');
  const go = () => {
    const name = cleanNickname(input.value);
    if (!name) { err.textContent = '닉네임을 입력해 주세요!'; input.focus(); return; }
    sound.click();
    startGame(name);
  };
  document.getElementById('start').addEventListener('click', go);
  document.getElementById('to-lb').addEventListener('click', () => { sound.click(); renderLeaderboard('start'); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  input.focus();
}

function startGame(name) {
  state.nickname = name;
  state.game = { questions: pickGame(state.all, QUESTIONS_PER_GAME), index: 0, results: [], score: 0 };
  renderQuestion();
}

function renderQuestion() {
  const g = state.game;
  const q = g.questions[g.index];
  const { choices, correctIndex } = buildChoices(q);
  state.view = { q, choices, correctIndex, attempt: 1, done: false };
  const pct = Math.round((g.index / QUESTIONS_PER_GAME) * 100);

  app.innerHTML = `
    <div class="panel">
      <div class="hud">
        <span>${esc(state.nickname)}</span>
        <span>Q ${g.index + 1} / ${QUESTIONS_PER_GAME} · <span class="score">${g.score}점</span></span>
      </div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <span class="cat">${esc(q.type)} · ${esc(q.category)}</span>
      <div class="q">${esc(q.question)}</div>
      <div class="choices" id="choices">
        ${choices.map((c, i) => `
          <button class="btn choice" data-i="${i}">
            <span class="k">${KEYS[i]}</span>${esc(c)}
          </button>`).join('')}
      </div>
      <div class="feedback" id="fb"></div>
      <div id="reveal"></div>
    </div>`;

  document.querySelectorAll('#choices .choice').forEach((btn) => {
    btn.addEventListener('click', () => onChoice(Number(btn.dataset.i)));
  });
}

function onChoice(i) {
  const v = state.view;
  if (!v || v.done) return;
  const btn = app.querySelector(`.choice[data-i="${i}"]`);
  if (!btn || btn.disabled) return;
  const fb = document.getElementById('fb');

  if (i === v.correctIndex) {
    btn.classList.add('correct');
    sound.correct();
    const outcome = v.attempt === 1 ? 'first' : 'second';
    fb.className = 'feedback good';
    fb.textContent = outcome === 'first' ? '✅ 정답! (+10점)' : '✅ 정답! (재도전 +5점)';
    finishQuestion(outcome);
  } else {
    btn.classList.add('wrong');
    btn.disabled = true;
    sound.wrong();
    if (v.attempt === 1) {
      v.attempt = 2;
      fb.className = 'feedback retry';
      fb.textContent = '❌ 오답! 한 번 더 기회를 드립니다. 다시 골라보세요.';
    } else {
      // 2차 시도 실패 → 정답 공개
      const correctBtn = app.querySelector(`.choice[data-i="${v.correctIndex}"]`);
      if (correctBtn) correctBtn.classList.add('correct');
      fb.className = 'feedback bad';
      fb.textContent = '❌ 두 번 다 오답… 정답을 확인하세요.';
      finishQuestion('fail');
    }
  }
}

function finishQuestion(outcome) {
  const v = state.view;
  v.done = true;
  state.game.results.push({ q: v.q, outcome });
  state.game.score += scoreFor(outcome);

  // 점수 HUD 갱신
  const sc = app.querySelector('.hud .score');
  if (sc) sc.textContent = `${state.game.score}점`;

  // 모든 보기 비활성화
  app.querySelectorAll('#choices .choice').forEach((b) => { b.disabled = true; });

  // 정답 + 해설 공개
  const last = state.game.index + 1 >= QUESTIONS_PER_GAME;
  document.getElementById('reveal').innerHTML = `
    <div class="explain">
      <div class="h">정답</div>
      <div class="ans">✔ ${esc(v.q.answer)}</div>
      <div class="h">해설</div>
      <div class="body">${esc(v.q.explanation)}</div>
    </div>
    <button class="btn btn-primary" id="next">${last ? '🏁 결과 보기' : '▶ 다음 문제'}</button>`;
  const next = document.getElementById('next');
  next.addEventListener('click', () => {
    sound.click();
    if (last) { renderResult(); }
    else { state.game.index += 1; renderQuestion(); }
  });
  next.focus();
}

async function renderResult() {
  const g = state.game;
  const counts = { first: 0, second: 0, fail: 0 };
  g.results.forEach((r) => { counts[r.outcome] += 1; });
  sound.clear();

  app.innerHTML = `
    <div class="title"><h1>RESULT</h1></div>
    <div class="panel">
      <div class="score-big">${g.score} <span style="font-size:.4em">/ ${MAX_SCORE}</span></div>
      <div class="score-sub">${esc(state.nickname)} · 1차정답 ${counts.first} · 재도전정답 ${counts.second} · 오답 ${counts.fail}</div>
      <div class="tier">${esc(tierFor(g.score))}</div>
      <div class="summary" id="summary">
        ${g.results.map((r, i) => summaryItem(r, i)).join('')}
      </div>
      <div class="row-2">
        <button class="btn btn-primary" id="retry">🔁 재도전</button>
        <button class="btn btn-ghost" id="lb">🏆 리더보드</button>
      </div>
      <div class="lb-note" id="submit-note">리더보드에 점수 등록 중…</div>
    </div>`;

  document.getElementById('retry').addEventListener('click', () => { sound.click(); renderStart(); });
  document.getElementById('lb').addEventListener('click', () => { sound.click(); renderLeaderboard('result'); });

  // 점수 등록
  const note = document.getElementById('submit-note');
  const top = await submitScore(state.nickname, g.score);
  if (top) { state.lbCache = { top, enabled: true }; note.textContent = '✔ 리더보드에 등록되었습니다.'; }
  else { state.lbCache = { top: [], enabled: false }; note.textContent = '⚠ 리더보드 서버에 연결할 수 없어 이번 점수는 등록되지 않았습니다.'; }
}

const MARK = { first: ['✅', 'first', '1차'], second: ['🟡', 'second', '재도전'], fail: ['❌', 'fail', '오답'] };
function summaryItem(r, i) {
  const [icon, cls, label] = MARK[r.outcome];
  return `
    <div class="sum-item">
      <div class="top">
        <span class="mark ${cls}">${icon}</span>
        <span class="qtext">${i + 1}. ${esc(r.q.question)}</span>
      </div>
      <details>
        <summary>정답·해설 보기 (${label})</summary>
        <div class="ans">✔ ${esc(r.q.answer)}</div>
        <div class="exp">${esc(r.q.explanation)}</div>
      </details>
    </div>`;
}

async function renderLeaderboard(from) {
  app.innerHTML = `
    <div class="title"><h1>🏆 LEADERBOARD</h1><div class="sub">상위 10명</div></div>
    <div class="panel">
      <div class="lb" id="lb-body"><div class="lb-empty blink">불러오는 중…</div></div>
      <button class="btn btn-ghost" id="back">◀ 돌아가기</button>
    </div>`;
  document.getElementById('back').addEventListener('click', () => {
    sound.click();
    if (from === 'result' && state.game) renderResult();
    else renderStart(state.nickname);
  });

  let data = state.lbCache;
  const fresh = await fetchLeaderboard();
  if (fresh) data = { top: fresh, enabled: true };
  else if (!data) data = { top: [], enabled: false };

  const body = document.getElementById('lb-body');
  if (!data.enabled) {
    body.innerHTML = `<div class="lb-empty">리더보드 서버에 연결할 수 없습니다.<br/>잠시 후 다시 시도해 주세요.</div>`;
    return;
  }
  if (!data.top.length) {
    body.innerHTML = `<div class="lb-empty">아직 기록이 없습니다.<br/>첫 번째 도전자가 되어보세요! 🫀</div>`;
    return;
  }
  let highlighted = false;
  body.innerHTML = data.top.map((row, idx) => {
    const rank = idx + 1;
    const me = !highlighted && row.name === state.nickname && row.score === (state.game ? state.game.score : -1);
    if (me) highlighted = true;
    return `<div class="lb-row rk${rank} ${me ? 'me' : ''}">
      <span class="rk">${rank}</span>
      <span class="nm">${esc(row.name)}</span>
      <span class="sc">${row.score}점</span>
    </div>`;
  }).join('');
}

// ---------- keyboard ----------
document.addEventListener('keydown', (e) => {
  if (state.view && !state.view.done) {
    const n = ['1', '2', '3', '4'].indexOf(e.key);
    if (n >= 0) { onChoice(n); return; }
  }
  if (e.key === 'Enter') {
    const next = document.getElementById('next');
    if (next) { e.preventDefault(); next.click(); }
  }
});

// ---------- boot ----------
(async function boot() {
  try {
    const r = await fetch('/questions.json');
    state.all = await r.json();
  } catch {
    app.innerHTML = `<div class="panel"><div class="lb-empty">문제 데이터를 불러오지 못했습니다.</div></div>`;
    return;
  }
  renderStart();
})();
