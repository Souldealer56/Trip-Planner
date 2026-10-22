import React from 'react'
import { OptionsTab } from './OptionsTab'
import { LedgerAndSettleTab } from './LedgerAndSettleTab'
import { RosterSection } from './RosterSection'

/**
 * WorkspaceContentPane
 * Active tab panel renderer switching between Itinerary (Options/Gantt),
 * Expense Ledger & Debt Settlements, and Crew Roster.
 */
export function WorkspaceContentPane({
  activeWorkspaceTab,
  voteError,
  setVoteError,
  // Itinerary props
  categories,
  activeTab,
  setActiveTab,
  viewMode,
  setViewMode,
  categoryOptions,
  optionsLoading,
  activePoll,
  allTripOptions,
  allActivePollsMap,
  trip,
  roster,
  activeUser,
  expenses,
  rates,
  handleVoteToggle,
  handleLockToggle,
  handleDeleteOption,
  handleOpenEditOptionModal,
  handleUpdateOptionDates,
  onOpenPitchModal,
  onOpenPollRecapModal,
  onOpenExpenseModal,
  loadGanttData,
  loadOptionsAndPoll,
  handleToggleOptionParticipant,
  logGroceryExpense,
  handleSubmitMeal,
  // Ledger props
  ledgerTab,
  setLedgerTab,
  expensesLoading,
  committedMembers,
  memberBalances,
  settlementsList,
  totalGroupSpend,
  perPersonSplit,
  baseCurrency,
  onOpenCreateExpense,
  onEditExpense,
  handleDeleteExpense,
  options,
  // Roster props
  isAdmin,
  userNote,
  setUserNote,
  savingNote,
  handleNoteBlur,
  handleStatusChange,
  handlePromoteMember,
  handleDemoteMember,
  handleCopyInviteLink,
  showCopiedToast,
  handleUpdateRsvpDetails
}) {
  return (
    <main className="workspace-content-pane">
      {voteError && (
        <div
          className="alert-banner alert-banner-danger animate-fade-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 16px',
            marginBottom: '1rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5'
          }}
        >
          <span>⚠️ {voteError}</span>
          <button
            type="button"
            onClick={() => setVoteError('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fca5a5',
              fontSize: '1.2rem',
              cursor: 'pointer',
              lineHeight: 1
            }}
            title="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {activeWorkspaceTab === 'itinerary' && (
        <div id="panel-itinerary" role="tabpanel" aria-labelledby="tab-itinerary" className="animate-fade-in">
          <OptionsTab
            categories={categories}
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
            onEditOption={handleOpenEditOptionModal}
            onUpdateOptionDates={handleUpdateOptionDates}
            onOpenPitchModal={onOpenPitchModal}
            onOpenPollRecapModal={onOpenPollRecapModal}
            onOpenExpenseModal={onOpenExpenseModal}
            onRefresh={viewMode === 'gantt' ? loadGanttData : loadOptionsAndPoll}
            onToggleParticipant={handleToggleOptionParticipant}
            onLogExpense={logGroceryExpense}
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
            onOpenExpenseModal={onOpenCreateExpense}
            onEditExpense={onEditExpense}
            onDeleteExpense={handleDeleteExpense}
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
  )
}
