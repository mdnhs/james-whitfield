#!/bin/sh
set -e
# Apply pending migrations (advisory-locked), then hand PID 1 to the server.
node migrate.cjs
exec node server.js
