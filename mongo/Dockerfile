# FlatShare MongoDB image: official MongoDB plus an init script that creates
# a least-privilege user for the app on first start.
FROM mongo:7.0

# Scripts in this folder run once, when the data directory is empty.
COPY init-app-user.sh /docker-entrypoint-initdb.d/10-init-app-user.sh

EXPOSE 27017
