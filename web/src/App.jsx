import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import TripsList from './views/TripsList'
import TripDetails from './views/TripDetails'
import VerifyLogin from './views/VerifyLogin'
import JoinTrip from './views/JoinTrip'
import Profile from './views/Profile'
import { UserSessionProvider } from './hooks/useUserSession'
import { ThemeProvider } from './hooks/useTheme'

function App() {
  return (
    <Router>
      <ThemeProvider>
        <UserSessionProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/trips" replace />} />
            <Route path="/trips" element={<TripsList />} />
            <Route path="/trips/:id" element={<TripDetails />} />
            <Route path="/verify" element={<VerifyLogin />} />
            <Route path="/join/:tripId" element={<JoinTrip />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </UserSessionProvider>
      </ThemeProvider>
    </Router>
  )
}

export default App
