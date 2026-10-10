#!/bin/sh
# scripts/deployment-id.sh [context-dir]
# The id Next.js uses for version-skew protection (docs/brief.md §17;
# Ruling R13): the NEXT_DEPLOYMENT_ID build arg if set, else the commit of
# the build context's .git, else a build timestamp. POSIX sh (alpine).
set -eu
if [ -n "${NEXT_DEPLOYMENT_ID:-}" ]; then
  printf '%s\n' "$NEXT_DEPLOYMENT_ID"
  exit 0
fi
dir=${1:-.}
sha=
if [ -f "$dir/.git/HEAD" ]; then
  head=$(cat "$dir/.git/HEAD")
  case "$head" in
    "ref: "*)
      ref=${head#ref: }
      if [ -f "$dir/.git/$ref" ]; then
        sha=$(cat "$dir/.git/$ref")
      elif [ -f "$dir/.git/packed-refs" ]; then
        sha=$(grep " $ref\$" "$dir/.git/packed-refs" | head -n 1 | cut -d ' ' -f 1)
      fi
      ;;
    *) sha=$head ;;
  esac
fi
if [ -n "$sha" ]; then
  printf '%s\n' "$sha"
else
  date -u +build-%Y%m%d%H%M%S
fi
