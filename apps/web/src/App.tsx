import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AccessRestricted, Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { useAuth } from './lib/auth'
import DepartmentTreePage from './routes/DepartmentTreePage'
import EditEmployeeProfilePage from './routes/EditEmployeeProfilePage'
import EmployeeDirectoryPage from './routes/EmployeeDirectoryPage'
import EmployeeProfileDetailPage from './routes/EmployeeProfileDetailPage'
import EmployeesManagersPage from './routes/EmployeesManagersPage'
import MyDepartmentPage from './routes/MyDepartmentPage'
import MyProfilePage from './routes/MyProfilePage'
import NewEmployeeProfilePage from './routes/NewEmployeeProfilePage'
import OrgChartPage from './routes/OrgChartPage'
import PendingChangesPage from './routes/PendingChangesPage'

/** Renders the HR-Admin-only page, or the access-restricted state for everyone else. */
function RequireHrAdmin({ title, message, children }: { title: string; message: string; children: ReactNode }) {
  const auth = useAuth()
  if (auth?.role === 'hr_admin') return <>{children}</>
  return (
    <Layout title={title}>
      <AccessRestricted message={message} />
    </Layout>
  )
}

function App() {
  const auth = useAuth()
  if (!auth) {
    return (
      <main className="content">
        <h1 className="heading-lg">Sign in required</h1>
        <p className="text-muted">Sign in to view employee profiles.</p>
      </main>
    )
  }
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/employees" replace />} />
        <Route path="/employees" element={<EmployeeDirectoryPage />} />
        <Route
          path="/employees/new"
          element={
            <RequireHrAdmin title="New employee profile" message="Only HR Admins can create employee profiles. No profile was created.">
              <NewEmployeeProfilePage />
            </RequireHrAdmin>
          }
        />
        <Route path="/employees/:id" element={<EmployeeProfileDetailPage />} />
        <Route
          path="/employees/:id/edit"
          element={
            <RequireHrAdmin title="Edit employee profile" message="Only HR Admins can edit employee profiles. No changes were saved.">
              <EditEmployeeProfilePage />
            </RequireHrAdmin>
          }
        />
        <Route path="/me" element={<MyProfilePage />} />
        <Route
          path="/pending-changes"
          element={
            <RequireHrAdmin title="Pending changes" message="Only HR Admins can review pending changes.">
              <PendingChangesPage />
            </RequireHrAdmin>
          }
        />
        <Route
          path="/org/departments"
          element={
            <RequireHrAdmin title="Department tree" message="Only HR Admins can manage departments.">
              <DepartmentTreePage />
            </RequireHrAdmin>
          }
        />
        <Route
          path="/org/employees-managers"
          element={
            <RequireHrAdmin title="Employees & managers" message="Only HR Admins can assign managers.">
              <EmployeesManagersPage />
            </RequireHrAdmin>
          }
        />
        <Route path="/org/chart" element={<OrgChartPage />} />
        <Route path="/org/my-department" element={<MyDepartmentPage />} />
      </Routes>
    </ToastProvider>
  )
}

export default App
