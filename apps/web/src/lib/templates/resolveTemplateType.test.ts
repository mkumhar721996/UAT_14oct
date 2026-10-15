import { describe, expect, it } from 'vitest'
import { resolveTemplateType } from './resolveTemplateType'

describe('resolveTemplateType', () => {
  it('resolves a known templateField value', () => {
    expect(resolveTemplateType({ contentType: 'page', templateField: 'home_page' })).toBe('HomePage')
  })
  it('falls back to contentType when templateField is absent or null', () => {
    expect(resolveTemplateType({ contentType: 'services', templateField: null })).toBe('Services')
    expect(resolveTemplateType({ contentType: 'partner' })).toBe('Partner')
  })
  it('returns null for unmapped values', () => {
    expect(resolveTemplateType({ contentType: 'blog_post', templateField: 'blog_post' })).toBeNull()
  })
  it('returns null when templateField and contentType disagree', () => {
    expect(resolveTemplateType({ contentType: 'partner', templateField: 'services' })).toBeNull()
  })
})
