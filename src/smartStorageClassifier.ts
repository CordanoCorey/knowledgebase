import {
  AUTHORABLE_KNOWLEDGE_TYPES,
  formatKnowledgeTypeLabel,
  type ActiveTag,
  type AuthorableKnowledgeType,
} from "./knowledgeContracts";
import { NAVIGATOR_TAG_FIXTURES } from "./knowledgeContext";

export type SmartStorageSourceKind =
  | "pastedText"
  | "uploadedFile"
  | "externalUrl"
  | "manualEntry";

export type SmartStoragePredictionEntry = {
  confidence: number;
  id: string;
  knowledgeType: AuthorableKnowledgeType;
  reason: string;
  signals: string[];
  sourceExcerpt: string;
  title: string;
};

export type SmartStoragePrediction = {
  detectedContextTags: ActiveTag[];
  detectedSignals: string[];
  entries: SmartStoragePredictionEntry[];
  primaryEntry?: SmartStoragePredictionEntry;
  sourceSummary: string;
};

type SmartStoragePredictionInput = {
  fileName?: string;
  sourceKind: SmartStorageSourceKind;
  text: string;
};

type ScoreBucket = {
  signals: string[];
  value: number;
};

const AUTHORABLE_TYPE_SET = new Set<AuthorableKnowledgeType>(
  AUTHORABLE_KNOWLEDGE_TYPES,
);

const TYPE_KEYWORDS: Record<AuthorableKnowledgeType, string[]> = {
  words: ["note", "memo", "reflection", "thought"],
  topic: ["topic", "theme", "doctrine", "concept", "about"],
  series: ["series", "unit", "part 1", "week 1", "sequence"],
  question: ["question", "why", "how", "what", "who", "when", "where"],
  quote: ["quote", "quoted", "excerpt", "citation", "said"],
  sermon: ["sermon", "preached", "homily", "text:", "main point"],
  essay: ["essay", "thesis", "argument", "introduction", "conclusion"],
  poem: ["poem", "stanza", "line break"],
  song: ["song", "lyrics", "chorus", "verse", "bridge"],
  book: ["book", "isbn", "chapter", "publisher"],
  shortStory: ["short story", "scene", "dialogue", "narrator"],
  lesson: ["lesson", "objective", "materials", "assignment", "discussion"],
  comment: ["comment", "reply", "response", "feedback"],
  prayerRequest: ["prayer", "please pray", "pray for", "healing"],
  event: ["event", "calendar", "location", "date", "time"],
  rsvp: ["rsvp", "attending", "decline", "yes", "no", "maybe"],
  person: ["person", "bio", "born", "died", "email"],
  organization: ["organization", "church", "school", "academy", "ministry"],
  group: ["group", "class", "team", "committee", "cohort"],
  place: ["place", "address", "room", "city", "sanctuary"],
};

const FILE_NAME_TYPE_HINTS: Array<{
  pattern: RegExp;
  signal: string;
  type: AuthorableKnowledgeType;
}> = [
  { pattern: /\blesson\b/i, signal: "file name says lesson", type: "lesson" },
  { pattern: /\bsermon\b/i, signal: "file name says sermon", type: "sermon" },
  { pattern: /\bessay\b/i, signal: "file name says essay", type: "essay" },
  { pattern: /\bpoem\b/i, signal: "file name says poem", type: "poem" },
  { pattern: /\bsong|lyrics\b/i, signal: "file name says song", type: "song" },
  { pattern: /\bquote|excerpt\b/i, signal: "file name says quote", type: "quote" },
  { pattern: /\bprayer\b/i, signal: "file name says prayer", type: "prayerRequest" },
  { pattern: /\bevent|calendar|agenda\b/i, signal: "file name says event", type: "event" },
  { pattern: /\brsvp\b/i, signal: "file name says RSVP", type: "rsvp" },
];

export function predictSmartStorageEntries({
  fileName,
  sourceKind,
  text,
}: SmartStoragePredictionInput): SmartStoragePrediction {
  const sourceText = text.trim();
  if (!sourceText && !fileName) {
    return {
      detectedContextTags: [],
      detectedSignals: [],
      entries: [],
      sourceSummary: "No source staged",
    };
  }

  const scores = createScoreBuckets();
  const lowerText = sourceText.toLowerCase();
  const detectedContextTags = detectContextTags(sourceText);

  add(scores, "words", 0.18, "raw source can always become Words");
  scoreFileName(scores, fileName);
  scoreKeywordMatches(scores, lowerText);
  scoreTextShape(scores, sourceText);
  scoreKnownContext(scores, detectedContextTags);

  const baseTitle = inferBaseTitle(sourceText, fileName);
  const detectedSignals = collectDetectedSignals(scores);
  const entries = Array.from(scores.entries())
    .filter(([, bucket]) => bucket.value >= 0.34)
    .sort(compareScores)
    .slice(0, 4)
    .map(([knowledgeType, bucket]) =>
      createPredictionEntry({
        baseTitle,
        bucket,
        knowledgeType,
        sourceText,
      }),
    );

  const finalEntries =
    entries.length > 0
      ? entries
      : [
          createPredictionEntry({
            baseTitle,
            bucket: scores.get("words") ?? {
              signals: ["fallback type for unclassified source"],
              value: 0.18,
            },
            knowledgeType: "words",
            sourceText,
          }),
        ];

  return {
    detectedContextTags,
    detectedSignals,
    entries: finalEntries,
    primaryEntry: finalEntries[0],
    sourceSummary: summarizeSource(sourceText, fileName, sourceKind),
  };
}

function createScoreBuckets() {
  return new Map<AuthorableKnowledgeType, ScoreBucket>(
    AUTHORABLE_KNOWLEDGE_TYPES.map((knowledgeType) => [
      knowledgeType,
      { signals: [], value: 0 },
    ]),
  );
}

function scoreFileName(
  scores: Map<AuthorableKnowledgeType, ScoreBucket>,
  fileName?: string,
) {
  if (!fileName) {
    return;
  }

  for (const hint of FILE_NAME_TYPE_HINTS) {
    if (hint.pattern.test(fileName)) {
      add(scores, hint.type, 0.38, hint.signal);
    }
  }

  if (/\.(ics|ical)$/i.test(fileName)) {
    add(scores, "event", 0.72, "calendar file extension");
  }

  if (/\.(mp3|m4a|wav|mp4|mov)$/i.test(fileName)) {
    add(scores, "sermon", 0.28, "media upload often represents a sermon or teaching");
  }
}

function scoreKeywordMatches(
  scores: Map<AuthorableKnowledgeType, ScoreBucket>,
  lowerText: string,
) {
  for (const knowledgeType of AUTHORABLE_KNOWLEDGE_TYPES) {
    const matches = TYPE_KEYWORDS[knowledgeType].filter((keyword) =>
      lowerText.includes(keyword),
    );
    if (matches.length > 0) {
      add(
        scores,
        knowledgeType,
        Math.min(0.16 * matches.length, 0.54),
        `mentions ${matches.slice(0, 3).join(", ")}`,
      );
    }
  }
}

function scoreTextShape(
  scores: Map<AuthorableKnowledgeType, ScoreBucket>,
  sourceText: string,
) {
  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lowerText = sourceText.toLowerCase();

  if (/\?/.test(sourceText) || /^(who|what|when|where|why|how)\b/i.test(sourceText)) {
    add(scores, "question", 0.52, "question-shaped text");
  }

  if (/"[^"]{12,}"/.test(sourceText) || lines.some((line) => line.startsWith(">"))) {
    add(scores, "quote", 0.62, "quoted or excerpted text");
  }

  if (/\b(objective|materials|activity|homework|assessment)\b/i.test(sourceText)) {
    add(scores, "lesson", 0.62, "lesson-plan fields");
  }

  if (/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(sourceText)) {
    add(scores, "event", 0.22, "weekday mentioned");
  }

  if (/\b\d{1,2}:\d{2}\s?(am|pm)?\b/i.test(sourceText)) {
    add(scores, "event", 0.42, "specific time mentioned");
  }

  if (/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(sourceText)) {
    add(scores, "event", 0.34, "specific date mentioned");
  }

  if (/\b(yes|no|maybe),?\s+i (can|will|cannot|can't|am|am not)\b/i.test(sourceText)) {
    add(scores, "rsvp", 0.58, "attendance response");
  }

  if (/\bplease pray\b|\bpray for\b|\bprayer request\b/i.test(sourceText)) {
    add(scores, "prayerRequest", 0.7, "direct prayer request language");
  }

  if (lines.length >= 4 && averageLineLength(lines) < 54) {
    add(scores, "poem", 0.24, "short line-broken form");
  }

  if (/\b(chorus|bridge|verse 1|verse 2)\b/i.test(sourceText)) {
    add(scores, "song", 0.64, "song section labels");
  }

  if (/\b(thesis|therefore|in conclusion)\b/i.test(sourceText)) {
    add(scores, "essay", 0.44, "argument essay structure");
  }

  if (/\b(isbn|publisher|chapter \d+)\b/i.test(sourceText)) {
    add(scores, "book", 0.5, "book metadata");
  }

  if (/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(sourceText) && /\b(bio|born|email)\b/i.test(sourceText)) {
    add(scores, "person", 0.48, "person profile details");
  }

  if (/\b(church|academy|school|ministry|inc\.|llc)\b/i.test(sourceText)) {
    add(scores, "organization", 0.42, "organization naming language");
  }

  if (/\b(class|team|committee|cohort|small group)\b/i.test(sourceText)) {
    add(scores, "group", 0.38, "group membership language");
  }

  if (/\b(room|sanctuary|campus|street|avenue|road|city)\b/i.test(sourceText)) {
    add(scores, "place", 0.34, "place or address language");
  }

  if (lowerText.length > 1200 && (scores.get("essay")?.value ?? 0) < 0.4) {
    add(scores, "essay", 0.22, "long-form prose");
  }
}

function scoreKnownContext(
  scores: Map<AuthorableKnowledgeType, ScoreBucket>,
  detectedContextTags: ActiveTag[],
) {
  for (const tag of detectedContextTags) {
    if (AUTHORABLE_TYPE_SET.has(tag.knowledgeType as AuthorableKnowledgeType)) {
      add(
        scores,
        tag.knowledgeType as AuthorableKnowledgeType,
        0.18,
        `mentions known ${formatKnowledgeTypeLabel(tag.knowledgeType)} Tag`,
      );
    }
  }
}

function createPredictionEntry({
  baseTitle,
  bucket,
  knowledgeType,
  sourceText,
}: {
  baseTitle: string;
  bucket: ScoreBucket;
  knowledgeType: AuthorableKnowledgeType;
  sourceText: string;
}): SmartStoragePredictionEntry {
  return {
    confidence: normalizeConfidence(bucket.value),
    id: `${knowledgeType}:${slugify(baseTitle)}`,
    knowledgeType,
    reason:
      bucket.signals.slice(0, 2).join("; ") ||
      "fallback type for unclassified source",
    signals: bucket.signals.slice(0, 5),
    sourceExcerpt: getSourceExcerpt(sourceText, knowledgeType),
    title: formatEntryTitle(knowledgeType, baseTitle, sourceText),
  };
}

function add(
  scores: Map<AuthorableKnowledgeType, ScoreBucket>,
  knowledgeType: AuthorableKnowledgeType,
  amount: number,
  signal: string,
) {
  const bucket = scores.get(knowledgeType);
  if (!bucket) {
    return;
  }

  bucket.value += amount;
  if (!bucket.signals.includes(signal)) {
    bucket.signals.push(signal);
  }
}

function compareScores(
  [leftType, leftBucket]: [AuthorableKnowledgeType, ScoreBucket],
  [rightType, rightBucket]: [AuthorableKnowledgeType, ScoreBucket],
) {
  return (
    rightBucket.value - leftBucket.value ||
    AUTHORABLE_KNOWLEDGE_TYPES.indexOf(leftType) -
      AUTHORABLE_KNOWLEDGE_TYPES.indexOf(rightType)
  );
}

function normalizeConfidence(score: number) {
  return Math.min(0.97, Math.max(0.28, Math.round((0.32 + score / 1.7) * 100) / 100));
}

function inferBaseTitle(sourceText: string, fileName?: string) {
  const fileTitle = fileName ? fileName.replace(/\.[^.]+$/, "") : "";
  const firstLine =
    sourceText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "";

  const title = firstLine || fileTitle || "Untitled Source";
  return limitText(title.replace(/^#+\s*/, ""), 82);
}

function formatEntryTitle(
  knowledgeType: AuthorableKnowledgeType,
  baseTitle: string,
  sourceText: string,
) {
  if (knowledgeType === "quote") {
    const quotedText = /"([^"]{12,})"/.exec(sourceText)?.[1];
    return limitText(`Quote: ${quotedText ?? baseTitle}`, 82);
  }

  if (knowledgeType === "question") {
    const question = sourceText
      .split(/\r?\n|(?<=\?)\s+/)
      .map((line) => line.trim())
      .find((line) => line.includes("?"));
    return limitText(question ?? baseTitle, 82);
  }

  if (knowledgeType === "prayerRequest") {
    return limitText(
      baseTitle.toLowerCase().includes("prayer")
        ? baseTitle
        : `Prayer Request: ${baseTitle}`,
      82,
    );
  }

  return baseTitle;
}

function getSourceExcerpt(sourceText: string, knowledgeType: AuthorableKnowledgeType) {
  if (knowledgeType === "quote") {
    const quotedText = /"([^"]{12,})"/.exec(sourceText)?.[1];
    if (quotedText) {
      return limitText(quotedText, 180);
    }
  }

  return limitText(sourceText.replace(/\s+/g, " ").trim(), 180);
}

function detectContextTags(sourceText: string) {
  const lowerText = sourceText.toLowerCase();
  return NAVIGATOR_TAG_FIXTURES.filter((tag) => {
    const label = tag.label.toLowerCase();
    return lowerText.includes(label) || lowerText.includes(tag.id);
  }).slice(0, 6);
}

function collectDetectedSignals(scores: Map<AuthorableKnowledgeType, ScoreBucket>) {
  return Array.from(scores.values())
    .flatMap((bucket) => bucket.signals)
    .slice(0, 8);
}

function summarizeSource(
  sourceText: string,
  fileName: string | undefined,
  sourceKind: SmartStorageSourceKind,
) {
  const wordCount = sourceText ? sourceText.split(/\s+/).filter(Boolean).length : 0;
  const sourceLabel = fileName ?? (sourceKind === "uploadedFile" ? "uploaded file" : "typed source");
  return `${wordCount} ${wordCount === 1 ? "word" : "words"} from ${sourceLabel}`;
}

function averageLineLength(lines: string[]) {
  return (
    lines.reduce((totalLength, line) => totalLength + line.length, 0) /
    Math.max(lines.length, 1)
  );
}

function limitText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "source";
}
