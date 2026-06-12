// GET /api/leaderboard → { top: [{name, score, ts}], enabled: bool }
const { hasRedis, topN } = require('../lib/redis');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  if (!hasRedis()) {
    res.status(200).json({ top: [], enabled: false });
    return;
  }
  try {
    const top = await topN(10);
    res.setHeader('cache-control', 'no-store');
    res.status(200).json({ top, enabled: true });
  } catch (e) {
    res.status(200).json({ top: [], enabled: false, error: String(e.message || e) });
  }
};
