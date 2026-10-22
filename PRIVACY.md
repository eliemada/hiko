# Data and privacy

Hikō is software you run for a trusted pilot or fleet. The maintainer does not receive your instance's flight records. This is a description of the shipped application, not a privacy policy for every operator who may host a copy.

## What your instance stores

The database contains account details, password hashes managed by Better Auth, sessions, pilot names and email addresses, optional license numbers and drawn signatures, aircraft identifiers, flight times and coordinates, tracks, weather, notes, and cached DJI decryption keychains. Session records may include IP addresses and user agents.

Uploaded DJI files are retained under the data directory. Container installations store both the SQLite database and raw logs in `/data`; local development defaults to `./data`. Back up both together. Files and the database are not encrypted by Hikō at rest; use host-level access controls and disk encryption if appropriate.

## Who can see records

**An instance is one shared fleet.** Signed-in pilots can view the fleet's aircraft, flights, tracks, logbook, pilot directory, email addresses, and signatures shown on records and exports. Pilots sign their own flights; administrators can manage the fleet. It is not a service with isolated accounts for unrelated customers.

The first account becomes administrator. Create it while access is limited to your own machine. Later signups require the configured invite code. Host administrators can access stored data and server logs.

## Requests outside your server

| Feature | Recipient | Data involved |
| --- | --- | --- |
| Decrypt encrypted DJI logs | DJI's keychain service, through the upstream parser | Your configured API key and a keychain request derived from the log. Cached keys allow later reprocessing without another keychain fetch. |
| Place names | OpenStreetMap Nominatim | Takeoff/landing coordinates and a requested language. |
| Weather | Open-Meteo | Coordinates rounded to four decimals and dates around the flight time. |
| Maps | Esri / OpenFreeMap and map-data providers | Tile and imagery requests reflecting the displayed area, and the requesting browser's IP address. |
| Font build | Google Fonts | The build machine fetches font assets; Next.js serves them from your instance afterward. |

Enrichment services can fail; coordinate and manual-entry fallbacks are provided. Imported data and automatic suggestions still need a pilot's review. Server errors may contain filenames, coordinates, or upstream error details, so treat operational logs as private.

## Retention and deletion

Deleting a flight does not imply that its original uploaded file, cached keychain, or backups have been erased. There is no complete account-erasure or automated retention workflow in this beta. The host operator must handle deletion requests across the database, raw-file archive, logs, and backups. Do not publish those files in issues or pull requests.

## Public demo

The public demo uses only fictional data, applies a fixed sample signature, and links to generated sample exports. It accepts no real uploads, makes no application requests to third-party services, stores no changes, and includes no analytics. Its static hosting provider may retain normal access logs. Following a GitHub or MLIT link takes you to that site's service.
