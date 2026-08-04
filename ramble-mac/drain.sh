#!/bin/bash
# ramble drain: pull new rambles from the inbox repo, move them into the
# Obsidian vault's inbox folder, then delete them from the repo so it trends
# empty. Runs every 5 minutes via launchd (see net.lostinthehaze.ramble-drain.plist).
set -euo pipefail

# ---- config ----
INBOX_REPO="$HOME/ramble-inbox"          # local clone of hsullivan1201/ramble-inbox
VAULT_INBOX="$HOME/Documents/obsidian-notes/inbox"
# ----------------

if [ ! -d "$INBOX_REPO/.git" ]; then
  echo "inbox repo not cloned at $INBOX_REPO" >&2
  exit 1
fi
if [ ! -d "$VAULT_INBOX" ]; then
  echo "vault inbox folder missing: $VAULT_INBOX" >&2
  exit 1
fi

cd "$INBOX_REPO"
git pull --quiet --ff-only

shopt -s nullglob
files=(rambles/*.md)
[ ${#files[@]} -eq 0 ] && exit 0

for f in "${files[@]}"; do
  base="$(basename "$f")"
  dest="$VAULT_INBOX/$base"
  # never clobber a note already in the vault
  if [ -e "$dest" ]; then
    dest="$VAULT_INBOX/${base%.md}-dupe.md"
  fi
  cp "$f" "$dest"
  git rm --quiet "$f"
done

git commit --quiet -m "drain $(date +%Y-%m-%d-%H%M)"
git push --quiet
echo "drained ${#files[@]} ramble(s)"
