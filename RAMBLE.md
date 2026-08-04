# ramble — setup and deploy

Voice capture → cleaned bullets → Obsidian. The full design lives in the
build spec; this file is just what exists in this repo and how to turn it on.

## What's where

- `static/ramble/` — the record page. Ships with the site, no build step.
- `ramble-worker/` — the Cloudflare Worker. Holds all secrets, does
  passkey auth → transcription → cleanup → commit.
- `ramble-mac/` — the drain script + launchd job (see its README).
- Inbox repo: https://github.com/hsullivan1201/ramble-inbox (private,
  already created, cloned at `~/ramble-inbox`).

## Deploy the worker (one time)

From `ramble-worker/`:

1. `npx wrangler login`
2. `npx wrangler kv namespace create RAMBLE_KV` — paste the id it prints
   into `wrangler.jsonc` where it says `REPLACE_WITH_KV_NAMESPACE_ID`.
3. Set secrets (each prompts for the value):

   ```
   npx wrangler secret put STT_API_KEY
   npx wrangler secret put LLM_API_KEY
   npx wrangler secret put GITHUB_PAT
   npx wrangler secret put REGISTRATION_KEY
   ```

   - STT and LLM keys can be the same OpenAI key.
   - The PAT is fine-grained: github.com → Settings → Developer settings →
     fine-grained tokens. Repository access: only `ramble-inbox`.
     Permissions: Contents, read and write. Nothing else.
   - REGISTRATION_KEY is any long random phrase. It gates passkey
     enrollment; you'll type it exactly once.
   - In the OpenAI dashboard, check data controls and make sure retention /
     training opt-outs are on.

4. `npx wrangler deploy` — the worker serves at
   `ramble-api.lostinthehaze.net` (custom domain on the zone; the account
   that owns the lostinthehaze.net DNS is Hsullivan1201@gmail.com's).
   That URL is already wired into `static/ramble/app.js` (`WORKER_URL`).

## Enroll your passkey (once, on your phone)

1. Open `lostinthehaze.net/ramble/` in Firefox.
2. Tap "set up this device", enter the REGISTRATION_KEY, approve the
   FaceID prompt.
3. That's it. Enrollment is now closed permanently (the worker refuses
   further registrations even with the key). The passkey lives in iCloud
   Keychain, so other devices signed into your Apple account work too.

If you ever need to re-enroll (new credential), delete the `credential`
key from the KV namespace in the Cloudflare dashboard and repeat.

## Mac drain

See `ramble-mac/README.md`. The one thing it needs from you: the path to
your vault's inbox folder.

## Add to home screen

From the share sheet (Safari is cleanest, a Firefox home-screen bookmark
also works). The page is installable and opens straight to the button.

## First real test (Firefox on iOS, per spec)

- [ ] page loads, record button works, timer runs
- [ ] screen-lock warning is visible
- [ ] passkey prompt appears on send, note lands in `ramble-inbox` within ~1 min
- [ ] drain moves it to the vault, Obsidian Sync carries it to the phone
- [ ] acceptance test: read the output — every sentence yours, nothing
      "improved"? if it reads like LinkedIn, tighten the CLEAN prompt or
      try the tier-up model (see `CLEAN_MODEL` in `wrangler.jsonc`)

## Ops notes

- Caps: 20 sessions/day, ~10 min / 25 MB per recording. All config in
  `wrangler.jsonc`; models and providers are swappable there too.
- Auth fallback: if passkeys ever misbehave, set `AUTH_MODE` to `token`,
  `npx wrangler secret put BEARER_TOKEN`, and redeploy. (The page's token
  mode would need a small addition — it currently only speaks passkey.)
- The API hostname in `app.js` is public by nature; that's fine, the
  worker rejects anything without a valid passkey assertion. It's a
  first-party subdomain (not workers.dev) so tracking-protection lists
  and content blockers leave it alone.
- Free-plan Workers CPU limits should be fine (the worker mostly waits on
  APIs); if big uploads ever hit the 10 ms CPU wall, the $5 plan raises it.
- Local dev: `cd ramble-worker && cp .dev.vars.example .dev.vars`, fill it
  in, `npm run dev`, then open the site with
  `?worker=http://localhost:8787` appended to the page URL.
