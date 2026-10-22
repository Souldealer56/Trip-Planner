import React from 'react'

/**
 * WorkspaceTabsNav sub-component for trip workspace navigation.
 * Sticky segmented pill on desktop, thumb-friendly fixed bottom bar on mobile.
 */
export function WorkspaceTabsNav({
  activeWorkspaceTab,
  onTabChange,
  totalOptionsCount = 0,
  expensesCount = 0,
  rosterCount = 0
}) {
  return (
    <nav className="workspace-tabs-nav" aria-label="Trip Workspace Tabs" role="tablist">
      <button
        id="tab-itinerary"
        role="tab"
        type="button"
        aria-selected={activeWorkspaceTab === 'itinerary'}
        aria-controls="panel-itinerary"
        className={`workspace-tab-btn ${activeWorkspaceTab === 'itinerary' ? 'active' : ''}`}
        onClick={() => onTabChange('itinerary')}
      >
        <span className="workspace-tab-icon">🗺️</span>
        <span className="workspace-tab-label">Itinerary & Options</span>
        <span className="workspace-tab-badge">{totalOptionsCount}</span>
      </button>

      <button
        id="tab-expenses"
        role="tab"
        type="button"
        aria-selected={activeWorkspaceTab === 'expenses'}
        aria-controls="panel-expenses"
        className={`workspace-tab-btn ${activeWorkspaceTab === 'expenses' ? 'active' : ''}`}
        onClick={() => onTabChange('expenses')}
      >
        <span className="workspace-tab-icon">💰</span>
        <span className="workspace-tab-label">Expenses & Budget</span>
        <span className="workspace-tab-badge">{expensesCount}</span>
      </button>

      <button
        id="tab-roster"
        role="tab"
        type="button"
        aria-selected={activeWorkspaceTab === 'roster'}
        aria-controls="panel-roster"
        className={`workspace-tab-btn ${activeWorkspaceTab === 'roster' ? 'active' : ''}`}
        onClick={() => onTabChange('roster')}
      >
        <span className="workspace-tab-icon">👥</span>
        <span className="workspace-tab-label">Crew & RSVPs</span>
        <span className="workspace-tab-badge">{rosterCount}</span>
      </button>
    </nav>
  )
}
