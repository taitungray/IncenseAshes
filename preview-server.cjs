const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".ttf": "font/ttf"
};

http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const file = path.resolve(root, relative);

  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  fs.createReadStream(file).pipe(response);
}).listen(8776, "127.0.0.1");
