import type { ParagraphRenderPath } from './types'

export interface ParagraphDispatchRegistration {
  paragraphType: string
  renderPath: ParagraphRenderPath
}

export function createParagraphDispatchTable() {
  const entries = new Map<string, ParagraphRenderPath>()
  return {
    register(registration: ParagraphDispatchRegistration): void {
      if (entries.has(registration.paragraphType)) {
        throw new Error(`A rendering path is already registered for paragraph type "${registration.paragraphType}"`)
      }
      entries.set(registration.paragraphType, registration.renderPath)
    },
    resolve(paragraphType: string): ParagraphRenderPath | undefined {
      return entries.get(paragraphType)
    },
  }
}

export type ParagraphDispatchTable = ReturnType<typeof createParagraphDispatchTable>

export const paragraphDispatchTable = createParagraphDispatchTable()
