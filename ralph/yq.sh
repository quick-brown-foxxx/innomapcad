#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${SCRIPT_DIR}/.bin"
YQ_BIN="${BIN_DIR}/yq"

# If yq already exists, just run it
if [[ -x "$YQ_BIN" ]]; then
  exec "$YQ_BIN" "$@"
fi

# Detect OS
case "$(uname -s)" in
  Linux)  OS="linux" ;;
  Darwin) OS="darwin" ;;
  *)      echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac

# Detect architecture
case "$(uname -m)" in
  x86_64)  ARCH="amd64" ;;
  aarch64) ARCH="arm64" ;;
  arm64)   ARCH="arm64" ;;
  *)       echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

echo "Downloading yq for ${OS}/${ARCH}..." >&2
mkdir -p "$BIN_DIR"
curl -fsSL "https://github.com/mikefarah/yq/releases/latest/download/yq_${OS}_${ARCH}" -o "$YQ_BIN"
chmod +x "$YQ_BIN"

exec "$YQ_BIN" "$@"
