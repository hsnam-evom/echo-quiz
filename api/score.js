// POST /api/score  { name, score } → { top: [...], enabled: bool }
const { hasRedis, topN, addScore } = require('../lib/redis');

const BANNED = ['시발', '씨발', 'fuck', 'shit', '병신', '좆', '개새']; // 최소 욕설 마스킹

function cleanName(raw) {
  let out = '';
  for (const ch of String(raw == null ? '' : raw)) {
    const c = ch.codePointAt(0);
    if (c < 32 || c === 127) continue; // 제어문자 제거
    out += ch;
  }
  out = out.replace(/\s+/g, ' ').trim().slice(0, 12);
  const low = out.toLowerCase();
  if (BANNED.some((w) => low.includes(w))) out = '익명선생';
  return out || '익명';
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 4096) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const body = await readBody(req);
  const name = cleanName(body.name);
  let score = Math.round(Number(body.score));
  if (!Number.isFinite(score)) score = 0;
  score = Math.max(0, Math.min(100, score));

  if (!hasRedis()) {
    res.status(200).json({ top: [], enabled: false });
    return;
  }
  try {
    const ts = Date.now();
    const rand = Math.floor(Math.random() * 1e9);
    await addScore(name, score, ts, rand);
    const top = await topN(10);
    res.setHeader('cache-control', 'no-store');
    res.status(200).json({ top, enabled: true });
  } catch (e) {
    res.status(200).json({ top: [], enabled: false, error: String(e.message || e) });
  }
};
