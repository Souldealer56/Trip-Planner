import React, { useState, useEffect } from 'react'
import { formatDateRange } from '../../utils/format'

export function EditTripModal({
  isOpen,
  onClose,
  trip,
  onSubmit,
  loading = false,
  error = '',
  onToggleArchive,
  onOpenDeleteConfirm,
  showDeleteConfirm = false,
  onCloseDeleteConfirm,
  onConfirmDelete,
  deleteLoading = false,
  deleteError = '',
  conflictingOptions = [],
  showReconcileModal = false,
  onCloseReconcileModal
}) {
  const [editTitle, setEditTitle] = useState('')
  const [editDestination, setEditDestination] = useState('')
  const [editVibe, setEditVibe] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editBaseCurrency, setEditBaseCurrency] = useState('USD')
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (isOpen && trip) {
      setEditTitle(trip.title || '')
      setEditDestination(trip.destination || '')
      setEditVibe(trip.vibe || '')
      setEditStartDate(trip.start_date || '')
      setEditEndDate(trip.end_date || '')
      setEditBaseCurrency(trip.base_currency || 'USD')
      setValidationError('')
    }
  }, [isOpen, trip])

  if (!isOpen && !showDeleteConfirm && !showReconcileModal) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    setValidationError('')
    if (!editTitle.trim()) {
      setValidationError('Trip title is required.')
      return
    }
    if (!editDestination.trim()) {
      setValidationError('Destination is required.')
      return
    }
    if (editStartDate && editEndDate && new Date(editStartDate) > new Date(editEndDate)) {
      setValidationError('Start date must be before or equal to end date.')
      return
    }

    onSubmit({
      title: editTitle.trim(),
      destination: editDestination.trim(),
      vibe: editVibe.trim() || null,
      startDate: editStartDate,
      endDate: editEndDate,
      baseCurrency: editBaseCurrency
    })
  }

  return (
    <>
      {isOpen && (
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-content glass-card animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '90%' }}>
            <div>
              <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', textAlign: 'center' }}>
                Edit Trip Settings
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                Update destination, dates, currency, and vibe for this trip.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Trip Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Summer Vacation in Maui"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    className="input-field"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Destination *</label>
                  <input
                    type="text"
                    placeholder="e.g. Maui, Hawaii"
                    value={editDestination}
                    onChange={(e) => setEditDestination(e.target.value)}
                    required
                    className="input-field"
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Start Date</label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>End Date</label>
                    <input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Base Currency</label>
                  <select
                    value={editBaseCurrency}
                    onChange={(e) => setEditBaseCurrency(e.target.value)}
                    className="input-field select-field"
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Trip Vibe / Description (Optional)</label>
                  <textarea
                    placeholder="e.g. Beach relaxation & volcano hikes"
                    value={editVibe}
                    onChange={(e) => setEditVibe(e.target.value)}
                    rows="3"
                    className="input-field"
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                {(validationError || error) && (
                  <div style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem' }}>
                    ⚠️ {validationError || error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn"
                    disabled={loading}
                    style={{ flex: 1 }}
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>

                <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-light)' }}>
                  <h4 style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⚠️ Danger Zone & Archiving
                  </h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.85rem' }}>
                    Archive this trip to hide it from your main dashboard view, or permanently delete it and its data.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={onToggleArchive}
                      className="btn btn-secondary"
                      style={{ flex: 1, border: '1px solid #eab308', color: '#eab308', background: 'rgba(234, 179, 8, 0.1)', fontSize: '0.8rem' }}
                    >
                      {trip?.is_archived ? '📂 Unarchive Trip' : '📦 Archive Trip'}
                    </button>
                    <button
                      type="button"
                      onClick={onOpenDeleteConfirm}
                      className="btn"
                      style={{ flex: 1, backgroundColor: '#ef4444', color: '#fff', fontSize: '0.8rem' }}
                    >
                      🗑️ Delete Trip
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={onCloseDeleteConfirm} style={{ zIndex: 1100 }}>
          <div className="modal-content glass-card animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚨</div>
            <h3 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>Permanently Delete Trip?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              This action <strong>cannot be undone</strong>. All pitched options, active polls, RSVPs, logged expenses, and activity logs for <strong>"{trip?.title}"</strong> will be permanently deleted.
            </p>
            {deleteError && (
              <div style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                ⚠️ {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={onCloseDeleteConfirm}
                className="btn btn-secondary"
                style={{ flex: 1 }}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={onConfirmDelete}
                className="btn"
                style={{ flex: 1, backgroundColor: '#ef4444', color: '#fff' }}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete Trip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Save Date Reconciliation Modal */}
      {showReconcileModal && (
        <div className="modal-overlay" onClick={onCloseReconcileModal}>
          <div className="modal-content glass-card animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', width: '90%' }}>
            <div>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '2.5rem' }}>⚠️</span>
                <h2 style={{ color: '#f59e0b', margin: '0.5rem 0' }}>Option Dates Reconciliation</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                  Trip dates were updated. The following pitched option(s) fall outside the new trip range ({formatDateRange(trip?.start_date, trip?.end_date)}):
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '240px', overflowY: 'auto', margin: '1rem 0', paddingRight: '4px' }}>
                {conflictingOptions.map((opt) => (
                  <div
                    key={opt.id}
                    style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--text-main)' }}>{opt.option_text}</strong>
                      <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                        {opt.category}
                      </span>
                    </div>
                    {(opt.start_date || opt.end_date) && (
                      <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>
                        📅 Option dates: {formatDateRange(opt.start_date, opt.end_date)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <button
                  onClick={onCloseReconcileModal}
                  className="btn"
                  style={{ width: '100%' }}
                >
                  Understood & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
