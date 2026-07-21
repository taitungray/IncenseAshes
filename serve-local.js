const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = __dirname;
const preferredPort = 5173;
const host = "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function resolveFile(urlPath) {
  const cleanPath = urlPath === "/" ? "/index.html" : decodeURIComponent(urlPath);
  const filePath = path.resolve(root, `.${cleanPath}`);
  if (!filePath.startsWith(root)) return null;
  return filePath;
}

function createServer() {
  return http.createServer((req, res) => {
    const filePath = resolveFile(new URL(req.url, `http://${host}`).pathname);
    if (!filePath) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    });
  });
}

function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

function listenOnAvailablePort(port) {
  const server = createServer();

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      listenOnAvailablePort(port + 1);
      return;
    }
    console.error(err);
    process.exit(1);
  });

  server.listen(port, host, () => {
    const url = `http://${host}:${port}`;
    console.log(`廟埕守香已啟動：${url}`);
    console.log("請保持這個視窗開著；關閉視窗就會停止遊戲伺服器。");
    openBrowser(url);
  });
}

listenOnAvailablePort(preferredPort);
