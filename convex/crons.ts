import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Cron jobs schedule bounded internal work; each run processes a small batch and
// leaves durable state in Convex tables.
const HUMAN_WEIGHT_RECALCULATION_CRON_BATCH_SIZE = 50;

const crons = cronJobs();

crons.interval(
  "recalculate Human Weight estimates",
  { hours: 24 },
  internal.humanWeightRecalculation.recalculateBatch,
  { batchSize: HUMAN_WEIGHT_RECALCULATION_CRON_BATCH_SIZE },
);

export default crons;
