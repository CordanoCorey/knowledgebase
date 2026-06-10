# Scripture Seed Data

## KJV 1769

- Local source file: `kjv-verses-1769.json`
- Source repository: <https://github.com/farskipper/kjv>
- Source file URL: <https://raw.githubusercontent.com/farskipper/kjv/master/json/verses-1769.json>
- Retrieved: 2026-06-10
- SHA-256: `43FBD2FD6A7AEBAF62C0C828A85072336143C1FE8233A4856A12DB1D5E5DF470`
- Source license/provenance: the source repository describes the KJV JSON as Public Domain and uses the Unlicense. Project Gutenberg also lists its KJV eBook as public domain in the USA.

The source JSON is keyed by verse reference, for example `John 3:16`. Source values use a leading `#` marker for paragraph starts and square brackets for italicized words.

The Convex seed action stores plain verse text, removing the leading paragraph marker and square-bracket italic markers because the current `bibleVerseTexts.text` field does not model rich text or paragraph metadata.

`bible-structure.json` was derived from this source file and the app's canonical book metadata in `convex/lib/scriptureReferences.ts`.
