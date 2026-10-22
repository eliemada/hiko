# Third-party notices

Hikō's original code is MIT licensed. Dependencies and bundled materials retain their own licenses; the project license does not replace them.

| Material | Source and license |
| --- | --- |
| BIZ UDPGothic PDF fonts | Morisawa Inc.; [SIL Open Font License 1.1](src/assets/fonts/OFL-BIZUDPGothic.txt), included with both font files. |
| MLIT Form 1 workbook | Japan Ministry of Land, Infrastructure, Transport and Tourism, [flight-logbook templates](https://www.mlit.go.jp/koku/operation.html). The bundled `src/assets/journey-log-template.xlsx` is the source template; exported copies are filled and styled by Hikō. Government material is subject to [MLIT's site terms](https://www.mlit.go.jp/link.html), not Hikō's MIT license. |
| DJI log decoder | [lvauvillier/dji-log-parser](https://github.com/lvauvillier/dji-log-parser), via `dji-log-parser-js`, MIT. DJI is a trademark of its owner; this project is independent. |
| MapLibre GL JS and worker | [MapLibre](https://github.com/maplibre/maplibre-gl-js), BSD-3-Clause. The worker is copied from the installed package during setup. |
| UI components | [shadcn/ui](https://github.com/shadcn-ui/ui), MIT, with Radix UI and Lucide icons under their respective licenses. |
| Inter, JetBrains Mono, Noto Sans JP | Font families distributed through Google Fonts and self-hosted by Next.js after build; retain their upstream open-font licenses. |
| Map and place data | OpenStreetMap contributors, Esri and its imagery providers, and OpenFreeMap. These are external services, not bundled data. Preserve their on-map attribution and follow each provider's usage terms. |
| Weather | [Open-Meteo](https://open-meteo.com/), external service. Check its current attribution, usage, and commercial-hosting terms before operating a service. |

Dependency versions are locked in `package-lock.json`. Releases include a CycloneDX inventory of production dependencies; container builds also publish SBOM and provenance attestations. Individual packages include their own copyright and license notices.

The fictional route illustration, sample data, screenshots, and social cards in this repository were made for Hikō. The illustration does not depict a real flight or an authorized flying location.
