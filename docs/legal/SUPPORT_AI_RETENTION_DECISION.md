# Support-KI: Entscheidung zur Nachweisfrist – ENTWURF

Stand14.11.2026; #1350. Keine Rechtsfreigabe und keine aktive Löschregel.

Die Kontolaufzeit allein begründet nicht die Speicherung des vollständigen
widerrufenen Einwilligungsnachweises. Der EDPB trennt den Nachweis während der
Verarbeitung von der danach noch konkret notwendigen Aufbewahrung (Guidelines
05/2020, Rn107–108). Eine pauschale Drei-/Siebenjahresfrist oder automatische
Übernahme einer allgemeinen Verjährungsfrist wird hier nicht als Pflicht behauptet.

## Zur fachlichen/rechtlichen Entscheidung vorgelegt

**Empfehlung B:** Aktueller positiver Nachweis während der wirksamen Aktivierung.
Nach Widerruf vollständiger Nachweis längstens30Tage; dieser Vorschlag orientiert
sich an der bestehenden Supportaufbewahrung, ist keine gesetzliche Frist. Danach
bleiben nur Auth-Nutzerzuordnung, false und monotone Revision als Sperrstand bis
Kontolöschung. Keine Erteilungs-/Widerrufszeit, Textversion oder Request-ID im
Sperrstand. Der Sicherheitszweck dieses minimalen Zustands ist gesondert nach
Art6(1)f mit Interessenabwägung zu prüfen und transparent zu erläutern. Eine neue
aktive Entscheidung erhält wieder den aktuellen Informationstext und Zeitpunkt.

**Alternative A:** Vollständiger aktueller Nachweis bis Kontolöschung nur bei
konkret dokumentierter Notwendigkeit für die Zeit nach Widerruf. Keine solche
Notwendigkeit ist bisher belegt; A ist daher keine empfohlene Standardfreigabe.

Ein vollständiges Löschen nach30Tagen würde die Revision wieder auf0 setzen.
Eine alte Grant-Anfrage mit revision0 könnte danach erneut angenommen werden.
Der minimale Sperrstand verhindert dies. Er ist keine zweite Consent-Verwaltung.

## Kontrolliert vorbereitete Anpassung für B

Die folgende SQL-Fassung wird ausschließlich auf wegwerfbaren CI-Datenbanken
geprüft. Sie ist NICHT Teil des Production-Apply und nicht auf Staging/Production
angewandt. Nach bestätigter Frist: eigenes geprüftes Upgrade, neuer exakter
Schemanachweis, Staging-Abnahme und Anbindung an den bestehenden Retentionlauf
mit eigener Freigabe. Kein zweiter Scheduler. Erst danach Production-Aktivierung.
Die aktuell vorbereitete Production-Installation bleibt auf den unveränderten
SQL-Hash aus1491 beschränkt und installiert niemals diese Proposal-SQL automatisch.

```sql
BEGIN;
ALTER TABLE public.support_ai_consents ALTER COLUMN text_version DROP NOT NULL;
ALTER TABLE public.support_ai_consents ALTER COLUMN request_id DROP NOT NULL;
ALTER TABLE public.support_ai_consents DROP CONSTRAINT support_ai_consents_check;
ALTER TABLE public.support_ai_consents ADD CONSTRAINT support_ai_consents_check CHECK(
 (granted AND text_version IS NOT NULL AND request_id IS NOT NULL AND granted_at IS NOT NULL AND revoked_at IS NULL)
 OR (NOT granted AND text_version IS NOT NULL AND request_id IS NOT NULL AND revoked_at IS NOT NULL)
 OR (NOT granted AND text_version IS NULL AND request_id IS NULL AND granted_at IS NULL AND revoked_at IS NULL)
);
CREATE FUNCTION public.support_ai_consent_minimize_revoked() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n bigint;
BEGIN
 UPDATE public.support_ai_consents SET text_version=NULL,request_id=NULL,granted_at=NULL,revoked_at=NULL,revision=revision+1
 WHERE NOT granted AND revoked_at<clock_timestamp()-interval '30 days';
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.support_ai_consent_minimize_revoked() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
```

Die UPDATE-Bedingung wird nach einer konkurrierenden Zeilensperre erneut geprüft;
eine inzwischen aktive Zustimmung wird nicht minimiert. Revision wird erhöht,
alte Requests bleiben blockiert. Der Lauf hat keine Provider-/Nachrichtenseiteffekte.
Kein pauschaler Rechtsstreit-Hold; falls ein konkreter Rechtsanspruch eine längere
Aufbewahrung erfordert, muss dessen separater Umfang/Zweck/Frist erst freigegeben
und technisch geprüft werden. Keine stille Umstellung widerrufener KI-Verarbeitung.

Freizugeben sind: B oder begründetes A, Dauer30Tage oder ausdrücklich begründete
andere Dauer, Sicherheitsgrundlage des minimalen Sperrstands, Informationstext
und Umsetzung/Abnahme vor neuer Production-Aktivierung. Offen bleibt, ob für lange
inaktive positive Entscheidungen eine zusätzliche Gültigkeitsprüfung nötig ist;
ein unbelegtes gesetzliches Einwilligungsablaufdatum wird nicht erfunden.
