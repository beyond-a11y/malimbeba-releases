import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname } from "node:path";
const MIME = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".html": "text/html",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
};
function esc(s) {
    return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
/** Build the demo document from a spec. Served files are referenced by path. */
export function buildDemoHtml(spec, servedFiles) {
    const lang = spec.lang ?? "en";
    const title = esc(spec.title ?? "Component demo");
    const styleTags = (spec.assets?.styles ?? []).map((s) => `<style>${s}</style>`).join("\n");
    const fileLinks = servedFiles
        .filter((f) => extname(f) === ".css")
        .map((f) => `<link rel="stylesheet" href="/asset/${encodeURIComponent(f)}">`)
        .join("\n");
    const fileScripts = servedFiles
        .filter((f) => /\.m?js$/.test(f))
        .map((f) => `<script type="module" src="/asset/${encodeURIComponent(f)}"></script>`)
        .join("\n");
    const moduleImports = (spec.assets?.modules ?? [])
        .map((m) => `<script type="module">import ${JSON.stringify(m)};</script>`)
        .join("\n");
    const inlineScripts = (spec.assets?.scripts ?? [])
        .map((s) => `<script type="module">\ntry {\n${s}\n} catch (e) {\n  document.body.insertAdjacentHTML("beforeend", "<pre role=alert>"+ (e && e.message) +"</pre>");\n}\n</script>`)
        .join("\n");
    return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${fileLinks}
${styleTags}
</head>
<body>
${spec.markup}
${fileScripts}
${moduleImports}
${inlineScripts}
</body>
</html>`;
}
/**
 * Start an ephemeral loopback HTTP server that serves one demo page plus any
 * whitelisted local asset files. Binds to 127.0.0.1 on an OS-assigned port.
 */
export async function serveDemo(spec, opts = {}) {
    // Resolve and validate asset files up front; never serve outside cwd.
    const cwd = process.cwd();
    const allow = new Map(); // encoded name -> absolute path
    for (const f of spec.assets?.files ?? []) {
        const abs = resolve(cwd, f);
        if (!abs.startsWith(cwd)) {
            throw new Error(`Refusing to serve asset outside the working directory: ${f}`);
        }
        if (!existsSync(abs) || !statSync(abs).isFile()) {
            throw new Error(`Asset not found: ${f}`);
        }
        allow.set(f, abs);
    }
    const html = buildDemoHtml(spec, [...allow.keys()]);
    const server = createServer((req, res) => {
        const url = req.url ?? "/";
        if (url === "/" || url === "/index.html") {
            res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
            res.end(html);
            return;
        }
        if (url.startsWith("/asset/")) {
            const name = decodeURIComponent(url.slice("/asset/".length));
            const abs = allow.get(name);
            if (!abs) {
                res.writeHead(404).end("not found");
                return;
            }
            try {
                const body = readFileSync(abs);
                res.writeHead(200, { "content-type": MIME[extname(abs)] ?? "application/octet-stream", "cache-control": "no-store" });
                res.end(body);
            }
            catch {
                res.writeHead(500).end("read error");
            }
            return;
        }
        res.writeHead(404).end("not found");
    });
    await new Promise((ok, err) => {
        server.once("error", err);
        // 127.0.0.1 only — never expose the harness beyond loopback.
        server.listen(opts.port ?? 0, "127.0.0.1", ok);
    });
    const addr = server.address();
    const port = addr.port;
    return {
        url: `http://127.0.0.1:${port}/`,
        port,
        close: () => new Promise((ok) => {
            server.close(() => ok());
        }),
    };
}
/** Read component source from disk into inline scripts (for paths under cwd). */
export function loadSourceFiles(paths) {
    const cwd = process.cwd();
    const scripts = [];
    const errors = [];
    for (const p of paths) {
        const abs = resolve(cwd, p);
        if (!abs.startsWith(cwd)) {
            errors.push(`Refusing to read outside the working directory: ${p}`);
            continue;
        }
        if (!existsSync(abs)) {
            errors.push(`Not found: ${p}`);
            continue;
        }
        try {
            scripts.push(readFileSync(abs, "utf8"));
        }
        catch (e) {
            errors.push(`Could not read ${p}: ${e.message}`);
        }
    }
    return { scripts, errors };
}
