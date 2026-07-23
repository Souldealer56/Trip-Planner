import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTripDetails } from '../hooks/useTripDetails'
import { useRsvpRoster } from '../hooks/useRsvpRoster'
import { useAddParticipant } from '../hooks/useAddParticipant'
import { formatDateRange, formatRelativeTime } from '../utils/format'
import { updateRsvpNote, updateRsvpStatus, createRsvp } from '../services/rsvps'
import { fetchOptions, pitchOption, toggleVote, fetchActivePoll, checkOptionDateConflict, fetchAllTripOptions, lockOption } from '../services/options'
import { updateTrip } from '../services/trips'
import { fetchExpenses, logExpense } from '../services/expenses'
import { fetchExchangeRates, convertCurrency, calculateSettlements } from '../utils/currency'
import { useUserSession } from '../hooks/useUserSession'
import { generateTelegramLinkCode, disconnectTelegram } from '../services/users'
import { fetchActivityLogs } from '../services/activity'

function TripDetails() {
  const { id } = useParams()
  const { activeUser, login: onLogin, logout: onLogout } = useUserSession()
  const navigate = useNavigate()

  // Redirect unauthenticated users back to splash screen
  React.useEffect(() => {
    if (!activeUser) {
      navigate('/trips')
    }
  }, [activeUser, navigate])

  // Telegram account linking states
  const [linkCode, setLinkCode] = useState('')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkingLoading, setLinkingLoading] = useState(false)
  const [linkError, setLinkError] = useState('')

  const handleLinkTelegram = async () => {
    if (!activeUser) return
    setLinkingLoading(true)
    setLinkError('')
    try {
      const code = await generateTelegramLinkCode(activeUser.id)
      setLinkCode(code)
      setShowLinkModal(true)
    } catch (err) {
      console.error('Failed to generate Telegram link code:', err)
      setLinkError(err.message || 'Failed to start linking process. Please try again.')
    } finally {
      setLinkingLoading(false)
    }
  }

  const handleDisconnectTelegram = async () => {
    if (!activeUser) return
    if (!window.confirm('Are you sure you want to disconnect your Telegram account from this profile?')) return
    
    setLinkingLoading(true)
    try {
      const updatedUser = await disconnectTelegram(activeUser.id)
      onLogin(updatedUser) // Update local session
      alert('Telegram account successfully disconnected.')
    } catch (err) {
      console.error('Failed to disconnect Telegram:', err)
      alert(err.message || 'Failed to disconnect Telegram account. Please try again.')
    } finally {
      setLinkingLoading(false)
    }
  }

  const [showCopiedToast, setShowCopiedToast] = useState(false)

  // Activity Feed & Notification Drawer states
  const [activityLogs, setActivityLogs] = useState([])
  const [showActivityDrawer, setShowActivityDrawer] = useState(false)
  const [lastReadTimestamp, setLastReadTimestamp] = useState(() => {
    return localStorage.getItem(`trip_planner_last_read_log_${id}`) || null
  })

  const loadActivityLogs = React.useCallback(async () => {
    try {
      const logs = await fetchActivityLogs(id)
      setActivityLogs(logs || [])
    } catch (err) {
      console.error('Failed to load activity logs:', err)
    }
  }, [id])

  React.useEffect(() => {
    if (activeUser) {
      loadActivityLogs()
    }
  }, [activeUser, loadActivityLogs])

  const unreadCount = React.useMemo(() => {
    if (!lastReadTimestamp) return activityLogs.length
    const lastReadTime = new Date(lastReadTimestamp).getTime()
    return activityLogs.filter(log => new Date(log.created_at).getTime() > lastReadTime).length
  }, [activityLogs, lastReadTimestamp])

  const handleToggleDrawer = () => {
    const nextShow = !showActivityDrawer
    setShowActivityDrawer(nextShow)
    if (nextShow) {
      const nowIso = new Date().toISOString()
      setLastReadTimestamp(nowIso)
      localStorage.setItem(`trip_planner_last_read_log_${id}`, nowIso)
    }
  }

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/join/${id}`
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        setShowCopiedToast(true)
        setTimeout(() => setShowCopiedToast(false), 2000)
      })
      .catch(err => {
        console.error('Failed to copy invite link:', err)
        alert('Could not copy link automatically. Here is the link: ' + inviteUrl)
      })
  }

  const {
    data: trip,
    loading: tripLoading,
    error: tripError,
    refresh: refreshTrip
  } = useTripDetails(id)

  const {
    data: roster,
    loading: rosterLoading,
    error: rosterError,
    refresh: refreshRoster
  } = useRsvpRoster(id)

  const { addParticipant, loading: joinLoading, error: joinError } = useAddParticipant()

  const [showJoinForm, setShowJoinForm] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [username, setUsername] = useState('')

  // Reconciliation states
  const [reconcileLoading, setReconcileLoading] = useState(false)
  const [reconcileError, setReconcileError] = useState('')

  const [userNote, setUserNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Edit Trip states
  const [showEditTripModal, setShowEditTripModal] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDestination, setEditDestination] = useState('')
  const [editVibe, setEditVibe] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editBaseCurrency, setEditBaseCurrency] = useState('USD')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // Date reconciliation modal states
  const [showReconcileModal, setShowReconcileModal] = useState(false)
  const [conflictingOptions, setConflictingOptions] = useState([])

  const handleOpenEditModal = () => {
    if (!trip) return
    setEditTitle(trip.title || '')
    setEditDestination(trip.destination || '')
    setEditVibe(trip.vibe || '')
    setEditStartDate(trip.start_date || '')
    setEditEndDate(trip.end_date || '')
    setEditBaseCurrency(trip.base_currency || 'USD')
    setEditError('')
    setShowEditTripModal(true)
  }

  const handleEditTripSubmit = async (e) => {
    e.preventDefault()
    setEditError('')
    if (!editTitle.trim()) {
      setEditError('Trip title is required.')
      return
    }
    if (!editDestination.trim()) {
      setEditError('Destination is required.')
      return
    }
    if (editStartDate && editEndDate && new Date(editStartDate) > new Date(editEndDate)) {
      setEditError('Start date must be before or equal to end date.')
      return
    }

    setEditLoading(true)
    try {
      const datesChanged = (editStartDate !== trip.start_date || editEndDate !== trip.end_date)
      await updateTrip(id, {
        title: editTitle.trim(),
        destination: editDestination.trim(),
        vibe: editVibe.trim() || null,
        start_date: editStartDate,
        end_date: editEndDate,
        base_currency: editBaseCurrency
      })

      try {
        await supabase.from('activity_log').insert({
          trip_id: id,
          user_id: activeUser?.id || null,
          action_type: 'update_trip',
          description: `${activeUser?.first_name || 'Someone'} updated trip details`
        })
      } catch (logErr) {
        console.error('Failed to log trip update:', logErr)
      }

      setShowEditTripModal(false)
      refreshTrip()
      loadActivityLogs()

      if (datesChanged && editStartDate && editEndDate) {
        const allOptions = await fetchAllTripOptions(id)
        const conflicts = allOptions.filter(opt => checkOptionDateConflict(opt, editStartDate, editEndDate))
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

  const CATEGORIES = ['Accommodation', 'Flights', 'Activities', 'Food', 'Transport', 'Other']

  const [activeTab, setActiveTab] = useState('Accommodation')
  const [options, setOptions] = useState([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [activePoll, setActivePoll] = useState(null)

  const [showPitchModal, setShowPitchModal] = useState(false)
  const [pitchCategory, setPitchCategory] = useState('Accommodation')
  const [pitchName, setPitchName] = useState('')
  const [pitchCost, setPitchCost] = useState('')
  const [pitchCurrency, setPitchCurrency] = useState('USD')
  const [pitchLink, setPitchLink] = useState('')
  const [pitchDesc, setPitchDesc] = useState('')
  const [pitchStartDate, setPitchStartDate] = useState('')
  const [pitchEndDate, setPitchEndDate] = useState('')
  const [pitchError, setPitchError] = useState('')
  const [pitchLoading, setPitchLoading] = useState(false)

  const openPitchModal = (catToPitch = activeTab) => {
    const validCats = ['Accommodation', 'Flights', 'Activities', 'Food', 'Transport', 'Other']
    const initCat = validCats.includes(catToPitch) ? catToPitch : 'Accommodation'
    setPitchCategory(initCat)
    setPitchName('')
    setPitchCost('')
    setPitchCurrency(trip?.base_currency || 'USD')
    setPitchLink('')
    setPitchDesc('')
    setPitchStartDate('')
    setPitchEndDate('')
    setPitchError('')
    setShowPitchModal(true)
  }

  const loadOptionsAndPoll = React.useCallback(async () => {
    setOptionsLoading(true)
    try {
      const opts = await fetchOptions(id, activeTab)
      setOptions(opts)
      const poll = await fetchActivePoll(id, activeTab)
      setActivePoll(poll)
    } catch (err) {
      console.error('Failed to load options/poll:', err)
    } finally {
      setOptionsLoading(false)
    }
  }, [id, activeTab])

  React.useEffect(() => {
    if (activeUser) {
      loadOptionsAndPoll()
    }
  }, [activeUser, activeTab, loadOptionsAndPoll])

  const handlePitchSubmit = async (e) => {
    e.preventDefault()
    setPitchError('')
    if (!pitchName.trim()) {
      setPitchError('Option name is required.')
      return
    }
    if (pitchCost && (isNaN(pitchCost) || parseFloat(pitchCost) < 0)) {
      setPitchError('Estimated cost must be a positive number.')
      return
    }
    if (pitchStartDate && pitchEndDate && new Date(pitchStartDate) > new Date(pitchEndDate)) {
      setPitchError('Start date must be before or equal to end date.')
      return
    }

    const validCats = ['Accommodation', 'Flights', 'Activities', 'Food', 'Transport', 'Other']
    const targetCat = validCats.includes(pitchCategory) ? pitchCategory : (validCats.includes(activeTab) ? activeTab : 'Accommodation')

    setPitchLoading(true)
    try {
      await pitchOption(
        id,
        targetCat,
        pitchName.trim(),
        pitchCost ? parseFloat(pitchCost) : null,
        pitchCost ? (pitchCurrency || trip?.base_currency || 'USD') : null,
        pitchLink.trim() || null,
        pitchDesc.trim() || null,
        activeUser.id,
        pitchStartDate || null,
        pitchEndDate || null
      )
      setPitchName('')
      setPitchCost('')
      setPitchCurrency(trip?.base_currency || 'USD')
      setPitchLink('')
      setPitchDesc('')
      setPitchStartDate('')
      setPitchEndDate('')
      setShowPitchModal(false)
      
      if (activeTab !== targetCat) {
        setActiveTab(targetCat)
      } else {
        await loadOptionsAndPoll()
      }
      loadActivityLogs()
    } catch (err) {
      console.error('Failed to pitch option:', err)
      setPitchError(err.message || 'Failed to pitch option.')
    } finally {
      setPitchLoading(false)
    }
  }

  const [showPollRecapModal, setShowPollRecapModal] = useState(false)

  const handleVoteToggle = async (optionId, hasVoted) => {
    if (!activeUser) return
    try {
      const updatedPoll = await toggleVote(id, activeTab, optionId, activeUser.id, !hasVoted)
      setActivePoll(updatedPoll)
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
      loadOptionsAndPoll()
      loadActivityLogs()
    } catch (err) {
      console.error('Failed to lock option:', err)
    }
  }

  const [expenses, setExpenses] = useState([])
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [rates, setRates] = useState(null)
  const [ledgerTab, setLedgerTab] = useState('ledger')

  React.useEffect(() => {
    async function loadRates() {
      try {
        const liveRates = await fetchExchangeRates()
        setRates(liveRates)
      } catch (err) {
        console.error('Failed to load exchange rates:', err)
      }
    }
    loadRates()
  }, [])

  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseDesc, setExpenseDesc] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCurrency, setExpenseCurrency] = useState('USD')
  const [expensePaidBy, setExpensePaidBy] = useState('')
  const [expenseSplitEqually, setExpenseSplitEqually] = useState(true)
  const [expenseSplitUsers, setExpenseSplitUsers] = useState({})
  const [expenseError, setExpenseError] = useState('')
  const [expenseLoading, setExpenseLoading] = useState(false)

  const loadExpenses = React.useCallback(async () => {
    setExpensesLoading(true)
    try {
      const data = await fetchExpenses(id)
      setExpenses(data)
    } catch (err) {
      console.error('Failed to load expenses:', err)
    } finally {
      setExpensesLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    if (activeUser) {
      loadExpenses()
    }
  }, [activeUser, loadExpenses])

  const openExpenseModal = () => {
    setExpenseDesc('')
    setExpenseAmount('')
    setExpenseCurrency(trip?.base_currency || 'USD')
    setExpensePaidBy(activeUser.id)
    setExpenseSplitEqually(true)
    
    // Get all committed members
    const committedRoster = roster.filter(m => m.status === 'Committed')
    const initialSplits = {}
    committedRoster.forEach(m => {
      initialSplits[m.user_id] = true
    })
    setExpenseSplitUsers(initialSplits)
    setExpenseError('')
    setShowExpenseModal(true)
  }

  const handleExpenseSubmit = async (e) => {
    e.preventDefault()
    setExpenseError('')

    if (!expenseDesc.trim()) {
      setExpenseError('Description is required.')
      return
    }
    if (!expenseAmount || isNaN(expenseAmount) || parseFloat(expenseAmount) <= 0) {
      setExpenseError('Amount must be greater than 0.')
      return
    }
    if (!expensePaidBy) {
      setExpenseError('Please select a payer.')
      return
    }

    let splitsList = []
    const committedRoster = roster.filter(m => m.status === 'Committed')
    
    if (expenseSplitEqually) {
      splitsList = committedRoster.map(m => m.user_id)
    } else {
      splitsList = Object.keys(expenseSplitUsers).filter(uid => expenseSplitUsers[uid])
    }

    if (splitsList.length === 0) {
      setExpenseError('Please select at least one split participant.')
      return
    }

    setExpenseLoading(true)
    try {
      await logExpense(
        id,
        expensePaidBy,
        parseFloat(expenseAmount),
        expenseCurrency,
        expenseDesc.trim(),
        splitsList
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

  const committedMembers = roster.filter(m => m.status === 'Committed')
  const baseCurrency = trip?.base_currency || 'USD'

  const memberBalances = {}
  committedMembers.forEach(m => {
    memberBalances[m.user_id] = {
      userId: m.user_id,
      name: m.users?.first_name || m.username || 'Member',
      paid: 0.0,
      owed: 0.0
    }
  })

  let totalGroupSpend = 0.0

  if (rates && expenses.length > 0) {
    expenses.forEach(exp => {
      const payerId = exp.paid_by
      const originalAmount = parseFloat(exp.amount)
      const expCurrency = exp.currency || 'USD'
      
      const convertedAmount = convertCurrency(originalAmount, expCurrency, baseCurrency, rates)
      
      let splitParticipantIds = []
      if (exp.split_users && exp.split_users.length > 0) {
        splitParticipantIds = exp.split_users.filter(uid => memberBalances[uid])
      }
      
      if (splitParticipantIds.length === 0) {
        splitParticipantIds = committedMembers.map(m => m.user_id)
      }

      if (splitParticipantIds.length > 0) {
        const share = convertedAmount / splitParticipantIds.length
        splitParticipantIds.forEach(uid => {
          if (memberBalances[uid]) {
            memberBalances[uid].owed += share
          }
        })
        
        if (memberBalances[payerId]) {
          memberBalances[payerId].paid += convertedAmount
          totalGroupSpend += convertedAmount
        }
      }
    })
  }

  const settlementsList = rates ? calculateSettlements(memberBalances) : []
  const perPersonSplit = committedMembers.length > 0 ? totalGroupSpend / committedMembers.length : 0.0

  const loading = tripLoading || rosterLoading
  const error = tripError || rosterError

  React.useEffect(() => {
    if (activeUser && roster.length > 0) {
      const activeMember = roster.find(m => m.user_id === activeUser.id)
      if (activeMember) {
        setUserNote(activeMember.notes || '')
      }
    }
  }, [activeUser, roster])

  const handleRefresh = () => {
    refreshTrip()
    refreshRoster()
    if (activeUser) {
      loadOptionsAndPoll()
      loadExpenses()
      loadActivityLogs()
      fetchExchangeRates().then(setRates).catch(console.error)
    }
  }

  const handleNoteBlur = async () => {
    if (!activeUser) return
    const activeMember = roster.find(m => m.user_id === activeUser.id)
    const oldNote = activeMember ? (activeMember.notes || '') : ''
    if (userNote.trim() === oldNote.trim()) return

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
    const newStatus = e.target.value
    try {
      await updateRsvpStatus(id, activeUser.id, newStatus)
      refreshRoster()
    } catch (err) {
      console.error('Failed to update RSVP status:', err)
    }
  }

  const handleJoinSubmit = async (e) => {
    e.preventDefault()
    if (!firstName.trim()) return
    try {
      const user = await addParticipant(id, username.trim() || null, firstName.trim())
      onLogin(user)
      refreshRoster()
      setFirstName('')
      setUsername('')
      setShowJoinForm(false)
    } catch (err) {
      // Handled by hook error state
    }
  }

  const handleJoinRoster = async () => {
    if (!activeUser) return
    setReconcileLoading(true)
    setReconcileError('')
    try {
      await createRsvp(id, activeUser.id, 'Committed')
      await refreshRoster()
    } catch (err) {
      console.error('Failed to join trip roster:', err)
      setReconcileError(err.message || 'Failed to join trip roster. Please try again.')
    } finally {
      setReconcileLoading(false)
    }
  }

  const activeUserInRoster = activeUser ? roster.some(m => m.user_id === activeUser.id) : false

  // Determine if the modal should show the join form pane
  const displayJoinForm = showJoinForm || roster.length === 0

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }} className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header" style={{ borderBottom: 'none', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/trips" className="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Trips
          </Link>
          <button onClick={handleRefresh} className="btn btn-secondary" title="Refresh details">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>
          <button
            onClick={handleToggleDrawer}
            className="btn btn-secondary"
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Activity Feed & Notifications"
          >
            🔔 Activity
            {unreadCount > 0 && (
              <span
                style={{
                  backgroundColor: 'var(--accent, #10b981)',
                  color: '#ffffff',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  lineHeight: '1',
                  marginLeft: '2px'
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* User Session Bar */}
        {activeUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255, 255, 255, 0.03)', padding: '6px 12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Signed in as: <strong style={{ color: 'var(--primary-light)' }}>{activeUser.first_name}</strong>
            </span>
            {(() => {
              const activeMember = roster.find(m => m.user_id === activeUser.id)
              const status = activeMember ? activeMember.status : 'Tentative'
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label htmlFor="rsvp-status-select" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>RSVP:</label>
                  <select
                    id="rsvp-status-select"
                    className="input-field select-field"
                    style={{ padding: '3px 24px 3px 8px', fontSize: '0.8rem', width: 'auto', backgroundPosition: 'right 0.5rem center' }}
                    value={status}
                    onChange={handleStatusChange}
                  >
                    <option value="Committed">Committed</option>
                    <option value="Tentative">Tentative</option>
                    <option value="Declined">Declined</option>
                  </select>
                </div>
              )
            })()}
            {activeUser.email && activeUser.telegram_id < 0 && (
              <button 
                onClick={handleLinkTelegram} 
                className="btn btn-secondary" 
                style={{ padding: '4px 8px', fontSize: '0.8rem', borderColor: 'var(--primary-light)', color: 'var(--primary-light)' }}
                disabled={linkingLoading}
              >
                {linkingLoading ? 'Loading...' : 'Link Telegram Account'}
              </button>
            )}
            {activeUser.telegram_id > 0 && (
              <button 
                onClick={handleDisconnectTelegram} 
                className="btn btn-secondary" 
                style={{ padding: '4px 8px', fontSize: '0.8rem', borderColor: 'hsl(0, 80%, 60%)', color: 'hsl(0, 80%, 60%)' }}
                disabled={linkingLoading}
              >
                {linkingLoading ? 'Loading...' : 'Disconnect Telegram'}
              </button>
            )}
            <Link to="/profile" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              👤 My Profile
            </Link>
            <button onClick={onLogout} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
              Switch Profile
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <div className="skeleton skeleton-title" style={{ width: '40%' }} />
            <div className="skeleton skeleton-text" style={{ width: '70%' }} />
            <div className="skeleton skeleton-text" style={{ width: '50%' }} />
          </div>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <div className="skeleton skeleton-title" style={{ width: '30%', height: '20px' }} />
            <div className="skeleton skeleton-text" style={{ width: '90%' }} />
            <div className="skeleton skeleton-text" style={{ width: '85%' }} />
          </div>
        </div>
      )}

      {error && (
        <div className="glass-card error-card animate-fade-in" style={{ padding: '2rem', textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'hsl(0, 85%, 65%)', marginBottom: '1rem' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2 style={{ marginBottom: '0.5rem' }}>Failed to Load Trip Details</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error}</p>
          <button onClick={handleRefresh} className="btn">
            Try Again
          </button>
        </div>
      )}

      {/* Blocking Profile Selection Modal */}
      {!loading && !error && !activeUser && (
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-fade-in">
            {!displayJoinForm ? (
              // Pane 1: select existing profile
              <div>
                <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', textAlign: 'center' }}>Who Are You?</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                  Select your profile to collaborate on this trip, pitch options, and log expenses.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px', marginBottom: '1.5rem' }}>
                  {roster.map((member) => {
                    const u = member.users || {}
                    return (
                      <button
                        key={member.user_id}
                        onClick={() => onLogin(u)}
                        className="btn btn-secondary"
                        style={{ justifyContent: 'space-between', padding: '0.75rem 1rem', width: '100%' }}
                      >
                        <span style={{ fontWeight: '600' }}>{u.first_name}</span>
                        {u.username && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{u.username}</span>}
                      </button>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button onClick={() => setShowJoinForm(true)} className="btn" style={{ width: '100%' }}>
                    I'm Not on This List (Join Trip)
                  </button>
                </div>
              </div>
            ) : (
              // Pane 2: Join Form
              <div>
                <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', textAlign: 'center' }}>Join Trip</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                  Register as a participant to join the planning roster and auto-sign in.
                </p>

                <form onSubmit={handleJoinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>First Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Alex"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      style={{
                        padding: '0.75rem',
                        borderRadius: 'var(--border-radius-sm)',
                        border: '1px solid var(--border-light)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-main)'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Telegram Username (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. alex_smith"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: 'var(--border-radius-sm)',
                        border: '1px solid var(--border-light)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-main)'
                      }}
                    />
                  </div>

                  {joinError && (
                    <div style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem' }}>
                      {joinError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowJoinForm(false)}
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="btn"
                      disabled={joinLoading}
                      style={{ flex: 1 }}
                    >
                      {joinLoading ? 'Joining...' : 'Join'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blocking Roster Reconciliation Modal */}
      {!loading && !error && activeUser && !activeUserInRoster && (
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-fade-in" style={{ textAlign: 'center', maxWidth: '400px' }}>
            <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem' }}>Not on the Roster</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              You are signed in as <strong>{activeUser.first_name}</strong>, but you are not registered as a participant for this trip.
            </p>
            
            {reconcileError && (
              <p style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {reconcileError}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                onClick={handleJoinRoster} 
                className="btn" 
                disabled={reconcileLoading}
                style={{ width: '100%' }}
              >
                {reconcileLoading ? 'Joining...' : 'Join Trip'}
              </button>
              <button 
                onClick={onLogout} 
                className="btn btn-secondary" 
                style={{ width: '100%' }}
              >
                Switch Profile / Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Detail view content */}
      {!loading && !error && trip && activeUser && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Trip Info Header Card */}
          <div className="glass-card" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', fontSize: '2.25rem' }}>{trip.title}</h1>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1rem', fontSize: '1rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📍</span>
                    <strong style={{ color: 'var(--text-main)' }}>{trip.destination}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📅</span>
                    <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>💱</span>
                    <span>Currency: <strong style={{ color: 'var(--text-main)' }}>{trip.base_currency}</strong></span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleOpenEditModal}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                ✏️ Edit Trip
              </button>
            </div>
            {trip.vibe && (
              <p style={{ marginTop: '1.5rem', fontStyle: 'italic', color: 'var(--text-muted)', borderLeft: '3px solid var(--primary)', paddingLeft: '1rem' }}>
                "{trip.vibe}"
              </p>
            )}
          </div>

          {/* Options & Pitching Section */}
          <div className="glass-card animate-fade-in" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🗳️ Pitched Options</span>
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={loadOptionsAndPoll}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  title="Refresh Votes from Telegram & Web"
                >
                  🔄 Refresh Votes
                </button>
                <button
                  onClick={() => setShowPollRecapModal(true)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  title="View Poll Breakdown & Voter Recap"
                >
                  📊 Poll Recap
                </button>
                <button 
                  onClick={() => {
                    setPitchError('')
                    const defaultCat = CATEGORIES.includes(activeTab) ? activeTab : 'Accommodation'
                    setPitchCategory(defaultCat)
                    setShowPitchModal(true)
                  }} 
                  className="btn"
                >
                  Pitch Option
                </button>
              </div>
            </div>

            {/* Horizontal Tabs */}
            <div className="tabs-container" style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '1.5rem', paddingBottom: '4px' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={`tab-btn ${activeTab === cat ? 'active' : ''}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Options List */}
            {optionsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                <div className="skeleton skeleton-title" style={{ width: '40%' }} />
                <div className="skeleton skeleton-text" style={{ width: '80%' }} />
                <div className="skeleton skeleton-text" style={{ width: '60%' }} />
              </div>
            ) : options.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-main)' }}>No options pitched for this category yet.</h3>
                <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>Got an idea for this part of the trip? Pitch it to start the vote!</p>
                <button 
                  onClick={() => {
                    setPitchError('')
                    setShowPitchModal(true)
                  }} 
                  className="btn btn-secondary"
                >
                  Pitch the First Option
                </button>
              </div>
            ) : (
              <div className="options-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {options.map(opt => {
                  const optIdStr = String(opt.id)
                  const votesCount = activePoll?.votes_by_option?.[optIdStr] || 0
                  const userVotes = activePoll?.voter_selections?.[activeUser.id] || []
                  const hasVoted = userVotes.map(String).includes(optIdStr)
                  const isDateConflicting = checkOptionDateConflict(opt, trip?.start_date, trip?.end_date)
                  const isLockedChoice = String(activePoll?.locked_option_id) === optIdStr || Boolean(opt.is_locked)

                  const votersForOpt = Object.entries(activePoll?.voter_selections || {})
                    .filter(([uId, opts]) => Array.isArray(opts) && opts.map(String).includes(optIdStr))
                    .map(([uId]) => {
                      const member = roster.find(m => String(m.user_id) === String(uId) || String(m.users?.id) === String(uId))
                      return member?.users?.first_name || member?.username || 'Traveler'
                    })
                  
                  return (
                    <div 
                      key={opt.id} 
                      className={`option-card ${hasVoted ? 'voted' : ''}`}
                      style={{
                        padding: '1.25rem',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: isLockedChoice ? '2px solid #eab308' : (hasVoted ? '2px solid var(--accent)' : '1px solid var(--border-light)'),
                        borderRadius: 'var(--border-radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'var(--transition-smooth)',
                        boxShadow: 'var(--shadow-premium)'
                      }}
                    >
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                            {opt.option_text}
                          </h4>
                          <span style={{ 
                            background: 'rgba(255, 255, 255, 0.05)', 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            fontSize: '0.8rem', 
                            fontWeight: '600',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap'
                          }}>
                            {votesCount} vote{votesCount !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {isLockedChoice && (
                          <div style={{ marginTop: '4px', marginBottom: '8px' }}>
                            <span 
                              style={{ 
                                background: 'rgba(234, 179, 8, 0.15)', 
                                color: '#eab308', 
                                border: '1px solid rgba(234, 179, 8, 0.4)', 
                                padding: '2px 8px', 
                                borderRadius: '12px', 
                                fontSize: '0.75rem', 
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              🏆 Locked Choice
                            </span>
                          </div>
                        )}

                        {isDateConflicting && (
                          <div style={{ marginTop: '4px', marginBottom: '8px' }}>
                            <span 
                              style={{ 
                                background: 'rgba(245, 158, 11, 0.15)', 
                                color: '#f59e0b', 
                                border: '1px solid rgba(245, 158, 11, 0.3)', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                fontSize: '0.75rem', 
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Option dates fall outside trip start/end dates"
                            >
                              ⚠️ Outside Trip Dates
                            </span>
                          </div>
                        )}

                        {opt.estimated_cost && (
                          <div style={{ fontSize: '0.9rem', color: 'var(--primary-light)', fontWeight: '600', marginBottom: '8px' }}>
                            Cost: {opt.estimated_cost} {opt.currency || 'USD'}
                          </div>
                        )}

                        {opt.description && (
                          <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineBreak: 'anywhere' }}>
                            {opt.description}
                          </p>
                        )}

                        {opt.link && (
                          <a 
                            href={opt.link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ 
                              fontSize: '0.8rem', 
                              color: 'var(--primary-light)', 
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              wordBreak: 'break-all'
                            }}
                          >
                            <span>🔗</span> Link
                          </a>
                        )}

                        {/* Stacked Voter Badges */}
                        {votersForOpt.length > 0 && (
                          <div 
                            onClick={() => setShowPollRecapModal(true)}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px', 
                              marginTop: '10px', 
                              cursor: 'pointer',
                              flexWrap: 'wrap'
                            }}
                            title="Click to view full poll breakdown"
                          >
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Voted by:</span>
                            {votersForOpt.map((name, idx) => (
                              <span
                                key={idx}
                                style={{
                                  background: 'rgba(59, 130, 246, 0.15)',
                                  color: 'var(--primary-light)',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  padding: '1px 7px',
                                  borderRadius: '12px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600'
                                }}
                              >
                                👤 {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          onClick={() => handleVoteToggle(opt.id, hasVoted)}
                          className={`btn ${hasVoted ? 'btn-secondary' : ''}`}
                          style={{ 
                            flex: 1, 
                            borderColor: hasVoted ? 'var(--accent)' : 'var(--border-light)',
                            color: hasVoted ? 'var(--accent-light)' : 'var(--text-main)',
                            background: hasVoted ? 'rgba(16, 185, 129, 0.05)' : ''
                          }}
                        >
                          {hasVoted ? '✓ Voted' : 'Vote'}
                        </button>
                        <button
                          onClick={() => handleLockToggle(opt.id)}
                          className="btn btn-secondary"
                          style={{ 
                            padding: '6px 10px', 
                            fontSize: '0.8rem',
                            borderColor: isLockedChoice ? '#eab308' : 'var(--border-light)',
                            color: isLockedChoice ? '#eab308' : 'var(--text-muted)'
                          }}
                          title={isLockedChoice ? 'Unlock this choice' : 'Lock as winning choice'}
                        >
                          {isLockedChoice ? '🔓 Unlock' : '🔒 Lock'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Roster & Participants Card */}
          <div className="glass-card" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
            <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span>👥 RSVP Roster</span>
                <button
                  onClick={handleCopyInviteLink}
                  style={{
                    position: 'relative',
                    padding: '0.35rem 0.75rem',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: 'var(--primary-light, #60a5fa)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.15s ease',
                  }}
                  className="join-btn"
                  title="Copy Invite Link"
                >
                  🔗 Share
                  {showCopiedToast && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '125%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#1e293b',
                        color: '#f8fafc',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        whiteSpace: 'nowrap',
                        border: '1px solid var(--border-light, #334155)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        zIndex: 10,
                        animation: 'fadeInOut 2s ease forwards',
                      }}
                    >
                      Copied!
                    </span>
                  )}
                </button>
                <style>{`
                  @keyframes fadeInOut {
                    0% { opacity: 0; transform: translate(-50%, 5px); }
                    15% { opacity: 1; transform: translate(-50%, 0); }
                    85% { opacity: 1; transform: translate(-50%, 0); }
                    100% { opacity: 0; transform: translate(-50%, -5px); }
                  }
                `}</style>
              </span>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                {roster.length} participant{roster.length !== 1 ? 's' : ''}
              </span>
            </h2>

            {roster.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                No participants have RSVPed to this trip yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {roster.map((member) => {
                  const user = member.users || {}
                  const isCommitted = member.status?.toLowerCase() === 'committed'
                  const isCurrentUser = user.id === activeUser.id

                  return (
                    <div
                      key={member.user_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem',
                        background: isCurrentUser ? 'rgba(56, 122, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                        border: isCurrentUser ? '1px solid var(--primary-light)' : '1px solid var(--border-light)',
                        borderRadius: 'var(--border-radius-sm)',
                        transition: 'var(--transition-fast)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {user.first_name || 'Anonymous User'}
                          {user.telegram_id > 0 ? (
                            <span 
                              style={{ 
                                fontSize: '0.7rem', 
                                background: 'rgba(56, 189, 248, 0.1)', 
                                color: '#38bdf8', 
                                border: '1px solid rgba(56, 189, 248, 0.25)', 
                                padding: '1px 6px', 
                                borderRadius: '4px', 
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}
                              title="Telegram-linked profile"
                            >
                              ✈️ Telegram
                            </span>
                          ) : (
                            <span 
                              style={{ 
                                fontSize: '0.7rem', 
                                background: 'rgba(52, 211, 153, 0.1)', 
                                color: '#34d399', 
                                border: '1px solid rgba(52, 211, 153, 0.25)', 
                                padding: '1px 6px', 
                                borderRadius: '4px', 
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}
                              title="Email/Web profile"
                            >
                              ✉️ Email
                            </span>
                          )}
                          {isCurrentUser && <span style={{ fontSize: '0.8rem', background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>You</span>}
                        </div>
                        {user.username && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            @{user.username}
                          </div>
                        )}
                        {isCurrentUser ? (
                          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="text"
                              value={userNote}
                              placeholder="Add RSVP details/notes..."
                              onChange={(e) => setUserNote(e.target.value)}
                              onBlur={handleNoteBlur}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.85rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border-light)',
                                background: 'rgba(255, 255, 255, 0.03)',
                                color: 'var(--text-main)',
                                outline: 'none',
                                width: '220px'
                              }}
                            />
                            {savingNote && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saving...</span>}
                          </div>
                        ) : (
                          member.notes && (
                            <div style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>📝</span> <span>{member.notes}</span>
                            </div>
                          )
                        )}
                      </div>
                      <span className={`badge ${isCommitted ? 'badge-committed' : 'badge-interested'}`}>
                        {member.status || 'Interested'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Shared Ledger Section */}
          <div className="glass-card animate-fade-in" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🧾 Expenses & Settlements</span>
                </h2>
                <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '20px', padding: '3px', border: '1px solid var(--border-light)' }}>
                  <button 
                    onClick={() => setLedgerTab('ledger')}
                    type="button"
                    style={{ 
                      padding: '4px 14px', 
                      fontSize: '0.85rem', 
                      borderRadius: '16px',
                      background: ledgerTab === 'ledger' ? 'var(--primary-light)' : 'transparent',
                      color: ledgerTab === 'ledger' ? 'black' : 'var(--text-muted)',
                      border: 'none',
                      minWidth: 'auto',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Ledger List
                  </button>
                  <button 
                    onClick={() => setLedgerTab('settle')}
                    type="button"
                    style={{ 
                      padding: '4px 14px', 
                      fontSize: '0.85rem', 
                      borderRadius: '16px',
                      background: ledgerTab === 'settle' ? 'var(--primary-light)' : 'transparent',
                      color: ledgerTab === 'settle' ? 'black' : 'var(--text-muted)',
                      border: 'none',
                      minWidth: 'auto',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Settle Up
                  </button>
                </div>
              </div>
              <button 
                onClick={openExpenseModal} 
                className="btn"
              >
                Add Expense
              </button>
            </div>

            {ledgerTab === 'ledger' ? (
              /* Ledger List */
              expensesLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                  <div className="skeleton skeleton-title" style={{ width: '30%' }} />
                  <div className="skeleton skeleton-text" style={{ width: '80%' }} />
                </div>
              ) : expenses.length === 0 ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-main)' }}>No expenses logged yet.</h3>
                  <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>Keep track of group travel splits by logging your first expense!</p>
                  <button 
                    onClick={openExpenseModal} 
                    className="btn btn-secondary"
                  >
                    Log First Expense
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop View Table */}
                  <div className="ledger-table-container">
                    <table className="ledger-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Paid By</th>
                          <th>Amount</th>
                          <th>Date</th>
                          <th>Splits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map(exp => {
                          const payerName = exp.users?.first_name || 'Unknown'
                          const committedCount = committedMembers.length
                          const isSplitEqually = !exp.split_users || exp.split_users.length === 0 || exp.split_users.length === committedCount
                          
                          let splitsText = 'Everyone'
                          if (!isSplitEqually) {
                            const splitNames = roster
                              .filter(m => exp.split_users.includes(m.user_id))
                              .map(m => m.users?.first_name || m.username || m.user_id.slice(0, 5))
                            splitsText = splitNames.length > 0 ? splitNames.join(', ') : 'None'
                          }

                          return (
                            <tr key={exp.id}>
                              <td style={{ fontWeight: '500' }}>{exp.description}</td>
                              <td>{payerName}</td>
                              <td style={{ color: 'var(--primary-light)', fontWeight: '600' }}>
                                {exp.amount.toFixed(2)} {exp.currency || 'USD'}
                              </td>
                              <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {new Date(exp.created_at).toLocaleDateString()}
                              </td>
                              <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={splitsText}>
                                {splitsText}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View Stack */}
                  <div className="ledger-mobile-cards">
                    {expenses.map(exp => {
                      const payerName = exp.users?.first_name || 'Unknown'
                      const committedCount = committedMembers.length
                      const isSplitEqually = !exp.split_users || exp.split_users.length === 0 || exp.split_users.length === committedCount
                      
                      let splitsText = 'Everyone'
                      if (!isSplitEqually) {
                        const splitNames = roster
                          .filter(m => exp.split_users.includes(m.user_id))
                          .map(m => m.users?.first_name || m.username || m.user_id.slice(0, 5))
                        splitsText = splitNames.length > 0 ? splitNames.join(', ') : 'None'
                      }

                      return (
                        <div key={exp.id} className="ledger-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{exp.description}</span>
                            <span style={{ color: 'var(--primary-light)', fontWeight: '600' }}>
                              {exp.amount.toFixed(2)} {exp.currency || 'USD'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            <span>Paid by: <strong>{payerName}</strong></span>
                            <span>{new Date(exp.created_at).toLocaleDateString()}</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '6px', marginTop: '6px' }}>
                            Split with: <span style={{ color: 'var(--text-main)' }}>{splitsText}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            ) : (
              /* Settle Up Tab */
              <div className="animate-fade-in">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="glass-card" style={{ padding: '12px var(--spacing-md)', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>TOTAL GROUP SPEND</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary-light)' }}>
                      {totalGroupSpend.toFixed(2)} {baseCurrency}
                    </div>
                  </div>
                  <div className="glass-card" style={{ padding: '12px var(--spacing-md)', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>PER PERSON SPLIT</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                      {perPersonSplit.toFixed(2)} {baseCurrency}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                  {/* Individual net balances */}
                  <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.01)' }}>
                    <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Individual Balances
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {Object.values(memberBalances).map(b => {
                        const net = b.paid - b.owed
                        const isCredit = net > 0.01
                        const isDebit = net < -0.01
                        
                        let netClass = ''
                        let netText = 'Even'
                        if (isCredit) {
                          netClass = 'credit'
                          netText = `+${net.toFixed(2)} ${baseCurrency}`
                        } else if (isDebit) {
                          netClass = 'debit'
                          netText = `-${Math.abs(net).toFixed(2)} ${baseCurrency}`
                        }

                        return (
                          <div key={b.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '500' }}>{b.name}</span>
                            <span className={`balance-badge ${netClass}`} style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                              {netText}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Minimized transactions list */}
                  <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.01)' }}>
                    <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Settlement Paths
                    </h3>
                    {settlementsList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>✅</div>
                        <h4 style={{ margin: 0, color: 'var(--text-main)' }}>Everyone is perfectly even!</h4>
                        <p style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>No transactions are needed to settle balances.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {settlementsList.map((tx, idx) => (
                          <div key={idx} className="settlement-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', padding: '10px 14px', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '600' }}>{tx.fromName}</span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 'bold' }}>➡️ pays ➡️</span>
                              <span style={{ fontWeight: '600' }}>{tx.toName}</span>
                            </div>
                            <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                              {tx.amount.toFixed(2)} {baseCurrency}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pitch Option Modal Overlay */}
      {showPitchModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-fade-in">
            <div>
              <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', textAlign: 'center' }}>Pitch New Option</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                Suggest a new option for the group to vote on.
              </p>

              <form onSubmit={handlePitchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Category *</label>
                  <select
                    value={pitchCategory}
                    onChange={(e) => setPitchCategory(e.target.value)}
                    className="input-field select-field"
                    required
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Option Name / Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Ocean View Cabin"
                    value={pitchName}
                    onChange={(e) => setPitchName(e.target.value)}
                    required
                    className="input-field"
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Estimated Cost (Optional)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 450.00"
                      value={pitchCost}
                      onChange={(e) => setPitchCost(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Currency</label>
                    <select
                      value={pitchCurrency}
                      onChange={(e) => setPitchCurrency(e.target.value)}
                      className="input-field select-field"
                      style={{ padding: '0.75rem var(--spacing-md) 0.75rem 0.5rem' }}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="AUD">AUD ($)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Start Date (Optional)</label>
                    <input
                      type="date"
                      value={pitchStartDate}
                      onChange={(e) => setPitchStartDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>End Date (Optional)</label>
                    <input
                      type="date"
                      value={pitchEndDate}
                      onChange={(e) => setPitchEndDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>URL Link (Optional)</label>
                  <input
                    type="url"
                    placeholder="e.g. https://airbnb.com/rooms/..."
                    value={pitchLink}
                    onChange={(e) => setPitchLink(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Description (Optional)</label>
                  <textarea
                    placeholder="Provide details about this option..."
                    value={pitchDesc}
                    onChange={(e) => setPitchDesc(e.target.value)}
                    rows="3"
                    className="input-field"
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                {pitchError && (
                  <div style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem', textAlign: 'center' }}>
                    ⚠️ {pitchError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="submit" disabled={pitchLoading} className="btn" style={{ flex: 1 }}>
                    {pitchLoading ? 'Pitching...' : 'Pitch Option'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPitchName('')
                      setPitchCost('')
                      setPitchCurrency(trip?.base_currency || 'USD')
                      setPitchLink('')
                      setPitchDesc('')
                      setPitchStartDate('')
                      setPitchEndDate('')
                      setShowPitchModal(false)
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Poll Breakdown & Voter Recap Modal Overlay */}
      {showPollRecapModal && (
        <div className="modal-overlay" onClick={() => setShowPollRecapModal(false)}>
          <div className="modal-content glass-card animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, color: 'var(--primary-light)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📊 Poll Recap</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({activeTab})</span>
              </h2>
              <button onClick={() => setShowPollRecapModal(false)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                ✕ Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
              {options.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No options pitched in this category yet.</p>
              ) : (
                options.map(opt => {
                  const optIdStr = String(opt.id)
                  const count = activePoll?.votes_by_option?.[optIdStr] || 0
                  const voters = Object.entries(activePoll?.voter_selections || {})
                    .filter(([uId, opts]) => Array.isArray(opts) && opts.map(String).includes(optIdStr))
                    .map(([uId]) => {
                      const member = roster.find(m => String(m.user_id) === String(uId) || String(m.users?.id) === String(uId))
                      return member?.users?.first_name || member?.username || 'Traveler'
                    })
                  const isLocked = String(activePoll?.locked_option_id) === optIdStr || Boolean(opt.is_locked)

                  return (
                    <div key={opt.id} style={{ background: 'rgba(255, 255, 255, 0.03)', border: isLocked ? '1px solid #eab308' : '1px solid var(--border-light)', padding: '1rem', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ fontWeight: '600', fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {opt.option_text}
                          {isLocked && <span style={{ color: '#eab308', fontSize: '0.8rem', fontWeight: 'bold' }}>🏆 Locked Choice</span>}
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary-light)', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '10px' }}>
                          {count} vote{count !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {voters.length > 0 ? (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>Voters:</div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {voters.map((name, i) => (
                              <span key={i} style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid var(--border-light)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                👤 {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                          No votes cast yet
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal Overlay */}
      {showExpenseModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-fade-in" style={{ maxWidth: '450px' }}>
            <div>
              <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', textAlign: 'center' }}>Add Expense</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                Log a new shared trip expense and specify who splits it.
              </p>

              <form onSubmit={handleExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Description *</label>
                  <input
                    type="text"
                    placeholder="e.g. Group Dinner, Gas, Tickets"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    required
                    className="input-field"
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      required
                      className="input-field"
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '110px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Currency</label>
                    <select
                      value={expenseCurrency}
                      onChange={(e) => setExpenseCurrency(e.target.value)}
                      className="input-field select-field"
                      style={{ padding: '0.75rem var(--spacing-md) 0.75rem 0.5rem' }}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="AUD">AUD ($)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Paid By *</label>
                  <select
                    value={expensePaidBy}
                    onChange={(e) => setExpensePaidBy(e.target.value)}
                    className="input-field select-field"
                  >
                    {roster.filter(m => m.status === 'Committed').map(m => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.users?.first_name || m.username || m.user_id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <div className="toggle-container" onClick={() => setExpenseSplitEqually(!expenseSplitEqually)}>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={expenseSplitEqually}
                        onChange={() => {}} // Controlled by container onClick
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span style={{ fontSize: '0.95rem', fontWeight: '600' }}>Split Equally among all members</span>
                  </div>
                </div>

                {!expenseSplitEqually && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} className="animate-fade-in">
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Select Split Participants</label>
                    <div className="checkbox-list">
                      {roster.filter(m => m.status === 'Committed').map(m => {
                        const isChecked = !!expenseSplitUsers[m.user_id]
                        return (
                          <label key={m.user_id} className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setExpenseSplitUsers({
                                  ...expenseSplitUsers,
                                  [m.user_id]: e.target.checked
                                })
                              }}
                            />
                            <span>{m.users?.first_name || m.username}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {expenseError && (
                  <div style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem', textAlign: 'center' }}>
                    ⚠️ {expenseError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="submit" disabled={expenseLoading} className="btn" style={{ flex: 1 }}>
                    {expenseLoading ? 'Saving...' : 'Add Expense'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExpenseModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Account Linking Modal */}
      {showLinkModal && (
        <div className="modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="modal-content glass-card animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', fontSize: '1.4rem' }}>Link Telegram Account</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              This will merge all RSVP history, expenses, and votes from your Telegram profile into this email account. This action cannot be undone.
            </p>
            
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              padding: '1rem', 
              borderRadius: '8px', 
              border: '1px solid var(--border-light)', 
              marginBottom: '1.5rem' 
            }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>YOUR LINK CODE:</span>
              <strong style={{ fontSize: '1.8rem', color: 'var(--primary-light)', letterSpacing: '2px' }}>{linkCode}</strong>
            </div>

            <a 
              href={`https://t.me/TripSyncBot?start=link_${linkCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', marginBottom: '0.75rem' }}
            >
              Open Telegram Bot
            </a>

            <button onClick={() => setShowLinkModal(false)} className="btn btn-secondary" style={{ width: '100%' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Activity Feed Slide-Out Drawer */}
      {showActivityDrawer && (
        <div
          className="modal-overlay"
          onClick={() => setShowActivityDrawer(false)}
          style={{ justifyContent: 'flex-end', padding: 0, zIndex: 1100 }}
        >
          <div
            className="glass-card animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '380px',
              maxWidth: '90vw',
              height: '100vh',
              borderRadius: 0,
              borderLeft: '1px solid var(--border-light)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
              background: 'var(--bg-main, #0f172a)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🔔 Activity Feed</span>
              </h2>
              <button
                onClick={() => setShowActivityDrawer(false)}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              >
                Close
              </button>
            </div>

            {activityLogs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
                No activity recorded yet for this trip.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {activityLogs.map((log) => {
                  const isNew = !lastReadTimestamp || new Date(log.created_at).getTime() > new Date(lastReadTimestamp).getTime()
                  let icon = '📝'
                  if (log.action_type === 'update_rsvp') icon = '🎒'
                  else if (log.action_type === 'pitch_option') icon = '💡'
                  else if (log.action_type === 'vote_option' || log.action_type === 'vote_poll') icon = '🗳️'
                  else if (log.action_type === 'add_expense') icon = '💸'

                  return (
                    <div
                      key={log.id}
                      style={{
                        padding: '0.85rem 1rem',
                        background: isNew ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: isNew ? '1px solid var(--primary-light)' : '1px solid var(--border-light)',
                        borderRadius: 'var(--border-radius-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-main)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                          <span>{icon}</span>
                          <span>{log.description}</span>
                        </span>
                        {isNew && (
                          <span style={{ fontSize: '0.65rem', background: 'var(--accent, #10b981)', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold', flexShrink: 0 }}>
                            NEW
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '2px' }}>
                        {formatRelativeTime(log.created_at)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Trip Modal Overlay */}
      {showEditTripModal && (
        <div className="modal-overlay" onClick={() => setShowEditTripModal(false)}>
          <div className="modal-content glass-card animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '90%' }}>
            <div>
              <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', textAlign: 'center' }}>Edit Trip Settings</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                Update destination, dates, currency, and vibe for this trip.
              </p>

              <form onSubmit={handleEditTripSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Trip Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Summer Vacation in Maui"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    className="input-field"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Destination *</label>
                  <input
                    type="text"
                    placeholder="e.g. Maui, Hawaii"
                    value={editDestination}
                    onChange={(e) => setEditDestination(e.target.value)}
                    required
                    className="input-field"
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Start Date</label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>End Date</label>
                    <input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Base Currency</label>
                  <select
                    value={editBaseCurrency}
                    onChange={(e) => setEditBaseCurrency(e.target.value)}
                    className="input-field select-field"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="CHF">CHF (Fr)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Trip Vibe / Description (Optional)</label>
                  <textarea
                    placeholder="e.g. Beach relaxation & volcano hikes"
                    value={editVibe}
                    onChange={(e) => setEditVibe(e.target.value)}
                    rows="3"
                    className="input-field"
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                {editError && (
                  <div style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem' }}>
                    {editError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowEditTripModal(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn"
                    disabled={editLoading}
                    style={{ flex: 1 }}
                  >
                    {editLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Post-Save Date Reconciliation Modal */}
      {showReconcileModal && (
        <div className="modal-overlay" onClick={() => setShowReconcileModal(false)}>
          <div className="modal-content glass-card animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', width: '90%' }}>
            <div>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '2.5rem' }}>⚠️</span>
                <h2 style={{ color: '#f59e0b', margin: '0.5rem 0' }}>Option Dates Reconciliation</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                  Trip dates were updated. The following pitched option(s) fall outside the new trip range ({formatDateRange(trip?.start_date, trip?.end_date)}):
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '240px', overflowY: 'auto', margin: '1rem 0', paddingRight: '4px' }}>
                {conflictingOptions.map((opt) => (
                  <div
                    key={opt.id}
                    style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--text-main)' }}>{opt.option_text}</strong>
                      <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                        {opt.category}
                      </span>
                    </div>
                    {(opt.start_date || opt.end_date) && (
                      <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>
                        📅 Option dates: {formatDateRange(opt.start_date, opt.end_date)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <button
                  onClick={() => setShowReconcileModal(false)}
                  className="btn"
                  style={{ width: '100%' }}
                >
                  Understood & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default TripDetails
