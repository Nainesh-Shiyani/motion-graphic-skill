#!/usr/bin/env bash
# Installs the web-motion-graphics skill for the AI coding tools on this machine (macOS / Linux / Git Bash).
#
#   ./install.sh                     install for every supported tool (default)
#   ./install.sh claude agents       only some targets
#   ./install.sh --uninstall         remove it everywhere
#
# Without cloning:
#   curl -fsSL https://raw.githubusercontent.com/Nainesh-Shiyani/motion-graphic-skill-for-website-creation-using-claude/main/install.sh | bash
#
# Targets:
#   claude       ~/.claude/skills               Claude Code (terminal + desktop app); Cursor also reads it
#   agents       ~/.agents/skills               OpenAI Codex, Gemini CLI, GitHub Copilot, Cursor
#   antigravity  ~/.gemini/config/skills         Google Antigravity (IDE), and ~/.gemini/antigravity-cli/skills (CLI)
# Claude.ai and ChatGPT: upload dist/web-motion-graphics.zip in their Skills settings instead.
set -euo pipefail

REPO="Nainesh-Shiyani/motion-graphic-skill-for-website-creation-using-claude"
NAME="web-motion-graphics"
UNINSTALL=0
TARGETS=()
for arg in "$@"; do
  case "$arg" in
    --uninstall|-u) UNINSTALL=1 ;;
    claude|agents|antigravity) TARGETS+=("$arg") ;;
    -h|--help) sed -n '2,17p' "$0" 2>/dev/null || true; exit 0 ;;
    *) echo "unknown option: $arg (use claude, agents, antigravity, --uninstall)" >&2; exit 2 ;;
  esac
done
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(claude agents antigravity)

dirs_for() {
  case "$1" in
    claude) echo "$HOME/.claude/skills" ;;
    agents) echo "$HOME/.agents/skills" ;;
    antigravity)
      echo "$HOME/.gemini/config/skills"
      [ -d "$HOME/.gemini/antigravity-cli" ] && echo "$HOME/.gemini/antigravity-cli/skills"
      ;;
  esac
  return 0
}

if [ "$UNINSTALL" = 1 ]; then
  for t in "${TARGETS[@]}"; do
    for d in $(dirs_for "$t"); do
      if [ -d "$d/$NAME" ]; then rm -rf "${d:?}/$NAME"; echo "removed $d/$NAME"; fi
    done
  done
  exit 0
fi

# find the skill: next to this script (cloned repo) or download the latest version
HERE="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || pwd)"
SRC="$HERE/skills/$NAME"
TMP=""
if [ ! -f "$SRC/SKILL.md" ]; then
  TMP="$(mktemp -d)"
  echo "downloading $REPO ..."
  curl -fsSL "https://github.com/$REPO/archive/refs/heads/main.tar.gz" | tar -xz -C "$TMP"
  SRC="$(find "$TMP" -maxdepth 3 -type d -path "*/skills/$NAME" | head -n 1)"
  [ -f "$SRC/SKILL.md" ] || { echo "could not find skills/$NAME in the download" >&2; exit 1; }
fi

for t in "${TARGETS[@]}"; do
  if [ "$t" = antigravity ] && [ ! -d "$HOME/.gemini" ]; then
    echo "skipped antigravity (~/.gemini not found)"
    continue
  fi
  for d in $(dirs_for "$t"); do
    mkdir -p "$d"
    rm -rf "${d:?}/$NAME"
    cp -R "$SRC" "$d/$NAME"
    echo "installed $d/$NAME"
  done
done
[ -n "$TMP" ] && rm -rf "$TMP"
echo "done - start a new session of your AI tool and ask it to build a website."
