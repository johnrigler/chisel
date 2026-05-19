#!/usr/bin/env bash
# chisel-api.sh
# Sourceable Bash client for the Chisel RPC proxy.
#
# Usage:
#   source ./chisel-api.sh
#   chisel_load
#   chisel_methods
#   chisel_getrawtransaction 41b6... 1
#   chisel_tx_getrawtransaction 41b6... 1
#   chisel_rpc getrawtransaction '["41b6...",1]'
#
# Configuration:
#   export CHISEL_API_URL="https://rigler.org:8769"
#   export CHISEL_RPC_ID="chisel-bash"
#   export CHISEL_CURL_OPTS="--silent --show-error --fail-with-body"

# Do not set -e in a sourced library. Let the caller decide shell policy.

: "${CHISEL_API_URL:=https://rigler.org:8769}"
: "${CHISEL_RPC_ID:=chisel-bash}"
: "${CHISEL_CURL_OPTS:=--silent --show-error --fail-with-body}"
: "${CHISEL_JSON_RPC_VERSION:=1.0}"

_chisel_have() {
  command -v "$1" >/dev/null 2>&1
}

_chisel_trim_slash() {
  printf '%s' "${1%/}"
}

chisel_set_url() {
  if [ "$#" -ne 1 ]; then
    printf 'usage: chisel_set_url URL\n' >&2
    return 2
  fi

  CHISEL_API_URL="$1"
  export CHISEL_API_URL
}

chisel_url() {
  printf '%s\n' "$CHISEL_API_URL"
}

chisel_require_tools() {
  local missing=0

  if ! _chisel_have curl; then
    printf 'missing required command: curl\n' >&2
    missing=1
  fi

  if ! _chisel_have python3 && ! _chisel_have python; then
    printf 'missing required command: python3 or python\n' >&2
    missing=1
  fi

  return "$missing"
}

_chisel_python() {
  if _chisel_have python3; then
    command python3 "$@"
  else
    command python "$@"
  fi
}

# Convert shell args to a JSON array.
# Each arg is parsed as JSON when valid JSON, otherwise kept as a string.
# Examples:
#   abc       -> "abc"
#   1         -> 1
#   true      -> true
#   '{"a":1}' -> {"a":1}
_chisel_args_to_json_array() {
  _chisel_python - "$@" <<'PY'
import json
import sys

out = []
for value in sys.argv[1:]:
    try:
        out.append(json.loads(value))
    except Exception:
        out.append(value)

print(json.dumps(out, separators=(",", ":")))
PY
}

_chisel_build_request() {
  local method="$1"
  local params_json="$2"

  _chisel_python - "$CHISEL_JSON_RPC_VERSION" "$CHISEL_RPC_ID" "$method" "$params_json" <<'PY'
import json
import sys

version, request_id, method, params_json = sys.argv[1:5]
try:
    params = json.loads(params_json)
except Exception as exc:
    raise SystemExit("invalid params JSON: %s" % exc)

print(json.dumps({
    "jsonrpc": version,
    "id": request_id,
    "method": method,
    "params": params,
}, separators=(",", ":")))
PY
}

_chisel_filter_response() {
  _chisel_python - <<'PY'
import json
import sys

text = sys.stdin.read()
try:
    payload = json.loads(text)
except Exception:
    sys.stdout.write(text)
    raise SystemExit(0)

if payload.get("error"):
    err = payload["error"]
    if isinstance(err, dict):
        msg = err.get("message") or json.dumps(err, separators=(",", ":"))
    else:
        msg = str(err)
    sys.stderr.write(msg + "\n")
    raise SystemExit(1)

result = payload.get("result")
print(json.dumps(result, indent=2, sort_keys=False))
PY
}

# Low-level JSON-RPC call.
# Usage:
#   chisel_rpc METHOD '[json params array]'
# Example:
#   chisel_rpc getrawtransaction '["TXID",1]'
chisel_rpc() {
  if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
    printf 'usage: chisel_rpc METHOD [PARAMS_JSON_ARRAY]\n' >&2
    return 2
  fi

  chisel_require_tools || return $?

  local method="$1"
  local params_json="${2:-[]}"
  local url request response status

  url="$(_chisel_trim_slash "$CHISEL_API_URL")"
  request="$(_chisel_build_request "$method" "$params_json")" || return $?

  response=$(curl $CHISEL_CURL_OPTS \
    -X POST \
    -H 'Content-Type: application/json' \
    --data "$request" \
    "$url")
  status=$?

  if [ "$status" -ne 0 ]; then
    return "$status"
  fi

  printf '%s' "$response" | _chisel_filter_response
}

# Same as chisel_rpc, but returns the full JSON-RPC envelope.
chisel_rpc_raw() {
  if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
    printf 'usage: chisel_rpc_raw METHOD [PARAMS_JSON_ARRAY]\n' >&2
    return 2
  fi

  chisel_require_tools || return $?

  local method="$1"
  local params_json="${2:-[]}"
  local url request

  url="$(_chisel_trim_slash "$CHISEL_API_URL")"
  request="$(_chisel_build_request "$method" "$params_json")" || return $?

  curl $CHISEL_CURL_OPTS \
    -X POST \
    -H 'Content-Type: application/json' \
    --data "$request" \
    "$url"
}

# Friendly call wrapper.
# Usage:
#   chisel_call METHOD ARG...
#   chisel_call getrawtransaction TXID 1
#   chisel_call createrawtransaction '[{"txid":"...","vout":0}]' '{"data":"6869"}'
chisel_call() {
  if [ "$#" -lt 1 ]; then
    printf 'usage: chisel_call METHOD [ARG...]\n' >&2
    return 2
  fi

  local method="$1"
  shift

  local params_json
  params_json="$(_chisel_args_to_json_array "$@")" || return $?
  chisel_rpc "$method" "$params_json"
}

chisel_call_raw() {
  if [ "$#" -lt 1 ]; then
    printf 'usage: chisel_call_raw METHOD [ARG...]\n' >&2
    return 2
  fi

  local method="$1"
  shift

  local params_json
  params_json="$(_chisel_args_to_json_array "$@")" || return $?
  chisel_rpc_raw "$method" "$params_json"
}

# Fetch the proxy method table from /methods.
chisel_methods() {
  chisel_require_tools || return $?

  local url
  url="$(_chisel_trim_slash "$CHISEL_API_URL")/methods"
  curl $CHISEL_CURL_OPTS "$url"
}

chisel_methods_pretty() {
  chisel_methods | _chisel_python -m json.tool
}

# Show one method per line, group.method.
chisel_method_list() {
  chisel_methods | _chisel_python - <<'PY'
import json
import sys

methods = json.load(sys.stdin)
for group, names in methods.items():
    for name in names:
        print("%s.%s" % (group, name))
PY
}

_chisel_sanitize_name() {
  printf '%s' "$1" | tr -c 'A-Za-z0-9_' '_'
}

_chisel_define_func() {
  local func_name="$1"
  local rpc_method="$2"

  eval "${func_name}() { chisel_call '${rpc_method}' \"\$@\"; }"
}

_chisel_define_raw_func() {
  local func_name="$1"
  local rpc_method="$2"

  eval "${func_name}() { chisel_call_raw '${rpc_method}' \"\$@\"; }"
}

# Load /methods and create shell functions.
# Creates:
#   chisel_METHOD ARG...
#   chisel_GROUP_METHOD ARG...
#   chisel_raw_METHOD ARG...
#   chisel_raw_GROUP_METHOD ARG...
#
# Example after chisel_load:
#   chisel_getrawtransaction TXID 1
#   chisel_tx_getrawtransaction TXID 1
#   chisel_raw_getrawtransaction TXID 1
chisel_load() {
  chisel_require_tools || return $?

  local tmp py_status
  tmp="$(mktemp 2>/dev/null || mktemp -t chisel_methods)" || return 1

  if ! chisel_methods > "$tmp"; then
    rm -f "$tmp"
    return 1
  fi

  _chisel_python - "$tmp" <<'PY' > "$tmp.sh"
import json
import re
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as fh:
    groups = json.load(fh)

def clean(value):
    return re.sub(r"[^A-Za-z0-9_]", "_", value)

seen = set()
for group, methods in groups.items():
    group_clean = clean(group)
    for method in methods:
        method_clean = clean(method)
        names = [
            "chisel_%s" % method_clean,
            "chisel_%s_%s" % (group_clean, method_clean),
            "chisel_raw_%s" % method_clean,
            "chisel_raw_%s_%s" % (group_clean, method_clean),
        ]
        for name in names:
            if name in seen:
                continue
            seen.add(name)
            if name.startswith("chisel_raw_"):
                print("_chisel_define_raw_func %s %s" % (name, repr(method)))
            else:
                print("_chisel_define_func %s %s" % (name, repr(method)))
PY
  py_status=$?

  if [ "$py_status" -ne 0 ]; then
    rm -f "$tmp" "$tmp.sh"
    return "$py_status"
  fi

  # shellcheck disable=SC1090
  . "$tmp.sh"
  rm -f "$tmp" "$tmp.sh"
}

# Optional: create plain RPC method names in the current shell.
# This is intentionally explicit because names like help/test/stop may collide or be dangerous.
# Usage:
#   chisel_export_plain
#   getrawtransaction TXID 1
chisel_export_plain() {
  chisel_require_tools || return $?

  local tmp py_status
  tmp="$(mktemp 2>/dev/null || mktemp -t chisel_methods)" || return 1

  if ! chisel_methods > "$tmp"; then
    rm -f "$tmp"
    return 1
  fi

  _chisel_python - "$tmp" <<'PY' > "$tmp.sh"
import json
import keyword
import re
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as fh:
    groups = json.load(fh)

def clean(value):
    return re.sub(r"[^A-Za-z0-9_]", "_", value)

seen = set()
for group, methods in groups.items():
    for method in methods:
        name = clean(method)
        if not name or name[0].isdigit() or name in seen:
            continue
        seen.add(name)
        print("_chisel_define_func %s %s" % (name, repr(method)))
PY
  py_status=$?

  if [ "$py_status" -ne 0 ]; then
    rm -f "$tmp" "$tmp.sh"
    return "$py_status"
  fi

  # shellcheck disable=SC1090
  . "$tmp.sh"
  rm -f "$tmp" "$tmp.sh"
}

# Convenience helpers for common Chisel/Ravencoin workflows.
chisel_getrawtransaction_json() {
  if [ "$#" -ne 1 ]; then
    printf 'usage: chisel_getrawtransaction_json TXID\n' >&2
    return 2
  fi
  chisel_call getrawtransaction "$1" 1
}

chisel_sendrawtransaction_hex() {
  if [ "$#" -ne 1 ]; then
    printf 'usage: chisel_sendrawtransaction_hex SIGNED_TX_HEX\n' >&2
    return 2
  fi
  chisel_call sendrawtransaction "$1"
}

chisel_decoderawtransaction_hex() {
  if [ "$#" -ne 1 ]; then
    printf 'usage: chisel_decoderawtransaction_hex RAW_TX_HEX\n' >&2
    return 2
  fi
  chisel_call decoderawtransaction "$1"
}

chisel_help() {
  cat <<'HELP'
Chisel Bash API library

Core:
  chisel_set_url URL
  chisel_url
  chisel_methods
  chisel_methods_pretty
  chisel_method_list
  chisel_load

Call forms:
  chisel_rpc METHOD '[json params array]'
  chisel_rpc_raw METHOD '[json params array]'
  chisel_call METHOD ARG...
  chisel_call_raw METHOD ARG...

Generated after chisel_load:
  chisel_METHOD ARG...
  chisel_GROUP_METHOD ARG...
  chisel_raw_METHOD ARG...
  chisel_raw_GROUP_METHOD ARG...

Examples:
  source ./chisel-api.sh
  chisel_load
  chisel_methods_pretty
  chisel_getrawtransaction 41b61850b594bcf961e7d79e3c15ff40e693df3ecf5b475a7b2179f2ee1f3b6a 1
  chisel_call getaddresstxids '"RRRRRRRRRRRRRRRRRRRRRRRRRRRRTvmrjL"'
  chisel_call createrawtransaction '[{"txid":"...","vout":0}]' '{"data":"6869"}'

Argument rule:
  Each ARG is parsed as JSON when possible. Otherwise it is sent as a string.
  Use quoted JSON for arrays/objects/explicit strings.
HELP
}
