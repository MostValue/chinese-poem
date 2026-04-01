export type ReaderSectionKind = 'markdown-heading' | 'plain-paragraph'

export type ReaderSection = {
  id: string
  title: string
  kind: ReaderSectionKind
  chinese: string
  english: string
  rawText: string
  hasTranslationDivider: boolean
}

export type ReaderDocumentFormat = 'markdown' | 'text'

export type ReaderDocument = {
  id: string
  title: string
  sourceName: string
  format: ReaderDocumentFormat
  importedAt: string
  updatedAt: string
  rawText: string
  sections: ReaderSection[]
}

export type SavedWord = {
  id: string
  term: string
  reading?: string
  definition?: string
  sectionId?: string
  sectionTitle?: string
  createdAt: string
  note?: string
}

export type ReaderImportOptions = {
  id?: string
  title?: string
  sourceName?: string
  importedAt?: string
}
