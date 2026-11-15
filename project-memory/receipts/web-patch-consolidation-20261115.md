# Bestehende Web-Patches #1456 / #1430 zusammenführen

Owner-Auftrag: offene PRs konsolidieren; #1531 und Backupworker ausgenommen.
Basis: main b6a2c44a992ad83bea5d608b6e3a90a3c2718627.

Next und eslint-config-next werden gemeinsam von 16.4.3 auf 16.4.6 aktualisiert. Der bestehende ausschließlich Next zugeordnete PostCSS-/Sharp-Override wird auf dieselbe Version gebunden; seine geprüften Versionen bleiben erhalten. Die bestehende Framework-Sicherheitsprüfung verlangt das neue identische Paar; Root-Vulnerability-Budget bleibt null, Whitelist leer; keine Änderung an Mobile-Budgets oder deren Ablauf.

Erster tatsächlicher Audit des Paares: 9 Befunde, 2 High/7 Moderate im Entwickler-Werkzeugbaum (brace-expansion, Zod, minimatch und davon abhängiges typescript-eslint). Die alten engen Override-Zweige für brace-expansion werden auf 1.1.21 / 5.0.12 aktualisiert (bestehender unbetroffener Root-Zweig ist 5.0.13). Zod 4.x wird eng auf 4.6.6 korrigiert. Für die AST-Werkzeuge ist minimatch <11.0.1 betroffen; der zum Zeitpunkt der Prüfung neueste typescript-eslint 8.72.2 verlangt noch ^10.2.2. Deshalb ausschließlich unter @typescript-eslint/typescript-estree minimatch 11.0.1 erzwingen. Dies ist eine explizite transitive Major-Kompatibilitätskorrektur im Entwicklerbaum, kein SDK-/Framework-/Production-Major-Upgrade. Kein pauschales npm audit fix und kein Abschalten einer Prüfung.

Ergebnis auf dem endgültigen Paketbaum: npm ci erfolgreich; npm audit --json meldet 0/0/0/0 (417/418 Paketmetadaten sind kein Risikoindikator); 10/10 bestehende Dependency-Audit-/Pin-/Sharp-Tests PASS; komplettes ESLint PASS (0 Fehler, 7 bestehende Warnungen); synthetisch konfigurierter Next-16.4.6-Production-Build inklusive TypeScript PASS. Lint und Build prüfen die reale AST-/Glob-Kompatibilität der eng begrenzten Entwicklerkorrektur. Keine Provider-/Datenbank-/Runtimeaktion.

GitHub muss den endgültigen Head prüfen. Kein Merge und keine Release-/Staging-/Productionfreigabe. #1430 wird erst nach unabhängig bestätigter vollständiger Übernahme in #1456 als redundant geschlossen.
