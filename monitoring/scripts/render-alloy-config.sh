#!/usr/bin/env bash
#
# render-alloy-config.sh - Substitute Grafana Cloud credentials into the
# alloy-config.alloy.template (or the metrics-only variant) and emit the
# rendered config on stdout.
#
# Run on your laptop, not the VPS. The output contains a write token, so
# pipe it straight to scp / shred and do not save it anywhere.
#
# Usage:
#   export PROM_URL=https://prometheus-prod-...
#   export PROM_USERNAME=1234567
#   export PROM_TOKEN=glc_...metrics-write...
#   export LOKI_URL=https://logs-prod-.../loki/api/v1/push
#   export LOKI_USERNAME=1234567
#   export LOKI_TOKEN=glc_...logs-write...
#   ./render-alloy-config.sh > /tmp/config.alloy
#
# Short forms:
#   * If you only have one access-policy token covering both metrics:write
#     and logs:write, set CLOUD_TOKEN instead and leave PROM_TOKEN/LOKI_TOKEN
#     unset; both will fall back to CLOUD_TOKEN.
#   * If you do NOT yet have a Loki write token, pass --metrics-only to
#     emit a metrics-only config (LOKI_* env vars are then ignored).
#
# After rendering:
#   scp /tmp/config.alloy root@152.53.83.210:/etc/alloy/config.alloy
#   shred -u /tmp/config.alloy

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITORING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

mode="full"
for arg in "$@"; do
  case "$arg" in
    --metrics-only) mode="metrics-only" ;;
    --full)         mode="full" ;;
    -h|--help)
      sed -n '2,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "render-alloy-config: unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

case "$mode" in
  full)         template="${MONITORING_DIR}/alloy-config.alloy.template" ;;
  metrics-only) template="${MONITORING_DIR}/alloy-config.metrics-only.alloy.template" ;;
esac

if [[ ! -f "${template}" ]]; then
  echo "render-alloy-config: template not found at ${template}" >&2
  exit 1
fi

# Token fallback: CLOUD_TOKEN covers both PROM_TOKEN and LOKI_TOKEN if either
# is unset. Lets people who created one access-policy token with both scopes
# (the simple path) set CLOUD_TOKEN once.
: "${PROM_TOKEN:=${CLOUD_TOKEN:-}}"
if [[ "$mode" == "full" ]]; then
  : "${LOKI_TOKEN:=${CLOUD_TOKEN:-}}"
fi

required=(PROM_URL PROM_USERNAME PROM_TOKEN)
if [[ "$mode" == "full" ]]; then
  required+=(LOKI_URL LOKI_USERNAME LOKI_TOKEN)
fi

missing=()
for var in "${required[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("${var}")
  fi
done

if (( ${#missing[@]} > 0 )); then
  {
    echo "render-alloy-config: missing required env vars (mode=${mode}):"
    printf '  %s\n' "${missing[@]}"
    echo
    echo "Set them in your shell first, then re-run. See INSTALL.md section 0."
    if [[ "$mode" == "full" && -z "${LOKI_TOKEN:-}" ]]; then
      echo
      echo "If you do not have a Loki write token yet, re-run with --metrics-only"
      echo "to emit a config that ships metrics only."
    fi
  } >&2
  exit 2
fi

# Quick sanity check: Grafana Cloud tokens start with `glc_`. Anything else
# is almost certainly a copy-paste error or a deprecated key.
for v in PROM_TOKEN LOKI_TOKEN; do
  val="${!v:-}"
  if [[ -n "$val" ]] && [[ ! "$val" =~ ^glc_ ]]; then
    echo "render-alloy-config: WARNING - ${v} does not start with 'glc_'. Make sure you pasted a Grafana Cloud token, not an old-style API key." >&2
  fi
done

# Read-scope detection. Grafana Cloud's auto-provisioned data-source tokens
# embed a name like `hl-read-loki-api` / `hm-write-prometheus-api` in the
# base64 payload after the glc_ prefix. We can decode and warn if the user
# pasted a read-only token where we need write.
warn_if_read_only() {
  local var="$1" want_scope="$2"
  local val="${!var:-}"
  [[ -z "$val" ]] && return 0
  local body name
  body="$(printf '%s' "$val" | sed 's/^glc_//')"
  # Tolerate missing padding by adding up to 2 `=`s.
  while (( ${#body} % 4 != 0 )); do body+='='; done
  name="$(printf '%s' "$body" | base64 -d 2>/dev/null | sed -n 's/.*"n":"\([^"]*\)".*/\1/p')"
  if [[ -n "$name" && "$name" == *"-read-"* ]]; then
    echo "render-alloy-config: ERROR - ${var} appears to be a READ-only token (\"${name}\"). Alloy needs ${want_scope}. See INSTALL.md section 0." >&2
    return 1
  fi
  return 0
}

read_check_ok=1
warn_if_read_only PROM_TOKEN "metrics:write" || read_check_ok=0
if [[ "$mode" == "full" ]]; then
  warn_if_read_only LOKI_TOKEN "logs:write" || read_check_ok=0
fi
if (( read_check_ok == 0 )); then
  exit 3
fi

# Escape any `&` or `/` that appear in values - they have meaning in sed
# replacement text.
escape() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

PROM_URL_ESC="$(escape "${PROM_URL}")"
PROM_USERNAME_ESC="$(escape "${PROM_USERNAME}")"
PROM_TOKEN_ESC="$(escape "${PROM_TOKEN}")"

sed_args=(
  -e "s/__PROM_URL__/${PROM_URL_ESC}/g"
  -e "s/__PROM_USERNAME__/${PROM_USERNAME_ESC}/g"
  -e "s/__PROM_TOKEN__/${PROM_TOKEN_ESC}/g"
)

if [[ "$mode" == "full" ]]; then
  LOKI_URL_ESC="$(escape "${LOKI_URL}")"
  LOKI_USERNAME_ESC="$(escape "${LOKI_USERNAME}")"
  LOKI_TOKEN_ESC="$(escape "${LOKI_TOKEN}")"
  sed_args+=(
    -e "s/__LOKI_URL__/${LOKI_URL_ESC}/g"
    -e "s/__LOKI_USERNAME__/${LOKI_USERNAME_ESC}/g"
    -e "s/__LOKI_TOKEN__/${LOKI_TOKEN_ESC}/g"
  )
fi

rendered="$(sed "${sed_args[@]}" "${template}")"

# Belt-and-suspenders: if any __PLACEHOLDER__ token survived, refuse to emit.
if echo "${rendered}" | grep -qE '__[A-Z][A-Z_]*__'; then
  echo "render-alloy-config: ERROR - unfilled placeholders remain:" >&2
  echo "${rendered}" | grep -oE '__[A-Z][A-Z_]*__' | sort -u | sed 's/^/  /' >&2
  exit 4
fi

printf '%s\n' "${rendered}"
