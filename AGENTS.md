# OpenExtract

OpenExtract is a standalone Bun and TypeScript page-content extraction service.

## Development

- Keep the extraction ladder local: direct HTTP, local Patchright, then proxy or solver escalation when configured.
- Keep managed provider fallbacks in callers. Do not add Exa, Tavily, or similar APIs to OpenExtract.
- Keep the HTTP-to-browser decision conservative and covered by tests.
- Do not expose credentials in logs or API responses.
- Run `bun run typecheck` and `bun run test` after source changes.
- Validate image changes with `docker build .`.

## Documentation

- Keep runtime, API, and environment documentation in `README.md`.
- Freegent owns only its integration configuration and must consume the published image rather than this source tree.
