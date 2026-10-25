# AstroScope — Competition Upgrade

AstroScope is a location-aware observing guide with an astronomy event catalog, interactive sky tools, dark-sky trip planning, and confidence-labeled data.

## Security first
The original private credentials were exposed in browser JavaScript. **Rotate/revoke those old credentials in each provider dashboard.** This project contains no copied secret values. Configure fresh keys as server-side environment variables using `.env.example` as the list of required names.

## Run
This project uses only Node.js built-ins; no npm install is required. Set the environment variables in your terminal or hosting provider, then run:

```bash
node server.js
```

Open `http://localhost:3000`. The server serves `index69.html` at `/` and provides the local JSON data and API routes. Opening the HTML file directly with `file://` blocks those fetches in most browsers, so event and observing-site data will appear empty.

## What was added
- Server-side API proxy for NASA APOD, OpenWeather, AstronomyAPI, NOAA SWPC space weather and Mapbox geocoding.
- Dynamic event endpoint with normalized local fallback plus optional `ASTRONOMY_EVENTS_URL` ingestion.
- Sky Forecast Engine using observer location, Sun altitude, Moon altitude/illumination, target altitude, and near-term weather when available.
- Personal Sky Intelligence and best observing window.
- “What’s Visible Right Now?” ranking.
- Interactive sky map with drag, zoom/pinch, and object identification.
- Astronomy-specific observing conditions and 0–100 score.
- Smart favorites/reminders with periodic in-page checks and downloadable calendar alerts.
- Interactive eclipse geometry lab.
- Split HTML/CSS/JS/data/assets, with the large embedded star PNG extracted to an asset file.

## Data confidence and visibility
Event catalog dates and peak times are catalog values; location-specific eclipse circumstances are not included. Eclipse cards distinguish a horizon check at peak from confirmation that the event is visible locally. A solar eclipse requires local path/contact data; Sun altitude alone cannot establish that the eclipse is visible.

Event observing indicators use simplified Sun, Moon, and planet positions. Where no matching weather forecast exists, the UI shows geometry indicators without a 0–100 score or quality verdict. Near-term weather is forecast data, not a guarantee. Local clouds, terrain, buildings, and light pollution still affect actual viewing.

## Files and responsibilities
- `index69.html`: page structure and controls.
- `css/style.css`: visual system and responsive presentation.
- `js/app.js`: core astronomy helpers, location state, event catalog rendering, local visibility messaging, and main UI.
- `js/enhancements.js`: forecast/condition indicators, sky map, reminders, and dynamic event feed loading.
- `js/trip.js`: observing-site ranking and trip detail calculations.
- `data/events.json`: normalized event catalog and event metadata.
- `data/sites.json`: observing site coordinates and approximate Bortle classes.
- `server.js`: static server and server-side API proxies.
- `assets/stars.png`: star-field image asset.

The core render cycle is owned by `app.js`; optional UI features are grouped behind `renderEnhancements()` in `enhancements.js`. Location and favorite updates run in their owning functions instead of replacing them at runtime.

## Events and space weather
The Events page is the searchable/filterable catalog; the Calendar page provides a date-grid view of the same catalog. The separate timeline and yearly list were removed because they repeated event data. Space-weather indicators use NOAA SWPC global planetary Kp data and its OVATION aurora model. The local aurora figure is a nearest-grid model value, not a guarantee that aurora will be visible from the selected site.

## Observing-data limits
The trip planner currently includes 17 starter destinations. Their Bortle ranges are approximate regional estimates and are not measurements at the listed coordinates; verify the exact site on the linked light-pollution map before travelling. Planet positions use JPL's approximate Keplerian elements and rates for 1800–2050; lunar coordinates use a truncated Meeus periodic series. These improve on fixed mean elements but are not a full numerical ephemeris, and rise/set times remain sampled estimates. Browser notifications are checked every minute while the page is open and when it becomes active. “Add calendar alert” downloads an iCalendar event with a 24-hour alarm; import it into a calendar app for notifications while AstroScope is closed. Calendar alert delivery depends on that app and device.
