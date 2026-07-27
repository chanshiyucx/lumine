#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "$PROJECT_DIR/Cargo.toml" ]]; then
  echo "error: could not find Cargo.toml next to build.sh: $PROJECT_DIR" >&2
  exit 1
fi

cd "$PROJECT_DIR"
exec cargo run --release
