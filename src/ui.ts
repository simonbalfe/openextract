export const testPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>OpenExtract</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; background: #f4f4f5; color: #18181b; font: 15px/1.5 system-ui, sans-serif; }
    main { max-width: 1100px; margin: auto; }
    h1 { margin: 0; font-size: 24px; }
    p { margin: 4px 0 20px; color: #71717a; }
    form { display: flex; gap: 8px; }
    input, button { border: 1px solid #d4d4d8; border-radius: 8px; font: inherit; }
    input { flex: 1; min-width: 0; padding: 11px 12px; background: white; }
    button { padding: 11px 18px; background: #18181b; color: white; cursor: pointer; }
    button:disabled { opacity: .55; cursor: wait; }
    #status { min-height: 24px; margin: 12px 0; color: #52525b; }
    iframe, details { width: 100%; border: 1px solid #d4d4d8; border-radius: 10px; background: white; }
    iframe { height: 62vh; }
    details { margin-top: 12px; padding: 12px 14px; }
    summary { cursor: pointer; font-weight: 600; }
    pre { overflow: auto; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <main>
    <h1>OpenExtract</h1>
    <p>Fetch a URL and inspect the Markdown OpenExtract returns.</p>
    <form>
      <input id="url" type="url" value="https://cloudflare.com" placeholder="https://example.com" aria-label="URL" required autofocus>
      <button>Extract</button>
    </form>
    <div id="status" role="status"></div>
    <iframe id="preview" title="Rendered Markdown" sandbox referrerpolicy="no-referrer"></iframe>
    <details>
      <summary>Raw Markdown</summary>
      <pre id="raw"></pre>
    </details>
    <details>
      <summary>Provider attempts</summary>
      <pre id="attempts"></pre>
    </details>
  </main>
  <script type="module">
    const form = document.querySelector("form");
    const input = document.querySelector("#url");
    const button = document.querySelector("button");
    const status = document.querySelector("#status");
    const preview = document.querySelector("#preview");
    const raw = document.querySelector("#raw");
    const attempts = document.querySelector("#attempts");
    const escapeHTML = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      status.textContent = "Extracting…";
      raw.textContent = "";
      attempts.textContent = "";
      const started = performance.now();
      try {
        const response = await fetch("/extract", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: input.value }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Extraction failed");
        const content = typeof data.content === "string" ? data.content : "";
        raw.textContent = content;
        attempts.textContent = JSON.stringify(Array.isArray(data.attempts) ? data.attempts : [], null, 2);
        status.textContent = [data.outcome, data.provider, content.length + " chars", Math.round(performance.now() - started) + " ms"].filter(Boolean).join(" · ");
        let rendered;
        try {
          const { marked } = await import("https://cdn.jsdelivr.net/npm/marked@18.0.7/lib/marked.esm.js");
          rendered = await marked.parse(content);
        } catch {
          rendered = "<pre>" + escapeHTML(content) + "</pre>";
        }
        preview.srcdoc = "<!doctype html><meta charset=utf-8><meta http-equiv=Content-Security-Policy content='default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;'><style>body{max-width:820px;margin:36px auto;padding:0 24px;color:#27272a;font:16px/1.65 system-ui,sans-serif}pre,code{background:#f4f4f5;border-radius:5px}pre{padding:14px;overflow:auto}code{padding:2px 4px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d4d4d8;padding:7px;text-align:left}blockquote{border-left:3px solid #a1a1aa;margin-left:0;padding-left:16px;color:#52525b}a{color:#2563eb}</style>" + rendered;
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error);
        preview.srcdoc = "";
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;
