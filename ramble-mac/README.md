# ramble drain (Mac side)

Every 5 minutes: pull the inbox repo, move new rambles into the vault,
delete them from the repo. The repo stays near-empty; Obsidian Sync takes
it from the vault to your phone.

## Install

1. Clone the inbox repo (once):

   ```
   git clone https://github.com/hsullivan1201/ramble-inbox.git ~/ramble-inbox
   ```

2. Edit `drain.sh`: set `VAULT_INBOX` to your vault's inbox folder
   (create the folder in Obsidian first if it doesn't exist).

3. Install the script and the launchd job:

   ```
   mkdir -p ~/.local/bin
   cp drain.sh ~/.local/bin/ramble-drain.sh
   chmod +x ~/.local/bin/ramble-drain.sh
   ```

   Edit `net.lostinthehaze.ramble-drain.plist`: replace `REPLACE_WITH_HOME`
   with your actual home path (e.g. `/Users/estonianspy`). Then:

   ```
   cp net.lostinthehaze.ramble-drain.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/net.lostinthehaze.ramble-drain.plist
   ```

4. Check it: `bash ~/.local/bin/ramble-drain.sh` should exit quietly
   (nothing to drain yet). Logs land in `/tmp/ramble-drain.log`.

## Notes

- The script never overwrites an existing vault note; a name collision gets
  a `-dupe` suffix instead.
- To uninstall: `launchctl unload ~/Library/LaunchAgents/net.lostinthehaze.ramble-drain.plist`
