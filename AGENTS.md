# AGENTS.md — NeoNutri Neonatologie-Rechner

> **Verbindliche Leitlinien für alle KI-Agenten und Entwickler, die an diesem Projekt arbeiten.**
> Dies ist eine **klinische Safety-First-Applikation**. Verstöße gegen die folgenden Regeln können zu Patientengefährdung führen.

---

## 🔴 SAKROSANKTE INVARIANTEN — NIEMALS BRECHEN

### 1. Test-Suite (Vitest) — 31 Tests müssen IMMER zu 100 % grün sein

- Die Datei [tests/calculator.test.js](./tests/calculator.test.js) enthält **31 klinische Tests** (Sektionen A–G), die das gesamte Sicherheitsverhalten des Calculators absichern.
- **Vor JEDEM Refactoring, JEDEM Commit, JEDER produktiven Änderung an `calculator.js` muss `npm test` ausgeführt werden — alle 31 Tests müssen bestanden sein.**
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
