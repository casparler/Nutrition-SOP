# AGENTS.md — NeoNutri Neonatologie-Rechner

> **Verbindliche Leitlinien für alle KI-Agenten und Entwickler, die an diesem Projekt arbeiten.**
> Dies ist eine **klinische Safety-First-Applikation**. Verstöße gegen die folgenden Regeln können zu Patientengefährdung führen.

---

## 🔴 SAKROSANKTE INVARIANTEN — NIEMALS BRECHEN

### 1. Test-Suite (Vitest) — ALLE Tests müssen IMMER zu 100 % grün sein

- Die Datei [tests/calculator.test.js](./tests/calculator.test.js) enthält **aktuell 44 klinische Tests** (Sektionen A–G; ursprünglich 31, in v1.2 um 13 Validierungs-Tests A4a–A4m erweitert), die das gesamte Sicherheitsverhalten des Calculators absichern.
- Die Anzahl darf wachsen, aber **nie schrumpfen**. Neue Tests gerne — alte nur mit klinischer Begründung anpassen.
- **Vor JEDEM Refactoring, JEDEM Commit, JEDER produktiven Änderung an `calculator.js` muss `npm test` ausgeführt werden — ALLE Tests müssen bestanden sein.**
- **Nach JEDER Änderung an `calculator.js` muss `npm test` erneut grün sein, bevor die Aufgabe als abgeschlossen gilt.**
- Tests dürfen **niemals** angepasst werden, um Produktivcode-Änderungen "passend zu machen". Wenn ein Test rot wird, ist standardmäßig der Produktivcode falsch — nicht der Test.
- Verbotene Workarounds: `.skip`, `.todo`, auskommentieren, `expect(true).toBe(true)` als Platzhalter, manipulierte Vergleichswerte.

```bash
npm test    # MUSS 31 passed, 0 failed zeigen
```

### 2. ELBW-Klassengrenze bei exakt 1000 g — SAKROSANKT

- In [calculator.js](./calculator.js) (`getTargets()`) gilt zwingend: **`bw <= 1000` → ELBW-Zweig**.
- Ein Geburtsgewicht von **exakt 1000 g** muss nach Master-Protokoll als ELBW behandelt werden — nicht als VLBW.
- Diese Grenze ist **inklusiv** und entspricht dem `NICU_NUTRITION_MASTER_PROTOCOL`.
- Test **C1** (`VLBW (1000g) Tag 3 — TFI-Ziel 120–140 ml/kg/d`) prüft das Boundary-Verhalten.
- **Verboten:** Änderung auf `bw < 1000`, Verschiebung der Grenze auf 999/1001, oder Entfernung des Kommentars `// Master-Protokoll: ELBW-Klassengrenze inklusiv bei 1000g`.

### 3. Vorgelagerter Validierungs-Layer in `calculate()` — DARF NIE ENTFERNT WERDEN

- Am Anfang von `calculate()` (Step 0, vor jeglicher Berechnungslogik) steht ein harter Input-Validierungs-Layer, der bei klinisch/physikalisch unmöglichen Werten sofort eine `ValidationError` wirft:
  - `birthWeight <= 200 g` → throw
  - `currentWeight < 0` → throw
  - `tfi > 200 ml/kg/d` → throw
  - `tfi < 0` → throw
- **Diese Validierung darf unter keinen Umständen entfernt, umgangen, gelockert oder hinter Feature-Flags versteckt werden.**
- Sie ist der **Safety-First-Gatekeeper** gegen Fat-Finger-Eingaben und sichert die Patientensicherheit.
- Die Tests **A3a, A3b, A3c** decken jeweils einen dieser Validierungsfälle ab und müssen grün bleiben.
- Die Klasse `ValidationError` (definiert oben in `calculator.js`) ist Teil des öffentlichen Vertrags.

---

## 🛡️ UI-Schutzlayer (Frontend)

- `calculator.calculate(data)` wird in [index.html](./index.html) (`window.updateCalculations`) **ausschließlich innerhalb eines `try-catch`-Blocks** aufgerufen.
- Bei `ValidationError` wird der rote Banner `#validation-error-banner` eingeblendet (mit `role="alert"`, `aria-live="assertive"`); `displayResults()` wird übersprungen.
- **Dieser try-catch darf nie entfernt werden** — sonst friert die App bei ungültigen Eingaben ein.

---

## 📋 Standard-Workflow für jede Änderung an `calculator.js`

1. **Vor der Änderung:** `npm test` ausführen → muss 31/31 grün sein. Sonst zuerst Bestand reparieren.
2. **Während der Änderung:** Keine der drei Invarianten oben antasten.
3. **Nach der Änderung:** `npm test` erneut ausführen → muss 31/31 grün sein.
4. **Falls Tests rot:** Autonomer Korrektur-Loop am Produktivcode (nicht an den Tests), bis 31/31 wieder grün sind.

---

## 📁 Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| [calculator.js](./calculator.js) | Safety Core Engine — Decimal.js, Validierung, Targets, Warnings |
| [index.html](./index.html) | UI inkl. try-catch um `calculate()` und Error-Banner |
| [tests/calculator.test.js](./tests/calculator.test.js) | 31 klinische Vitest-Tests (Sektionen A–G) |
| [NICU_NUTRITION_MASTER_PROTOCOL.md](./NICU_NUTRITION_MASTER_PROTOCOL.md) | Klinische Spezifikation (Single Source of Truth) |
| [NEO_NUTRITION_MASTER_LOGIC.md](./NEO_NUTRITION_MASTER_LOGIC.md) | Logik-Spezifikation V11 |

---

## ⚠️ Bei Konflikt zwischen User-Wunsch und Invarianten

Wenn eine User-Anfrage eine der drei sakrosankten Invarianten verletzen würde:
1. **NICHT stillschweigend ausführen.**
2. Den User explizit auf den Konflikt hinweisen und die klinische Begründung nennen.
3. Eine sichere Alternative vorschlagen.
4. Nur nach expliziter, informierter Bestätigung weitermachen.

---

## 🚀 Deployment & Git-Workflow (WICHTIG für zukünftige Sessions)

### Repository-Setup — Besonderheit dieses Projekts

⚠️ **Der Obsidian-Arbeitsordner ist KEIN Git-Repository.**

- **Working Directory (lokal, kein `.git`):**
  `/Users/caspar/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian/_PARA/1_Projects/AI_Local_LLM/SOP Apps/Ernährung App/`
  → Hier arbeitet der User in Obsidian. Hier liegen alle Dateien, Specs, Backups, `node_modules/`.
  → `git status` schlägt hier FEHL — das ist erwartet.

- **GitHub Remote:**
  - HTTPS: `https://github.com/casparler/Nutrition-SOP.git`
  - Live-Site (GitHub Pages): `https://casparler.github.io/Nutrition-SOP/`
  - Default-Branch: `main`
  - Auth: macOS Keychain (Git Credential Manager) — Push funktioniert ohne Prompt.

### Standard-Workflow für neue Versionen → GitHub

```bash
# 1. Vor jeder Änderung: lokale Backups im Obsidian-Ordner
cp index.html      backup_index_v{X.Y}.html
cp calculator.js   backup_calculator_v{X.Y}.js
cp AGENTS.md       backup_AGENTS_v{X.Y}.md

# 2. Tests müssen 31/31 grün sein
npm test    # im Obsidian-Ordner

# 3. Repo frisch in /tmp klonen (wenn nicht schon vorhanden)
git clone https://github.com/casparler/Nutrition-SOP.git /tmp/Nutrition-SOP
cd /tmp/Nutrition-SOP

# 4. Feature-Branch erstellen (NIE direkt auf main!)
git checkout main
git pull
git checkout -b feature/{kurze-beschreibung}-v{X.Y}

# 5. Geänderte Dateien vom Obsidian-Ordner ins Clone kopieren
SRC="/Users/caspar/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian/_PARA/1_Projects/AI_Local_LLM/SOP Apps/Ernährung App"
cp "$SRC/calculator.js"        /tmp/Nutrition-SOP/calculator.js
cp "$SRC/index.html"           /tmp/Nutrition-SOP/index.html
cp "$SRC/AGENTS.md"            /tmp/Nutrition-SOP/AGENTS.md
cp "$SRC/package.json"         /tmp/Nutrition-SOP/package.json
cp "$SRC/package-lock.json"    /tmp/Nutrition-SOP/package-lock.json
cp "$SRC/vitest.config.js"     /tmp/Nutrition-SOP/vitest.config.js
cp -r "$SRC/tests"             /tmp/Nutrition-SOP/

# 6. Tests im Clone erneut grün?
cd /tmp/Nutrition-SOP && npm install --silent && npm test

# 7. Commit + Push
git add -A
git commit -m "feat(vX.Y): <Beschreibung>"
git push -u origin feature/{name}-v{X.Y}
# → GitHub gibt PR-URL zurück
```

### Bisherige Versionen (Changelog)

| Version | Branch | Wichtigste Änderungen | Status |
|---------|--------|----------------------|--------|
| v1.0    | `main` | Ausgangsstand (calculator.js, index.html, logic.js, products.js) | live |
| v1.1    | `feature/nicu-optimization-v1.1` | ValidationError-Layer, UI try-catch + Error-Banner, ELBW-Boundary `bw<=1000`, 31 Vitest-Tests, AGENTS.md | PR offen |
| v1.2    | `feature/super-tool-v2-evolution` | EPIC 1 R-01/R-04: Erweiterter ValidationError-Layer (Gewicht/SSW/GIR/Protein/Lipide/Ca/P/FM85/Frequenz/PostnatalAge + non-numerische Strings) → 13 neue Tests A4a–A4m, **44 Tests total** | in Arbeit |

### Git-Konfiguration im Clone
```
user.email = caspar@local
user.name  = Caspar
```

### Nicht in Git versioniert (bewusst)
Diese Dateien existieren nur lokal im Obsidian-Ordner und werden nicht gepusht (außer User wünscht es explizit):
- `NEO_NUTRITION_SPEC_V*.md`, `NEO_NUTRITION_MASTER_LOGIC_V*.md` (Versions-Specs)
- `KANBAN.md`, `AUDIT_LOG.md`, `SYSTEM_REVIEW.md`, `VALIDATION.md`
- `Expert_knowledge.md`, `skills.md`, `USER_MANUAL_V11.md`
- `backup_*_v*.*` (lokale Datei-Backups)
- `node_modules/`, `.DS_Store` (via `.gitignore`)

### Falls Push fehlschlägt
- **403/Auth-Fehler:** User um GitHub Personal Access Token bitten ODER SSH-Setup vorschlagen.
- **Conflict / non-fast-forward:** `git pull --rebase origin <branch>` im Clone, Konflikte lösen, neu pushen.
- **Branch existiert schon:** Versionsnummer erhöhen (`v1.2`, `v1.3`, …) oder mit User klären.

### User-Profil
- Der User ist **klinisch versiert**, aber **Git-Anfänger** ("ich kenne mich damit nicht aus").
- Bei Git-Operationen: kurz und nicht-technisch erklären, was passiert ist und was die nächsten Schritte sind (PR-Link, Live-URL).
- Niemals `git push --force`, `git reset --hard origin/main` oder andere zerstörerische Befehle ohne explizite Rückfrage.
- Niemals direkt auf `main` committen — immer Feature-Branch.
