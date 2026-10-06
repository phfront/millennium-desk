// Servidor estático mínimo para docs/ (mocks e cascas de teste), só em 127.0.0.1.
// A casca do Shello precisa de origem http (não file://) para o Claude Web liberar o
// iframe: ele aceita só as origens listadas em frameAncestors no data/config.json dele.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
const PORT = Number(process.env.PORT || 5280);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".md": "text/markdown; charset=utf-8",
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (pathname === "/") {
    res.writeHead(302, { Location: "/shello-casca.html" });
    res.end();
    return;
  }
  const file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
  if (!file.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Nao encontrado");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`docs/ em http://127.0.0.1:${PORT}/`);
});
