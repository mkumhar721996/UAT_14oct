import { describe, expect, it } from 'vitest'
import { createParagraphDispatchTable } from './paragraphDispatchTable'

describe('createParagraphDispatchTable', () => {
  it('names exactly one path per listed type and nothing for unlisted types', () => {
    const table = createParagraphDispatchTable()
    table.register({ paragraphType: 'example--quote', renderPath: { kind: 'component', Component: () => null } })
    table.register({ paragraphType: 'example--legacy-banner', renderPath: { kind: 'html-fragment', fetchHtml: async () => '' } })
    expect(table.resolve('example--quote')?.kind).toBe('component')
    expect(table.resolve('example--legacy-banner')?.kind).toBe('html-fragment')
    expect(table.resolve('example--unlisted')).toBeUndefined()
  })

  it('rejects a second path for an already-listed type', () => {
    const table = createParagraphDispatchTable()
    table.register({ paragraphType: 'example--quote', renderPath: { kind: 'component', Component: () => null } })
    expect(() =>
      table.register({ paragraphType: 'example--quote', renderPath: { kind: 'html-fragment', fetchHtml: async () => '' } }),
    ).toThrow(/already registered/)
  })
})
