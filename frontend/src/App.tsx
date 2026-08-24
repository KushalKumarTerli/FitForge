import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Signup from '@/pages/Signup'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Workout from '@/pages/Workout'
import Nutrition from '@/pages/Nutrition'
import Health from '@/pages/Health'
import PlanBuilder from '@/pages/PlanBuilder'
import Profile from '@/pages/Profile'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/workout" element={<Workout />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/health" element={<Health />} />
        <Route path="/plans/new" element={<PlanBuilder />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
