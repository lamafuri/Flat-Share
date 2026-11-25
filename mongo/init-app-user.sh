#!/bin/bash
# Runs once on first start (empty data directory). Creates the application
# user with read/write access to the app database only, so the backend never
# connects as root.
set -e

: "${MONGO_APP_DB:?MONGO_APP_DB is required}"
: "${MONGO_APP_USER:?MONGO_APP_USER is required}"
: "${MONGO_APP_PASSWORD:?MONGO_APP_PASSWORD is required}"

mongosh --quiet \
  -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin <<JS
const appDb = db.getSiblingDB("$MONGO_APP_DB");
if (!appDb.getUser("$MONGO_APP_USER")) {
  appDb.createUser({
    user: "$MONGO_APP_USER",
    pwd: "$MONGO_APP_PASSWORD",
    roles: [{ role: "readWrite", db: "$MONGO_APP_DB" }]
  });
  print("Created app user $MONGO_APP_USER on $MONGO_APP_DB");
}
JS
