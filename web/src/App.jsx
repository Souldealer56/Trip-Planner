import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import TripsList from './views/TripsList'
import TripDetails from './views/TripDetails'
import VerifyLogin from './views/VerifyLogin'
import { UserSessionProvider } from './hooks/useUserSession'

function App() {
  return (
    <Router>
      <UserSessionProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/trips" replace />} />
          <Route path="/trips" element={<TripsList />} />
          <Route path="/trips/:id" element={<TripDetails />} />
          <Route path="/verify" element={<VerifyLogin />} />
        </Routes>
      </UserSessionProvider>
    </Router>
  )
}

export default App

