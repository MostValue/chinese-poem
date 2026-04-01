import type { ReaderDocument, ReaderSection, SavedWord } from './reader-types'
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

function normalizeReaderDocument(value: unknown): ReaderDocument | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    typeof candidate.sourceName !== 'string' ||
    typeof candidate.importedAt !== 'string' ||
    !Array.isArray(candidate.sections)
  ) {
    return null
  }

  return {
    id: candidate.id,
    title: candidate.title,
    sourceName: candidate.sourceName,
    importedAt: candidate.importedAt,
    sections: candidate.sections
      .map((section) => normalizeStoredSection(section))
      .filter((section): section is ReaderSection => section !== null),
  }
}

function normalizeStoredSection(value: unknown): ReaderSection | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    typeof candidate.chinese !== 'string'
  ) {
    return null
  }

  const translation =
    typeof candidate.translation === 'string'
      ? candidate.translation
      : typeof candidate.english === 'string'
        ? candidate.english
        : ''

  return {
    id: candidate.id,
    title: candidate.title,
    chinese: candidate.chinese,
    translation,
  }
}

function normalizeSavedWord(value: unknown): SavedWord | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  const word =
    typeof candidate.word === 'string'
      ? candidate.word
      : typeof candidate.term === 'string'
        ? candidate.term
        : null

  if (
    typeof candidate.id !== 'string' ||
    !word ||
    typeof candidate.createdAt !== 'string'
  ) {
    return null
  }

  return {
    id: candidate.id,
    word,
    pinyin: typeof candidate.pinyin === 'string' ? candidate.pinyin : undefined,
    definition:
      typeof candidate.definition === 'string' ? candidate.definition : undefined,
    sectionId:
      typeof candidate.sectionId === 'string' ? candidate.sectionId : undefined,
    context:
      typeof candidate.context === 'string'
        ? candidate.context
        : typeof candidate.sectionTitle === 'string'
          ? candidate.sectionTitle
          : typeof candidate.note === 'string'
            ? candidate.note
            : undefined,
    createdAt: candidate.createdAt,
  }
}

export function loadReaderDocument(): ReaderDocument | null {
  const stored = readJson<unknown>(DOCUMENT_STORAGE_KEY, null)
  const document = normalizeReaderDocument(stored)
  return document ? cloneReaderDocument(document) : null
}

export function saveReaderDocument(document: ReaderDocument): ReaderDocument {
  writeJson(DOCUMENT_STORAGE_KEY, document)
  return document
}

export function clearReaderDocument(): void {
  if (!isBrowserStorageAvailable()) {
    return
  }

  window.localStorage.removeItem(DOCUMENT_STORAGE_KEY)
}

export function loadSavedWords(): SavedWord[] {
  const stored = readJson<unknown>(SAVED_WORDS_STORAGE_KEY, [])
  if (!Array.isArray(stored)) {
    return []
  }

  return stored
    .map(normalizeSavedWord)
    .filter((word): word is SavedWord => word !== null)
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
      entry.word === word.word &&
      entry.sectionId === word.sectionId &&
      entry.pinyin === word.pinyin,
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
  word: string,
  details: Omit<SavedWord, 'id' | 'word' | 'createdAt'> = {},
): SavedWord {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `saved-word-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 10)}`,
    word,
    createdAt: new Date().toISOString(),
    ...details,
  }
}
