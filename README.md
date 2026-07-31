# OpenExtract

OpenExtract returns readable page content and links from a URL. It starts with direct HTTP and only escalates when the response looks like a JavaScript shell or block page.

The extraction ladder is:

1. direct HTTP with Impit
2. Browserless, when configured
3. local Patchright
4. Patchright with proxy and solver, when configured
5. Tavily, when configured

## Run

```sh
docker run --rm -p 8081:8081 ghcr.io/simonbalfe/openextract:latest
```

Images are published for `linux/amd64` and `linux/arm64`. Copy `.env.example` when enabling optional providers.

For a self-hosted Browserless companion:

```sh
docker network create openextract
docker run -d --name browserless --network openextract ghcr.io/browserless/chromium:v2.55.2
docker run --rm --network openextract -p 8081:8081 \
  -e BROWSERLESS_URL=http://browserless:3000 \
  ghcr.io/simonbalfe/openextract:latest
```

## API

Health check:

```sh
curl http://localhost:8081/healthz
```

Extract a page:

```sh
curl -X POST http://localhost:8081/extract \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}'
```

The response includes the extracted `content`, discovered `links`, selected `provider`, final `outcome`, and each attempted ladder rung.

## Develop

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
docker build -t openextract .
```
