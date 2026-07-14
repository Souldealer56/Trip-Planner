import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTripDetails } from '../hooks/useTripDetails'
import { useRsvpRoster } from '../hooks/useRsvpRoster'
import { useAddParticipant } from '../hooks/useAddParticipant'
import { formatDateRange } from '../utils/format'
import { updateRsvpNote, updateRsvpStatus } from '../services/rsvps'
import { fetchOptions, pitchOption, toggleVote, fetchActivePoll } from '../services/options'
import { fetchExpenses, logExpense } from '../services/expenses'
import { fetchExchangeRates, convertCurrency, calculateSettlements } from '../utils/currency'
import { useUserSession } from '../hooks/useUserSession'

function TripDetails() {
  const { id } = useParams()
  const { activeUser, login: onLogin, logout: onLogout } = useUserSession()


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

  const {
    addParticipant,
    loading: joinLoading,
    error: joinError
  } = useAddParticipant()

  const [showJoinForm, setShowJoinForm] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [username, setUsername] = useState('')

  const [userNote, setUserNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const CATEGORIES = ['Accommodation', 'Flights', 'Activities', 'Food', 'Transport', 'Other']

  const [activeTab, setActiveTab] = useState('Accommodation')
  const [options, setOptions] = useState([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [activePoll, setActivePoll] = useState(null)

  const [showPitchModal, setShowPitchModal] = useState(false)
  const [pitchName, setPitchName] = useState('')
  const [pitchCost, setPitchCost] = useState('')
  const [pitchCurrency, setPitchCurrency] = useState('USD')
  const [pitchLink, setPitchLink] = useState('')
  const [pitchDesc, setPitchDesc] = useState('')
  const [pitchError, setPitchError] = useState('')
  const [pitchLoading, setPitchLoading] = useState(false)

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

    setPitchLoading(true)
    try {
      await pitchOption(
        id,
        activeTab,
        pitchName.trim(),
        pitchCost ? parseFloat(pitchCost) : null,
        pitchCost ? pitchCurrency : null,
        pitchLink.trim() || null,
        pitchDesc.trim() || null,
        activeUser.id
      )
      setPitchName('')
      setPitchCost('')
      setPitchCurrency('USD')
      setPitchLink('')
      setPitchDesc('')
      setShowPitchModal(false)
      loadOptionsAndPoll()
    } catch (err) {
      console.error('Failed to pitch option:', err)
      setPitchError(err.message || 'Failed to pitch option.')
    } finally {
      setPitchLoading(false)
    }
  }

  const handleVoteToggle = async (optionId, hasVoted) => {
    if (!activeUser) return
    try {
      const updatedPoll = await toggleVote(id, activeTab, optionId, activeUser.id, !hasVoted)
      setActivePoll(updatedPoll)
    } catch (err) {
      console.error('Failed to toggle vote:', err)
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
                        background: 'rgba(255, 255, 255, 0.02)',
                        color: 'var(--text-main)',
                        fontFamily: 'inherit',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Telegram Username (Optional)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }}>@</span>
                      <input
                        type="text"
                        placeholder="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={{
                          padding: '0.75rem 0.75rem 0.75rem 1.75rem',
                          borderRadius: 'var(--border-radius-sm)',
                          border: '1px solid var(--border-light)',
                          background: 'rgba(255, 255, 255, 0.02)',
                          color: 'var(--text-main)',
                          fontFamily: 'inherit',
                          width: '100%',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {joinError && (
                    <div style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem', textAlign: 'center' }}>
                      ⚠️ {joinError}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button type="submit" disabled={joinLoading} className="btn" style={{ width: '100%' }}>
                      {joinLoading ? 'Joining...' : 'Join & Sign In'}
                    </button>
                    {roster.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowJoinForm(false)}
                        className="btn btn-secondary"
                        style={{ width: '100%' }}
                      >
                        Back to List
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Detail view content */}
      {!loading && !error && trip && activeUser && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Trip Info Header Card */}
          <div className="glass-card" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
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
              <button 
                onClick={() => {
                  setPitchError('')
                  setShowPitchModal(true)
                }} 
                className="btn"
              >
                Pitch Option
              </button>
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
                  
                  return (
                    <div 
                      key={opt.id} 
                      className={`option-card ${hasVoted ? 'voted' : ''}`}
                      style={{
                        padding: '1.25rem',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: hasVoted ? '2px solid var(--accent)' : '1px solid var(--border-light)',
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
                      </div>

                      <button
                        onClick={() => handleVoteToggle(opt.id, hasVoted)}
                        className={`btn ${hasVoted ? 'btn-secondary' : ''}`}
                        style={{ 
                          width: '100%', 
                          marginTop: '8px',
                          borderColor: hasVoted ? 'var(--accent)' : 'var(--border-light)',
                          color: hasVoted ? 'var(--accent-light)' : 'var(--text-main)',
                          background: hasVoted ? 'rgba(16, 185, 129, 0.05)' : ''
                        }}
                      >
                        {hasVoted ? '✓ Voted' : 'Vote'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Roster & Participants Card */}
          <div className="glass-card" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
            <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>👥 RSVP Roster</span>
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
              <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', textAlign: 'center' }}>Pitch {activeTab} Option</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                Suggest a new {activeTab.toLowerCase()} option for the group to vote on.
              </p>

              <form onSubmit={handlePitchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                      setPitchCurrency('USD')
                      setPitchLink('')
                      setPitchDesc('')
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
    </div>
  )
}

export default TripDetails
