// ramble — voice capture. talks only to the worker; no secrets live here.

// Set after the worker is deployed. Override for local testing with
// ?worker=http://localhost:8787
const WORKER_URL =
  new URLSearchParams(location.search).get("worker") ||
  "https://ramble-api.lostinthehaze.net";

const MAX_SECONDS = 600; // 10 min cap, matches the worker

const el = {
  record: document.getElementById("record"),
  timer: document.getElementById("timer"),
  status: document.getElementById("status"),
  hint: document.getElementById("hint"),
  retryRow: document.getElementById("retry-row"),
  retry: document.getElementById("retry"),
  save: document.getElementById("save"),
  enroll: document.getElementById("enroll"),
};

let recorder = null;
let chunks = [];
let startedAt = 0;
let tickHandle = null;
let wakeLock = null;
let pendingBlob = null; // survives failed sends so nothing is lost

// ---------- tiny helpers ----------

const b64uToBuf = (s) =>
  Uint8Array.from(
    atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")),
    (c) => c.charCodeAt(0)
  );
const bufToB64u = (b) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function setStatus(msg, isError = false) {
  el.status.textContent = msg;
  el.status.classList.toggle("error", isError);
}

async function api(path, body) {
  const res = await fetch(WORKER_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `request failed (${res.status})`);
  return data;
}

// ---------- recording ----------

function pickMime() {
  const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  for (const m of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
  }
  return ""; // let the browser choose
}

async function startRecording() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    setStatus("mic permission denied — check browser settings", true);
    return;
  }
  chunks = [];
  pendingBlob = null;
  el.retryRow.classList.remove("show");
  const mime = pickMime();
  recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    releaseWakeLock();
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/mp4" });
    send(blob);
  };
  recorder.start(1000); // gather data as we go; nothing lost if the tab dies late

  startedAt = Date.now();
  tickHandle = setInterval(tick, 250);
  el.record.textContent = "stop";
  el.record.classList.add("recording");
  el.timer.classList.add("on");
  setStatus("");
  acquireWakeLock();
}

function stopRecording() {
  if (!recorder || recorder.state === "inactive") return;
  clearInterval(tickHandle);
  el.record.textContent = "record";
  el.record.classList.remove("recording");
  el.timer.classList.remove("on");
  recorder.stop();
}

function tick() {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  el.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  if (s >= MAX_SECONDS) {
    setStatus("hit the 10 minute cap — sending what we have");
    stopRecording();
  }
}

// keep the screen awake while recording, where the browser allows it
async function acquireWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request("screen");
  } catch {
    /* unsupported or denied — the on-page hint covers it */
  }
}
function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && recorder?.state === "recording") {
    acquireWakeLock();
  }
});

// ---------- auth + send ----------

async function getAssertion() {
  const { challengeId, options } = await api("/auth/options");
  const publicKey = {
    ...options,
    challenge: b64uToBuf(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((c) => ({
      ...c,
      id: b64uToBuf(c.id),
    })),
  };
  const cred = await navigator.credentials.get({ publicKey });
  const r = cred.response;
  return {
    challengeId,
    assertion: {
      id: cred.id,
      rawId: bufToB64u(cred.rawId),
      type: cred.type,
      authenticatorAttachment: cred.authenticatorAttachment,
      clientExtensionResults: cred.getClientExtensionResults(),
      response: {
        clientDataJSON: bufToB64u(r.clientDataJSON),
        authenticatorData: bufToB64u(r.authenticatorData),
        signature: bufToB64u(r.signature),
        userHandle: r.userHandle ? bufToB64u(r.userHandle) : undefined,
      },
    },
  };
}

async function send(blob) {
  pendingBlob = blob;
  el.record.disabled = true;
  try {
    setStatus("passkey check…");
    const { challengeId, assertion } = await getAssertion();

    setStatus("sending…");
    const form = new FormData();
    form.append("audio", blob, "ramble");
    form.append("challengeId", challengeId);
    form.append("assertion", JSON.stringify(assertion));

    const res = await fetch(WORKER_URL + "/session", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `send failed (${res.status})`);

    pendingBlob = null;
    el.timer.textContent = "0:00";
    setStatus("✓ filed");
  } catch (err) {
    setStatus(err.message, true);
    offerRetry(blob);
  } finally {
    el.record.disabled = false;
  }
}

function offerRetry(blob) {
  el.retryRow.classList.add("show");
  const ext = blob.type.includes("webm") ? "webm" : "m4a";
  el.save.href = URL.createObjectURL(blob);
  el.save.download = `ramble-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}.${ext}`;
}

el.retry.addEventListener("click", () => {
  if (pendingBlob) {
    el.retryRow.classList.remove("show");
    send(pendingBlob);
  }
});

el.record.addEventListener("click", () => {
  if (recorder && recorder.state === "recording") stopRecording();
  else startRecording();
});

// ---------- one-time passkey enrollment ----------

el.enroll.addEventListener("click", async (e) => {
  e.preventDefault();
  const registrationKey = prompt("registration key?");
  if (!registrationKey) return;
  try {
    const { challengeId, options } = await api("/register/options", { registrationKey });
    const publicKey = {
      ...options,
      challenge: b64uToBuf(options.challenge),
      user: { ...options.user, id: b64uToBuf(options.user.id) },
      excludeCredentials: (options.excludeCredentials || []).map((c) => ({
        ...c,
        id: b64uToBuf(c.id),
      })),
    };
    const cred = await navigator.credentials.create({ publicKey });
    const r = cred.response;
    await api("/register/verify", {
      registrationKey,
      challengeId,
      response: {
        id: cred.id,
        rawId: bufToB64u(cred.rawId),
        type: cred.type,
        authenticatorAttachment: cred.authenticatorAttachment,
        clientExtensionResults: cred.getClientExtensionResults(),
        response: {
          clientDataJSON: bufToB64u(r.clientDataJSON),
          attestationObject: bufToB64u(r.attestationObject),
          transports: r.getTransports ? r.getTransports() : [],
        },
      },
    });
    setStatus("passkey enrolled ✓ — you're in");
  } catch (err) {
    setStatus(err.message || "enrollment failed", true);
  }
});
