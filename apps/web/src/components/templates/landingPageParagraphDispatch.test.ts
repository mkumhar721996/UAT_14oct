import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEGACY_HTML_FRAGMENT_KEY } from './landingPageParagraphDispatch'

// No shared package exists between apps/web and services/api (each has its own
// pnpm-workspace.yaml, deployed independently), so the two LEGACY_HTML_FRAGMENT_KEY constants
// can't literally be the same import. This test reads the backend's source directly so the two
// values can never silently drift apart.
describe('LEGACY_HTML_FRAGMENT_KEY cross-package contract', () => {
  it('matches the constant of the same name in services/api/src/pages/landing-page-paragraph-dispatch.ts', () => {
    const backendSource = readFileSync(
      join(__dirname, '../../../../../services/api/src/pages/landing-page-paragraph-dispatch.ts'),
      'utf8',
    )
    const match = backendSource.match(/export const LEGACY_HTML_FRAGMENT_KEY = '([^']+)';/)
    expect(match?.[1]).toBe(LEGACY_HTML_FRAGMENT_KEY)
  })
})
