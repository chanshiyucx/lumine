# Private media Worker

A Cloudflare Worker on `private.shiyu.me` that serves the pipeline's `private/` tree from the `gallery` R2 bucket. The public site keeps using the bucket's own domain for `public/`; a WAF rule on that domain blocks every path outside `/public/`, so private files are reachable only through this Worker.

## Requests

| Request | Check | Response |
| --- | --- | --- |
| `GET /<assetPath>?exp=<unix seconds>&sig=<signature>` | `sig` is a valid signature and `exp` is in the future, at most 7 days ahead | The image, with `Cache-Control: private, max-age=<seconds until exp>` |
| `GET /manifest.json` with `Authorization: Bearer <PRIVATE_MANIFEST_TOKEN>` | Constant-time token comparison | The private manifest, `Cache-Control: no-store` |
| Anything else | — | The same `404` for every rejection, so nothing reveals which files exist |

`assetPath` is the URL from the private manifest, for example `gallery/20261003-Athens/DSC08562.avif`, and must start with `gallery/` or `thumbnails/`. The signature is:

```text
sig = base64url(HMAC-SHA256(MEDIA_SIGNING_SECRET, `${exp}:${assetPath}`))
```

The web server signs each private asset URL with `exp` set to the end of the unlock session, so links stay stable and browser-cacheable for that session. After a valid request, the Worker caches the image per data center for 30 days, keyed by path without the query string. A re-exported private image can therefore stay cached at the edge for up to 30 days unless its file name changes.

`ALLOWED_ORIGINS` in `wrangler.jsonc` lists the origins that may `fetch()` images, which the viewer needs to load originals and downloads.

## Secrets

| Name | Used by |
| --- | --- |
| `MEDIA_SIGNING_SECRET` | The Worker verifies signatures; the web server signs URLs with the same value |
| `PRIVATE_MANIFEST_TOKEN` | The web server reads the private manifest with it |

Generate each one with `openssl rand -base64 32`, keep both in a password manager, and set the same values in Vercel. Never commit them.

## Deploy

```bash
cd worker
pnpm install
pnpm exec wrangler login
```

A new Worker must receive its required secrets during its first deploy. Put both values in a file outside the repository, deploy with it, then delete the file:

```dotenv
MEDIA_SIGNING_SECRET=...
PRIVATE_MANIFEST_TOKEN=...
```

```bash
pnpm run deploy --secrets-file /path/outside/repo/lumine-worker.secrets
```

The deploy creates the `private.shiyu.me` custom domain and its DNS record. Later deploys only need `pnpm run deploy` (plain `pnpm deploy` is a built-in pnpm command). To rotate a secret, run `pnpm exec wrangler secret put <NAME>` and update Vercel to match; rotating `MEDIA_SIGNING_SECRET` invalidates every signed link.

## Local development

```bash
cp .dev.vars.example .dev.vars   # then fill in test values
pnpm exec wrangler r2 object put gallery/private/manifest.json --local --file /path/to/R2/private/manifest.json
pnpm dev
```

`pnpm dev` uses a local R2 simulation, not the real bucket. `worker-configuration.d.ts` is generated and not committed: run `pnpm types` after installing or changing `wrangler.jsonc` (`pnpm type-check` does it too).
