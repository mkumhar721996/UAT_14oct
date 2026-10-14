import { Banner } from '../components/Banner'
import { Layout } from '../components/Layout'
import { apiClient } from '../lib/apiClient'
import { directReports } from '../lib/orgTree'
import type { Department, Employee } from '../lib/types'
import { useAsync } from '../lib/useAsync'

export default function OrgChartPage() {
  const { data, error } = useAsync(async () => {
    const [employees, departments] = await Promise.all([
      apiClient.get<Employee[]>('/employees'),
      apiClient.get<Department[]>('/departments'),
    ])
    return { employees, departments }
  })

  function renderNode(emp: Employee, employees: Employee[], departments: Department[]) {
    const reports = directReports(employees, emp.id)
    return (
      <li key={emp.id}>
        <div className="org-card">
          <span className="org-card-name">{emp.fullName}</span>
          <span className="org-card-title">{emp.jobTitle}</span>
          <span className="org-card-dept text-muted">{departments.find((d) => d.id === emp.departmentId)?.name}</span>
        </div>
        {reports.length > 0 && <ul className="tree-children">{reports.map((r) => renderNode(r, employees, departments))}</ul>}
      </li>
    )
  }

  return (
    <Layout title="Org chart" crumbs={[{ label: 'Every employee appears beneath their manager' }]}>
      {error ? (
        <Banner kind="danger" title="Couldn't load the org chart">
          {error.message}
        </Banner>
      ) : data ? (
        <ul className="org-tree">{directReports(data.employees, null).map((e) => renderNode(e, data.employees, data.departments))}</ul>
      ) : null}
    </Layout>
  )
}
