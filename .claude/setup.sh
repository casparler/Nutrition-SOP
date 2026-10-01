#!/usr/bin/env bash
# Setup fuer Claude-Cloud-Sitzungen.
#
# Laeuft beim Start der Umgebung. Bewusst minimal gehalten: Node und git bringt
# die Umgebung mit, zusaetzliche Systempakete braucht dieses Projekt nicht.
# Laufzeit unter einer Minute.
set -euo pipefail

echo "==> npm ci"
npm ci --no-audit --fund=false

echo "==> Selbsttest"
npm run lint
npm test

echo
echo "Bereit. Naechste Schritte:"
echo "  npm run check   Lint und Tests zusammen (muss vor jedem Commit gruen sein)"
echo "  CLAUDE.md       Projektkontext, Befehle, Konventionen"
echo "  AGENTS.md       verbindliche klinische Regeln -- vor Aenderungen an"
echo "                  calculator.js lesen"
