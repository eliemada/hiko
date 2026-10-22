# Contributing to Hikō

Useful contributions include reproducible bug reports, redacted device-compatibility results, Japanese terminology corrections, and improvements to the import → review → sign → export workflow.

## Local setup

Use Node.js 24 LTS (`nvm use` reads `.nvmrc`), then follow [the source setup](README.md#run-from-source). Secrets and flight data stay in ignored files. Never commit real logs, tracks, serial numbers, or signatures.

Before changing Next.js code, read the applicable guide in `node_modules/next/dist/docs/`; this version may differ from older examples.

## Verify a change

Run `npm run lint`, `npm run typecheck`, and `npm test`. For app behavior, install Chromium with `npx playwright install chromium` and run `npm run e2e`. This builds the production standalone app in `.next-test`, uses a temporary database, and cleans it up afterward.

`E2E_BASE_URL` opts into an already running **disposable** instance; tests create accounts and records. Never point it at your real fleet. `E2E_FIXTURES` enables the optional real-log journey with private files. Neither is required for CI.

For the demo, run `npm run demo:build`, `npm run test:demo`, and `npm run demo:serve`. Samples use the actual PDF and Excel exporters. `npm run media` additionally needs local Chromium and ffmpeg to regenerate screenshots and the walkthrough.

For containers, run `docker build -t hiko-test .` and `npm run test:container`. Podman users can set `CONTAINER_ENGINE=podman`. The smoke script removes only its uniquely named temporary containers and volumes.

## Pull requests

Explain the problem, change, and validation. Add focused regression tests for flight calculations, signing, authorization, exports, or persistence. Keep existing UI and accessibility conventions.

Database changes require a reviewed Drizzle migration (`npm run db:generate`). Do not rewrite migrations that have shipped. Document schema compatibility: rollback may require restoring a matching backup.

Use synthetic fixtures for public tests. Report vulnerabilities privately through [SECURITY.md](SECURITY.md).

## Dependency maintenance

Dependabot opens weekly update pull requests for npm packages, pinned GitHub Actions, and the Node container. Review runtime major upgrades deliberately and keep the Docker image, `.nvmrc`, `.node-version`, and supported engines aligned. Renovate is disabled for this repository to avoid duplicate update pull requests.

## Community

Be respectful and specific. Critique the work, help others reproduce problems, and avoid personal attacks, harassment, or publishing private information. Maintainers may remove abusive content or restrict participation. For private conduct concerns, use the contact link on the [maintainer's GitHub profile](https://github.com/eliemada).
