#!/usr/bin/env bash
#
# VCMS development bootstrap / restore.
#
#   bash scripts/dev-bootstrap.sh
#
# Safe to re-run: every step is skipped when it is already satisfied. Typical
# use is after a fresh clone (`npm run setup` also covers the happy path) or
# when a sandbox/container has been recycled and the git-ignored artefacts —
# node_modules/, server/.env, client/.env, the SQLite file and client/dist —
# have disappeared.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
ok()   { printf '    \033[0;32m✓\033[0m %s\n' "$1"; }
note() { printf '    \033[0;33m•\033[0m %s\n' "$1"; }

# ── 1. Dependencies ─────────────────────────────────────────────────────────
step "Node dependencies"
if [ -d node_modules/@vcms ] && [ -d node_modules/better-sqlite3/build ]; then
  ok "workspaces already installed"
else
  # better-sqlite3 and sharp ship prebuilt binaries, but when the npm cache is
  # cold (or the registry proxy does not serve the prebuild) node-gyp compiles
  # better-sqlite3 from source and needs Node headers. Use the headers that are
  # already on disk instead of downloading them from nodejs.org.
  if [ -d /usr/local/include/node ]; then
    note "building native modules against local headers (/usr/local/include/node)"
    npm_config_nodedir=/usr/local npm install
  else
    npm install
  fi
  ok "dependencies installed"
fi

# ── 2. Environment files ────────────────────────────────────────────────────
step "Environment files (git-ignored)"
if [ -f server/.env ]; then
  ok "server/.env present"
else
  node --input-type=module -e "
    import { randomBytes } from 'node:crypto';
    import { readFileSync, writeFileSync } from 'node:fs';
    const env = readFileSync('server/.env.example', 'utf8')
      .replace(/^JWT_ACCESS_SECRET=.*\$/m, 'JWT_ACCESS_SECRET=' + randomBytes(48).toString('hex'))
      .replace(/^JWT_REFRESH_SECRET=.*\$/m, 'JWT_REFRESH_SECRET=' + randomBytes(48).toString('hex'));
    writeFileSync('server/.env', env);
  "
  ok "server/.env created with freshly generated JWT secrets"
fi

if [ -f client/.env ]; then
  ok "client/.env present"
else
  printf 'VITE_PROXY_TARGET=http://127.0.0.1:4000\nVITE_APP_NAME=Village Complaint Management System\n' > client/.env
  ok "client/.env created"
fi

# ── 3. Database ─────────────────────────────────────────────────────────────
step "Database (migrations + demonstration data)"
DB_FILE="$(grep -E '^DB_FILENAME=' server/.env | cut -d= -f2- | tr -d '\r')"
DB_FILE="${DB_FILE:-./data/vcms.sqlite}"
if [ -f "server/${DB_FILE#./}" ]; then
  ok "database already exists (migrations are idempotent, seed skips existing data)"
else
  note "creating schema and seeding demo data"
fi
npm run db:migrate --silent
npm run db:seed --silent
ok "database ready"

# ── 4. Client build (optional, used when the API serves the SPA) ────────────
step "Client production build"
if [ -f client/dist/index.html ]; then
  ok "client/dist present"
else
  npm run build --silent
  ok "client built"
fi

# ── 5. Next steps ───────────────────────────────────────────────────────────
cat <<'MSG'

┌──────────────────────────────────────────────────────────────┐
│  Bootstrap complete                                          │
└──────────────────────────────────────────────────────────────┘
  Start the portal:      npm run dev
    • web client   →  http://localhost:5173   (proxies /api)
    • REST API     →  http://localhost:4000/api

  Split terminals:  npm run dev:server   /   npm run dev:client
  Tests:            npm test

  Development sign-in (seeded data — never use in production)
    Administrator   : admin@vcms.gov.in      / Admin@12345
    Village Officer : raj.kumar@vcms.gov.in  / Officer@12345
    Citizen         : arun.kumar@example.com / Citizen@12345
MSG
