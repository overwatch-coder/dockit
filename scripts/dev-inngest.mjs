#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Checks whether the given URL is a responsive Dockit Inngest serve endpoint.
 *
 * @param {string} url
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<boolean>}
 */
export async function isDockitEndpoint(url, fetchFn = globalThis.fetch) {
  try {
    const res = await fetchFn(url, {
      signal: AbortSignal.timeout(800),
      headers: { Accept: "application/json" },
    });
    if (res.status !== 200) return false;

    const isHandled = res.headers.get("x-inngest-sdk-handled") === "true";
    const framework = res.headers.get("x-inngest-framework");
    if (isHandled || framework === "nextjs") return true;

    const text = await res.text();
    return text.includes('"function_count"') || text.includes('"mode"');
  } catch {
    return false;
  }
}

/**
 * Detects the active Next.js Dockit dev server port.
 *
 * @param {Object} [options]
 * @param {number[]} [options.candidatePorts]
 * @param {number | null} [options.explicitPort]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.pollIntervalMs]
 * @param {typeof fetch} [options.fetchFn]
 * @param {(msg: string) => void} [options.logFn]
 * @returns {Promise<number>}
 */
export async function detectDockitPort({
  candidatePorts = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010],
  explicitPort = null,
  timeoutMs = 30000,
  pollIntervalMs = 400,
  fetchFn = globalThis.fetch,
  logFn = console.log,
} = {}) {
  const portsToTest = explicitPort
    ? [Number(explicitPort), ...candidatePorts.filter((p) => p !== Number(explicitPort))]
    : candidatePorts;

  const startTime = Date.now();
  let firstLog = true;
  let lastHeartbeat = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    for (const port of portsToTest) {
      const url = `http://localhost:${port}/api/jobs/run`;
      const isDockit = await isDockitEndpoint(url, fetchFn);
      if (isDockit) {
        logFn(`[inngest-dev] 🎯 Detected active Dockit dev server on port ${port} (${url})`);
        return port;
      }
    }

    if (firstLog) {
      logFn(
        `[inngest-dev] 🔍 Probing for active Dockit dev server on ports ${portsToTest[0]}-${portsToTest[portsToTest.length - 1]}...`
      );
      firstLog = false;
    } else if (Date.now() - lastHeartbeat >= 2500) {
      lastHeartbeat = Date.now();
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      logFn(`[inngest-dev] ⏳ Probing ports ${portsToTest.join(", ")} for Dockit dev server... (${elapsedSec}s elapsed)`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const fallback = explicitPort || portsToTest[0] || 3000;
  logFn(
    `[inngest-dev] ⚠️ Timed out probing dev server after ${Math.round(
      timeoutMs / 1000
    )}s. Defaulting to port ${fallback}.`
  );
  return fallback;
}

/**
 * Terminates stale Inngest processes occupying the default dev server port.
 *
 * @param {number} [port]
 */
export function terminateStaleInngestServer(port = 8288) {
  try {
    const stdout = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim();
    if (stdout) {
      const pids = stdout.split("\n").map((p) => p.trim()).filter(Boolean);
      for (const pid of pids) {
        try {
          const procName = execSync(`ps -p ${pid} -o comm=`, { encoding: "utf8" }).trim();
          if (procName.includes("inngest")) {
            console.log(`[inngest-dev] 🔄 Stopping stale Inngest process (PID ${pid}) on port ${port}...`);
            process.kill(Number(pid), "SIGTERM");
          }
        } catch {
          // Process might have already exited
        }
      }
    }
  } catch {
    // Port not in use or lsof not available
  }
}

/**
 * Resolves the path to the inngest binary.
 *
 * @returns {string}
 */
export function resolveInngestBinary() {
  const localBin = path.resolve(process.cwd(), "node_modules/.bin/inngest");
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  return "inngest";
}

/**
 * Main execution entrypoint for CLI runner.
 */
export async function run() {
  const args = process.argv.slice(2);

  // Check for explicit --port or -p CLI args
  let explicitPort = null;
  const portArgIndex = args.findIndex((arg) => arg === "--port" || arg === "-p");
  if (portArgIndex !== -1 && args[portArgIndex + 1]) {
    explicitPort = parseInt(args[portArgIndex + 1], 10);
    // Remove --port / -p and value so they aren't forwarded to inngest dev
    args.splice(portArgIndex, 2);
  } else if (process.env.PORT) {
    explicitPort = parseInt(process.env.PORT, 10);
  }

  // Check if user manually passed --sdk-url or -u
  const hasCustomSdkUrl = args.some((arg) => arg === "--sdk-url" || arg === "-u");

  let detectedPort = explicitPort;
  if (!hasCustomSdkUrl) {
    detectedPort = await detectDockitPort({ explicitPort });
  }

  const sdkUrl = `http://localhost:${detectedPort || 3000}/api/jobs/run`;

  // Register endpoint with Inngest via PUT ping if dev server is active
  try {
    await fetch(sdkUrl, {
      method: "PUT",
      signal: AbortSignal.timeout(1200),
    });
  } catch {
    // Ignore initial warmup connection errors
  }

  // Terminate any stale inngest process from previous sessions holding port 8288
  terminateStaleInngestServer(8288);

  // Wait briefly for port 8288 to release
  await new Promise((resolve) => setTimeout(resolve, 300));

  const inngestBin = resolveInngestBinary();
  const spawnArgs = ["dev"];

  if (!hasCustomSdkUrl) {
    spawnArgs.push("-u", sdkUrl);
  }

  spawnArgs.push(...args);

  console.log(`[inngest-dev] 🚀 Starting Inngest Dev Server synced to ${sdkUrl}`);

  const child = spawn(inngestBin, spawnArgs, {
    stdio: "inherit",
    shell: false,
  });

  const forwardSignal = (sig) => {
    if (child && !child.killed) {
      child.kill(sig);
    }
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  child.on("error", (err) => {
    console.error("[inngest-dev] Failed to start Inngest Dev Server:", err.message);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

// Execute if run directly from CLI
const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  run().catch((err) => {
    console.error("[inngest-dev] Error running Inngest dev runner:", err);
    process.exit(1);
  });
}
