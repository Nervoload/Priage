FROM alpine:3.21
RUN apk add --no-cache ca-certificates pgbouncer
USER nobody
EXPOSE 6432
CMD ["pgbouncer", "/etc/pgbouncer/pgbouncer.ini"]
