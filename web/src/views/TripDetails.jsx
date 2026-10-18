import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTripDetails } from '../hooks/useTripDetails'
import { useRsvpRoster } from '../hooks/useRsvpRoster'
import { useAddParticipant } from '../hooks/useAddParticipant'
import { useUserSession } from '../hooks/useUserSession'
import { useTripRealtime } from '../hooks/useTripRealtime'
import { updateRsvpNote, updateRsvpStatus, createRsvp, isUserTripAdmin, promoteToCoOrganizer, demoteCoOrganizer, updateRsvpDetails } from '../services/rsvps'
import { fetchOptions, pitchOption, toggleVote, fetchActivePoll, checkOptionDateConflict, fetchAllTripOptions, lockOption, deleteOption, updateOptionDates, toggleOptionParticipant } from '../services/options'
import { updateTrip, archiveTrip, unarchiveTrip, deleteTrip } from '../services/trips'
import { fetchExpenses, logExpense } from '../services/expenses'
import { fetchExchangeRates, convertCurrency, calculateSettlements, calculateExpenseParticipantShares } from '../utils/currency'
import { fetchActivityLogs } from '../services/activity'
import { generateICalContent, downloadICalFile } from '../utils/ical'
import { saveTripOfflineSnapshot, loadTripOfflineSnapshot, isNetworkOffline } from '../utils/offlineCache'

// Modular Trip Components
import { TripHeader } from '../components/trip/TripHeader'
import { RosterSection } from '../components/trip/RosterSection'
import { OptionsTab } from '../components/trip/OptionsTab'
import { LedgerAndSettleTab } from '../components/trip/LedgerAndSettleTab'
import { ActivityFeedDrawer } from '../components/trip/ActivityFeedDrawer'

// Modular Modals
import { PitchOptionModal } from '../components/modals/PitchOptionModal'
import { AddExpenseModal } from '../components/modals/AddExpenseModal'
import { EditTripModal } from '../components/modals/EditTripModal'
import { PrintableItineraryModal, PollRecapModal } from '../components/modals/PrintableItineraryModal'

const CATEGORIES = ['Accommodation', 'Flights', 'Activities', 'Food', 'Transport', 'Other']

function TripDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeUser, login: onLogin, logout: onLogout, updateActiveUser } = useUserSession()

  // Redirect unauthenticated travelers back to splash screen
  useEffect(() => {
    if (!activeUser) {
      navigate('/trips')
    }
  }, [activeUser, navigate])

  // Core Trip & Roster Data
  const { data: trip, loading: tripLoading, error: tripError, isOffline: tripIsOffline, refresh: refreshTrip } = useTripDetails(id)
  const { data: roster = [], loading: rosterLoading, error: rosterError, refresh: refreshRoster } = useRsvpRoster(id)
  const { addParticipant, loading: joinLoading, error: joinError } = useAddParticipant()

  // Offline state detection
  const [offlineSnapshot, setOfflineSnapshot] = useState(() => loadTripOfflineSnapshot(id))
  const isOffline = tripIsOffline || !navigator.onLine || Boolean(offlineSnapshot && !trip && !tripLoading)

  // Activity Feed States
  const [activityLogs, setActivityLogs] = useState([])
  const [showActivityDrawer, setShowActivityDrawer] = useState(false)
  const [lastReadTimestamp, setLastReadTimestamp] = useState(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(`trip_planner_last_read_log_${id}`) : null
  })

  const loadActivityLogs = useCallback(async () => {
    try {
      const logs = await fetchActivityLogs(id)
      setActivityLogs(logs || [])
    } catch (err) {
      console.warn('Failed to load activity logs:', err)
    }
  }, [id])

  useEffect(() => {
    if (activeUser) {
      loadActivityLogs()
    }
  }, [activeUser, loadActivityLogs])

  const unreadCount = useMemo(() => {
    if (!lastReadTimestamp) return activityLogs.length
    const lastReadTime = new Date(lastReadTimestamp).getTime()
    return activityLogs.filter((log) => new Date(log.created_at).getTime() > lastReadTime).length
  }, [activityLogs, lastReadTimestamp])

  const handleToggleDrawer = () => {
    const nextShow = !showActivityDrawer
    setShowActivityDrawer(nextShow)
    if (nextShow && typeof localStorage !== 'undefined') {
      const nowIso = new Date().toISOString()
      setLastReadTimestamp(nowIso)
      localStorage.setItem(`trip_planner_last_read_log_${id}`, nowIso)
    }
  }

  // Options & Polls
  const [activeTab, setActiveTab] = useState('Accommodation')
  const [options, setOptions] = useState(() => offlineSnapshot?.options || [])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [activePoll, setActivePoll] = useState(null)
  const [viewMode, setViewMode] = useState('grid')
  const [allTripOptions, setAllTripOptions] = useState([])
  const [allActivePollsMap, setAllActivePollsMap] = useState({})
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('itinerary')

  const loadOptionsAndPoll = useCallback(async (silent = false) => {
    if (!silent) setOptionsLoading(true)
    try {
      const [opts, allOpts] = await Promise.all([
        fetchOptions(id, activeTab),
        fetchAllTripOptions(id)
      ])
      const filteredFromAll = (allOpts || []).filter(
        (o) => o.category?.trim().toLowerCase() === activeTab.trim().toLowerCase()
      )
      const unifiedCategoryOpts = filteredFromAll.length > 0 ? filteredFromAll : (opts || [])
      setOptions(unifiedCategoryOpts)
      if (allOpts) setAllTripOptions(allOpts)

      const poll = await fetchActivePoll(id, activeTab)
      setActivePoll(poll)
      saveTripOfflineSnapshot(id, { options: unifiedCategoryOpts })
    } catch (err) {
      console.warn('Failed to load options/poll, falling back to cache:', err)
      const cached = loadTripOfflineSnapshot(id)
      if (cached?.options) setOptions(cached.options)
    } finally {
      if (!silent) setOptionsLoading(false)
    }
  }, [id, activeTab])

  const loadGanttData = useCallback(async () => {
    try {
      const allOpts = await fetchAllTripOptions(id)
      setAllTripOptions(allOpts || [])
      const filteredForActiveTab = (allOpts || []).filter(
        (o) => o.category?.trim().toLowerCase() === activeTab.trim().toLowerCase()
      )
      if (filteredForActiveTab.length > 0) {
        setOptions(filteredForActiveTab)
      }
      const map = {}
      for (const cat of CATEGORIES) {
        const poll = await fetchActivePoll(id, cat)
        if (poll) map[cat.toLowerCase()] = poll
      }
      setAllActivePollsMap(map)
    } catch (err) {
      console.warn('Failed to load Gantt data:', err)
    }
  }, [id, activeTab])

  // Single source of truth for active category options
  const categoryOptions = useMemo(() => {
    if (allTripOptions && allTripOptions.length > 0) {
      const filtered = allTripOptions.filter(
        (opt) => opt.category?.trim().toLowerCase() === activeTab.trim().toLowerCase()
      )
      if (filtered.length > 0 || !options || options.length === 0) {
        return filtered
      }
    }
    return options || []
  }, [allTripOptions, activeTab, options])

  useEffect(() => {
    if (activeUser) {
      loadOptionsAndPoll()
      loadGanttData()
    }
  }, [activeUser, activeTab, loadOptionsAndPoll, loadGanttData])

  useEffect(() => {
    if (viewMode === 'gantt') {
      loadGanttData()
    }
  }, [viewMode, loadGanttData])

  // Expenses & Settlements
  const [expenses, setExpenses] = useState(() => offlineSnapshot?.expenses || [])
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [rates, setRates] = useState(null)
  const [ledgerTab, setLedgerTab] = useState('ledger')

  const loadExpenses = useCallback(async (silent = false) => {
    if (!silent) setExpensesLoading(true)
    try {
      const data = await fetchExpenses(id)
      setExpenses(data)
      saveTripOfflineSnapshot(id, { expenses: data })
    } catch (err) {
      console.warn('Failed to load expenses, checking offline cache:', err)
      const cached = loadTripOfflineSnapshot(id)
      if (cached?.expenses) setExpenses(cached.expenses)
    } finally {
      if (!silent) setExpensesLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (activeUser) {
      loadExpenses()
      fetchExchangeRates().then(setRates).catch(console.warn)
    }
  }, [activeUser, loadExpenses])

  // Cache trip & roster changes
  useEffect(() => {
    if (trip || roster.length > 0) {
      saveTripOfflineSnapshot(id, { trip, roster })
    }
  }, [id, trip, roster])

  // Modals States
  const [showPitchModal, setShowPitchModal] = useState(false)
  const [pitchInitialCategory, setPitchInitialCategory] = useState('Accommodation')
  const [pitchInitialDates, setPitchInitialDates] = useState({ start: '', end: '' })
  const [pitchLoading, setPitchLoading] = useState(false)
  const [pitchError, setPitchError] = useState('')

  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseOptionToPreFill, setExpenseOptionToPreFill] = useState(null)
  const [expenseLoading, setExpenseLoading] = useState(false)
  const [expenseError, setExpenseError] = useState('')

  const [showEditTripModal, setShowEditTripModal] = useState(false)
  const [editingTripSnapshot, setEditingTripSnapshot] = useState(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [showReconcileModal, setShowReconcileModal] = useState(false)
  const [conflictingOptions, setConflictingOptions] = useState([])

  const [showPollRecapModal, setShowPollRecapModal] = useState(false)
  const [showPrintableItineraryModal, setShowPrintableItineraryModal] = useState(false)

  // RSVP note editing state
  const [userNote, setUserNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showCopiedToast, setShowCopiedToast] = useState(false)

  const activeUserRsvp = roster.find((m) => m.user_id === activeUser?.id)
  const isAdmin = isUserTripAdmin(activeUser, trip, activeUserRsvp)

  useEffect(() => {
    if (activeUser && roster.length > 0) {
      const activeMember = roster.find((m) => m.user_id === activeUser.id)
      if (activeMember) setUserNote(activeMember.notes || '')
    }
  }, [activeUser, roster])

  // Real-time collaborative synchronization across all connected travelers
  const { realtimeStatus } = useTripRealtime(
    id,
    {
      onTripChange: () => {
        refreshTrip()
      },
      onRosterChange: () => {
        refreshRoster()
      },
      onOptionsChange: () => {
        loadOptionsAndPoll(true)
        loadGanttData()
      },
      onExpensesChange: () => {
        loadExpenses(true)
      },
      onActivityChange: () => {
        loadActivityLogs()
      }
    },
    300
  )

  // Handlers
  const handleRefresh = () => {
    refreshTrip()
    refreshRoster()
    if (activeUser) {
      loadOptionsAndPoll()
      loadGanttData()
      loadExpenses()
      loadActivityLogs()
      fetchExchangeRates().then(setRates).catch(console.warn)
    }
  }

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/join/${id}`
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        setShowCopiedToast(true)
        setTimeout(() => setShowCopiedToast(false), 2000)
      })
      .catch((err) => {
        console.error('Failed to copy invite link:', err)
        alert('Invite link: ' + inviteUrl)
      })
  }

  const handleNoteBlur = async () => {
    if (!activeUser) return
    const activeMember = roster.find((m) => m.user_id === activeUser.id)
    if (userNote.trim() === (activeMember?.notes || '').trim()) return
    setSavingNote(true)
    try {
      await updateRsvpNote(id, activeUser.id, userNote.trim() || null)
      refreshRoster()
    } catch (err) {
      console.error('Failed to update note:', err)
    } finally {
      setSavingNote(false)
    }
  }

  const handleStatusChange = async (e) => {
    if (!activeUser) return
    try {
      await updateRsvpStatus(id, activeUser.id, e.target.value)
      refreshRoster()
    } catch (err) {
      console.error('Failed to update RSVP status:', err)
    }
  }

  const handlePromoteMember = async (userId) => {
    if (!isAdmin) return
    try {
      await promoteToCoOrganizer(id, userId)
      refreshRoster()
    } catch (err) {
      console.error('Failed to promote user:', err)
    }
  }

  const handleDemoteMember = async (userId) => {
    if (!isAdmin) return
    try {
      await demoteCoOrganizer(id, userId)
      refreshRoster()
    } catch (err) {
      console.error('Failed to demote user:', err)
    }
  }

  const handleVoteToggle = async (optionId, hasVoted) => {
    if (!activeUser) return
    try {
      const updatedPoll = await toggleVote(id, activeTab, optionId, activeUser.id, !hasVoted)
      setActivePoll(updatedPoll)
      await Promise.all([loadOptionsAndPoll(true), loadGanttData()])
      loadActivityLogs()
    } catch (err) {
      console.error('Failed to toggle vote:', err)
    }
  }

  const handleLockToggle = async (optionId) => {
    if (!activeUser) return
    try {
      const updatedPoll = await lockOption(id, activeTab, optionId, activeUser.id)
      setActivePoll(updatedPoll)
      await Promise.all([loadOptionsAndPoll(true), loadGanttData()])
      loadActivityLogs()
    } catch (err) {
      console.error('Failed to toggle lock option:', err)
    }
  }

  const handleDeleteOption = async (optionId) => {
    try {
      await deleteOption(optionId, id, activeUser?.id)
      await Promise.all([loadOptionsAndPoll(true), loadGanttData()])
      loadActivityLogs()
    } catch (err) {
      console.error('Failed to delete option:', err)
      alert('Failed to delete option: ' + (err.message || err))
    }
  }

  const handleUpdateOptionDates = async (optionId, startDate, endDate) => {
    try {
      await updateOptionDates(optionId, startDate, endDate, id, activeUser?.id)
      await Promise.all([loadOptionsAndPoll(true), loadGanttData()])
      loadActivityLogs()
    } catch (err) {
      console.error('Failed to update option dates:', err)
      alert('Failed to update option dates: ' + (err.message || err))
    }
  }

  const handleToggleOptionParticipant = async (optionId, currentAssignedUsers, fallbackAllUserIds = []) => {
    if (!activeUser) return
    try {
      await toggleOptionParticipant(optionId, activeUser.id, currentAssignedUsers, fallbackAllUserIds)
      await Promise.all([loadOptionsAndPoll(true), loadGanttData()])
      loadActivityLogs()
    } catch (err) {
      console.error('Failed to toggle option participant:', err)
    }
  }

  const handleUpdateRsvpDetails = async (userId, details) => {
    try {
      await updateRsvpDetails(id, userId, details)
      refreshRoster()
      loadActivityLogs()
    } catch (err) {
      console.error('Failed to update RSVP details:', err)
    }
  }

  const handlePitchSubmit = async ({ category, name, cost, currency, link, description, startDate, endDate, costType }) => {
    setPitchLoading(true)
    setPitchError('')
    try {
      await pitchOption(
        id,
        category,
        name,
        cost,
        currency,
        link,
        description,
        activeUser.id,
        startDate,
        endDate,
        costType || 'split_total'
      )
      setShowPitchModal(false)
      if (activeTab !== category) {
        setActiveTab(category)
      }
      await Promise.all([loadOptionsAndPoll(true), loadGanttData()])
      loadActivityLogs()
    } catch (err) {
      console.error('Failed to pitch option:', err)
      setPitchError(err.message || 'Failed to pitch option.')
    } finally {
      setPitchLoading(false)
    }
  }

  const handleExpenseSubmit = async ({ description, amount, currency, category, paidBy, splitUsers, optionId }) => {
    setExpenseLoading(true)
    setExpenseError('')
    try {
      await logExpense(
        id,
        paidBy,
        amount,
        currency,
        description,
        splitUsers,
        category,
        optionId
      )
      setShowExpenseModal(false)
      loadExpenses()
      loadActivityLogs()
    } catch (err) {
      console.error('Failed to log expense:', err)
      setExpenseError(err.message || 'Failed to log expense.')
    } finally {
      setExpenseLoading(false)
    }
  }

  const handleLogGroceryExpense = async (expenseData) => {
    try {
      const {
        paid_by,
        amount,
        currency,
        description,
        split_details,
        category,
        option_id
      } = expenseData
      const splitUsers = split_details ? Object.keys(split_details) : []
      await logExpense(
        id,
        paid_by || activeUser?.id,
        amount,
        currency || trip?.base_currency || 'USD',
        description,
        splitUsers,
        category || 'food',
        option_id || null
      )
      loadExpenses()
      loadActivityLogs()
    } catch (err) {
      console.error('Failed to log grocery expense:', err)
      throw err
    }
  }

  const handleSubmitMeal = async (mealData) => {
    try {
      await pitchOption(
        id,
        mealData.category || 'Food',
        mealData.option_text,
        mealData.estimated_cost,
        mealData.currency || trip?.base_currency || 'USD',
        mealData.link || '',
        mealData.start_date || '',
        mealData.end_date || '',
        activeUser?.id,
        mealData.cost_type || 'split_total',
        mealData.assigned_users || [],
        mealData.metadata || {}
      )
      await loadOptionsAndPoll()
      loadActivityLogs()
    } catch (err) {
      console.error('Failed to submit meal:', err)
      throw err
    }
  }

  const handleEditTripSubmit = async ({ title, destination, vibe, startDate, endDate, baseCurrency }) => {
    setEditLoading(true)
    setEditError('')
    try {
      const datesChanged = startDate !== trip?.start_date || endDate !== trip?.end_date
      await updateTrip(id, {
        title,
        destination,
        vibe,
        start_date: startDate,
        end_date: endDate,
        base_currency: baseCurrency
      })
      setShowEditTripModal(false)
      setEditingTripSnapshot(null)
      refreshTrip()
      loadActivityLogs()

      if (datesChanged && startDate && endDate) {
        const allOptions = await fetchAllTripOptions(id)
        const conflicts = allOptions.filter((opt) => checkOptionDateConflict(opt, startDate, endDate))
        if (conflicts.length > 0) {
          setConflictingOptions(conflicts)
          setShowReconcileModal(true)
        }
      }
    } catch (err) {
      console.error('Failed to update trip:', err)
      setEditError(err.message || 'Failed to update trip.')
    } finally {
      setEditLoading(false)
    }
  }

  const handleToggleArchive = async () => {
    if (!trip) return
    try {
      if (trip.is_archived) await unarchiveTrip(id)
      else await archiveTrip(id)
      refreshTrip()
      setShowEditTripModal(false)
      setEditingTripSnapshot(null)
    } catch (err) {
      console.error('Failed to toggle archive state:', err)
      alert('Failed to update archive status: ' + err.message)
    }
  }

  const handleConfirmDelete = async () => {
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await deleteTrip(id)
      navigate('/trips')
    } catch (err) {
      console.error('Failed to delete trip:', err)
      setDeleteError(err.message || 'Failed to delete trip.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleExportICal = () => {
    const opts = allTripOptions.length > 0 ? allTripOptions : options
    const icalStr = generateICalContent(trip, opts)
    downloadICalFile(`${(trip?.title || 'Trip').replace(/\s+/g, '_')}_itinerary.ics`, icalStr)
  }

  // Cost & Balance Calculations
  const committedMembers = roster.filter((m) => m.status === 'Committed')
  const baseCurrency = trip?.base_currency || 'USD'

  const memberBalances = {}
  committedMembers.forEach((m) => {
    memberBalances[m.user_id] = {
      userId: m.user_id,
      name: m.users?.first_name || m.username || 'Member',
      paid: 0.0,
      owed: 0.0
    }
  })

  let totalGroupSpend = 0.0
  if (rates && expenses.length > 0) {
    expenses.forEach((exp) => {
      const payerId = exp.paid_by
      const originalAmount = parseFloat(exp.amount)
      const expCurrency = exp.currency || 'USD'
      const convertedAmount = exp.exchange_rate
        ? originalAmount * parseFloat(exp.exchange_rate)
        : convertCurrency(originalAmount, expCurrency, baseCurrency, rates)

      const fallbackUserIds = committedMembers.map((m) => m.user_id)
      const userShares = calculateExpenseParticipantShares(convertedAmount, exp.split_users, fallbackUserIds)

      userShares.forEach((owedShare, uIdStr) => {
        const targetKey = Object.keys(memberBalances).find((k) => String(k) === uIdStr)
        if (targetKey && memberBalances[targetKey]) {
          memberBalances[targetKey].owed += owedShare
        }
      })

      const payerKey = Object.keys(memberBalances).find((k) => String(k) === String(payerId))
      if (payerKey && memberBalances[payerKey]) {
        memberBalances[payerKey].paid += convertedAmount
        totalGroupSpend += convertedAmount
      }
    })
  }

  const settlementsList = rates ? calculateSettlements(memberBalances) : []
  const perPersonSplit = committedMembers.length > 0 ? totalGroupSpend / committedMembers.length : 0.0

  const totalOptionsCount = allTripOptions.length > 0 ? allTripOptions.length : options.length
  const expensesCount = expenses.length
  const rosterCount = roster.length

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

      if ((matchesEmail || matchesUsername) && String(activeUser.id) !== String(r.user_id)) {
        updateActiveUser({ ...activeUser, id: r.user_id })
        break
      }
    }
  }, [activeUser, roster, updateActiveUser])

  const [reconcileLoading, setReconcileLoading] = useState(false)
  const [reconcileError, setReconcileError] = useState('')

  const handleJoinRoster = async () => {
    if (!activeUser || !id) return
    setReconcileLoading(true)
    setReconcileError('')
    try {
      await createRsvp(id, activeUser.id, 'Committed')
      await refreshRoster()
    } catch (err) {
      console.error('Failed to join roster:', err)
      setReconcileError(err.message || 'Failed to join roster.')
    } finally {
      setReconcileLoading(false)
    }
  }

  if ((tripLoading || rosterLoading) && !trip && !offlineSnapshot?.trip) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="skeleton skeleton-title" style={{ width: '50%', margin: '0 auto 1rem' }} />
        <div className="skeleton skeleton-text" style={{ width: '80%', margin: '0 auto' }} />
      </div>
    )
  }

  if ((tripError || rosterError) && !trip && !offlineSnapshot?.trip) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'hsl(0, 85%, 65%)' }}>
        <h2>Error Loading Trip</h2>
        <p>{tripError || rosterError}</p>
        <button onClick={handleRefresh} className="btn" style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="trip-details-container animate-fade-in">
      {/* Blocking Modal strictly if user is confirmed NOT in roster after loading completes */}
      {!tripLoading && !rosterLoading && trip !== null && activeUser && !activeUserInRoster && (
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-fade-in" style={{ textAlign: 'center', maxWidth: '400px' }}>
            <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem' }}>Not on the Roster</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              You are signed in as <strong>{activeUser.first_name || activeUser.username || 'Traveler'}</strong>, but you are not registered on this trip.
            </p>
            {reconcileError && (
              <p style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {reconcileError}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button onClick={handleJoinRoster} className="btn" disabled={reconcileLoading} style={{ width: '100%' }}>
                {reconcileLoading ? 'Joining...' : 'Join Trip'}
              </button>
              <button onClick={onLogout} className="btn btn-secondary" style={{ width: '100%' }}>
                Switch Profile / Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Trip Cockpit Header */}
      <TripHeader
        trip={trip}
        activeUser={activeUser}
        isOffline={isOffline}
        unreadCount={unreadCount}
        realtimeStatus={realtimeStatus}
        onRefresh={handleRefresh}
        onOpenEditModal={() => {
          setEditingTripSnapshot(trip)
          setShowEditTripModal(true)
        }}
        onToggleArchive={handleToggleArchive}
        onExportICal={handleExportICal}
        onOpenPrintModal={() => setShowPrintableItineraryModal(true)}
        onOpenPollRecapModal={() => setShowPollRecapModal(true)}
        onToggleActivityDrawer={handleToggleDrawer}
        onLogout={onLogout}
      />

      {/* 3-Tab Workspace Navigation (Sticky segmented pill on desktop, thumb-friendly fixed bottom bar on mobile) */}
      <nav className="workspace-tabs-nav" aria-label="Trip Workspace Tabs" role="tablist">
        <button
          id="tab-itinerary"
          role="tab"
          type="button"
          aria-selected={activeWorkspaceTab === 'itinerary'}
          aria-controls="panel-itinerary"
          className={`workspace-tab-btn ${activeWorkspaceTab === 'itinerary' ? 'active' : ''}`}
          onClick={() => setActiveWorkspaceTab('itinerary')}
        >
          <span className="workspace-tab-icon">🗺️</span>
          <span className="workspace-tab-label">Itinerary & Options</span>
          <span className="workspace-tab-badge">{totalOptionsCount}</span>
        </button>

        <button
          id="tab-expenses"
          role="tab"
          type="button"
          aria-selected={activeWorkspaceTab === 'expenses'}
          aria-controls="panel-expenses"
          className={`workspace-tab-btn ${activeWorkspaceTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveWorkspaceTab('expenses')}
        >
          <span className="workspace-tab-icon">💰</span>
          <span className="workspace-tab-label">Expenses & Budget</span>
          <span className="workspace-tab-badge">{expensesCount}</span>
        </button>

        <button
          id="tab-roster"
          role="tab"
          type="button"
          aria-selected={activeWorkspaceTab === 'roster'}
          aria-controls="panel-roster"
          className={`workspace-tab-btn ${activeWorkspaceTab === 'roster' ? 'active' : ''}`}
          onClick={() => setActiveWorkspaceTab('roster')}
        >
          <span className="workspace-tab-icon">👥</span>
          <span className="workspace-tab-label">Crew & RSVPs</span>
          <span className="workspace-tab-badge">{rosterCount}</span>
        </button>
      </nav>

      {/* Full-Width Workspace Active Content (100% width, non-overlapping) */}
      <main className="workspace-content-pane">
        {activeWorkspaceTab === 'itinerary' && (
          <div id="panel-itinerary" role="tabpanel" aria-labelledby="tab-itinerary" className="animate-fade-in">
            <OptionsTab
              categories={CATEGORIES}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              options={categoryOptions}
              optionsLoading={optionsLoading}
              activePoll={activePoll}
              allTripOptions={allTripOptions}
              allActivePollsMap={allActivePollsMap}
              trip={trip}
              roster={roster}
              activeUser={activeUser}
              expenses={expenses}
              rates={rates}
              onVoteToggle={handleVoteToggle}
              onLockToggle={handleLockToggle}
              onDeleteOption={handleDeleteOption}
              onUpdateOptionDates={handleUpdateOptionDates}
              onOpenPitchModal={(cat, start = '', end = '') => {
                setPitchInitialCategory(cat || activeTab)
                setPitchInitialDates({ start, end })
                setShowPitchModal(true)
              }}
              onOpenPollRecapModal={() => setShowPollRecapModal(true)}
              onOpenExpenseModal={(opt) => {
                if (opt) {
                  setExpenseOptionToPreFill({
                    ...opt,
                    category: opt.category || activeTab || 'Accommodation'
                  })
                } else {
                  setExpenseOptionToPreFill(null)
                }
                setShowExpenseModal(true)
              }}
              onRefresh={viewMode === 'gantt' ? loadGanttData : loadOptionsAndPoll}
              onToggleParticipant={handleToggleOptionParticipant}
              onLogExpense={handleLogGroceryExpense}
              onSubmitMeal={handleSubmitMeal}
            />
          </div>
        )}

        {activeWorkspaceTab === 'expenses' && (
          <div id="panel-expenses" role="tabpanel" aria-labelledby="tab-expenses" className="animate-fade-in">
            <LedgerAndSettleTab
              ledgerTab={ledgerTab}
              onLedgerTabChange={setLedgerTab}
              expenses={expenses}
              expensesLoading={expensesLoading}
              committedMembers={committedMembers}
              roster={roster}
              memberBalances={memberBalances}
              settlementsList={settlementsList}
              totalGroupSpend={totalGroupSpend}
              perPersonSplit={perPersonSplit}
              baseCurrency={baseCurrency}
              onOpenExpenseModal={() => {
                setExpenseOptionToPreFill(null)
                setShowExpenseModal(true)
              }}
              allTripOptions={allTripOptions.length > 0 ? allTripOptions : options}
              rates={rates}
              activeUser={activeUser}
            />
          </div>
        )}

        {activeWorkspaceTab === 'roster' && (
          <div id="panel-roster" role="tabpanel" aria-labelledby="tab-roster" className="animate-fade-in">
            <RosterSection
              roster={roster}
              activeUser={activeUser}
              trip={trip}
              isAdmin={isAdmin}
              userNote={userNote}
              setUserNote={setUserNote}
              savingNote={savingNote}
              onNoteBlur={handleNoteBlur}
              onStatusChange={handleStatusChange}
              onPromoteMember={handlePromoteMember}
              onDemoteMember={handleDemoteMember}
              onCopyInviteLink={handleCopyInviteLink}
              showCopiedToast={showCopiedToast}
              onUpdateRsvpDetails={handleUpdateRsvpDetails}
            />
          </div>
        )}
      </main>

      {/* Extracted Modals */}
      <PitchOptionModal
        isOpen={showPitchModal}
        onClose={() => setShowPitchModal(false)}
        onSubmit={handlePitchSubmit}
        loading={pitchLoading}
        error={pitchError}
        categories={CATEGORIES}
        initialCategory={pitchInitialCategory}
        initialStartDate={pitchInitialDates.start}
        initialEndDate={pitchInitialDates.end}
        baseCurrency={baseCurrency}
        roster={roster}
        activeUserId={activeUser?.id}
      />

      <AddExpenseModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onSubmit={handleExpenseSubmit}
        loading={expenseLoading}
        error={expenseError}
        roster={roster}
        baseCurrency={baseCurrency}
        activeUserId={activeUser?.id}
        optionToPreFill={expenseOptionToPreFill}
      />

      <EditTripModal
        isOpen={showEditTripModal}
        onClose={() => {
          setShowEditTripModal(false)
          setEditingTripSnapshot(null)
        }}
        trip={editingTripSnapshot || trip}
        onSubmit={handleEditTripSubmit}
        loading={editLoading}
        error={editError}
        onToggleArchive={handleToggleArchive}
        onOpenDeleteConfirm={() => setShowDeleteConfirm(true)}
        showDeleteConfirm={showDeleteConfirm}
        onCloseDeleteConfirm={() => setShowDeleteConfirm(false)}
        onConfirmDelete={handleConfirmDelete}
        deleteLoading={deleteLoading}
        deleteError={deleteError}
        conflictingOptions={conflictingOptions}
        showReconcileModal={showReconcileModal}
        onCloseReconcileModal={() => setShowReconcileModal(false)}
      />

      <PrintableItineraryModal
        isOpen={showPrintableItineraryModal}
        onClose={() => setShowPrintableItineraryModal(false)}
        trip={trip}
        options={allTripOptions.length > 0 ? allTripOptions : options}
      />

      <PollRecapModal
        isOpen={showPollRecapModal}
        onClose={() => setShowPollRecapModal(false)}
        activeTab={activeTab}
        options={options}
        activePoll={activePoll}
        roster={roster}
      />

      <ActivityFeedDrawer
        isOpen={showActivityDrawer}
        onClose={() => setShowActivityDrawer(false)}
        activityLogs={activityLogs}
        lastReadTimestamp={lastReadTimestamp}
      />
    </div>
  )
}

export default TripDetails
