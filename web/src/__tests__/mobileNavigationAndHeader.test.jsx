import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import fs from 'fs'
import path from 'path'
import { TripHeader } from '../components/trip/TripHeader'
import { ThemeProvider } from '../hooks/useTheme'

const mockTrip = {
  id: 'trip-xmas-2026',
  title: 'Christmas & NYE 2026',
  destination: 'Canadian Rockies',
  start_date: '2026-12-24',
  end_date: '2027-01-03',
  base_currency: 'CAD',
  vibe: 'Cozy cabin, ski slopes, hot cocoa and festive memories.',
  is_archived: false
}

const mockActiveUser = {
  id: 'user-organizer-1',
  first_name: 'Alex',
  email: 'alex@example.com'
}

describe('P0 Mobile Bottom Navigation & Compact Sticky Header (Redesign Proposal A)', () => {
  describe('Redesign Proposal A — Compact Mobile Sticky Header', () => {
    it('renders Line 1 elements: back button, trip title, live indicator dot, and right-aligned icon triggers', () => {
      const onOpenEditModal = vi.fn()
      const onToggleActivityDrawer = vi.fn()

      const { container } = render(
        <MemoryRouter>
          <ThemeProvider>
            <TripHeader
              trip={mockTrip}
              activeUser={mockActiveUser}
              isOffline={false}
              unreadCount={3}
              realtimeStatus="connected"
              onRefresh={vi.fn()}
              onOpenEditModal={onOpenEditModal}
              onToggleArchive={vi.fn()}
              onExportICal={vi.fn()}
              onOpenPrintModal={vi.fn()}
              onOpenPollRecapModal={vi.fn()}
              onToggleActivityDrawer={onToggleActivityDrawer}
              onLogout={vi.fn()}
            />
          </ThemeProvider>
        </MemoryRouter>
      )

      // 1. Back button (link to /trips) with desktop Trips label and mobile arrow icon
      const backBtn = container.querySelector('.back-trips-btn')
      expect(backBtn).toBeTruthy()
      expect(backBtn.getAttribute('href')).toBe('/trips')
      expect(backBtn.querySelector('.desktop-btn-label')?.textContent).toBe('Trips')

      // 2. Trip title in Line 1 (single h1 on page)
      const titleEl = container.querySelector('h1.trip-main-title')
      expect(titleEl).toBeTruthy()
      expect(titleEl.textContent).toBe('Christmas & NYE 2026')

      // 3. Compact live indicator dot
      const liveDot = container.querySelector('.realtime-status-dot')
      expect(liveDot).toBeTruthy()
      expect(liveDot.textContent).toBe('🟢')

      // 4. Right-aligned triggers:
      // Share button with toast
      const shareBtn = container.querySelector('.share-invite-btn')
      expect(shareBtn).toBeTruthy()
      expect(shareBtn.textContent).toContain('Share Invite')

      // Feed button with unread count badge
      const feedBtn = container.querySelector('.feed-bell-btn')
      expect(feedBtn).toBeTruthy()
      expect(feedBtn.textContent).toContain('Feed')
      const unreadBadge = container.querySelector('.feed-unread-badge')
      expect(unreadBadge).toBeTruthy()
      expect(unreadBadge.textContent).toBe('3')

      // Theme toggle button
      const themeBtn = screen.getByRole('button', { name: /Switch to light mode/i })
      expect(themeBtn).toBeTruthy()

      // Actions menu trigger with mobile ellipsis and desktop label
      const actionsBtn = container.querySelector('.actions-menu-trigger')
      expect(actionsBtn).toBeTruthy()
      expect(actionsBtn.querySelector('.mobile-btn-label')?.textContent).toBe('⋯')
      expect(actionsBtn.querySelector('.desktop-btn-label')?.textContent).toContain('Actions')
    })

    it('renders Line 2 compact inline metadata (destination · date range · currency)', () => {
      const { container } = render(
        <MemoryRouter>
          <ThemeProvider>
            <TripHeader
              trip={mockTrip}
              activeUser={mockActiveUser}
              realtimeStatus="connected"
            />
          </ThemeProvider>
        </MemoryRouter>
      )

      const mobileMetaLine = container.querySelector('.mobile-meta-line')
      expect(mobileMetaLine).toBeTruthy()
      expect(mobileMetaLine.textContent).toContain('Canadian Rockies')
      expect(mobileMetaLine.textContent).toContain('Dec 24')
      expect(mobileMetaLine.textContent).toContain('Jan 3')
      expect(mobileMetaLine.textContent).toContain('CAD')
      expect(mobileMetaLine.textContent).toContain('·')
    })

    it('toggles Actions menu dropdown when clicking the trigger', () => {
      const onOpenEditModal = vi.fn()
      const { container } = render(
        <MemoryRouter>
          <ThemeProvider>
            <TripHeader
              trip={mockTrip}
              activeUser={mockActiveUser}
              onOpenEditModal={onOpenEditModal}
              onExportICal={vi.fn()}
              onOpenPrintModal={vi.fn()}
              onOpenPollRecapModal={vi.fn()}
              onRefresh={vi.fn()}
              onToggleArchive={vi.fn()}
              onLogout={vi.fn()}
            />
          </ThemeProvider>
        </MemoryRouter>
      )

      const actionsBtn = container.querySelector('.actions-menu-trigger')
      expect(container.querySelector('.actions-dropdown-menu')).toBeNull()

      // Click to open
      fireEvent.click(actionsBtn)
      const menu = container.querySelector('.actions-dropdown-menu')
      expect(menu).toBeTruthy()
      expect(menu.textContent).toContain('Edit Trip')
      expect(menu.textContent).toContain('Export iCal')
      expect(menu.textContent).toContain('Print Itinerary')
      expect(menu.textContent).toContain('Poll Recap')
      expect(menu.textContent).toContain('Refresh Data')
      expect(menu.textContent).toContain('Archive Trip')
      expect(menu.textContent).toContain('Switch Profile / Log Out')

      // Click Edit Trip
      const editItem = screen.getByText('Edit Trip')
      fireEvent.click(editItem)
      expect(onOpenEditModal).toHaveBeenCalledTimes(1)
    })
  })

  describe('CSS Layout & Stylesheet Contract Verification', () => {
    const cssPath = path.resolve(__dirname, '../styles/global.css')
    const cssContent = fs.readFileSync(cssPath, 'utf8')

    it('enforces 100dvh root layout flex column in global.css', () => {
      expect(cssContent).toContain('min-height: 100dvh;')
      expect(cssContent).toMatch(/#root\s*\{[^}]*min-height:\s*100dvh;/)
      expect(cssContent).toMatch(/#root\s*\{[^}]*display:\s*flex;/)
      expect(cssContent).toMatch(/#root\s*\{[^}]*flex-direction:\s*column;/)
    })

    it('pins mobile bottom navigation bar with safe-area insets on screens < 768px', () => {
      expect(cssContent).toContain('position: fixed;')
      expect(cssContent).toContain('z-index: 50;')
      expect(cssContent).toContain('height: calc(64px + env(safe-area-inset-bottom));')
      expect(cssContent).toContain('padding-bottom: env(safe-area-inset-bottom);')
      expect(cssContent).toMatch(/\.workspace-tabs-nav\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*0;[^}]*left:\s*0;[^}]*right:\s*0;[^}]*z-index:\s*50;[^}]*height:\s*calc\(64px\s*\+\s*env\(safe-area-inset-bottom\)\);/s)
    })

    it('adds padding-bottom: 84px to mobile content area to prevent obscuring cards', () => {
      expect(cssContent).toMatch(/\.workspace-content-pane\s*\{[^}]*padding-bottom:\s*84px;/s)
      expect(cssContent).toMatch(/\.trip-details-container\s*\{[^}]*padding:\s*0\s*1rem\s*84px\s*1rem;/s)
    })

    it('configures Redesign Proposal A compact sticky header under 76px vertical height', () => {
      expect(cssContent).toMatch(/\.trip-header-wrapper\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*z-index:\s*40;[^}]*backdrop-filter:\s*blur\(12px\);/s)
      expect(cssContent).toMatch(/\.trip-header-card\s*\{[^}]*max-height:\s*72px;/s)
    })

    it('ensures @keyframes fadeIn clears transform to none to avoid creating containing blocks for fixed elements', () => {
      expect(cssContent).toMatch(/@keyframes\s+fadeIn\s*\{[\s\S]*?to\s*\{[^}]*transform:\s*none;[\s\S]*?\}/)
    })
  })
})
