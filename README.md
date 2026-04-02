# Grandpa's Reading Room

A private MVP reading app for working through Chinese source text alongside an English translation draft.

## What it does

- Imports `.md` and `.txt` files directly in the browser
- Parses markdown headings into reading sections
- Supports `---` inside a section to split Chinese source text from English translation
- Persists the active document and saved vocabulary locally with `localStorage`
- Loads CC-CEDICT from `public/data/cedict.json` for offline word lookup
- Lets you click Chinese words in the reader and save them into a lightweight glossary
- Exports the current document plus saved glossary entries as JSON

## Markdown format

```md
# Chapter One
第一段中文。
第二段中文。
---
First draft of the English translation.

## Chapter Two
另一段中文。
---
Another translation draft.
```

If there are no headings, the importer falls back to blank-line blocks and creates numbered sections.

## Development

```bash
npm install
npm run dev
```

Other useful commands:

```bash
npm run lint
npm run build
```

## Dictionary data

The offline lookup uses a prebuilt CC-CEDICT JSON file at `public/data/cedict.json`.

If you want to rebuild that file from a fresh CC-CEDICT source dump, use the helper script:

```bash
node scripts/build-dict.cjs
```

The current script expects the raw dictionary file at `/tmp/cedict_ts.u8`.
