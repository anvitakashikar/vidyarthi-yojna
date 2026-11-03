import { Navigate, Routes, Route } from 'react-router-dom'

import Layout from './components/layout/Layout'
import GuestRoute from './components/GuestRoute'
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
import DonorsList from './pages/dashboard/DonorsList'
import AdminDashboard from './pages/dashboard/AdminDashboard'
import StudentDirectory from './pages/dashboard/StudentDirectory'
import Requirements from './pages/dashboard/Requirements'
import Payments from './pages/dashboard/Payments'
import Donations from './pages/dashboard/Donations'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route element={<GuestRoute />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />

          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          {/* Old per-role links (/login/student, /register/student, …) */}
          <Route path="login/*" element={<Navigate to="/login" replace />} />
          <Route path="register/*" element={<Navigate to="/register" replace />} />
        </Route>

        <Route element={<ProtectedRoute roles={['student']} />}>
          <Route path="student/onboarding" element={<StudentOnboarding />} />
          <Route element={<OnboardingGate />}>
            <Route path="student" element={<StudentDashboard />} />
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

        <Route element={<GuestRoute />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}
