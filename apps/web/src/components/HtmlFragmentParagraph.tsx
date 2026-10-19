// Legacy paragraphs arrive as server-rendered markup from the trusted Drupal instance.
export function HtmlFragmentParagraph({ html }: { html: string }) {
  return <div data-testid="html-fragment" dangerouslySetInnerHTML={{ __html: html }} />
}
