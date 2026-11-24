#!/bin/sh
set -eu
if [ "$(id -u)" = "0" ]; then
    upload_dir="${UPLOAD_DIR:-/data/uploads}"
    mkdir -p "$upload_dir"
    chown app:app "$upload_dir"
    exec gosu app "$@"
fi
exec "$@"
