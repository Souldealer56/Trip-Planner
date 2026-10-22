import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  fetchOptions,
  fetchAllTripOptions,
  fetchActivePoll,
  pitchOption,
  updateOption,
  toggleVote,
  lockOption,
  deleteOption,
  updateOptionDates,
  toggleOptionParticipant
} from '../services/options'
import { saveTripOfflineSnapshot, loadTripOfflineSnapshot } from '../utils/offlineCache'

const CATEGORIES = ['Accommodation', 'Transport', 'Activities', 'Food', 'Other']

/**
 * Custom hook managing trip poll options, active polls, category filtering,
 * optimistic multi-user voting, date synchronization, and pitching.
 */
export function useTripOptionsManager({
  tripId,
  trip,
  activeUser,
  onActivityLogged,
  initialOptions
}) {
  const [activeTab, setActiveTab] = useState('Accommodation')
  const [options, setOptions] = useState(() => {
    if (initialOptions) return initialOptions
    const cached = loadTripOfflineSnapshot(tripId)
    return cached?.options || []
  })
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [activePoll, setActivePoll] = useState(null)
  const [viewMode, setViewMode] = useState('grid')
  const [allTripOptions, setAllTripOptions] = useState([])
  const [allActivePollsMap, setAllActivePollsMap] = useState({})
  const [voteError, setVoteError] = useState('')

  // Pitch / Edit Option Modal State
  const [showPitchModal, setShowPitchModal] = useState(false)
  const [pitchInitialCategory, setPitchInitialCategory] = useState('Accommodation')
  const [pitchInitialDates, setPitchInitialDates] = useState({ start: '', end: '' })
  const [pitchLoading, setPitchLoading] = useState(false)
  const [pitchError, setPitchError] = useState('')
  const [editingOption, setEditingOption] = useState(null)

  const loadOptionsAndPoll = useCallback(async (silent = false) => {
    if (!tripId) return
    if (!silent) setOptionsLoading(true)
    try {
      const [opts, allOpts] = await Promise.all([
        fetchOptions(tripId, activeTab),
        fetchAllTripOptions(tripId)
      ])
      const filteredFromAll = (allOpts || []).filter(
        (o) => o.category?.trim().toLowerCase() === activeTab.trim().toLowerCase()
      )
      const unifiedCategoryOpts = filteredFromAll.length > 0 ? filteredFromAll : (opts || [])
      setOptions(unifiedCategoryOpts)
      if (allOpts) setAllTripOptions(allOpts)

      const poll = await fetchActivePoll(tripId, activeTab)
      setActivePoll(poll)
      if (poll) {
        setAllActivePollsMap((prev) => ({ ...(prev || {}), [activeTab.toLowerCase()]: poll }))
      }
      saveTripOfflineSnapshot(tripId, { options: unifiedCategoryOpts })
    } catch (err) {
      console.warn('Failed to load options/poll, falling back to cache:', err)
      const cached = loadTripOfflineSnapshot(tripId)
      if (cached?.options) setOptions(cached.options)
    } finally {
      if (!silent) setOptionsLoading(false)
    }
  }, [tripId, activeTab])

  const loadGanttData = useCallback(async () => {
    if (!tripId) return
    try {
      const allOpts = await fetchAllTripOptions(tripId)
      setAllTripOptions(allOpts || [])
      const filteredForActiveTab = (allOpts || []).filter(
        (o) => o.category?.trim().toLowerCase() === activeTab.trim().toLowerCase()
      )
      if (filteredForActiveTab.length > 0) {
        setOptions(filteredForActiveTab)
      }
      const map = {}
      for (const cat of CATEGORIES) {
        const poll = await fetchActivePoll(tripId, cat)
        if (poll) map[cat.toLowerCase()] = poll
      }
      setAllActivePollsMap((prev) => ({ ...(prev || {}), ...map }))
    } catch (err) {
      console.warn('Failed to load Gantt data:', err)
    }
  }, [tripId, activeTab])

  // Single source of truth for active category options
  const categoryOptions = useMemo(() => {
    if (allTripOptions && allTripOptions.length > 0) {
      const filtered = allTripOptions.filter(
        (opt) => opt.category?.trim().toLowerCase() === activeTab.trim().toLowerCase()
      )
      if (filtered.length > 0 || !options || options.length === 0) {
        return filtered
      }
    }
    return options || []
  }, [allTripOptions, activeTab, options])

  useEffect(() => {
    if (activeUser && tripId) {
      loadOptionsAndPoll()
      loadGanttData()
    }
  }, [activeUser, tripId, activeTab, loadOptionsAndPoll, loadGanttData])

  useEffect(() => {
    if (viewMode === 'gantt') {
      loadGanttData()
    }
  }, [viewMode, loadGanttData])

  const handleVoteToggle = async (optionId, hasVoted, optionCategory) => {
    if (!activeUser || !activeUser.id) {
      setVoteError('Please sign in or join the crew to vote on options.')
      return
    }
    setVoteError('')
    const targetCategory = (optionCategory || activeTab || 'Accommodation').toLowerCase()
    const optIdStr = String(optionId)
    const userKey = String(activeUser.id)

    const prevActivePoll = activePoll ? JSON.parse(JSON.stringify(activePoll)) : null
    const prevPollsMap = allActivePollsMap ? JSON.parse(JSON.stringify(allActivePollsMap)) : {}

    const currentPoll = (allActivePollsMap && allActivePollsMap[targetCategory]) || (targetCategory === activeTab.toLowerCase() ? activePoll : null) || {
      trip_id: tripId,
      category: targetCategory,
      voter_selections: {},
      votes_by_option: {}
    }

    const newSelections = { ...(currentPoll.voter_selections || {}) }
    let currentUserVotes = Array.isArray(newSelections[userKey]) ? [...newSelections[userKey]] : []

    if (!hasVoted) {
      if (!currentUserVotes.some((v) => String(v) === optIdStr)) {
        currentUserVotes.push(optIdStr)
      }
      newSelections[userKey] = currentUserVotes
    } else {
      currentUserVotes = currentUserVotes.filter((v) => String(v) !== optIdStr)
      if (currentUserVotes.length > 0) {
        newSelections[userKey] = currentUserVotes
      } else {
        delete newSelections[userKey]
      }
    }

    const newVotesByOpt = {}
    Object.entries(newSelections).forEach(([key, opts]) => {
      if (!key.startsWith('_') && Array.isArray(opts)) {
        opts.forEach((vId) => {
          const vIdStr = String(vId)
          newVotesByOpt[vIdStr] = (newVotesByOpt[vIdStr] || 0) + 1
        })
      }
    })

    const optimisticPoll = {
      ...currentPoll,
      voter_selections: newSelections,
      votes_by_option: newVotesByOpt
    }

    if (targetCategory === activeTab.toLowerCase()) {
      setActivePoll(optimisticPoll)
    }
    setAllActivePollsMap((prev) => ({
      ...(prev || {}),
      [targetCategory]: optimisticPoll
    }))

    try {
      const updatedPoll = await toggleVote(tripId, targetCategory, optionId, activeUser.id, !hasVoted)
      if (targetCategory === activeTab.toLowerCase()) {
        setActivePoll(updatedPoll)
      }
      setAllActivePollsMap((prev) => ({
        ...(prev || {}),
        [targetCategory]: updatedPoll
      }))
      loadOptionsAndPoll(true).catch((err) => console.warn('Background sync failed:', err))
      onActivityLogged?.()
    } catch (err) {
      console.error('Failed to toggle vote:', err)
      if (prevActivePoll && targetCategory === activeTab.toLowerCase()) {
        setActivePoll(prevActivePoll)
      }
      setAllActivePollsMap(prevPollsMap)
      setVoteError(err.message || 'Failed to submit vote. Please try again.')
    }
  }

  const handleLockToggle = async (optionId) => {
    if (!activeUser || !tripId) return
    try {
      const updatedPoll = await lockOption(tripId, activeTab, optionId, activeUser.id)
      setActivePoll(updatedPoll)
      await Promise.all([loadOptionsAndPoll(true), loadGanttData()])
      onActivityLogged?.()
    } catch (err) {
      console.error('Failed to toggle lock option:', err)
    }
  }

  const handleDeleteOption = async (optionOrId) => {
    const optObj = typeof optionOrId === 'object' && optionOrId !== null
      ? optionOrId
      : (allTripOptions.find((o) => String(o.id) === String(optionOrId)) || options.find((o) => String(o.id) === String(optionOrId)) || { id: optionOrId, category: activeTab })
    const optId = optObj.id
    const optCategory = optObj.category || activeTab

    const prevAllTripOptions = allTripOptions
    const prevOptions = options
    const prevActivePoll = activePoll
    const prevPollsMap = allActivePollsMap

    setAllTripOptions((prev) => prev.filter((o) => String(o.id) !== String(optId)))
    setOptions((prev) => prev.filter((o) => String(o.id) !== String(optId)))

    const optIdStr = String(optId)
    const catKey = String(optCategory || '').trim().toLowerCase()
    const targetPoll = allActivePollsMap[catKey] || (activeTab.toLowerCase() === catKey ? activePoll : null)

    if (targetPoll) {
      const selections = { ...(targetPoll.voter_selections || {}) }
      Object.keys(selections).forEach((key) => {
        if (!key.startsWith('_') && Array.isArray(selections[key])) {
          const filtered = selections[key].filter((item) => String(item) !== optIdStr)
          if (filtered.length > 0) selections[key] = filtered
          else delete selections[key]
        }
      })
      if (selections._locked_option_id && String(selections._locked_option_id) === optIdStr) {
        delete selections._locked_option_id
      }
      if (Array.isArray(selections._locked_option_ids)) {
        selections._locked_option_ids = selections._locked_option_ids.filter((item) => String(item) !== optIdStr)
      }
      const newVotesByOpt = {}
      Object.entries(selections).forEach(([key, opts]) => {
        if (!key.startsWith('_') && Array.isArray(opts)) {
          opts.forEach((item) => {
            const idS = String(item)
            newVotesByOpt[idS] = (newVotesByOpt[idS] || 0) + 1
          })
        }
      })
      const optimisticPoll = {
        ...targetPoll,
        voter_selections: selections,
        votes_by_option: newVotesByOpt,
        locked_option_id: selections._locked_option_id || null,
        locked_option_ids: selections._locked_option_ids || []
      }
      if (catKey === activeTab.toLowerCase()) {
        setActivePoll(optimisticPoll)
      }
      setAllActivePollsMap((prev) => ({ ...(prev || {}), [catKey]: optimisticPoll }))
    }

    try {
      await deleteOption(tripId, optId, optCategory, activeUser?.id)
      await Promise.all([loadOptionsAndPoll(true), loadGanttData()])
      onActivityLogged?.()
    } catch (err) {
      console.error('Failed to delete option:', err)
      setAllTripOptions(prevAllTripOptions)
      setOptions(prevOptions)
      setAllActivePollsMap(prevPollsMap)
      if (prevActivePoll) setActivePoll(prevActivePoll)
      setVoteError(err.message || 'Failed to delete option. Please try again.')
    }
  }

  const handleUpdateOptionDates = async (optionId, startDate, endDate) => {
    try {
      await updateOptionDates(optionId, startDate, endDate, tripId, activeUser?.id)
      await Promise.all([loadOptionsAndPoll(true), loadGanttData()])
      onActivityLogged?.()
    } catch (err) {
      console.error('Failed to update option dates:', err)
      alert('Failed to update option dates: ' + (err.message || err))
    }
  }

  const handleToggleOptionParticipant = async (optionId, currentAssignedUsers, fallbackAllUserIds = []) => {
    if (!activeUser) return
    try {
      await toggleOptionParticipant(optionId, activeUser.id, currentAssignedUsers, fallbackAllUserIds)
      await Promise.all([loadOptionsAndPoll(true), loadGanttData()])
      onActivityLogged?.()
    } catch (err) {
      console.error('Failed to toggle option participant:', err)
    }
  }

  const handleOpenEditOptionModal = (option) => {
    if (!option) return
    setEditingOption(option)
    setPitchInitialCategory(option.category || activeTab || 'Accommodation')
    setPitchInitialDates({
      start: option.start_date || '',
      end: option.end_date || ''
    })
    setPitchError('')
    setShowPitchModal(true)
  }

  const handlePitchSubmit = async ({ id: optionId, category, name, cost, currency, link, description, startDate, endDate, costType, assignedUsers, metadata }) => {
    setPitchLoading(true)
    setPitchError('')
    try {
      const targetOptionId = optionId || editingOption?.id
      if (targetOptionId) {
        await updateOption(
          targetOptionId,
          {
            category,
            name,
            cost,
            currency,
            link,
            description,
            startDate,
            endDate,
            costType: costType || 'split_total',
            assignedUsers,
            metadata
          },
          tripId,
          activeUser?.id
        )
      } else {
        await pitchOption({
          tripId,
          category,
          name,
          estimatedCost: cost,
          currency,
          link,
          description,
          addedByUserId: activeUser?.id,
          startDate,
          endDate,
          costType: costType || 'split_total',
          assignedUsers,
          metadata
        })
      }
      setShowPitchModal(false)
      setEditingOption(null)
      if (activeTab !== category) {
        setActiveTab(category)
      }
      await Promise.all([loadOptionsAndPoll(true), loadGanttData()])
      onActivityLogged?.()
    } catch (err) {
      console.error('Failed to pitch or update option:', err)
      setPitchError(err.message || 'Failed to save option.')
    } finally {
      setPitchLoading(false)
    }
  }

  return {
    categories: CATEGORIES,
    activeTab,
    setActiveTab,
    options,
    optionsLoading,
    activePoll,
    viewMode,
    setViewMode,
    allTripOptions,
    allActivePollsMap,
    categoryOptions,
    voteError,
    setVoteError,
    loadOptionsAndPoll,
    loadGanttData,

    // Modal state & actions
    showPitchModal,
    setShowPitchModal,
    pitchInitialCategory,
    setPitchInitialCategory,
    pitchInitialDates,
    setPitchInitialDates,
    pitchLoading,
    pitchError,
    editingOption,
    setEditingOption,

    // Action handlers
    handleVoteToggle,
    handleLockToggle,
    handleDeleteOption,
    handleUpdateOptionDates,
    handleToggleOptionParticipant,
    handleOpenEditOptionModal,
    handlePitchSubmit
  }
}
