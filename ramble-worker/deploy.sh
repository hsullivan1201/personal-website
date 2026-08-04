#!/bin/bash
# One-shot deploy: ships the worker, then pushes every secret in .dev.vars
# into Cloudflare's encrypted secret store. Values are piped straight from
# the file — never echoed.
set -euo pipefail
cd "$(dirname "$0")"

npx wrangler deploy

for name in STT_API_KEY LLM_API_KEY GITHUB_PAT REGISTRATION_KEY; do
  value="$(grep "^${name}=" .dev.vars | cut -d= -f2-)"
  if [ -z "$value" ] || [[ "$value" == *"..."* ]]; then
    echo "skipping $name (empty or placeholder)"
    continue
  fi
  printf '%s' "$value" | npx wrangler secret put "$name"
done

echo
echo "done. worker URL above (the *.workers.dev line)."
