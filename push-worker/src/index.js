// MeuTreino Push Worker — v2 (Web Crypto nativo, sem dependência de web-push npm)
// Motivo da rewrite: web-push usa crypto.createECDH que não existe no nodejs_compat de Workers.
// Esta versão usa só Web Crypto API. Sem payload encryption — o SW do app injeta título/body
// fixo, então pushes "vazios" (apenas tickle) já bastam pra disparar a notificação no iOS.

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

// ============ Base64url helpers ============
function b64urlEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlDecode(str) {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hashEndpoint(endpoint) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============ VAPID JWT (ES256) ============
async function importVapidPrivateKey(privateKeyB64url, publicKeyB64url) {
  // VAPID public key: 65 bytes (0x04 || X(32) || Y(32))
  const pub = b64urlDecode(publicKeyB64url);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error(`Invalid VAPID public key: len=${pub.length}, byte0=${pub[0]}`);
  }
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: privateKeyB64url,
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    ext: true,
  };
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

async function makeVapidJWT(env, audience) {
  const headerJson = JSON.stringify({ typ: 'JWT', alg: 'ES256' });
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600; // 12h
  const claimsJson = JSON.stringify({ aud: audience, exp, sub: env.VAPID_SUBJECT });
  const enc = new TextEncoder();
  const headerB64 = b64urlEncode(enc.encode(headerJson));
  const claimsB64 = b64urlEncode(enc.encode(claimsJson));
  const signingInput = `${headerB64}.${claimsB64}`;
  const key = await importVapidPrivateKey(env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    key,
    enc.encode(signingInput)
  );
  return `${signingInput}.${b64urlEncode(new Uint8Array(sig))}`;
}

// ============ Send push ============
// Tickle-only push (sem payload). O Service Worker do app trata título/body fixo.
async function sendPushOne(env, subscription) {
  const audience = new URL(subscription.endpoint).origin;
  const jwt = await makeVapidJWT(env, audience);
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      'TTL': '60',
      'Urgency': 'high',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Push ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

// ============ Routes ============
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors() });

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
        const { hash, fireAt } = await req.json();
        if (!hash || !fireAt) {
          return new Response('Missing params', { status: 400, headers: cors() });
        }
        const id = crypto.randomUUID();
        const ttl = Math.max(120, Math.floor((fireAt - Date.now()) / 1000) + 300);
        await env.KV.put(`pending:${fireAt}:${hash}:${id}`, JSON.stringify({ hash }), { expirationTtl: ttl });
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
        await sendPushOne(env, sub);
        return Response.json({ ok: true }, { headers: cors() });
      }

      return new Response('Not Found', { status: 404, headers: cors() });
    } catch (e) {
      console.error('handler error:', e.message, e.stack);
      return new Response(`Error: ${e.message}`, { status: 500, headers: cors() });
    }
  },

  async scheduled(event, env, ctx) {
    const now = Date.now();
    let cursor, fired = 0, deleted = 0;
    do {
      const list = await env.KV.list({ prefix: 'pending:', cursor });
      for (const k of list.keys) {
        const parts = k.name.split(':');
        const fireAt = parseInt(parts[1]);
        if (fireAt <= now) {
          const data = await env.KV.get(k.name, 'json');
          if (data?.hash) {
            const sub = await env.KV.get(`sub:${data.hash}`, 'json');
            if (sub) {
              try {
                await sendPushOne(env, sub);
                fired++;
              } catch (e) {
                console.error('push send fail:', e.message);
                if (e.status === 404 || e.status === 410) {
                  await env.KV.delete(`sub:${data.hash}`);
                }
              }
            }
          }
          await env.KV.delete(k.name);
          deleted++;
        }
      }
      cursor = list.cursor;
    } while (cursor);
    console.log(`cron tick: fired=${fired} cleared=${deleted}`);
  },
};
