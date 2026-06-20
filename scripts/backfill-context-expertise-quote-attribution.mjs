import { exec, execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const mode = process.argv[2];
const rawArgs = process.argv.slice(3);
const validModes = new Set(["status", "dry-run", "run"]);
const defaultBatchSize = 100;
const defaultMaxBatches = 1;
const helpRequested =
  mode === "--help" ||
  mode === "-h" ||
  hasFlag(rawArgs, "--help") ||
  hasFlag(rawArgs, "-h");

if (helpRequested || !validModes.has(mode)) {
  printHelp();
  process.exit(helpRequested ? 0 : 1);
}

const options = parseOptions(rawArgs);

if (mode === "run" && !options.execute) {
  throw new Error(
    "Refusing to backfill Quote attribution Context Expertise Evidence without --execute. Run dry-run first, then retry with run --execute.",
  );
}

const paginationOpts = {
  cursor: options.cursor,
  numItems: options.batchSize,
};
const totals = {
  attributedQuoteRows: 0,
  createdEvidence: 0,
  eligibleQuoteRows: 0,
  existingEvidence: 0,
  missingEvidence: 0,
  processedQuoteRows: 0,
  skippedQuoteRows: 0,
  wouldCreateEvidence: 0,
};

let cursor = options.cursor;
let isDone = false;
let batchNumber = 0;

console.log(`Context Expertise Quote attribution ${mode}`);
console.log(`Batch size: ${options.batchSize}`);
console.log(`Max batches: ${options.maxBatches === Infinity ? "all" : options.maxBatches}`);
console.log(`Starting cursor: ${cursor ?? "null"}`);

while (!isDone && batchNumber < options.maxBatches) {
  batchNumber += 1;
  paginationOpts.cursor = cursor;

  const result =
    mode === "status"
      ? await runStatusBatch(paginationOpts, options)
      : await runBackfillBatch(paginationOpts, options, mode === "dry-run");

  isDone = result.isDone;
  cursor = result.continueCursor;

  totals.attributedQuoteRows += result.attributedQuoteRowCount;
  totals.eligibleQuoteRows += result.eligibleQuoteRowCount;
  totals.existingEvidence += result.existingEvidenceCount;
  totals.missingEvidence += result.missingEvidenceCount;
  totals.processedQuoteRows += result.processedQuoteRowCount;
  totals.skippedQuoteRows += result.skippedQuoteRowCount;

  if (mode === "status") {
    console.log(
      [
        `Batch ${batchNumber}: processed ${result.processedQuoteRowCount} Quote rows`,
        `${result.attributedQuoteRowCount} attributed`,
        `${result.eligibleQuoteRowCount} eligible`,
        `${result.existingEvidenceCount} existing evidence`,
        `${result.missingEvidenceCount} missing evidence`,
        `${result.skippedQuoteRowCount} skipped`,
      ].join("; "),
    );
    printEvidenceItems("Missing evidence", result.missingEvidenceItems);
  } else {
    totals.createdEvidence += result.createdEvidenceCount;
    totals.wouldCreateEvidence += result.wouldCreateEvidenceCount;
    console.log(
      [
        `Batch ${batchNumber}: processed ${result.processedQuoteRowCount} Quote rows`,
        `${result.attributedQuoteRowCount} attributed`,
        `${result.eligibleQuoteRowCount} eligible`,
        `${result.existingEvidenceCount} existing evidence`,
        `${result.missingEvidenceCount} missing evidence`,
        `${result.wouldCreateEvidenceCount} would create`,
        `${result.createdEvidenceCount} created`,
        `${result.skippedQuoteRowCount} skipped`,
      ].join("; "),
    );
    printEvidenceItems("Evidence", result.evidenceItems);
  }

  printSkippedItems(result.skippedQuoteRowItems);
  console.log(`Continue cursor: ${cursor}`);
  console.log(`Done: ${isDone ? "yes" : "no"}`);
}

if (!isDone) {
  console.log(
    `Stopped before completion after ${batchNumber} batch(es). Resume with --cursor ${JSON.stringify(
      cursor,
    )}.`,
  );
}

if (mode === "status") {
  console.log(
    `Status totals: ${totals.processedQuoteRows} Quote rows processed; ${totals.missingEvidence} missing Quote attribution evidence rows; ${totals.skippedQuoteRows} skipped.`,
  );
} else {
  console.log(
    `${mode === "dry-run" ? "Dry-run" : "Backfill"} totals: ${totals.processedQuoteRows} Quote rows processed; ${totals.wouldCreateEvidence} would create; ${totals.createdEvidence} created; ${totals.existingEvidence} already existed; ${totals.skippedQuoteRows} skipped.`,
  );
}

async function runStatusBatch(paginationOpts, options) {
  return await runConvex(
    "contextExpertise:getQuoteAttributionBackfillStatus",
    {
      paginationOpts,
    },
    options,
  );
}

async function runBackfillBatch(paginationOpts, options, dryRun) {
  return await runConvex(
    "contextExpertise:backfillQuoteAttributionEvidenceBatch",
    {
      dryRun,
      execute: !dryRun && options.execute,
      paginationOpts,
    },
    options,
  );
}

async function runConvex(functionName, args, options) {
  const commandArgs = ["convex", "run", functionName, JSON.stringify(args)];

  if (options.push) {
    commandArgs.push("--push");
  }
  if (options.prod) {
    commandArgs.push("--prod");
  }
  if (options.deployment !== undefined) {
    commandArgs.push("--deployment", options.deployment);
  }
  if (options.identity !== undefined) {
    commandArgs.push("--identity", options.identity);
  }

  const { stderr, stdout } = await runCommand("npx", commandArgs, {
    env: { ...process.env, NO_COLOR: "1" },
    maxBuffer: 1024 * 1024 * 20,
  });

  if (stderr.trim()) {
    process.stderr.write(stderr);
  }

  return parseConvexJson(stdout);
}

async function runCommand(command, args, options) {
  if (process.platform === "win32") {
    return await execAsync(
      [command, ...args].map(quoteWindowsShellArg).join(" "),
      options,
    );
  }

  return await execFileAsync(command, args, options);
}

function quoteWindowsShellArg(arg) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/"/g, '\\"')}"`;
}

function parseConvexJson(stdout) {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    throw new Error("Convex returned no stdout to parse.");
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    console.error("Could not parse Convex output as JSON. Raw stdout follows:");
    console.error(trimmed);
    throw error;
  }
}

function parseOptions(args) {
  const parsed = {
    batchSize: defaultBatchSize,
    cursor: null,
    deployment: undefined,
    execute: false,
    identity: process.env.CONVEX_RUN_IDENTITY,
    maxBatches: defaultMaxBatches,
    prod: false,
    push: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--all":
        parsed.maxBatches = Infinity;
        break;
      case "--batch-size":
        parsed.batchSize = parsePositiveInteger(readValue(args, ++index, arg), arg);
        break;
      case "--cursor":
        parsed.cursor = readValue(args, ++index, arg);
        break;
      case "--deployment":
        parsed.deployment = readValue(args, ++index, arg);
        break;
      case "--execute":
        parsed.execute = true;
        break;
      case "--identity":
      case "--identity-json":
        parsed.identity = readValue(args, ++index, arg);
        break;
      case "--identity-file":
        parsed.identity = readFileSync(readValue(args, ++index, arg), "utf8").trim();
        break;
      case "--max-batches":
        parsed.maxBatches = parsePositiveInteger(readValue(args, ++index, arg), arg);
        break;
      case "--prod":
        parsed.prod = true;
        break;
      case "--push":
        parsed.push = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function readValue(args, index, flag) {
  const value = args[index];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parsePositiveInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return number;
}

function printEvidenceItems(label, items) {
  if (items.length === 0) {
    return;
  }

  console.log(`${label}:`);
  for (const item of items) {
    const evidence = item.evidenceId === undefined ? "" : ` evidence=${item.evidenceId}`;
    console.log(
      `- ${item.action} quoteEntry=${item.quoteEntryId} entry=${item.entryId} person=${item.subjectPersonReferentId} context=${item.contextKey}${evidence}`,
    );
  }
}

function printSkippedItems(items) {
  if (items.length === 0) {
    return;
  }

  console.log("Skipped Quote rows:");
  for (const item of items) {
    const entry = item.entryId === undefined ? "" : ` entry=${item.entryId}`;
    const person =
      item.subjectPersonReferentId === undefined
        ? ""
        : ` person=${item.subjectPersonReferentId}`;
    console.log(
      `- ${item.skippedReason} quoteEntry=${item.quoteEntryId}${entry}${person}`,
    );
  }
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function printHelp() {
  console.log(`Usage:
  node scripts/backfill-context-expertise-quote-attribution.mjs status [options]
  node scripts/backfill-context-expertise-quote-attribution.mjs dry-run [options]
  node scripts/backfill-context-expertise-quote-attribution.mjs run --execute [options]

Modes:
  status   Report attributed Quote rows missing quoteAttribution Context Expertise Evidence.
  dry-run  Show rows that would receive quoteAttribution evidence without mutating data.
  run      Create missing quoteAttribution evidence and rebuild affected scoped aggregates.

Options:
  --all                         Continue until Convex reports completion.
  --batch-size <number>         Quote rows per Convex pagination page. Default: ${defaultBatchSize}.
  --cursor <cursor>             Resume from a previous continue cursor.
  --deployment <deployment>     Pass through to convex run.
  --execute                     Required for run mode.
  --identity-json <json>        System-admin identity JSON for convex run.
  --identity-file <path>        Read system-admin identity JSON from a file.
  --max-batches <number>        Maximum pages to process. Default: ${defaultMaxBatches}.
  --prod                        Pass through to convex run.
  --push                        Pass through to convex run.

The run mode refuses to mutate unless --execute is supplied.`);
}
