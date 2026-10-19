// `html` is sanitized server-side by the API before it is returned.
export function LegacyParagraphFragment({ html }: { html: string }) {
  return <div className="legacy-paragraph" dangerouslySetInnerHTML={{ __html: html }} />
}
