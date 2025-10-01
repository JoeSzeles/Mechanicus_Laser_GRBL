import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import AuthContext from './contexts/AuthContext'
import { SerialProvider } from './contexts/SerialContext'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import CADInterface from './components/CADInterface'
import useCadStore from './store/cadStore'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const loadDefaultProfile = useCadStore(state => state.loadDefaultProfile)
  const loadMachineProfiles = useCadStore(state => state.loadMachineProfiles)

  useEffect(() => {
    // Check for existing token on app load
    const token = localStorage.getItem('token')
    if (token) {
      // Verify token with server
      fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => {
        if (res.ok) {
          return res.json()
        } else {
          localStorage.removeItem('token')
          throw new Error('Invalid token')
        }
      })
      .then(async (data) => {
        setUser(data.user)
        // Load machine profiles and default profile after authentication
        await loadMachineProfiles()
        await loadDefaultProfile()
        console.log('✅ User authenticated, default profile loaded')
      })
      .catch(err => {
        console.error('Auth error:', err)
      })
      .finally(() => {
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [loadMachineProfiles, loadDefaultProfile])

  const login = async (userData, token) => {
    localStorage.setItem('token', token)
    setUser(userData)
    // Load machine profiles and default profile after login
    await loadMachineProfiles()
    await loadDefaultProfile()
    console.log('✅ User logged in, default profile loaded')
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading Mechanicus...</p>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <SerialProvider>
        <div className="app">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/signup" element={<Register />} />
            <Route path="/dashboard" element={user ? <Dashboard /> : <Login />} />
            <Route path="/cad" element={user ? <CADInterface /> : <Login />} />
            <Route path="/" element={user ? <CADInterface /> : <Login />} />
          </Routes>
        </div>
      </SerialProvider>
    </AuthContext.Provider>
  )
}

export default App
