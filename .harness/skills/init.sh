#!/usr/bin/env bash
set -euo pipefail

echo "=== Harness Initialization ==="

FOUND_MANIFEST=0

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_command() {
  if ! command_exists "$1"; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

has_npm_script() {
  local script_name="$1"
  node -e "const s=require('./package.json').scripts||{}; process.exit(s['${script_name}']?0:1)"
}

run_package_script() {
  local pm="$1"
  local script_name="$2"

  if [ "$pm" = "npm" ]; then
    npm run "$script_name"
  else
    "$pm" run "$script_name"
  fi
}

if [ -f package.json ]; then
  FOUND_MANIFEST=1

  if [ -f pnpm-lock.yaml ]; then
    PM="pnpm"
  elif [ -f yarn.lock ]; then
    PM="yarn"
  elif [ -f bun.lock ] || [ -f bun.lockb ]; then
    PM="bun"
  else
    PM="npm"
  fi

  require_command node
  require_command "$PM"

  echo "=== Installing Node dependencies with $PM ==="
  if [ "$PM" = "npm" ]; then
    npm install
  else
    "$PM" install
  fi

  echo "=== Running Node verification ==="
  if has_npm_script check; then
    run_package_script "$PM" check
  elif has_npm_script typecheck; then
    run_package_script "$PM" typecheck
  elif has_npm_script type-check; then
    run_package_script "$PM" type-check
  else
    echo "No Node check/typecheck script found; skipping type verification."
  fi

  if has_npm_script lint; then
    run_package_script "$PM" lint
  else
    echo "No Node lint script found; skipping lint."
  fi

  if has_npm_script test; then
    if [ "$PM" = "npm" ]; then
      npm test
    else
      "$PM" test
    fi
  else
    echo "No Node test script found; skipping tests."
  fi

  if has_npm_script build; then
    run_package_script "$PM" build
  else
    echo "No Node build script found; skipping build."
  fi
fi

if [ -f pyproject.toml ] || [ -f requirements.txt ]; then
  FOUND_MANIFEST=1
  echo "=== Running Python verification ==="

  if command_exists python3; then
    PYTHON_BIN="python3"
  else
    require_command python
    PYTHON_BIN="python"
  fi

  "$PYTHON_BIN" -m pytest
  "$PYTHON_BIN" -m compileall .
fi

if [ -f go.mod ]; then
  FOUND_MANIFEST=1
  require_command go
  echo "=== Running Go verification ==="
  go test ./...
fi

if [ -f Cargo.toml ]; then
  FOUND_MANIFEST=1
  require_command cargo
  echo "=== Running Rust verification ==="
  cargo test
fi

if [ -f pom.xml ]; then
  FOUND_MANIFEST=1
  require_command mvn
  echo "=== Running Maven verification ==="
  mvn test
fi

if [ -f build.gradle ] || [ -f build.gradle.kts ]; then
  FOUND_MANIFEST=1
  echo "=== Running Gradle verification ==="
  if [ -x ./gradlew ]; then
    ./gradlew test
  else
    require_command gradle
    gradle test
  fi
fi

if compgen -G "*.csproj" >/dev/null || compgen -G "*.sln" >/dev/null; then
  FOUND_MANIFEST=1
  require_command dotnet
  echo "=== Running .NET verification ==="
  dotnet test
fi

if [ "$FOUND_MANIFEST" -eq 0 ]; then
  echo "No recognized package manifest detected."
  echo "Replace this section with the project's verification commands."
fi

echo "=== Verification Complete ==="
echo ""
echo "Next steps:"
echo "1. Read feature_list.json to see current feature state"
echo "2. Pick ONE unfinished feature to work on"
echo "3. Implement only that feature"
echo "4. Re-run verification before claiming done"
