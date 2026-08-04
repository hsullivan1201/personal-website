import { VOCABULARY, CLEAN_PROMPT, DISTILL_PROMPT } from "./config.js";

const EXT_BY_MIME = {
  "audio/mp4": "mp4",
  "audio/aac": "aac",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
};

export async function transcribe(env, audioBlob) {
  const mime = (audioBlob.type || "audio/mp4").split(";")[0];
  const ext = EXT_BY_MIME[mime] || "mp4";

  const form = new FormData();
  form.append("file", audioBlob, `ramble.${ext}`);
  form.append("model", env.STT_MODEL);
  form.append("response_format", "text");
  // Keyword hints: a standing vocabulary of proper nouns she actually uses.
  form.append(
    "prompt",
    `Casual spoken notes. Vocabulary that may come up: ${VOCABULARY.join(", ")}.`
  );

  const res = await fetch(`${env.STT_API_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.STT_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new PipelineError("stt", res.status, detail);
  }
  const text = (await res.text()).trim();
  if (!text) throw new PipelineError("stt", 200, "empty transcript");
  return text;
}

export async function clean(env, transcript) {
  const res = await fetch(`${env.LLM_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.CLEAN_MODEL,
      messages: [
        { role: "system", content: CLEAN_PROMPT },
        { role: "user", content: transcript },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new PipelineError("clean", res.status, detail);
  }
  const data = await res.json();
  const out = data.choices?.[0]?.message?.content?.trim();
  if (!out) throw new PipelineError("clean", 200, "empty completion");
  return out;
}

// Extract-only second pass: one-sentence summary + action items. Best
// effort by design — any failure returns null and the ramble files bare.
export async function distill(env, cleaned) {
  try {
    const res = await fetch(`${env.LLM_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.DISTILL_MODEL || env.CLEAN_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DISTILL_PROMPT },
          { role: "user", content: cleaned },
        ],
      }),
    });
    if (!res.ok) throw new Error(`distill ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "");
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions.filter((a) => typeof a === "string" && a.trim()).map((a) => a.trim())
      : [];
    return summary || actions.length ? { summary, actions } : null;
  } catch (err) {
    console.error(`distill skipped: ${err.message}`);
    return null;
  }
}

// Commits rambles/YYYY-MM-DD-HHmm.md via the GitHub contents API.
// On a same-minute collision, retries with a -2 / -3 suffix.
export async function commitRamble(env, markdown, extras) {
  const stamp = localStamp(env.TIMEZONE);
  let body = `# Ramble — ${stamp.human}\n\n`;
  if (extras?.summary) body += `*${extras.summary}*\n\n`;
  body += `${markdown}\n`;
  if (extras?.actions?.length) {
    body += `\n## Action items\n\n${extras.actions.map((a) => `- ${a}`).join("\n")}\n`;
  }
  const content = btoa(String.fromCharCode(...new TextEncoder().encode(body)));

  for (let attempt = 1; attempt <= 3; attempt++) {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    const path = `rambles/${stamp.file}${suffix}.md`;
    const res = await fetch(
      `${env.GITHUB_API_BASE}/repos/${env.GITHUB_REPO}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${env.GITHUB_PAT}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "ramble-worker",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          message: `ramble ${stamp.file}${suffix}`,
          content,
          branch: env.GITHUB_BRANCH,
        }),
      }
    );
    if (res.ok) return path;
    // 422 = path already exists (needs a sha to update) → try next suffix.
    if (res.status !== 422) {
      const detail = await res.text().catch(() => "");
      throw new PipelineError("commit", res.status, detail);
    }
  }
  throw new PipelineError("commit", 422, "filename collision after 3 tries");
}

function localStamp(timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  // en-CA + hour12:false can yield "24" at midnight
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return {
    file: `${parts.year}-${parts.month}-${parts.day}-${hour}${parts.minute}`,
    human: `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}`,
  };
}

export class PipelineError extends Error {
  constructor(stage, status, detail) {
    super(`${stage} failed (${status})`);
    this.stage = stage;
    this.status = status;
    this.detail = (detail || "").slice(0, 500);
  }
}
