# CLAUDE.md

## Was das ist

NeoNutri, ein Rechner für die Ernährung Früh- und Neugeborener auf einer
neonatologischen Intensivstation (Perinatalzentrum Level 1). Die Anwendung nimmt
Verordnungsdaten auf und berechnet daraus Flüssigkeit, Energie, Protein, Lipide,
Elektrolyte sowie Calcium und Phosphat, vergleicht sie mit Zielbereichen nach
ESPGHAN und hausinternem Standard und meldet Grenzwertüberschreitungen.

**Das ist eine klinische Anwendung. Fehler in der Rechenlogik können zu
Patientengefährdung führen.** Entsprechend gelten harte Regeln, siehe unten.

Zielgruppe sind Ärztinnen und Ärzte der Station. Der Betreiber ist selbst
Neonatologe; fachliche Festlegungen trifft er, nicht die Codebasis.

## Tech-Stack

Reines Vanilla-JavaScript ohne Build-Schritt. `index.html` wird direkt im
Browser geöffnet beziehungsweise über GitHub Pages ausgeliefert.

- Laufzeit im Browser, Abhängigkeiten per CDN: Decimal.js, Tailwind (Play-CDN),
  Tippy.js, jsPDF
- **Decimal.js ist in allen klinischen Rechenpfaden Pflicht.** Kein `Number`,
  kein `parseFloat` für Dosierungen. Gleitkommafehler sind hier nicht akzeptabel.
- Tests: Vitest unter Node, `environment: 'node'`, jsdom für die Frontend-Prüfungen
- Linter: ESLint 9, Flat Config
- Kein Framework, kein Bundler, kein TypeScript. Das ist Absicht: die Datei muss
  sich notfalls auf einem Stationsrechner ohne Toolchain öffnen lassen.

## Ordnerstruktur

```
calculator.js                 Safety Core Engine. Validierung, Zielwerte,
                              Berechnung, Warnungen. Hier liegt die Logik.
products.js                   Produktdatenbank: Basislösungen, Nahrungen,
                              Supplemente, Elektrolytkonzentrate
fenton_data.js                Fenton-2013-Perzentilen, GrowthCalculator
index.html                    Gesamte Oberfläche inklusive Inline-JavaScript
tests/calculator.test.js      Klinische Test-Suite, Sektionen A bis R
tests/setup.js                Test-Setup, stellt Decimal global bereit
AGENTS.md                     Verbindliche klinische Regeln und Begründungen
USER_MANUAL_V11.md            Ausführliche Nutzerdokumentation
STATIONSANLEITUNG.md          Kurzfassung für den Stationsalltag
NEONUTRI_CHEATSHEET_V11.md    Druckvorlage A4
logic.js                      Fremdkörper, siehe unten
```

## Befehle

```bash
npm ci          # Abhängigkeiten installieren
npm test        # Vitest, muss 152/152 grün sein
npm run lint    # ESLint, muss leer durchlaufen
npm run check   # beides nacheinander
```

`npm run check` ist der Durchlauf, der vor jedem Commit grün sein muss.

## Vor dem Ändern von calculator.js: AGENTS.md lesen

`AGENTS.md` ist die verbindliche Grundlage und steht über dieser Datei. Sie
enthält die drei sakrosankten Invarianten, alle klinischen Schwellenwerte mit
Quelle und Datum sowie die dokumentierten Abweichungen von Leitlinien samt
Begründung. Ohne diesen Kontext sind Änderungen an der Rechenlogik nicht
beurteilbar.

Die drei Invarianten in einem Satz, Details dort:

1. **Die Test-Suite muss zu 100 Prozent grün sein.** Die Anzahl darf wachsen,
   nie schrumpfen. Tests werden nicht angepasst, damit Produktivcode passt.
2. **Die ELBW-Klassengrenze liegt inklusiv bei 1000 g** (`bw <= 1000`), für
   Flüssigkeit und Protein.
3. **Der Validierungs-Layer am Anfang von `calculate()` bleibt bestehen.**

## Was nicht angefasst wird

- **Klinische Schwellenwerte ohne Rückfrage.** Jeder Zielbereich und jedes
  Limit in `calculator.js` ist in `AGENTS.md` mit Quelle und Freigabedatum
  dokumentiert, mehrere davon sind bewusste Hausabweichungen von ESPGHAN. Was
  wie ein Fehler aussieht, ist oft eine begründete Entscheidung. Abweichungen
  vorschlagen, nicht eigenmächtig umsetzen.
- **Der Kommentar `// Master-Protokoll: ELBW-Klassengrenze inklusiv bei 1000g`.**
  Teil von Invariante 2, bleibt wörtlich stehen.
- **Der `try-catch` um `calculator.calculate()` in `index.html`.** Ohne ihn
  friert die Oberfläche bei ungültigen Eingaben ein.
- **Die Toleranz-Vorbehalte in den Steigerungs-Hinweisen.** Formulierungen wie
  „nur bei guter Toleranz (weiches Abdomen, unauffällige Reste, kein
  NEC-Verdacht)" sind klinisch erforderlich, nicht Beiwerk. Test N7 prüft sie.
- **`logic.js`.** Enthält Antibiotika-Dosierungen aus einer anderen Anwendung
  und wird hier von nichts geladen. Offener Punkt: ungeklärt, ob die
  Antibiotika-App eine aktuellere Fassung besitzt. Nicht löschen, bis das
  geklärt ist. Vom Linter ausgenommen.
- **Patientendaten in `localStorage`.** Die 7-Tage-Historie darf keine
  identifizierenden Felder enthalten. Test M6 prüft das.

## Konventionen

- **Sprache:** Kommentare, Commit-Nachrichten und Oberflächentexte auf Deutsch.
  Bezeichner im Code auf Englisch, wie im Bestand.
- **Keine gehobenen Eigenbezeichnungen im Oberflächentext.** „Hausinterner
  Standard" statt „Master-Protokoll", „Klinische Beurteilung" statt „Chief
  Physician Review". Kein Entwickler-Jargon wie Funktionsnamen in Texten, die
  Ärztinnen und Ärzte lesen. Tests P1 bis P3 prüfen das.
- **Jeder neue Schwellenwert braucht eine Quelle im Kommentar.** Leitlinie,
  Jahr, und bei Abweichung die Begründung samt Freigabedatum.
- **Neue klinische Logik braucht einen Test.** Neue Sektion am Ende von
  `tests/calculator.test.js`, Buchstabe fortlaufend, derzeit bis R.
- **Hinweise sind Hinweise.** Diagnostische Ausgaben nach dem Muster „Modell B"
  geben nie ein Stop-Signal und sperren keine Dosis. Harte Sperren gibt es nur
  im Validierungs-Layer und bei den CRITICAL-Warnungen.
- **Warnungen müssen handlungsleitend sein.** Nicht nur melden, was abweicht,
  sondern was zu prüfen oder zu ändern ist.
- Vier Leerzeichen Einrückung, einfache Anführungszeichen, Semikolons.

## Arbeitsweise, die sich bewährt hat

1. Vor der Änderung `npm run check` laufen lassen. Ist der Bestand rot, zuerst
   den Bestand reparieren.
2. Bei klinischen Fragen zuerst gegen die Leitlinien prüfen, dann implementieren.
   Die Zielwerte in `AGENTS.md` sind mit Quelle hinterlegt und nachvollziehbar.
3. Nach der Änderung `npm run check` erneut. Bei rotem Test ist standardmäßig
   der Produktivcode falsch, nicht der Test.
4. Änderungen an der Oberfläche nicht nur im Quelltext prüfen. Die CDN-Skripte
   lassen sich lokal nachbauen und die Seite mit jsdom rendern; `innerText`
   muss dabei vor dem Parsen nachgerüstet werden, jsdom kennt es nicht.
   Hintergrund: ein Eingabefeld lag einmal unbemerkt in einem zugeklappten
   Bereich und war dadurch unerreichbar, obwohl der Quelltext korrekt aussah.
5. `AGENTS.md` nachziehen: Testzahl, Changelog-Zeile, neue Schwellenwerte.

## Umgebungsvariablen und Geheimnisse

Das Projekt braucht keine. Es gibt keine Datenbank, keine API, keinen
Authentifizierungsdienst; alles läuft im Browser und die Historie liegt im
`localStorage` des jeweiligen Geräts.

**In der Umgebungskonfiguration dürfen deshalb keine Variablen gesetzt werden.**
Sie sind für jeden sichtbar, der die Umgebung bearbeiten kann. Insbesondere
gehören dort nie hinein: GitHub-Token, Zugangsdaten zu Klinikdiensten, und
unter keinen Umständen Patientendaten oder Kennungen aus dem Krankenhaussystem.

Falls später echte Testdaten gebraucht werden: synthetische Werte verwenden,
keine Datensätze realer Patienten, auch nicht pseudonymisiert.

## Deployment

`main` wird über GitHub Pages ausgeliefert:
https://casparler.github.io/Nutrition-SOP/

Nie direkt auf `main` committen, immer über einen Feature-Branch und Pull
Request. Die CI führt `npm run check` bei jedem Push und PR aus.
