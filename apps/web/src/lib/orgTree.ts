import type { Department, Employee } from './types'

export function childrenOf(departments: Department[], parentId: string | null): Department[] {
  return departments.filter((d) => (d.parentId ?? null) === parentId).sort((a, b) => a.name.localeCompare(b.name))
}

export function descendantIds(departments: Department[], id: string): string[] {
  return childrenOf(departments, id).flatMap((c) => [c.id, ...descendantIds(departments, c.id)])
}

export function directReports(employees: Employee[], managerId: string | null): Employee[] {
  return employees.filter((e) => (e.managerId ?? null) === managerId).sort((a, b) => a.fullName.localeCompare(b.fullName))
}

/** The employee plus everyone below them in the reporting chain. */
export function selfAndReportIds(employees: Employee[], id: string): string[] {
  return [id, ...directReports(employees, id).flatMap((r) => selfAndReportIds(employees, r.id))]
}
