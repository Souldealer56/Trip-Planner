import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider, useTheme } from '../hooks/useTheme'
import { TripHeader } from '../components/trip/TripHeader'

function ThemeTestComponent() {
  const { theme, toggleTheme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
    </div>
  )
}

describe('Theme System & useTheme Hook', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.body.removeAttribute('data-theme')
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('initializes to dark theme by default when no localStorage is present', () => {
    render(
      <ThemeProvider>
        <ThemeTestComponent />
      </ThemeProvider>
    )

    expect(screen.getByTestId('current-theme').textContent).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('trip_planner_theme')).toBe('dark')
  })

  it('initializes to light theme when localStorage has trip_planner_theme=light', () => {
    localStorage.setItem('trip_planner_theme', 'light')

    render(
      <ThemeProvider>
        <ThemeTestComponent />
      </ThemeProvider>
    )

    expect(screen.getByTestId('current-theme').textContent).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('toggles between dark and light themes immediately without reload', () => {
    render(
      <ThemeProvider>
        <ThemeTestComponent />
      </ThemeProvider>
    )

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // Toggle to light
    fireEvent.click(screen.getByRole('button', { name: /Toggle/i }))
    expect(screen.getByTestId('current-theme').textContent).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('trip_planner_theme')).toBe('light')

    // Toggle back to dark
    fireEvent.click(screen.getByRole('button', { name: /Toggle/i }))
    expect(screen.getByTestId('current-theme').textContent).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('trip_planner_theme')).toBe('dark')
  })

  it('persists theme in localStorage when setTheme is called', () => {
    render(
      <ThemeProvider>
        <ThemeTestComponent />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Set Light/i }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('trip_planner_theme')).toBe('light')
  })
})

describe('TripHeader Theme Toggle Button', () => {
  const dummyTrip = {
    id: 'trip-1',
    title: 'Banff National Park',
    destination: 'Banff, AB',
    start_date: '2026-07-12',
    end_date: '2026-07-18',
    base_currency: 'CAD',
    vibe: 'Alpine lakes and rugged peaks'
  }

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders accessible theme toggle button in TripHeader and toggles theme on click', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <TripHeader trip={dummyTrip} activeUser={{ id: 'user-1' }} />
        </ThemeProvider>
      </MemoryRouter>
    )

    // Button should be in top-right action bar with accessible label
    const toggleBtn = screen.getByRole('button', { name: /Switch to light mode/i })
    expect(toggleBtn).toBeTruthy()
    expect(toggleBtn.getAttribute('title')).toBe('Switch to light mode')

    // Verify touch target dimensions style
    expect(toggleBtn.style.minWidth).toBe('40px')
    expect(toggleBtn.style.minHeight).toBe('40px')

    // Click toggle to switch to light theme
    fireEvent.click(toggleBtn)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('trip_planner_theme')).toBe('light')

    // Accessible label should now prompt to switch to dark mode
    expect(toggleBtn.getAttribute('aria-label')).toBe('Switch to dark mode')
  })
})
