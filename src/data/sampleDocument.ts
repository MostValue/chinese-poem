import type { ReaderDocument } from '../lib/reader-types'

export const sampleDocument: ReaderDocument = {
  id: 'sample-grandpa-reader',
  title: "Grandpa's Reading Room",
  sourceName: 'Built-in sample',
  importedAt: '2026-04-02T00:00:00.000Z',
  sections: [
    {
      id: 'sample-1',
      title: 'How This MVP Works',
      chinese:
        '把祖父的章节贴进来，应用会按标题和段落整理。\n点击任何词语，都可以查看拼音和释义，并把它存成词汇卡。',
      translation:
        "Paste a chapter from your grandfather's manuscript and the app will organize it by headings and paragraphs. Click any word to see pinyin and definitions, then save it as vocabulary.",
    },
    {
      id: 'sample-2',
      title: 'Recommended Markdown',
      chinese:
        '每个标题会成为一个章节。\n如果你已经写了英文译文，就在中文后面另起一行写 ---，再把英文放在下面。',
      translation:
        'Each heading becomes a section. If you already have an English draft, add a line with --- after the Chinese text and put the translation below it.',
    },
    {
      id: 'sample-3',
      title: 'Translation Notes',
      chinese:
        '译文先求准确，再求好读。\n有疑问的地方先留下，慢慢核对，不必一次定稿。',
      translation:
        "Aim for accuracy before polish. Leave uncertain passages visible and refine them slowly instead of forcing a final translation in one pass.",
    },
  ],
}
