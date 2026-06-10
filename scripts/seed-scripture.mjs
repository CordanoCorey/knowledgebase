import { exec, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const sourcePath = "data/scripture/kjv-verses-1769.json";
const sourceUrl =
  "https://raw.githubusercontent.com/farskipper/kjv/master/json/verses-1769.json";
const sourceRepositoryUrl = "https://github.com/farskipper/kjv";
const retrievedDate = "2026-06-10";
const expectedVerseCount = 31102;
const seedChunkSize = 5000;

if (!existsSync(sourcePath)) {
  throw new Error(`Missing local KJV source file: ${sourcePath}`);
}

const expectedSha256 = createHash("sha256")
  .update(readFileSync(sourcePath))
  .digest("hex")
  .toUpperCase();

console.log(`Seeding Scripture from ${sourcePath}`);
console.log(`Local source SHA-256: ${expectedSha256}`);

for (
  let startOrdinal = 1;
  startOrdinal <= expectedVerseCount;
  startOrdinal += seedChunkSize
) {
  const endOrdinal = Math.min(startOrdinal + seedChunkSize - 1, expectedVerseCount);
  const result = await runConvex(
    "seedScriptureAction:seedKjvFromSourceUrl",
    {
      endOrdinal,
      expectedSha256,
      markAvailable: endOrdinal === expectedVerseCount,
      retrievedDate,
      seedStructure: startOrdinal === 1,
      sourceRepositoryUrl,
      sourceUrl,
      startOrdinal,
    },
    { push: startOrdinal === 1 },
  );
  console.log(result);
}

const verification = await runConvex("seedScripture:verifySeed", {}, { push: false });
console.log(verification);

async function runConvex(functionName, args, options) {
  const jsonArgs = JSON.stringify(args);
  if (process.platform === "win32") {
    const escapedJsonArgs = jsonArgs.replace(/"/g, '\\"');
    const pushFlag = options.push ? " --push" : "";
    const { stderr, stdout } = await execAsync(
      `npx convex run ${functionName} "${escapedJsonArgs}"${pushFlag}`,
      {
        maxBuffer: 1024 * 1024 * 20,
      },
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
