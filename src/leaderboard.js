// ===== 에코 퀴-즈 · leaderboard API client =====
// 서버(/api)가 없거나 실패하면 graceful degrade → null 반환 (게임은 계속 동작)

export async function fetchLeaderboard() {
  try {
    const r = await fetch('/api/leaderboard', { headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    const data = await r.json();
    return Array.isArray(data.top) ? data.top : [];
  } catch {
    return null;
  }
}

// 성공 시 서버가 반영된 top 10을 반환. 실패 시 null.
export async function submitScore(name, score) {
  try {
    const r = await fetch('/api/score', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, score }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return Array.isArray(data.top) ? data.top : [];
  } catch {
    return null;
  }
}
