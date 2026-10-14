import { Banner } from '../components/Banner'
import { Layout } from '../components/Layout'
import { apiClient } from '../lib/apiClient'
import { childrenOf } from '../lib/orgTree'
import type { Department, Employee } from '../lib/types'
import { useAsync } from '../lib/useAsync'

interface MyDepartment {
  departments: Department[]
  employees: Employee[]
}

export default function MyDepartmentPage() {
  const { data, error } = useAsync(() => apiClient.get<MyDepartment>('/departments/my'))

  /** Departments in the managed subtree, each managed root first, then nested ones depth-first. */
  function ordered(departments: Department[]): { dept: Department; nested: boolean }[] {
    const ids = new Set(departments.map((d) => d.id))
    const walk = (d: Department, nested: boolean): { dept: Department; nested: boolean }[] => [
      { dept: d, nested },
      ...childrenOf(departments, d.id).flatMap((c) => walk(c, true)),
    ]
    return departments
      .filter((d) => !d.parentId || !ids.has(d.parentId))
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((d) => walk(d, false))
  }

  return (
    <Layout title="My department" crumbs={[{ label: 'People in your department and every department nested beneath it' }]}>
      {error ? (
        <Banner kind="danger" title="Couldn't load your department">
          {error.message}
        </Banner>
      ) : data && data.departments.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p>
              <strong>You don't manage a department</strong>
            </p>
            <p className="text-muted">When you are set as a department's manager, its people will appear here.</p>
          </div>
        </div>
      ) : data ? (
        <>
          {ordered(data.departments).map(({ dept, nested }) => {
            const members = data.employees.filter((e) => e.departmentId === dept.id)
            if (members.length === 0) return null
            return (
              <section key={dept.id}>
                <h3 className="dept-group-heading">
                  {dept.name} {nested && <span className="text-muted">(sub-department)</span>}
                </h3>
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Title</th>
                        <th>Reports to</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((e) => (
                        <tr key={e.id}>
                          <td>{e.fullName}</td>
                          <td>{e.jobTitle ?? '—'}</td>
                          <td>{data.employees.find((m) => m.id === e.managerId)?.fullName ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </>
      ) : null}
    </Layout>
  )
}
