# NeoNutri: Stationsanleitung

**Für ärztliche Mitarbeiterinnen und Mitarbeiter der neonatologischen Intensivstation**
Stand: v3.2, August 2026. Ausführliche Fassung: `USER_MANUAL_V11.md`.

---

## 1. Wozu das Werkzeug dient, und wozu nicht

NeoNutri berechnet aus den eingegebenen Verordnungsdaten die tatsächliche Zufuhr an
Flüssigkeit, Energie, Protein, Lipiden, Elektrolyten sowie Calcium und Phosphat, und
vergleicht sie mit den Zielbereichen nach ESPGHAN und Hausstandard. Es rechnet nach,
was verordnet wurde. Es verordnet nicht.

Alle Ausgaben sind Entscheidungsunterstützung. Die Indikationsstellung, die Bewertung
der klinischen Situation und die Verordnung bleiben ärztliche Aufgabe. Bei Abweichung
zwischen Rechner und klinischem Eindruck gilt der klinische Eindruck; in diesem Fall
sollte die Eingabe auf Fehler geprüft werden, weil eine unplausible Ausgabe häufiger
auf einem Zahlendreher beruht als auf einem Rechenfehler.

Das Werkzeug ist kein Medizinprodukt und nicht zertifiziert. Es ersetzt weder die
Ernährungsvisite noch die Rücksprache mit dem zuständigen Oberarzt.

---

## 2. Eingabe in sechs Schritten

Die Reihenfolge entspricht dem Aufbau der Eingabemaske. Für einen vollständigen Plan
werden etwa fünf Minuten benötigt.

**Schritt 1: Patientendaten.** Geburtsgewicht, aktuelles Gewicht, Gewicht des Vortages,
Lebenstag, Gestationsalter bei Geburt. Das Vortagsgewicht wird für die Wachstumsrate
benötigt; fehlt es, entfällt diese Anzeige.

**Schritt 2: Beatmung.** Feld für invasive Beatmung. Ist es gesetzt, begrenzt der
Rechner die Gesamtflüssigkeit auf 140 ml/kg/d und deckelt entsprechend auch das
enterale Zielvolumen.

**Schritt 3: Gesamtflüssigkeit.** Gesamtflüssigkeitszufuhr in ml/kg/d.

**Schritt 4: Enterale Ernährung.** Volumen in ml/kg/d, Nahrungsart, bei Muttermilch die
FM85-Stufe, Anzahl der Mahlzeiten. Enterale Supplemente (Liquigen, Aptamil Eiweiß+)
stehen im aufklappbaren Bereich darunter. Besteht eine Nahrungspause, wird das
entsprechende Feld gesetzt und der Grund gewählt.

**Schritt 5: Parenterale Ernährung.** Entweder eine Basislösung auswählen, dann werden
Aminosäuren, Glukose und Elektrolyte automatisch skaliert, oder die Werte einzeln
eingeben. Anschließend Lipiddosis und Lipidpräparat. Trägervolumina für Perfusoren und
Mikronährstoffe nicht vergessen, sie gehen vom parenteralen Restvolumen ab.

**Schritt 6: Laborwerte, sofern vorhanden.** Harnstoff und Triglyzeride schalten
zusätzliche Hinweise frei, etwa zur Eiweißsupplementierung oder zur Lipidtoleranz.

---

## 3. Was zuerst gelesen wird

Vier Anzeigen genügen für die Visite. Alles Weitere ist für die gezielte Optimierung
gedacht und kann eingeklappt bleiben.

| Anzeige | Zielbereich | Bedeutung bei Abweichung |
|---|---|---|
| Sicherheitsstatus | grün | Rot bedeutet, dass mindestens ein harter Grenzwert überschritten ist. Vor dem Verlassen der Maske klären. |
| Gesamtenergie | Tag 1: 45–60, Tag 2: 60–80, Tag 3: 80–100, ab Tag 4: 110–135 kcal/kg/d | Anhaltendes Defizit führt zu postnataler Wachstumsrestriktion. |
| Wachstumsrate | 15–20 g/kg/d | Unter 15 g/kg/d Fortifizierung und Energiezufuhr prüfen. Über 25 g/kg/d an Ödeme denken. |
| Enteraler Aufbau | Kachel im enteralen Abschnitt | Zeigt aktuelles Volumen, Zielvolumen und den Korridor für den heutigen Lebenstag. |

Die Farbe der Enteral-Kachel bezieht sich auf den Korridor des aktuellen Lebenstages,
nicht auf das Endziel. Ein Kind an Tag 2 ohne enterale Zufuhr ist deshalb gelb und
nicht rot.

---

## 4. Häufige Meldungen und was zu tun ist

### Rote Meldungen, vor Verlassen der Maske zu klären

| Meldung | Ursache | Vorgehen |
|---|---|---|
| Glukoseinfusionsrate über 12 mg/kg/min | Zu hohe Glukosezufuhr | Rate senken, Blutzucker kontrollieren, bei persistierender Hyperglykämie Insulin erwägen |
| Osmolarität über 900 mosmol/l bei periphervenösem Zugang | Lösung zu konzentriert | Zentralen Zugang nutzen oder Lösung verdünnen |
| Glukosekonzentration über 12,5 Prozent peripher | Analog | Konzentration senken |
| Lipide über 4,0 g/kg/d | Überdosierung | Auf 3,0 bis 3,5 g/kg/d reduzieren |
| Triglyzeride über 250 mg/dl | Lipidintoleranz | Lipidzufuhr reduzieren oder pausieren |
| Ausfällungsrisiko Calcium und Phosphat | Löslichkeitsprodukt überschritten | Lösung nicht infundieren, Volumen erhöhen oder Calcium beziehungsweise Phosphat reduzieren, neu ansetzen lassen |

### Gelbe Hinweise, im Verlauf zu berücksichtigen

| Hinweis | Bedeutung | Vorgehen |
|---|---|---|
| Protein unter Zielbereich | Unterversorgung | Aminosäuren steigern, bei Vollnahrung Fortifizierung prüfen |
| Harnstoff unter 3 mmol/l bei enteral über 100 ml/kg/d | Eiweißmangel trotz Vollernährung | Aptamil Eiweiß+ erwägen, Feld im enteralen Abschnitt |
| Enteral unter dem Aufbau-Korridor | Aufbau hinter dem Zeitplan | Steigerung nur bei guter Toleranz. Bei bewusster Pause das Feld Nahrungspause setzen |
| Gesamtflüssigkeit über 180 ml/kg/d | Oberhalb des üblichen Korridors | Bei polyurer Phase adäquat, sonst Volumenbedarf prüfen |
| Gesamtflüssigkeit über 200 ml/kg/d | Sehr hoch | Nur bei polyurer Phase oder hohen Verlusten plausibel. Bilanz, Serumnatrium und Gewichtsverlauf engmaschig kontrollieren |
| Calcium oder Phosphat unter Ziel bei enteraler Ernährung | Risiko für Osteopenie | Zufuhr und Fortifizierung prüfen |

---

## 5. Enteraler Aufbau

Der Rechner führt ein Zielvolumen für Vollnahrung und einen Korridor für den jeweiligen
Lebenstag. Liegt das aktuelle Volumen mehr als 10 ml/kg/d unter dem Korridor, erscheint
ein Steigerungsvorschlag. Dieser ist ausdrücklich ein Hinweis und keine Vorgabe; er
setzt weiches Abdomen, unauffällige Reste, fehlenden Verdacht auf nekrotisierende
Enterokolitis und eine stabile Kreislaufsituation voraus.

Das Zielvolumen richtet sich nach Reifegrad und wird zusätzlich durch die
Nährstoffdichte der eingestellten Nahrung begrenzt. Der Grund: bei hoher Anreicherung
ist die Proteinobergrenze von 4,5 g/kg/d vor dem Volumenziel erreicht. Für
Muttermilch bei einem sehr kleinen Frühgeborenen ergibt sich daraus:

| FM85 | Zielvolumen | begrenzt durch |
|---|---|---|
| 0 bis 1 Prozent | 160–180 ml/kg/d | nicht begrenzt |
| 2 Prozent | 150–170 ml/kg/d | Energieziel |
| 3 Prozent | 145–165 ml/kg/d | Energieziel |
| 4 Prozent | 130–150 ml/kg/d | Proteinobergrenze |

Bei invasiver Beatmung gilt zusätzlich die Grenze von 140 ml/kg/d. Zeigt die Kachel eine
Begrenzung an, nennt sie den maßgeblichen Grund.

**Nahrungspause.** Ist das Feld gesetzt, entfallen Steigerungsvorschlag und Ampel, die
Kachel wechselt auf gelb und der gewählte Grund erscheint in der Verlaufsdokumentation.
Das Feld sollte bei jeder bewusst pausierten Ernährung gesetzt werden, damit der
Rechner nicht gegen die klinische Entscheidung argumentiert.

---

## 6. Enterale Supplemente

| Präparat | Eingabe | Zufuhr |
|---|---|---|
| Liquigen, mittelkettige Triglyzeride 50 Prozent | ml/kg/d | 4,5 kcal und 0,5 g Fett je ml |
| Aptamil Eiweiß+ | g Pulver/kg/d | 0,82 g Protein und 3,4 kcal je g, zusätzlich Natrium, Calcium und Phosphat |

Beide werden der Nahrung zugemischt. Ihr Volumen wird deshalb nicht zusätzlich auf die
Gesamtflüssigkeit angerechnet. Wird ein Supplement bei uns getrennt verabreicht, muss
das Volumen manuell in der Gesamtflüssigkeit berücksichtigt werden.

Liquigen liefert ausschließlich mittelkettige Triglyzeride und damit keine essenziellen
Fettsäuren. Es ersetzt keine ausgewogene Fettzufuhr, sondern dient der
Energieanreicherung bei limitiertem Volumen.

---

## 7. Grenzen des Werkzeugs

Folgende Punkte werden nicht abgebildet und müssen eigenständig bedacht werden:

- Renale, hepatische und kardiale Komorbiditäten verändern Ziel- und Grenzwerte, ohne
  dass der Rechner dies berücksichtigt.
- Medikamentenbedingte Natrium- und Flüssigkeitslasten werden nur erfasst, soweit sie
  als Trägervolumen oder als verstecktes Natrium eingegeben wurden.
- Serumwerte werden nicht abgebildet. Die Anzeige zum Natrium bezieht sich auf die
  Zufuhr, nicht auf den Serumspiegel.
- Die Fenton-Perzentilen beziehen sich auf eine Referenzpopulation und ersetzen keine
  Beurteilung des Wachstumsverlaufs.
- Der Aufbau-Korridor ist eine Orientierung aus Leitlinien und Studienlage, kein
  Hausstandard. Bei abweichender lokaler Praxis gilt die lokale Praxis.

---

## 8. Bei Unklarheiten

Bei fachlichen Fragen zur Ernährungsplanung ist der diensthabende Oberarzt zuständig.
Auffälligkeiten des Werkzeugs, insbesondere Rechenergebnisse, die klinisch nicht
plausibel erscheinen, bitte mit Screenshot und den eingegebenen Werten melden, damit
sie nachvollzogen werden können.

---

*Entscheidungsunterstützung, kein Medizinprodukt. Die Verantwortung für Indikation,
Verordnung und Überwachung liegt bei der behandelnden Ärztin oder dem behandelnden Arzt.*
