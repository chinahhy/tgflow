#!/usr/bin/env bash
# Prepare a reviewable merge. Never push or update main/dev directly.
set -euo pipefail
cd "$(dirname "$0")/.."
version=${1:?Usage: scripts/sync-upstream.sh <stable-tag>}
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'Pass an explicit stable upstream version, for example 0.4.0.' >&2
  exit 2
fi
if [ -n "$(git status --porcelain)" ]; then
  echo 'Commit or stash your work before preparing an upstream sync.' >&2
  exit 1
fi
if ! git remote get-url upstream > /dev/null 2>&1; then
  git remote add upstream https://github.com/jarvis2f/telegram-files.git
fi
test "$(git remote get-url upstream)" = https://github.com/jarvis2f/telegram-files.git
git fetch upstream "refs/tags/$version"
upstream_sha=$(git rev-parse 'FETCH_HEAD^{commit}')
git fetch origin main
if git merge-base --is-ancestor "$upstream_sha" origin/main; then
  echo "Upstream $version is already included in origin/main."
  exit 0
fi
git switch -c "sync/upstream-$version" origin/main
git merge --no-ff --no-commit "$upstream_sha"
UPSTREAM_VERSION="$version" UPSTREAM_SHA="$upstream_sha" python3 - <<'PY'
import datetime, json, os
from pathlib import Path
Path('UPSTREAM.json').write_text(json.dumps({
    'repository': 'https://github.com/jarvis2f/telegram-files',
    'version': os.environ['UPSTREAM_VERSION'],
    'commit': os.environ['UPSTREAM_SHA'],
    'syncedAt': datetime.datetime.now(datetime.timezone.utc).date().isoformat(),
}, indent=2) + '\n')
PY
echo 'Review the merge, adapt both locales, run checks, then commit and open a PR to main.'
