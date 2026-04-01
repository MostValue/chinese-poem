export type ReaderSection = {
  id: string
  title: string
  chinese: string
  translation: string
}

export type ReaderDocument = {
  id: string
  title: string
  sourceName: string
  importedAt: string
  sections: ReaderSection[]
}

export type SavedWord = {
  id: string
  word: string
  pinyin?: string
  definition?: string
  sectionId?: string
  context?: string
  createdAt: string
}

export type ReaderImportOptions = {
  id?: string
  title?: string
  sourceName?: string
  importedAt?: string
}
