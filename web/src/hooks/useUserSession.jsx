import React, { createContext, useContext, useState, useEffect } from 'react'
import { fetchUserByTelegramId, fetchUserByUsername } from '../services/users'

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tgUserIdParam = params.get('tg_user_id')
    const usernameParam = params.get('username')

    if (tgUserIdParam || usernameParam) {
      const performAutoLogin = async () => {
        try {
          let user = null
          if (tgUserIdParam) {
            const tgId = parseInt(tgUserIdParam, 10)
            if (!isNaN(tgId)) {
              user = await fetchUserByTelegramId(tgId)
            }
          } else if (usernameParam) {
            user = await fetchUserByUsername(usernameParam)
          }

          if (user) {
            login(user)
          }
        } catch (err) {
          console.error('Failed auto-login via URL params:', err)
        } finally {
          // Immediately sanitise URL parameters
          params.delete('tg_user_id')
          params.delete('username')
          const newSearch = params.toString()
          const newPath = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash
          window.history.replaceState(null, '', newPath)
        }
      }
      performAutoLogin()
    }
  }, [])

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
