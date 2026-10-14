import { describe, expect, it } from 'vitest'
import { childrenOf, descendantIds, directReports } from './orgTree'
import type { Department, Employee } from './types'

const d = (id: string, parentId: string | null, name = id): Department => ({ id, name, parentId, managerId: 'm' })
const e = (id: string, managerId: string | null): Employee => ({ id, managerId, fullName: id, departmentId: null }) as Employee

describe('orgTree', () => {
  const depts = [d('b', null, 'B'), d('a', null, 'A'), d('a1', 'a'), d('a1x', 'a1')]

  it('lists children sorted by name, roots with null parent', () => {
    expect(childrenOf(depts, null).map((x) => x.id)).toEqual(['a', 'b'])
    expect(childrenOf(depts, 'a').map((x) => x.id)).toEqual(['a1'])
  })

  it('collects descendants at every depth, excluding the node itself', () => {
    expect(descendantIds(depts, 'a').sort()).toEqual(['a1', 'a1x'])
    expect(descendantIds(depts, 'b')).toEqual([])
  })

  it('lists direct reports, roots when manager is null', () => {
    const emps = [e('x', null), e('y', 'x'), e('z', 'y')]
    expect(directReports(emps, 'x').map((r) => r.id)).toEqual(['y'])
    expect(directReports(emps, null).map((r) => r.id)).toEqual(['x'])
  })
})
