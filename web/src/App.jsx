import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import TripsList from './views/TripsList'
import TripDetails from './views/TripDetails'

function App() {
  const [activeUser, setActiveUser] = useState(() => {
    const saved = localStorage.getItem('trip_planner_active_user')
    try {
      return saved ? JSON.parse(saved) : null
    } catch (e) {
      console.error('Failed to parse active user:', e)
      return null
    }
  })

  const login = (user) => {
    localStorage.setItem('trip_planner_active_user', JSON.stringify(user))
    setActiveUser(user)
  }

  const logout = () => {
    localStorage.removeItem('trip_planner_active_user')
    setActiveUser(null)
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/trips" replace />} />
        <Route path="/trips" element={<TripsList activeUser={activeUser} onLogout={logout} />} />
        <Route path="/trips/:id" element={<TripDetails activeUser={activeUser} onLogin={login} onLogout={logout} />} />
      </Routes>
    </Router>
  )
}

export default App
