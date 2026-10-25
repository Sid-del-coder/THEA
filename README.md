# AstroScope — Competition Upgrade

AstroScope is a location-aware observing guide with an astronomy event catalog, interactive sky tools, dark-sky trip planning, and confidence-labeled data.

## Security first

The original private credentials were exposed in browser JavaScript. **Rotate/revoke those old credentials in each provider dashboard.**  
This project contains no copied secret values. Configure fresh keys as server-side environment variables using `.env.example` as the list of required names.

Never commit a real `.env` file. It is already listed in `.gitignore`.

## What was added
Server-side API proxy for NASA APOD, OpenWeather, AstronomyAPI, NOAA SWPC space weather and Mapbox geocoding
Dynamic event endpoint with normalized local fallback plus optional ASTRONOMY_EVENTS_URL ingestion
Sky Forecast Engine using observer location, Sun altitude, Moon altitude/illumination, target altitude, and near-term weather when available
Personal Sky Intelligence and best observing window
“What’s Visible Right Now?” ranking
Interactive sky map with drag, zoom/pinch, and object identification
Astronomy-specific observing conditions and 0–100 score
Smart favorites/reminders with periodic in-page checks and downloadable calendar alerts
Interactive eclipse geometry lab
Split HTML/CSS/JS/data/assets structure (large embedded star PNG extracted to an asset file)
Red night mode for observing outdoors
Data confidence and visibilityEvent catalog dates and peak times are catalog values; location-specific eclipse circumstances are not included. Eclipse cards distinguish a horizon check at peak from confirmation that the event is visible locally. A solar eclipse requires local path/contact data; Sun altitude alone cannot establish that the eclipse is visible.Event observing indicators use simplified Sun, Moon, and planet positions. Where no matching weather forecast exists, the UI shows geometry indicators without a 0–100 score or quality verdict. Near-term weather is forecast data, not a guarantee. Local clouds, terrain, buildings, and light pollution still affect actual viewing.Files and responsibilities

##Events and space weather
The Events page is the searchable/filterable catalog; the Calendar page provides a date-grid view of the same catalog.Space-weather indicators use NOAA SWPC global planetary Kp data and its OVATION aurora model. The local aurora figure is a nearest-grid model value, not a guarantee that aurora will be visible from the selected site.

## Observing-data limits
The trip planner currently includes 17 starter destinations. Their Bortle ranges are approximate regional estimates and are not measurements at the listed coordinates — verify the exact site on the linked light-pollution map before travelling.
Planet positions use JPL’s approximate Keplerian elements and rates for 1800–2050.
Lunar coordinates use a truncated Meeus periodic series.
Rise/set times remain sampled estimates.
Browser notifications are checked every minute while the page is open and when it becomes active.
“Add calendar alert” downloads an iCalendar event with a 24-hour alarm. Import it into a calendar app for notifications while AstroScope is closed. Delivery depends on that app and device.
