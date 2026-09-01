import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };
const server = http.createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const target = path.resolve(root, requested);
  if (!target.startsWith(root)) { response.writeHead(403).end("Forbidden"); return; }
  try {
    const data = await fs.readFile(target);
    response.writeHead(200, { "content-type": types[path.extname(target)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(data);
  } catch {
    const fallback = await fs.readFile(path.join(root, "index.html"));
    response.writeHead(200, { "content-type": types[".html"] });
    response.end(fallback);
  }
});
server.listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}`));
