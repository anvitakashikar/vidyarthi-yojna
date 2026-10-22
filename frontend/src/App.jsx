import { Navigate, Routes, Route } from 'react-router-dom'

import Layout from './components/layout/Layout'
import OnboardingGate from './components/OnboardingGate'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import About from './pages/About'
import Contact from './pages/Contact'
import NotFound from './pages/NotFound'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import StudentDashboard from './pages/dashboard/StudentDashboard'
import StudentOnboarding from './pages/student/StudentOnboarding'
import DonorDashboard from './pages/dashboard/DonorDashboard'
import DonorsList from './pages/dashboard/DonorsList'
import DonorOnboarding from './pages/donor/DonorOnboarding'
import Donate from './pages/donor/Donate'
import AdminDashboard from './pages/dashboard/AdminDashboard'
import StudentDirectory from './pages/dashboard/StudentDirectory'
import Requirements from './pages/dashboard/Requirements'
import Payments from './pages/dashboard/Payments'
import Donations from './pages/dashboard/Donations'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />

        <Route path="login" element={<Navigate to="/login/student" replace />} />
        <Route path="login/:role" element={<Login />} />
        <Route path="register" element={<Navigate to="/register/student" replace />} />
        <Route path="register/:role" element={<Register />} />

        <Route element={<ProtectedRoute roles={['student']} />}>
          <Route path="student/onboarding" element={<StudentOnboarding />} />
          <Route element={<OnboardingGate />}>
            <Route path="student" element={<StudentDashboard />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute roles={['donor']} />}>
          <Route path="donor/onboarding" element={<DonorOnboarding />} />
          <Route element={<OnboardingGate />}>
            <Route path="donor" element={<DonorDashboard />} />
            <Route path="donor/donate" element={<Donate />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/students" element={<StudentDirectory />} />
          <Route path="admin/requirements" element={<Requirements />} />
          <Route path="admin/payments" element={<Payments />} />
          <Route path="admin/donations" element={<Donations />} />
          <Route path="admin/donors" element={<DonorsList />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
