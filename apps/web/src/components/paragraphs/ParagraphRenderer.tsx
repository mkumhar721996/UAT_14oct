import { useEffect, useState } from 'react'
import { paragraphDispatchTable, type ParagraphDispatchTable } from '../../lib/paragraphs/paragraphDispatchTable'
import type { ParagraphInstance } from '../../lib/paragraphs/types'

function HtmlFragmentParagraph({
  paragraph,
  fetchHtml,
}: {
  paragraph: ParagraphInstance
  fetchHtml: (paragraph: ParagraphInstance) => Promise<string>
}) {
  const [html, setHtml] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void fetchHtml(paragraph).then((result) => {
      if (!cancelled) setHtml(result)
    })
    return () => {
      cancelled = true
    }
  }, [paragraph.type, paragraph.id, fetchHtml])
  if (html === null) return null
  return <div data-testid="paragraph-html-fragment" dangerouslySetInnerHTML={{ __html: html }} />
}

export function ParagraphRenderer({
  paragraph,
  table = paragraphDispatchTable,
}: {
  paragraph: ParagraphInstance
  table?: ParagraphDispatchTable
}) {
  const entry = table.resolve(paragraph.type)
  if (!entry) return null
  if (entry.kind === 'component') {
    const { Component } = entry
    return <Component paragraph={paragraph} />
  }
  return <HtmlFragmentParagraph paragraph={paragraph} fetchHtml={entry.fetchHtml} />
}

export function ParagraphList({ paragraphs, table }: { paragraphs: ParagraphInstance[]; table?: ParagraphDispatchTable }) {
  return (
    <>
      {paragraphs.map((paragraph) => (
        <ParagraphRenderer key={paragraph.id} paragraph={paragraph} table={table} />
      ))}
    </>
  )
}
