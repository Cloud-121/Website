#!/usr/bin/env bash
#
# preflight.sh - VPS pre-install audit for the Grafana Cloud collector.
#
# Run as root on the target VPS. Idempotent, read-mostly. The only state-
# changing actions are apt update/upgrade, journal vacuum, and apt clean -
# all of which we want anyway before adding new packages.
#
# Exits with code 0 if the host is ready for Section 2 of INSTALL.md,
# exit 1 if disk usage on / stays above 85% after cleanup (which means
# you must investigate before going further).

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "preflight: must run as root (try: sudo $0)" >&2
  exit 2
fi

DISK_GATE_PERCENT=85

banner() {
  printf '\n=== %s ===\n' "$1"
}

banner "Distro check"
grep -E '^(NAME|VERSION|VERSION_ID)=' /etc/os-release

banner "Apt update + upgrade"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y -o Dpkg::Options::='--force-confdef' -o Dpkg::Options::='--force-confold' upgrade

banner "Disk usage (before cleanup)"
df -h /

banner "Top space consumers under / (this can take a minute)"
du -h --max-depth=1 / 2>/dev/null | sort -h | tail -20

banner "Reclaiming low-risk space"
journalctl --vacuum-time=14d || true
apt-get autoremove --purge -y
apt-get clean

banner "Disk usage (after cleanup)"
df -h /

USED_PERCENT="$(df --output=pcent / | tail -n1 | tr -d ' %')"
echo
echo "Root filesystem is at ${USED_PERCENT}% used."

if (( USED_PERCENT > DISK_GATE_PERCENT )); then
  cat <<EOF >&2

preflight: GATE FAILED.

/ is still above ${DISK_GATE_PERCENT}% after cleanup. Common culprits to
investigate before installing more services on this host:

  * Next.js build cache:        du -sh ~/development/.next
  * Docker images (if any):     docker system df
  * Stale node_modules:         du -sh ~/*/node_modules 2>/dev/null
  * Old kernels:                apt list --installed 2>/dev/null | grep linux-image

EOF
  exit 1
fi

cat <<EOF

preflight: PASS. The host is ready for Section 2 of INSTALL.md.

Next:
  bash install-collector.sh

EOF
