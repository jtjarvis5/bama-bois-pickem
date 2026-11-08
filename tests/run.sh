#!/bin/sh
# Runs a test whose imports are extensionless (like the app's) by bundling it first.
# usage: tests/run.sh tests/stats-expansion.test.mjs
set -e
OUT="${TMPDIR:-/tmp}/bundled-$(basename "$1" .mjs).mjs"
esbuild "$1" --bundle --format=esm --platform=node --outfile="$OUT" --log-level=error
node "$OUT"
