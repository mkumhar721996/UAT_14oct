import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ActorProvider, isReviewer, useActor } from './auth/ActorContext'
import { ApprovalQueuePage } from './features/approvals/ApprovalQueuePage'
import { JobBoardPage } from './features/jobs/JobBoardPage'
import { JobPostingPage } from './features/jobs/JobPostingPage'
import { MyRequisitionsPage } from './features/requisitions/MyRequisitionsPage'
import { RequisitionDetailPage } from './features/requisitions/RequisitionDetailPage'
import { RequisitionFormPage } from './features/requisitions/RequisitionFormPage'

function Home() {
  return <Navigate to={isReviewer(useActor()) ? '/approvals' : '/requisitions'} replace />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <ActorProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ActorProvider>
  )
}

export default App
