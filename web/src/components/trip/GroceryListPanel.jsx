import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  fetchGroceryItems,
  addGroceryItem,
  toggleGroceryItemChecked,
  deleteGroceryItem,
  syncGroceriesFromLockedMeals,
  groupGroceriesByAisle,
  GROCERY_AISLES
} from '../../services/groceries'

export function GroceryListPanel({
  tripId,
  trip,
  roster = [],
  activeUser,
  foodOptions = [],
  onClose,
  onLogExpense
}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  // Quick Add state
  const [newItemName, setNewItemName] = useState('')
  const [newItemQty, setNewItemQty] = useState('')
  const [newItemAisle, setNewItemAisle] = useState('produce')
  const [adding, setAdding] = useState(false)

  // Checkout Modal state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [receiptAmount, setReceiptAmount] = useState('')
  const [receiptCurrency, setReceiptCurrency] = useState(trip?.base_currency || 'USD')
  const [paidByUserId, setPaidByUserId] = useState(activeUser?.id || '')
  const [checkoutDesc, setCheckoutDesc] = useState('')
  const [loggingExpense, setLoggingExpense] = useState(false)
  const [checkoutSuccess, setCheckoutSuccess] = useState('')

  const committedMembers = useMemo(() => roster.filter((m) => m.status === 'Committed'), [roster])

  const loadItems = useCallback(async () => {
    if (!tripId) return
    setLoading(true)
    try {
      const data = await fetchGroceryItems(tripId)
      setItems(data || [])
    } catch (err) {
      console.error('Failed to load groceries:', err)
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  // Stats calculation
  const totalItems = items.length
  const checkedItems = items.filter((i) => i.is_checked).length
  const percentComplete = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0

  // Aisle groups
  const aisleGroups = useMemo(() => groupGroceriesByAisle(items), [items])

  const handleToggleChecked = async (item) => {
    const nextState = !item.is_checked
    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_checked: nextState } : i))
    )
    await toggleGroceryItemChecked(item.id, nextState, tripId)
  }

  const handleDeleteItem = async (itemId) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId))
    await deleteGroceryItem(itemId, tripId)
  }

  const handleQuickAdd = async (e) => {
    e.preventDefault()
    if (!newItemName.trim()) return

    setAdding(true)
    try {
      const added = await addGroceryItem(tripId, {
        name: newItemName.trim(),
        quantity: newItemQty.trim(),
        aisle: newItemAisle,
        added_by: activeUser?.id
      })
      if (added) {
        setItems((prev) => [...prev, added])
        setNewItemName('')
        setNewItemQty('')
      }
    } catch (err) {
      console.error('Failed to add grocery item:', err)
    } finally {
      setAdding(false)
    }
  }

  const handleSyncFromMenus = async () => {
    setSyncing(true)
    setSyncMessage('')
    try {
      const lockedFood = foodOptions.filter((opt) => opt.is_locked)
      const { addedCount } = await syncGroceriesFromLockedMeals(tripId, lockedFood, items)
      await loadItems()
      if (addedCount > 0) {
        setSyncMessage(`✓ Added ${addedCount} missing ingredients from locked menus!`)
      } else {
        setSyncMessage('All ingredients from locked menus are already in your list!')
      }
      setTimeout(() => setSyncMessage(''), 4000)
    } catch (err) {
      console.error('Failed to sync ingredients:', err)
      setSyncMessage('Failed to sync ingredients from menus.')
    } finally {
      setSyncing(false)
    }
  }

  // Pre-fill checkout description when opening modal
  const handleOpenCheckout = () => {
    const desc = `Supermarket Groceries (${checkedItems || totalItems} items)`
    setCheckoutDesc(desc)
    setReceiptCurrency(trip?.base_currency || 'USD')
    setPaidByUserId(activeUser?.id || committedMembers[0]?.user_id || committedMembers[0]?.id || '')
    setShowCheckoutModal(true)
    setCheckoutSuccess('')
  }

  const handleConfirmCheckout = async (e) => {
    e.preventDefault()
    const amountNum = parseFloat(receiptAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid receipt amount.')
      return
    }

    setLoggingExpense(true)
    try {
      // Find all diners across locked home-cooked meals, or default to all committed members
      const lockedFood = foodOptions.filter((opt) => opt.is_locked)
      const dinerIdSet = new Set()

      for (const opt of lockedFood) {
        if (Array.isArray(opt.assigned_users) && opt.assigned_users.length > 0) {
          opt.assigned_users.forEach((id) => dinerIdSet.add(String(id)))
        }
      }

      // If no explicit diners, split evenly across all committed members
      let splitUserIds = Array.from(dinerIdSet)
      if (splitUserIds.length === 0) {
        splitUserIds = committedMembers.map((m) => String(m.user_id || m.id))
      }
      if (splitUserIds.length === 0 && activeUser) {
        splitUserIds = [String(activeUser.id)]
      }

      const perPersonShare = amountNum / Math.max(1, splitUserIds.length)
      const splitDetails = {}
      splitUserIds.forEach((uId) => {
        splitDetails[uId] = Math.round(perPersonShare * 100) / 100
      })

      if (onLogExpense) {
        await onLogExpense({
          trip_id: tripId,
          description: checkoutDesc.trim() || 'Supermarket Groceries',
          amount: amountNum,
          currency: receiptCurrency,
          paid_by: paidByUserId,
          category: 'food',
          split_mode: 'equal',
          split_details: splitDetails
        })
      }

      setCheckoutSuccess(`✓ Expense of ${amountNum} ${receiptCurrency} successfully logged in Ledger!`)
      setTimeout(() => {
        setShowCheckoutModal(false)
        setCheckoutSuccess('')
        if (onClose) onClose()
      }, 1500)
    } catch (err) {
      console.error('Failed to log grocery expense:', err)
      alert('Failed to log expense: ' + (err.message || err))
    } finally {
      setLoggingExpense(false)
    }
  }

  return (
    <div className="grocery-list-panel-overlay" onClick={onClose}>
      <div className="grocery-list-panel-content glass-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="grocery-panel-header">
          <div className="grocery-header-title-box">
            <span className="grocery-cart-icon">🛒</span>
            <div>
              <h3 className="grocery-title">Smart Grocery List</h3>
              <p className="grocery-subtitle">
                Aisle-by-aisle mobile supermarket intendance
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary sync-menus-btn"
              onClick={handleSyncFromMenus}
              disabled={syncing}
              title="Pull ingredients from all locked meals"
            >
              {syncing ? '🔄 Syncing...' : '🔄 Sync from Menus'}
            </button>
            <button type="button" className="grocery-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className="grocery-sync-banner animate-fade-in">
            {syncMessage}
          </div>
        )}

        {/* Progress Bar */}
        <div className="grocery-progress-box">
          <div className="grocery-progress-labels">
            <span>
              <strong>{checkedItems}</strong> of <strong>{totalItems}</strong> items in cart
            </span>
            <span>{percentComplete}% checked</span>
          </div>
          <div className="grocery-progress-track">
            <div
              className="grocery-progress-fill"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>

        {/* Quick Add Bar */}
        <form onSubmit={handleQuickAdd} className="grocery-quick-add-form">
          <input
            type="text"
            className="input-field grocery-add-name"
            placeholder="+ Add item (e.g. Olive oil, Coffee, Apples)"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            required
          />
          <input
            type="text"
            className="input-field grocery-add-qty"
            placeholder="Qty (e.g. 2 bottles)"
            value={newItemQty}
            onChange={(e) => setNewItemQty(e.target.value)}
          />
          <select
            className="select-field grocery-add-aisle"
            value={newItemAisle}
            onChange={(e) => setNewItemAisle(e.target.value)}
          >
            {GROCERY_AISLES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-add-grocery" disabled={adding}>
            {adding ? '...' : '+ Add'}
          </button>
        </form>

        {/* Aisle Grouped Grocery List */}
        <div className="grocery-items-scroll-area">
          {loading ? (
            <div className="grocery-loading-spinner">Loading grocery checklist...</div>
          ) : totalItems === 0 ? (
            <div className="grocery-empty-state">
              <span style={{ fontSize: '2.5rem' }}>🛒</span>
              <h4>Your Grocery List is Empty</h4>
              <p>Add items above or click <strong>"Sync from Menus"</strong> to import ingredients from your locked meals!</p>
            </div>
          ) : (
            aisleGroups.map((aisle) => {
              if (aisle.items.length === 0) return null

              return (
                <div key={aisle.id} className="grocery-aisle-section">
                  <div className="grocery-aisle-header">
                    <span className="grocery-aisle-icon">{aisle.icon}</span>
                    <span className="grocery-aisle-name">{aisle.label}</span>
                    <span className="grocery-aisle-count">({aisle.items.length})</span>
                  </div>

                  <div className="grocery-aisle-items">
                    {aisle.items.map((item) => (
                      <div
                        key={item.id}
                        className={`grocery-item-row ${item.is_checked ? 'checked-item' : ''}`}
                        onClick={() => handleToggleChecked(item)}
                      >
                        <div className="grocery-item-checkbox">
                          <input
                            type="checkbox"
                            checked={Boolean(item.is_checked)}
                            onChange={() => {}} // handled by parent onClick
                            readOnly
                          />
                        </div>

                        <div className="grocery-item-details">
                          <span className="grocery-item-text">{item.name}</span>
                          {item.quantity && (
                            <span className="grocery-item-qty-tag">{item.quantity}</span>
                          )}
                        </div>

                        <button
                          type="button"
                          className="grocery-item-delete"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteItem(item.id)
                          }}
                          title="Remove item"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Sticky Footer Checkout Bar */}
        <div className="grocery-panel-footer">
          <div className="footer-cart-summary">
            <span>🛒 <strong>{checkedItems}</strong> items ready for checkout</span>
          </div>

          <button
            type="button"
            className="btn btn-checkout-grocery"
            onClick={handleOpenCheckout}
            disabled={totalItems === 0}
          >
            💸 Checkout & Log Grocery Expense
          </button>
        </div>

        {/* Mini Checkout Prompt Modal */}
        {showCheckoutModal && (
          <div className="modal-overlay nested-modal-overlay" onClick={() => setShowCheckoutModal(false)}>
            <div
              className="modal-content glass-card animate-fade-in mini-checkout-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>💸 Log Grocery Receipt Expense</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Converts purchased groceries into a shared group expense and splits it across diners.
              </p>

              {checkoutSuccess && (
                <div style={{ color: '#10b981', fontWeight: '600', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  {checkoutSuccess}
                </div>
              )}

              <form onSubmit={handleConfirmCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="field-label">Expense Description *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={checkoutDesc}
                    onChange={(e) => setCheckoutDesc(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 2 }}>
                    <label className="field-label">Actual Receipt Amount *</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      className="input-field"
                      placeholder="e.g. 78.50"
                      value={receiptAmount}
                      onChange={(e) => setReceiptAmount(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label className="field-label">Currency</label>
                    <input
                      type="text"
                      className="input-field"
                      value={receiptCurrency}
                      onChange={(e) => setReceiptCurrency(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="field-label">Who Paid? *</label>
                  <select
                    className="select-field"
                    value={paidByUserId}
                    onChange={(e) => setPaidByUserId(e.target.value)}
                    required
                  >
                    {committedMembers.map((m) => {
                      const uId = String(m.user_id || m.id)
                      const name = m.users?.first_name || m.username || 'Traveler'
                      return (
                        <option key={uId} value={uId}>
                          {name}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCheckoutModal(false)}
                    disabled={loggingExpense}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn" disabled={loggingExpense}>
                    {loggingExpense ? 'Logging Expense...' : 'Confirm & Log Expense'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
