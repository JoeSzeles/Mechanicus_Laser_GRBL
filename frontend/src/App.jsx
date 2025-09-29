import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import AuthContext from './contexts/AuthContext'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import CADInterface from './components/CADInterface'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

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
      .then(data => {
        setUser(data.user)
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
  }, [])

  const login = (userData, token) => {
    localStorage.setItem('token', token)
    setUser(userData)
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
      <div className="app">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Login />} />
          <Route path="/cad" element={user ? <CADInterface /> : <Login />} />
          <Route path="/" element={user ? <CADInterface /> : <Login />} />
        </Routes>
      </div>
    </AuthContext.Provider>
  )
}

export default App
