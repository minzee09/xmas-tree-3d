const COLORS = new Set(['red', 'gold', 'blue', 'pink', 'silver', 'green']);
const MAX_ENTRIES = 3000;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === '/api/entries') {
      if (req.method === 'GET') {
        const { results } = await env.DB
          .prepare('SELECT id, name, msg, color, at FROM entries ORDER BY at DESC LIMIT 500')
          .all();
        return json({ entries: results });
      }
      if (req.method === 'POST') {
        let body;
        try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
        const name = String(body?.name ?? '').trim().slice(0, 16);
        const msg = String(body?.msg ?? '').trim().slice(0, 80);
        const color = COLORS.has(body?.color) ? body.color : 'gold';
        if (!name || !msg) return json({ error: 'name and msg required' }, 400);

        const ip = await sha256(req.headers.get('cf-connecting-ip') || 'unknown');
        const now = Date.now();
        const recent = await env.DB
          .prepare('SELECT COUNT(*) AS n FROM entries WHERE ip = ? AND at > ?')
          .bind(ip, now - 60_000)
          .first('n');
        if (recent >= 3) return json({ error: 'too many requests' }, 429);
        const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM entries').first('n');
        if (total >= MAX_ENTRIES) return json({ error: 'guestbook full' }, 429);

        const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        const token = crypto.randomUUID();
        await env.DB
          .prepare('INSERT INTO entries (id, name, msg, color, at, token, ip) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(id, name, msg, color, now, await sha256(token), ip)
          .run();
        return json({ entry: { id, name, msg, color, at: now }, token }, 201);
      }
      return json({ error: 'method not allowed' }, 405);
    }

    const m = url.pathname.match(/^\/api\/entries\/([A-Za-z0-9]{1,40})$/);
    if (m) {
      if (req.method !== 'DELETE') return json({ error: 'method not allowed' }, 405);
      const token = req.headers.get('x-delete-token') || '';
      if (!token) return json({ error: 'forbidden' }, 403);
      const r = await env.DB
        .prepare('DELETE FROM entries WHERE id = ? AND token = ?')
        .bind(m[1], await sha256(token))
        .run();
      return r.meta.changes ? json({ ok: true }) : json({ error: 'not found' }, 404);
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(req);
  },
};
