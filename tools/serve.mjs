// Local development server only. Not a sandbox for executing untrusted generated code.
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve, dirname, join} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const routes = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/src/app.js", ["src/app.js", "text/javascript; charset=utf-8"]],
  ["/src/tasks.js", ["src/tasks.js", "text/javascript; charset=utf-8"]],
  ["/src/ai-auth.js", ["src/ai-auth.js", "text/javascript; charset=utf-8"]]
]);

export function createAppServer() {
  return createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src https://flqxwhibxnyujynmopmr.supabase.co; object-src 'none'; base-uri 'none'; form-action 'none'");
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, {"Allow": "GET, HEAD"}); res.end("Method not allowed"); return;
    }
    let pathname;
    try { pathname = new URL(req.url, "http://localhost").pathname; }
    catch { res.writeHead(400); res.end("Bad URL"); return; }
    const entry = routes.get(pathname);
    if (!entry) { res.writeHead(404); res.end("Not found"); return; }
    try {
      const [file, contentType] = entry;
      const content = await readFile(join(ROOT, file));
      res.writeHead(200, {"Content-Type": contentType, "Content-Length": content.byteLength});
      res.end(req.method === "HEAD" ? undefined : content);
    } catch {
      res.writeHead(500); res.end("Server error");
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError("Invalid PORT");
  createAppServer().listen(port, "127.0.0.1", () => {
    process.stdout.write("CONSTRUCTOR AI reference running at http://127.0.0.1:" + port + "\n");
  });
}
