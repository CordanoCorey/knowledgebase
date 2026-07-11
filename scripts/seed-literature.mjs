import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  getConvexDeploymentArgs,
  shouldPushWithConvexRun,
} from "./seed-cli-args.mjs";

const execFileAsync = promisify(execFile);
const convexDeploymentArgs = getConvexDeploymentArgs();

const sourcePath = "data/literature/classical-christian-literature.seed.json";
const enrichmentPath =
  "data/literature/classical-christian-literature.enrichment.json";
const maxConvexRunArgLength = process.platform === "win32" ? 2_500 : 40_000;

if (!existsSync(sourcePath)) {
  throw new Error(`Missing literature seed file: ${sourcePath}`);
}

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const enrichment = existsSync(enrichmentPath)
  ? JSON.parse(readFileSync(enrichmentPath, "utf8"))
  : { works: {} };
const works = source.works.map(({ schoolCanonPriority: _priority, ...work }) =>
  mergeWorkEnrichment(work, enrichment.works?.[work.canonicalKey]),
);

console.log(`Seeding literature referents from ${sourcePath}`);
console.log(
  existsSync(enrichmentPath)
    ? `Applying public metadata from ${enrichmentPath}`
    : `No public metadata enrichment file found at ${enrichmentPath}`,
);
console.log(`Works: ${works.length}`);

const totals = {
  seed: {
    authorDetails: emptyStats(),
    authorReferences: emptyStats(),
    authorReferents: emptyStats(),
    authorTags: emptyStats(),
    referents: emptyStats(),
    referentDetails: emptyStats(),
    tags: emptyStats(),
  },
};

const seedBatches = getJsonArgBatches(works, maxConvexRunArgLength);
let seededCount = 0;
for (const [batchIndex, batch] of seedBatches.entries()) {
  const result = JSON.parse(
    await runConvex(
      "seedLiterature:upsertLiteraryWorks",
      { works: batch },
      { push: batchIndex === 0 },
    ),
  );
  seededCount += batch.length;
  mergeStats(totals.seed.authorDetails, result.authorDetails);
  mergeStats(totals.seed.authorReferences, result.authorReferences);
  mergeStats(totals.seed.authorReferents, result.authorReferents);
  mergeStats(totals.seed.authorTags, result.authorTags);
  mergeStats(totals.seed.referents, result.referents);
  mergeStats(totals.seed.referentDetails, result.referentDetails);
  mergeStats(totals.seed.tags, result.tags);
  console.log(
    `Seeded ${seededCount}/${works.length}`,
  );
}

console.log(JSON.stringify(totals, null, 2));

const missing = [];
let checked = 0;
const verifyBatches = getJsonArgBatches(
  works.map(({ canonicalKey, knowledgeType, title }) => ({
    canonicalKey,
    knowledgeType,
    title,
  })),
  maxConvexRunArgLength,
);
for (const batch of verifyBatches) {
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
  const command = process.execPath;
  const commandArgs = [
    join(process.cwd(), "node_modules", "convex", "bin", "main.js"),
    "run",
    functionName,
    jsonArgs,
  ];
  const shouldPush = options.push && shouldPushWithConvexRun(convexDeploymentArgs);
  if (shouldPush) {
    commandArgs.push("--push");
  } else {
    commandArgs.push("--typecheck", "disable", "--codegen", "disable");
  }
  commandArgs.push(...convexDeploymentArgs);

  try {
    const { stderr, stdout } = await execFileAsync(command, commandArgs, {
      maxBuffer: 1024 * 1024 * 20,
    });
    writeRelevantStderr(stderr);
    return stdout.trim();
  } catch (error) {
    const stdout = String(error.stdout ?? "").trim();
    if (stdout) {
      JSON.parse(stdout);
      writeRelevantStderr(String(error.stderr ?? ""));
      return stdout;
    }
    throw error;
  }
}

function emptyStats() {
  return { inserted: 0, skipped: 0, updated: 0 };
}

function mergeStats(target, sourceStats) {
  target.inserted += sourceStats.inserted;
  target.skipped += sourceStats.skipped;
  target.updated += sourceStats.updated;
}

function mergeWorkEnrichment(work, enrichment) {
  if (!enrichment) {
    return work;
  }

  return {
    ...work,
    ...(Array.isArray(enrichment.authorReferences)
      ? { authorReferences: enrichment.authorReferences }
      : {}),
    detail: {
      ...work.detail,
      ...pickDefined({
        description: enrichment.description,
        descriptionSourceName: enrichment.descriptionSourceName,
        descriptionSourceUrl: enrichment.descriptionSourceUrl,
        googleBooksVolumeId: enrichment.googleBooksVolumeId,
        openLibraryCoverId: enrichment.openLibraryCoverId,
        openLibraryWorkKey: enrichment.openLibraryWorkKey,
        subjects: enrichment.subjects,
        thumbnailSourceName: enrichment.thumbnailSourceName,
        thumbnailSourceUrl: enrichment.thumbnailSourceUrl,
        thumbnailUrl: enrichment.thumbnailUrl,
        wikipediaTitle: enrichment.wikipediaTitle,
      }),
    },
  };
}

function pickDefined(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  );
}

function getJsonArgBatches(items, maxArgLength) {
  const batches = [];
  let currentBatch = [];

  for (const item of items) {
    const candidateBatch = [...currentBatch, item];
    if (
      currentBatch.length > 0 &&
      JSON.stringify({ works: candidateBatch }).length > maxArgLength
    ) {
      batches.push(currentBatch);
      currentBatch = [item];
      continue;
    }

    currentBatch = candidateBatch;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function writeRelevantStderr(stderr) {
  const relevantLines = String(stderr)
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .filter(
      (line) =>
        !line.includes("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"),
    );
  if (relevantLines.length > 0) {
    process.stderr.write(`${relevantLines.join("\n")}\n`);
  }
}
