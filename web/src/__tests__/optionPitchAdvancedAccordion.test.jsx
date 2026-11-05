import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { OptionPitchModal } from '../components/OptionPitchModal'

describe('TASK 3: OptionPitchModal Advanced Options Accordion', () => {
  afterEach(cleanup)
  const mockTrip = {
    id: 'trip-101',
    start_date: '2026-08-01',
    end_date: '2026-08-07',
    base_currency: 'USD'
  }

  const mockRoster = [
    {
      id: 'rsvp-1',
      user_id: 'user-1',
      status: 'Committed',
      users: { id: 'user-1', first_name: 'Alex' }
    },
    {
      id: 'rsvp-2',
      user_id: 'user-2',
      status: 'Committed',
      users: { id: 'user-2', first_name: 'Sam' }
    }
  ]

  it('renders Essential View by default with drawer collapsed and no badge when fields are empty', () => {
    const { container } = render(
      <OptionPitchModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        trip={mockTrip}
        roster={mockRoster}
        initialCategory="Accommodation"
        baseCurrency="USD"
      />
    )

    // Essential View items
    expect(screen.getByText('Category *')).toBeDefined()
    expect(screen.getByText('Option Name / Title *')).toBeDefined()
    expect(screen.getByText('Estimated Total Cost')).toBeDefined()
    expect(screen.getByText(/Who’s Participating/)).toBeDefined()
    expect(container.querySelector('.airbnb-date-picker-card')).toBeDefined()

    // Advanced Options toggle button
    const toggleBtn = screen.getByRole('button', { name: /Advanced Options & Category Details/i })
    expect(toggleBtn).toBeDefined()
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false')

    // Badge should not be displayed when count is 0
    expect(container.querySelector('.advanced-count-badge')).toBeNull()

    // Drawer container should not have .open class
    const drawer = container.querySelector('#advanced-options-drawer')
    expect(drawer).toBeDefined()
    expect(drawer.classList.contains('open')).toBe(false)
  })

  it('toggles the Advanced Options drawer open and closed on button click', () => {
    const { container } = render(
      <OptionPitchModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        trip={mockTrip}
        roster={mockRoster}
        initialCategory="Accommodation"
      />
    )

    const toggleBtn = screen.getByRole('button', { name: /Advanced Options & Category Details/i })
    const drawer = container.querySelector('#advanced-options-drawer')

    // Initial state: closed
    expect(drawer.classList.contains('open')).toBe(false)
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false')

    // Click to open
    fireEvent.click(toggleBtn)
    expect(drawer.classList.contains('open')).toBe(true)
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true')

    // Click to close
    fireEvent.click(toggleBtn)
    expect(drawer.classList.contains('open')).toBe(false)
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false')
  })

  it('updates the activeAdvancedCount badge when pricing split is changed from default', () => {
    const { container } = render(
      <OptionPitchModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        trip={mockTrip}
        roster={mockRoster}
        initialCategory="Accommodation"
      />
    )

    // Accommodation defaults to split_total, badge is initially null
    expect(container.querySelector('.advanced-count-badge')).toBeNull()

    // Open drawer and switch to per_person
    const toggleBtn = screen.getByRole('button', { name: /Advanced Options & Category Details/i })
    fireEvent.click(toggleBtn)

    const perPersonBtn = screen.getByRole('button', { name: /Per Person \/ Ticket/i })
    fireEvent.click(perPersonBtn)

    // Badge should now display "1 set"
    const badge = container.querySelector('.advanced-count-badge')
    expect(badge).toBeDefined()
    expect(badge.textContent).toBe('1 set')

    // Switch back to split_total (category default)
    const splitTotalBtn = screen.getByRole('button', { name: /Split Total \(Default\)/i })
    fireEvent.click(splitTotalBtn)

    // Badge disappears
    expect(container.querySelector('.advanced-count-badge')).toBeNull()
  })

  it('computes activeAdvancedCount badge across category fields, link, and description', () => {
    const { container } = render(
      <OptionPitchModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        trip={mockTrip}
        roster={mockRoster}
        initialCategory="Accommodation"
      />
    )

    const toggleBtn = screen.getByRole('button', { name: /Advanced Options & Category Details/i })
    fireEvent.click(toggleBtn)

    // Fill beds summary (+1)
    const bedsInput = screen.getByPlaceholderText(/3 Queen beds/i)
    fireEvent.change(bedsInput, { target: { value: '2 King beds' } })

    // Check kitchen toggle (+1)
    const kitchenCheckbox = screen.getByRole('checkbox', { name: /Has Kitchen for group cooking/i })
    fireEvent.click(kitchenCheckbox)

    // Fill URL link (+1)
    const linkInput = screen.getByPlaceholderText(/airbnb\.com\/rooms/i)
    fireEvent.change(linkInput, { target: { value: 'https://airbnb.com/rooms/12345' } })

    // Fill description (+1)
    const descTextarea = screen.getByPlaceholderText(/Provide helpful context/i)
    fireEvent.change(descTextarea, { target: { value: 'Great patio with fire pit' } })

    // Badge should show "4 set"
    const badge = container.querySelector('.advanced-count-badge')
    expect(badge).toBeDefined()
    expect(badge.textContent).toBe('4 set')
  })

  it('preserves all advanced values on submit even when drawer is collapsed', () => {
    const handleSubmit = vi.fn()
    const { container } = render(
      <OptionPitchModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={handleSubmit}
        trip={mockTrip}
        roster={mockRoster}
        initialCategory="Accommodation"
      />
    )

    // Fill required Essential View fields
    const titleInput = screen.getByPlaceholderText(/Modern Ocean View Villa/i)
    fireEvent.change(titleInput, { target: { value: 'Luxury Chalet' } })

    // Open drawer to populate advanced fields
    const toggleBtn = screen.getByRole('button', { name: /Advanced Options & Category Details/i })
    fireEvent.click(toggleBtn)

    const bedsInput = screen.getByPlaceholderText(/3 Queen beds/i)
    fireEvent.change(bedsInput, { target: { value: '4 Double beds' } })

    const kitchenCheckbox = screen.getByRole('checkbox', { name: /Has Kitchen for group cooking/i })
    fireEvent.click(kitchenCheckbox)

    const linkInput = screen.getByPlaceholderText(/airbnb\.com\/rooms/i)
    fireEvent.change(linkInput, { target: { value: 'https://chalet.example.com' } })

    // Collapse the drawer
    fireEvent.click(toggleBtn)
    expect(container.querySelector('#advanced-options-drawer').classList.contains('open')).toBe(false)

    // Submit form
    const submitBtn = screen.getByRole('button', { name: 'Pitch Option' })
    fireEvent.click(submitBtn)

    expect(handleSubmit).toHaveBeenCalledTimes(1)
    const submittedPayload = handleSubmit.mock.calls[0][0]
    expect(submittedPayload.name).toBe('Luxury Chalet')
    expect(submittedPayload.metadata.beds_summary).toBe('4 Double beds')
    expect(submittedPayload.metadata.has_kitchen).toBe(true)
    expect(submittedPayload.link).toBe('https://chalet.example.com')
  })

  it('accurately calculates activeAdvancedCount when editing an existing option', () => {
    const existingOption = {
      id: 'opt-existing-1',
      category: 'Transport',
      option_text: 'SUV Rental',
      estimated_cost: 350,
      currency: 'USD',
      cost_type: 'split_total',
      assigned_users: ['user-1', 'user-2'],
      link: 'https://hertz.com/reservation/123',
      description: 'Picked up at airport terminal',
      metadata: {
        transport_mode: 'vehicle_pool',
        seats_capacity: 5,
        estimated_fuel_cost: 60,
        driver_user_id: 'user-1'
      }
    }

    const { container } = render(
      <OptionPitchModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        trip={mockTrip}
        roster={mockRoster}
        editingOption={existingOption}
      />
    )

    // Advanced fields populated:
    // seats_capacity (5) -> +1
    // driver_user_id ('user-1') -> +1
    // estimated_fuel_cost (60) -> +1
    // link -> +1
    // description -> +1
    // Total = 5 set
    const badge = container.querySelector('.advanced-count-badge')
    expect(badge).toBeDefined()
    expect(badge.textContent).toBe('5 set')

    // Modal title indicates edit mode
    expect(screen.getByText('✏️ Edit Option')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDefined()
  })

  it('handles Activities category specialized metadata in the accordion', () => {
    const { container } = render(
      <OptionPitchModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        trip={mockTrip}
        roster={mockRoster}
        initialCategory="Activities"
      />
    )

    const toggleBtn = screen.getByRole('button', { name: /Advanced Options & Category Details/i })
    fireEvent.click(toggleBtn)

    // Fill quota
    const quotaInput = screen.getByPlaceholderText(/10 \(Quota\)/i)
    fireEvent.change(quotaInput, { target: { value: '8' } })

    // Fill duration/difficulty
    const diffInput = screen.getByPlaceholderText(/4h · Moderate hike/i)
    fireEvent.change(diffInput, { target: { value: '3h · Easy stroll' } })

    // Fill required gear
    const gearInput = screen.getByPlaceholderText(/Hiking boots/i)
    fireEvent.change(gearInput, { target: { value: 'Sunscreen, Water bottle' } })

    const badge = container.querySelector('.advanced-count-badge')
    expect(badge).toBeDefined()
    expect(badge.textContent).toBe('3 set')
  })

  it('handles Transport flight/transit mode switching in the accordion', () => {
    const { container } = render(
      <OptionPitchModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        trip={mockTrip}
        roster={mockRoster}
        initialCategory="Transport"
      />
    )

    const toggleBtn = screen.getByRole('button', { name: /Advanced Options & Category Details/i })
    fireEvent.click(toggleBtn)

    // Switch to Flight / Train
    const transitBtn = screen.getByRole('button', { name: /Flight \/ Train/i })
    fireEvent.click(transitBtn)

    // Fill route
    const routeInput = screen.getByPlaceholderText(/YUL → PDL/i)
    fireEvent.change(routeInput, { target: { value: 'AC842 · YVR → LHR' } })

    // Fill times
    const timesInput = screen.getByPlaceholderText(/Dep 08:30/i)
    fireEvent.change(timesInput, { target: { value: 'Dep 18:00 · Arr 11:30' } })

    const badge = container.querySelector('.advanced-count-badge')
    expect(badge).toBeDefined()
    // Mode changed from vehicle_pool to transit (+1), route (+1), times (+1) = 3 set
    expect(badge.textContent).toBe('3 set')
  })
})
