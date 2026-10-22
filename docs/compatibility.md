# Compatibility and scope

Hikō `0.1.0-beta.2` supports a flight-record workflow for one trusted fleet. Automatic extraction and suggestions are starting points for pilot review, not a determination of legality or a complete compliance system.

| Source | Implementation | Evidence / limitation |
| --- | --- | --- |
| Manual entry | Date/time, place, purpose, conditions, aircraft, and pilot | Automated browser coverage through signing and PDF/XLSX export; no DJI key. |
| Supported unencrypted DJI Fly TXT | Local decoding and airborne-segment detection | Synthetic extraction tests; device-specific coverage is still being collected. |
| Supported encrypted TXT, version 13+ | Keychain retrieval, local decoding, cached reprocessing | Requires your Open API key and upstream parser support; no universal firmware claim. |
| Encrypted file without API key | Header summary when available | Times/location may be estimates and need review. |
| Other manufacturers / DAT / CSV | Manual entry | No importer is included. |

Model/controller examples do not establish verified hardware support. Report aircraft, controller/phone, DJI Fly and firmware versions, format, and outcome through the compatibility issue form. Omit serial numbers and real coordinates.

## Finding DJI logs

Common locations vary with app version and operating-system access restrictions:

- Android controllers/phones: `Android/data/dji.go.v5/files/FlightRecord/`, when file access is permitted.
- iPhone: Finder → iPhone → Files → DJI Fly → flight-record folder, if that app version exposes it.

Look for DJI flight-record TXT files such as `FlightRecord_*.txt`. Renaming another format does not make it compatible.

For encrypted logs, use [DJI's developer portal](https://developer.dji.com/user) to create and activate an **Open API** app and set its SDK key as `DJI_API_KEY`. DJI controls access and account requirements. See [the upstream parser](https://github.com/lvauvillier/dji-log-parser) for decoder coverage.

## Export scope

PDF sheets are rendered by Hikō; Excel output fills the bundled MLIT Form 1 workbook. Both include pilot-reviewed details and running airframe totals. Unsigned PDF sheets carry a draft watermark. A drawn signature is a visible image, not a cryptographic digital signature or immutable audit trail.

MLIT publishes separate **Form 2 daily inspection** and **Form 3 maintenance** records. The squawk/report block does not replace them. Registration, permissions, airspace checks, flight-plan notifications, and DIPS submissions remain separate. See [the current official forms](https://www.mlit.go.jp/koku/operation.html).

Night and height suggestions are heuristic. Height relative to takeoff does not establish height above terrain along the entire route. Weather enrichment is a service estimate, not an on-site observation. Review all relevant conditions yourself.

## Current boundaries

- One shared fleet; no isolated accounts for unrelated customers.
- Internet is needed for initial encrypted key retrieval and optional enrichment/maps.
- No complete account erasure, automated retention, email recovery workflow, or immutable signature history in this beta.
- Container targets: Linux AMD64 and ARM64. Release runtime: Node.js 24.
- The public demo is a browser preview with fixed fictional data and generated exports. It does not parse personal files or operate a live fleet.
