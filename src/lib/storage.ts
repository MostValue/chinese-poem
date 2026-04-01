import type { ReaderDocument, SavedWord } from './reader-types'
import { cloneReaderDocument } from './document'

const DOCUMENT_STORAGE_KEY = 'chinese-poem:reader-document:v1'
const SAVED_WORDS_STORAGE_KEY = 'chinese-poem:saved-words:v1'

function isBrowserStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowserStorageAvailable()) {
    return fallback
  }

  const rawValue = window.localStorage.getItem(key)
  if (!rawValue) {
    return fallback
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!isBrowserStorageAvailable()) {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

export function loadReaderDocument(): ReaderDocument | null {
  const stored = readJson<ReaderDocument | null>(DOCUMENT_STORAGE_KEY, null)
  return stored ? cloneReaderDocument(stored) : null
}

export function saveReaderDocument(document: ReaderDocument): ReaderDocument {
  const nextDocument = {
    ...document,
    updatedAt: new Date().toISOString(),
  }

  writeJson(DOCUMENT_STORAGE_KEY, nextDocument)
  return nextDocument
}

export function clearReaderDocument(): void {
  if (!isBrowserStorageAvailable()) {
    return
  }

  window.localStorage.removeItem(DOCUMENT_STORAGE_KEY)
}

export function loadSavedWords(): SavedWord[] {
  const stored = readJson<unknown>(SAVED_WORDS_STORAGE_KEY, [])
  return Array.isArray(stored) ? (stored as SavedWord[]) : []
}

export function saveSavedWords(words: SavedWord[]): SavedWord[] {
  writeJson(SAVED_WORDS_STORAGE_KEY, words)
  return words
}

export function upsertSavedWord(
  words: SavedWord[],
  word: SavedWord,
): SavedWord[] {
  const nextWords = [...words]
  const existingIndex = nextWords.findIndex(
    (entry) =>
      entry.term === word.term &&
      entry.sectionId === word.sectionId &&
      entry.reading === word.reading,
  )

  if (existingIndex >= 0) {
    nextWords[existingIndex] = {
      ...nextWords[existingIndex],
      ...word,
    }
    return nextWords
  }

  return [word, ...nextWords]
}

export function removeSavedWord(
  words: SavedWord[],
  wordId: string,
): SavedWord[] {
  return words.filter((word) => word.id !== wordId)
}

export function createSavedWord(
  term: string,
  details: Omit<SavedWord, 'id' | 'term' | 'createdAt'> = {},
): SavedWord {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `saved-word-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 10)}`,
    term,
    createdAt: new Date().toISOString(),
    ...details,
  }
}
