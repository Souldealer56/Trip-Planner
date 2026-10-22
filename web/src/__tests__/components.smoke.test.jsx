import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, within, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

afterEach(() => {
  cleanup()
})

import { TripHeader } from '../components/trip/TripHeader'
import { RosterSection } from '../components/trip/RosterSection'
import { OptionsTab } from '../components/trip/OptionsTab'
import { LedgerAndSettleTab } from '../components/trip/LedgerAndSettleTab'
import { BudgetAnalyticsTab } from '../components/trip/BudgetAnalyticsTab'
import { PitchOptionModal } from '../components/modals/PitchOptionModal'
import { AddExpenseModal } from '../components/modals/AddExpenseModal'
import { TripDateTimeSelector } from '../components/trip/TripDateTimeSelector'

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
  first_name: 'Alex',
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
  it('renders TripHeader and toggles Actions dropdown menu', () => {
    const onOpenEditModal = vi.fn()
    const { container, getByText } = render(
      <MemoryRouter>
        <TripHeader
          trip={mockTrip}
          activeUser={mockActiveUser}
          isOffline={false}
          unreadCount={2}
          realtimeStatus="connected"
          onRefresh={vi.fn()}
          onOpenEditModal={onOpenEditModal}
          onToggleArchive={vi.fn()}
          onExportICal={vi.fn()}
          onOpenPrintModal={vi.fn()}
          onOpenPollRecapModal={vi.fn()}
          onToggleActivityDrawer={vi.fn()}
          onLogout={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(container).toBeDefined()
    expect(container.textContent).toContain('Kyoto Cultural Expedition')
    expect(container.textContent).toContain('Live')
    expect(container.textContent).toContain('Share Invite')
    expect(container.textContent).toContain('Feed')

    // Find and click Actions menu trigger
    const actionsTrigger = container.querySelector('.actions-menu-trigger')
    expect(actionsTrigger).toBeDefined()
    fireEvent.click(actionsTrigger)

    // Verify secondary actions are revealed in dropdown
    expect(container.textContent).toContain('Edit Trip')
    expect(container.textContent).toContain('Export iCal')
    expect(container.textContent).toContain('Print Itinerary')
    expect(container.textContent).toContain('Poll Recap')
    expect(container.textContent).toContain('Switch Profile / Log Out')

    // Click Edit Trip and verify handler called
    const editBtn = getByText('Edit Trip')
    fireEvent.click(editBtn)
    expect(onOpenEditModal).toHaveBeenCalled()
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
    // Confirm duplicate Refresh button is removed from OptionsTab toolbar
    expect(container.textContent).not.toContain('🔄 Refresh')
  })

  it('renders LedgerAndSettleTab with expense items, mobile stacked cards, and settlement calculation', () => {
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
    expect(container.querySelector('.ledger-mobile-cards')).not.toBeNull()
    expect(container.querySelector('.ledger-card')).not.toBeNull()
    expect(container.querySelector('.ledger-card-desc')?.textContent).toContain('Tea Ceremony Experience')
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

  it('pre-fills dates in PitchOptionModal from trip when creating and preserves dates in edit mode', () => {
    // 1. Create mode with trip prop
    const { container: createContainer } = render(
      <PitchOptionModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        initialCategory="Activities"
        trip={mockTrip}
      />
    )
    const inputs = createContainer.querySelectorAll('input[type="datetime-local"]')
    expect(inputs.length).toBe(2)
    // Activities default to Day 1: 09:00 to 12:00
    expect(inputs[0].value).toBe('2026-09-01T09:00')
    expect(inputs[1].value).toBe('2026-09-01T12:00')

    // 2. Edit mode: preserves saved option dates
    const editingOpt = {
      id: 'opt-custom-dates',
      category: 'Activities',
      option_text: 'Sunset Kayaking',
      start_date: '2026-09-05T17:30',
      end_date: '2026-09-05T20:00'
    }
    const { container: editContainer } = render(
      <PitchOptionModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        editingOption={editingOpt}
        trip={mockTrip}
      />
    )
    const editInputs = editContainer.querySelectorAll('input[type="datetime-local"]')
    expect(editInputs[0].value).toBe('2026-09-05T17:30')
    expect(editInputs[1].value).toBe('2026-09-05T20:00')
  })

  it('renders TripDateTimeSelector with quick-select day chips and time presets', () => {
    const handleChange = vi.fn()
    const { container } = render(
      <TripDateTimeSelector
        trip={{ start_date: '2026-09-01', end_date: '2026-09-03' }}
        startDate="2026-09-01T09:00"
        endDate="2026-09-01T12:00"
        onChange={handleChange}
        category="Activities"
      />
    )

    const view = within(container)
    expect(container.textContent).toContain('Trip Window:')
    expect(container.textContent).toContain('Sep 1 – Sep 3, 2026')
    expect(view.getByText('🗺️ Full Trip')).toBeDefined()
    expect(view.getByText('Day 1 · Sep 1')).toBeDefined()
    expect(view.getByText('Day 2 · Sep 2')).toBeDefined()
    expect(view.getByText('Day 3 · Sep 3')).toBeDefined()

    // Click Day 2 chip -> sets date to 2026-09-02 while preserving hours 09:00 - 12:00
    fireEvent.click(view.getByText('Day 2 · Sep 2'))
    expect(handleChange).toHaveBeenCalledWith({
      startDate: '2026-09-02T09:00',
      endDate: '2026-09-02T12:00'
    })

    // Click Evening preset -> updates hours to 19:30 - 22:00
    const eveningPreset = view.getByText('🌙 Evening')
    fireEvent.click(eveningPreset)
    expect(handleChange).toHaveBeenCalledWith({
      startDate: '2026-09-01T19:30',
      endDate: '2026-09-01T22:00'
    })
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
