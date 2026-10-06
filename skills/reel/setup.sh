#!/usr/bin/env bash
# Mac starter for the reel skill setup. It checks Node, then runs setup.mjs.
# Usage: bash setup.sh [--check] [--skip-catalog]
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node is not installed. Install it with: brew install node"
  exit 1
fi

major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$major" -lt 22 ]; then
  echo "Node $(node --version) is too old. Need 22 or later. Install with: brew install node"
  exit 1
fi

exec node "$(dirname "$0")/setup.mjs" "$@"
