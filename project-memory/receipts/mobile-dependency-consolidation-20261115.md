# Mobile #1457 / #1402: vorhandene Dependency-Updates gemeinsam prüfen

Basis main b6a2c44a992ad83bea5d608b6e3a90a3c2718627. Wiederverwendet werden expo-doctor 1.21.6 aus #1457 und Supabase SDK 2.118.0 aus #1402; SDK explizit exakt gepinnt statt der bisherigen Range, Lockfile festgeschrieben. Node-Minimum bleibt bereits vorhandenes >=22.13.0. Expo SDK58 und sämtliche React-/RN-/Worklets-/UI-Versionen bleiben unverändert. Keine Auth-/RLS-/Datenbank-/Provider-/Secretkonfiguration. Supabase-Changelog gelesen; keine neue API oder veränderte Berechtigungsentscheidung implementiert.

#1428 wird nicht übernommen: tatsächlicher Hosted-Job131949329184 meldet 19/20 PASS, falsche React19.3.1/react-dom19.3.1/Worklets0.13.1 gegenüber SDK58-Anforderung19.3.0/19.3.0/0.13.0. Kein Expo-Exclude und kein SDK-Major-Upgrade zur Umgehung.

Lokal: npm ci PASS, Mobile TypeScript PASS, Boundary51 Runtimefiles PASS,40 bestehende mobile App-/Kontakt-CRUD-/Refresh-/Offline-Regressionsfälle PASS. Doctor18/20: kein Paketversionsmismatch; zwei externe Checks blockiert (Expo-Schema-/React-Native-Directory-Serviceantwort), nicht als PASS oder Produktbug behauptet und nicht durch Offline-/Ignoreflag umgangen. Endgültige Hosted-CI muss tatsächliche Online-Doctor-Prüfung bestätigen. Keine unveränderten lokalen Retryschleifen.

Keine native Veröffentlichung, kein Signieren/Storeupload, kein Runtime-/Supabase-/Staging-/Productionzugriff. #1531/Backupworker unberührt. #1402 erst nach unabhängig bestätigter vollständiger Übernahme als redundant schließen. Owner entscheidet einen späteren Mobile-Release getrennt vom Webrelease.
