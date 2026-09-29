# AGENTS.md — NeoNutri Neonatologie-Rechner (v3.4)

> **Verbindliche Leitlinien für alle KI-Agenten und Entwickler, die an diesem Projekt arbeiten.**
> Dies ist eine **klinische Safety-First-Applikation**. Verstöße gegen die folgenden Regeln können zu Patientengefährdung führen.
>
> **Aktueller Stand:** v3.4 — neu kalibrierte Flüssigkeitsziele, Gewichtsverlauf als Kontrollgröße, Anreicherungs-Rechner. Davor v3.3 (Sprache im UI, Quick-View-Layout), v3.2 (klinisches Review: Kopplung Zielvolumen an Nährstoffgrenzen, Nahrungspause, Ampel-Korrektur, Gesamt-Natrium), v3.1 (enteraler Aufbau, TFI-Stufen, enterale Supplemente) und v3.0 (Teaching-Layer, Energy-Gap-Index, Smart Defaults, History-Sync). Test-Suite: **150/150 grün** (Sektionen A–Q).
> CI: [.github/workflows/ci.yml](./.github/workflows/ci.yml) führt `npm test` bei jedem Push/PR aus.

---

## 🔴 SAKROSANKTE INVARIANTEN — NIEMALS BRECHEN

### 1. Test-Suite (Vitest) — ALLE Tests müssen IMMER zu 100 % grün sein

- Die Datei [tests/calculator.test.js](./tests/calculator.test.js) enthält **aktuell 150 klinische Tests** (Sektionen A–Q; ursprünglich 31, schrittweise erweitert über v1.2/v1.3 [Validierung + Type-safe Parser], v2.0 [Clinical Cockpit H1–H7], v2.1 [Predictive Analytics I1–I4 + Smoke-Test J1], v3.0 [Energy-Gap-Index K1–K5, Smart Defaults L1–L5, Frontend-Integration M1–M6], v3.1 [Enteraler Aufbau + TFI-Stufen + Supplemente N1–N20], v3.2 [Klinisches Review O1–O17], v3.3 [Sprache + Quick-View P1–P9], v3.4 [Flüssigkeitsziele, Gewichtsverlauf, Zubereitung Q1–Q23]), die das gesamte Sicherheitsverhalten des Calculators und die Frontend-Integrität absichern.
- Die Anzahl darf wachsen, aber **nie schrumpfen**. Neue Tests gerne — alte nur mit klinischer Begründung anpassen.
- **Vor JEDEM Refactoring, JEDEM Commit, JEDER produktiven Änderung an `calculator.js` muss `npm test` ausgeführt werden — ALLE Tests müssen bestanden sein.**
- **Nach JEDER Änderung an `calculator.js` muss `npm test` erneut grün sein, bevor die Aufgabe als abgeschlossen gilt.**
- Tests dürfen **niemals** angepasst werden, um Produktivcode-Änderungen "passend zu machen". Wenn ein Test rot wird, ist standardmäßig der Produktivcode falsch — nicht der Test.
- Verbotene Workarounds: `.skip`, `.todo`, auskommentieren, `expect(true).toBe(true)` als Platzhalter, manipulierte Vergleichswerte.

```bash
npm test    # MUSS 150 passed, 0 failed zeigen
```

### 2. ELBW-Klassengrenze bei exakt 1000 g — SAKROSANKT

- In [calculator.js](./calculator.js) (`getTargets()`) gilt zwingend: **`bw <= 1000` → ELBW-Zweig**.
- Ein Geburtsgewicht von **exakt 1000 g** muss nach Master-Protokoll als ELBW behandelt werden — nicht als VLBW.
- Diese Grenze ist **inklusiv** und entspricht dem `NICU_NUTRITION_MASTER_PROTOCOL`.
- Test **C1** (`Geburtsgewicht exakt 1000 g Tag 3 — ELBW-Zweig`) prüft das Boundary-Verhalten
  für TFI **und** Protein und vergleicht zusätzlich gegen 1001 g.
- Seit v3.4 gilt die inklusive Grenze auch für die Protein-Ziele (vorher `bw < 1000`).
- **Verboten:** Änderung auf `bw < 1000`, Verschiebung der Grenze auf 999/1001, oder Entfernung des Kommentars `// Master-Protokoll: ELBW-Klassengrenze inklusiv bei 1000g`.

### 3. Vorgelagerter Validierungs-Layer in `calculate()` — DARF NIE ENTFERNT WERDEN

- Am Anfang von `calculate()` (Step 0, vor jeglicher Berechnungslogik) steht ein harter Input-Validierungs-Layer, der bei klinisch/physikalisch unmöglichen Werten sofort eine `ValidationError` wirft:
  - `birthWeight <= 200 g` → throw
  - `currentWeight < 0` → throw
  - `tfi > 400 ml/kg/d` → throw *(v3.1: von 200 auf 400 angehoben, siehe unten)*
  - `tfi < 0` → throw
- **Diese Validierung darf unter keinen Umständen entfernt, umgangen, gelockert oder hinter Feature-Flags versteckt werden.**
- Sie ist der **Safety-First-Gatekeeper** gegen Fat-Finger-Eingaben und sichert die Patientensicherheit.
- Die Tests **A3a, A3b, A3c** decken jeweils einen dieser Validierungsfälle ab und müssen grün bleiben.
- Die Klasse `ValidationError` (definiert oben in `calculator.js`) ist Teil des öffentlichen Vertrags.

#### 3a. Änderung der TFI-Grenze in v3.1 — dokumentierte Ausnahme

Die ursprüngliche Grenze `tfi > 200 → throw` war klinisch **falsch kalibriert**: Frühgeborene
in der polyuren Phase (typischerweise Tag 2–5, extreme Unreife, osmotische Diurese bei
Hyperglykämie) erhalten regelhaft **200–300 ml/kg/d**. Die Berechnung brach in genau diesen
Situationen ab, in denen sie am dringendsten gebraucht wird.

Die Validierung ist **nicht entfernt**, sondern neu kalibriert und um eine abgestufte
Signalisierung ergänzt (`this.LIMITS.TFI`):

| Schwelle | Wert | Verhalten |
|----------|------|-----------|
| `hint` | 180 ml/kg/d | Gelber Hinweis (üblicher Korridor überschritten) |
| `warn` | 200 ml/kg/d | Warnung: nur bei polyurer Phase plausibel, Bilanz/Na/Gewicht kontrollieren |
| Fat-Finger-Flag | 300 ml/kg/d | Plausibilitäts-Modal |
| `max` | 400 ml/kg/d | **ValidationError** (harter Stopp, reiner Tippfehlerschutz) |

Freigabe durch den Nutzer (Neonatologe) am 14.08.2026, explizit und informiert.
Die Werte 180/200/300/400 dürfen nur mit klinischer Begründung geändert werden.
Tests **N11–N14** sichern das Verhalten ab.

---

## 🛡️ UI-Schutzlayer (Frontend)

- `calculator.calculate(data)` wird in [index.html](./index.html) (`window.updateCalculations`) **ausschließlich innerhalb eines `try-catch`-Blocks** aufgerufen.
- Bei `ValidationError` wird der rote Banner `#validation-error-banner` eingeblendet (mit `role="alert"`, `aria-live="assertive"`); `displayResults()` wird übersprungen.
- **Dieser try-catch darf nie entfernt werden** — sonst friert die App bei ungültigen Eingaben ein.

---

## 🔮 Predictive Analytics — „Modell B" (v2.1)

- `_analyzeEnergyGap()` und `_analyzeSodiumTrend()` in [calculator.js](./calculator.js) liefern **ausschließlich diagnostische Hinweise**, niemals ein Stop-Signal oder eine harte Dosis-Sperre.
- Ergebnisse landen in `res.predictive` und werden als `res.assessment.predictiveHints` (separates Array, **außerhalb** des 5er-Bullet-Caps) ausgegeben — damit Kern-Safety-Bullets nie verdrängt werden.
- Schwellwerte sind klinisch begründet und dürfen nur mit Quelle + Datum geändert werden:
  - **Energy-Gap:** kumulatives Defizit **> 150 kcal/kg** über **≥ 3 Tage** → Hinweis (Embleton 2001, konservativer Trigger).
  - **Sodium-Trend:** Anstieg der Na-**Zufuhr** **Δ > 5 mmol/kg/d in 48 h** → Hinweis „Serum-Natrium kontrollieren".
- Die History wird optional über `input.history` übergeben (Tag-Keys `"1"`, `"2"`, … mit Feldern `_kcal-kg`, `_kcal-min`, `input-sodium`). Fehlt sie, geben beide Funktionen `null` zurück — kein Fehler.

---

## 🍼 Enteraler Aufbau (v3.1, revidiert in v3.2)

- `getTargets()` liefert zwei neue Blöcke:
  - **`enteralTarget`** — Vollnahrungs-Ziel nach Reifegrad. Konstanten in `this.ENTERAL_TARGETS`.
    Die **unreifere** Einstufung aus Geburtsgewicht und Gestationsalter gewinnt (Safety-First).
    Die Tabelle unten zeigt das **ungedeckelte** Basisziel (`enteralTarget.unlimited`).
    Beatmungs-Cap, Protein- und Energie-Obergrenze deckeln es zusätzlich — siehe
    Abschnitt „Klinisches Review v3.2", Punkt 1. Bei aktiver Deckelung ist
    `capped === true` und `limitedBy` nennt den Grund.
  - **`enteralRamp`** — tagesbasierter Aufbau-Korridor (`start` + `(Lebenstag − 1) × step`),
    gedeckelt am Ziel-Maximum. Konstanten in `this.ENTERAL_RAMP`.

| Klasse | Kriterium | Ziel (ml/kg/d) | Ramp start / step |
|--------|-----------|----------------|-------------------|
| `elbw` | BW ≤ 1000 g | 160–180 | 10 / 15 |
| `vlbw` | BW ≤ 1500 g **oder** < 32 SSW | 160–180 | 15 / 20 |
| `latePre` | 32–36 SSW | 150–170 | 20 / 25 |
| `term` | ≥ 37 SSW | 130–160 | 20 / 25 |

Quellen: ESPGHAN CoN 2022 (Enteral Nutrition in Preterm Infants) — stabile wachsende
Frühgeborene benötigen 150–180 ml/kg/d, Einzelfälle bis 200 ml/kg/d sicher.
Reifgeborene: 130–160 ml/kg/d. Aufbau-Raten nach DGPM/GNPI S2k und SIFT-Trial 2019.

- **`results.enteralPhase`**: `none` / `trophic` (< 25) / `advancing` (< Ziel-Min) / `full` / `paused`.
- Der Steigerungs-Hinweis ist ein **Modell-B-Hinweis** — nie ein Stop-Signal. Er erscheint
  erst ab einer Lücke von ≥ 10 ml/kg/d zum Korridor und trägt **immer** den Toleranz-Vorbehalt
  (weiches Abdomen, unauffällige Reste, kein NEC-Verdacht, stabile Kreislaufsituation).
  Dieser Vorbehalt darf nicht entfernt werden — Test **N7** prüft ihn.
- Tests **N1–N10** sichern Ziele, Korridor, Phasen und Hinweis-Logik ab.

---

## 🥄 Enterale Supplemente (v3.1)

| Produkt | Eingabe | Rechenbasis |
|---------|---------|-------------|
| Liquigen (MCT 50 %) | `liquigenMlKg` (ml/kg/d, max 20) | 4,5 kcal/ml, 0,5 g Fett/ml, 0,05 mg Na/ml |
| Aptamil Eiweiß+ | `aptamilProteinGKg` (g Pulver/kg/d, max 5) | 3,38 kcal/g, 0,821 g Protein/g, 7,76 mg Na/g, 12,26 mg Ca/g, 5,24 mg P/g |

- **Wichtig:** Beide werden der Nahrung zugemischt. Ihr Volumen erhöht die
  Gesamtflüssigkeit **nicht** — sie gehen nur in Energie/Makros/Elektrolyte ein.
  Test **N18** sichert das ab. Wird das geändert, verschiebt sich `pnDailyGross`.
- Beiträge werden in `results` einzeln ausgewiesen (`liquigenKcalKg`, `aptamilProteinNetGKg`, …)
  und in `generateDocumentationString()` als eigene Zeile dokumentiert.
- Tests **N15–N20**.

---

## 🩺 Klinisches Review v3.2 — vier behobene Befunde

Ein Gegenlesen von v3.1 anhand realer Stationsszenarien deckte vier Probleme auf.
Die Korrekturen sind bewusst so gebaut, dass sie nicht wieder wegoptimiert werden:

### 1. Zielvolumen und Nährstoffgrenzen sind gekoppelt

`enteralTarget.max` ist das Minimum aus Basisziel, Beatmungs-Cap, **Protein-Obergrenze**
und **Energie-Obergrenze**. Ohne diese Kopplung forderte die App eine Volumensteigerung
und warnte gleichzeitig vor Überernährung (EBM + FM85 4 % bei 175 ml/kg/d → 5,25 g
Protein/kg/d, `safetyChecks.proteinLimit` fiel).

Resultierende Matrix (ELBW, spontan atmend, EBM):

| FM85 | Ziel | limitiert durch |
|------|------|-----------------|
| 0 % | 160–180 | — |
| 2 % | 150–170 | Energie |
| 4 % | 130–150 | Protein |

`_enteralDensity()` liefert die Dichte inkl. Fortifizierung; die Fallback-Tabelle dort
muss mit `products.js` synchron bleiben. Test **O3** prüft für jede FM85-Stufe, dass am
Ziel-Maximum weder Protein- noch Energielimit gesprengt wird — dieser Test ist die
eigentliche Absicherung gegen Rückfälle.

### 2. Nahrungspause (NPO) unterdrückt Aufbau-Empfehlungen

`input.feedingPaused` + `feedingPauseReason`. Ein Rechner darf ein bewusst nüchternes Kind
(NEC-Verdacht, Instabilität, peri-OP) nicht zum Füttern drängen — v3.1 meldete bei einem
post-NEC-Kind an Tag 8 „115 ml/kg/d unter dem Aufbau-Korridor". Bei aktiver Pause:
Phase `paused`, Ampel `neutral`, kein Hinweis, `recommendations.enteralAdvance === null`,
Grund in der EPR-Doku. Der Grund wird gegen eine feste Liste gemappt (kein Freitext →
kein Injection-Vektor). Tests **O7–O10**.

### 3. Enteral-Ampel bewertet den Tages-Korridor, nicht das Endziel

v3.1 verglich gegen das Vollnahrungs-Ziel — jedes Kind der ersten Lebenswoche hatte eine
rote Kachel (Alarm-Fatigue). Jetzt: grün ab Korridor erreicht, gelb bis zu **zwei
versäumten Aufbauschritten** (`2 × enteralRamp.step`), darüber rot. Die Toleranz skaliert
bewusst mit der Steigerungsrate statt mit einem festen Wert. Tests **O11–O13**.

### 4. Enterales Natrium ist in der Bilanz sichtbar

Vorbestehender Defekt: `effectiveNa` enthielt nur das parenterale Natrium. Ein Kind auf
Vollnahrung zeigte „Na 0 mmol/kg/d", obwohl über fortifizierte Milch ~1,3 mmol/kg/d liefen.
Neu: **`totalNaMmolKg` = PN + enteral**. `effectiveNa` bleibt unverändert der PN-Wert
(Osmolaritäts- und Lösungslogik hängen daran). Über den Gesamtwert laufen jetzt: die
ELBW-Hypernatriämie-Warnung, das Plausibilitäts-Flag, `_analyzeSodiumTrend()`, die
UI-Kachel und die EPR-Doku. Tests **O14–O17**.

---

## 🗣️ Sprache im sichtbaren Teil der App (v3.3)

Auf Wunsch des Nutzers werden im UI keine gehobenen Eigenbezeichnungen mehr verwendet.
Statt „Master-Protokoll" oder „Master Logic" heißt es **hausinterner Standard**, statt
„Chief Physician Review" **Klinische Beurteilung**; der Zusatz „NICU Oberarzt-Edition"
in der Kopfzeile ist entfallen.

- Gilt für **alles, was Nutzer sehen**: Beschriftungen, Tooltips, Teaching-Modal,
  Fußzeile, `rationale` der Smart Defaults, Warnungs- und Reminder-Texte.
- Gilt **nicht** für Code-Kommentare und Entwicklerdokumentation. Insbesondere der
  Kommentar `// Master-Protokoll: ELBW-Klassengrenze inklusiv bei 1000g` bleibt
  unverändert, er ist Teil der sakrosankten Invariante 2.
- Auch Entwickler-Jargon gehört nicht ins UI. Der Hinweis
  „Quelle: getSmartDefaults() → getTargets()" wurde aus dem Teaching-Modal entfernt.
- Tests **P1–P3** sichern das ab. P3 prüft den mit jsdom gerenderten Text nach Entfernen
  der `script`- und `style`-Knoten, damit Code-Kommentare nicht fälschlich anschlagen.

---

## 📐 Quick-View-Kachel (v3.3)

Die Kachel sitzt im zweispaltigen Cockpit-Raster und ist auf dem Tablet nur rund 320 px
breit. Die festen Tailwind-Größen `text-3xl md:text-4xl` liefen dort aus der Kachel
heraus. Zwei Ursachen, beide behoben:

1. Die Größen waren an den **Viewport** gekoppelt, nicht an die Kachelbreite.
   Jetzt ist `#quick-view-card` ein `container-type: inline-size` und `.qv-value`
   skaliert über `clamp(..., 9cqw, ...)`.
2. `displayResults()` setzte beim Einfärben `className = 'text-3xl md:text-4xl ...'`
   und **überschrieb damit das responsive Verhalten wieder**. Die Setter tauschen jetzt
   nur noch die Farbklasse und behalten `.qv-value`.

Weitere Maßnahmen: `.qv-grid` nutzt `minmax(0, 1fr)` und `.qv-cell` hat `min-width: 0`
(sonst erzwingt der Inhalt eine Mindestbreite und sprengt das Raster); Labels und
Einheiten kürzen per `text-overflow: ellipsis` statt umzubrechen; Beschriftungen wurden
gekürzt („Weight Velocity" → „Wachstum", „Gesamt-Energie" → „Energie").

**Beim Anfassen der Kachel beachten:** Größenklassen gehören ausschließlich ins CSS.
Wer in `displayResults()` wieder eine Tailwind-Größe setzt, bricht das Layout erneut.
Test **P5** schlägt in dem Fall fehl.

---

## 💧 Flüssigkeits-Zielspannen (v3.4)

Konstanten in `this.TFI_TARGETS`. Zwei Änderungen gegenüber v3.3:

**1. Der VLBW-Zweig war eine Kopie des ELBW-Zweigs.** Beide Blöcke in `getTargets()`
waren zeichengleich, der Kommentar behauptete fälschlich „Master-Protokoll konforme
TFI-Ziele". Der Zweig ist jetzt eigenständig.

**2. ELBW und VLBW liegen bewusst 10 ml/kg/d unter ESPGHAN 2018.** Das ist eine
dokumentierte Hausabweichung, freigegeben vom Neonatologen am 28.09.2026:

- Bell und Acarregui (Cochrane): restriktive Zufuhr senkt PDA und NEC.
- Die ESPGHAN-Tabelle unterstellt einen insensiblen Verlust, der bei heutiger
  Inkubatorfeuchte nicht mehr auftritt. Bei 90 statt 70 Prozent relativer Feuchte
  28,8 statt 47,7 ml/kg/d (J Perinatol 2025).

| Tag | ELBW (≤ 1000 g) | VLBW (≤ 1500 g) | > 1500 g |
|---|---|---|---|
| 1 | 70–90 | 60–80 | 60–80 |
| 2 | 90–110 | 90–100 | 80–100 |
| 3 | 110–130 | 100–120 | 100–120 |
| 4 | 130–150 | 120–140 | 120–140 |
| ab 5 | 150–170 | 150–170 | 140–160 |

Der Zweig über 1500 g entspricht unverändert ESPGHAN.

**Plateau statt Rampe.** Die frühere Formel `120 + (Tag − 3) × 20` lief gegen den
Beatmungs-Cap und lieferte ab Tag 6 die entartete Spanne 180–180, also den Cap als
Ziel. Ab Tag 5 gilt jetzt ein fester Plateauwert. Tests **Q1–Q6**, insbesondere **Q5**
(keine Inversion zwischen den Gewichtsklassen).

**Klassengrenze.** Die Protein-Ziele nutzten `bw < 1000`, die TFI-Ziele `bw <= 1000`.
Bei exakt 1000 g galt das Kind für die Flüssigkeit als ELBW, fürs Eiweiß als VLBW.
Beide sind jetzt inklusiv, im Einklang mit Invariante 2. Tests **C1** und **Q7**.

---

## ⚖️ Gewichtsverlauf als Kontrollgröße (v3.4)

Der postnatale Gewichtsverlust ist der verlässlichste Hinweis darauf, ob die
Flüssigkeitszufuhr passt. Konstanten in `this.WEIGHT_COURSE`. Drei Regeln:

| Situation | Ausgabe |
|---|---|
| Tag 3–7, Verlust unter 2 %, TFI am oberen Zielrand | Hinweis auf zu liberale Bilanz, PDA und Überwässerung |
| Verlust über 15 % | Warnung Dehydratation, Serum-Natrium kontrollieren |
| Nach Tag 14 Geburtsgewicht nicht erreicht | Hinweis auf Energie- und Proteinzufuhr |

Alle drei laufen nur, wenn ein aktuelles Gewicht **eingegeben** wurde. Ohne Eingabe
greift der Default `currentWeight = birthWeight` und ergäbe 0 % Verlust, also eine
Falschmeldung. Test **Q12** sichert das ab; `results.weightChangePercent` ist dann `null`.

---

## 🥄 Anreicherungs-Rechner (v3.4)

Eingegeben wird die **Zielkonzentration im Endprodukt**, nicht die Pulvermenge:

- `fm85Percent` — jetzt in 0,5-Prozent-Schritten statt ganzzahlig. 1 % entspricht
  1 g auf 100 ml (Hausregel: 4 % = 1 g auf 25 ml).
- `proteinAddPer100ml` — g Eiweiß je 100 ml. Die Pulvermenge ergibt sich über
  `APTAMIL_PROTEIN_FRACTION` (0,821). Die direkte Eingabe `aptamilProteinGKg`
  bleibt als Fallback, die Zielkonzentration hat Vorrang (Test **Q19**).

`results.preparation` liefert, was am Bett gebraucht wird: Volumen je Mahlzeit,
Pulvermenge je Mahlzeit und pro Tag, resultierendes Eiweiß je 100 ml.

**Wichtig:** Über diesen Eingabeweg ist die Protein-Obergrenze leicht zu überschreiten.
4 % FM85 plus 0,5 g/100 ml bei 150 ml/kg/d ergeben 5,25 g/kg/d. Die bestehende
CRITICAL-Warnung greift, zusätzlich nennt die App die bei diesem Volumen noch mögliche
Zielkonzentration. Tests **Q22, Q23**.

---

## 📋 Standard-Workflow für jede Änderung an `calculator.js`

1. **Vor der Änderung:** `npm test` ausführen → muss 150/150 grün sein. Sonst zuerst Bestand reparieren.
2. **Während der Änderung:** Keine der drei Invarianten oben antasten.
3. **Nach der Änderung:** `npm test` erneut ausführen → muss 150/150 grün sein.
4. **Falls Tests rot:** Autonomer Korrektur-Loop am Produktivcode (nicht an den Tests), bis 150/150 wieder grün sind.

---

## 📁 Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| [calculator.js](./calculator.js) | Safety Core Engine — Decimal.js, Validierung, Targets, Warnings |
| [index.html](./index.html) | UI inkl. try-catch um `calculate()` und Error-Banner |
| [tests/calculator.test.js](./tests/calculator.test.js) | 150 klinische Vitest-Tests (Sektionen A–Q) |
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
# 1. Vor jeder Änderung: lokale Backups nach _Archiv/backups/
cp index.html      _Archiv/backups/backup_index_v{X.Y}.html
cp calculator.js   _Archiv/backups/backup_calculator_v{X.Y}.js
cp AGENTS.md       _Archiv/backups/backup_AGENTS_v{X.Y}.md

# 2. Tests müssen 150/150 grün sein
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
| v1.2    | `feature/super-tool-v2-evolution` | EPIC 1 R-01/R-04: Erweiterter ValidationError-Layer (Gewicht/SSW/GIR/Protein/Lipide/Ca/P/FM85/Frequenz/PostnatalAge + non-numerische Strings) → 13 neue Tests A4a–A4m, **44 Tests total** | gemerged in Branch |
| v1.3    | `feature/super-tool-v2-evolution` | EPIC 1 R-02: Type-safe Parser (`_safeParseNum()`) + Hard-Limits für naclMl/kclMl/carrierVolume/microVolume/secondary/hiddenSodium/length/head/previousWeight → 9 neue Tests A5a–A5i, **53 Tests total** | gemerged in Branch |
| v2.0    | `feature/clinical-cockpit-v2.0` | Clinical Cockpit: `generateClinicalAssessment()` + `generateDocumentationString()` (Chief-Physician-Review, Phasen A/B/C, EPR-Copy) → 7 neue Tests H1–H7, **60 Tests total** | gemerged in Branch |
| v2.1    | `feature/clinical-cockpit-v2.0` | Production Readiness & CI: `.github/workflows/ci.yml` (npm test bei Push/PR), Predictive Analytics Modell B — kumulativer Energy-Gap (Threshold 150 kcal/kg) + Sodium-Zufuhr-Trigger (Δ > 5 mmol/kg/d in 48 h), beide als `assessment.predictiveHints` ausgegeben; jsdom-Smoke-Test → 5 neue Tests I1–I4 + J1, **65 Tests total** | gemerged in Branch |
| v3.0    | `feature/nicu-oberarzt-edition-v3.0` | **NICU Oberarzt-Edition.** Backend: `calculateEnergyGapIndex()` (kumulatives Defizit über ALLE History-Tage, Ampel ok/watch/high @150 kcal/kg) + `getSmartDefaults()` (Tages-basierte TFI/Protein/Lipid-Vorschläge aus getTargets) → K1–K5, L1–L5. Frontend: Teaching-Layer (Edu-Modal mit ESPGHAN-Begründung + Algorithmus, klickbare Werte), Energy-Gap-Index-Kachel (rendert über UI-Flow), Smart-Defaults-Box (1-Klick „übernehmen"), `history` an `calculate()` durchgereicht, `_kcal-min` pro Tag persistiert, Zero-Scroll Cockpit-Grid; alle Inline-Handler global exponiert → M1–M6. Datenschutz: `patient-id` (Bett/Station) wird NICHT in localStorage-`history` persistiert. **81 Tests total** | in Arbeit |

| v3.1    | `feature/enteral-advance-fluid-v3.1` | **Enteraler Aufbau, Flüssigkeits-Neukalibrierung, enterale Supplemente.** (1) `getTargets()` liefert `enteralTarget` (Vollnahrungs-Ziel nach Reifegrad: ELBW/VLBW 160–180, 32–36 SSW 150–170, Reifgeborene 130–160 ml/kg/d; ESPGHAN CoN 2022) und `enteralRamp` (tagesbasierter Aufbau-Korridor). Steigerungs-Hinweis als Modell-B-Hinweis mit Toleranz-Vorbehalt, Phasen none/trophic/advancing/full, PN-Beendigungs-Reminder bei Vollnahrung. (2) TFI-Hard-Limit 200 → 400 ml/kg/d, gestufte Signalisierung 180 (Hinweis) / 200 (Warnung) / 300 (Fat-Finger-Flag) — siehe Invariante 3a. (3) Liquigen (MCT 50 %, 4,5 kcal/ml) und Aptamil Eiweiß+ (82,1 g Protein/100 g) in Produktdatenbank, Rechenkette, Validierung, UI und EPR-Doku; Supplement-Volumen erhöht die Gesamtflüssigkeit nicht. → 20 neue Tests N1–N20, G1 verschärft. **101 Tests total** | in Arbeit |

| v3.2    | `feature/clinical-review-v3.2` | **Klinisches Review-Update.** (1) Enterales Zielvolumen an Protein-/Energie-Obergrenze der aktuellen Nahrung gekoppelt (`_enteralDensity()`, `enteralTarget.limitedBy`) — behebt den Selbstwiderspruch „steigere Volumen" vs. „Überernährung". (2) Nahrungspause (NPO) mit Grund: unterdrückt Steigerungs-Hinweis, Phase `paused`, neutrale Ampel, EPR-Doku. (3) Enteral-Ampel gegen Tages-Korridor statt Endziel, Toleranz = 2 Aufbauschritte. (4) `totalNaMmolKg` (PN + enteral) für Warnungen, Sodium-Trend, UI und Doku. → 17 neue Tests O1–O17. **118 Tests total** | in Arbeit |

| v3.3    | `feature/clinical-review-v3.2` | **Sprache und Quick-View.** UI-Texte auf „hausinterner Standard" umgestellt (vorher „Master-Protokoll"/„Master Logic"), „Chief Physician Review" → „Klinische Beurteilung", Zusatz „NICU Oberarzt-Edition" entfernt, Entwickler-Jargon aus dem Teaching-Modal genommen. Quick-View-Kachel skaliert jetzt container-basiert statt über Viewport-Breakpoints; `displayResults()` überschreibt die Größe nicht mehr. → 9 neue Tests P1–P9. **127 Tests total** | in Arbeit |

| v3.4    | `feature/clinical-review-v3.2` | **Flüssigkeitsziele, Gewichtsverlauf, Anreicherung.** (1) VLBW-Zweig war eine Kopie des ELBW-Zweigs, jetzt eigenständig; ELBW und VLBW 10 ml/kg/d unter ESPGHAN als dokumentierte Hausabweichung; Plateau ab Tag 5 statt Rampe gegen den Cap. (2) Protein-Klassengrenze auf `bw <= 1000` angeglichen (Invariante 2). (3) Gewichtsverlauf als Plausibilitätsprüfung. (4) Anreicherung wird als Zielkonzentration eingegeben (g Eiweiß/100 ml, FM85 in 0,5-%-Schritten), `results.preparation` liefert die Pulvermengen je Mahlzeit und pro Tag. → 23 neue Tests Q1–Q23, C1/A1/L1 mit Begründung angepasst. **150 Tests total** | in Arbeit |

### Git-Konfiguration im Clone
```
user.email = caspar@local
user.name  = Caspar
```

### Ordnerstruktur (aufgeräumt 16.08.2026)

```
Ernährung App/
├── calculator.js, products.js, index.html, fenton_data.js   Anwendung
├── tests/, package.json, vitest.config.js, .github/         Test und CI
├── AGENTS.md                                                diese Datei
├── NICU_NUTRITION_MASTER_PROTOCOL.md                        klinische Spezifikation
├── NEO_NUTRITION_MASTER_LOGIC.md                            Logik-Spezifikation
├── USER_MANUAL_V11.md, NEONUTRI_CHEATSHEET_V11.md           Nutzerdokumentation
├── STATIONSANLEITUNG.md                                     Kurzfassung für die Station
├── Clinical_Context.md, Expert_knowledge.md                 Arbeitskontext
├── AUDIT_LOG.md, SYSTEM_REVIEW.md, VALIDATION.md, KANBAN.md Projektdokumentation
├── OPTIMIZATION_STRATEGY.md
├── push_neonutri_v3.2.sh, aufraeumen.sh                     Hilfsskripte
└── _Archiv/
    ├── backups/      backup_* aus v1.0 bis v3.1
    ├── alte-specs/   überholte SPEC- und MASTER_LOGIC-Versionen
    └── export/       PDF-Export
```

`aufraeumen.sh` sortiert neu hinzugekommenen Altbestand ein und löscht nichts.
Rückgängig über `bash aufraeumen.sh --rueckgaengig`.

### Offener Punkt: `logic.js` im Repository

Im Repo liegt `logic.js` (124 Zeilen, Stand 05/2021) mit `SOP_LOGIC`: Dosierungen für
Ampicillin, Cefotaxim, Tobramycin, Vancomycin und Fluconazol-Hinweise. Der Inhalt
gehört zur **Antibiotika-App**, nicht zur Ernährungs-App, und wird hier von nichts
geladen (keine Referenz in `index.html`, den Tests oder `package.json`).

Vor dem Entfernen ist zu klären, ob die Antibiotika-App eine aktuelle Fassung besitzt.
Falls nicht, gehört die Datei zuerst dorthin. In der Git-Historie von Nutrition-SOP
bleibt sie ohnehin erhalten.

### Nicht in Git versioniert (bewusst)
Diese Dateien existieren nur lokal im Obsidian-Ordner und werden nicht gepusht (außer User wünscht es explizit):
- `NEO_NUTRITION_SPEC_V*.md`, `NEO_NUTRITION_MASTER_LOGIC_V*.md` (Versions-Specs)
- `KANBAN.md`, `AUDIT_LOG.md`, `SYSTEM_REVIEW.md`, `VALIDATION.md`
- `Expert_knowledge.md`, `Clinical_Context.md`, `USER_MANUAL_V11.md`
- `_Archiv/` inkl. `backup_*_v*.*` (lokale Datei-Backups und Altbestand)
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
