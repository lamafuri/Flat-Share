#!/bin/bash
# Runs on every container start, next to mongod:
#   1. waits until mongod accepts connections
#   2. creates the root user if the database has no users yet (MongoDB's
#      "localhost exception" allows this one unauthenticated call)
#   3. creates the app user, or updates its password if it changed
#   4. writes /tmp/users-ready, which the health checks look for
set -u

: "${MONGO_ROOT_USERNAME:?MONGO_ROOT_USERNAME is required}"
: "${MONGO_ROOT_PASSWORD:?MONGO_ROOT_PASSWORD is required}"
: "${MONGO_APP_DB:?MONGO_APP_DB is required}"
: "${MONGO_APP_USER:?MONGO_APP_USER is required}"
: "${MONGO_APP_PASSWORD:?MONGO_APP_PASSWORD is required}"

log() { echo "[ensure-users] $*"; }
mongo() { mongosh --quiet --host 127.0.0.1 "$@"; }

log "waiting for mongod"
until mongo --eval 'db.adminCommand({ ping: 1 }).ok' >/dev/null 2>&1; do sleep 2; done

# Only succeeds while no users exist; afterwards it is refused, which is fine.
mongo admin --eval "
  try {
    db.createUser({ user: '$MONGO_ROOT_USERNAME', pwd: '$MONGO_ROOT_PASSWORD', roles: ['root'] });
    print('[ensure-users] created root user');
  } catch (e) { /* users already exist */ }
" || true

if mongo -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --eval "
  const appDb = db.getSiblingDB('$MONGO_APP_DB');
  const pwd = '$MONGO_APP_PASSWORD';
  if (appDb.getUser('$MONGO_APP_USER')) {
    appDb.updateUser('$MONGO_APP_USER', { pwd });
    print('[ensure-users] app user up to date');
  } else {
    appDb.createUser({ user: '$MONGO_APP_USER', pwd, roles: [{ role: 'readWrite', db: '$MONGO_APP_DB' }] });
    print('[ensure-users] created app user');
  }
"; then
  touch /tmp/users-ready
  log "ready"
else
  log "ERROR: could not log in as root. MONGO_ROOT_PASSWORD probably changed after the database was created. Reset the database or restore the old password."
fi
