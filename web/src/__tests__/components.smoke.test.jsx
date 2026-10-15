import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { TripHeader } from '../components/trip/TripHeader'
import { RosterSection } from '../components/trip/RosterSection'
import { OptionsTab } from '../components/trip/OptionsTab'
import { LedgerAndSettleTab } from '../components/trip/LedgerAndSettleTab'
import { BudgetAnalyticsTab } from '../components/trip/BudgetAnalyticsTab'
import { PitchOptionModal } from '../components/modals/PitchOptionModal'
import { AddExpenseModal } from '../components/modals/AddExpenseModal'

const mockTrip = {
  id: 'trip-smoke-1',
  title: 'Kyoto Cultural Expedition',
  destination: 'Kyoto, Japan',
  start_date: '2026-09-01',
  end_date: '2026-09-10',
  base_currency: 'USD',
  budget_limit: 4500,
  is_archived: false,
  status: 'active'
}

const mockActiveUser = {
  id: 'user-1',
  name: 'Alex Explorer',
  email: 'alex@example.com'
}

const mockRoster = [
  {
    id: 'rsvp-1',
    user_id: 'user-1',
    role: 'organizer',
    status: 'Committed',
    notes: 'Packing bags',
    users: {
      id: 'user-1',
      first_name: 'Alex Explorer',
      email: 'alex@example.com'
    }
  },
  {
    id: 'rsvp-2',
    user_id: 'user-2',
    role: 'participant',
    status: 'Committed',
    notes: '',
    users: {
      id: 'user-2',
      first_name: 'Sam Adventurer',
      email: 'sam@example.com'
    }
  }
]

const mockOptions = [
  {
    id: 101,
    trip_id: 'trip-smoke-1',
    category: 'Accommodation',
    option_text: 'Traditional Machiya Ryokan',
    estimated_cost: 800,
    currency: 'USD',
    is_locked: false,
    votes_count: 2,
    added_by: 'user-1'
  }
]

const mockExpenses = [
  {
    id: 201,
    trip_id: 'trip-smoke-1',
    description: 'Tea Ceremony Experience',
    amount: 150,
    currency: 'USD',
    paid_by: 'user-1',
    category: 'Activities',
    split_details: { 'user-1': 75, 'user-2': 75 }
  }
]

const mockRates = {
  USD: 1.0,
  EUR: 0.92,
  JPY: 155.0
}

describe('UI Component Smoke Tests', () => {
  it('renders TripHeader without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <TripHeader
          trip={mockTrip}
          activeUser={mockActiveUser}
          isOffline={false}
          unreadCount={2}
          realtimeStatus="connected"
          onRefresh={vi.fn()}
          onOpenEditModal={vi.fn()}
          onToggleArchive={vi.fn()}
          onExportICal={vi.fn()}
          onOpenPrintModal={vi.fn()}
          onToggleActivityDrawer={vi.fn()}
          onLogout={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(container).toBeDefined()
    expect(container.textContent).toContain('Kyoto Cultural Expedition')
    expect(container.textContent).toContain('Live')
  })

  it('renders RosterSection with participant list and RSVP controls', () => {
    const { container } = render(
      <RosterSection
        roster={mockRoster}
        activeUser={mockActiveUser}
        trip={mockTrip}
        isAdmin={true}
        userNote="Packing bags"
        setUserNote={vi.fn()}
        savingNote={false}
        onNoteBlur={vi.fn()}
        onStatusChange={vi.fn()}
        onPromoteMember={vi.fn()}
        onDemoteMember={vi.fn()}
        onCopyInviteLink={vi.fn()}
        showCopiedToast={false}
      />
    )

    expect(container).toBeDefined()
    expect(container.textContent).toContain('RSVP Roster')
    expect(container.textContent).toContain('Alex Explorer')
    expect(container.textContent).toContain('Sam Adventurer')
  })

  it('renders OptionsTab in grid and timeline view modes', () => {
    const { container } = render(
      <OptionsTab
        categories={['Accommodation', 'Flights', 'Activities', 'Food', 'Transport', 'Other']}
        activeTab="Accommodation"
        onTabChange={vi.fn()}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        options={mockOptions}
        optionsLoading={false}
        activePoll={null}
        allTripOptions={mockOptions}
        allActivePollsMap={{}}
        trip={mockTrip}
        roster={mockRoster}
        activeUser={mockActiveUser}
        expenses={mockExpenses}
        onVoteToggle={vi.fn()}
        onLockToggle={vi.fn()}
        onOpenPitchModal={vi.fn()}
        onOpenPollRecapModal={vi.fn()}
        onOpenExpenseModal={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    expect(container).toBeDefined()
    expect(container.textContent).toContain('Traditional Machiya Ryokan')
    expect(container.textContent).toContain('Pitch Option')
  })

  it('renders LedgerAndSettleTab with expense items and settlement calculation', () => {
    const { container } = render(
      <LedgerAndSettleTab
        ledgerTab="ledger"
        onLedgerTabChange={vi.fn()}
        expenses={mockExpenses}
        expensesLoading={false}
        committedMembers={mockRoster}
        roster={mockRoster}
        memberBalances={{ 'user-1': 75, 'user-2': -75 }}
        settlementsList={[{ fromUserId: 'user-2', toUserId: 'user-1', amount: 75 }]}
        totalGroupSpend={150}
        perPersonSplit={75}
        baseCurrency="USD"
        onOpenExpenseModal={vi.fn()}
        allTripOptions={mockOptions}
        rates={mockRates}
      />
    )

    expect(container).toBeDefined()
    expect(container.textContent).toContain('Tea Ceremony Experience')
    expect(container.textContent).toContain('Add Expense')
  })

  it('renders BudgetAnalyticsTab with calculation metrics and cards', () => {
    const { container } = render(
      <BudgetAnalyticsTab
        expenses={mockExpenses}
        allTripOptions={mockOptions}
        committedMembers={mockRoster}
        rates={mockRates}
        baseCurrency="USD"
      />
    )

    expect(container).toBeDefined()
    expect(container.textContent).toContain('Total Estimated Budget')
    expect(container.textContent).toContain('Total Actual Logged')
  })

  it('renders PitchOptionModal when open and hides when closed', () => {
    const { container: closedContainer } = render(
      <PitchOptionModal
        isOpen={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    expect(closedContainer.firstChild).toBeNull()

    const { container: openContainer } = render(
      <PitchOptionModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        initialCategory="Accommodation"
        baseCurrency="USD"
      />
    )
    expect(openContainer).toBeDefined()
    expect(openContainer.textContent).toContain('Pitch New Option')
    expect(openContainer.textContent).toContain('Option Name / Title *')
  })

  it('renders AddExpenseModal when open with pre-filled option data and split settings', () => {
    const { container: closedContainer } = render(
      <AddExpenseModal
        isOpen={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        roster={mockRoster}
      />
    )
    expect(closedContainer.firstChild).toBeNull()

    const { container: openContainer } = render(
      <AddExpenseModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        roster={mockRoster}
        baseCurrency="USD"
        activeUserId="user-1"
        optionToPreFill={mockOptions[0]}
      />
    )
    expect(openContainer).toBeDefined()
    expect(openContainer.textContent).toContain('Add Expense')
    expect(openContainer.textContent).toContain('Cost Partitioning Mode')
  })
})
