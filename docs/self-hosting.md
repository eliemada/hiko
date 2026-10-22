# Self-hosting Hikō

Each deployment is one shared fleet. Start locally, create your administrator account, and then enable access for trusted pilots. The static public demo has no connection to your instance.

## Install a release

Clone the repository and run `node scripts/setup.mjs --docker` with Node.js 24. This creates `.env` with random authentication and invite secrets and owner-only file permissions. It preserves an existing file.

Review `.env`, then run:

```bash
docker compose pull
docker compose up -d --wait
```

The default image is a versioned beta. To select another version, add `HIKO_IMAGE=ghcr.io/eliemada/hiko:<version>` to `.env`. Use `ghcr.io/eliemada/hiko@sha256:<digest>` for an immutable reference.

### Without Node.js on the host

Run the helper inside the official Node container. On Linux/macOS:

```bash
docker run --rm --user "$(id -u):$(id -g)" \
  --volume "$PWD:/setup" --workdir /setup \
  node:24-bookworm-slim node scripts/setup.mjs --docker
```

Then use the Compose commands above. On Windows, use Node.js locally or adapt the bind-mount and user arguments to your Docker environment.

### Build from source

```bash
docker compose up -d --build --wait
```

The image runs as UID/GID `10001`, applies migrations on startup, and checks `/api/health`. Compose uses a named volume to avoid empty host-directory ownership problems. The database and raw logs both live under `/data`.

Compose explicitly sets `DATABASE_URL=file:/data/hiko.db` and `DATA_DIR=/data`. The relative defaults in `.env.example` are for local development and must not override these container paths.

## Configuration

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Generated authentication secret; keep private and stable across restarts. |
| `BETTER_AUTH_URL` | Exact URL pilots use, including scheme and port. |
| `TRUSTED_ORIGINS` | Additional trusted origins, comma-separated. |
| `INVITE_CODE` | Signup code for pilots after the first administrator. |
| `DJI_API_KEY` | Your DJI Open API / SDK key for encrypted log decoding. |
| `HIKO_BIND` | Host interface; defaults to `127.0.0.1`. |
| `HIKO_PORT` | Host port; defaults to `3000`. |
| `HIKO_IMAGE` | Release image tag or digest. |

Custom Node deployments may use `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, and `DATA_DIR` directly. Remote libSQL does not store raw files: durable filesystem storage and backups are still needed. The supplied Compose file intentionally uses local SQLite.

## Remote access

Create the first account through localhost before exposing the instance. Use a trusted HTTPS reverse proxy or private network, set `BETTER_AUTH_URL`, and restart. A host proxy can forward to `127.0.0.1:3000`; a containerized proxy needs an explicitly configured Docker network.

For LAN access, set `HIKO_BIND` to the intended interface and `BETTER_AUTH_URL` to the URL pilots use. Add only known alternate addresses to `TRUSTED_ORIGINS`. Phone geolocation normally requires HTTPS.

Bound uploads and rate-limit requests at the reverse proxy. The application caps an individual log at 40 MB; the proxy should also limit request bodies before they reach Node. Do not expose a real fleet as the public demo or publish its invite code.

## Back up and restore

Stop the application before archiving so SQLite and its journals form a consistent snapshot. The archive includes signatures, sessions, keychains, and original logs; treat it as sensitive.

```bash
mkdir -p backups
docker compose stop hiko
docker compose run --rm --no-deps -T --entrypoint tar hiko \
  -czf - -C /data . > backups/hiko-backup.tgz
docker compose up -d --wait
```

Keep an encrypted copy off the host. Preserve `.env` separately in secure storage. Never commit either file.

Restore into a **new, empty volume**, using the same app version first. A different Compose project name creates an independent volume; stop the original service if reusing its port:

```bash
docker compose -p hiko-restored run --rm --no-deps -T --entrypoint tar hiko \
  -xzf - -C /data < backups/hiko-backup.tgz
docker compose -p hiko-restored up -d --wait
```

Sign in, check totals, and export a log before switching users to the restored instance. Never extract over a live or nonempty database directory. Container CI exercises this archive/restore process and restart persistence on both architectures.

## Upgrade and rollback

1. Read release notes and take a complete backup.
2. Change `HIKO_IMAGE` to the target version or digest.
3. Run `docker compose pull` and `docker compose up -d --wait`.
4. Sign in and check records and exports.

Migrations run automatically. Downgrading the image does not undo migrations; restore the matching backup into a new volume when required.

## Troubleshooting

- **Startup:** inspect `docker compose logs --tail=100 hiko` locally; redact private details before sharing.
- **Sign-in/origin errors:** check exact URLs, scheme, and ports in the authentication configuration.
- **Encrypted logs:** verify your DJI Open API key. Manual entry remains available.
- **Exports:** the runtime needs bundled templates and fonts; rebuild from a clean checkout.
- **Maps/weather:** external providers may be unreachable; review and enter missing details manually.

## Verify image provenance

```bash
gh attestation verify oci://ghcr.io/eliemada/hiko:0.1.0-beta.1 --repo eliemada/hiko
```

Release assets include a production dependency inventory and SHA-256 checksums. Provenance identifies the build source and workflow; it does not validate flight records.
