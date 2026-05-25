#!/usr/bin/env bash
#
# install-collector.sh - Install node_exporter v1.11.1 and Grafana Alloy on
# a Debian 13 host. Run as root on the VPS after preflight.sh has passed.
#
# Idempotent: safe to re-run. Each step checks current state and skips work
# that is already done. Does NOT write /etc/alloy/config.alloy - that ships
# separately from this folder (see Section 4 of INSTALL.md) so the access
# token never has to live in this repo.
#
# After this script exits successfully:
#   * node_exporter is running, bound to 127.0.0.1:9100
#   * Alloy is installed and running with whatever config is already at
#     /etc/alloy/config.alloy (the apt default if you have not replaced it
#     yet - that is fine, just drop in the real one and `systemctl restart
#     alloy` afterwards)

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "install-collector: must run as root (try: sudo $0)" >&2
  exit 2
fi

NE_VERSION="1.11.1"
NE_BIN="/usr/local/bin/node_exporter"
NE_UNIT="/etc/systemd/system/node_exporter.service"
NE_ARCH="linux-amd64"
NE_TARBALL="node_exporter-${NE_VERSION}.${NE_ARCH}.tar.gz"
NE_URL="https://github.com/prometheus/node_exporter/releases/download/v${NE_VERSION}/${NE_TARBALL}"
NE_SHA256="9f5ea48e5bc7b656f8a91a32e7d7deb89f70f73dabd0d974418aca15f37d6810"
# ^ official linux-amd64 release shasum from prometheus/node_exporter v1.11.1
#   sha256sums.txt. If you ever bump NE_VERSION, refresh this from:
#     https://github.com/prometheus/node_exporter/releases/download/v<VER>/sha256sums.txt

banner() {
  printf '\n=== %s ===\n' "$1"
}

##############################################################################
# 1. node_exporter
##############################################################################

banner "node_exporter v${NE_VERSION}"

INSTALLED_VERSION=""
if [[ -x "${NE_BIN}" ]]; then
  INSTALLED_VERSION="$("${NE_BIN}" --version 2>&1 | awk '/node_exporter, version/ {print $3; exit}')"
fi

if [[ "${INSTALLED_VERSION}" == "${NE_VERSION}" ]]; then
  echo "node_exporter ${NE_VERSION} already installed at ${NE_BIN}. Skipping download."
else
  if [[ -n "${INSTALLED_VERSION}" ]]; then
    echo "Replacing node_exporter ${INSTALLED_VERSION} with ${NE_VERSION}."
  else
    echo "Installing node_exporter ${NE_VERSION}."
  fi
  cd /tmp
  wget -q --show-progress "${NE_URL}" -O "${NE_TARBALL}"
  echo "${NE_SHA256}  ${NE_TARBALL}" | sha256sum -c -
  tar xzf "${NE_TARBALL}"
  install -o root -g root -m 0755 "node_exporter-${NE_VERSION}.${NE_ARCH}/node_exporter" "${NE_BIN}"
  rm -rf "/tmp/node_exporter-${NE_VERSION}.${NE_ARCH}" "/tmp/${NE_TARBALL}"
fi

if ! id node_exporter >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin node_exporter
fi

cat > "${NE_UNIT}" <<'EOF'
[Unit]
Description=Prometheus node_exporter
After=network-online.target
Wants=network-online.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter \
  --web.listen-address=127.0.0.1:9100 \
  --collector.systemd \
  --collector.processes
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now node_exporter
systemctl restart node_exporter   # pick up unit changes on re-runs

# Smoke test - the metrics endpoint should answer on localhost.
for i in 1 2 3 4 5; do
  if curl -fs -o /dev/null http://127.0.0.1:9100/metrics; then
    echo "node_exporter is answering on 127.0.0.1:9100."
    break
  fi
  echo "Waiting for node_exporter to bind (attempt ${i}/5)..."
  sleep 1
done

if ! curl -fs -o /dev/null http://127.0.0.1:9100/metrics; then
  echo "ERROR: node_exporter did not come up. Check: systemctl status node_exporter" >&2
  exit 1
fi

##############################################################################
# 2. Grafana Alloy (via the official Grafana apt repo)
##############################################################################

banner "Grafana Alloy"

if ! command -v gpg >/dev/null 2>&1; then
  apt-get update
  apt-get install -y gnupg
fi

install -d -m 0755 /etc/apt/keyrings
if [[ ! -s /etc/apt/keyrings/grafana.gpg ]]; then
  wget -qO- https://apt.grafana.com/gpg.key | gpg --dearmor -o /etc/apt/keyrings/grafana.gpg
  chmod 0644 /etc/apt/keyrings/grafana.gpg
fi

if [[ ! -s /etc/apt/sources.list.d/grafana.list ]]; then
  echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" \
    > /etc/apt/sources.list.d/grafana.list
fi

apt-get update
apt-get install -y alloy

systemctl enable --now alloy

banner "Status"
systemctl --no-pager status node_exporter | sed -n '1,5p'
systemctl --no-pager status alloy         | sed -n '1,5p'

cat <<EOF

install-collector: DONE.

What you have now:
  * node_exporter ${NE_VERSION} bound to 127.0.0.1:9100  (active)
  * alloy installed and running with the apt default config

Next:
  1. From your laptop, render the real Alloy config (see INSTALL.md Sec. 4):
       cd /home/mrsharky/Documents/Agent-AI-Workspace/GulfcoastMeshWebsite/development/monitoring
       export PROM_URL=... PROM_USERNAME=... PROM_TOKEN=...
       export LOKI_URL=... LOKI_USERNAME=... LOKI_TOKEN=...
       # (or set CLOUD_TOKEN once if you used one access-policy token)
       ./scripts/render-alloy-config.sh > /tmp/config.alloy
       # OR if you do not have a Loki write token yet:
       # ./scripts/render-alloy-config.sh --metrics-only > /tmp/config.alloy
       scp /tmp/config.alloy root@152.53.83.210:/etc/alloy/config.alloy
       shred -u /tmp/config.alloy

  2. Back on the VPS:
       chown root:alloy /etc/alloy/config.alloy
       chmod 0640 /etc/alloy/config.alloy
       alloy fmt /etc/alloy/config.alloy >/dev/null
       systemctl restart alloy
       journalctl -u alloy -n 80 --no-pager

EOF
