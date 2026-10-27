import { spawn } from "node:child_process";
import { mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));
const upstreamScript = path.join(root, "scripts", "upstream.py");
const API_ORIGIN = "https://api.squeekchain.com";
/** GitHub project Pages serves this repo at /squeek-analytics/. Dev stays at /. */
const PAGES_BASE = "/squeek-analytics/";

interface UpstreamResult {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

function pickHeaders(headers: Headers): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const name of ["etag", "retry-after", "x-request-id", "x-squeek-settlement-source", "cache-control", "content-type"]) {
    const value = headers.get(name);
    if (value) kept[name] = value;
  }
  return kept;
}

/** Optional dev fallback. Requires python3 and curl_cffi. Not part of the production bundle. */
function pythonFetch(url: string, ifNoneMatch?: string): Promise<UpstreamResult> {
  return new Promise((resolve, reject) => {
    const args = [upstreamScript, url];
    if (ifNoneMatch) args.push(ifNoneMatch);
    const child = spawn("python3", args, { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(err).toString() || `upstream helper exited ${code}`));
        return;
      }
      const parsed = JSON.parse(Buffer.concat(out).toString("utf8")) as {
        status: number;
        headers: Record<string, string>;
        body: string;
      };
      resolve({
        status: parsed.status,
        headers: parsed.headers,
        body: Buffer.from(parsed.body, "base64"),
      });
    });
  });
}

async function fetchUpstream(url: string, ifNoneMatch?: string): Promise<UpstreamResult> {
  try {
    const headers = new Headers({ accept: "application/json" });
    if (ifNoneMatch) headers.set("if-none-match", ifNoneMatch);
    const response = await fetch(url, { headers });
    const type = response.headers.get("content-type") ?? "";
    if (response.status !== 403 && !type.includes("text/html")) {
      return {
        status: response.status,
        headers: pickHeaders(response.headers),
        body: Buffer.from(await response.arrayBuffer()),
      };
    }
  } catch {
    // Cloudflare or a network error: try the browser-fingerprint helper.
  }
  return pythonFetch(url, ifNoneMatch);
}

function squeekDevProxy(): Plugin {
  return {
    name: "squeek-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/squeek-api", (req, res) => {
        void (async () => {
          const raw = req.url ?? "/";
          const stripped = raw.startsWith("/squeek-api") ? raw.slice("/squeek-api".length) : raw;
          const pathname = stripped.split("?")[0] ?? "";
          if (!/^\/v1\/[A-Za-z0-9_./%-]+$/.test(pathname) && pathname !== "/healthz" && pathname !== "/readyz") {
            res.statusCode = 404;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "not_found" }));
            return;
          }
          if (pathname.includes("..")) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "invalid_query" }));
            return;
          }
          try {
            const ifNoneMatch = typeof req.headers["if-none-match"] === "string" ? req.headers["if-none-match"] : undefined;
            const upstream = await fetchUpstream(`${API_ORIGIN}${stripped}`, ifNoneMatch);
            res.statusCode = upstream.status;
            for (const [name, value] of Object.entries(upstream.headers)) res.setHeader(name, value);
            if (!upstream.headers["content-type"]) res.setHeader("content-type", "application/json");
            res.end(upstream.body);
          } catch (error) {
            res.statusCode = 502;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "upstream_unreachable", detail: error instanceof Error ? error.message : String(error) }));
          }
        })();
      });
    },
    writeBundle(options) {
      const dir = options.dir;
      if (!dir) return;
      mkdirSync(dir, { recursive: true });
      const index = path.join(dir, "index.html");
      copyFileSync(index, path.join(dir, "404.html"));
    },
  };
}

export default defineConfig(({ command, mode }) => ({
  base: command === "build" || mode === "production" ? PAGES_BASE : "/",
  plugins: [react(), tailwindcss(), squeekDevProxy()],
  server: {
    host: "0.0.0.0",
    port: 47221,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 47221,
    strictPort: true,
  },
}));
