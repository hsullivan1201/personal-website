import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

// Single relying party, single user, single credential in KV.
// Enrollment is one-time: /register routes work only while no credential is
// stored, and are additionally gated by REGISTRATION_KEY so a stranger who
// finds the endpoint before Hazel does can't claim the slot.

const CRED_KEY = "credential";
const CHALLENGE_TTL = 120; // seconds

export async function getCredential(env) {
  const raw = await env.KV.get(CRED_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function stashChallenge(env, kind, challenge) {
  const id = crypto.randomUUID();
  await env.KV.put(`challenge:${kind}:${id}`, challenge, {
    expirationTtl: CHALLENGE_TTL,
  });
  return id;
}

async function takeChallenge(env, kind, id) {
  if (!id || typeof id !== "string" || id.length > 64) return null;
  const key = `challenge:${kind}:${id}`;
  const challenge = await env.KV.get(key);
  if (challenge) await env.KV.delete(key); // single-use
  return challenge;
}

export async function registerOptions(env, request) {
  if (await getCredential(env)) {
    return { error: "enrollment is closed", status: 403 };
  }
  const { registrationKey } = await request.json().catch(() => ({}));
  if (!env.REGISTRATION_KEY || registrationKey !== env.REGISTRATION_KEY) {
    return { error: "bad registration key", status: 403 };
  }
  const options = await generateRegistrationOptions({
    rpName: env.RP_NAME,
    rpID: env.RP_ID,
    userName: "hazel",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });
  const challengeId = await stashChallenge(env, "reg", options.challenge);
  return { status: 200, body: { challengeId, options } };
}

export async function registerVerify(env, request, origin) {
  if (await getCredential(env)) {
    return { error: "enrollment is closed", status: 403 };
  }
  const { registrationKey, challengeId, response } = await request
    .json()
    .catch(() => ({}));
  if (!env.REGISTRATION_KEY || registrationKey !== env.REGISTRATION_KEY) {
    return { error: "bad registration key", status: 403 };
  }
  const expectedChallenge = await takeChallenge(env, "reg", challengeId);
  if (!expectedChallenge) {
    return { error: "challenge expired, try again", status: 400 };
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: env.RP_ID,
      requireUserVerification: true,
    });
  } catch (err) {
    return { error: `verification failed: ${err.message}`, status: 400 };
  }
  if (!verification.verified) {
    return { error: "verification failed", status: 400 };
  }

  const { credential } = verification.registrationInfo;
  await env.KV.put(
    CRED_KEY,
    JSON.stringify({
      id: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports || [],
    })
  );
  return { status: 200, body: { enrolled: true } };
}

export async function authOptions(env) {
  const cred = await getCredential(env);
  if (!cred) return { error: "no passkey enrolled yet", status: 403 };
  const options = await generateAuthenticationOptions({
    rpID: env.RP_ID,
    userVerification: "required",
    allowCredentials: [{ id: cred.id, transports: cred.transports }],
  });
  const challengeId = await stashChallenge(env, "auth", options.challenge);
  return { status: 200, body: { challengeId, options } };
}

// Verifies an assertion attached to a /session upload. Returns true on
// success; on success also persists the new signature counter.
export async function verifyAssertion(env, origin, challengeId, assertion) {
  const cred = await getCredential(env);
  if (!cred) return false;
  const expectedChallenge = await takeChallenge(env, "auth", challengeId);
  if (!expectedChallenge) return false;

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: env.RP_ID,
      requireUserVerification: true,
      credential: {
        id: cred.id,
        publicKey: isoBase64URL.toBuffer(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports,
      },
    });
  } catch {
    return false;
  }
  if (!verification.verified) return false;

  await env.KV.put(
    CRED_KEY,
    JSON.stringify({
      ...cred,
      counter: verification.authenticationInfo.newCounter,
    })
  );
  return true;
}
