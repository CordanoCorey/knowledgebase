import { readFileSync, writeFileSync } from "node:fs";

const sourcePath = "data/literature/classical-christian-literature.seed.json";
const outputPath = "data/literature/classical-christian-literature.enrichment.json";
const requestConcurrency = 6;
const maxDescriptionLength = 900;
const maxSubjects = 12;
const userAgent =
  "Logeion local literature seed enrichment (https://openai.com/codex)";

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const works = source.works;
const authorCache = new Map();
let completedWorks = 0;

console.log(`Enriching ${works.length} seeded literature referents`);

const enrichedEntries = await mapWithConcurrency(
  works,
  requestConcurrency,
  async (work) => {
    const enrichment = await enrichWork(work);
    completedWorks += 1;
    if (completedWorks % 25 === 0 || completedWorks === works.length) {
      console.log(`Enriched ${completedWorks}/${works.length}`);
    }
    return [work.canonicalKey, enrichment];
  },
);

const enrichedWorks = Object.fromEntries(enrichedEntries);
const uniqueAuthorDetails = new Map();
for (const work of Object.values(enrichedWorks)) {
  for (const authorReference of work.authorReferences ?? []) {
    uniqueAuthorDetails.set(authorReference.canonicalKey, authorReference);
  }
}

const metadata = {
  schemaVersion: 1,
  generatedDate: new Date().toISOString().slice(0, 10),
  sourceFile: sourcePath,
  publicSources: [
    {
      name: "Open Library",
      url: "https://openlibrary.org",
      usage: "Work search, work details, cover IDs, author search, and author details.",
    },
    {
      name: "Wikipedia",
      url: "https://www.wikipedia.org",
      usage: "Page summaries and thumbnails for works and authors when confidently matched.",
    },
  ],
  counts: getCounts(enrichedWorks, uniqueAuthorDetails),
};

writeFileSync(
  outputPath,
  `${JSON.stringify({ metadata, works: enrichedWorks }, null, 2)}\n`,
);

console.log(`Wrote ${outputPath}`);
console.log(JSON.stringify(metadata.counts, null, 2));

async function enrichWork(work) {
  const parsedAuthors = parseSeedAuthors(work.detail.author);
  const openLibraryWork = await getOpenLibraryWorkMetadata(work, parsedAuthors);
  const wikipediaWork =
    openLibraryWork.description && openLibraryWork.thumbnailUrl
      ? {}
      : await getWikipediaWorkMetadata(work, parsedAuthors);
  const description =
    openLibraryWork.description ?? wikipediaWork.description ?? null;
  const thumbnailUrl =
    openLibraryWork.thumbnailUrl ?? wikipediaWork.thumbnailUrl ?? null;
  const descriptionSource = description
    ? openLibraryWork.description === description
      ? openLibraryWork
      : wikipediaWork.description === description
        ? wikipediaWork
        : null
    : null;
  const thumbnailSource = thumbnailUrl
    ? openLibraryWork.thumbnailUrl === thumbnailUrl
      ? openLibraryWork
      : wikipediaWork.thumbnailUrl === thumbnailUrl
        ? wikipediaWork
        : null
    : null;

  return pruneNullish({
    description,
    descriptionSourceName: descriptionSource?.sourceName ?? null,
    descriptionSourceUrl: descriptionSource?.sourceUrl ?? null,
    openLibraryCoverId: openLibraryWork.openLibraryCoverId ?? null,
    openLibraryWorkKey: openLibraryWork.openLibraryWorkKey ?? null,
    subjects: mergeUniqueStrings(
      openLibraryWork.subjects ?? [],
      wikipediaWork.subjects ?? [],
    ).slice(0, maxSubjects),
    thumbnailSourceName: thumbnailSource?.sourceName ?? null,
    thumbnailSourceUrl: thumbnailSource?.sourceUrl ?? null,
    thumbnailUrl,
    wikipediaTitle: wikipediaWork.wikipediaTitle ?? null,
    authorReferences: await enrichAuthorReferences(
      parsedAuthors,
      openLibraryWork.authorReferences ?? [],
    ),
  });
}

async function getOpenLibraryWorkMetadata(work, parsedAuthors) {
  const authorQuery = parsedAuthors[0]?.name ?? work.detail.author ?? "";
  const searchUrl = new URL("https://openlibrary.org/search.json");
  searchUrl.searchParams.set("title", work.title);
  if (authorQuery) {
    searchUrl.searchParams.set("author", authorQuery);
  }
  searchUrl.searchParams.set(
    "fields",
    [
      "author_key",
      "author_name",
      "cover_i",
      "first_publish_year",
      "key",
      "publisher",
      "subject",
      "title",
    ].join(","),
  );
  searchUrl.searchParams.set("limit", "8");

  const search = await fetchJson(searchUrl);
  const docs = Array.isArray(search?.docs) ? search.docs : [];
  const bestDoc = docs
    .map((doc) => ({
      doc,
      score: scoreOpenLibraryWorkDoc(doc, work, parsedAuthors),
    }))
    .filter((candidate) => candidate.score >= 72)
    .sort((left, right) => right.score - left.score)[0]?.doc;

  if (!bestDoc || typeof bestDoc.key !== "string") {
    return {};
  }

  const workDetails = await fetchJson(`https://openlibrary.org${bestDoc.key}.json`);
  const description = normalizeDescription(
    extractOpenLibraryDescription(workDetails?.description) ??
      extractOpenLibraryDescription(workDetails?.first_sentence),
  );
  const subjects = mergeUniqueStrings(
    Array.isArray(workDetails?.subjects) ? workDetails.subjects : [],
    Array.isArray(bestDoc.subject) ? bestDoc.subject : [],
  ).slice(0, maxSubjects);
  const coverId =
    typeof bestDoc.cover_i === "number" || typeof bestDoc.cover_i === "string"
      ? String(bestDoc.cover_i)
      : Array.isArray(workDetails?.covers) &&
          (typeof workDetails.covers[0] === "number" ||
            typeof workDetails.covers[0] === "string")
        ? String(workDetails.covers[0])
        : null;
  const sourceUrl = `https://openlibrary.org${bestDoc.key}`;

  return {
    authorReferences: getOpenLibraryAuthorReferences(bestDoc),
    description,
    openLibraryCoverId: coverId,
    openLibraryWorkKey: bestDoc.key,
    sourceName: "Open Library",
    sourceUrl,
    subjects,
    thumbnailUrl: coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : null,
  };
}

async function getWikipediaWorkMetadata(work, parsedAuthors) {
  const authorName = parsedAuthors[0]?.name ?? "";
  const typeHint = getWorkTypeHint(work.knowledgeType);
  const searchQuery = [work.title, authorName, typeHint]
    .filter(Boolean)
    .join(" ");
  const summary = await findWikipediaSummary(searchQuery, (candidate) =>
    scoreWikipediaWorkSummary(candidate, work, parsedAuthors),
  );
  if (!summary) {
    return {};
  }

  return {
    description: normalizeDescription(summary.extract),
    sourceName: "Wikipedia",
    sourceUrl: summary.content_urls?.desktop?.page ?? summary.content_urls?.mobile?.page,
    subjects: [summary.description].filter(
      (value) => typeof value === "string" && value.trim() !== "",
    ),
    thumbnailUrl: summary.thumbnail?.source ?? null,
    wikipediaTitle: summary.title,
  };
}

async function enrichAuthorReferences(parsedAuthors, openLibraryAuthorReferences) {
  const references = [];
  for (const author of parsedAuthors) {
    const openLibraryMatch = openLibraryAuthorReferences.find((candidate) =>
      isSameAuthorName(candidate.name, author.name),
    );
    const authorForEnrichment = {
      ...author,
      ...(openLibraryMatch?.openLibraryAuthorKey
        ? { openLibraryAuthorKey: openLibraryMatch.openLibraryAuthorKey }
        : {}),
    };
    const detail = await enrichAuthor(authorForEnrichment);
    references.push({
      canonicalKey: author.canonicalKey,
      detail: {
        ...detail,
        ...(openLibraryMatch?.openLibraryAuthorKey &&
        !detail.openLibraryAuthorKey
          ? { openLibraryAuthorKey: openLibraryMatch.openLibraryAuthorKey }
          : {}),
      },
      name: author.name,
      role: author.role,
    });
  }

  return references;
}

async function enrichAuthor(author) {
  if (authorCache.has(author.canonicalKey)) {
    return authorCache.get(author.canonicalKey);
  }

  const [wikipediaAuthor, openLibraryAuthor] = await Promise.all([
    getWikipediaAuthorMetadata(author.name),
    getOpenLibraryAuthorMetadata(author),
  ]);
  const detail = pruneNullish({
    birthDate: openLibraryAuthor.birthDate ?? null,
    deathDate: openLibraryAuthor.deathDate ?? null,
    description:
      wikipediaAuthor.description ?? openLibraryAuthor.description ?? null,
    descriptionSourceName:
      wikipediaAuthor.description != null
        ? wikipediaAuthor.sourceName
        : openLibraryAuthor.description != null
          ? openLibraryAuthor.sourceName
          : null,
    descriptionSourceUrl:
      wikipediaAuthor.description != null
        ? wikipediaAuthor.sourceUrl
        : openLibraryAuthor.description != null
          ? openLibraryAuthor.sourceUrl
          : null,
    openLibraryAuthorKey: openLibraryAuthor.openLibraryAuthorKey ?? null,
    subjects: mergeUniqueStrings(
      wikipediaAuthor.subjects ?? [],
      openLibraryAuthor.subjects ?? [],
    ).slice(0, maxSubjects),
    thumbnailSourceName:
      wikipediaAuthor.thumbnailUrl != null
        ? wikipediaAuthor.sourceName
        : openLibraryAuthor.thumbnailUrl != null
          ? openLibraryAuthor.sourceName
          : null,
    thumbnailSourceUrl:
      wikipediaAuthor.thumbnailUrl != null
        ? wikipediaAuthor.sourceUrl
        : openLibraryAuthor.thumbnailUrl != null
          ? openLibraryAuthor.sourceUrl
          : null,
    thumbnailUrl: wikipediaAuthor.thumbnailUrl ?? openLibraryAuthor.thumbnailUrl ?? null,
    wikipediaTitle: wikipediaAuthor.wikipediaTitle ?? null,
  });

  authorCache.set(author.canonicalKey, detail);
  return detail;
}

async function getWikipediaAuthorMetadata(name) {
  const summary = await findWikipediaSummary(name, (candidate) =>
    scoreWikipediaAuthorSummary(candidate, name),
  );
  if (!summary) {
    return {};
  }

  return {
    description: normalizeDescription(summary.extract),
    sourceName: "Wikipedia",
    sourceUrl: summary.content_urls?.desktop?.page ?? summary.content_urls?.mobile?.page,
    subjects: [summary.description].filter(
      (value) => typeof value === "string" && value.trim() !== "",
    ),
    thumbnailUrl: summary.thumbnail?.source ?? null,
    wikipediaTitle: summary.title,
  };
}

async function getOpenLibraryAuthorMetadata(author) {
  const key = author.openLibraryAuthorKey ?? (await searchOpenLibraryAuthorKey(author.name));
  if (!key) {
    return {};
  }

  const details = await fetchJson(`https://openlibrary.org/authors/${key}.json`);
  const description = normalizeDescription(extractOpenLibraryDescription(details?.bio));
  const photoId =
    Array.isArray(details?.photos) &&
    (typeof details.photos[0] === "number" || typeof details.photos[0] === "string")
      ? String(details.photos[0])
      : null;

  return {
    birthDate: normalizeText(details?.birth_date),
    deathDate: normalizeText(details?.death_date),
    description,
    openLibraryAuthorKey: key,
    sourceName: "Open Library",
    sourceUrl: `https://openlibrary.org/authors/${key}`,
    subjects: [],
    thumbnailUrl: photoId
      ? `https://covers.openlibrary.org/a/id/${photoId}-L.jpg`
      : null,
  };
}

async function searchOpenLibraryAuthorKey(name) {
  const searchUrl = new URL("https://openlibrary.org/search/authors.json");
  searchUrl.searchParams.set("q", name);
  searchUrl.searchParams.set("limit", "5");
  const search = await fetchJson(searchUrl);
  const docs = Array.isArray(search?.docs) ? search.docs : [];
  const bestDoc = docs
    .map((doc) => ({ doc, score: scoreOpenLibraryAuthorDoc(doc, name) }))
    .filter((candidate) => candidate.score >= 70)
    .sort((left, right) => right.score - left.score)[0]?.doc;

  return typeof bestDoc?.key === "string" ? bestDoc.key : null;
}

async function findWikipediaSummary(searchQuery, scoreSummary) {
  const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("list", "search");
  searchUrl.searchParams.set("srlimit", "5");
  searchUrl.searchParams.set("srsearch", searchQuery);
  const search = await fetchJson(searchUrl);
  const candidates = Array.isArray(search?.query?.search)
    ? search.query.search
    : [];
  const summaries = [];

  for (const candidate of candidates) {
    if (typeof candidate.title !== "string") {
      continue;
    }
    const summary = await fetchJson(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        candidate.title.replace(/\s+/g, "_"),
      )}`,
    );
    if (!summary || summary.type === "disambiguation") {
      continue;
    }
    summaries.push({
      score: scoreSummary(summary),
      summary,
    });
  }

  return summaries
    .filter((candidate) => candidate.score >= 70)
    .sort((left, right) => right.score - left.score)[0]?.summary;
}

function scoreOpenLibraryWorkDoc(doc, work, parsedAuthors) {
  const titleScore = scoreTitleMatch(doc?.title, work.title);
  if (titleScore === 0) {
    return 0;
  }

  const authorNames = Array.isArray(doc?.author_name) ? doc.author_name : [];
  const authorScore =
    parsedAuthors.length === 0
      ? 12
      : parsedAuthors.some((author) =>
          authorNames.some(
            (candidate) =>
              normalizeComparableText(candidate) ===
                normalizeComparableText(author.name) ||
              normalizeComparableText(candidate).includes(
                normalizeComparableText(author.name),
              ) ||
              normalizeComparableText(author.name).includes(
                normalizeComparableText(candidate),
              ),
          ),
        )
        ? 36
        : 0;

  return titleScore + authorScore + (doc?.cover_i ? 8 : 0);
}

function scoreOpenLibraryAuthorDoc(doc, name) {
  const comparableName = normalizeComparableText(name);
  const comparableDocName = normalizeComparableText(doc?.name ?? "");
  if (comparableDocName === comparableName) {
    return 100;
  }
  if (
    comparableDocName.includes(comparableName) ||
    comparableName.includes(comparableDocName)
  ) {
    return 80;
  }
  return 0;
}

function scoreWikipediaWorkSummary(summary, work, parsedAuthors) {
  if (!isWorkLikeWikipediaSummary(summary)) {
    return 0;
  }

  const titleScore = scoreTitleMatch(summary.title, work.title);
  if (titleScore === 0) {
    return 0;
  }

  const authorScore =
    parsedAuthors.length === 0
      ? 8
      : parsedAuthors.some((author) =>
          normalizeComparableText(
            `${summary.description ?? ""} ${summary.extract ?? ""}`,
          ).includes(normalizeComparableText(author.name)),
        )
        ? 24
        : 0;

  return titleScore + authorScore + (summary.thumbnail?.source ? 8 : 0);
}

function scoreWikipediaAuthorSummary(summary, name) {
  const titleScore = scoreTitleMatch(summary.title, name);
  if (titleScore === 0) {
    return 0;
  }

  const description = normalizeComparableText(summary.description ?? "");
  const extract = normalizeComparableText(summary.extract ?? "");
  if (
    description.includes("disambiguation") ||
    description.includes("fictional") ||
    extract.includes("may refer to")
  ) {
    return 0;
  }

  return titleScore + (summary.thumbnail?.source ? 8 : 0);
}

function scoreTitleMatch(candidateTitle, expectedTitle) {
  const candidate = normalizeComparableTitle(candidateTitle ?? "");
  const expected = normalizeComparableTitle(expectedTitle);
  if (!candidate || !expected) {
    return 0;
  }
  if (candidate === expected) {
    return 90;
  }
  if (candidate.startsWith(`${expected} `) || candidate.includes(` ${expected} `)) {
    return 72;
  }
  return 0;
}

function isWorkLikeWikipediaSummary(summary) {
  const text = normalizeComparableText(
    `${summary.title ?? ""} ${summary.description ?? ""} ${summary.extract ?? ""}`,
  );
  return [
    "adventure",
    "allegory",
    "anthology",
    "book",
    "children s",
    "collection",
    "comedy",
    "essay",
    "fable",
    "fairy tale",
    "hymn",
    "literary",
    "novel",
    "play",
    "poem",
    "poetry",
    "short story",
    "song",
    "tragedy",
  ].some((term) => text.includes(term));
}

function getOpenLibraryAuthorReferences(doc) {
  const names = Array.isArray(doc?.author_name) ? doc.author_name : [];
  const keys = Array.isArray(doc?.author_key) ? doc.author_key : [];
  return names
    .map((name, index) => ({
      canonicalKey: normalizeCanonicalKey(name),
      name: normalizeText(name),
      openLibraryAuthorKey:
        typeof keys[index] === "string" ? keys[index] : undefined,
      role: "author",
    }))
    .filter((author) => author.name && author.canonicalKey);
}

function parseSeedAuthors(author) {
  if (!author || isSkippedAuthorName(author)) {
    return [];
  }

  const role = inferAuthorRole(author);
  const cleanedAuthor = author
    .replace(/\banonymous\b/gi, "")
    .replace(/\((?:editor|editors|translator|compiler|illustrator)\)/gi, "")
    .replace(/\b(?:editor|editors|translator|compiler|illustrator)\b/gi, "")
    .replace(/\btrans\.\s*/gi, "")
    .replace(/\btranslated by\s*/gi, "")
    .trim();

  return splitAuthorNames(cleanedAuthor)
    .filter((name) => !isSkippedAuthorName(name))
    .map((name) => ({
      canonicalKey: normalizeCanonicalKey(name),
      name,
      role,
    }))
    .filter((author) => author.canonicalKey);
}

function splitAuthorNames(author) {
  if (/^brothers grimm$/i.test(author.trim())) {
    return ["Jacob Grimm", "Wilhelm Grimm"];
  }

  const parinMatch = /^ingri\s+(?:&|and)\s+edgar parin d['’]aulaire$/i.exec(
    author.trim(),
  );
  if (parinMatch) {
    return ["Ingri d'Aulaire", "Edgar Parin d'Aulaire"];
  }

  return author
    .replace(/\s*\/\s*/g, ";")
    .replace(/\s*&\s*/g, " and ")
    .split(/\s*;\s*|\s+\band\b\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function inferAuthorRole(author) {
  const normalizedAuthor = author.toLowerCase();
  if (normalizedAuthor.includes("editor")) {
    return "editor";
  }
  if (normalizedAuthor.includes("translator")) {
    return "translator";
  }
  if (/\btrans\./i.test(author) || normalizedAuthor.includes("translated by")) {
    return "translator";
  }
  if (normalizedAuthor.includes("compiler")) {
    return "compiler";
  }
  if (normalizedAuthor.includes("illustrator")) {
    return "illustrator";
  }
  return "author";
}

function isSkippedAuthorName(author) {
  const normalizedAuthor = author.trim().toLowerCase();
  return (
    normalizedAuthor === "" ||
    normalizedAuthor === "anonymous" ||
    normalizedAuthor === "unknown" ||
    normalizedAuthor === "various" ||
    normalizedAuthor === "various authors" ||
    normalizedAuthor === "traditional" ||
    normalizedAuthor.includes("folklore") ||
    normalizedAuthor.includes("mythology") ||
    normalizedAuthor.includes("public domain")
  );
}

async function fetchJson(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": userAgent,
        },
      });
      if (response.status === 429 || response.status >= 500) {
        await delay(750 * (attempt + 1));
        continue;
      }
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch {
      await delay(500 * (attempt + 1));
    }
  }

  return null;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    for (;;) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker(),
    ),
  );
  return results;
}

function getCounts(enrichedWorks, uniqueAuthorDetails) {
  const works = Object.values(enrichedWorks);
  const authors = Array.from(uniqueAuthorDetails.values());
  return {
    authorReferenceCount: works.reduce(
      (count, work) => count + (work.authorReferences?.length ?? 0),
      0,
    ),
    uniqueAuthorCount: authors.length,
    uniqueAuthorsWithDescription: authors.filter(
      (author) => author.detail?.description,
    ).length,
    uniqueAuthorsWithThumbnail: authors.filter(
      (author) => author.detail?.thumbnailUrl,
    ).length,
    workCount: works.length,
    worksWithDescription: works.filter((work) => work.description).length,
    worksWithThumbnail: works.filter((work) => work.thumbnailUrl).length,
  };
}

function extractOpenLibraryDescription(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && typeof value.value === "string") {
    return value.value;
  }
  return null;
}

function normalizeDescription(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  return limitString(text.replace(/\[\d+\]/g, ""), maxDescriptionLength);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : null;
}

function normalizeCanonicalKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeComparableTitle(value) {
  return normalizeComparableText(value)
    .replace(/\([^)]*\)/g, "")
    .replace(/^(the|a|an) /, "")
    .trim();
}

function normalizeComparableText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSameAuthorName(left, right) {
  const comparableLeft = normalizeComparableText(left);
  const comparableRight = normalizeComparableText(right);
  return (
    comparableLeft === comparableRight ||
    comparableLeft.includes(comparableRight) ||
    comparableRight.includes(comparableLeft)
  );
}

function mergeUniqueStrings(...groups) {
  const byComparable = new Map();
  for (const group of groups) {
    for (const value of group) {
      const text = normalizeText(value);
      const key = normalizeComparableText(text ?? "");
      if (text && key && !byComparable.has(key)) {
        byComparable.set(key, text);
      }
    }
  }

  return Array.from(byComparable.values());
}

function pruneNullish(object) {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) =>
        value !== undefined &&
        !(Array.isArray(value) && value.length === 0),
    ),
  );
}

function getWorkTypeHint(knowledgeType) {
  if (knowledgeType === "shortStory") {
    return "short story";
  }
  return knowledgeType;
}

function limitString(value, maxLength) {
  return value.length <= maxLength ? value : value.slice(0, maxLength).trim();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
