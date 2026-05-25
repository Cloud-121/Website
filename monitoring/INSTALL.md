# VPS Monitoring - Grafana Cloud Collector

Runbook for installing the metrics + logs collector on the Gulf Coast Mesh
production VPS (`152.53.83.210`, Debian 13) so it ships to your existing
Grafana Cloud org. Nothing about Grafana / Prometheus / Alertmanager itself
runs on the VPS - those are hosted by Grafana Cloud.

## What lands on the VPS

```
/usr/local/bin/node_exporter                      # system metrics agent
/etc/systemd/system/node_exporter.service         # systemd unit (we write it)
/etc/apt/sources.list.d/grafana.list              # Grafana apt repo
/etc/apt/keyrings/grafana.gpg                     # apt repo signing key
/etc/alloy/config.alloy                           # collector config (with token)
/etc/systemd/system/alloy.service                 # installed by the alloy package
/var/lib/alloy/                                   # collector WAL working dir
```

Combined resident set on the VPS: ~80-120 MiB RAM, ~100 MiB disk.

## File map in this folder

| File                                        | What it is                                                                                          |
|---------------------------------------------|-----------------------------------------------------------------------------------------------------|
| `INSTALL.md`                                | This runbook.                                                                                       |
| `ALERTS.md`                                 | Section 6 expanded - one-table-per-alert reference for the Grafana Cloud Alerts UI.                 |
| `alloy-config.alloy.template`               | Full collector config (metrics + logs). Has `__PROM_*__` / `__LOKI_*__` placeholders the renderer fills. |
| `alloy-config.metrics-only.alloy.template`  | Metrics-only variant for when you do not yet have a Loki write token. Renderer picks it via `--metrics-only`. |
| `scripts/preflight.sh`                      | Pre-install audit. Run on the VPS first. Pass/fail gate on disk usage.                              |
| `scripts/install-collector.sh`              | One-shot installer. Idempotent. Handles node_exporter + Alloy apt install + service enable.         |
| `scripts/render-alloy-config.sh`            | Reads creds from env vars, renders the template into a real config file ready to copy onto the VPS. |

---

## Section 0 - Gather Grafana Cloud credentials

The stack is **`gulfcoastmesh.grafana.net`** (Instance ID `1665176`, region
`prod-eu-west-2`). The collector on the VPS needs these per-destination
strings:

```
PROM_URL       = https://prometheus-prod-65-prod-eu-west-2.grafana.net/api/prom/push
PROM_USERNAME  = 3254576           # numeric Instance ID for hosted Prometheus
PROM_TOKEN     = glc_...            # token with metrics:write scope

LOKI_URL       = https://logs-prod-012.grafana.net/loki/api/v1/push
LOKI_USERNAME  = 1622963           # numeric Instance ID for hosted Loki
LOKI_TOKEN     = glc_...            # token with logs:write scope
```

The `PROM_URL`, `PROM_USERNAME`, `LOKI_URL`, `LOKI_USERNAME` values above
are the ones pulled from this stack and can be used as-is. **Only the two
tokens need to be obtained.**

### About the tokens

Grafana Cloud's "Data Source settings" page shows you a **read-only** token
for each data source (used by Grafana itself to query). Alloy needs **write**
tokens. You have two choices:

**Option A - one access-policy token covering both destinations (simpler).**
This is what the rest of this runbook assumes when it says "the token".

1. Cloud Portal -> **Access Policies** -> *Create access policy*.
2. Name: `gulfcoast-mesh-vps`.
3. Realms: leave default (your stack).
4. Scopes: tick `metrics:write` **and** `logs:write`. Nothing else.
5. Save, then on the policy row click *Add token*. Name: `vps-alloy`.
6. Copy the token now (shown once). Set both `PROM_TOKEN` and `LOKI_TOKEN`
   to this same value, or just set `CLOUD_TOKEN` and the renderer fills
   both for you.

**Option B - separate write-only data-source tokens (least privilege).**
On the Cloud Portal, click "Send Metrics" on the Prometheus tile and "Send
Logs" on the Loki tile. Each page offers to generate a token whose name
ends in `-write-prometheus-api` or `-write-loki-api`. Use those values for
`PROM_TOKEN` and `LOKI_TOKEN` respectively.

The renderer (`scripts/render-alloy-config.sh`) sanity-checks the token
names and refuses to proceed if it sees a `-read-` token in a write slot,
so you cannot accidentally deploy with the wrong scope.

### If you do not have a Loki write token yet

You can still deploy **metrics today** and add logs later. Render with
`--metrics-only` (Section 4), and when you have the Loki write token,
re-render with the full template and `systemctl restart alloy`. No data
loss - metric names and labels stay identical across both configs.

### Security note

If you paste a Grafana Cloud token anywhere it does not belong (chat,
email, screenshots, public docs), revoke it from Cloud Portal -> Access
Policies -> Tokens and reissue. Tokens are bearer credentials - whoever
has the string can write metrics/logs as you.

---

## Section 1 - Pre-flight on the VPS

```bash
ssh root@152.53.83.210

# Confirm distro is what we expect
grep -E '^(NAME|VERSION)=' /etc/os-release

# Keep the base system current before adding packages
apt update && apt upgrade -y

# Audit disk - your last fastfetch showed / at 90%
df -h /
du -h --max-depth=1 / 2>/dev/null | sort -h | tail -20

# Low-risk reclaim. After this, df -h / again.
journalctl --vacuum-time=14d
apt autoremove --purge -y
apt clean
df -h /
```

**Gate**: if `/` is still above 85% after the cleanup, stop and investigate.
Common culprits on a Next.js host:

- `~/development/.next/` build caches (`du -sh ~/development/.next`)
- Docker images if any (`docker system df`, then `docker system prune -a`)
- Stale `node_modules` trees (`du -sh ~/*/node_modules`)
- Old kernels (`apt list --installed | grep linux-image`)

We do not want to install Alloy on a host that is one log rotation away
from a full disk.

---

## Section 2 - Install node_exporter v1.11.1

Binds to **`127.0.0.1:9100` only**. Never exposed to the public internet.
The Alloy collector scrapes it locally.

You have two ways to run this section: paste each command into the SSH
session by hand, or scp `scripts/install-collector.sh` up and run it.
The script is idempotent - re-running it is safe.

### Manual

```bash
NE_VER=1.11.1
cd /tmp
wget -q "https://github.com/prometheus/node_exporter/releases/download/v${NE_VER}/node_exporter-${NE_VER}.linux-amd64.tar.gz"
tar xzf "node_exporter-${NE_VER}.linux-amd64.tar.gz"
install -o root -g root -m 0755 "node_exporter-${NE_VER}.linux-amd64/node_exporter" /usr/local/bin/node_exporter
useradd --system --no-create-home --shell /usr/sbin/nologin node_exporter || true

cat > /etc/systemd/system/node_exporter.service <<'EOF'
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
systemctl status node_exporter --no-pager
curl -s http://127.0.0.1:9100/metrics | head -n 5
```

**Expected**: `active (running)` and `curl` returns lines starting with
`# HELP go_gc_duration_seconds ...`.

---

## Section 3 - Install Grafana Alloy

```bash
mkdir -p /etc/apt/keyrings
wget -qO- https://apt.grafana.com/gpg.key | gpg --dearmor -o /etc/apt/keyrings/grafana.gpg
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" \
  > /etc/apt/sources.list.d/grafana.list
apt update
apt install -y alloy
systemctl status alloy --no-pager
```

The apt package ships with `/etc/alloy/config.alloy` pre-installed as an
empty example. We replace it in the next section.

---

## Section 4 - Render and install the Alloy config

This is the only step that touches the credentials.

### 4a. Pick a mode

| Situation                                              | Command                                              |
|--------------------------------------------------------|------------------------------------------------------|
| You have **both** a metrics-write and logs-write token | `./scripts/render-alloy-config.sh`                   |
| You have **only** a metrics-write token (logs later)   | `./scripts/render-alloy-config.sh --metrics-only`    |

### 4b. Render on your laptop

```bash
cd /home/mrsharky/Documents/Agent-AI-Workspace/GulfcoastMeshWebsite/development/monitoring

# Values for the gulfcoastmesh.grafana.net stack (from Section 0)
export PROM_URL='https://prometheus-prod-65-prod-eu-west-2.grafana.net/api/prom/push'
export PROM_USERNAME='3254576'
export PROM_TOKEN='glc_...your_metrics_write_token...'

# Full mode only - skip if you are running --metrics-only
export LOKI_URL='https://logs-prod-012.grafana.net/loki/api/v1/push'
export LOKI_USERNAME='1622963'
export LOKI_TOKEN='glc_...your_logs_write_token...'

# If you used Option A (one access-policy token), set this instead of
# the two *_TOKEN vars - the renderer falls back to it:
# export CLOUD_TOKEN='glc_...both_scopes...'

./scripts/render-alloy-config.sh > /tmp/config.alloy        # full mode
# or
./scripts/render-alloy-config.sh --metrics-only > /tmp/config.alloy

scp /tmp/config.alloy root@152.53.83.210:/etc/alloy/config.alloy

# Wipe the rendered copy - it contains a token
shred -u /tmp/config.alloy
```

The renderer refuses to emit if:

- A required env var is unset (with a clear message about which).
- Any `__PLACEHOLDER__` survives the substitution.
- A `*_TOKEN` value is actually a Grafana Cloud read-only data-source
  token (it inspects the embedded name and bails out).

### 4c. Apply on the VPS

```bash
ssh root@152.53.83.210

chown root:alloy /etc/alloy/config.alloy
chmod 0640 /etc/alloy/config.alloy
alloy fmt /etc/alloy/config.alloy >/dev/null   # exits non-zero on syntax errors
systemctl restart alloy
systemctl status alloy --no-pager
journalctl -u alloy -n 80 --no-pager
```

Look in the journal for:

- `started component prometheus.remote_write.grafana_cloud`
- `started component loki.write.grafana_cloud` *(full mode only)*
- No `401`/`403`/`unauthorized` lines
- No `dial tcp ... no such host` lines (would mean a typo in the URL)

### 4d. (Optional) Edit on the VPS directly

If you would rather not move the rendered config over scp, paste the
relevant template contents into `nano /etc/alloy/config.alloy` and hand-
replace each `__...__` marker. Then run the `chown` / `chmod` / `alloy fmt`
/ `systemctl restart` sequence from 4c.

---

## Section 5 - Verify in Grafana Cloud

In <https://gulfcoastmesh.grafana.net>:

1. **Explore** -> data source `gulfcoastmesh-prom` -> run each:
   - `up{instance="gulfcoast-mesh-vps"}` -> should return `1`.
   - `node_memory_MemAvailable_bytes{host="gulfcoast-mesh-vps"}` -> plots.
   - `node_filesystem_avail_bytes{mountpoint="/",host="gulfcoast-mesh-vps"}` -> plots.

2. **Explore** -> data source `grafanacloud-gulfcoastmesh-logs` -> run
   *(full mode only - skip if you rendered with `--metrics-only`)*:
   - `{host="gulfcoast-mesh-vps"}` -> recent journald lines stream in.

3. **Dashboards** -> *New* -> *Import*:
   - ID `1860` ("Node Exporter Full") - pick the `gulfcoastmesh-prom` DS.
   - ID `20696` ("Alloy meta-monitoring") - collector self-health.

If `up` is `0`:

- `journalctl -u alloy -n 200 --no-pager` and look for `401`/`403` (token
  scope missing) or DNS errors (URL typo).
- Make sure the access policy token has **both** `metrics:write` and
  `logs:write` checked, not just one.
- The Prometheus username goes with the Prometheus URL, the Loki username
  with the Loki URL - it is easy to swap them by mistake.

---

## Section 6 - Recommended alert rules (Grafana Cloud UI)

See **`ALERTS.md`** in this folder for the full, table-per-rule
reference (contact point, six recommended rules, end-to-end test fire).
The short version:

| Alert                       | Trips on                                                                                | For   |
|-----------------------------|------------------------------------------------------------------------------------------|-------|
| `vps host down`             | `up{instance="gulfcoast-mesh-vps", job="node_exporter"} == 0`                            | 5m    |
| `vps disk low`              | `/` filesystem available < 10%                                                           | 1h    |
| `vps memory critical`       | `MemAvailable / MemTotal < 0.05`                                                         | 5m    |
| `vps cpu sustained`         | `node_load5 > 2` (the VPS has 2 cores)                                                   | 15m   |
| `alloy remote_write failing`| `increase(prometheus_remote_storage_samples_failed_total[10m]) > 0`                      | 15m   |

Wire a contact point under **Alerts** -> *Contact points*. Discord
webhook is easiest - paste the URL from the GCM Discord channel settings.

---

## Section 7 - Source zips you already downloaded

`/home/mrsharky/Documents/Agent-AI-Workspace/GulfcoastMeshWebsite/server-monitoring/`
contains upstream source code, not runnable binaries:

- `prometheus-3.11.3.zip` - **not used**; Grafana Cloud's hosted
  Prometheus is the TSDB.
- `grafana-13.0.1-security-01.zip` - **not used**; Grafana Cloud is the
  UI.
- `alertmanager-0.32.1.zip` - **not used**; Grafana Cloud alerting takes
  the role.
- `node_exporter-1.11.1.zip` - the binary we install in Section 2 is the
  same version cut from the same release.

You can keep the zips for offline reference or remove them. They are not
referenced by anything on the VPS.

---

## Rollback

If something breaks and you want the VPS back exactly as it was:

```bash
# Stop and remove the services
systemctl disable --now alloy node_exporter
rm /etc/systemd/system/node_exporter.service
systemctl daemon-reload

# Uninstall packages
apt remove --purge -y alloy
apt autoremove --purge -y

# Drop config + binary + user
rm -rf /etc/alloy /var/lib/alloy
rm /usr/local/bin/node_exporter
userdel node_exporter

# Drop the apt repo
rm /etc/apt/sources.list.d/grafana.list /etc/apt/keyrings/grafana.gpg
apt update
```

After this the VPS is byte-identical to its pre-monitoring state apart
from any apt updates picked up during Section 1.
