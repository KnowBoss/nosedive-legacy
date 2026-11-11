#!/usr/bin/env bash
# Smoke-tests legacy as a hero wears it, through a real core launcher: seeds a hero, wears legacy at this checkout's
# HEAD commit (core builds the cape from it), then runs the loop: jump -> commit -> pack -> jump -> land -> drop, and jump -> bail.
# Usage: scripts/smoke.sh [<built nosedive-core checkout>] [<legacy checkout>]
set -euo pipefail
CORE_DIR=$(cd "${1:-${NOSEDIVE_CORE_DIR:-../nosedive-core}}" && pwd)
LEGACY_DIR=$(cd "${2:-.}" && pwd)
LEGACY_COMMIT=$(git -C "$LEGACY_DIR" rev-parse HEAD)
W=$(mktemp -d)
trap 'rm -rf "$W"' EXIT
export NOSEDIVE_USER_DIR="$W/user"
export GIT_AUTHOR_NAME=Smoke GIT_AUTHOR_EMAIL=smoke@example.com GIT_COMMITTER_NAME=Smoke GIT_COMMITTER_EMAIL=smoke@example.com
# The user's git config must not change what the hero sees (an ignore rule, a hook path).
export GIT_CONFIG_GLOBAL=/dev/null
nd() { node "$CORE_DIR/dist/cli.js" "$@"; }
step() { printf '\n== %s\n' "$*"; }
fail() { printf 'smoke failed: %s\n' "$*" >&2; exit 1; }
has() { grep -q "$2" "$1" || fail "$3 (no \`$2\` in ${1#"$W"/})"; }

step "core $(git -C "$CORE_DIR" rev-parse --short HEAD), legacy $(git -C "$LEGACY_DIR" rev-parse --short HEAD)"

step "legacy published: this checkout's HEAD as main of a throwaway origin"
# Core reads a cape's kind schemas as published only when they are on its origin's trunk, so the cape gets an origin
# whose main is HEAD, whatever branches this checkout has (CI's is a detached merge commit).
git init -q --bare -b main "$W/legacy.git"
git -C "$LEGACY_DIR" push -q "$W/legacy.git" "$LEGACY_COMMIT:refs/heads/main"

step "a data repo with an upstream"
git init -q --bare -b main "$W/data.git"
git init -q -b main "$W/data-seed"
echo one > "$W/data-seed/README.md"
git -C "$W/data-seed" add -A
git -C "$W/data-seed" commit -q -m first
git -C "$W/data-seed" push -q "$W/data.git" HEAD:main

step "a hero with an upstream, seeded"
git init -q --bare -b main "$W/hero.git"
git init -q -b main "$W/hero"
cd "$W/hero"
git remote add origin "$W/hero.git"
# The loop names a diver and a packer by the hero's git user.email.
git config user.name Smoke
git config user.email smoke@example.com
git commit -q --allow-empty -m init
nd seed --workspace
ROOT=$(sed -n 's/^  - //p' .nosedive/config.yaml | tail -1)
ROOT_DIR=$(dirname "$ROOT")
ROOT_ID=$(basename "$ROOT" .md)
quid() { basename "$1" .md; }

step "register legacy and a data repo, wear legacy, add two goals on data (crud commits each)"
LEGACY=$(nd crud core:repo "Legacy nosedive's actions" --name nosedive-legacy --meta:trunk main --meta:remotes.origin "$W/legacy.git")
DATA=$(nd crud core:repo "Data" --name data --meta:trunk main --meta:remotes.origin "$W/data.git")
# Work is of a kind of the hero's own whose doc says when one is dropped (## Drop when), so it is no durable kind: core's memo is.
nd crud core:kind "Something the hero sets out to do" --name goal --meta:schema.additionalProperties true --section:"Drop when" - > /dev/null <<< "Once it is done, recorded on the doc it hangs from."
FEAT=$(nd crud goal "Ideas" --name ideas)
OTHER=$(nd crud goal "Others" --name others)
for doc in "$FEAT" "$OTHER"; do
	printf '%s:\n  work-branch: work/%s\n' "$(quid "$DATA")" "$(sed -n 's/^name: //p' "$doc")" | nd crud "$(quid "$doc")" --scopes -
done
printf '%s:\n  rel: .cape\n  ref: %s\n%s:\n  rel: work.feat\n%s:\n  rel: work.feat\n' "$LEGACY" "$LEGACY_COMMIT" "$FEAT" "$OTHER" | nd crud "$ROOT_ID" --links -
FEAT=$(quid "$FEAT") OTHER=$(quid "$OTHER")
git push -q -u origin main

step "seed again: core builds legacy and runs its migrations"
nd seed --migrate
git add -A
git diff --cached --quiet || git commit -q -m "seeded with legacy"
git push -q origin main
MIGRATIONS=0
for id in $(sed -n 's/^  - kb\/\(.*\)\.md:$/\1/p;' "$LEGACY_DIR"/kb/01a1b128-2c08-790f-80f4-e2c40a98bfcc.md | while read -r doc; do grep -l '^kind: migration$' "$LEGACY_DIR/kb/$doc.md" >/dev/null 2>&1 && echo "$doc"; done); do
	has .nosedive/config.yaml "$id" "legacy's migration $id was not run"
	MIGRATIONS=$((MIGRATIONS + 1))
done
test "$MIGRATIONS" -gt 0 || fail "found none of legacy's migrations to check"
echo "legacy's $MIGRATIONS migrations ran"
nd --help > "$W/help.txt"
for action in jump pack land bail; do has "$W/help.txt" "^  $action " "legacy's $action is not listed"; done

step "jump a feat: mints a dive"
nd jump "$FEAT"
DIVE=$(git symbolic-ref --short HEAD | sed -E 's/^nosedive-[0-9a-f]{12}-//')
has "$ROOT_DIR/$FEAT.md" "rel: jumped.dive" "the feat does not link the dive as jumped"

step "a plain crud commit on the dive branch is grouped under the dive (core's drop-takes-declared-links)"
DIVE_NAME=$(sed -n 's/^name: //p' "$ROOT_DIR/$DIVE.md")
nd crud "$FEAT" --gist "Ideas, under way" > /dev/null
SUBJECT=$(git log -1 --format=%s)
case "$SUBJECT" in "feat($DIVE_NAME): "*) echo "$SUBJECT" ;; *) fail "the commit is not grouped under the dive: $SUBJECT" ;; esac

step "commit in the data checkout, then pack"
echo work > workspace/data/work.md
git -C workspace/data add -A
git -C workspace/data commit -q -m "some work"
nd pack
has "$ROOT_DIR/$FEAT.md" "rel: packed.dive" "the feat does not link the dive as packed"
test ! -e workspace/data/work.md || fail "pack left the work in the checkout"

step "jump bare: takes the packed dive back"
nd jump
test "$(git -C workspace/data log -1 --format=%s)" = "some work" || fail "jump did not bring the packed work back"

step "land"
nd land
has "$ROOT_DIR/$FEAT.md" "rel: landed.dive" "the feat does not link the dive as landed"
test "$(git -C "$W/data.git" log -1 --format=%s work/ideas)" = "some work" || fail "the work is not on data's work/ideas"
test "$(git -C "$W/hero.git" rev-parse main)" = "$(git rev-parse main)" || fail "the hero's records were not pushed"

step "drop the landed dive: recorded on its feat, the drop takes the feat's state link"
nd crud "$FEAT" --section:"Dropped.$DIVE" - > /dev/null <<< "Smoke: landed its one commit on work/ideas."
nd crud --drop "$DIVE" 2> "$W/drop.err"
cat "$W/drop.err"
test ! -e "$ROOT_DIR/$DIVE.md" || fail "the dive doc is still there"
grep -q "$DIVE.md" "$ROOT_DIR/$FEAT.md" && fail "the feat still links the dropped dive"
has "$W/drop.err" "^unlinked .*: landed.dive " "the drop did not report the link it took"
has "$ROOT_DIR/$FEAT.md" "^### $DIVE$" "the feat lost the drop's record"
# Jump wants the home pushed: its records go to its upstream.
git push -q origin main

step "jump another feat, then bail it"
nd jump "$OTHER"
nd bail --reason "smoke: bail works"
has "$ROOT_DIR/$OTHER.md" "rel: bailed.dive" "the feat does not link the dive as bailed"
test "$(git symbolic-ref --short HEAD)" = main || fail "bail did not return the hero to main"

printf '\nsmoke passed: dive %s jumped, packed, jumped, landed and dropped; another jumped and bailed\n' "$DIVE"
