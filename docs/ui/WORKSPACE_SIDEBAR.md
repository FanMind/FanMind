# FanMind Workspace-Sidebar

## Zweck

Die Workspace-Sidebar verwendet für den ausgeklappten und eingeklappten Zustand dieselbe Navigation, dieselben Links, dieselben Icons und dieselbe Gruppierung. Ein Zustandswechsel verändert nur die Breite sowie die Sichtbarkeit von Beschriftungen und ergänzenden Metadaten.

Damit verhält sie sich wie eine klassische feste Icon-Schiene:

- Icons bleiben links auf derselben horizontalen Achse.
- Navigation, Workspace und gespeicherte Ansichten behalten Reihenfolge und vertikale Geometrie.
- Labels werden beim Einklappen nur visuell ausgeblendet.
- Aktiver Zustand, Hover, Fokus und Disabled-Zustand bleiben identisch.
- Follow-up-Zähler bleiben als kleiner Zähler sichtbar.
- Textuelle Status-Badges wie `Sync` werden eingeklappt als kleiner Statuspunkt dargestellt.
- Profil und Logout bleiben als zugängliche Aktionen vorhanden.

## Struktur

Die zentrale Komponente ist:

```text
src/components/WorkspaceShell.tsx
```

Sie rendert genau einen Sidebar-DOM-Baum. Es gibt keine getrennte `CollapsedSidebar` und keine zweite kompakte Navigationsliste.

Die Sidebar-spezifischen Styles liegen bewusst getrennt von den Dashboard-Inhaltsstyles in:

```text
src/components/WorkspaceSidebar.module.css
src/components/WorkspaceSidebarResponsive.module.css
```

Das erste Modul enthält die gemeinsame Sidebar-Geometrie und Zustände. Das zweite Modul kapselt ausschließlich den dunklen, deckenden Sidebar-Untergrund und das Verhalten auf schmalen Web-Viewports.

Gemeinsame Layoutkonstanten:

```text
expanded width desktop: 236px
expanded width narrow: maximal 320px
collapsed width: 76px
left/right gutter: 14px
icon rail: 44px
```

Da der seitliche Gutter in beiden Zuständen gleich bleibt, springt die Icon-Achse beim Umschalten nicht.

## Schmale Viewports

Bis 960 Pixel bleibt die Sidebar eine feste vertikale Navigation wie in der bereitgestellten Instagram-Webreferenz:

- expanded liegt sie als deckendes dunkles Overlay über dem Inhalt;
- collapsed reserviert das Layout exakt für die 76-Pixel-Icon-Schiene;
- der Inhaltsbereich beginnt collapsed rechts neben der Schiene und liegt nicht darunter;
- expanded ist maximal 320 Pixel breit und lässt auf kleinen Geräten einen schmalen Teil des Inhalts als Kontext sichtbar;
- Icons, Gruppen, Badge-Anker und Zeilenpositionen bleiben zwischen expanded und collapsed unverändert.

Die Sidebar wird deshalb nicht in eine zweite mobile Top-Navigation umgebaut. Web und Mobile-App bleiben getrennte Oberflächen; die native App unter `apps/mobile` verwendet ihre eigene Navigation.

## Branding

Ausgeklappt bleibt die FanMind-Wortmarke mit `Multi-Channel CRM` sichtbar.

Eingeklappt wird der runde Social-Media-Avatar verwendet:

```text
public/assets/fanmind-social-avatar.png
```

Das Asset wurde aus dem verbindlich bereitgestellten FanMind-Profilbild erzeugt, kreisförmig freigestellt und für die 48-Pixel-Darstellung optimiert. Es ersetzt das frühere selbst gebaute FM-Quadrat.

## Interaktion und Barrierefreiheit

- Der Toggle besitzt ein zustandsabhängiges `aria-label` und `aria-expanded`.
- Eingeklappte Links erhalten ihr sichtbares Label als `aria-label` und Tooltip.
- Unsichtbare Abschnittstitel behalten ihre Layoutfläche, sind aber für assistive Technologien im eingeklappten Zustand ausgeblendet.
- Profil und Logout bleiben fokussierbar.
- Fokusrahmen werden in beiden Zuständen angezeigt.
- `prefers-reduced-motion` deaktiviert die Übergangsanimationen.

## Scroll- und Höhenverhalten

Nur der Navigationsbereich scrollt. Branding, Toggle und Footer bleiben erreichbar. Für niedrigere Notebook-Höhen reduziert eine eigene `max-height: 760px`-Regel Abstände und Zeilenhöhen, ohne die Icon-Achse zwischen expanded und collapsed zu verändern.

## Marketing-Consent aus dem Screenshot

Das Element `Marketing-Messung mit Meta Pixel` ist die optionale Marketing-/Tracking-Einwilligung und nicht ein zweites Workspace-Menü. Es lädt den Meta Pixel nur nach ausdrücklicher Zustimmung. Dieser Sidebar-Umbau verändert weder Consent-Cookie noch Pixel-ID, Events oder erlaubte Tracking-Routen.

Aktiv bleibt ausschließlich:

```text
PageView auf freigegebenen öffentlichen Seiten nach Marketing-Einwilligung
```

CRM-, Kontakt-, Nachrichten-, KI-, Workspace- oder Profildaten werden durch diesen UI-Umbau nicht an Meta übertragen.

## Synthetischer Browser-Abnahmescreen

Der no-write Screen unter

```text
/sidebar-preview-e2e
```

enthält ausschließlich synthetische UI-Daten für die Playwright-Geometrie- und Screenshot-Abnahme. Er ist serverseitig fail-closed geschützt und antwortet außerhalb des Browser-E2E-Jobs mit `404`.

Nur der CI-Workflow setzt:

```text
FANMIND_ENABLE_SIDEBAR_PREVIEW_E2E=true
```

Die Variable ist bewusst nicht öffentlich, nicht als `NEXT_PUBLIC_*` definiert und wird in Production nicht gesetzt. Damit entsteht durch den Testscreen keine zusätzliche öffentliche Produkt-, Demo- oder Trackingroute.

## Regressionen

`tests/workspace-sidebar-icons.test.mjs` prüft unter anderem:

- genau einen Sidebar-DOM-Baum;
- gemeinsame Item-Renderer für alle Gruppen;
- unveränderte Navigationsreihenfolge;
- identische linke Gutter- und Icon-Schiene;
- den deckenden dunklen Sidebar-Untergrund;
- den Overlay-/Rail-Vertrag für schmale Viewports;
- das runde PNG-Avatar-Asset;
- Profil und Logout in beiden Zuständen;
- das Fehlen der früheren separaten Kompaktnavigation;
- die serverseitige 404-Grenze des synthetischen Preview-Screens.

`e2e/sidebar-preview.spec.ts` misst expanded und collapsed im echten Chromium-Browser. Es vergleicht Icon-Mittelpunkte, Zeilenpositionen, Breiten, Inhaltskante, horizontales Overflow, sichtbare Aktionen und das gerenderte Avatar-Asset. Screenshots werden nur als kurzlebige CI-Abnahmebelege erzeugt.
