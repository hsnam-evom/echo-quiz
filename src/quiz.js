// ===== 에코 퀴-즈 · core game logic (pure, framework-free) =====

export const QUESTIONS_PER_GAME = 10;
export const SCORE_FIRST = 10; // 1차 시도 정답
export const SCORE_SECOND = 5; // 2차 시도(재도전) 정답
export const MAX_SCORE = QUESTIONS_PER_GAME * SCORE_FIRST; // 100

// Fisher–Yates shuffle (returns a new array)
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 100문항 중 무작위 N문항 (중복 없이)
export function pickGame(all, n = QUESTIONS_PER_GAME) {
  return shuffle(all).slice(0, n);
}

// 한 문항의 4지선다 구성 — 정답 위치를 매번 무작위로 셔플
export function buildChoices(q) {
  const choices = shuffle([q.answer, ...q.distractors]);
  return { choices, correctIndex: choices.indexOf(q.answer) };
}

// 결과(outcome)별 점수
export function scoreFor(outcome) {
  if (outcome === 'first') return SCORE_FIRST;
  if (outcome === 'second') return SCORE_SECOND;
  return 0;
}

// 점수별 재미 문구 (높을수록 위)
export const TIERS = [
  { min: 90, text: '👑 에코의 신, 에코 그 자체, 살아있는 에코 🫀' },
  { min: 70, text: '❤️ 당신은 에코밖에 모르는 에코바보 ❤️' },
  { min: 50, text: '🩺 Mild 에코지식 이상 소견이 관찰됩니다. 지속적인 추적 관찰이 필요합니다. 👀' },
  { min: 25, text: '⚠️ Moderate 에코지식 이상 소견이 관찰됩니다. 즉시 가이드라인을 방문하세요 📖' },
  { min: 0, text: '🚨 혈류가 뇌까지 안간듯 합니다. 신속한 cardiac output 확인이 필요합니다. 🩸' },
];

export function tierFor(score) {
  return (TIERS.find((t) => score >= t.min) || TIERS[TIERS.length - 1]).text;
}

// 닉네임 정리/검증: 제어문자 제거, 공백 정리, 최대 12자
export function cleanNickname(raw) {
  let out = '';
  for (const ch of String(raw || '')) {
    const c = ch.codePointAt(0);
    if (c < 32 || c === 127) continue; // 제어문자 스킵
    out += ch;
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, 12);
}
