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
  roster,
  activeUser,
  refreshRoster,
  onActivityLogged,
  updateActiveUser
}) {
  const [userNote, setUserNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showCopiedToast, setShowCopiedToast] = useState(false)
  const [reconcileLoading, setReconcileLoading] = useState(false)
  const [reconcileError, setReconcileError] = useState('')

  const activeUserRsvp = roster.find((m) => m.user_id === activeUser?.id)
  const isAdmin = isUserTripAdmin(activeUser, trip, activeUserRsvp)

  useEffect(() => {
    if (activeUser && roster.length > 0) {
      const activeMember = roster.find((m) => m.user_id === activeUser.id)
      if (activeMember) setUserNote(activeMember.notes || '')
    }
  }, [activeUser, roster])

  const activeUserInRoster = useMemo(() => {
    if (!activeUser) return false
    if (!trip) return true // Do not flag while trip is still loading
    if (String(trip.organizer_id) === String(activeUser.id)) return true

    const userEmail = activeUser.email?.trim().toLowerCase()
    const userUsername = activeUser.username?.trim().toLowerCase()

    return roster.some((r) => {
      if (String(r.user_id) === String(activeUser.id)) return true
      const rosterEmail = r.users?.email?.trim().toLowerCase()
      if (rosterEmail && userEmail && rosterEmail === userEmail) return true
      const rosterUsername = (r.users?.username || r.username)?.trim().toLowerCase()
      if (rosterUsername && userUsername && rosterUsername === userUsername) return true
      return false
    })
  }, [activeUser, trip, roster])

  // Session reconciliation: if matched by email or username with different ID, update session UUID
  useEffect(() => {
    if (!activeUser || !roster.length || !updateActiveUser) return
    const userEmail = activeUser.email?.trim().toLowerCase()
    const userUsername = activeUser.username?.trim().toLowerCase()

    for (const r of roster) {
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
  }, [activeUser, roster, updateActiveUser])

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
    const currentMember = roster.find((m) => m.user_id === activeUser.id)
    if (!currentMember || currentMember.notes === userNote) return

    setSavingNote(true)
    try {
      await updateRsvpNote(tripId, activeUser.id, userNote)
      if (refreshRoster) refreshRoster()
      if (onActivityLogged) onActivityLogged()
    } catch (err) {
      console.error('Failed to save note:', err)
      alert('Failed to save note: ' + err.message)
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

  const handleStatusChange = async (targetUserId, newStatus) => {
    try {
      await updateRsvpStatus(tripId, targetUserId, newStatus)
      if (refreshRoster) refreshRoster()
      if (onActivityLogged) onActivityLogged()
    } catch (err) {
      console.error('Failed to update status:', err)
      alert(err.message || 'Failed to update RSVP status.')
    }
  }

  const handlePromoteMember = async (targetUserId) => {
    try {
      await promoteToCoOrganizer(tripId, targetUserId)
      if (refreshRoster) refreshRoster()
      if (onActivityLogged) onActivityLogged()
    } catch (err) {
      console.error('Failed to promote participant:', err)
      alert(err.message || 'Failed to promote member.')
    }
  }

  const handleDemoteMember = async (targetUserId) => {
    try {
      await demoteCoOrganizer(tripId, targetUserId)
      if (refreshRoster) refreshRoster()
      if (onActivityLogged) onActivityLogged()
    } catch (err) {
      console.error('Failed to demote co-organizer:', err)
      alert(err.message || 'Failed to demote member.')
    }
  }

  const handleUpdateRsvpDetails = async (rsvpId, targetUserId, details) => {
    try {
      await updateRsvpDetails(rsvpId, targetUserId, details)
      if (refreshRoster) refreshRoster()
      if (onActivityLogged) onActivityLogged()
    } catch (err) {
      console.error('Failed to update RSVP details:', err)
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
    handleJoinRoster,
    handleNoteBlur,
    handleCopyInviteLink,
    handleStatusChange,
    handlePromoteMember,
    handleDemoteMember,
    handleUpdateRsvpDetails
  }
}
