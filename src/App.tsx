import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from 'react'
import './App.css'
import { sampleDocument } from './data/sampleDocument'
import {
  importReaderDocumentFromFile,
  parseReaderDocument,
} from './lib/document'
import {
  loadCedictDictionary,
  lookupWord,
  tokenizeReaderText,
  type DictionaryEntry,
  type ReaderToken,
} from './lib/dictionary'
import type { ReaderDocument, ReaderSection, SavedWord } from './lib/reader-types'
import {
  createSavedWord,
  loadReaderDocument,
  loadSavedWords,
  removeSavedWord,
  saveReaderDocument,
  saveSavedWords,
  upsertSavedWord,
} from './lib/storage'

type LookupState = {
  term: string
  entries: DictionaryEntry[]
  sectionId: string
  sectionTitle: string
  context: string
}

function App() {
  const [document, setDocument] = useState<ReaderDocument>(
    () => loadReaderDocument() ?? sampleDocument,
  )
  const [savedWords, setSavedWords] = useState<SavedWord[]>(() => loadSavedWords())
  const [lookup, setLookup] = useState<LookupState | null>(null)
  const [dictionaryStatus, setDictionaryStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [dictionaryError, setDictionaryError] = useState<string>('')
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dictionary, setDictionary] = useState<Awaited<
    ReturnType<typeof loadCedictDictionary>
  > | null>(null)

  useEffect(() => {
    let isMounted = true

    void loadCedictDictionary()
      .then((loaded) => {
        if (!isMounted) {
          return
        }

        setDictionary(loaded)
        setDictionaryStatus('ready')
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return
        }

        setDictionaryStatus('error')
        setDictionaryError(
          error instanceof Error
            ? error.message
            : 'The offline dictionary failed to load.',
        )
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    saveReaderDocument(document)
  }, [document])

  useEffect(() => {
    saveSavedWords(savedWords)
  }, [savedWords])

  const tokenizedSections = useMemo(() => {
    return new Map(
      document.sections.map((section) => [
        section.id,
        splitIntoParagraphs(section.chinese).map((paragraph) =>
          dictionary
            ? tokenizeReaderText(paragraph, dictionary)
            : buildPlainTokens(paragraph),
        ),
      ]),
    )
  }, [dictionary, document.sections])

  const existingWordKeys = useMemo(
    () =>
      new Set(
        savedWords.map((word) => `${word.word}:${word.sectionId ?? 'global'}`),
      ),
    [savedWords],
  )

  const handleUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    const imported = await importReaderDocumentFromFile(file)
    startTransition(() => {
      setDocument(imported)
      setLookup(null)
    })
  }

  const handleQuickImport = (): void => {
    const imported = parseReaderDocument(
      [
        '# Draft Section',
        '請把你的章節貼到這裡。',
        '---',
        'Paste your translation draft below the divider.',
      ].join('\n'),
      {
        sourceName: 'Quick-start template',
      },
    )

    startTransition(() => {
      setDocument(imported)
      setLookup(null)
    })
  }

  const handleLoadSample = (): void => {
    startTransition(() => {
      setDocument(sampleDocument)
      setLookup(null)
    })
  }

  const handleTranslationChange = (
    sectionId: string,
    value: string,
  ): void => {
    startTransition(() => {
      setDocument((current) => ({
        ...current,
        sections: current.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                translation: value,
              }
            : section,
        ),
      }))
    })
  }

  const handleLookup = (
    token: ReaderToken,
    section: ReaderSection,
    context: string,
  ): void => {
    if (!dictionary || !token.lookupKey) {
      return
    }

    setLookup({
      term: token.lookupKey,
      entries: lookupWord(token.lookupKey, dictionary) ?? [],
      sectionId: section.id,
      sectionTitle: section.title,
      context: context.trim(),
    })
  }

  const handleSaveLookup = (): void => {
    if (!lookup) {
      return
    }

    const primaryEntry = lookup.entries[0]
    const nextWord = createSavedWord(lookup.term, {
      pinyin: primaryEntry?.pinyin,
      definition: primaryEntry?.english,
      sectionId: lookup.sectionId,
      context: `${lookup.sectionTitle}: ${truncateText(lookup.context, 96)}`,
    })

    setSavedWords((current) => upsertSavedWord(current, nextWord))
  }

  const handleRemoveSavedWord = (wordId: string): void => {
    setSavedWords((current) => removeSavedWord(current, wordId))
  }

  const handleExport = (): void => {
    const payload = {
      document,
      savedWords,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = window.document.createElement('a')
    link.href = url
    link.download = slugifyFilename(document.title || 'grandpa-reader')
    link.click()
    URL.revokeObjectURL(url)
  }

  const sectionCountLabel = `${document.sections.length} ${
    document.sections.length === 1 ? 'section' : 'sections'
  }`
  const dictionaryLabel =
    dictionaryStatus === 'ready'
      ? `${dictionary?.entries.size.toLocaleString() ?? '0'} offline entries`
      : dictionaryStatus === 'error'
        ? 'Dictionary unavailable'
        : 'Loading offline dictionary'
  const activeLookupSaved = lookup
    ? existingWordKeys.has(`${lookup.term}:${lookup.sectionId}`)
    : false

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">Private bilingual reader</p>
          <div className="brand-line">
            <h1>{document.title}</h1>
            <span className="autosave-pill">
              {isPending ? 'Saving draft…' : 'Saved locally'}
            </span>
          </div>
          <p className="subcopy">
            A focused reading workspace for your grandpa&apos;s book. Import
            markdown, verify the English beside the Chinese, and build a private
            glossary as you go.
          </p>
        </div>

        <div className="toolbar">
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".md,.txt"
            onChange={(event) => {
              void handleUpload(event)
            }}
          />
          <button
            className="toolbar-button toolbar-button--primary"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Import markdown or text
          </button>
          <button className="toolbar-button" onClick={handleQuickImport}>
            New template
          </button>
          <button className="toolbar-button" onClick={handleLoadSample}>
            Load sample
          </button>
          <button className="toolbar-button" onClick={handleExport}>
            Export library
          </button>
        </div>
      </header>

      <section className="status-bar" aria-label="Reader status">
        <div className="status-chip">
          <span className="status-label">Source</span>
          <strong>{document.sourceName}</strong>
        </div>
        <div className="status-chip">
          <span className="status-label">Sections</span>
          <strong>{sectionCountLabel}</strong>
        </div>
        <div className="status-chip">
          <span className="status-label">Glossary</span>
          <strong>{savedWords.length} saved words</strong>
        </div>
        <div className="status-chip">
          <span className="status-label">Dictionary</span>
          <strong>{dictionaryLabel}</strong>
        </div>
        <div className="status-chip">
          <span className="status-label">Imported</span>
          <strong>{formatDate(document.importedAt)}</strong>
        </div>
      </section>

      <main className="workspace">
        <section className="reader-surface">
          <div className="format-note">
            <p>
              Use markdown headings for section titles. Add a line with{' '}
              <code>---</code> inside a section to separate Chinese from English.
            </p>
          </div>

          <div className="section-stack">
            {document.sections.map((section) => {
              const paragraphs = tokenizedSections.get(section.id) ?? []

              return (
                <article className="section-row" key={section.id}>
                  <section className="reader-card reader-card--source">
                    <div className="card-header">
                      <p className="card-kicker">Original</p>
                      <h2>{section.title}</h2>
                    </div>

                    <div className="chinese-copy">
                      {paragraphs.length ? (
                        paragraphs.map((tokens, index) => (
                          <p className="reader-paragraph" key={`${section.id}-${index}`}>
                            {tokens.map((token, tokenIndex) =>
                              token.interactive ? (
                                <button
                                  className={`reader-word${
                                    lookup?.term === token.lookupKey ? ' is-active' : ''
                                  }`}
                                  key={`${section.id}-${index}-${token.value}-${tokenIndex}`}
                                  onClick={() =>
                                    handleLookup(token, section, tokensToText(tokens))
                                  }
                                  type="button"
                                >
                                  {token.value}
                                </button>
                              ) : (
                                <span
                                  className={`reader-token reader-token--${token.type}`}
                                  key={`${section.id}-${index}-${token.value}-${tokenIndex}`}
                                >
                                  {token.value}
                                </span>
                              ),
                            )}
                          </p>
                        ))
                      ) : (
                        <p className="reader-empty">No Chinese text in this section yet.</p>
                      )}
                    </div>
                  </section>

                  <section className="reader-card reader-card--translation">
                    <div className="card-header">
                      <p className="card-kicker">Translation</p>
                      <h2>{section.title}</h2>
                    </div>

                    <label className="translation-label" htmlFor={`translation-${section.id}`}>
                      English draft
                    </label>
                    <textarea
                      id={`translation-${section.id}`}
                      className="translation-field"
                      onChange={(event) =>
                        handleTranslationChange(section.id, event.target.value)
                      }
                      placeholder="Draft or revise the English here."
                      value={section.translation}
                    />
                  </section>
                </article>
              )
            })}
          </div>
        </section>

        <aside className="sidebar">
          <section className="sidebar-card lookup-card">
            <div className="sidebar-header">
              <p className="card-kicker">Lookup</p>
              <h2>Word focus</h2>
            </div>

            {lookup ? (
              <>
                <div className="lookup-term">
                  <strong>{lookup.term}</strong>
                  <span>{lookup.sectionTitle}</span>
                </div>
                <p className="lookup-context">{lookup.context}</p>
                <div className="lookup-definitions">
                  {lookup.entries.length ? (
                    lookup.entries.map((entry, index) => (
                      <article className="definition-card" key={`${entry.pinyin}-${index}`}>
                        <p className="definition-pinyin">{entry.pinyin}</p>
                        <p className="definition-english">{entry.english}</p>
                      </article>
                    ))
                  ) : (
                    <p className="lookup-empty">
                      No exact CEDICT entry for this token yet.
                    </p>
                  )}
                </div>
                <button
                  className="sidebar-button"
                  disabled={activeLookupSaved}
                  onClick={handleSaveLookup}
                  type="button"
                >
                  {activeLookupSaved ? 'Saved to glossary' : 'Save to glossary'}
                </button>
              </>
            ) : (
              <p className="lookup-empty">
                Click a Chinese word in the reader to inspect its pinyin and
                meanings.
              </p>
            )}

            {dictionaryStatus === 'error' ? (
              <p className="sidebar-warning">{dictionaryError}</p>
            ) : null}
          </section>

          <section className="sidebar-card glossary-card">
            <div className="sidebar-header">
              <p className="card-kicker">Glossary</p>
              <h2>Saved vocabulary</h2>
            </div>

            {savedWords.length ? (
              <ul className="saved-list">
                {savedWords.map((word) => (
                  <li className="saved-item" key={word.id}>
                    <div className="saved-copy">
                      <strong>{word.word}</strong>
                      <span>{word.pinyin || 'No pinyin saved'}</span>
                      <p>{word.definition || 'Definition not captured yet.'}</p>
                      {word.context ? (
                        <small>{truncateText(word.context, 120)}</small>
                      ) : null}
                    </div>
                    <button
                      className="saved-remove"
                      onClick={() => handleRemoveSavedWord(word.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="lookup-empty">
                Your saved words will collect here as you read.
              </p>
            )}
          </section>
        </aside>
      </main>
    </div>
  )
}

function buildPlainTokens(text: string): ReaderToken[] {
  return text
    ? [
        {
          value: text,
          type: 'unknown',
          interactive: false,
        },
      ]
    : []
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function tokensToText(tokens: ReaderToken[]): string {
  return tokens.map((token) => token.value).join('')
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 3)}...`
}

function slugifyFilename(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${slug || 'grandpa-reader'}.json`
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export default App
