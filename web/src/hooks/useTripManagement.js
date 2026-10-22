import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  updateTrip,
  deleteTrip,
  archiveTrip,
  unarchiveTrip
} from '../services/trips'
import { fetchAllTripOptions, checkOptionDateConflict } from '../services/options'
import { fetchActivityLogs } from '../services/activity'
import { generateICalContent, downloadICalFile } from '../utils/ical'

export function useTripManagement({
  tripId,
  trip,
  refreshTrip,
  allTripOptions = [],
  options = [],
  navigate
}) {
  // Activity drawer & notifications state
  const [showActivityDrawer, setShowActivityDrawer] = useState(false)
  const [activityLogs, setActivityLogs] = useState([])
  const [lastReadTimestamp, setLastReadTimestamp] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(`trip_planner_last_read_log_${tripId}`) || null
    }
    return null
  })

  const loadActivityLogs = useCallback(async () => {
    if (!tripId) return
    try {
      const logs = await fetchActivityLogs(tripId)
      setActivityLogs(logs)
    } catch (err) {
      console.error('Failed to load activity logs:', err)
    }
  }, [tripId])

  useEffect(() => {
    loadActivityLogs()
  }, [loadActivityLogs])

  const unreadCount = useMemo(() => {
    if (!lastReadTimestamp) return activityLogs.length
    const lastReadDate = new Date(lastReadTimestamp)
    return activityLogs.filter((log) => new Date(log.created_at) > lastReadDate).length
  }, [activityLogs, lastReadTimestamp])

  const handleToggleDrawer = () => {
    const nextShow = !showActivityDrawer
    setShowActivityDrawer(nextShow)
    if (nextShow && typeof localStorage !== 'undefined') {
      const nowIso = new Date().toISOString()
      setLastReadTimestamp(nowIso)
      localStorage.setItem(`trip_planner_last_read_log_${tripId}`, nowIso)
    }
  }

  // Edit trip modal state
  const [showEditTripModal, setShowEditTripModal] = useState(false)
  const [editingTripSnapshot, setEditingTripSnapshot] = useState(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete confirm state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Schedule reconciliation modal state
  const [showReconcileModal, setShowReconcileModal] = useState(false)
  const [conflictingOptions, setConflictingOptions] = useState([])

  // Printable itinerary & recap modal state
  const [showPollRecapModal, setShowPollRecapModal] = useState(false)
  const [showPrintableItineraryModal, setShowPrintableItineraryModal] = useState(false)

  const handleEditTripSubmit = async ({ title, destination, vibe, startDate, endDate, baseCurrency: newBaseCurrency }) => {
    setEditLoading(true)
    setEditError('')
    try {
      const datesChanged = startDate !== trip?.start_date || endDate !== trip?.end_date
      await updateTrip(tripId, {
        title,
        destination,
        vibe,
        start_date: startDate,
        end_date: endDate,
        base_currency: newBaseCurrency
      })
      setShowEditTripModal(false)
      setEditingTripSnapshot(null)
      refreshTrip()
      loadActivityLogs()

      if (datesChanged && startDate && endDate) {
        const allOptions = await fetchAllTripOptions(tripId)
        const conflicts = allOptions.filter((opt) => checkOptionDateConflict(opt, startDate, endDate))
        if (conflicts.length > 0) {
          setConflictingOptions(conflicts)
          setShowReconcileModal(true)
        }
      }
    } catch (err) {
      console.error('Failed to update trip:', err)
      setEditError(err.message || 'Failed to update trip.')
    } finally {
      setEditLoading(false)
    }
  }

  const handleToggleArchive = async () => {
    if (!trip) return
    try {
      if (trip.is_archived) await unarchiveTrip(tripId)
      else await archiveTrip(tripId)
      refreshTrip()
      setShowEditTripModal(false)
      setEditingTripSnapshot(null)
    } catch (err) {
      console.error('Failed to toggle archive state:', err)
      alert('Failed to update archive status: ' + err.message)
    }
  }

  const handleConfirmDelete = async () => {
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await deleteTrip(tripId)
      if (navigate) navigate('/trips')
    } catch (err) {
      console.error('Failed to delete trip:', err)
      setDeleteError(err.message || 'Failed to delete trip.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleExportICal = () => {
    const opts = allTripOptions.length > 0 ? allTripOptions : options
    const icalStr = generateICalContent(trip, opts)
    downloadICalFile(`${(trip?.title || 'Trip').replace(/\s+/g, '_')}_itinerary.ics`, icalStr)
  }

  return {
    showActivityDrawer,
    setShowActivityDrawer,
    activityLogs,
    lastReadTimestamp,
    unreadCount,
    loadActivityLogs,
    handleToggleDrawer,
    showEditTripModal,
    setShowEditTripModal,
    editingTripSnapshot,
    setEditingTripSnapshot,
    editLoading,
    editError,
    showDeleteConfirm,
    setShowDeleteConfirm,
    deleteLoading,
    deleteError,
    showReconcileModal,
    setShowReconcileModal,
    conflictingOptions,
    setConflictingOptions,
    showPollRecapModal,
    setShowPollRecapModal,
    showPrintableItineraryModal,
    setShowPrintableItineraryModal,
    handleEditTripSubmit,
    handleToggleArchive,
    handleConfirmDelete,
    handleExportICal
  }
}
