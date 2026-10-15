import React, { createContext, useContext, useState, useEffect } from 'react'
import { fetchUserByUsername } from '../services/users'

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

  const loginUser = (user) => {
    if (!user) return
    localStorage.setItem('trip_planner_active_user', JSON.stringify(user))
    setActiveUser(user)
  }

  const logoutUser = () => {
    localStorage.removeItem('trip_planner_active_user')
    setActiveUser(null)
  }

  const login = loginUser
  const logout = logoutUser

  const updateActiveUser = (updatedFields) => {
    setActiveUser(prev => {
      if (!prev) return null
      const updated = { ...prev, ...updatedFields }
      localStorage.setItem('trip_planner_active_user', JSON.stringify(updated))
      return updated
    })
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const usernameParam = params.get('username')

    if (usernameParam) {
      const performAutoLogin = async () => {
        try {
          const user = await fetchUserByUsername(usernameParam)
          if (user) {
            loginUser(user)
          }
        } catch (err) {
          console.error('Failed auto-login via URL username:', err)
        } finally {
          params.delete('username')
          params.delete('tg_user_id')
          const newSearch = params.toString()
          const newPath = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash
          window.history.replaceState(null, '', newPath)
        }
      }
      performAutoLogin()
    }
  }, [])

  return (
    <UserSessionContext.Provider value={{ activeUser, loginUser, login, logoutUser, logout, updateActiveUser }}>
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
