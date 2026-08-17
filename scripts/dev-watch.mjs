import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const logPath = path.join(root, ".next", "dev-server.log");
const PORT = 3000;

fs.mkdirSync(path.join(root, ".next"), { recursive: true });

function log(msg) {
  fs.appendFileSync(logPath, `[watch] ${new Date().toISOString()} ${msg}\n`);
}

function listenersOnPort(port) {
  try {
    const out = spawnSync("netstat", ["-ano", "-p", "tcp"], {
      encoding: "utf8",
      timeout: 10000,
    }).stdout;
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (
        parts.length >= 5 &&
        parts[0] === "TCP" &&
        parts[1].endsWith(`:${port}`) &&
        parts[3] === "LISTENING"
      ) {
        const pid = Number(parts[4]);
        if (Number.isFinite(pid)) pids.add(pid);
      }
    }
    return [...pids];
  } catch (err) {
    log(`netstat failed: ${err.message}`);
    return [];
  }
}

function killStaleOnPort(port) {
  for (const pid of listenersOnPort(port)) {
    log(`killing stale process ${pid} holding port ${port}`);
    try {
      spawnSync("taskkill", ["/PID", String(pid), "/F"], {
        stdio: "ignore",
        timeout: 10000,
      });
    } catch (err) {
      log(`taskkill ${pid} failed: ${err.message}`);
    }
  }
}

function isHealthy(timeout = 2000) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "localhost", port: PORT, path: "/", timeout },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

let child = null;
let restartTimer = null;

function start() {
  killStaleOnPort(PORT);
  log("starting next dev...");
  child = spawn("cmd.exe", ["/c", "npm run dev"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (d) => fs.appendFileSync(logPath, d));
  child.stderr.on("data", (d) => fs.appendFileSync(logPath, d));
  child.on("exit", (code, signal) => {
    log(`next dev exited (code=${code}, signal=${signal}); restarting in 2s`);
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(start, 2000);
  });

  verifyHealth();
}

async function verifyHealth() {
  const deadline = Date.now() + 90000;
  let ok = false;
  while (Date.now() < deadline) {
    if (!child || child.exitCode !== null) return;
    if (await isHealthy()) {
      ok = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  if (!ok && child && child.exitCode === null) {
    log("server started but never answered on port 3000; killing it");
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  }
}

start();
