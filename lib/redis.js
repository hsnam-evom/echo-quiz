// ===== Upstash Redis REST helper (CommonJS, used by /api functions) =====
// Vercel Marketplace의 Upstash 통합은 KV_REST_API_* 또는 UPSTASH_REDIS_REST_* 환경변수를 주입한다.
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

const hasRedis = () => Boolean(URL && TOKEN);

// 단일 Redis 명령 실행 (예: cmd(['ZADD', key, score, member]))
async function cmd(args) {
  if (!hasRedis()) throw new Error('no_redis_config');
  const r = await fetch(URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error('redis_http_' + r.status);
  const j = await r.json();
  if (j.error) throw new Error('redis_err: ' + j.error);
  return j.result;
}

const LB_KEY = 'echo:lb';
const MAX_KEEP = 200; // 저장 상한 (상위 200명만 유지)

// member 인코딩: ts|rand|realScore|encodeURIComponent(name)
// '|' 와 name 충돌 방지를 위해 name은 encodeURIComponent 처리(‘|’→%7C)
function encodeMember(name, realScore, ts, rand) {
  return `${ts}|${rand}|${realScore}|${encodeURIComponent(name)}`;
}

function parseMember(member) {
  const i1 = member.indexOf('|');
  const i2 = member.indexOf('|', i1 + 1);
  const i3 = member.indexOf('|', i2 + 1);
  const ts = Number(member.slice(0, i1));
  const realScore = Number(member.slice(i2 + 1, i3));
  let name = '익명';
  try { name = decodeURIComponent(member.slice(i3 + 1)) || '익명'; } catch { /* keep default */ }
  return { name, score: realScore, ts };
}

// 정렬 점수 = 실점수 - ts/1e13  → 동점 시 먼저 달성한(작은 ts) 쪽이 상위
function sortKey(realScore, ts) {
  return realScore - ts / 1e13;
}

async function topN(n = 10) {
  // 저장된 전체(최대 MAX_KEEP)를 점수 내림차순으로 받아 이름당 최고 기록만 남긴다.
  // 정렬 순서상 같은 이름의 첫 등장 = 그 사람의 최고점(동점이면 먼저 달성). 중복 제거.
  const members = await cmd(['ZREVRANGE', LB_KEY, '0', String(MAX_KEEP - 1)]);
  const seen = new Set();
  const out = [];
  for (const m of members || []) {
    const e = parseMember(m);
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    out.push(e);
    if (out.length >= n) break;
  }
  return out;
}

async function addScore(name, realScore, ts, rand) {
  const member = encodeMember(name, realScore, ts, rand);
  await cmd(['ZADD', LB_KEY, String(sortKey(realScore, ts)), member]);
  // 상위 MAX_KEEP명만 유지 (가장 낮은 순위부터 제거)
  await cmd(['ZREMRANGEBYRANK', LB_KEY, '0', String(-MAX_KEEP - 1)]);
  return member;
}

module.exports = { hasRedis, topN, addScore, LB_KEY };
