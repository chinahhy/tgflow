#!/bin/sh

set -e  # Exit on error

# Default configuration
PUID=${PUID:-0}
PGID=${PGID:-0}

# Store PIDs in variables
JAVA_PID=""
NGINX_PID=""

cleanup() {
    exit_status=${1:-0}
    trap '' TERM INT
    echo "Cleaning up processes..."

    # Check and kill each process individually
    if [ -n "$JAVA_PID" ]; then
        kill -TERM "$JAVA_PID" 2>/dev/null || true
    fi
    if [ -n "$NGINX_PID" ]; then
        kill -TERM "$NGINX_PID" 2>/dev/null || true
    fi

    wait || true
    echo "All processes have been terminated"
    exit "$exit_status"
}

setup_permissions() {
    app_root=${APP_ROOT:-/data}
    download_root=${DOWNLOAD_ROOT:-$app_root/downloads}
    mkdir -p "$app_root" "$download_root"
    if [ "$(id -u)" = "0" ] && [ "$PUID" != "0" ]; then
        echo "Setting up directory permissions..."
        chown -R "${PUID}:${PGID}" /app /etc/nginx /var/lib/nginx /var/log/nginx /run/nginx.pid /etc/nginx/nginx.conf
        chown -R "${PUID}:${PGID}" "$app_root"/.
        # Only own the mount root; do not recursively change unrelated HDD content.
        chown "${PUID}:${PGID}" "$download_root"
    fi
}

start_services() {
    cmd_prefix=""
    if [ "$(id -u)" = "0" ] && [ "$PUID" != "0" ]; then
        cmd_prefix="su-exec ${PUID}:${PGID}"
    fi

    echo "Starting Java service..."
    if [ -n "$cmd_prefix" ]; then
        $cmd_prefix java -jar -Djava.library.path=/app/tdlib /app/api.jar &
    else
        java -jar -Djava.library.path=/app/tdlib /app/api.jar &
    fi
    JAVA_PID=$!

    echo "Starting Nginx service..."
    if [ -n "$cmd_prefix" ]; then
        $cmd_prefix nginx -g 'daemon off;' &
    else
        nginx -g 'daemon off;' &
    fi
    NGINX_PID=$!
}

# Set up signal handlers
trap 'cleanup 0' TERM INT

# Replace nginx.conf.template with environment variables
envsubst '$NGINX_PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Set up permissions
setup_permissions

# Start services
start_services

# BusyBox ash waits for every listed PID even with wait -n. Check both children
# and then wait for the exited one to retain its actual status, including when
# it failed before monitoring started.
while kill -0 "$JAVA_PID" 2>/dev/null && kill -0 "$NGINX_PID" 2>/dev/null; do
    sleep 1
done
service_status=0
if ! kill -0 "$JAVA_PID" 2>/dev/null; then
    wait "$JAVA_PID" || service_status=$?
else
    wait "$NGINX_PID" || service_status=$?
fi
echo "A required service exited (status $service_status); stopping container..."
if [ "$service_status" -eq 0 ]; then
    service_status=1
fi
cleanup "$service_status"
