import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Signup from '@/pages/Signup'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Workout from '@/pages/Workout'
import Nutrition from '@/pages/Nutrition'
import Health from '@/pages/Health'
import PlanBuilder from '@/pages/PlanBuilder'
import Profile from '@/pages/Profile'

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>
  )
}

function App() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/signup" element={<PageTransition><Signup /></PageTransition>} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
          <Route path="/workout" element={<PageTransition><Workout /></PageTransition>} />
          <Route path="/nutrition" element={<PageTransition><Nutrition /></PageTransition>} />
          <Route path="/health" element={<PageTransition><Health /></PageTransition>} />
          <Route path="/plans/new" element={<PageTransition><PlanBuilder /></PageTransition>} />
          <Route path="/profile" element={<PageTransition><Profile /></PageTransition>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

export default App
