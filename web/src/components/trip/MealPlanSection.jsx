import React from 'react'
import { MealPlannerMatrix } from './MealPlannerMatrix'

/**
 * MealPlanSection sub-component handling the Food Intendance toolbar
 * (Daily Meal Matrix vs All Food Cards view switcher + Grocery List button)
 * and the interactive MealPlannerMatrix grid.
 */
export function MealPlanSection({
  trip,
  roster = [],
  activeUser,
  foodOptions = [],
  activePoll = null,
  foodViewMode = 'matrix',
  setFoodViewMode,
  uncheckedGroceryCount = 0,
  onOpenGroceryList,
  onOpenPitchModal,
  onVoteToggle,
  onLockToggle,
  onDeleteOption,
  onEditOption,
  onToggleParticipant,
  onSubmitMeal
}) {
  return (
    <div className="meal-plan-section animate-fade-in">
      {/* Food Category Sub-Bar: Matrix vs Cards Toggle + Grocery List Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '1.25rem',
          padding: '0.6rem 0.85rem',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-light)',
          borderRadius: '10px'
        }}
      >
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`filter-pill ${foodViewMode === 'matrix' ? 'active' : ''}`}
            onClick={() => setFoodViewMode('matrix')}
          >
            📅 Daily Meal Matrix (Recommended)
          </button>
          <button
            type="button"
            className={`filter-pill ${foodViewMode === 'cards' ? 'active' : ''}`}
            onClick={() => setFoodViewMode('cards')}
          >
            🃏 All Food Cards
          </button>
        </div>

        <button
          type="button"
          className="btn btn-secondary grocery-btn-accent"
          onClick={onOpenGroceryList}
        >
          <span>🛒 Grocery List</span>
          {uncheckedGroceryCount > 0 && (
            <span className="grocery-cart-badge">{uncheckedGroceryCount}</span>
          )}
        </button>
      </div>

      {foodViewMode === 'matrix' && (
        <MealPlannerMatrix
          trip={trip}
          roster={roster}
          activeUser={activeUser}
          foodOptions={foodOptions}
          activePoll={activePoll}
          onOpenPitchModal={onOpenPitchModal}
          onVoteToggle={onVoteToggle}
          onLockToggle={onLockToggle}
          onDeleteOption={onDeleteOption}
          onEditOption={onEditOption}
          onToggleParticipant={onToggleParticipant}
          onOpenGroceryList={onOpenGroceryList}
          uncheckedGroceryCount={uncheckedGroceryCount}
          onSubmitMeal={onSubmitMeal}
        />
      )}
    </div>
  )
}
