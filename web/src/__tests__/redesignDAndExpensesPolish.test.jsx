import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { RosterSection } from '../components/trip/RosterSection'
import { LedgerAndSettleTab, stripCategoryPrefix } from '../components/trip/LedgerAndSettleTab'
import { AddExpenseModal } from '../components/modals/AddExpenseModal'
import { updateExpense, deleteExpense } from '../services/expenses'
import { supabase } from '../services/supabase'

vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

afterEach(() => {
  cleanup()
})

describe('Redesign Proposal D — Unified Active User Card in Crew & RSVPs', () => {
  const trip = {
    id: 'trip-100',
    title: 'Banff Alpine Retreat',
    start_date: '2026-12-20',
    end_date: '2026-12-27',
    organizer_id: 'user-alexis'
  }

  const activeUser = {
    id: 'user-alexis',
    first_name: 'Alexis',
    username: 'souldealer56'
  }

  const roster = [
    {
      id: 'rsvp-1',
      user_id: 'user-alexis',
      role: 'organizer',
      status: 'Committed',
      arrival_date: '2026-12-20',
      departure_date: '2026-12-27',
      dietary_tags: ['🌱 Vegetarian'],
      notes: 'Carrying the first-aid kit',
      users: {
        id: 'user-alexis',
        first_name: 'Alexis',
        username: 'souldealer56'
      }
    },
    {
      id: 'rsvp-2',
      user_id: 'user-nolwen',
      role: 'participant',
      status: 'Committed',
      arrival_date: '2026-12-21',
      departure_date: '2026-12-26',
      dietary_tags: ['🌾 Gluten-Free'],
      notes: 'Renting snowboard',
      users: {
        id: 'user-nolwen',
        first_name: 'Nolwen',
        username: 'nolwen_adventurer'
      }
    }
  ]

  it('renders a single unified "My RSVP" card at the top with avatar, name, You badge, and handle', () => {
    render(
      <RosterSection
        roster={roster}
        activeUser={activeUser}
        trip={trip}
        isAdmin={true}
        userNote="Carrying the first-aid kit"
        setUserNote={vi.fn()}
      />
    )

    // My RSVP header
    expect(screen.getByText('My RSVP')).toBeTruthy()

    // Active user information in My RSVP card
    expect(screen.getByText('Alexis')).toBeTruthy()
    expect(screen.getByText('You')).toBeTruthy()
    expect(screen.getByText('@souldealer56')).toBeTruthy()
    expect(screen.getByText(/👑 Organizer/i)).toBeTruthy()

    // Redundant Share button next to RSVP Roster title is removed
    expect(screen.queryByRole('button', { name: /🔗 Share/i })).toBeNull()
    expect(screen.queryByTitle('Copy Invite Link')).toBeNull()
  })

  it('renders a 3-state segmented status control (✓ Committed | ? Tentative | ✕ Declined) and triggers onStatusChange', () => {
    const onStatusChangeMock = vi.fn()

    render(
      <RosterSection
        roster={roster}
        activeUser={activeUser}
        trip={trip}
        isAdmin={true}
        onStatusChange={onStatusChangeMock}
      />
    )

    const committedBtn = screen.getByRole('button', { name: /✓ Committed/i })
    const tentativeBtn = screen.getByRole('button', { name: /\? Tentative/i })
    const declinedBtn = screen.getByRole('button', { name: /✕ Declined/i })

    expect(committedBtn).toBeTruthy()
    expect(tentativeBtn).toBeTruthy()
    expect(declinedBtn).toBeTruthy()

    // Click Tentative
    fireEvent.click(tentativeBtn)
    expect(onStatusChangeMock).toHaveBeenCalledWith({ target: { value: 'Tentative' } })

    // Click Declined
    fireEvent.click(declinedBtn)
    expect(onStatusChangeMock).toHaveBeenCalledWith({ target: { value: 'Declined' } })
  })

  it('renders 2-column arrival and departure date inputs and dietary toggle pills without desktop-biased wording', () => {
    render(
      <RosterSection
        roster={roster}
        activeUser={activeUser}
        trip={trip}
        userNote="Carrying the first-aid kit"
        setUserNote={vi.fn()}
      />
    )

    // Arrival and departure date labels
    expect(screen.getByText(/🛫 Arrival Date/i)).toBeTruthy()
    expect(screen.getByText(/🛬 Departure Date/i)).toBeTruthy()

    // Dietary preferences label does NOT contain desktop-biased "(Click to toggle)"
    expect(screen.getByText(/🥗 Dietary Preferences & Allergies/i)).toBeTruthy()
    expect(screen.queryByText(/Click to toggle/i)).toBeNull()

    // Notes field directly inside the unified card
    expect(screen.getByPlaceholderText(/Add RSVP details\/notes.../i)).toBeTruthy()
  })

  it('lists other participants under OTHER TRAVELERS section and ensures active user only appears once', () => {
    render(
      <RosterSection
        roster={roster}
        activeUser={activeUser}
        trip={trip}
      />
    )

    // OTHER TRAVELERS header
    expect(screen.getByText(/OTHER TRAVELERS/i)).toBeTruthy()

    // Nolwen is in OTHER TRAVELERS
    expect(screen.getByText('Nolwen')).toBeTruthy()
    expect(screen.getByText('@nolwen_adventurer')).toBeTruthy()

    // Alexis only appears once in the entire roster (in My RSVP card)
    const alexisOccurrences = screen.getAllByText('Alexis')
    expect(alexisOccurrences.length).toBe(1)
  })
})

describe('Expenses & Settlements Polish', () => {
  const committedMembers = [
    { user_id: 'u1', users: { first_name: 'Alexis' } },
    { user_id: 'u2', users: { first_name: 'Nolwen' } }
  ]

  const mockExpenses = [
    {
      id: 'exp-1',
      paid_by: 'u1',
      amount: 450,
      currency: 'USD',
      category: 'accommodation',
      description: '[ACCOMMODATION] Harvey heights',
      split_users: ['u1', 'u2'],
      created_at: '2026-10-20T12:00:00Z',
      users: { first_name: 'Alexis' }
    },
    {
      id: 'exp-2',
      paid_by: 'u2',
      amount: 60,
      currency: 'USD',
      category: 'food',
      description: 'Mountain Cafe Lunch',
      split_users: ['u1', 'u2'],
      created_at: '2026-10-20T14:00:00Z',
      users: { first_name: 'Nolwen' }
    }
  ]

  it('stripCategoryPrefix cleanly removes [CATEGORY] prefixes from descriptions', () => {
    expect(stripCategoryPrefix('[ACCOMMODATION] Harvey heights')).toBe('Harvey heights')
    expect(stripCategoryPrefix('[TRANSPORT] Flight from SFO')).toBe('Flight from SFO')
    expect(stripCategoryPrefix('[food] dinner for the group')).toBe('dinner for the group')
    expect(stripCategoryPrefix('Regular Expense Without Tag')).toBe('Regular Expense Without Tag')
    expect(stripCategoryPrefix('')).toBe('')
    expect(stripCategoryPrefix(null)).toBe('')
  })

  it('displays Harvey heights cleanly without [ACCOMMODATION] in both table and mobile cards', () => {
    const { container } = render(
      <LedgerAndSettleTab
        ledgerTab="ledger"
        onLedgerTabChange={vi.fn()}
        expenses={mockExpenses}
        committedMembers={committedMembers}
        roster={committedMembers}
        baseCurrency="USD"
        onOpenExpenseModal={vi.fn()}
      />
    )

    // "Harvey heights" is present
    expect(screen.getAllByText('Harvey heights').length).toBeGreaterThan(0)

    // "[ACCOMMODATION] Harvey heights" is NOT displayed
    expect(container.textContent).not.toContain('[ACCOMMODATION]')
  })

  it('harmonizes the 3-tab segmented control with uniform icons and styling', () => {
    const onLedgerTabChangeMock = vi.fn()

    render(
      <LedgerAndSettleTab
        ledgerTab="ledger"
        onLedgerTabChange={onLedgerTabChangeMock}
        expenses={mockExpenses}
        committedMembers={committedMembers}
        roster={committedMembers}
      />
    )

    const ledgerBtn = screen.getByRole('button', { name: /Ledger List/i })
    const settleBtn = screen.getByRole('button', { name: /Settle Up/i })
    const analyticsBtn = screen.getByRole('button', { name: /Budget Analytics/i })

    expect(ledgerBtn.textContent).toContain('🧾')
    expect(ledgerBtn.textContent).toContain('Ledger List')

    expect(settleBtn.textContent).toContain('🤝')
    expect(settleBtn.textContent).toContain('Settle Up')

    expect(analyticsBtn.textContent).toContain('📊')
    expect(analyticsBtn.textContent).toContain('Budget Analytics')

    fireEvent.click(settleBtn)
    expect(onLedgerTabChangeMock).toHaveBeenCalledWith('settle')
  })

  it('renders Edit and Delete action triggers on expenses and invokes callbacks', () => {
    const onEditExpenseMock = vi.fn()
    const onDeleteExpenseMock = vi.fn()

    render(
      <LedgerAndSettleTab
        ledgerTab="ledger"
        onLedgerTabChange={vi.fn()}
        expenses={mockExpenses}
        committedMembers={committedMembers}
        roster={committedMembers}
        onEditExpense={onEditExpenseMock}
        onDeleteExpense={onDeleteExpenseMock}
      />
    )

    const editBtns = screen.getAllByRole('button', { name: /Edit/i })
    expect(editBtns.length).toBeGreaterThan(0)
    fireEvent.click(editBtns[0])
    expect(onEditExpenseMock).toHaveBeenCalledWith(mockExpenses[0])

    const deleteBtns = screen.getAllByRole('button', { name: /Delete/i })
    expect(deleteBtns.length).toBeGreaterThan(0)
    fireEvent.click(deleteBtns[0])
    expect(onDeleteExpenseMock).toHaveBeenCalledWith(mockExpenses[0].id)
  })
})

describe('AddExpenseModal Edit Mode', () => {
  const roster = [
    { user_id: 'u1', status: 'Committed', users: { first_name: 'Alexis' } },
    { user_id: 'u2', status: 'Committed', users: { first_name: 'Nolwen' } }
  ]

  it('renders in Edit mode when expenseToEdit is provided, pre-fills stripped description, and calls onSubmit with expenseId', () => {
    const onSubmitMock = vi.fn()
    const expenseToEdit = {
      id: 'exp-99',
      description: '[ACCOMMODATION] Harvey heights',
      amount: 450,
      currency: 'USD',
      category: 'accommodation',
      paid_by: 'u1',
      split_users: ['u1', 'u2']
    }

    render(
      <AddExpenseModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmitMock}
        roster={roster}
        baseCurrency="USD"
        activeUserId="u1"
        expenseToEdit={expenseToEdit}
      />
    )

    // Modal title & button reflect Edit mode
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Edit Expense')
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeTruthy()

    // Description is stripped of [ACCOMMODATION]
    const descInput = screen.getByDisplayValue('Harvey heights')
    expect(descInput).toBeTruthy()

    // Amount prefilled
    const amountInput = screen.getByDisplayValue('450')
    expect(amountInput).toBeTruthy()

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

    expect(onSubmitMock).toHaveBeenCalledWith({
      description: 'Harvey heights',
      amount: 450,
      currency: 'USD',
      category: 'accommodation',
      paidBy: 'u1',
      splitUsers: ['u1', 'u2'],
      optionId: null,
      expenseId: 'exp-99'
    })
  })
})

describe('Expenses Service updateExpense and deleteExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updateExpense sends correct update payload and returns updated expense', async () => {
    const mockUpdated = { id: 'exp-1', amount: 500, description: 'Updated Expense' }

    const singleMock = vi.fn().mockResolvedValue({ data: mockUpdated, error: null })
    const selectMock = vi.fn().mockReturnValue({ single: singleMock })
    const eqMock = vi.fn().mockReturnValue({ select: selectMock })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    supabase.from.mockReturnValue({ update: updateMock })

    const result = await updateExpense('exp-1', {
      description: 'Updated Expense',
      amount: 500,
      currency: 'USD',
      category: 'activities',
      paidBy: 'u1',
      splitUsers: ['u1']
    })

    expect(supabase.from).toHaveBeenCalledWith('expenses')
    expect(updateMock).toHaveBeenCalledWith({
      paid_by: 'u1',
      amount: 500,
      currency: 'USD',
      description: 'Updated Expense',
      split_users: ['u1'],
      category: 'activities'
    })
    expect(eqMock).toHaveBeenCalledWith('id', 'exp-1')
    expect(result).toEqual(mockUpdated)
  })

  it('deleteExpense deletes the expense by UUID', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock })
    supabase.from.mockReturnValue({ delete: deleteMock })

    const res = await deleteExpense('exp-1')
    expect(supabase.from).toHaveBeenCalledWith('expenses')
    expect(deleteMock).toHaveBeenCalled()
    expect(eqMock).toHaveBeenCalledWith('id', 'exp-1')
    expect(res).toBe(true)
  })
})
