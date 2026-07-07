import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const sourcePath = "data/literature/classical-christian-literature.seed.json";
const seedBatchSize = 8;
const verifyBatchSize = 25;

if (!existsSync(sourcePath)) {
  throw new Error(`Missing literature seed file: ${sourcePath}`);
}

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const works = source.works.map(({ schoolCanonPriority: _priority, ...work }) => work);

console.log(`Seeding literature from ${sourcePath}`);
console.log(`Works: ${works.length}`);

const totals = {
  details: emptyStats(),
  entries: emptyStats(),
  entryTags: emptyStats(),
  referents: emptyStats(),
  tags: emptyStats(),
};

for (let start = 0; start < works.length; start += seedBatchSize) {
  const batch = works.slice(start, start + seedBatchSize);
  const result = JSON.parse(
    await runConvex(
      "seedLiterature:upsertLiteraryWorks",
      { works: batch },
      { push: start === 0 },
    ),
  );
  mergeStats(totals.details, result.details);
  mergeStats(totals.entries, result.entries);
  mergeStats(totals.entryTags, result.entryTags);
  mergeStats(totals.referents, result.referents);
  mergeStats(totals.tags, result.tags);
  console.log(
    `Seeded ${Math.min(start + batch.length, works.length)}/${works.length}`,
  );
}

console.log(JSON.stringify(totals, null, 2));

const missing = [];
let checked = 0;
for (let start = 0; start < works.length; start += verifyBatchSize) {
  const batch = works.slice(start, start + verifyBatchSize).map((work) => ({
    canonicalKey: work.canonicalKey,
    knowledgeType: work.knowledgeType,
  }));
  const verification = JSON.parse(
    await runConvex(
      "seedLiterature:verifyLiteratureSeedBatch",
      { works: batch },
      { push: false },
    ),
  );
  checked += verification.checked;
  missing.push(...verification.missing);
}

const verification = {
  checked,
  missing,
  ok: missing.length === 0 && checked === works.length,
};
console.log(JSON.stringify(verification, null, 2));

if (!verification.ok) {
  throw new Error("Literature seed verification failed.");
}

async function runConvex(functionName, args, options) {
  const jsonArgs = JSON.stringify(args);
  const command = process.platform === "win32" ? process.execPath : "npx";
  const commandArgs =
    process.platform === "win32"
      ? [
          join(
            dirname(process.execPath),
            "node_modules",
            "npm",
            "bin",
            "npx-cli.js",
          ),
          "convex",
          "run",
          functionName,
          jsonArgs,
        ]
      : ["convex", "run", functionName, jsonArgs];
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

function emptyStats() {
  return { inserted: 0, skipped: 0, updated: 0 };
}

function mergeStats(target, sourceStats) {
  target.inserted += sourceStats.inserted;
  target.skipped += sourceStats.skipped;
  target.updated += sourceStats.updated;
}
