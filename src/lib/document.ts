import type {
  ReaderDocument,
  ReaderImportOptions,
  ReaderSection,
  ReaderSectionKind,
} from './reader-types'

const HEADING_RE = /^#{1,2}\s+(.+?)\s*$/
const DIVIDER_RE = /^---\s*$/
const MULTIPLE_BLANK_LINES_RE = /\n{3,}/g

type SectionBuffer = {
  title: string
  kind: ReaderSectionKind
  chinese: string[]
  english: string[]
  rawLines: string[]
  hasDivider: boolean
  inEnglish: boolean
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(MULTIPLE_BLANK_LINES_RE, '\n\n')
    .trim()
}

function normalizeBlock(lines: string[]): string {
  return lines
    .map((line) => line.replace(/\s+$/u, ''))
    .join('\n')
    .replace(MULTIPLE_BLANK_LINES_RE, '\n\n')
    .trim()
}

function splitPlainBlocks(text: string): string[] {
  return normalizeText(text)
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
}

function parseHeading(line: string): string | null {
  const match = line.match(HEADING_RE)
  return match?.[1]?.trim() ?? null
}

function createSection(
  buffer: SectionBuffer | null,
  fallbackTitle: string,
  index: number,
): ReaderSection | null {
  if (!buffer) {
    return null
  }

  const chinese = normalizeBlock(buffer.chinese)
  const english = normalizeBlock(buffer.english)
  const rawText = normalizeBlock(buffer.rawLines)

  if (!chinese && !english && !rawText && buffer.kind !== 'markdown-heading') {
    return null
  }

  return {
    id: createId(`section-${index}`),
    title: buffer.title || fallbackTitle,
    kind: buffer.kind,
    chinese,
    english,
    rawText,
    hasTranslationDivider: buffer.hasDivider,
  }
}

function createBuffer(title: string, kind: ReaderSectionKind): SectionBuffer {
  return {
    title,
    kind,
    chinese: [],
    english: [],
    rawLines: [],
    hasDivider: false,
    inEnglish: false,
  }
}

function pushTextLine(buffer: SectionBuffer, line: string): void {
  buffer.rawLines.push(line)
  if (buffer.inEnglish) {
    buffer.english.push(line)
    return
  }

  buffer.chinese.push(line)
}

function parseMarkdownSections(
  normalizedText: string,
  fallbackTitle: string,
): ReaderSection[] {
  const lines = normalizedText.split('\n')
  const sections: ReaderSection[] = []
  let buffer: SectionBuffer | null = null
  let sectionIndex = 1

  const flushBuffer = (): void => {
    const section = createSection(buffer, fallbackTitle, sectionIndex)
    buffer = null
    if (!section) {
      return
    }

    sections.push(section)
    sectionIndex += 1
  }

  for (const line of lines) {
    const heading = parseHeading(line)
    if (heading) {
      flushBuffer()
      buffer = createBuffer(heading, 'markdown-heading')
      continue
    }

    if (!buffer) {
      buffer = createBuffer(fallbackTitle, 'plain-paragraph')
    }

    if (DIVIDER_RE.test(line) && !buffer.inEnglish) {
      buffer.hasDivider = true
      buffer.inEnglish = true
      buffer.rawLines.push(line)
      continue
    }

    pushTextLine(buffer, line)
  }

  flushBuffer()
  return sections
}

function parsePlainSections(
  normalizedText: string,
  fallbackTitle: string,
): ReaderSection[] {
  const blocks = splitPlainBlocks(normalizedText)
  const sections: ReaderSection[] = []

  blocks.forEach((block, index) => {
    const lines = block.split('\n')
    const dividerIndex = lines.findIndex((line) => DIVIDER_RE.test(line.trim()))
    const chineseLines =
      dividerIndex >= 0 ? lines.slice(0, dividerIndex) : lines
    const englishLines = dividerIndex >= 0 ? lines.slice(dividerIndex + 1) : []
    const rawLines = lines

    const chinese = normalizeBlock(chineseLines)
    const english = normalizeBlock(englishLines)
    const rawText = normalizeBlock(rawLines)

    if (!chinese && !english && !rawText) {
      return
    }

    sections.push({
      id: createId(`section-${index + 1}`),
      title: `${fallbackTitle} ${index + 1}`,
      kind: 'plain-paragraph',
      chinese,
      english,
      rawText,
      hasTranslationDivider: dividerIndex >= 0,
    })
  })

  return sections
}

function inferDocumentTitle(
  text: string,
  sourceName: string,
  sections: ReaderSection[],
): string {
  const firstHeading = text
    .split('\n')
    .map((line) => parseHeading(line))
    .find(Boolean)

  if (firstHeading) {
    return firstHeading
  }

  const firstChineseSection = sections.find((section) => section.chinese)
  if (firstChineseSection?.chinese) {
    return firstChineseSection.chinese.slice(0, 32) || sourceName
  }

  return sourceName || 'Untitled reading'
}

export function parseReaderDocument(
  sourceText: string,
  options: ReaderImportOptions = {},
): ReaderDocument {
  const normalizedText = normalizeText(sourceText)
  const sourceName = options.sourceName?.trim() || 'Uploaded text'
  const hasHeading = linesHaveHeadings(normalizedText)
  const sections = hasHeading
    ? parseMarkdownSections(normalizedText, sourceName)
    : parsePlainSections(normalizedText, sourceName)

  const importedAt = options.importedAt ?? new Date().toISOString()
  const title =
    options.title?.trim() ||
    inferDocumentTitle(normalizedText, sourceName, sections) ||
    sourceName

  return {
    id: options.id ?? createId('document'),
    title,
    sourceName,
    format: hasHeading ? 'markdown' : 'text',
    importedAt,
    updatedAt: importedAt,
    rawText: normalizedText,
    sections,
  }
}

function linesHaveHeadings(text: string): boolean {
  return text.split('\n').some((line) => HEADING_RE.test(line))
}

export async function importReaderDocumentFromFile(
  file: File,
  options: Omit<ReaderImportOptions, 'sourceName'> = {},
): Promise<ReaderDocument> {
  const text = await file.text()
  return parseReaderDocument(text, {
    ...options,
    sourceName: file.name,
  })
}

export function cloneReaderDocument(
  document: ReaderDocument,
): ReaderDocument {
  return {
    ...document,
    sections: document.sections.map((section) => ({ ...section })),
  }
}
