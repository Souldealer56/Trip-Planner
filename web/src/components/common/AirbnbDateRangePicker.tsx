import React, { useState, useMemo } from 'react'
import { parseLocalDate, formatLocalDateStr } from '../../utils/format'

export interface DateRangeChangePayload {
  startDate: string
  endDate: string
  startTime: string
  endTime: string
}

export interface AirbnbDateRangePickerProps {
  tripStartDate?: string
  tripEndDate?: string
  startDate?: string
  endDate?: string
  startTime?: string
  endTime?: string
  onChange: (range: DateRangeChangePayload) => void
  disabled?: boolean
  className?: string
  label?: string
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return ''
  const parsed = parseLocalDate(dateStr)
  if (!parsed) return dateStr
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function getRangeSummary(startDateStr: string, endDateStr: string): string {
  if (!startDateStr && !endDateStr) return 'Select trip dates'
  if (!startDateStr) return `Until ${formatDateDisplay(endDateStr)}`
  if (!endDateStr || startDateStr === endDateStr) {
    return `${formatDateDisplay(startDateStr)} (1 day)`
  }

  const s = parseLocalDate(startDateStr)
  const e = parseLocalDate(endDateStr)
  if (!s || !e) return `${startDateStr} → ${endDateStr}`

  const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) {
    return `${formatDateDisplay(startDateStr)} (1 day)`
  }

  const nights = diffDays
  const days = diffDays + 1
  return `${formatDateDisplay(startDateStr)} → ${formatDateDisplay(endDateStr)} (${nights} ${nights === 1 ? 'night' : 'nights'} / ${days} days)`
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function AirbnbDateRangePicker({
  tripStartDate = '',
  tripEndDate = '',
  startDate = '',
  endDate = '',
  startTime = '',
  endTime = '',
  onChange,
  disabled = false,
  className = '',
  label = 'Dates & Times'
}: AirbnbDateRangePickerProps) {
  // Normalize incoming dates (extract date YYYY-MM-DD vs time HH:mm if passed as ISO string)
  const normalizedStartDate = useMemo(() => {
    if (!startDate) return tripStartDate || ''
    return startDate.includes('T') ? startDate.split('T')[0] : startDate
  }, [startDate, tripStartDate])

  const normalizedEndDate = useMemo(() => {
    if (!endDate) return tripEndDate || normalizedStartDate || ''
    return endDate.includes('T') ? endDate.split('T')[0] : endDate
  }, [endDate, tripEndDate, normalizedStartDate])

  const normalizedStartTime = useMemo(() => {
    if (startTime) return startTime.slice(0, 5)
    if (startDate && startDate.includes('T')) {
      const t = startDate.split('T')[1]
      return t ? t.slice(0, 5) : '09:00'
    }
    return '09:00'
  }, [startTime, startDate])

  const normalizedEndTime = useMemo(() => {
    if (endTime) return endTime.slice(0, 5)
    if (endDate && endDate.includes('T')) {
      const t = endDate.split('T')[1]
      return t ? t.slice(0, 5) : '18:00'
    }
    return '18:00'
  }, [endTime, endDate])

  const [isOpen, setIsOpen] = useState(false)
  const [selectingEnd, setSelectingEnd] = useState(false)
  const [pendingStartDate, setPendingStartDate] = useState<string | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)

  // Current calendar month view
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const initDate = parseLocalDate(normalizedStartDate) || parseLocalDate(tripStartDate) || new Date()
    return new Date(initDate.getFullYear(), initDate.getMonth(), 1)
  })

  const year = currentMonthDate.getFullYear()
  const month = currentMonthDate.getMonth()

  // Calendar grid calculations
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const daysArray = useMemo(() => {
    const list: Array<number | null> = []
    for (let i = 0; i < firstDayOfWeek; i++) {
      list.push(null)
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push(d)
    }
    return list
  }, [firstDayOfWeek, daysInMonth])

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const activeStart = pendingStartDate || normalizedStartDate

  const handleDateClick = (dayNumber: number) => {
    if (disabled) return
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`

    if (!selectingEnd) {
      // Click 1: Sets startDate and enters selectingEnd mode
      setSelectingEnd(true)
      setPendingStartDate(dateStr)
      setHoverDate(null)
      onChange({
        startDate: dateStr,
        endDate: dateStr,
        startTime: normalizedStartTime,
        endTime: normalizedEndTime
      })
    } else {
      // Click 2
      if (dateStr >= activeStart) {
        // Sets endDate and completes selection
        setSelectingEnd(false)
        setPendingStartDate(null)
        setHoverDate(null)
        onChange({
          startDate: activeStart,
          endDate: dateStr,
          startTime: normalizedStartTime,
          endTime: normalizedEndTime
        })
      } else {
        // Clicked date is earlier than startDate: update startDate and stay in selectingEnd mode
        setSelectingEnd(true)
        setPendingStartDate(dateStr)
        setHoverDate(null)
        onChange({
          startDate: dateStr,
          endDate: dateStr,
          startTime: normalizedStartTime,
          endTime: normalizedEndTime
        })
      }
    }
  }

  const handleDayMouseEnter = (dayNumber: number) => {
    if (!selectingEnd) return
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
    if (dateStr >= activeStart) {
      setHoverDate(dateStr)
    } else {
      setHoverDate(null)
    }
  }

  const handleResetToFullTrip = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!tripStartDate || !tripEndDate) return
    setSelectingEnd(false)
    setPendingStartDate(null)
    setHoverDate(null)
    onChange({
      startDate: tripStartDate,
      endDate: tripEndDate,
      startTime: normalizedStartTime,
      endTime: normalizedEndTime
    })
    const tStart = parseLocalDate(tripStartDate)
    if (tStart) {
      setCurrentMonthDate(new Date(tStart.getFullYear(), tStart.getMonth(), 1))
    }
  }

  const handleSetSingleDay = (e: React.MouseEvent) => {
    e.stopPropagation()
    const target = activeStart || tripStartDate || formatLocalDateStr(new Date())
    setSelectingEnd(false)
    setPendingStartDate(null)
    setHoverDate(null)
    onChange({
      startDate: target,
      endDate: target,
      startTime: normalizedStartTime,
      endTime: normalizedEndTime
    })
  }

  const handleStartTimeChange = (newTime: string) => {
    onChange({
      startDate: activeStart,
      endDate: normalizedEndDate,
      startTime: newTime,
      endTime: normalizedEndTime
    })
  }

  const handleEndTimeChange = (newTime: string) => {
    onChange({
      startDate: activeStart,
      endDate: normalizedEndDate,
      startTime: normalizedStartTime,
      endTime: newTime
    })
  }

  // Range preview boundaries
  const effectiveEnd = selectingEnd && hoverDate && hoverDate >= activeStart
    ? hoverDate
    : (selectingEnd && pendingStartDate ? pendingStartDate : normalizedEndDate)

  return (
    <div className={`airbnb-date-range-picker-container ${className}`}>
      {label && (
        <label className="airbnb-picker-label">
          <span>{label}</span>
        </label>
      )}

      {/* Main Bar: Compact Range Trigger Bar & Start/End Time Inputs */}
      <div className="airbnb-picker-control-bar">
        {/* Trigger Bar */}
        <button
          type="button"
          className={`airbnb-trigger-bar ${isOpen ? 'active' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          title="Click to toggle Airbnb range calendar"
        >
          <div className="airbnb-trigger-content">
            <span className="airbnb-trigger-icon">📅</span>
            <span className="airbnb-trigger-text">
              {getRangeSummary(normalizedStartDate, normalizedEndDate)}
            </span>
          </div>
          <span className="airbnb-trigger-chevron">
            {isOpen ? '▲' : '▼'}
          </span>
        </button>

        {/* Compact Start & End Time Dropdowns/Inputs */}
        <div className="airbnb-time-group">
          <div className="airbnb-time-input-box" title="Start Time">
            <span className="airbnb-time-prefix">Start</span>
            <input
              type="time"
              className="airbnb-time-field"
              value={normalizedStartTime}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              disabled={disabled}
            />
          </div>
          <span className="airbnb-time-separator">→</span>
          <div className="airbnb-time-input-box" title="End Time">
            <span className="airbnb-time-prefix">End</span>
            <input
              type="time"
              className="airbnb-time-field"
              value={normalizedEndTime}
              onChange={(e) => handleEndTimeChange(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Interactive Range Calendar Popover / Inline Expand */}
      {isOpen && (
        <div className="airbnb-calendar-panel animate-fade-in">
          {/* Header with Navigation & Quick Preset Pills */}
          <div className="airbnb-calendar-header">
            <div className="airbnb-month-nav">
              <button
                type="button"
                className="airbnb-nav-btn"
                onClick={handlePrevMonth}
                title="Previous month"
              >
                ‹
              </button>
              <span className="airbnb-month-title">
                {MONTH_NAMES[month]} {year}
              </span>
              <button
                type="button"
                className="airbnb-nav-btn"
                onClick={handleNextMonth}
                title="Next month"
              >
                ›
              </button>
            </div>

            {/* Quick Preset Pills ONLY for Reset to Full Trip and Single Day */}
            <div className="airbnb-presets-row">
              {tripStartDate && tripEndDate && (
                <button
                  type="button"
                  className="airbnb-preset-pill"
                  onClick={handleResetToFullTrip}
                  title={`Reset dates to full trip: ${tripStartDate} to ${tripEndDate}`}
                >
                  🗺️ Reset to Full Trip
                </button>
              )}
              <button
                type="button"
                className="airbnb-preset-pill"
                onClick={handleSetSingleDay}
                title="Collapse selection to a single 1-day event"
              >
                ⚡ Single Day
              </button>
            </div>
          </div>

          {/* Weekday Names */}
          <div className="airbnb-weekdays-row">
            {WEEKDAY_NAMES.map((w) => (
              <div key={w} className="airbnb-weekday-cell">
                {w}
              </div>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div
            className="airbnb-days-grid"
            onMouseLeave={() => selectingEnd && setHoverDate(null)}
          >
            {daysArray.map((dayNum, idx) => {
              if (dayNum === null) {
                return <div key={`empty-${idx}`} className="airbnb-day-cell empty" />
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
              const isStart = dateStr === activeStart
              const isEnd = dateStr === effectiveEnd
              const isInRange = Boolean(
                activeStart &&
                effectiveEnd &&
                dateStr > activeStart &&
                dateStr < effectiveEnd
              )
              const isTripWindow = Boolean(
                tripStartDate &&
                tripEndDate &&
                dateStr >= tripStartDate &&
                dateStr <= tripEndDate
              )
              const isSingle = isStart && isEnd

              let cellClasses = 'airbnb-day-cell'
              if (isSingle) cellClasses += ' is-single-day'
              else if (isStart) cellClasses += ' is-range-start'
              else if (isEnd) cellClasses += ' is-range-end'
              else if (isInRange) cellClasses += ' is-in-range'

              if (isTripWindow) cellClasses += ' in-trip-window'

              return (
                <div
                  key={dateStr}
                  className={cellClasses}
                  onClick={() => handleDateClick(dayNum)}
                  onMouseEnter={() => handleDayMouseEnter(dayNum)}
                  title={
                    isTripWindow
                      ? `${dateStr} (Official Trip Window)`
                      : dateStr
                  }
                >
                  <span className="airbnb-day-number">{dayNum}</span>
                  {/* Subtle dot indicator for official trip window */}
                  {isTripWindow && (
                    <span className="airbnb-trip-window-indicator" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Helper Footer */}
          <div className="airbnb-calendar-footer">
            <span className="airbnb-calendar-hint">
              {selectingEnd
                ? 'Select end date (hover to preview range)'
                : 'Click any day to begin new date range'}
            </span>
            <button
              type="button"
              className="btn btn-secondary airbnb-done-btn"
              onClick={() => setIsOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AirbnbDateRangePicker
