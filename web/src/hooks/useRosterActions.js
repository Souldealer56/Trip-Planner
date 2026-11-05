import { useState, useEffect, useMemo } from 'react'
import {
  updateRsvpNote,
  updateRsvpStatus,
  promoteToCoOrganizer,
  demoteCoOrganizer,
  updateRsvpDetails,
  createRsvp,
  isUserTripAdmin
} from '../services/rsvps'

export function useRosterActions({
  tripId,
  trip,
  roster = [],
  setRoster,
  activeUser,
  refreshRoster,
  onActivityLogged,
  updateActiveUser
}) {
  const safeRoster = Array.isArray(roster) ? roster : []
  const [userNote, setUserNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showCopiedToast, setShowCopiedToast] = useState(false)
  const [reconcileLoading, setReconcileLoading] = useState(false)
  const [reconcileError, setReconcileError] = useState('')
  const [rosterError, setRosterError] = useState('')
  const [rosterSuccess, setRosterSuccess] = useState('')

  const activeUserRsvp = safeRoster.find((m) => m?.user_id === activeUser?.id)
  const isAdmin = isUserTripAdmin(activeUser, trip, activeUserRsvp)

  useEffect(() => {
    if (activeUser && safeRoster.length > 0) {
      const activeMember = safeRoster.find((m) => m?.user_id === activeUser.id)
      if (activeMember) setUserNote(activeMember.notes || '')
    }
  }, [activeUser, safeRoster])

  const activeUserInRoster = useMemo(() => {
    if (!activeUser) return false
    if (!trip) return true // Do not flag while trip is still loading
    if (String(trip.organizer_id) === String(activeUser.id)) return true

    const userEmail = activeUser.email?.trim().toLowerCase()
    const userUsername = activeUser.username?.trim().toLowerCase()

    return safeRoster.some((r) => {
      if (String(r?.user_id) === String(activeUser.id)) return true
      const rosterEmail = r?.users?.email?.trim().toLowerCase()
      if (rosterEmail && userEmail && rosterEmail === userEmail) return true
      const rosterUsername = (r?.users?.username || r?.username)?.trim().toLowerCase()
      if (rosterUsername && userUsername && rosterUsername === userUsername) return true
      return false
    })
  }, [activeUser, trip, safeRoster])

  // Session reconciliation: if matched by email or username with different ID, update session UUID
  useEffect(() => {
    if (!activeUser || !safeRoster.length || !updateActiveUser) return
    const userEmail = activeUser.email?.trim().toLowerCase()
    const userUsername = activeUser.username?.trim().toLowerCase()

    for (const r of safeRoster) {
      const rosterEmail = r.users?.email?.trim().toLowerCase()
      const rosterUsername = (r.users?.username || r.username)?.trim().toLowerCase()
      const matchesEmail = rosterEmail && userEmail && rosterEmail === userEmail
      const matchesUsername = rosterUsername && userUsername && rosterUsername === userUsername

      if ((matchesEmail || matchesUsername) && r.user_id && r.user_id !== activeUser.id) {
        updateActiveUser({
          id: r.user_id,
          first_name: r.users?.first_name || activeUser.first_name,
          username: r.users?.username || activeUser.username,
          email: r.users?.email || activeUser.email
        })
        break
      }
    }
  }, [activeUser, safeRoster, updateActiveUser])

  const handleJoinRoster = async () => {
    if (!activeUser) return
    setReconcileLoading(true)
    setReconcileError('')
    try {
      await createRsvp(tripId, activeUser.id, 'Interested', 'member')
      if (refreshRoster) refreshRoster()
      if (onActivityLogged) onActivityLogged()
    } catch (err) {
      console.error('Failed to auto-join roster:', err)
      setReconcileError(err.message || 'Could not join roster. Please ask the organizer.')
    } finally {
      setReconcileLoading(false)
    }
  }

  const handleNoteBlur = async () => {
    if (!activeUser) return
    const currentMember = safeRoster.find((m) => m?.user_id === activeUser.id)
    if (!currentMember || currentMember.notes === userNote) return

    setSavingNote(true)
    setRosterError('')
    const previousRoster = safeRoster

    if (typeof setRoster === 'function') {
      setRoster((prev) => {
        const list = Array.isArray(prev) ? prev : []
        return list.map((m) => {
          if (String(m.user_id) === String(activeUser.id)) {
            return { ...m, notes: userNote }
          }
          return m
        })
      })
    }

    try {
      const updatedRow = await updateRsvpNote(tripId, activeUser.id, userNote)
      if (typeof setRoster === 'function' && updatedRow) {
        setRoster((prev) => {
          const list = Array.isArray(prev) ? prev : []
          return list.map((m) => {
            if (String(m.user_id) === String(activeUser.id)) {
              return { ...m, ...updatedRow, users: m.users }
            }
            return m
          })
        })
      }
      if (refreshRoster) refreshRoster()
      if (onActivityLogged) onActivityLogged()
    } catch (err) {
      console.error('Failed to save note:', err)
      if (typeof setRoster === 'function') {
        setRoster(previousRoster)
      }
      setRosterError(err.message || 'Failed to save note.')
      setTimeout(() => setRosterError(''), 5000)
    } finally {
      setSavingNote(false)
    }
  }

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/join/${trip?.invite_code || tripId}`
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setShowCopiedToast(true)
      setTimeout(() => setShowCopiedToast(false), 3000)
    }).catch((err) => {
      console.error('Failed to copy invite link:', err)
      prompt('Copy this invite link:', inviteUrl)
    })
  }

  const handleStatusChange = async (targetUserIdOrEvent, explicitStatus) => {
    let targetUserId = targetUserIdOrEvent
    let newStatus = explicitStatus

    if (targetUserIdOrEvent && typeof targetUserIdOrEvent === 'object' && targetUserIdOrEvent.target) {
      newStatus = targetUserIdOrEvent.target.value
      targetUserId = activeUser?.id
    } else if (!explicitStatus && typeof targetUserIdOrEvent === 'string') {
      if (['committed', 'tentative', 'declined', 'interested'].includes(targetUserIdOrEvent.toLowerCase())) {
        newStatus = targetUserIdOrEvent
        targetUserId = activeUser?.id
      }
    }

    if (!targetUserId && activeUser?.id) {
      targetUserId = activeUser.id
    }

    if (!targetUserId || !newStatus) return

    setRosterError('')
    const previousRoster = safeRoster

    // 1. Optimistic UI update
    if (typeof setRoster === 'function') {
      setRoster((prev) => {
        const list = Array.isArray(prev) ? prev : []
        return list.map((m) => {
          if (String(m.user_id) === String(targetUserId)) {
            return { ...m, status: newStatus }
          }
          return m
        })
      })
    }

    try {
      // 2. Defensive database mutation
      const updatedRow = await updateRsvpStatus(tripId, targetUserId, newStatus)

      // 3. Reconcile optimistic UI with returned row
      if (typeof setRoster === 'function' && updatedRow) {
        setRoster((prev) => {
          const list = Array.isArray(prev) ? prev : []
          return list.map((m) => {
            if (String(m.user_id) === String(targetUserId)) {
              return { ...m, ...updatedRow, users: m.users }
            }
            return m
          })
        })
      }

      setRosterSuccess(`RSVP status changed to ${newStatus}`)
      setTimeout(() => setRosterSuccess(''), 3000)

      if (refreshRoster) refreshRoster()
      if (onActivityLogged) onActivityLogged()
    } catch (err) {
      console.error('Failed to update status:', err)
      // Rollback optimistic update
      if (typeof setRoster === 'function') {
        setRoster(previousRoster)
      }
      setRosterError(err.message || 'Failed to update RSVP status.')
      setTimeout(() => setRosterError(''), 5000)
    }
  }

  const handlePromoteMember = async (targetUserId) => {
    setRosterError('')
    const previousRoster = safeRoster

    if (typeof setRoster === 'function') {
      setRoster((prev) => {
        const list = Array.isArray(prev) ? prev : []
        return list.map((m) => {
          if (String(m.user_id) === String(targetUserId)) {
            return { ...m, role: 'co_organizer', is_admin: true }
          }
          return m
        })
      })
    }

    try {
      const updatedRow = await promoteToCoOrganizer(tripId, targetUserId)
      if (typeof setRoster === 'function' && updatedRow) {
        setRoster((prev) => {
          const list = Array.isArray(prev) ? prev : []
          return list.map((m) => {
            if (String(m.user_id) === String(targetUserId)) {
              return { ...m, ...updatedRow, users: m.users }
            }
            return m
          })
        })
      }
      setRosterSuccess('Member promoted to co-organizer')
      setTimeout(() => setRosterSuccess(''), 3000)

      if (refreshRoster) refreshRoster()
      if (onActivityLogged) onActivityLogged()
    } catch (err) {
      console.error('Failed to promote participant:', err)
      if (typeof setRoster === 'function') {
        setRoster(previousRoster)
      }
      setRosterError(err.message || 'Failed to promote member.')
      setTimeout(() => setRosterError(''), 5000)
    }
  }

  const handleDemoteMember = async (targetUserId) => {
    setRosterError('')
    const previousRoster = safeRoster

    if (typeof setRoster === 'function') {
      setRoster((prev) => {
        const list = Array.isArray(prev) ? prev : []
        return list.map((m) => {
          if (String(m.user_id) === String(targetUserId)) {
            return { ...m, role: 'member', is_admin: false }
          }
          return m
        })
      })
    }

    try {
      const updatedRow = await demoteCoOrganizer(tripId, targetUserId)
      if (typeof setRoster === 'function' && updatedRow) {
        setRoster((prev) => {
          const list = Array.isArray(prev) ? prev : []
          return list.map((m) => {
            if (String(m.user_id) === String(targetUserId)) {
              return { ...m, ...updatedRow, users: m.users }
            }
            return m
          })
        })
      }
      setRosterSuccess('Co-organizer demoted to member')
      setTimeout(() => setRosterSuccess(''), 3000)

      if (refreshRoster) refreshRoster()
      if (onActivityLogged) onActivityLogged()
    } catch (err) {
      console.error('Failed to demote co-organizer:', err)
      if (typeof setRoster === 'function') {
        setRoster(previousRoster)
      }
      setRosterError(err.message || 'Failed to demote member.')
      setTimeout(() => setRosterError(''), 5000)
    }
  }

  const handleUpdateRsvpDetails = async (arg1, arg2, arg3) => {
    let targetUserId
    let details

    if (arg3 !== undefined) {
      targetUserId = arg2
      details = arg3
    } else {
      targetUserId = arg1
      details = arg2
    }

    if (!targetUserId && activeUser?.id) {
      targetUserId = activeUser.id
    }

    if (!targetUserId || !details) return

    setRosterError('')
    const previousRoster = safeRoster

    // 1. Optimistic UI update
    if (typeof setRoster === 'function') {
      setRoster((prev) => {
        const list = Array.isArray(prev) ? prev : []
        return list.map((m) => {
          if (String(m.user_id) === String(targetUserId)) {
            return { ...m, ...details }
          }
          return m
        })
      })
    }

    try {
      const updatedRow = await updateRsvpDetails(tripId, targetUserId, details)

      if (typeof setRoster === 'function' && updatedRow) {
        setRoster((prev) => {
          const list = Array.isArray(prev) ? prev : []
          return list.map((m) => {
            if (String(m.user_id) === String(targetUserId)) {
              return { ...m, ...updatedRow, users: m.users }
            }
            return m
          })
        })
      }

      if (refreshRoster) refreshRoster()
      if (onActivityLogged) onActivityLogged()
    } catch (err) {
      console.error('Failed to update RSVP details:', err)
      if (typeof setRoster === 'function') {
        setRoster(previousRoster)
      }
      setRosterError(err.message || 'Failed to update RSVP details.')
      setTimeout(() => setRosterError(''), 5000)
    }
  }

  return {
    userNote,
    setUserNote,
    savingNote,
    showCopiedToast,
    isAdmin,
    activeUserInRoster,
    reconcileLoading,
    reconcileError,
    rosterError,
    rosterSuccess,
    setRosterError,
    setRosterSuccess,
    handleJoinRoster,
    handleNoteBlur,
    handleCopyInviteLink,
    handleStatusChange,
    handlePromoteMember,
    handleDemoteMember,
    handleUpdateRsvpDetails
  }
}
