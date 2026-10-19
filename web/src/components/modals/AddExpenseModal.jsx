import React, { useState, useEffect } from 'react'
import { calculateOptionCostBreakdown } from '../../utils/currency'

export function AddExpenseModal({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  error = '',
  roster = [],
  baseCurrency = 'USD',
  activeUserId = '',
  optionToPreFill = null
}) {
  const [expenseDesc, setExpenseDesc] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCurrency, setExpenseCurrency] = useState(baseCurrency)
  const [expenseCategory, setExpenseCategory] = useState('Other')
  const [expensePaidBy, setExpensePaidBy] = useState('')
  const [expenseSplitEqually, setExpenseSplitEqually] = useState(true)
  const [expenseSplitUsers, setExpenseSplitUsers] = useState({})
  const [expenseSplitMode, setExpenseSplitMode] = useState('equal') // 'equal' | 'custom_amount' | 'custom_percent'
  const [customSplitAmounts, setCustomSplitAmounts] = useState({})
  const [customSplitPercents, setCustomSplitPercents] = useState({})
  const [validationError, setValidationError] = useState('')

  const committedRoster = roster.filter(m => m.status === 'Committed')

  const CATEGORIES = ['Accommodation', 'Transport', 'Activities', 'Food', 'Other']

  useEffect(() => {
    if (isOpen) {
      setValidationError('')
      if (optionToPreFill) {
        const optionTitle = optionToPreFill.option_text || optionToPreFill.text || 'Locked Option'
        let rawCat = (optionToPreFill.category || optionToPreFill.poll_category || '').toLowerCase().trim()
        if (rawCat === 'flights' || rawCat === 'flight') {
          rawCat = 'transport'
        }
        if (!rawCat || rawCat === 'other') {
          const titleLower = optionTitle.toLowerCase()
          if (/hotel|h[oô]tel|h[eé]bergement|stay|airbnb|lodging|auberge|villa|resort|machiya|ryokan|cabin|cottage|chalet|apartment|suite/i.test(titleLower)) {
            rawCat = 'accommodation'
          } else if (/transport|flight|vol|avion|airline|airfare|plane|car|voiture|uber|taxi|train|toll|gas|fuel|bus|ferry|boat/i.test(titleLower)) {
            rawCat = 'transport'
          } else if (/activity|activit[eé]|tour|ticket|billet|visite|excursion|mus[eé]e|museum/i.test(titleLower)) {
            rawCat = 'activities'
          } else if (/dinner|d[iî]ner|lunch|d[eé]jeuner|food|resto|restaurant|courses|repas|meal|breakfast/i.test(titleLower)) {
            rawCat = 'food'
          } else {
            rawCat = 'accommodation'
          }
        }
        const optCat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase()
        const validCat = CATEGORIES.includes(optCat) ? optCat : 'Accommodation'
        setExpenseCategory(validCat)
        setExpenseDesc(`[${validCat.toUpperCase()}] ${optionTitle}`.trim())
        const optCurrency = optionToPreFill.currency || baseCurrency || 'USD'
        setExpenseCurrency(optCurrency)
        setExpensePaidBy(optionToPreFill.added_by || activeUserId || (committedRoster[0]?.user_id || ''))

        const breakdown = calculateOptionCostBreakdown(optionToPreFill, committedRoster, null, optCurrency)
        setExpenseAmount(breakdown.totalGroupCost ? String(breakdown.totalGroupCost) : '')

        if (breakdown.costType === 'per_night') {
          setExpenseSplitMode('custom_amount')
          setExpenseSplitEqually(false)
          const customAmounts = {}
          const initialSplits = {}
          committedRoster.forEach(m => {
            const isAssigned = breakdown.effectiveParticipantIds.includes(String(m.user_id))
            initialSplits[m.user_id] = isAssigned
            if (isAssigned) {
              customAmounts[m.user_id] = String(breakdown.participantSharesMap.get(String(m.user_id)) || 0)
            }
          })
          setCustomSplitAmounts(customAmounts)
          setCustomSplitPercents({})
          setExpenseSplitUsers(initialSplits)
        } else {
          setExpenseSplitMode('equal')
          const initialSplits = {}
          committedRoster.forEach(m => {
            initialSplits[m.user_id] = breakdown.effectiveParticipantIds.includes(String(m.user_id))
          })
          setExpenseSplitUsers(initialSplits)
          setExpenseSplitEqually(breakdown.effectiveParticipantIds.length === committedRoster.length)
          setCustomSplitAmounts({})
          setCustomSplitPercents({})
        }
      } else {
        setExpenseDesc('')
        setExpenseAmount('')
        setExpenseCurrency(baseCurrency || 'USD')
        setExpenseCategory('Other')
        setExpensePaidBy(activeUserId || (committedRoster[0]?.user_id || ''))
        setExpenseSplitEqually(true)
        setExpenseSplitMode('equal')
        setCustomSplitAmounts({})
        setCustomSplitPercents({})

        const initialSplits = {}
        committedRoster.forEach(m => {
          initialSplits[m.user_id] = true
        })
        setExpenseSplitUsers(initialSplits)
      }
    }
  }, [isOpen, optionToPreFill, baseCurrency, activeUserId, roster])

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    setValidationError('')

    if (!expenseDesc.trim()) {
      setValidationError('Description is required.')
      return
    }
    const totalCost = parseFloat(expenseAmount)
    if (!expenseAmount || isNaN(expenseAmount) || totalCost <= 0) {
      setValidationError('Amount must be greater than 0.')
      return
    }
    if (!expensePaidBy) {
      setValidationError('Please select a payer.')
      return
    }

    let splitsList = []

    if (expenseSplitMode === 'equal') {
      if (expenseSplitEqually) {
        splitsList = committedRoster.map(m => m.user_id)
      } else {
        splitsList = Object.keys(expenseSplitUsers).filter(uid => expenseSplitUsers[uid])
      }
      if (splitsList.length === 0) {
        setValidationError('Please select at least one split participant.')
        return
      }
    } else if (expenseSplitMode === 'custom_amount') {
      const activeIds = Object.keys(expenseSplitUsers).filter(uid => expenseSplitUsers[uid])
      if (activeIds.length === 0) {
        setValidationError('Please select at least one split participant.')
        return
      }
      let currentSum = 0
      splitsList = activeIds.map(uid => {
        const val = parseFloat(customSplitAmounts[uid] || 0)
        currentSum += val
        return { user_id: uid, amount: val }
      })

      if (Math.abs(currentSum - totalCost) > 0.05) {
        setValidationError(`Custom split amounts ($${currentSum.toFixed(2)}) must equal total expense ($${totalCost.toFixed(2)}).`)
        return
      }
    } else if (expenseSplitMode === 'custom_percent') {
      const activeIds = Object.keys(expenseSplitUsers).filter(uid => expenseSplitUsers[uid])
      if (activeIds.length === 0) {
        setValidationError('Please select at least one split participant.')
        return
      }
      let currentSum = 0
      splitsList = activeIds.map(uid => {
        const val = parseFloat(customSplitPercents[uid] || 0)
        currentSum += val
        return { user_id: uid, percent: val }
      })

      if (Math.abs(currentSum - 100) > 0.1) {
        setValidationError(`Custom split percentages (${currentSum.toFixed(1)}%) must equal 100%.`)
        return
      }
    }

    onSubmit({
      description: expenseDesc.trim(),
      amount: totalCost,
      currency: expenseCurrency,
      category: expenseCategory.toLowerCase(),
      paidBy: expensePaidBy,
      splitUsers: splitsList,
      optionId: optionToPreFill?.id || null
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card animate-fade-in" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', textAlign: 'center' }}>
            Add Expense
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            Log a new shared trip expense and specify who splits it.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Description *</label>
              <input
                type="text"
                placeholder="e.g. Group Dinner, Gas, Tickets"
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
                required
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  required
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '110px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Currency</label>
                <select
                  value={expenseCurrency}
                  onChange={(e) => setExpenseCurrency(e.target.value)}
                  className="input-field select-field"
                  style={{ padding: '0.75rem var(--spacing-md) 0.75rem 0.5rem' }}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CHF">CHF (Fr)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Category *</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="input-field select-field"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Paid By *</label>
                <select
                  value={expensePaidBy}
                  onChange={(e) => setExpensePaidBy(e.target.value)}
                  className="input-field select-field"
                >
                  {committedRoster.map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.users?.first_name || m.username || String(m.user_id).slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Cost Partitioning Mode</label>
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.03)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <button
                  type="button"
                  onClick={() => { setExpenseSplitMode('equal'); setExpenseSplitEqually(true) }}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: 'none',
                    background: expenseSplitMode === 'equal' ? 'var(--primary)' : 'transparent',
                    color: expenseSplitMode === 'equal' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Equal Split
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseSplitMode('custom_amount')}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: 'none',
                    background: expenseSplitMode === 'custom_amount' ? 'var(--primary)' : 'transparent',
                    color: expenseSplitMode === 'custom_amount' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Custom ($)
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseSplitMode('custom_percent')}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: 'none',
                    background: expenseSplitMode === 'custom_percent' ? 'var(--primary)' : 'transparent',
                    color: expenseSplitMode === 'custom_percent' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Percentages (%)
                </button>
              </div>
            </div>

            {expenseSplitMode === 'equal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                <div className="toggle-container" onClick={() => setExpenseSplitEqually(!expenseSplitEqually)}>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={expenseSplitEqually}
                      onChange={() => {}}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span style={{ fontSize: '0.95rem', fontWeight: '600' }}>Split equally among all members</span>
                </div>
                {!expenseSplitEqually && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} className="animate-fade-in">
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Select Split Participants</label>
                    <div className="checkbox-list">
                      {committedRoster.map(m => {
                        const isChecked = !!expenseSplitUsers[m.user_id]
                        return (
                          <label key={m.user_id} className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setExpenseSplitUsers({
                                  ...expenseSplitUsers,
                                  [m.user_id]: e.target.checked
                                })
                              }}
                            />
                            <span>{m.users?.first_name || m.username}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {expenseSplitMode === 'custom_amount' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} className="animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Custom Amount ($) per Participant</label>
                  {(() => {
                    const total = parseFloat(expenseAmount || 0)
                    const currentSum = Object.keys(expenseSplitUsers)
                      .filter(uid => expenseSplitUsers[uid])
                      .reduce((sum, uid) => sum + parseFloat(customSplitAmounts[uid] || 0), 0)
                    const isValid = Math.abs(currentSum - total) <= 0.05
                    return (
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: isValid ? '#34d399' : '#f87171' }}>
                        Allocated: ${currentSum.toFixed(2)} / ${total.toFixed(2)}
                      </span>
                    )
                  })()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {committedRoster.map(m => {
                    const isChecked = !!expenseSplitUsers[m.user_id]
                    return (
                      <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                        <label className="checkbox-item" style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setExpenseSplitUsers({ ...expenseSplitUsers, [m.user_id]: e.target.checked })
                            }}
                          />
                          <span>{m.users?.first_name || m.username}</span>
                        </label>
                        {isChecked && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>$</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={customSplitAmounts[m.user_id] || ''}
                              onChange={(e) => setCustomSplitAmounts({ ...customSplitAmounts, [m.user_id]: e.target.value })}
                              style={{ width: '80px', padding: '2px 6px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)' }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {expenseSplitMode === 'custom_percent' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} className="animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Custom Percentage (%) per Participant</label>
                  {(() => {
                    const currentSum = Object.keys(expenseSplitUsers)
                      .filter(uid => expenseSplitUsers[uid])
                      .reduce((sum, uid) => sum + parseFloat(customSplitPercents[uid] || 0), 0)
                    const isValid = Math.abs(currentSum - 100) <= 0.1
                    return (
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: isValid ? '#34d399' : '#f87171' }}>
                        Allocated: {currentSum.toFixed(1)}% / 100%
                      </span>
                    )
                  })()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {committedRoster.map(m => {
                    const isChecked = !!expenseSplitUsers[m.user_id]
                    return (
                      <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                        <label className="checkbox-item" style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setExpenseSplitUsers({ ...expenseSplitUsers, [m.user_id]: e.target.checked })
                            }}
                          />
                          <span>{m.users?.first_name || m.username}</span>
                        </label>
                        {isChecked && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              step="0.1"
                              placeholder="0"
                              value={customSplitPercents[m.user_id] || ''}
                              onChange={(e) => setCustomSplitPercents({ ...customSplitPercents, [m.user_id]: e.target.value })}
                              style={{ width: '70px', padding: '2px 6px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)' }}
                            />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>%</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {(validationError || error) && (
              <div style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem', textAlign: 'center' }}>
                ⚠️ {validationError || error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="submit" disabled={loading} className="btn" style={{ flex: 1 }}>
                {loading ? 'Saving...' : 'Add Expense'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
