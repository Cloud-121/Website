# Grafana Cloud Alert Rules

Copy-paste-friendly definitions for the recommended alert rules. Add each
one under **Alerts -> Alert rules -> New alert rule** in the Grafana Cloud
UI. Pick *Grafana managed alert*. Point the data source at your
`grafanacloud-<stack>-prom` Prometheus.

The instance label assumes you kept `instance = "gulfcoast-mesh-vps"` in
the Alloy scrape config (see `alloy-config.alloy.template`).

## Contact point - do this first

**Alerts -> Contact points -> + Add contact point**

| Field         | Value                                                                                |
|---------------|--------------------------------------------------------------------------------------|
| Name          | `gcm-discord`                                                                        |
| Integration   | Discord                                                                              |
| Webhook URL   | Discord channel webhook from `https://discord.com/...settings...webhooks`.           |
| Avatar URL    | (optional) the GCM logo                                                              |

Test the webhook with the *Test* button. A message should land in the
target Discord channel.

Then **Alerts -> Notification policies -> Edit default policy** -> set the
default contact point to `gcm-discord`. (You can also keep an email
fallback by leaving the default as `email` and adding `gcm-discord` as a
nested matcher for severity=critical, but that is a refinement, do it
later.)

---

## Rule 1 - VPS is unreachable

| Field         | Value                                                                       |
|---------------|-----------------------------------------------------------------------------|
| Name          | `vps host down`                                                             |
| Folder        | `gcm-vps`                                                                   |
| Eval group    | `gcm-vps` (interval 1m)                                                     |
| Condition     | A is `0` (i.e. expression A returns the value 0)                            |
| Expression A  | `up{instance="gulfcoast-mesh-vps", job="node_exporter"}`                    |
| For           | `5m`                                                                        |
| Severity      | `critical`                                                                  |
| Summary       | VPS 152.53.83.210 not reporting metrics for 5 minutes.                      |
| Description   | node_exporter scrape failing or Alloy dead. Check ssh access first.         |

This fires when the collector stops shipping metrics for the VPS at all.

---

## Rule 2 - Disk filling up

| Field         | Value                                                                                                                 |
|---------------|-----------------------------------------------------------------------------------------------------------------------|
| Name          | `vps disk low`                                                                                                        |
| Folder        | `gcm-vps`                                                                                                             |
| Eval group    | `gcm-vps`                                                                                                             |
| Condition     | A < 0.10                                                                                                              |
| Expression A  | `node_filesystem_avail_bytes{mountpoint="/", instance="gulfcoast-mesh-vps", fstype!~"tmpfs\|devtmpfs"} / node_filesystem_size_bytes{mountpoint="/", instance="gulfcoast-mesh-vps", fstype!~"tmpfs\|devtmpfs"}` |
| For           | `1h`                                                                                                                  |
| Severity      | `warning`                                                                                                             |
| Summary       | / has less than 10% free for 1 hour.                                                                                  |
| Description   | Investigate `du -h --max-depth=1 /` on the VPS. Usual suspects: Next.js .next cache, journald, docker images.         |

Given the VPS started at 90% used, this is the most likely first-fire
alert. The 1-hour `for` window keeps log-rotation spikes from paging.

---

## Rule 3 - Memory exhausted

| Field         | Value                                                                                                            |
|---------------|------------------------------------------------------------------------------------------------------------------|
| Name          | `vps memory critical`                                                                                            |
| Folder        | `gcm-vps`                                                                                                        |
| Eval group    | `gcm-vps`                                                                                                        |
| Condition     | A < 0.05                                                                                                         |
| Expression A  | `node_memory_MemAvailable_bytes{instance="gulfcoast-mesh-vps"} / node_memory_MemTotal_bytes{instance="gulfcoast-mesh-vps"}` |
| For           | `5m`                                                                                                             |
| Severity      | `critical`                                                                                                       |
| Summary       | Less than 5% available memory on the VPS for 5m.                                                                 |
| Description   | OOM killer is likely about to fire. ssh in and run `ps auxf --sort=-rss \| head -20`.                            |

---

## Rule 4 - Sustained CPU saturation

| Field         | Value                                                                                          |
|---------------|------------------------------------------------------------------------------------------------|
| Name          | `vps cpu sustained`                                                                            |
| Folder        | `gcm-vps`                                                                                      |
| Eval group    | `gcm-vps`                                                                                      |
| Condition     | A > 2                                                                                          |
| Expression A  | `node_load5{instance="gulfcoast-mesh-vps"}`                                                    |
| For           | `15m`                                                                                          |
| Severity      | `warning`                                                                                      |
| Summary       | 5-minute load average > 2 (the VPS has 2 cores) for 15m.                                       |
| Description   | Something pinned the CPUs. Check `top` and the Discord recap for any heavy job kicking off.    |

Threshold `2` is hardcoded to the 2-core VPS spec in the system info you
shared. If the VPS gets resized later, bump this in lockstep.

---

## Rule 5 - Collector cannot ship to Grafana Cloud

| Field         | Value                                                                                                              |
|---------------|--------------------------------------------------------------------------------------------------------------------|
| Name          | `alloy remote_write failing`                                                                                       |
| Folder        | `gcm-vps`                                                                                                          |
| Eval group    | `gcm-vps`                                                                                                          |
| Condition     | A > 0                                                                                                              |
| Expression A  | `increase(prometheus_remote_storage_samples_failed_total{instance="gulfcoast-mesh-vps"}[10m])`                     |
| For           | `15m`                                                                                                              |
| Severity      | `warning`                                                                                                          |
| Summary       | Alloy is failing to push samples to Grafana Cloud.                                                                 |
| Description   | Probably a 401/403 (rotated token, scope dropped) or network blip. Check `journalctl -u alloy -n 200` on the VPS.  |

Self-monitoring rule. If this fires, the other rules might be silently
broken too because their data is not getting to the TSDB.

---

## Rule 6 - Website unreachable (placeholder, wire later)

Not added in this pass - the Next.js site does not currently expose a
`/metrics` endpoint or an external blackbox prober. To enable this in a
follow-up, either:

- Add the `prom-client` npm package and an `/api/metrics` route, then add
  a `prometheus.scrape` block in the Alloy config pointing at it; **or**
- Use Grafana Cloud's hosted **Synthetic Monitoring** (free tier, no
  collector changes needed) to ping `https://gulfcoastmesh.org` from
  multiple regions every 60s.

---

## Test fire

Easiest way to confirm the contact point + a real rule both work end-to-
end:

1. Temporarily edit Rule 3 (memory) to `> 0` (i.e. *any* memory available
   triggers).
2. Save. Wait 5 min for the `for:` window.
3. Confirm Discord (or email) gets a message titled
   `[FIRING] vps memory critical`.
4. Revert Rule 3 back to `< 0.05`.

Do this once on initial setup so you know alerting is wired up before you
need it.
