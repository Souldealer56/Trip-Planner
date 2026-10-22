import React, { useMemo } from 'react'
import { getTripDaysList, buildDefaultOptionDates, formatDateRange, formatLocalDateStr } from '../../utils/format'

export function TripDateTimeSelector({
  trip,
  startDate = '',
  endDate = '',
  onChange,
  category = '',
  startLabel = 'Start Date & Time',
  endLabel = 'End Date & Time',
  required = false,
  disabled = false,
  showTripRangeBanner = true
}) {
  const tripStartDate = trip?.start_date || ''
  const tripEndDate = trip?.end_date || ''

  const tripDays = useMemo(
    () => getTripDaysList(tripStartDate, tripEndDate),
    [tripStartDate, tripEndDate]
  )

  const getParts = (dt) => {
    if (!dt) return { date: '', time: '' }
    const str = String(dt)
    const [d, t] = str.split('T')
    return { date: d || '', time: t ? t.slice(0, 5) : '' }
  }

  const startParts = getParts(startDate)
  const endParts = getParts(endDate)

  // Determine if full trip is active
  const isFullTripActive = Boolean(
    tripStartDate &&
    tripEndDate &&
    startParts.date === tripStartDate &&
    endParts.date === tripEndDate
  )

  const timeSlotPresets = [
    { id: 'morning', label: '☀️ Morning', timeLabel: '09:00–12:00', start: '09:00', end: '12:00' },
    { id: 'afternoon', label: '🌤️ Afternoon', timeLabel: '14:00–17:00', start: '14:00', end: '17:00' },
    { id: 'evening', label: '🌙 Evening', timeLabel: '19:30–22:00', start: '19:30', end: '22:00' },
    { id: 'all_day', label: '⏰ All Day', timeLabel: '09:00–21:00', start: '09:00', end: '21:00' }
  ]

  const handleSelectFullTrip = () => {
    if (disabled || !onChange || !tripStartDate || !tripEndDate) return
    const defaults = buildDefaultOptionDates(tripStartDate, tripEndDate, category)
    const newStart = startParts.time ? `${tripStartDate}T${startParts.time}` : defaults.start
    const newEnd = endParts.time ? `${tripEndDate}T${endParts.time}` : defaults.end
    onChange({ startDate: newStart, endDate: newEnd })
  }

  const handleSelectDay = (day) => {
    if (disabled || !onChange) return
    let sTime = startParts.time
    let eTime = endParts.time

    if (!sTime || !eTime) {
      const catLower = (category || '').toLowerCase()
      if (catLower === 'food' || catLower === 'meal' || catLower === 'meals') {
        sTime = '19:30'
        eTime = '21:30'
      } else if (catLower === 'activities' || catLower === 'activity') {
        sTime = '09:00'
        eTime = '12:00'
      } else if (catLower === 'accommodation') {
        sTime = '15:00'
        eTime = '21:00'
      } else {
        sTime = '09:00'
        eTime = '12:00'
      }
    }

    onChange({
      startDate: `${day.dateStr}T${sTime}`,
      endDate: `${day.dateStr}T${eTime}`
    })
  }

  const handleSelectTimePreset = (preset) => {
    if (disabled || !onChange) return
    const baseDate = startParts.date || tripStartDate || formatLocalDateStr(new Date())
    const endDateToUse = endParts.date && startParts.date && endParts.date !== startParts.date
      ? endParts.date
      : baseDate

    onChange({
      startDate: `${baseDate}T${preset.start}`,
      endDate: `${endDateToUse}T${preset.end}`
    })
  }

  const handleManualStart = (val) => {
    if (disabled || !onChange) return
    let normalized = val
    if (val && val.length === 10) {
      normalized = `${val}T09:00`
    }
    onChange({ startDate: normalized, endDate })
  }

  const handleManualEnd = (val) => {
    if (disabled || !onChange) return
    let normalized = val
    if (val && val.length === 10) {
      normalized = `${val}T12:00`
    }
    onChange({ startDate, endDate: normalized })
  }

  // Pre-trip and post-trip indicators
  const isPreTrip = Boolean(tripStartDate && startParts.date && startParts.date < tripStartDate)
  const isPostTrip = Boolean(tripEndDate && endParts.date && endParts.date > tripEndDate)

  return (
    <div className="trip-datetime-selector">
      {/* Trip Range Banner & Context */}
      {showTripRangeBanner && tripStartDate && tripEndDate && (
        <div className="trip-range-banner">
          <div className="trip-range-banner-info">
            <span className="trip-range-banner-icon">📅</span>
            <span className="trip-range-banner-text">
              Trip Window: <strong>{formatDateRange(tripStartDate, tripEndDate)}</strong> ({tripDays.length} {tripDays.length === 1 ? 'day' : 'days'})
            </span>
          </div>

          <div className="trip-range-badges">
            {isPreTrip && (
              <span className="trip-range-pill pre-trip" title="Scheduled before official trip start date">
                ✈️ Outbound / Early
              </span>
            )}
            {isPostTrip && (
              <span className="trip-range-pill post-trip" title="Scheduled after official trip end date">
                🛬 Extended / Return
              </span>
            )}
          </div>
        </div>
      )}

      {/* 1-Click Quick-Select Trip Day Chips */}
      {tripDays.length > 0 && (
        <div className="trip-chips-section">
          <label className="trip-chips-label">
            ⚡ Quick-Select Day
          </label>
          <div className="trip-chips-scroll-row">
            {/* Full Trip Chip */}
            {tripDays.length > 1 && (
              <button
                type="button"
                className={`trip-chip-btn ${isFullTripActive ? 'active' : ''}`}
                onClick={handleSelectFullTrip}
                disabled={disabled}
                title={`Set from ${tripStartDate} to ${tripEndDate}`}
              >
                🗺️ Full Trip
              </button>
            )}

            {/* Individual Day Chips */}
            {tripDays.map((day) => {
              const isDayActive =
                startParts.date === day.dateStr &&
                endParts.date === day.dateStr &&
                !isFullTripActive

              return (
                <button
                  key={day.dayNumber}
                  type="button"
                  className={`trip-chip-btn ${isDayActive ? 'active' : ''}`}
                  onClick={() => handleSelectDay(day)}
                  disabled={disabled}
                  title={`Set to ${day.label}`}
                >
                  {day.chipLabel}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Time Slot Presets */}
      <div className="trip-time-presets-section">
        <label className="trip-chips-label">
          🕒 Common Time Slots
        </label>
        <div className="time-presets-row">
          {timeSlotPresets.map((preset) => {
            const isPresetActive =
              startParts.time === preset.start &&
              endParts.time === preset.end

            return (
              <button
                key={preset.id}
                type="button"
                className={`time-preset-btn ${isPresetActive ? 'active' : ''}`}
                onClick={() => handleSelectTimePreset(preset)}
                disabled={disabled}
                title={`${preset.label} (${preset.timeLabel})`}
              >
                <span>{preset.label}</span>
                <span className="time-preset-hours">{preset.timeLabel}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Manual Datetime Pickers */}
      <div className="datetime-inputs-grid">
        <div className="datetime-input-col">
          <label className="datetime-field-label">
            {startLabel} {required && '*'}
          </label>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => handleManualStart(e.target.value)}
            required={required}
            disabled={disabled}
            className="input-field datetime-input"
          />
        </div>

        <div className="datetime-input-col">
          <label className="datetime-field-label">
            {endLabel} {required && '*'}
          </label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => handleManualEnd(e.target.value)}
            required={required}
            disabled={disabled}
            className="input-field datetime-input"
          />
        </div>
      </div>
    </div>
  )
}

export default TripDateTimeSelector
