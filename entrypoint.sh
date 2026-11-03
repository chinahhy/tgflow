#!/bin/sh

set -e  # Exit on error

# Default configuration
PUID=${PUID:-0}
PGID=${PGID:-0}

# Store PIDs in variables
JAVA_PID=""
NGINX_PID=""

cleanup() {
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
    exit 0
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
trap cleanup TERM INT

# Replace nginx.conf.template with environment variables
envsubst '$NGINX_PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Set up permissions
setup_permissions

# Start services
start_services

# Wait for all services to complete
wait
