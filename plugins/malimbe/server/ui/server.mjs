#!/usr/bin/env node
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyTarget, runAxeAudit } from "../dist/engine/axe.js";
import { createAuditEvidence, persistAuditEvidence } from "../dist/engine/evidence.js";
import { buildReport, reportToMarkdown } from "../dist/engine/report.js";
import { crawlAudit } from "../dist/engine/fetch.js";
import { aggregateCrawl, crawlToMarkdown } from "../dist/format.js";
import { closeBrowser } from "../dist/engine/render.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const carouselSource = resolve(root, "..", "components", "carousel.js");
const tutorialMarkdown = resolve(root, "..", "TUTORIAL.md");
const docs = new Map([
  ["/docs/README.md", resolve(root, "..", "README.md")],
  ["/docs/WORKFLOWS.md", resolve(root, "..", "WORKFLOWS.md")],
  ["/docs/AGENTS.md", resolve(root, "..", "AGENTS.md")],
  ["/docs/components/README.md", resolve(root, "..", "components", "README.md")],
]);
const port = Number(process.env.MALIMBEBA_UI_PORT || 4173);
const maxBodyBytes = 1024 * 1024;

function dirname(path) {
  return path.replace(/[\\/][^\\/]*$/, "");
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function contentType(path) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
  }[extname(path)] || "application/octet-stream";
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function audit(input) {
  const url = String(input.url || "").trim();
  if (!url) throw new Error("Enter a URL first.");
  const crawl = Boolean(input.crawl);
  const maxPages = Math.max(1, Math.min(20, Number(input.max_pages) || 20));

  if (crawl) {
    const pages = await crawlAudit(url, maxPages, undefined, "browser");
    const aggregate = aggregateCrawl(pages, maxPages);
    return {
      kind: "crawl",
      report: { start: url, aggregate, pages },
      markdown: crawlToMarkdown(url, pages, aggregate),
    };
  }

  const scope = classifyTarget(url);
  const run = await runAxeAudit(url, { scope, pageContext: true });
  if (run.error) throw new Error(run.error);
  const report = buildReport(run);
  const evidence = createAuditEvidence(report, run, { kind: "deployed", ref: url });
  const evidenceRef = persistAuditEvidence(evidence);
  const withEvidence = {
    ...report,
    evidence: {
      auditId: evidence.auditId,
      reportDigest: evidence.reportDigest,
      evidenceRef,
      policy: evidence.policy,
      malimbebaVersion: evidence.malimbebaVersion,
    },
  };
  return {
    kind: "page",
    report: withEvidence,
    markdown: `${reportToMarkdown(report)}\n\n**Evidence:** \`${evidenceRef}\` · audit ID \`${evidence.auditId}\``,
  };
}

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    if (requestUrl.pathname === "/health") return sendJson(res, 200, { ok: true, service: "malimbeba-ui" });
    if (requestUrl.pathname === "/api/audit" && req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" });
      return res.end();
    }
    if (requestUrl.pathname === "/api/audit" && req.method === "POST") {
      const result = await audit(await readJson(req));
      return sendJson(res, 200, result);
    }
    if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, 405, { error: "Method not allowed." });
    if (requestUrl.pathname === "/components/carousel.js") {
      if (!existsSync(carouselSource) || !statSync(carouselSource).isFile()) return sendJson(res, 404, { error: "Not found." });
      res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
      if (req.method === "HEAD") return res.end();
      const stream = createReadStream(carouselSource);
      stream.on("error", (error) => {
        if (!res.headersSent) sendJson(res, 500, { error: error.message });
        else res.destroy(error);
      });
      return stream.pipe(res);
    }
    if (requestUrl.pathname === "/tutorial.md") {
      if (!existsSync(tutorialMarkdown) || !statSync(tutorialMarkdown).isFile()) return sendJson(res, 404, { error: "Not found." });
      res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" });
      if (req.method === "HEAD") return res.end();
      const stream = createReadStream(tutorialMarkdown);
      stream.on("error", (error) => {
        if (!res.headersSent) sendJson(res, 500, { error: error.message });
        else res.destroy(error);
      });
      return stream.pipe(res);
    }
    const documentPath = docs.get(requestUrl.pathname);
    if (documentPath) {
      if (!existsSync(documentPath) || !statSync(documentPath).isFile()) return sendJson(res, 404, { error: "Not found." });
      res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" });
      if (req.method === "HEAD") return res.end();
      const stream = createReadStream(documentPath);
      stream.on("error", (error) => {
        if (!res.headersSent) sendJson(res, 500, { error: error.message });
        else res.destroy(error);
      });
      return stream.pipe(res);
    }

    const requested = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const file = normalize(join(root, requested));
    const rootPrefix = root.endsWith("\\") || root.endsWith("/") ? root : `${root}${process.platform === "win32" ? "\\" : "/"}`;
    if (!(file === root || file.startsWith(rootPrefix)) || !existsSync(file) || !statSync(file).isFile()) return sendJson(res, 404, { error: "Not found." });
    res.writeHead(200, { "Content-Type": contentType(file), "Cache-Control": "no-store" });
    if (req.method === "HEAD") return res.end();
    const stream = createReadStream(file);
    stream.on("error", (error) => {
      if (!res.headersSent) sendJson(res, 500, { error: error.message });
      else res.destroy(error);
    });
    return stream.pipe(res);
  } catch (error) {
    return sendJson(res, 400, { error: error instanceof Error ? error.message : "The audit bridge failed." });
  }
});

const shutdown = async () => {
  await closeBrowser();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
server.listen(port, "127.0.0.1", () => {
  console.error(`Malimbe UI running at http://127.0.0.1:${port}/`);
});