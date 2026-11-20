# BT-006 T7 – Testbasis R14 zur unabhängigen Prüfung

Owner-Freigabe am 20.11.2026. Führender Auftrag [Boerns-Core #30](https://github.com/Bernds-tech/Boerns-Core/issues/30), Aufgabe `BOERNS-COS-ROUTING-20261027`, Schritt `BT006_T7_R14_REVIEW_BASELINE`.

Die neue Basis übernimmt die zehn Dateien des geprüften Entwurfs [FanMind #1381](https://github.com/FanMind/FanMind/pull/1381) aus Commit `2aab0b710d9fbae0ef5b2e569b468be8c6fe3f75` bytegleich. Der [R13-Quellenbefund](https://github.com/Bernds-tech/Boerns-Core/issues/30#issuecomment-7041005808) bleibt historisch erhalten. R14 ersetzt das fehlende R13-Paket für die Vorbereitung einer neuen Prüfung und benötigt die unabhängige Annahme dieser Basis.

## Reproduzierbare Basis

Aus dem Verzeichnis dieser Datei mit `sha256sum --check` gegen den folgenden Manifestblock prüfen. Vor der Ablage wurde für jede Datei aus der GitHub-Base64-Antwort sowohl der Git-Blob als auch SHA‑256 unabhängig aus den Bytes berechnet. Paketname und bereits geprüfte Quellen sind unverändert.

```text
22674cef809ca6fd2d80102f65165fb9b18c2cc52416856f08e00fd6785fa9c6  package.json
c103ad0c7c07c4db810aa1dd9f41452b679d46a26fa652ed09eaf4d2325e75ab  README.md
54d458139a42fe548846a35f46c6ab731dd3afdd9b0204835bb9561c2c306d4b  src/canonical.mjs
a91ec563311ce5f3a44b2f0eade521705263d0cb57de3f7cbc31384e29da002c  src/dispatcher.mjs
a3b1559853c0aa9ff05f43a672f8470a6e34ec72c21d15393567c7c169401586  src/errors.mjs
1c1b3a93441ab56b792cbffaa785184f15417071047f946376d5c74bd50a3a35  src/fenced_gateway.mjs
fa1a2984c3445d5c3778d193c1a5729a94013d35e6597cc32c384c4846a48824  src/in_memory_claim_store.mjs
646900992aec3807b77b5872f82d3fa25c14964d1150b60ab8567f441c275ef4  src/rc6_acquire_response.mjs
8c58bd5c0b624c58e4bf69b198f24edc145be46a388c38ab54efb6e3b15e9251  test/dispatcher.test.mjs
b64ddc8e2b100b1c0b879d950ce0c4fdbe9597fe10204f0fd3ca3bdd6f966e11  test/rc6_acquire_response.test.mjs
```

## Vorprüfung des Zielsystems

- Der Dispatcher besitzt einen In-Memory-Store für die vorhandene Suite. Die geprüfte RC6-Antwortvalidierung ist separat und noch ohne verifizierte Laufzeitbindung. Beides dient als Referenz für die spätere Integration.
- Für den isolierten Lauf das Ziel, einen bereits berechtigten Bereitstellungsoperator, die bestehende zulässige Authentifizierung, die konkrete private BT-006-Action und deren Version dokumentieren. Die historisch geprüfte [RC6-Grundlage](https://github.com/Bernds-tech/Boerns-Core/issues/32#issuecomment-6476079127) getrennt prüfen und ihre tatsächlich verwendete Revision und Datei-Hashes fixieren, bevor sie angebunden wird.
- BT-037 bereitet die instrumentierte Ausführung vor, BT-030 prüft unabhängig. Die [privaten Ausweichwege](https://github.com/Bernds-tech/Boerns-Core/issues/30#issuecomment-7040704132) sind ein möglicher Transport, sobald aktiver Empfänger, ausführbarer Weg und tatsächliche Übernahme dokumentiert sind. Chief of Staff BT-001 koordiniert und hält die Freigabe sowie den Status in #30 fest.
- Review-Auftrag: Manifest und Commit nachvollziehen, die noch notwendige Persistenz-/Action-Bindung anhand des tatsächlich vorgesehenen Zielsystems prüfen und das Start-Gate mit fehlenden oder belegten Voraussetzungen zurückmelden. Bei einer Änderung an Code oder Integration die neue Version und ihren Diff separat festhalten.

## Abnahmekriterium für den einmaligen synthetischen Lauf

Einen synthetischen Auftrag mit einem frischen eindeutigen Schlüssel `task_id:step_id:revision` zweimal identisch an dieselbe private BT-006-Testanbindung zustellen. Beobachtbar sein müssen zwei Eingänge, genau ein erfolgreicher Claim, genau eine fachliche Ausführung und genau ein persistiertes Ergebnis. Der zweite Eingang darf keine zweite Ausführung oder Folgeübergabe erzeugen. Nachweise enthalten verwendete Versionen, Lauf-IDs, Zeitstempel und bereinigten Rücklesebeleg für alle vier Zähler.

Status dieser Änderung: `SOURCE_BASELINE_READY_FOR_REVIEW / T7_NOT_RUN`. Beschränkt auf die neue Review-Branch. Die Bereitstellung und der Agentenlauf sind gesonderte Schritte innerhalb der bestehenden Freigabegrenzen.
