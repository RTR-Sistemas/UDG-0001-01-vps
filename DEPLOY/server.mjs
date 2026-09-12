import { createServer } from "node:http";
import { readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

let WebSocketImpl;
try {
  WebSocketImpl = (await import("ws")).WebSocket;
} catch {
  WebSocketImpl = undefined;
}
if (WebSocketImpl) {
  globalThis.WebSocket = WebSocketImpl;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_DIR = join(__dirname, "..", "netlify", "functions");
const PORT = Number(process.env.PORT || 8788);

const EXCLUDED = new Set(["_shared.js", "_shared.ts"]);

async function loadFunctions(dir) {
  const map = new Map();
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const name = entry.name;
      const file = join(full, `${name}.js`);
      const tsFile = join(full, `${name}.ts`);
      const chosen = (await exists(file)) ? file : (await exists(tsFile)) ? tsFile : null;
      if (chosen) {
        map.set(name, importHandler(chosen));
      }
      continue;
    }
    if (EXCLUDED.has(entry.name)) continue;
    if (!/\.(js|ts)$/.test(entry.name)) continue;
    const name = entry.name.replace(/\.(js|ts)$/, "");
    if (name.startsWith("_")) continue;
    map.set(name, importHandler(full));
  }
  return map;
}

async function exists(p) {
  try {
    await import("node:fs/promises").then((fs) => fs.access(p));
    return true;
  } catch {
    return false;
  }
}

const importHandler = (file) => async () => {
  const mod = await import(pathToFileURL(file).href);
  if (typeof mod.handler !== "function") {
    throw new Error(`${file} não exporta handler`);
  }
  return mod.handler;
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function toPlainHeaders(nodeHeaders) {
  const out = {};
  for (const [k, v] of Object.entries(nodeHeaders)) {
    out[k] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
  }
  return out;
}

async function handleRequest(req, res) {
  const url = new URL(req.url, "http://localhost");
  const match = url.pathname.match(/^\/(?:api|\.netlify\/functions)\/([\w-]+)\/?$/);
  if (!match) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }
  const fnName = match[1];
  let loader;
  try {
    loader = functions.get(fnName);
  } catch {
    loader = undefined;
  }
  if (!loader) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: `Function ${fnName} not found` }));
    return;
  }

  const body = await readBody(req);
  const event = {
    httpMethod: req.method,
    path: url.pathname,
    rawPath: url.pathname,
    rawUrl: req.url,
    rawQuery: url.search.slice(1),
    queryStringParameters: Object.fromEntries(url.searchParams),
    headers: toPlainHeaders(req.headers),
    multiValueHeaders: {},
    body,
    isBase64Encoded: false,
  };

  let result;
  try {
    const handler = await loader();
    result = await handler(event, {});
  } catch (err) {
    console.error(`[functions] ${fnName} erro:`, err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Internal server error", ok: false }));
    return;
  }

  res.statusCode = result.statusCode || 200;
  for (const [k, v] of Object.entries(result.headers || {})) {
    const value = Array.isArray(v) ? v : [v];
    for (const single of value) res.setHeader(k, String(single ?? ""));
  }
  if (result.multiValueHeaders) {
    for (const [k, vals] of Object.entries(result.multiValueHeaders)) {
      res.setHeader(k, vals.map(String));
    }
  }
  const contentType = res.getHeader("Content-Type");
  if (!contentType && result.body) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  if (result.body === undefined || result.body === null) {
    res.end("");
  } else if (Buffer.isBuffer(result.body)) {
    res.end(result.body);
  } else {
    res.end(String(result.body));
  }
}

const functions = await loadFunctions(FUNCTIONS_DIR);
console.log(`[functions] ${functions.size} funções carregadas de ${FUNCTIONS_DIR}`);
console.log(`[functions] Ouvindo em http://127.0.0.1:${PORT}`);

createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error("[functions] Erro fatal:", err);
    res.statusCode = 500;
    res.end("Internal error");
  });
}).listen(PORT, "127.0.0.1");