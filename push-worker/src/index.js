// MeuTreino Push Worker
// Recebe agendamentos de notificação, dispara via Web Push quando o tempo chega.
// Cron tick a cada 1 minuto → lag máximo 0-60s no descanso.

import webpush from 'web-push';

const ALLOWED_ORIGIN = 'https://lucasrobertoooo.github.io';

function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
    ...extra,
  };
}

function unauthorized(env, req) {
  const got = req.headers.get('Authorization');
  return got !== `Bearer ${env.SHARED_TOKEN}`;
}

async function hashEndpoint(endpoint) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

function configureVapid(env) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

async function sendPushOne(env, subscription, title, body) {
  configureVapid(env);
  await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors() });

    // /vapid-key — pública por design (usada pelo PushManager.subscribe)
    if (url.pathname === '/vapid-key' && req.method === 'GET') {
      return Response.json({ publicKey: env.VAPID_PUBLIC_KEY }, { headers: cors() });
    }

    if (unauthorized(env, req)) {
      return new Response('Unauthorized', { status: 401, headers: cors() });
    }

    try {
      if (url.pathname === '/subscribe' && req.method === 'POST') {
        const { subscription } = await req.json();
        if (!subscription?.endpoint) {
          return new Response('Invalid subscription', { status: 400, headers: cors() });
        }
        const hash = await hashEndpoint(subscription.endpoint);
        await env.KV.put(`sub:${hash}`, JSON.stringify(subscription));
        return Response.json({ hash }, { headers: cors() });
      }

      if (url.pathname === '/schedule' && req.method === 'POST') {
        const { hash, fireAt, title, body } = await req.json();
        if (!hash || !fireAt) {
          return new Response('Missing params', { status: 400, headers: cors() });
        }
        const id = crypto.randomUUID();
        const ttl = Math.max(120, Math.floor((fireAt - Date.now()) / 1000) + 300);
        await env.KV.put(
          `pending:${fireAt}:${hash}:${id}`,
          JSON.stringify({
            hash,
            title: title || '⏱️ Descanso terminado',
            body: body || 'Próxima série!',
          }),
          { expirationTtl: ttl }
        );
        return Response.json({ id, willFireAt: fireAt }, { headers: cors() });
      }

      if (url.pathname === '/cancel' && req.method === 'POST') {
        const { hash } = await req.json();
        if (!hash) return new Response('Missing hash', { status: 400, headers: cors() });
        let cursor, deleted = 0;
        do {
          const list = await env.KV.list({ prefix: 'pending:', cursor });
          for (const k of list.keys) {
            if (k.name.includes(`:${hash}:`)) {
              await env.KV.delete(k.name);
              deleted++;
            }
          }
          cursor = list.cursor;
        } while (cursor);
        return Response.json({ ok: true, deleted }, { headers: cors() });
      }

      if (url.pathname === '/test' && req.method === 'POST') {
        const { hash } = await req.json();
        const sub = await env.KV.get(`sub:${hash}`, 'json');
        if (!sub) return new Response('No subscription for this hash', { status: 404, headers: cors() });
        await sendPushOne(env, sub, '✓ Push funcionando', 'Tudo certo, Lucas');
        return Response.json({ ok: true }, { headers: cors() });
      }

      return new Response('Not Found', { status: 404, headers: cors() });
    } catch (e) {
      console.error('handler error:', e.message);
      return new Response(`Error: ${e.message}`, { status: 500, headers: cors() });
    }
  },

  // Cron tick (a cada 1 min): dispara notificações agendadas vencidas
  async scheduled(event, env, ctx) {
    const now = Date.now();
    let cursor, fired = 0;
    do {
      const list = await env.KV.list({ prefix: 'pending:', cursor });
      for (const k of list.keys) {
        const parts = k.name.split(':');
        const fireAt = parseInt(parts[1]);
        if (fireAt <= now) {
          const data = await env.KV.get(k.name, 'json');
          if (data) {
            const sub = await env.KV.get(`sub:${data.hash}`, 'json');
            if (sub) {
              try {
                await sendPushOne(env, sub, data.title, data.body);
                fired++;
              } catch (e) {
                console.error('push send fail:', e.message);
                // se subscription expirou (410), remove
                if (e.statusCode === 404 || e.statusCode === 410) {
                  await env.KV.delete(`sub:${data.hash}`);
                }
              }
            }
          }
          await env.KV.delete(k.name);
        }
      }
      cursor = list.cursor;
    } while (cursor);
    console.log(`cron tick fired ${fired} push(es)`);
  },
};
