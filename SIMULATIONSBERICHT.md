# NeoNutri — Simulationsbericht (01.10.2026)

Stand: Branch `claude/zen-babbage-vjgke2`. Der Bericht entstand bei 152/152 grünen Tests.

**Nachtrag (v3.5):** Behoben und mit Tests S1–S8 abgesichert (jetzt 162/162 grün):
**A1, A2, A3** (ohne den Ca:P-/P:AA-Widerspruch, der an A4 hängt), **B3, B4, B5**.
Offen sind alle Punkte, die eine klinische Entscheidung brauchen (A4, B1, B2, B6, B7, C, D).

**Nachtrag 02.10.2026:** Nach den Antworten des Neonatologen zusätzlich umgesetzt: A4 (Ca:P entfällt), B1, B2 (bleibt CRITICAL), B6 (bleibt), C1 (FM85 nur < 1800 g), C3 (Kalium), C6 (nur mit realem Gewicht), SGA, Hypoglykämie CRITICAL. Der aktuelle Stand aller Regeln steht in `REGELWERK.md`.

## Vorgehen

Ich habe den Rechner (`calculator.js`, `products.js`, `fenton_data.js`) mit virtuellen Kindern
durchgespielt, so wie die App im Browser aufgebaut ist (gleiche Skripte, gleiche Eingabefelder).
Je Kind wurden typische Tagesverordnungen eingegeben und die Ausgabe gelesen: Warnungen,
Erinnerungen, Ampeln, Fazit, Zubereitung.

| Kind | Eckdaten | Schwerpunkt |
|---|---|---|
| A | 25 SSW, 620 g, beatmet, ZVK, Tag 1–42 | kompletter ELBW-Verlauf von PN bis Vollnahrung mit FM85 |
| B / B2 | 28 SSW, **1000 g** bzw. 999 g, Tag 3 | Klassengrenze |
| D | 34 SSW, 2100 g, Tag 1 | Glukose vergessen |
| E | 39 SSW, 3400 g, Tag 1 / 5, PN mit Protein 4,2 | Reifgeborenes |
| F | 38 SSW, 1450 g (SGA), Tag 5 | Wachstumsrestriktion |
| G | 25 SSW, 700 g, Tag 1–3 | polyure Phase, Hyperglykämie, Kalium |
| H | 34 SSW, 2100 g, Formel + FM85 | Zubereitung |
| I / J | 26–28 SSW, Tag 10/11 und Tag 1–84 | Dosiergewicht, Perzentilen |
| K / L / M | 27 SSW, NEC-Verdacht, TG 300, Historie | Nahrungspause, Lipide, Prädiktion |

Alle Fälle sind mit den genannten Eingaben in der App nachstellbar.

**Einordnung:** Das sind Befunde aus der *Rechenlogik*. Ob eine Abweichung klinisch gewollt ist
(Hausstandard), entscheidet der Neonatologe. Ich unterscheide deshalb zwischen
**Fehler** (Code tut nicht, was er soll oder was dokumentiert ist) und **Frage** (Design-Entscheidung).

---

## A. Fehler mit Sicherheitsrelevanz

### A1. Fehlende Glukose bei laufender PN wird nicht bemerkt — Fehler, hoch
Kind D (34 SSW, Tag 1, TFI 60, nur Protein 1,5 und Lipide 1, **GIR leer**):
Die App zeigt GIR 0, `isSafe = true`, als Fazit bei einem reifen Kind sogar
„Ernährungsplan im ESPGHAN-Zielbereich – keine Korrekturen erforderlich“.
Die einzige Warnung ist irreführend („Lipid-Anteil 100 % an NPC“).

Ursache: Die Hypoglykämie-Warnung (`calculator.js` ~Z. 1441) verlangt `effectiveGIR > 0`.
Gerade der gefährlichste Fall, GIR = 0 bei laufendem PN-Volumen, fällt heraus.
Vorschlag: Warnung, wenn PN-Volumen > 0 und Gesamt-GIR (PN + enteral) < Minimum, inkl. 0.

### A2. Exakt 1000 g: IWL-/Natrium-Block gilt nicht — Fehler, hoch (Invariante 2)
Kind B (1000 g, Tag 3, TFI 90, Na 6 mmol/kg/d) bekommt **keine** Hypernatriämie-Hinweise,
Kind B2 (999 g, gleiche Werte) bekommt beide.
Ursache: `calculator.js` ~Z. 1615 `birthWeightG.lt(1000)`. Alle anderen Stellen sind
inklusiv (`bw <= 1000`). Das ist dieselbe Art Fehler, die in v3.4 für die Protein-Ziele behoben
wurde, hier aber übersehen. Vorschlag: `lte(1000)` und ein Test C1-Verwandter („1000 g bekommt IWL-Hinweis“).

### A3. Das Fazit verschweigt kritische Befunde — Fehler, hoch
- Kind G2: GIR 12,4 → `CRITICAL`, Fazit: „Ernährungsplan im ESPGHAN-Zielbereich – keine Korrekturen erforderlich.“
- Kind L: Triglyzeride 300 → `CRITICAL: Lipidzufuhr reduzieren`, Fazit dagegen:
  „Energiezufuhr um 21 kcal/kg/d steigern“ — also gegenläufig.
- Fehlen im Fazit: GIR-Maximum, Osmolarität, Glukosekonzentration, Triglyzeride, Kristallgefahr, SID.
- Außerdem widersprechen sich zwei Fazit-Zeilen beim selben Kind (A, Tag 1–7):
  „Ca:P optimieren – **Phosphat reduzieren** oder Calcium erhöhen“ und direkt darunter
  „**Phosphat erhöhen** (P:AA)“.

Vorschlag: Das Fazit beginnt immer mit den `CRITICAL`-Einträgen; „keine Korrekturen
erforderlich“ nur, wenn `warnings` leer ist.

### A4. Ca:P-Bewertung bei jeder Hauslösung und jeder unfortifizierten Milch rot — Fehler (sehr wahrscheinlich), hoch
(Werte der Tabelle: 29 SSW, 1200 g, Tag 5, jeweils mit 40 ml/kg EBM enteral.)
Der Rechner bildet das **molare** Verhältnis, vergleicht es aber mit dem Bereich **1,5–2,0**,
der dem **Massenverhältnis** (mg:mg) entspricht. Umrechnung: Masse = molar × 1,294.

| Eingabe | molar (App) | Masse | App-Bewertung |
|---|---|---|---|
| Basislösung FG | 0,95 | 1,23 | Warnung |
| Basis 100 | 0,95 | 1,23 | Warnung |
| Basis 120 / 150 / peripher | 0,91 / 0,87 / 0,84 | 1,18 / 1,13 / 1,09 | Warnung |
| EBM + FM85 4 % (Kind A, Tag 14) | 1,21 | 1,57 | Warnung (wäre im Bereich) |
| reine EBM | 0,68 | 0,88 | Warnung (zu Recht niedrig) |

Folge: **Jede** Standard-PN und jedes Kind unter fortifizierter Milch trägt dauerhaft eine gelbe
Ca:P-Warnung. Das ist Alarm-Müdigkeit. Das Fazit empfiehlt dann sogar, Calcium zu erhöhen,
was das Ausfällungsrisiko vergrößert.
Zusätzlich: Die P:AA-Warnung (< 1,0 mmol/g) schlägt bei allen Hauslösungen an (0,50–0,77).
**Bitte klinisch prüfen**, welche Einheit der Hausstandard meint und ob die Hauslösungen
absichtlich darunter liegen. Dazu: Bei gewählter Lösung werden die Felder Calcium/Phosphat
ignoriert, die Warnung nennt aber „z. B. Glycophos“ — man kann es gar nicht zusetzen.

---

## B. Fehler ohne akute Gefahr, aber falsche Anzeige

### B1. Enterales Zielvolumen an Tag 1–3 sinnlos klein — Fehler, mittel
Die v3.2-Kopplung nutzt die **Tages**-Energieobergrenze (Tag 1: 60, Tag 2: 80 kcal/kg).
Ergebnis: Ziel „**80–80** ml/kg/d“ an Tag 1, „**110–110**“ an Tag 2 (Kind A), dazu die Erinnerung
„höheres Volumen führt zu Überernährung“ bei einem Kind mit 10 ml/kg EBM, das von PN lebt.
Der Energiedeckel sollte nur bei Vollnahrung ohne PN greifen (oder erst ab Tag 4, wo 135 gilt).

### B2. Beatmungs-Cap macht das Haus-Ziel ELBW ab Tag 5 wertlos — Fehler/Frage, mittel
Haus-Ziel ELBW Plateau 150–170. Bei invasiver Beatmung greift der Cap 140 → Ziel „**140–140**“ (die
Entartung, die v3.4 für die Rampe behoben hat, tritt hier wieder auf). Bei TFI 150 meldet die App
**CRITICAL** und `isSafe = false` (Kind A, Tag 5). Der Cap ist in `AGENTS.md` nicht dokumentiert.
Frage: Ist ein invasiv beatmetes ELBW mit 150 wirklich „kritisch“, oder genügt ein Hinweis?

### B3. Gewichtsperzentile nutzt das Gestationsalter bei Geburt — Fehler, mittel
Kind J (26 SSW): Tag 28, 1250 g → App „**> 97.**“, korrekt nach korrigiertem Alter (30+0): **10.–50.**
Tag 84, 3100 g → „> 97.“ statt 10.–50. Ursache: `getPercentile('WEIGHT', ssw, …)` statt
`ssw + Tage/7`. Die Z-Scores für Länge und Kopf nutzen das korrigierte Alter, sind also inkonsistent
zur Gewichtsperzentile. Außerdem ist in beiden `'male'` fest eingetragen; es gibt kein Geschlechtsfeld.
Die Perzentile wird nur angezeigt (`res-weight-percentile`), steuert aber nichts.

### B4. Zubereitung zeigt FM85 bei Formelnahrung — Fehler, mittel
Kind H (Aptamil Pre, FM85-Feld vom Vortag noch auf 4 %): Die Rechnung ignoriert FM85
korrekt (Eiweiß 1,3 g/100 ml), die **Zubereitungs-Kachel nennt aber „12,6 g FM85 pro Tag,
1,58 g pro Mahlzeit“**. Das wird am Bett abgewogen. FM85-Felder sollten nur bei EBM gelten
(oder beim Produktwechsel auf 0 gesetzt werden).

### B5. Warntext bei FM85-getriebener Protein-Überschreitung — Fehler, niedrig
Kind A, Tag 28: „Ohne Überschreitung wären höchstens **0 g/100 ml Zusatz** möglich (aktuell 0).“
Die Meldung bezieht sich auf den Eiweißzusatz, der Treiber ist aber FM85 4 %. Hilfreicher:
„FM85 auf höchstens x % senken oder Volumen auf höchstens y ml/kg/d“.

### B6. Vitamin D / Proprems-Erinnerung hängt am Volumen je Mahlzeit — Fehler, niedrig
Auslöser ist `singlePortion >= 3` ml. Ein 3,4-kg-Reifgeborenes mit 40 ml/kg an **Tag 1** löst
„Vitamin D und Proprems ab jetzt indiziert“ aus, ein 620-g-ELBW mit 40 ml/kg erst deutlich später.
Besser: an enterales Volumen in ml/kg und Reifegrad koppeln.

### B7. Dosiergewicht springt an Tag 11 — Frage, niedrig
`postnatalAge <= 10` → max(Geburts-, aktuelles Gewicht), danach nur aktuelles. Kind I
(BW 1000 g, aktuell 880 g): Tag 10 → 1000 g, Tag 11 → 880 g, Tagesvolumen **150 → 132 ml (−12 %)**
über Nacht, ohne Hinweis. Idee: Hinweis „Dosiergewicht wechselt“ oder Wechsel erst bei
Wiedererreichen des Geburtsgewichts.

---

## C. Klinische Fragen zu Design und Hausstandard

### C1. Reifgeborene und späte Frühgeborene werden wie Frühgeborene beraten — mittel
Kind E (39 SSW, 3400 g, gesund, EBM 150 ml/kg): „FM85 Start-Kriterium erfüllt“,
„FM85 Titrationsplan: Steigerung auf 4 % empfohlen“, „Proteinzufuhr um 0,8 g/kg steigern“,
„Energie unter Ziel“ (106 statt 110 kcal), Ca:P rot. Gleiches bei 36 SSW / 2500 g.
Fortifizierung gehört bei gestillten Reifgeborenen nicht zur Standardempfehlung. Ein
Reifegrad-Filter für FM85-Empfehlungen und für die Energie-/Protein-Ziele (Reife: Energie ca. 100–110)
fehlt.

### C2. Protein-Ziel nicht nach Lebenstag gestaffelt — mittel
Energie-, Lipid- und Flüssigkeitsziele haben Tagesstufen, das Protein-Ziel nicht.
ELBW Tag 1 und 2 ist immer „3,5–4,0“ → bei üblicher Verordnung (1,5–2,5 g/kg) **rot**.
Die Smart-Defaults schlagen an Tag 1 sogar **3,8 g/kg** vor (Kind A). Rechnerisch geht das
nicht auf: Bei Protein 3,5 braucht NPC/P ≥ 20 etwa 84 kcal, die Tagesobergrenze Tag 1 ist 60 kcal.
Der Vorschlag der App löst darum die eigenen Warnungen „NPC/P 11,5“ und „P:AA 0,26“ aus.

### C3. Kalium und Natrium am Anfang ohne Regel — mittel
Kind G3: Kalium 4 mmol/kg/d an Tag 1 bei 700 g, und **K 3, 6 und 9 mmol/kg/d an Tag 2** erzeugen
keine einzige Warnung (`isSafe = true`). Es gibt nur die Tippfehler-Grenze bei 10.
Nicht-oligurische Hyperkaliämie ist in den ersten 48–72 Lebensstunden ELBW-typisch.
Frage: Obergrenze (z. B. 3 mmol/kg/d) und eine „kaliumfreie Phase Tag 1–2“-Regel?
Natrium analog: Es gibt nur die Warnung > 5 mmol/kg/d (ELBW, Tag 1–7), keine Tag-1/2-Regel.

### C4. Der Hausstandard FM85 4 % bei 160 ml/kg ist „kritisch“ — Frage, mittel
EBM + FM85 4 % × 160 ml/kg = 4,8 g Protein/kg/d (Kind A, Tag 28 und 42) →
`CRITICAL`, `isSafe = false`. Das folgt aus der Protein-Obergrenze 4,5 (v3.2) und ist
rechnerisch richtig, bedeutet aber: Der Standardverlauf eines ELBW zeigt ab Tag ~21 dauerhaft
rot. Vermutlich ist FM85 4 % mit 160 ml/kg nicht gleichzeitig gewollt. Eine Hausentscheidung
(z. B. 3,5 % oder 150 ml/kg) wäre ehrlicher als eine Dauer-Warnung.

### C5. Protein-Obergrenze 4,5 gilt für jedes Kind — niedrig
Reifgeborenes mit PN-Protein 4,2 g/kg (Kind E3): Ziel 2,5–3,0, Ampel rot, aber **keine Warnung**,
weil die harte Grenze für alle 4,5 beträgt. Eine reifegradabhängige Obergrenze wäre denkbar.

### C6. Leere Pflichtfelder werden still ersetzt — niedrig bis mittel
Bleibt Geburtsgewicht leer, rechnet die App mit **1000 g (ELBW)** und SSW **28**, ohne Hinweis.
Bei leerem SSW-/Gewichtsfeld ist ein Hinweis oder Abbruch sicherer als stilles Raten.

---

## D. Fehlende Funktionen (Lücken, keine Fehler)

Nach dem Durchspielen fehlen für den Stationsalltag am meisten:

1. **Geschlecht** (Fenton, Z-Scores).
2. **SGA/IUGR:** Kind F (38 SSW, 1450 g, Perzentile < 1) wird als **VLBW** eingeordnet
   (Gewicht schlägt Reife), bekommt Ziel 160–180 ml/kg und Standardwarnungen. Es gibt keinen
   Hinweis auf erhöhtes Risiko für Hypoglykämie, Realimentations-/Hypophosphatämie-Syndrom
   (PIFS-Bezug in der P:AA-Warnung existiert, aber nicht an die Perzentile gekoppelt).
3. **Phototherapie, Fieber, Inkubatorfeuchte:** erhöhen den Wasserbedarf; die Haus-Ziele (−10 ml
   wegen Feuchte) kennen keinen Schalter dafür.
4. **Labor:** Serum-Na, K, Glukose, Bilirubin (direkt), Phosphat; es gibt nur Harnstoff und TG.
   Dadurch können Hyperglykämie (Insulin/GIR runter), Cholestase (Lipide reduzieren) und
   Hyponatriämie nicht abgebildet werden.
5. **Sondierungsmodus:** nur 6×/8×/12×; kontinuierlich (Pumpe) oder 24× fehlt, wichtig bei
   ELBW mit Reflux oder bei Nahrungsintoleranz. Backend lässt bis 24 zu, das Feld nicht.
6. **Gewichtsverlauf:** nur gegen Geburtsgewicht, nicht als Tagesdifferenz ≥ 3 Tage (Stagnation)
   vor Tag 28.
7. Das Fazit (Top-3-Optimierungen) berücksichtigt weder Kalium noch Stagnation noch Perzentile.

---

## Empfohlene Reihenfolge

1. **A1** (GIR = 0), **A2** (1000 g, ein einzelnes Zeichen), **A3** (Fazit): klein, klar, sicherheitsrelevant.
2. **A4** zuerst klinisch klären (Massen- oder Molverhältnis), dann beheben. Betrifft bestehende Tests.
3. **B1, B3, B4**: Anzeige-Fehler, die Vertrauen kosten.
4. **C1, C2, C3** als Hausentscheidung: Reifegrad-Filter, Protein-Staffelung, Kalium-Regel.
5. Funktionslücken (D) nach Priorität der Station.

Hinweis zu den Regeln im Projekt: A2 berührt Invariante 2 und stärkt sie (gleiche Richtung wie v3.4).
A4 würde Testwerte ändern (Ca:P) und bräuchte laut `AGENTS.md` eine klinische Begründung.
