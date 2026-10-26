---
name: openextract
description: >-
  Use Simon's installed `openextract` Go CLI and private OpenExtract API to
  extract readable Markdown from known URLs with direct HTTP and browser
  fallback, or inspect and operate its Docker deployment. Always use when the
  user explicitly says OpenExtract while asking to read, parse, extract, or test
  a site; also trigger for OpenExtract diagnosis or deployment. Do not use for
  general web search or social-platform research.
targets:
  - '*'
---
# OpenExtract

Use the dependency-free `openextract` binary on `PATH`. Source lives at `~/workspace/dev/projects/personal/openextract`.

## Extract pages

The CLI accepts full URLs or bare domains and assumes HTTPS when the scheme is omitted:

```sh
openextract example.com
openextract https://example.com/page
```

It prints only the extracted page Markdown to stdout. A `dead` or `failed` API outcome exits nonzero with a short error instead of printing the API's diagnostic fields. Inspect the API directly only when diagnosis is requested.

The CLI defaults to `http://100.90.117.9:8082`. Override it with `OPENEXTRACT_API_URL` or `-api`. The default request timeout is two minutes and can be changed with `-timeout`.

OpenExtract first uses direct HTTP and escalates to its local Patchright/Chrome browser when rendering is required. Proxy and CAPTCHA solver attempts run only when their server credentials are configured. Keep managed-provider fallbacks in the caller rather than adding them to OpenExtract.

Use OpenExtract for extracting a known URL, not discovering pages or searching the web. Follow the workspace's CreatorCrawl-first route for current social-platform research.

## Live service

The private deployment runs as `openextract-api-1` on the `gmaps-scraper` Hetzner server. Chrome runs inside the same container; there is no separate browser container. The service is bound only to Tailscale at `http://100.90.117.9:8082`.

For current server state or deployment work, connect using the dedicated local key:

```sh
ssh -i ~/.ssh/gmaps_scraper_ed25519 -o IdentitiesOnly=yes root@77.42.64.26
```

The independent Compose project is `/opt/openextract/compose.yaml` and uses `ghcr.io/simonbalfe/openextract:latest`. Require an explicit user request before changing, restarting, publishing, or redeploying it.

Safe read checks:

```sh
curl --fail http://100.90.117.9:8082/healthz
docker compose -f /opt/openextract/compose.yaml ps
docker logs --tail 100 openextract-api-1
```

## Development

After Go CLI changes, run:

```sh
go test ./...
go vet ./...
go install ./cmd/openextract
```

After service source changes, follow the repository `AGENTS.md` and run `bun run typecheck` plus `bun run test`. Validate image changes with `docker build .`.
