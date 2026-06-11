export type BibleBookReference = {
  aliases: string[];
  code: string;
  name: string;
  order: number;
  shortName: string;
};

export type ParsedPassageRange = {
  bookCode: string;
  bookName: string;
  bookOrder: number;
  endChapter: number;
  endVerse?: number;
  startChapter: number;
  startVerse?: number;
};

export type ParsedBiblePassage = {
  label: string;
  ranges: ParsedPassageRange[];
  slug: string;
};

export const BIBLE_BOOKS: BibleBookReference[] = [
  book(1, "GEN", "Genesis", "Gen", ["ge", "gn"]),
  book(2, "EXO", "Exodus", "Exod", ["ex", "exo"]),
  book(3, "LEV", "Leviticus", "Lev", ["le", "lv"]),
  book(4, "NUM", "Numbers", "Num", ["nu", "nm", "nb"]),
  book(5, "DEU", "Deuteronomy", "Deut", ["de", "dt"]),
  book(6, "JOS", "Joshua", "Josh", ["jos", "josh"]),
  book(7, "JDG", "Judges", "Judg", ["jdg", "jg", "judg"]),
  book(8, "RUT", "Ruth", "Ruth", ["ru", "rut"]),
  book(9, "1SA", "1 Samuel", "1 Sam", ["1 sam", "1samuel", "1sam", "i samuel", "i sam"]),
  book(10, "2SA", "2 Samuel", "2 Sam", ["2 sam", "2samuel", "2sam", "ii samuel", "ii sam"]),
  book(11, "1KI", "1 Kings", "1 Kgs", ["1 kgs", "1kings", "1kgs", "i kings", "i kgs"]),
  book(12, "2KI", "2 Kings", "2 Kgs", ["2 kgs", "2kings", "2kgs", "ii kings", "ii kgs"]),
  book(13, "1CH", "1 Chronicles", "1 Chr", [
    "1 chr",
    "1chronicles",
    "1chron",
    "i chronicles",
    "i chr",
  ]),
  book(14, "2CH", "2 Chronicles", "2 Chr", [
    "2 chr",
    "2chronicles",
    "2chron",
    "ii chronicles",
    "ii chr",
  ]),
  book(15, "EZR", "Ezra", "Ezra", ["ezr"]),
  book(16, "NEH", "Nehemiah", "Neh", ["ne"]),
  book(17, "EST", "Esther", "Esth", ["est", "esth"]),
  book(18, "JOB", "Job", "Job", []),
  book(19, "PSA", "Psalms", "Ps", ["psalm", "ps", "psa", "pss"]),
  book(20, "PRO", "Proverbs", "Prov", ["pr", "pro", "prov"]),
  book(21, "ECC", "Ecclesiastes", "Eccl", ["ec", "ecc", "eccl", "qoheleth"]),
  book(22, "SNG", "Song of Solomon", "Song", [
    "song",
    "song of songs",
    "solomon's song",
    "songs",
    "sos",
    "canticles",
  ]),
  book(23, "ISA", "Isaiah", "Isa", ["is"]),
  book(24, "JER", "Jeremiah", "Jer", ["je", "jr"]),
  book(25, "LAM", "Lamentations", "Lam", ["la"]),
  book(26, "EZK", "Ezekiel", "Ezek", ["eze", "ezek"]),
  book(27, "DAN", "Daniel", "Dan", ["da", "dn"]),
  book(28, "HOS", "Hosea", "Hos", ["ho"]),
  book(29, "JOL", "Joel", "Joel", ["joe", "jl"]),
  book(30, "AMO", "Amos", "Amos", ["am"]),
  book(31, "OBA", "Obadiah", "Obad", ["ob", "oba"]),
  book(32, "JON", "Jonah", "Jonah", ["jnh"]),
  book(33, "MIC", "Micah", "Mic", ["mi"]),
  book(34, "NAM", "Nahum", "Nah", ["na"]),
  book(35, "HAB", "Habakkuk", "Hab", ["hb"]),
  book(36, "ZEP", "Zephaniah", "Zeph", ["zep"]),
  book(37, "HAG", "Haggai", "Hag", ["hg"]),
  book(38, "ZEC", "Zechariah", "Zech", ["zec"]),
  book(39, "MAL", "Malachi", "Mal", ["ml"]),
  book(40, "MAT", "Matthew", "Matt", ["mt", "mat"]),
  book(41, "MRK", "Mark", "Mark", ["mk", "mrk"]),
  book(42, "LUK", "Luke", "Luke", ["lk", "luk"]),
  book(43, "JHN", "John", "John", ["jn", "jhn"]),
  book(44, "ACT", "Acts", "Acts", ["ac", "act"]),
  book(45, "ROM", "Romans", "Rom", ["ro", "rm"]),
  book(46, "1CO", "1 Corinthians", "1 Cor", [
    "1 cor",
    "1corinthians",
    "1cor",
    "i corinthians",
    "i cor",
  ]),
  book(47, "2CO", "2 Corinthians", "2 Cor", [
    "2 cor",
    "2corinthians",
    "2cor",
    "ii corinthians",
    "ii cor",
  ]),
  book(48, "GAL", "Galatians", "Gal", ["ga"]),
  book(49, "EPH", "Ephesians", "Eph", ["ephes"]),
  book(50, "PHP", "Philippians", "Phil", ["php", "phil"]),
  book(51, "COL", "Colossians", "Col", ["co"]),
  book(52, "1TH", "1 Thessalonians", "1 Thess", [
    "1 thess",
    "1thessalonians",
    "1thess",
    "i thessalonians",
    "i thess",
  ]),
  book(53, "2TH", "2 Thessalonians", "2 Thess", [
    "2 thess",
    "2thessalonians",
    "2thess",
    "ii thessalonians",
    "ii thess",
  ]),
  book(54, "1TI", "1 Timothy", "1 Tim", ["1 tim", "1timothy", "1tim", "i timothy", "i tim"]),
  book(55, "2TI", "2 Timothy", "2 Tim", ["2 tim", "2timothy", "2tim", "ii timothy", "ii tim"]),
  book(56, "TIT", "Titus", "Titus", ["tit"]),
  book(57, "PHM", "Philemon", "Phlm", ["phm", "philem"]),
  book(58, "HEB", "Hebrews", "Heb", ["he"]),
  book(59, "JAS", "James", "Jas", ["jm", "jas"]),
  book(60, "1PE", "1 Peter", "1 Pet", ["1 pet", "1peter", "1pet", "i peter", "i pet"]),
  book(61, "2PE", "2 Peter", "2 Pet", ["2 pet", "2peter", "2pet", "ii peter", "ii pet"]),
  book(62, "1JN", "1 John", "1 John", ["1john", "1 jn", "1jn", "i john", "i jn"]),
  book(63, "2JN", "2 John", "2 John", ["2john", "2 jn", "2jn", "ii john", "ii jn"]),
  book(64, "3JN", "3 John", "3 John", ["3john", "3 jn", "3jn", "iii john", "iii jn"]),
  book(65, "JUD", "Jude", "Jude", ["jud"]),
  book(66, "REV", "Revelation", "Rev", ["re", "rev", "apocalypse"]),
];

const BOOK_ALIASES = BIBLE_BOOKS.flatMap((bookReference) =>
  [
    bookReference.name,
    bookReference.shortName,
    ...bookReference.aliases,
  ].map((alias) => ({
    alias: normalizeBookAlias(alias),
    bookReference,
  })),
).sort((left, right) => right.alias.length - left.alias.length);

export function parseBiblePassageReference(input: string): ParsedBiblePassage | null {
  const segments = splitPassageSegments(input);
  if (segments.length === 0) {
    return null;
  }

  const ranges = segments.map(parsePassageSegment);
  if (ranges.some((range) => range === null)) {
    return null;
  }

  const sortedRanges = (ranges as ParsedPassageRange[]).sort(compareParsedRanges);

  return {
    label: sortedRanges.map(formatParsedRangeLabel).join("; "),
    ranges: sortedRanges,
    slug: sortedRanges.map(formatParsedRangeSlug).join("--"),
  };
}

function book(
  order: number,
  code: string,
  name: string,
  shortName: string,
  aliases: string[],
): BibleBookReference {
  return { aliases, code, name, order, shortName };
}

function splitPassageSegments(input: string) {
  const normalizedInput = input.trim();
  if (!normalizedInput) {
    return [];
  }

  return normalizedInput
    .split(/;|--/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parsePassageSegment(segment: string): ParsedPassageRange | null {
  const normalizedSegment = normalizeSegment(segment);
  const bookMatch = matchBook(normalizedSegment.text);
  if (!bookMatch) {
    return null;
  }

  const range = bookMatch.rest.includes(":")
    ? parseColonRange(bookMatch.rest)
    : parseNumberRange(bookMatch.rest, normalizedSegment.fromSlug);

  if (!range) {
    return null;
  }

  const [startChapter, startVerse, endChapter, endVerse] = range;
  if (
    startChapter < 1 ||
    (startVerse !== undefined && startVerse < 1) ||
    endChapter < 1 ||
    (endVerse !== undefined && endVerse < 1)
  ) {
    return null;
  }

  return {
    bookCode: bookMatch.bookReference.code,
    bookName: bookMatch.bookReference.name,
    bookOrder: bookMatch.bookReference.order,
    endChapter,
    endVerse,
    startChapter,
    startVerse,
  };
}

function normalizeSegment(segment: string) {
  const withoutDecorativeDashes = segment
    .trim()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ");
  const fromSlug =
    /^[a-z0-9-]+$/i.test(withoutDecorativeDashes) &&
    withoutDecorativeDashes.includes("-");

  return {
    fromSlug,
    text: (fromSlug
      ? withoutDecorativeDashes.replace(/-/g, " ")
      : withoutDecorativeDashes
    )
      .replace(/\./g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase(),
  };
}

function normalizeBookAlias(alias: string) {
  return alias
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchBook(segment: string) {
  for (const { alias, bookReference } of BOOK_ALIASES) {
    if (segment === alias) {
      return { bookReference, rest: "" };
    }

    if (segment.startsWith(alias)) {
      const nextCharacter = segment.charAt(alias.length);
      if (!nextCharacter || /[\s\d:-]/.test(nextCharacter)) {
        return {
          bookReference,
          rest: segment.slice(alias.length).trim(),
        };
      }
    }
  }

  return null;
}

function parseColonRange(rest: string): [number, number | undefined, number, number | undefined] | null {
  const match = rest.match(/^(\d+)(?::(\d+))?(?:\s*-\s*(\d+)(?::(\d+))?)?$/);
  if (!match) {
    return null;
  }

  const startChapter = Number(match[1]);
  const startVerse = match[2] === undefined ? undefined : Number(match[2]);
  const rangeEndNumber = match[3] === undefined ? undefined : Number(match[3]);
  const explicitEndVerse = match[4] === undefined ? undefined : Number(match[4]);

  if (rangeEndNumber === undefined) {
    return [startChapter, startVerse, startChapter, startVerse];
  }

  if (startVerse !== undefined && explicitEndVerse === undefined) {
    return [startChapter, startVerse, startChapter, rangeEndNumber];
  }

  return [startChapter, startVerse, rangeEndNumber, explicitEndVerse];
}

function parseNumberRange(
  rest: string,
  fromSlug: boolean,
): [number, number | undefined, number, number | undefined] | null {
  const numbers = rest.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0 || numbers.length > 4) {
    return null;
  }

  if (numbers.length === 1) {
    return [numbers[0], undefined, numbers[0], undefined];
  }

  if (
    (!fromSlug && rest.includes("-") && numbers.length === 2) ||
    (rest.includes(" to ") && numbers.length === 2)
  ) {
    return [numbers[0], undefined, numbers[1], undefined];
  }

  if (numbers.length === 2) {
    return [numbers[0], numbers[1], numbers[0], numbers[1]];
  }

  if (numbers.length === 3) {
    return [numbers[0], numbers[1], numbers[0], numbers[2]];
  }

  return [numbers[0], numbers[1], numbers[2], numbers[3]];
}

function compareParsedRanges(left: ParsedPassageRange, right: ParsedPassageRange) {
  if (left.bookOrder !== right.bookOrder) {
    return left.bookOrder - right.bookOrder;
  }

  if (left.startChapter !== right.startChapter) {
    return left.startChapter - right.startChapter;
  }

  return (left.startVerse ?? 0) - (right.startVerse ?? 0);
}

function formatParsedRangeLabel(range: ParsedPassageRange) {
  const start = formatParsedRangeStart(range);
  if (
    range.startChapter === range.endChapter &&
    range.startVerse === range.endVerse
  ) {
    return start;
  }

  if (range.startVerse === undefined && range.endVerse === undefined) {
    return `${start}-${range.endChapter}`;
  }

  if (range.startChapter === range.endChapter) {
    return `${start}-${range.endVerse}`;
  }

  return `${start}-${range.endChapter}:${range.endVerse}`;
}

function formatParsedRangeStart(range: ParsedPassageRange) {
  if (range.startVerse === undefined) {
    return `${range.bookName} ${range.startChapter}`;
  }

  return `${range.bookName} ${range.startChapter}:${range.startVerse}`;
}

function formatParsedRangeSlug(range: ParsedPassageRange) {
  const parts = [
    range.bookName.toLowerCase().replace(/\s+/g, "-"),
    String(range.startChapter),
  ];

  if (range.startVerse !== undefined) {
    parts.push(String(range.startVerse));
  }

  if (
    range.startChapter !== range.endChapter ||
    range.startVerse !== range.endVerse
  ) {
    if (range.startVerse !== undefined && range.startChapter === range.endChapter) {
      parts.push(String(range.endVerse));
    } else {
      parts.push(range.startVerse === undefined ? "to" : String(range.endChapter));
      if (range.startVerse === undefined) {
        parts.push(String(range.endChapter));
      }
      if (range.startVerse !== undefined && range.endVerse !== undefined) {
        parts.push(String(range.endVerse));
      }
    }
  }

  return parts.join("-");
}
