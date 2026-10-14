import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ActorProvider, isReviewer, useActor } from './auth/ActorContext'
import { AccessRestricted, Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { ApprovalQueuePage } from './features/approvals/ApprovalQueuePage'
import { JobBoardPage } from './features/jobs/JobBoardPage'
import { JobPostingPage } from './features/jobs/JobPostingPage'
import { MyRequisitionsPage } from './features/requisitions/MyRequisitionsPage'
import { RequisitionDetailPage } from './features/requisitions/RequisitionDetailPage'
import { RequisitionFormPage } from './features/requisitions/RequisitionFormPage'
import { useAuth } from './lib/auth'
import EditEmployeeProfilePage from './routes/EditEmployeeProfilePage'
import EmployeeDirectoryPage from './routes/EmployeeDirectoryPage'
import EmployeeProfileDetailPage from './routes/EmployeeProfileDetailPage'
import MyProfilePage from './routes/MyProfilePage'
import NewEmployeeProfilePage from './routes/NewEmployeeProfilePage'
import PendingChangesPage from './routes/PendingChangesPage'

function Home() {
  return <Navigate to={isReviewer(useActor()) ? '/approvals' : '/requisitions'} replace />
}

/** Employee profiles are signed-in only (see the API's session model); everything else uses the dev actor. */
function RequireSession({ children }: { children: ReactNode }) {
  const auth = useAuth()
  if (!auth) {
    return (
      <main className="content">
        <h1 className="heading-lg">Sign in required</h1>
        <p className="text-muted">Sign in to view employee profiles.</p>
      </main>
    )
  }
  return <>{children}</>
}

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

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route path="/requisitions" element={<MyRequisitionsPage />} />
      <Route path="/requisitions/new" element={<RequisitionFormPage />} />
      <Route path="/requisitions/:id" element={<RequisitionDetailPage />} />
      <Route path="/requisitions/:id/edit" element={<RequisitionFormPage />} />
      <Route path="/approvals" element={<ApprovalQueuePage />} />
      <Route path="/open-requisitions" element={<MyRequisitionsPage mode="open" />} />
      <Route path="/jobs" element={<JobBoardPage />} />
      <Route path="/jobs/:id" element={<JobPostingPage />} />

      <Route
        path="/employees"
        element={
          <RequireSession>
            <EmployeeDirectoryPage />
          </RequireSession>
        }
      />
      <Route
        path="/employees/new"
        element={
          <RequireSession>
            <RequireHrAdmin title="New employee profile" message="Only HR Admins can create employee profiles. No profile was created.">
              <NewEmployeeProfilePage />
            </RequireHrAdmin>
          </RequireSession>
        }
      />
      <Route
        path="/employees/:id"
        element={
          <RequireSession>
            <EmployeeProfileDetailPage />
          </RequireSession>
        }
      />
      <Route
        path="/employees/:id/edit"
        element={
          <RequireSession>
            <RequireHrAdmin title="Edit employee profile" message="Only HR Admins can edit employee profiles. No changes were saved.">
              <EditEmployeeProfilePage />
            </RequireHrAdmin>
          </RequireSession>
        }
      />
      <Route
        path="/me"
        element={
          <RequireSession>
            <MyProfilePage />
          </RequireSession>
        }
      />
      <Route
        path="/pending-changes"
        element={
          <RequireSession>
            <RequireHrAdmin title="Pending changes" message="Only HR Admins can review pending changes.">
              <PendingChangesPage />
            </RequireHrAdmin>
          </RequireSession>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <ActorProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </ActorProvider>
  )
}

export default App
