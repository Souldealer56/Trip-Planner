import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { GanttTimeline } from '../components/GanttTimeline'

describe('Gantt Timeline Redesign Proposal C', () => {
  afterEach(cleanup)
  const sampleTrip = {
    id: 'trip-proposal-c',
    title: 'Rocky Mountain Roadtrip',
    start_date: '2026-07-01',
    end_date: '2026-07-07'
  }

  const sampleOptions = [
    {
      id: 'opt-northwind',
      category: 'Accommodation',
      option_text: 'Northwind hotel',
      start_date: '2026-07-01T16:00',
      end_date: '2026-07-03T11:00',
      is_locked: true,
      votes_count: 4
    },
    {
      id: 'opt-harvey',
      category: 'Accommodation',
      option_text: 'Harvey heights',
      start_date: '2026-07-03T16:00',
      end_date: '2026-07-06T11:00',
      is_locked: false,
      votes_count: 2
    },
    {
      id: 'opt-hiking',
      category: 'Activities',
      option_text: 'Glacier Lake Hike',
      start_date: '2026-07-02T09:00',
      end_date: '2026-07-02T14:00',
      is_locked: false,
      votes_count: 3
    }
  ]

  const roster = [
    { user_id: 'u1', role: 'organizer', status: 'Committed', users: { full_name: 'Alex Traveler' } }
  ]

  it('renders a compact horizontal status bar with condensed metrics and single warning icon', () => {
    render(
      <GanttTimeline
        trip={sampleTrip}
        options={sampleOptions}
        roster={roster}
      />
    )

    // Condense coverage metrics format: 🛏️ X/Y Nights, 🍴 X/Y Meals, Conflict indicator
    expect(screen.getAllByText(/Nights/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Meals/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/No Time Conflicts/i)).toBeTruthy()

    // Alert pill should not have duplicate ⚠️
    const alertPills = document.querySelectorAll('.gantt-alert-pill')
    if (alertPills.length > 0) {
      const alertText = alertPills[0].textContent
      // Count occurrences of ⚠️ in textContent
      const warningEmojiMatches = alertText.match(/⚠️/g) || []
      expect(warningEmojiMatches.length).toBe(1)
    }

    // High contrast pitch CTA with white SVG + icon
    const pitchBtn = screen.getByRole('button', { name: /Pitch for Day/i })
    expect(pitchBtn).toBeTruthy()
    const svgIcon = pitchBtn.querySelector('svg')
    expect(svgIcon).toBeTruthy()
    expect(svgIcon.getAttribute('stroke')).toBe('#ffffff')
  })

  it('renders compact toggleable legend popover inline with density switcher', () => {
    render(
      <GanttTimeline
        trip={sampleTrip}
        options={sampleOptions}
        roster={roster}
      />
    )

    // Check legend toggle button exists
    const legendBtn = screen.getByRole('button', { name: /Legend/i })
    expect(legendBtn).toBeTruthy()
    expect(legendBtn.getAttribute('aria-expanded')).toBe('false')

    // Popover is collapsed by default (saving vertical overhead on mobile)
    expect(document.querySelector('.gantt-legend-popover')).toBeNull()

    // Clicking legend button opens popover
    fireEvent.click(legendBtn)
    expect(legendBtn.getAttribute('aria-expanded')).toBe('true')
    const popover = document.querySelector('.gantt-legend-popover')
    expect(popover).not.toBeNull()

    // Popover contains category entries and status badges
    expect(screen.getAllByText('Transport').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Activities').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Locked/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Overlap/i)).toBeTruthy()

    // Clicking again closes the popover
    fireEvent.click(legendBtn)
    expect(document.querySelector('.gantt-legend-popover')).toBeNull()

    // Density switcher is present inline
    expect(screen.getByRole('button', { name: /Compact Fit/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Day-by-Day Scroll/i })).toBeTruthy()
  })

  it('renders responsive category labels so Accommodation never truncates on mobile or desktop', () => {
    render(
      <GanttTimeline
        trip={sampleTrip}
        options={sampleOptions}
        roster={roster}
      />
    )

    // Full name is available for desktop
    const fullNames = document.querySelectorAll('.gantt-cat-name-full')
    expect(Array.from(fullNames).some(el => el.textContent === 'Accommodation')).toBe(true)

    // Short concise name ('Stays') is available for mobile
    const shortNames = document.querySelectorAll('.gantt-cat-name-short')
    expect(Array.from(shortNames).some(el => el.textContent === 'Stays')).toBe(true)
  })

  it('renders readable option event bar titles with ellipsis and native tooltip title support', () => {
    render(
      <GanttTimeline
        trip={sampleTrip}
        options={sampleOptions}
        roster={roster}
      />
    )

    // Check Northwind hotel and Harvey heights are present in the DOM
    const northwindMatches = screen.getAllByText('Northwind hotel')
    expect(northwindMatches.length).toBeGreaterThan(0)

    const harveyMatches = screen.getAllByText('Harvey heights')
    expect(harveyMatches.length).toBeGreaterThan(0)

    // Verify option bar has native tooltip title
    const northwindBar = document.querySelector('[title="Northwind hotel"]')
    expect(northwindBar).not.toBeNull()
    expect(northwindBar.getAttribute('title')).toBe('Northwind hotel')
  })

  it('renders empty categories bar outside scroll container with responsive wrap', () => {
    render(
      <GanttTimeline
        trip={sampleTrip}
        options={sampleOptions}
        roster={roster}
      />
    )

    const emptyBar = document.querySelector('.gantt-empty-categories-bar')
    expect(emptyBar).not.toBeNull()
    expect(emptyBar.textContent).toContain('Empty categories:')

    // Ensure it is not inside .gantt-scroll-container
    const scrollContainer = document.querySelector('.gantt-scroll-container')
    expect(scrollContainer.contains(emptyBar)).toBe(false)
  })
})
