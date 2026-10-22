# Security policy

The latest `0.1.0-beta` release is the supported preview. Updates can include schema changes; make a backup before upgrading.

Report vulnerabilities privately through [GitHub's private vulnerability reporting](https://github.com/eliemada/hiko/security/advisories/new). Include the affected version, a minimal reproduction, impact, and any proposed fix. Do not attach real flight logs, signatures, session cookies, or API keys. There is no guaranteed response-time SLA for this community project.

## Deployment boundaries

- Run each instance for one trusted pilot or fleet. All signed-in users share fleet records and the pilot directory.
- Complete first-account setup locally before exposing a deployment. Compose binds to `127.0.0.1` by default.
- Use HTTPS for remote access and set `BETTER_AUTH_URL` to the actual origin. Limit `TRUSTED_ORIGINS` to origins you control.
- Keep the generated authentication secret and invite code private. Rotate the invite code when membership changes.
- Treat the database, raw logs, keychains, signatures, backups, and server logs as sensitive. Store backups outside the repository.
- Restrict large uploads and rate-limit traffic at the reverse proxy for an internet-facing instance. Authentication's in-process limits are not a distributed abuse-control system.

The public demo is a separate static application with fictional data and no account or upload endpoints. It does not expose a fleet instance.

## Dependencies and releases

GitHub Actions use pinned action commits and scoped permissions. Dependabot proposes dependency and action updates. Release images include dependency and build attestations. `npm audit --omit=dev` checks shipped runtime dependencies; development-tool advisories must also be reviewed before running tools against untrusted inputs.

As of 2026-10-22, the development dependencies include the unpatched [`braces` advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), inherited by ESLint/shadcn tooling. It concerns deeply nested glob patterns. These tools are not application endpoints; do not feed them untrusted patterns. CI gates runtime advisories and Dependabot tracks upstream fixes. Forced audit downgrades of Next.js or the UI tooling are not a compatible remedy.

Targeted dependency overrides select patched `uuid` for ExcelJS and a newer `esbuild` for the older Drizzle loader. Export tests, migrations/builds, and browser checks exercise the affected integration paths.
