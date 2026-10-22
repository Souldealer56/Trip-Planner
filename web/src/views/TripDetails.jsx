import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTripDetails } from '../hooks/useTripDetails'
import { useRsvpRoster } from '../hooks/useRsvpRoster'
import { useUserSession } from '../hooks/useUserSession'
import { useTripRealtime } from '../hooks/useTripRealtime'
import { useTripFinancials } from '../hooks/useTripFinancials'
import { useTripOptionsManager } from '../hooks/useTripOptionsManager'
import { useTripManagement } from '../hooks/useTripManagement'
import { useRosterActions } from '../hooks/useRosterActions'
import { saveMealPlan } from '../services/groceries'
import { buildDefaultOptionDates } from '../utils/format'
import { saveTripOfflineSnapshot, loadTripOfflineSnapshot } from '../utils/offlineCache'

// Extracted Modular Sub-Components
import { TripHeader } from '../components/trip/TripHeader'
import { WorkspaceTabsNav } from '../components/trip/WorkspaceTabsNav'
import { WorkspaceContentPane } from '../components/trip/WorkspaceContentPane'
import { NotOnRosterModal } from '../components/trip/NotOnRosterModal'
import { TripModalsContainer } from '../components/trip/TripModalsContainer'

/**
 * TripDetails View
 * Refactored modular orchestration cockpit for Trip Overview, Itinerary / Gantt,
 * Pitched Options, Meals & Groceries, Expense Ledger, and Crew Roster.
 */
export function TripDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeUser, logout, updateActiveUser } = useUserSession()

  // Offline snapshot cache fallback
  const offlineSnapshot = useMemo(() => loadTripOfflineSnapshot(id), [id])

  // Core Trip & Roster Queries
  const { trip, loading: tripLoading, error: tripError, refreshTrip } = useTripDetails(id, offlineSnapshot?.trip)
  const { roster, loading: rosterLoading, error: rosterError, refreshRoster } = useRsvpRoster(id, offlineSnapshot?.roster)

  // Workspace tab state
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('itinerary')

  // Expense modal states
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseOptionToPreFill, setExpenseOptionToPreFill] = useState(null)
  const [expenseToEdit, setExpenseToEdit] = useState(null)
  const [expenseLoading, setExpenseLoading] = useState(false)
  const [expenseError, setExpenseError] = useState('')

  // Trip Management, Settings, Activity Logs & iCal Hook
  const tripManagement = useTripManagement({
    tripId: id,
    trip,
    refreshTrip,
    navigate
  })
  const { loadActivityLogs } = tripManagement

  // Options & Polls Manager Hook
  const {
    categories,
    activeTab,
    setActiveTab,
    options,
    optionsLoading,
    activePoll,
    viewMode,
    setViewMode,
    allTripOptions,
    allActivePollsMap,
    categoryOptions,
    voteError,
    setVoteError,
    loadOptionsAndPoll,
    loadGanttData,
    showPitchModal,
    setShowPitchModal,
    pitchInitialCategory,
    setPitchInitialCategory,
    pitchInitialDates,
    setPitchInitialDates,
    pitchLoading,
    pitchError,
    editingOption,
    setEditingOption,
    handleVoteToggle,
    handleLockToggle,
    handleDeleteOption,
    handleUpdateOptionDates,
    handleToggleOptionParticipant,
    handleOpenEditOptionModal,
    handlePitchSubmit
  } = useTripOptionsManager({
    tripId: id,
    trip,
    activeUser,
    onActivityLogged: loadActivityLogs,
    initialOptions: offlineSnapshot?.options
  })

  // Financials & Settlements Hook
  const committedMembers = useMemo(() => roster.filter((m) => m.status === 'Committed'), [roster])
  const baseCurrency = trip?.base_currency || 'USD'

  const {
    expenses,
    expensesLoading,
    rates,
    ledgerTab,
    setLedgerTab,
    loadExpenses,
    memberBalances,
    totalGroupSpend,
    settlementsList,
    perPersonSplit,
    submitExpense,
    removeExpense,
    logGroceryExpense
  } = useTripFinancials({
    tripId: id,
    baseCurrency,
    activeUser,
    committedMembers,
    onActivityLogged: loadActivityLogs,
    initialExpenses: offlineSnapshot?.expenses
  })

  // Roster Actions & Session Reconciliation Hook
  const {
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
  } = useRosterActions({
    tripId: id,
    trip,
    roster,
    activeUser,
    refreshRoster,
    onActivityLogged: loadActivityLogs,
    updateActiveUser
  })

  // Cache trip & roster changes to offline snapshot
  useEffect(() => {
    if (trip || roster.length > 0) {
      saveTripOfflineSnapshot(id, { trip, roster })
    }
  }, [id, trip, roster])

  // Unified Refresh Handler
  const handleRefresh = useCallback(() => {
    refreshTrip()
    refreshRoster()
    if (viewMode === 'gantt') loadGanttData()
    else loadOptionsAndPoll()
    loadExpenses()
    loadActivityLogs()
  }, [refreshTrip, refreshRoster, viewMode, loadGanttData, loadOptionsAndPoll, loadExpenses, loadActivityLogs])

  // Real-Time Multi-User Synchronization via Supabase CDC
  const { status: realtimeStatus, isOffline } = useTripRealtime(id, {
    onTripsChange: () => {
      refreshTrip()
      loadActivityLogs()
    },
    onRsvpsChange: () => {
      refreshRoster()
      loadActivityLogs()
    },
    onOptionsChange: () => {
      if (viewMode === 'gantt') loadGanttData()
      else loadOptionsAndPoll()
      loadActivityLogs()
    },
    onPollsChange: () => {
      loadOptionsAndPoll()
      loadActivityLogs()
    },
    onExpensesChange: () => {
      loadExpenses()
      loadActivityLogs()
    },
    onGroceriesChange: () => {
      if (viewMode === 'gantt') loadGanttData()
      else loadOptionsAndPoll()
      loadActivityLogs()
    },
    onActivityChange: () => {
      loadActivityLogs()
    }
  })

  // Expense Submission & Deletion Handlers
  const handleExpenseSubmit = async (expenseData) => {
    setExpenseLoading(true)
    setExpenseError('')
    try {
      await submitExpense(expenseData)
      setShowExpenseModal(false)
      setExpenseToEdit(null)
      setExpenseOptionToPreFill(null)
    } catch (err) {
      console.error('Failed to log expense:', err)
      setExpenseError(err.message || 'Failed to save expense.')
    } finally {
      setExpenseLoading(false)
    }
  }

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to remove this expense?')) return
    try {
      await removeExpense(expenseId)
    } catch (err) {
      console.error('Failed to delete expense:', err)
      alert(err.message || 'Failed to delete expense.')
    }
  }

  const handleSubmitMeal = async (mealData) => {
    try {
      await saveMealPlan({
        trip_id: id,
        ...mealData,
        added_by: activeUser?.id,
        currency: mealData.currency || trip?.base_currency || 'USD'
      })
      await loadOptionsAndPoll()
      loadActivityLogs()
    } catch (err) {
      console.error('Failed to submit meal:', err)
      throw err
    }
  }

  const handleOpenPitchModal = (cat, start = '', end = '') => {
    setEditingOption(null)
    const targetCat = cat || activeTab
    const defaultDates = buildDefaultOptionDates(trip?.start_date, trip?.end_date, targetCat)
    setPitchInitialCategory(targetCat)
    setPitchInitialDates({ start: start || defaultDates.start, end: end || defaultDates.end })
    setShowPitchModal(true)
  }

  const handleOpenExpenseModal = (opt) => {
    setExpenseOptionToPreFill(opt ? { ...opt, category: opt.category || activeTab || 'Accommodation' } : null)
    setShowExpenseModal(true)
  }

  const handleClosePitchModal = () => {
    setShowPitchModal(false)
    setEditingOption(null)
  }

  const handleCloseExpenseModal = () => {
    setShowExpenseModal(false)
    setExpenseToEdit(null)
    setExpenseOptionToPreFill(null)
  }

  const onLogout = () => {
    logout()
    navigate('/')
  }

  const totalOptionsCount = allTripOptions.length > 0 ? allTripOptions.length : options.length
  const expensesCount = expenses.length
  const rosterCount = roster.length

  if (tripLoading && !trip) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem 0' }}>
        <div className="spinner" style={{ margin: '0 auto 1.5rem' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>Loading expedition workspace...</p>
      </div>
    )
  }

  if (tripError && !trip) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem 0' }}>
        <h2 style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>Trip Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{tripError}</p>
        <button type="button" onClick={() => navigate('/trips')} className="btn btn-primary">
          Back to My Trips
        </button>
      </div>
    )
  }

  return (
    <div className="container trip-details-page">
      {/* Offline Sync Banner */}
      {isOffline && (
        <div className="alert-banner alert-banner-warning animate-fade-in" style={{ marginBottom: '1rem' }}>
          <span>📡 Offline mode — Viewing cached trip data. Changes will sync when reconnected.</span>
        </div>
      )}

      {/* Blocking Modal strictly if user is confirmed NOT in roster after loading completes */}
      <NotOnRosterModal
        isOpen={!tripLoading && !rosterLoading && trip !== null && activeUser && !activeUserInRoster}
        activeUser={activeUser}
        onJoinRoster={handleJoinRoster}
        onLogout={onLogout}
        reconcileLoading={reconcileLoading}
        reconcileError={reconcileError}
      />

      {/* Main Trip Cockpit Header */}
      <TripHeader
        trip={trip}
        activeUser={activeUser}
        isOffline={isOffline}
        unreadCount={tripManagement.unreadCount}
        realtimeStatus={realtimeStatus}
        onRefresh={handleRefresh}
        onOpenEditModal={() => {
          tripManagement.setEditingTripSnapshot(trip)
          tripManagement.setShowEditTripModal(true)
        }}
        onToggleArchive={tripManagement.handleToggleArchive}
        onExportICal={tripManagement.handleExportICal}
        onOpenPrintModal={() => tripManagement.setShowPrintableItineraryModal(true)}
        onOpenPollRecapModal={() => tripManagement.setShowPollRecapModal(true)}
        onToggleActivityDrawer={tripManagement.handleToggleDrawer}
        onLogout={onLogout}
      />

      {/* 3-Tab Workspace Navigation */}
      <WorkspaceTabsNav
        activeWorkspaceTab={activeWorkspaceTab}
        onTabChange={setActiveWorkspaceTab}
        totalOptionsCount={totalOptionsCount}
        expensesCount={expensesCount}
        rosterCount={rosterCount}
      />

      {/* Full-Width Workspace Active Content */}
      <WorkspaceContentPane
        activeWorkspaceTab={activeWorkspaceTab}
        voteError={voteError}
        setVoteError={setVoteError}
        categories={categories}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        viewMode={viewMode}
        setViewMode={setViewMode}
        categoryOptions={categoryOptions}
        optionsLoading={optionsLoading}
        activePoll={activePoll}
        allTripOptions={allTripOptions}
        allActivePollsMap={allActivePollsMap}
        trip={trip}
        roster={roster}
        activeUser={activeUser}
        expenses={expenses}
        rates={rates}
        handleVoteToggle={handleVoteToggle}
        handleLockToggle={handleLockToggle}
        handleDeleteOption={handleDeleteOption}
        handleOpenEditOptionModal={handleOpenEditOptionModal}
        handleUpdateOptionDates={handleUpdateOptionDates}
        onOpenPitchModal={handleOpenPitchModal}
        onOpenPollRecapModal={() => setShowPollRecapModal(true)}
        onOpenExpenseModal={handleOpenExpenseModal}
        loadGanttData={loadGanttData}
        loadOptionsAndPoll={loadOptionsAndPoll}
        handleToggleOptionParticipant={handleToggleOptionParticipant}
        logGroceryExpense={logGroceryExpense}
        handleSubmitMeal={handleSubmitMeal}
        ledgerTab={ledgerTab}
        setLedgerTab={setLedgerTab}
        expensesLoading={expensesLoading}
        committedMembers={committedMembers}
        memberBalances={memberBalances}
        settlementsList={settlementsList}
        totalGroupSpend={totalGroupSpend}
        perPersonSplit={perPersonSplit}
        baseCurrency={baseCurrency}
        onOpenCreateExpense={() => {
          setExpenseToEdit(null)
          setExpenseOptionToPreFill(null)
          setShowExpenseModal(true)
        }}
        onEditExpense={(exp) => {
          setExpenseOptionToPreFill(null)
          setExpenseToEdit(exp)
          setShowExpenseModal(true)
        }}
        handleDeleteExpense={handleDeleteExpense}
        options={options}
        isAdmin={isAdmin}
        userNote={userNote}
        setUserNote={setUserNote}
        savingNote={savingNote}
        handleNoteBlur={handleNoteBlur}
        handleStatusChange={handleStatusChange}
        handlePromoteMember={handlePromoteMember}
        handleDemoteMember={handleDemoteMember}
        handleCopyInviteLink={handleCopyInviteLink}
        showCopiedToast={showCopiedToast}
        handleUpdateRsvpDetails={handleUpdateRsvpDetails}
      />

      {/* Extracted Modular Modals & Drawer */}
      <TripModalsContainer
        tripManagement={tripManagement}
        showPitchModal={showPitchModal}
        onClosePitchModal={handleClosePitchModal}
        onPitchSubmit={handlePitchSubmit}
        pitchLoading={pitchLoading}
        pitchError={pitchError}
        categories={categories}
        pitchInitialCategory={pitchInitialCategory}
        pitchInitialDates={pitchInitialDates}
        baseCurrency={baseCurrency}
        roster={roster}
        activeUser={activeUser}
        editingOption={editingOption}
        trip={trip}
        showExpenseModal={showExpenseModal}
        onCloseExpenseModal={handleCloseExpenseModal}
        onExpenseSubmit={handleExpenseSubmit}
        expenseLoading={expenseLoading}
        expenseError={expenseError}
        expenseOptionToPreFill={expenseOptionToPreFill}
        expenseToEdit={expenseToEdit}
        printableOptions={allTripOptions.length > 0 ? allTripOptions : options}
        activeTab={activeTab}
        options={options}
        activePoll={activePoll}
      />
    </div>
  )
}

export default TripDetails
