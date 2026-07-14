import React, { createContext, useContext, useState } from 'react'

const UserSessionContext = createContext(null)

export function UserSessionProvider({ children }) {
  const [activeUser, setActiveUser] = useState(() => {
    const saved = localStorage.getItem('trip_planner_active_user')
    try {
      return saved ? JSON.parse(saved) : null
    } catch (e) {
      console.error('Error parsing active user from localStorage', e)
      return null
    }
  })

  const login = (user) => {
    if (!user) return
    localStorage.setItem('trip_planner_active_user', JSON.stringify(user))
    setActiveUser(user)
  }

  const logout = () => {
    localStorage.removeItem('trip_planner_active_user')
    setActiveUser(null)
  }

  return (
    <UserSessionContext.Provider value={{ activeUser, login, logout }}>
      {children}
    </UserSessionContext.Provider>
  )
}

export function useUserSession() {
  const context = useContext(UserSessionContext)
  if (context === undefined) {
    throw new Error('useUserSession must be used within a UserSessionProvider')
  }
  return context
}
