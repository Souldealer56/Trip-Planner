import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, within } from '@testing-library/react'
import React from 'react'
import { AirbnbDateRangePicker } from '../components/common/AirbnbDateRangePicker'

describe('AirbnbDateRangePicker Component (TASK 2)', () => {
  afterEach(cleanup)

  const tripStartDate = '2026-12-24'
  const tripEndDate = '2026-12-28'

  it('renders trigger bar with formatted summary and time inputs', () => {
    const handleChange = vi.fn()

    const { container } = render(
      <AirbnbDateRangePicker
        tripStartDate={tripStartDate}
        tripEndDate={tripEndDate}
        startDate="2026-12-24T15:00"
        endDate="2026-12-28T11:00"
        onChange={handleChange}
      />
    )

    // Trigger bar formatted summary: Dec 24, 2026 → Dec 28, 2026 (4 nights / 5 days)
    expect(container.textContent).toContain('Dec 24, 2026 → Dec 28, 2026')
    expect(container.textContent).toContain('4 nights / 5 days')

    // Start & End Time inputs
    const timeInputs = container.querySelectorAll('input[type="time"]')
    expect(timeInputs.length).toBe(2)
    expect(timeInputs[0].value).toBe('15:00')
    expect(timeInputs[1].value).toBe('11:00')

    // Change start time
    fireEvent.change(timeInputs[0], { target: { value: '16:00' } })
    expect(handleChange).toHaveBeenCalledWith({
      startDate: '2026-12-24',
      endDate: '2026-12-28',
      startTime: '16:00',
      endTime: '11:00'
    })
  })

  it('expands calendar on trigger bar click and highlights official Trip Window', () => {
    const handleChange = vi.fn()

    const { container } = render(
      <AirbnbDateRangePicker
        tripStartDate={tripStartDate}
        tripEndDate={tripEndDate}
        startDate="2026-12-24"
        endDate="2026-12-28"
        onChange={handleChange}
      />
    )

    // Calendar is closed initially
    expect(container.querySelector('.airbnb-calendar-panel')).toBeNull()

    // Click trigger bar to open
    const trigger = container.querySelector('.airbnb-trigger-bar')
    fireEvent.click(trigger)

    expect(container.querySelector('.airbnb-calendar-panel')).not.toBeNull()
    expect(container.textContent).toContain('December 2026')

    // Official trip window indicator
    const tripWindowIndicators = container.querySelectorAll('.airbnb-trip-window-indicator')
    expect(tripWindowIndicators.length).toBeGreaterThanOrEqual(5) // Dec 24, 25, 26, 27, 28
  })

  it('provides ONLY Reset to Full Trip and Single Day preset pills in calendar header', () => {
    const handleChange = vi.fn()

    const { container } = render(
      <AirbnbDateRangePicker
        tripStartDate={tripStartDate}
        tripEndDate={tripEndDate}
        startDate="2026-12-25"
        endDate="2026-12-26"
        onChange={handleChange}
      />
    )

    // Open calendar
    fireEvent.click(container.querySelector('.airbnb-trigger-bar'))

    const presetButtons = container.querySelectorAll('.airbnb-preset-pill')
    expect(presetButtons.length).toBe(2)
    expect(presetButtons[0].textContent).toContain('Reset to Full Trip')
    expect(presetButtons[1].textContent).toContain('Single Day')

    // Test Reset to Full Trip
    fireEvent.click(presetButtons[0])
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: tripStartDate,
        endDate: tripEndDate
      })
    )

    // Test Single Day
    fireEvent.click(presetButtons[1])
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2026-12-25',
        endDate: '2026-12-25'
      })
    )
  })

  it('handles 2-click interactive range selection with hover preview', () => {
    const handleChange = vi.fn()

    const { container } = render(
      <AirbnbDateRangePicker
        tripStartDate={tripStartDate}
        tripEndDate={tripEndDate}
        startDate="2026-12-24"
        endDate="2026-12-28"
        startTime="09:00"
        endTime="18:00"
        onChange={handleChange}
      />
    )

    // Open calendar
    fireEvent.click(container.querySelector('.airbnb-trigger-bar'))

    // Find Dec 25 cell
    const dayCells = Array.from(container.querySelectorAll('.airbnb-day-cell:not(.empty)'))
    const day25 = dayCells.find(el => el.textContent.includes('25'))
    const day27 = dayCells.find(el => el.textContent.includes('27'))

    expect(day25).toBeDefined()
    expect(day27).toBeDefined()

    // Click 1: Select start date Dec 25 -> enters selectingEnd mode
    fireEvent.click(day25)
    expect(handleChange).toHaveBeenCalledWith({
      startDate: '2026-12-25',
      endDate: '2026-12-25',
      startTime: '09:00',
      endTime: '18:00'
    })

    // Hover Dec 27: triggers hover state
    fireEvent.mouseEnter(day27)

    // Click 2: Click Dec 27 -> completes selection
    fireEvent.click(day27)
    expect(handleChange).toHaveBeenCalledWith({
      startDate: '2026-12-25',
      endDate: '2026-12-27',
      startTime: '09:00',
      endTime: '18:00'
    })
  })

  it('updates startDate and remains in selectingEnd mode if Click 2 is before startDate', () => {
    const handleChange = vi.fn()

    const { container } = render(
      <AirbnbDateRangePicker
        tripStartDate={tripStartDate}
        tripEndDate={tripEndDate}
        startDate="2026-12-26"
        endDate="2026-12-28"
        onChange={handleChange}
      />
    )

    fireEvent.click(container.querySelector('.airbnb-trigger-bar'))

    const dayCells = Array.from(container.querySelectorAll('.airbnb-day-cell:not(.empty)'))
    const day26 = dayCells.find(el => el.textContent.includes('26'))
    const day24 = dayCells.find(el => el.textContent.includes('24'))

    // Click 1 on Dec 26
    fireEvent.click(day26)

    // Click 2 on Dec 24 (earlier than Dec 26)
    fireEvent.click(day24)

    // Should update startDate to Dec 24
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        startDate: '2026-12-24',
        endDate: '2026-12-24'
      })
    )
  })

  it('navigates through months using header arrows', () => {
    const { container } = render(
      <AirbnbDateRangePicker
        tripStartDate="2026-12-24"
        tripEndDate="2026-12-28"
        startDate="2026-12-24"
        endDate="2026-12-28"
        onChange={vi.fn()}
      />
    )

    fireEvent.click(container.querySelector('.airbnb-trigger-bar'))
    expect(container.textContent).toContain('December 2026')

    const view = within(container)

    // Click next month
    const nextBtn = view.getByTitle('Next month')
    fireEvent.click(nextBtn)
    expect(container.textContent).toContain('January 2027')

    // Click prev month twice
    const prevBtn = view.getByTitle('Previous month')
    fireEvent.click(prevBtn)
    expect(container.textContent).toContain('December 2026')
    fireEvent.click(prevBtn)
    expect(container.textContent).toContain('November 2026')
  })
})
