import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { TopicsPage } from './pages/TopicsPage'
import { ProfilePage } from './pages/ProfilePage'
import { AuthCallback } from './pages/AuthCallback'

function App() {
  const { initialize, initialized } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="topics" element={<TopicsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  )
}

export default App
