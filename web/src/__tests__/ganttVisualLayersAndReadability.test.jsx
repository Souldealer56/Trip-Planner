import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { GanttTimeline } from '../components/GanttTimeline'
import { isLogisticsCoverage, isShortDurationOption } from '../utils/schedule'

describe('Gantt Timeline Visual Layers, Readability & Zoom Switcher', () => {
  afterEach(cleanup)

  const sampleTrip = {
    id: 'trip-layers-test',
    title: 'Alpine Expedition',
    start_date: '2026-08-01',
    end_date: '2026-08-07'
  }

  const sampleRoster = [
    { user_id: 'u1', role: 'organizer', status: 'Committed', users: { first_name: 'Elena', username: 'elena' } },
    { user_id: 'u2', role: 'participant', status: 'Committed', users: { first_name: 'Marcus', username: 'marcus' } }
  ]

  const sampleOptions = [
    // Multi-day accommodation
    {
      id: 'opt-chalet',
      category: 'Accommodation',
      option_text: 'Matterhorn Alpine Chalet',
      start_date: '2026-08-01T15:00',
      end_date: '2026-08-05T10:00',
      is_locked: true,
      estimated_cost: 800,
      currency: 'CHF',
      assigned_users: ['u1', 'u2']
    },
    // Multi-day shared vehicle rental
    {
      id: 'opt-van',
      category: 'Transport',
      option_text: '9-Seater AWD Minivan',
      start_date: '2026-08-01T12:00',
      end_date: '2026-08-07T14:00',
      is_locked: true,
      estimated_cost: 650,
      currency: 'CHF',
      metadata: {
        transport_mode: 'vehicle_pool',
        seats_capacity: 9
      },
      assigned_users: ['u1']
    },
    // Single-day / short activity (3 hours)
    {
      id: 'opt-hike',
      category: 'Activities',
      option_text: 'Glacier Trail Trek',
      start_date: '2026-08-02T09:00',
      end_date: '2026-08-02T12:00',
      is_locked: false,
      estimated_cost: 45,
      currency: 'CHF',
      assigned_users: ['u1', 'u2']
    },
    // Single-day dinner
    {
      id: 'opt-fondue',
      category: 'Food',
      option_text: 'Swiss Fondue Night',
      start_date: '2026-08-03T19:00',
      end_date: '2026-08-03T21:30',
      is_locked: false,
      estimated_cost: 70,
      currency: 'CHF',
      metadata: {
        meal_mode: 'restaurant'
      }
    },
    // Point-to-point transit leg (2 hours)
    {
      id: 'opt-train',
      category: 'Transport',
      option_text: 'Glacier Express Scenic Train',
      start_date: '2026-08-05T11:00',
      end_date: '2026-08-05T13:30',
      is_locked: false,
      estimated_cost: 95,
      currency: 'CHF',
      metadata: {
        transport_mode: 'transit'
      }
    }
  ]

  it('domain helpers correctly classify logistics coverage and short duration options', () => {
    const chalet = sampleOptions[0]
    const van = sampleOptions[1]
    const hike = sampleOptions[2]
    const fondue = sampleOptions[3]
    const train = sampleOptions[4]

    // isLogisticsCoverage
    expect(isLogisticsCoverage(chalet)).toBe(true)
    expect(isLogisticsCoverage(van)).toBe(true)
    expect(isLogisticsCoverage(hike)).toBe(false)
    expect(isLogisticsCoverage(fondue)).toBe(false)
    expect(isLogisticsCoverage(train)).toBe(false)

    // isShortDurationOption
    expect(isShortDurationOption(chalet)).toBe(false) // 4 nights (91 hours)
    expect(isShortDurationOption(van)).toBe(false) // 6 days (146 hours)
    expect(isShortDurationOption(hike)).toBe(true) // 3 hours
    expect(isShortDurationOption(fondue)).toBe(true) // 2.5 hours
    expect(isShortDurationOption(train)).toBe(true) // 2.5 hours
  })

  it('separates Multi-Day Logistics & Coverage from Scheduled Activities & Transit into distinct visual layers', () => {
    render(
      <GanttTimeline
        trip={sampleTrip}
        options={sampleOptions}
        roster={sampleRoster}
      />
    )

    // Layer 1 header exists with sticky label
    expect(screen.getByText(/Multi-Day Logistics & Coverage/i)).toBeTruthy()
    expect(screen.getByText(/Stays & Shared Vehicles/i)).toBeTruthy()

    // Layer 2 header exists with sticky label
    expect(screen.getByText(/Scheduled Activities, Meals & Transit/i)).toBeTruthy()

    // Both categories and options render cleanly
    expect(screen.getAllByText('Matterhorn Alpine Chalet').length).toBeGreaterThan(0)
    expect(screen.getAllByText('9-Seater AWD Minivan').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Glacier Trail Trek').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Swiss Fondue Night').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Glacier Express Scenic Train').length).toBeGreaterThan(0)
  })

  it('renders Timeline Zoom & View Mode Switcher and toggles between Fit, 3-Day Window, and Hourly Details', () => {
    render(
      <GanttTimeline
        trip={sampleTrip}
        options={sampleOptions}
        roster={sampleRoster}
      />
    )

    const fitBtn = screen.getByRole('button', { name: /Compact Fit/i })
    const scrollBtn = screen.getByRole('button', { name: /Day-by-Day Scroll/i })
    const windowBtn = screen.getByRole('button', { name: /3-Day Window/i })
    const hourlyBtn = screen.getByRole('button', { name: /Day Details/i })

    expect(fitBtn).toBeTruthy()
    expect(scrollBtn).toBeTruthy()
    expect(windowBtn).toBeTruthy()
    expect(hourlyBtn).toBeTruthy()

    // Click 3-Day Window
    fireEvent.click(windowBtn)
    expect(windowBtn.classList.contains('active')).toBe(true)

    // Click Day Details (Hourly)
    fireEvent.click(hourlyBtn)
    expect(hourlyBtn.classList.contains('active')).toBe(true)

    // Hourly guides (00:00, 06:00, etc.) appear in day headers
    expect(screen.getAllByText('00:00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('12:00').length).toBeGreaterThan(0)
  })

  it('renders high-contrast external floating pill labels for short single-day activities', () => {
    render(
      <GanttTimeline
        trip={sampleTrip}
        options={sampleOptions}
        roster={sampleRoster}
      />
    )

    // Single-day activities like Glacier Trail Trek and Swiss Fondue Night render .gantt-pill-label
    const pillLabels = document.querySelectorAll('.gantt-pill-label')
    expect(pillLabels.length).toBeGreaterThan(0)

    const pillTexts = Array.from(pillLabels).map(el => el.textContent)
    expect(pillTexts.some(t => t.includes('Glacier Trail Trek'))).toBe(true)
    expect(pillTexts.some(t => t.includes('Swiss Fondue Night'))).toBe(true)
  })

  it('opens Option Inspector Card when an option bar is clicked with detailed metadata', () => {
    render(
      <GanttTimeline
        trip={sampleTrip}
        options={sampleOptions}
        roster={sampleRoster}
      />
    )

    // Initially, inspector card is not open
    expect(document.querySelector('.gantt-inspector-card')).toBeNull()

    // Click on the hike bar
    const hikeBar = document.querySelector('[title="Glacier Trail Trek"]')
    expect(hikeBar).not.toBeNull()
    fireEvent.click(hikeBar)

    // Inspector card opens
    const inspectorCard = document.querySelector('.gantt-inspector-card')
    expect(inspectorCard).not.toBeNull()
    expect(inspectorCard.textContent).toContain('Glacier Trail Trek')
    expect(inspectorCard.textContent).toContain('45 CHF')
    expect(inspectorCard.textContent).toContain('Elena')

    // Close button dismisses inspector card
    const closeBtn = inspectorCard.querySelector('button[title="Close inspection"]')
    expect(closeBtn).not.toBeNull()
    fireEvent.click(closeBtn)
    expect(document.querySelector('.gantt-inspector-card')).toBeNull()
  })
})
