import { exec, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const sourcePath = "data/scripture/kjv-verses-1769.json";
const sourceFileName = "kjv-verses-1769.json";
const sourceRepositoryUrl = "https://github.com/farskipper/kjv";
const retrievedDate = "2026-06-10";
const expectedVerseCount = 31102;
const seedChunkSize = 5000;
const skipPush = process.env.CONVEX_SEED_SCRIPTURE_SKIP_PUSH === "1";

if (!existsSync(sourcePath)) {
  throw new Error(`Missing local KJV source file: ${sourcePath}`);
}

const expectedSha256 = createHash("sha256")
  .update(readFileSync(sourcePath))
  .digest("hex")
  .toUpperCase();

console.log(`Seeding Scripture from ${sourcePath}`);
console.log(`Local source SHA-256: ${expectedSha256}`);

const localSourceServer = await serveLocalSourceFile(sourcePath, sourceFileName);
try {
  for (
    let startOrdinal = 1;
    startOrdinal <= expectedVerseCount;
    startOrdinal += seedChunkSize
  ) {
    const endOrdinal = Math.min(
      startOrdinal + seedChunkSize - 1,
      expectedVerseCount,
    );
    const result = await runConvex(
      "seedScriptureAction:seedKjvFromSourceUrl",
      {
        endOrdinal,
        expectedSha256,
        markAvailable: endOrdinal === expectedVerseCount,
        retrievedDate,
        seedStructure: startOrdinal === 1,
        sourceRepositoryUrl,
        sourceUrl: localSourceServer.url,
        startOrdinal,
      },
      { push: startOrdinal === 1 && !skipPush },
    );
    console.log(result);
  }

  const verification = await runConvex("seedScripture:verifySeed", {}, { push: false });
  console.log(verification);
} finally {
  await localSourceServer.close();
}

async function serveLocalSourceFile(path, fileName) {
  const sourceBytes = readFileSync(path);
  const server = createServer((request, response) => {
    if (request.url !== `/${fileName}`) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "cache-control": "no-store",
      "content-length": sourceBytes.byteLength,
      "content-type": "application/json; charset=utf-8",
    });
    response.end(sourceBytes);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine local Scripture source server port.");
  }

  const url = `http://127.0.0.1:${address.port}/${fileName}`;
  console.log(`Serving local Scripture source at ${url}`);

  return {
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    url,
  };
}

async function runConvex(functionName, args, options) {
  const jsonArgs = JSON.stringify(args);
  if (process.platform === "win32") {
    const escapedJsonArgs = jsonArgs.replace(/"/g, '\\"');
    const pushFlag = options.push ? " --push" : "";
    const { stderr, stdout } = await execConvexOnWindows(
      `npx convex run ${functionName} "${escapedJsonArgs}"${pushFlag}`,
    );
    if (stderr.trim()) {
      process.stderr.write(stderr);
    }
    return stdout.trim();
  }

  const command = "npx";
  const commandArgs = ["convex", "run", functionName, jsonArgs];
  if (options.push) {
    commandArgs.push("--push");
  }

  const { stderr, stdout } = await execFileAsync(command, commandArgs, {
    maxBuffer: 1024 * 1024 * 20,
  });
  if (stderr.trim()) {
    process.stderr.write(stderr);
  }
  return stdout.trim();
}

async function execConvexOnWindows(command) {
  try {
    return await execAsync(command, {
      maxBuffer: 1024 * 1024 * 20,
    });
  } catch (error) {
    const stdout = typeof error.stdout === "string" ? error.stdout : "";
    const stderr = typeof error.stderr === "string" ? error.stderr : "";
    if (
      stdout.trim().startsWith("{") &&
      stderr.includes("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)")
    ) {
      return { stderr: "", stdout };
    }

    throw error;
  }
}
