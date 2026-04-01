export type CedictSense = readonly [pinyin: string, english: string]

export type CedictRawDictionary = Record<string, CedictSense[]>

export interface DictionaryEntry {
  readonly pinyin: string
  readonly english: string
}

export interface DictionaryResource {
  readonly entries: ReadonlyMap<string, DictionaryEntry[]>
  readonly maxWordLength: number
}

export type TokenType =
  | 'word'
  | 'latin'
  | 'whitespace'
  | 'punctuation'
  | 'symbol'
  | 'unknown'

export interface ReaderToken {
  readonly value: string
  readonly type: TokenType
  readonly interactive: boolean
  readonly lookupKey?: string
}

const DICTIONARY_URL = '/data/cedict.json'

let cachedDictionary: Promise<DictionaryResource> | null = null

const hanRegex = /\p{Script=Han}/u
const latinTokenStartRegex = /[\p{L}\p{N}]/u
const latinTokenContinueRegex = /[-\p{L}\p{N}_'’]/u
const whitespaceRegex = /\s/u
const punctuationRegex = /[\p{P}\p{S}]/u

export function normalizeCedictDictionary(
  raw: CedictRawDictionary,
): DictionaryResource {
  const entries = new Map<string, DictionaryEntry[]>()
  let maxWordLength = 1

  for (const [word, senses] of Object.entries(raw)) {
    if (!senses.length) {
      continue
    }

    const normalizedSenses: DictionaryEntry[] = []

    for (const sense of senses) {
      const [pinyin, english] = sense
      const trimmedEnglish = english.trim()
      const trimmedPinyin = pinyin.trim()

      if (!trimmedEnglish && !trimmedPinyin) {
        continue
      }

      normalizedSenses.push({
        pinyin: trimmedPinyin,
        english: trimmedEnglish,
      })
    }

    if (!normalizedSenses.length) {
      continue
    }

    entries.set(word, normalizedSenses)

    maxWordLength = Math.max(maxWordLength, Array.from(word).length)
  }

  return {
    entries,
    maxWordLength,
  }
}

export async function loadCedictDictionary(): Promise<DictionaryResource> {
  if (!cachedDictionary) {
    cachedDictionary = fetch(DICTIONARY_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load dictionary: ${response.status} ${response.statusText}`,
          )
        }

        return (await response.json()) as CedictRawDictionary
      })
      .then(normalizeCedictDictionary)
  }

  return cachedDictionary
}

export function lookupWord(
  word: string,
  dictionary: DictionaryResource,
): DictionaryEntry[] | undefined {
  return dictionary.entries.get(word)
}

export function tokenizeReaderText(
  text: string,
  dictionary: DictionaryResource,
): ReaderToken[] {
  const codePoints = Array.from(text)
  const offsets = new Array<number>(codePoints.length + 1)
  let offset = 0

  for (let i = 0; i < codePoints.length; i += 1) {
    offsets[i] = offset
    offset += codePoints[i].length
  }

  offsets[codePoints.length] = text.length

  const tokens: ReaderToken[] = []

  for (let i = 0; i < codePoints.length; ) {
    const current = codePoints[i]
    const start = offsets[i]

    if (whitespaceRegex.test(current)) {
      let end = i + 1

      while (end < codePoints.length && whitespaceRegex.test(codePoints[end])) {
        end += 1
      }

      tokens.push({
        type: 'whitespace',
        value: text.slice(start, offsets[end]),
        interactive: false,
      })
      i = end
      continue
    }

    if (isLatinTokenStartChar(current)) {
      let end = i + 1

      while (end < codePoints.length && isLatinTokenContinueChar(codePoints[end])) {
        end += 1
      }

      tokens.push({
        type: 'latin',
        value: text.slice(start, offsets[end]),
        interactive: false,
      })
      i = end
      continue
    }

    if (isHanCharacter(current)) {
      const maxLength = Math.min(
        dictionary.maxWordLength,
        codePoints.length - i,
      )
      let matchedWord = ''
      let matchedEntries: DictionaryEntry[] | undefined

      for (let length = maxLength; length > 0; length -= 1) {
        const candidate = text.slice(start, offsets[i + length])
        const entry = dictionary.entries.get(candidate)

        if (entry) {
          matchedWord = candidate
          matchedEntries = entry
          break
        }
      }

      if (matchedEntries) {
        const end = i + Array.from(matchedWord).length

        tokens.push({
          type: 'word',
          value: matchedWord,
          interactive: true,
          lookupKey: matchedWord,
        })
        i = end
        continue
      }

      tokens.push({
        type: 'word',
        value: current,
        interactive: Boolean(dictionary.entries.get(current)),
        lookupKey: dictionary.entries.get(current) ? current : undefined,
      })
      i += 1
      continue
    }

    if (punctuationRegex.test(current)) {
      tokens.push({
        type: 'punctuation',
        value: current,
        interactive: false,
      })
      i += 1
      continue
    }

    tokens.push({
      type: 'symbol',
      value: current,
      interactive: false,
    })
    i += 1
  }

  return tokens
}

export function findLongestDictionaryMatch(
  text: string,
  dictionary: DictionaryResource,
  startIndex = 0,
): { readonly lookupKey: string; readonly entries: DictionaryEntry[] } | undefined {
  const codePoints = Array.from(text)
  const start = Math.max(0, Math.min(startIndex, codePoints.length))
  const limit = Math.min(dictionary.maxWordLength, codePoints.length - start)

  for (let length = limit; length > 0; length -= 1) {
    const candidate = codePoints.slice(start, start + length).join('')
    const entry = dictionary.entries.get(candidate)

    if (entry) {
      return {
        lookupKey: candidate,
        entries: entry,
      }
    }
  }

  return undefined
}

export function isHanCharacter(value: string): boolean {
  return hanRegex.test(value)
}

function isLatinTokenStartChar(value: string): boolean {
  return latinTokenStartRegex.test(value)
}

function isLatinTokenContinueChar(value: string): boolean {
  return latinTokenContinueRegex.test(value)
}
