import {
  registerOptions,
  registerVerify,
  authOptions,
  verifyAssertion,
} from "./webauthn.js";
import { transcribe, clean, commitRamble, PipelineError } from "./pipeline.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(env, origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const route = `${request.method} ${url.pathname}`;
      switch (route) {
        case "GET /health":
          return json({ ok: true }, 200, cors);

        case "POST /register/options": {
          if (!originAllowed(env, origin)) return json({ error: "bad origin" }, 403, cors);
          const r = await registerOptions(env, request);
          return json(r.body || { error: r.error }, r.status, cors);
        }
        case "POST /register/verify": {
          if (!originAllowed(env, origin)) return json({ error: "bad origin" }, 403, cors);
          const r = await registerVerify(env, request, origin);
          return json(r.body || { error: r.error }, r.status, cors);
        }
        case "POST /auth/options": {
          if (!originAllowed(env, origin)) return json({ error: "bad origin" }, 403, cors);
          const r = await authOptions(env);
          return json(r.body || { error: r.error }, r.status, cors);
        }
        case "POST /session":
          return await handleSession(request, env, origin, cors);

        default:
          return json({ error: "not found" }, 404, cors);
      }
    } catch (err) {
      console.error(err.stack || err.message);
      return json({ error: "something broke on our end" }, 500, cors);
    }
  },
};

async function handleSession(request, env, origin, cors) {
  if (!originAllowed(env, origin)) {
    return json({ error: "bad origin" }, 403, cors);
  }

  // Cheap reject before touching the body.
  const declared = parseInt(request.headers.get("Content-Length") || "0", 10);
  const maxBytes = parseInt(env.MAX_UPLOAD_BYTES, 10);
  if (declared > maxBytes) {
    return json(
      { error: "that recording is too big — cap is about 10 minutes" },
      413,
      cors
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "expected multipart form data" }, 400, cors);

  // ---- auth ----
  if (env.AUTH_MODE === "token") {
    const header = request.headers.get("Authorization") || "";
    if (!env.BEARER_TOKEN || !timingSafeEqual(header, `Bearer ${env.BEARER_TOKEN}`)) {
      return json({ error: "not you" }, 401, cors);
    }
  } else {
    let assertion;
    try {
      assertion = JSON.parse(form.get("assertion") || "");
    } catch {
      return json({ error: "missing passkey assertion" }, 401, cors);
    }
    const ok = await verifyAssertion(env, origin, form.get("challengeId"), assertion);
    if (!ok) return json({ error: "passkey check failed — try again" }, 401, cors);
  }

  // ---- caps ----
  const audio = form.get("audio");
  if (!audio || typeof audio === "string") {
    return json({ error: "no audio attached" }, 400, cors);
  }
  if (audio.size > maxBytes) {
    return json(
      { error: "that recording is too big — cap is about 10 minutes" },
      413,
      cors
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const countKey = `sessions:${today}`;
  const count = parseInt((await env.KV.get(countKey)) || "0", 10);
  if (count >= parseInt(env.MAX_SESSIONS_PER_DAY, 10)) {
    return json(
      { error: "daily session cap reached — tomorrow is another day" },
      429,
      cors
    );
  }
  await env.KV.put(countKey, String(count + 1), { expirationTtl: 172800 });

  // ---- pipeline ----
  try {
    const transcript = await transcribe(env, audio);
    const cleaned = await clean(env, transcript);
    const path = await commitRamble(env, cleaned);
    return json({ ok: true, path }, 200, cors);
  } catch (err) {
    if (err instanceof PipelineError) {
      console.error(`${err.stage} error ${err.status}: ${err.detail}`);
      const friendly = {
        stt: "transcription hiccuped — the recording is safe on your phone, try sending again",
        clean: "cleanup model hiccuped — try sending again",
        commit: "couldn't file the note to the inbox — try sending again",
      };
      return json({ error: friendly[err.stage] }, 502, cors);
    }
    throw err;
  }
}

function originAllowed(env, origin) {
  return env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).includes(origin);
}

function corsHeaders(env, origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (originAllowed(env, origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
