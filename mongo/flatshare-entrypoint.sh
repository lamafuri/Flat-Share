#!/bin/bash
# Start the user setup in the background, then hand over to the official
# entrypoint, which runs mongod as PID 1.
set -e
rm -f /tmp/users-ready
ensure-users.sh &
exec docker-entrypoint.sh "$@"
