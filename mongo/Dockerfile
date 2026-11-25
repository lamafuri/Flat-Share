# FlatShare MongoDB image: the official MongoDB image plus a small script
# that creates the database users once mongod is running.
#
# We don't use the image's built-in first-start setup
# (MONGO_INITDB_* + /docker-entrypoint-initdb.d): it starts a temporary
# background mongod that logs to /proc/1/fd/1, which hangs under
# Kubernetes' containerd runtime. Instead mongod starts normally with
# --auth, and ensure-users.sh creates or updates the users next to it.
FROM mongo:7.0

COPY ensure-users.sh flatshare-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/ensure-users.sh /usr/local/bin/flatshare-entrypoint.sh

# Run as the unprivileged mongodb user (uid 999) from the start. The
# official entrypoint then skips its root-only step, which switches user
# with "gosu". On the EC2/k3s host gosu hung forever, so mongod never
# started. Numeric IDs let Kubernetes verify runAsNonRoot.
USER 999:999

EXPOSE 27017

ENTRYPOINT ["flatshare-entrypoint.sh"]
CMD ["mongod", "--auth"]
