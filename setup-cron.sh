#!/bin/bash

# Get the absolute path of the current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
NODE_PATH=$(which node)
SCRIPT_PATH="$SCRIPT_DIR/index.js"
LOG_PATH="$SCRIPT_DIR/cron.log"
CRON_JOB="0 0 * * * $NODE_PATH $SCRIPT_PATH >> $LOG_PATH 2>&1"

install_cron() {
    # Check if node is installed
    if [ -z "$NODE_PATH" ]; then
        echo "Error: Node.js is not installed or not in PATH."
        exit 1
    fi

    # Check if job already exists
    (crontab -l 2>/dev/null | grep -F "$SCRIPT_PATH") && echo "Cron job already exists." && exit 0

    # Add job to crontab
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Cron job installed: Run daily at midnight."
    echo "Target: $SCRIPT_PATH"
}

uninstall_cron() {
    # Remove job from crontab
    crontab -l 2>/dev/null | grep -v -F "$SCRIPT_PATH" | crontab -
    echo "Cron job removed."
}

case "$1" in
    install)
        install_cron
        ;;
    uninstall)
        uninstall_cron
        ;;
    *)
        echo "Usage: $0 {install|uninstall}"
        exit 1
        ;;
esac
