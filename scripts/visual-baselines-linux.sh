#!/usr/bin/env bash
# scripts/visual-baselines-linux.sh
# Records the Linux visual baselines (public "parity:" and admin "visual:")
# in the Playwright image CI's visual job uses, from the committed HEAD —
# never the working tree — and copies them to tests/e2e/__screenshots__/linux.
# Needs Docker. Slow on Apple Silicon (amd64 emulation): expect 20–40 min.
set -euo pipefail

root=$(git rev-parse --show-toplevel)
version=$(node -p "require('$root/node_modules/@playwright/test/package.json').version")
image="mcr.microsoft.com/playwright:v${version}-noble"
# Under the repo (shared with Docker Desktop by default), ignored by git.
work="$root/node_modules/.cache/linux-baselines"
out="$root/tests/e2e/__screenshots__/linux"
compose=(docker compose -p mk-baselines -f "$root/docker/visual/compose.yml")

cleanup() { WORK="$work" PW_IMAGE="$image" "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "${work:?}" && mkdir -p "$work"
git -C "$root" archive HEAD | tar -x -C "$work"
rm -rf "${work:?}/tests/e2e/__screenshots__/linux"

WORK="$work" PW_IMAGE="$image" "${compose[@]}" run --rm runner

rm -rf "${out:?}"
cp -R "$work/tests/e2e/__screenshots__/linux" "$out"
echo "Linux baselines written to tests/e2e/__screenshots__/linux ($(find "$out" -name '*.png' | wc -l | tr -d ' ') files)"
