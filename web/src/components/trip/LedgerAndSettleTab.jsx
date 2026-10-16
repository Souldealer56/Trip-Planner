import React from 'react'
import { BudgetAnalyticsTab } from './BudgetAnalyticsTab'

function getResolvedCategory(exp) {
  if (exp.category && exp.category.toLowerCase() !== 'other') {
    return exp.category.charAt(0).toUpperCase() + exp.category.slice(1).toLowerCase()
  }
  const match = (exp.description || '').match(/^\[(accommodation|flights|activities|food|transport|other)\]/i)
  if (match && match[1].toLowerCase() !== 'other') {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
  }
  const descLower = (exp.description || '').toLowerCase()
  if (/hotel|h[oô]tel|h[eé]bergement|stay|airbnb|lodging|auberge|villa|resort|machiya|ryokan|cabin|cottage|chalet|apartment|suite/i.test(descLower)) {
    return 'Accommodation'
  }
  if (/flight|vol|avion|airline|airfare|plane/i.test(descLower)) {
    return 'Flights'
  }
  if (/dinner|d[iî]ner|lunch|d[eé]jeuner|food|resto|restaurant|courses|repas|meal|breakfast/i.test(descLower)) {
    return 'Food'
  }
  if (/transport|car|voiture|uber|taxi|train|toll|gas|fuel|bus/i.test(descLower)) {
    return 'Transport'
  }
  if (/activity|activit[eé]|tour|ticket|billet|visite|excursion|mus[eé]e|museum/i.test(descLower)) {
    return 'Activities'
  }
  return 'Other'
}

export function LedgerAndSettleTab({
  ledgerTab = 'ledger',
  onLedgerTabChange,
  expenses = [],
  expensesLoading = false,
  committedMembers = [],
  roster = [],
  memberBalances = {},
  settlementsList = [],
  totalGroupSpend = 0,
  perPersonSplit = 0,
  baseCurrency = 'USD',
  onOpenExpenseModal,
  allTripOptions = [],
  rates = null,
  activeUser = null
}) {
  return (
    <div className="glass-card animate-fade-in" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
      {/* Top Header Bar & Mode Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🧾 Expenses & Settlements</span>
          </h2>
          <div
            style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '20px',
              padding: '3px',
              border: '1px solid var(--border-light)'
            }}
          >
            <button
              onClick={() => onLedgerTabChange('ledger')}
              type="button"
              style={{
                padding: '4px 14px',
                fontSize: '0.85rem',
                borderRadius: '16px',
                background: ledgerTab === 'ledger' ? 'var(--primary-light)' : 'transparent',
                color: ledgerTab === 'ledger' ? 'black' : 'var(--text-muted)',
                border: 'none',
                minWidth: 'auto',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Ledger List
            </button>
            <button
              onClick={() => onLedgerTabChange('settle')}
              type="button"
              style={{
                padding: '4px 14px',
                fontSize: '0.85rem',
                borderRadius: '16px',
                background: ledgerTab === 'settle' ? 'var(--primary-light)' : 'transparent',
                color: ledgerTab === 'settle' ? 'black' : 'var(--text-muted)',
                border: 'none',
                minWidth: 'auto',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Settle Up
            </button>
            <button
              onClick={() => onLedgerTabChange('analytics')}
              type="button"
              style={{
                padding: '4px 14px',
                fontSize: '0.85rem',
                borderRadius: '16px',
                background: ledgerTab === 'analytics' ? 'var(--primary-light)' : 'transparent',
                color: ledgerTab === 'analytics' ? 'black' : 'var(--text-muted)',
                border: 'none',
                minWidth: 'auto',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              📊 Budget Analytics
            </button>
          </div>
        </div>

        <button onClick={() => onOpenExpenseModal()} className="btn">
          Add Expense
        </button>
      </div>

      {ledgerTab === 'ledger' && (
        expensesLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
            <div className="skeleton skeleton-title" style={{ width: '30%' }} />
            <div className="skeleton skeleton-text" style={{ width: '80%' }} />
          </div>
        ) : expenses.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-main)' }}>No expenses logged yet.</h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Keep track of group travel splits by logging your first expense!
            </p>
            <button onClick={() => onOpenExpenseModal()} className="btn btn-secondary">
              Log First Expense
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="ledger-table-container">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Paid By</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Splits</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => {
                    const payerName = exp.users?.first_name || 'Unknown'
                    const committedCount = committedMembers.length
                    const isSplitEqually = !exp.split_users || exp.split_users.length === 0 || exp.split_users.length === committedCount

                    let splitsText = 'Everyone'
                    if (!isSplitEqually) {
                      const splitIds = exp.split_users.map((u) => (typeof u === 'object' ? u.user_id : u))
                      const splitNames = roster
                        .filter((m) => splitIds.includes(m.user_id))
                        .map((m) => m.users?.first_name || m.username || String(m.user_id).slice(0, 5))
                      splitsText = splitNames.length > 0 ? splitNames.join(', ') : 'Custom'
                    }

                    const catLabel = getResolvedCategory(exp)

                    return (
                      <tr key={exp.id}>
                        <td style={{ fontWeight: '500' }}>{exp.description}</td>
                        <td>
                          <span
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)'
                            }}
                          >
                            {catLabel}
                          </span>
                        </td>
                        <td>{payerName}</td>
                        <td style={{ color: 'var(--primary-light)', fontWeight: '600' }}>
                          {Number(exp.amount).toFixed(2)} {exp.currency || 'USD'}
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {new Date(exp.created_at).toLocaleDateString()}
                        </td>
                        <td
                          style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={splitsText}
                        >
                          {splitsText}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View Stack */}
            <div className="ledger-mobile-cards">
              {expenses.map((exp) => {
                const payerName = exp.users?.first_name || 'Unknown'
                const committedCount = committedMembers.length
                const isSplitEqually = !exp.split_users || exp.split_users.length === 0 || exp.split_users.length === committedCount

                let splitsText = 'Everyone'
                if (!isSplitEqually) {
                  const splitIds = exp.split_users.map((u) => (typeof u === 'object' ? u.user_id : u))
                  const splitNames = roster
                    .filter((m) => splitIds.includes(m.user_id))
                    .map((m) => m.users?.first_name || m.username || String(m.user_id).slice(0, 5))
                  splitsText = splitNames.length > 0 ? splitNames.join(', ') : 'Custom'
                }

                const catLabel = getResolvedCategory(exp)

                return (
                  <div key={exp.id} className="ledger-card">
                    <div className="ledger-card-header">
                      <span className="ledger-card-desc">{exp.description}</span>
                      <span className="ledger-card-amount">
                        {Number(exp.amount).toFixed(2)} {exp.currency || 'USD'}
                      </span>
                    </div>
                    <div className="ledger-card-meta">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="ledger-card-category-pill">{catLabel}</span>
                        <span>Paid by: <strong>{payerName}</strong></span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(exp.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="ledger-card-splits">
                      Split with: <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>{splitsText}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )
      )}

      {ledgerTab === 'settle' && (
        <div className="animate-fade-in">
          {/* Spend Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="glass-card" style={{ padding: '12px var(--spacing-md)', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>TOTAL GROUP SPEND</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary-light)' }}>
                {totalGroupSpend.toFixed(2)} {baseCurrency}
              </div>
            </div>
            <div className="glass-card" style={{ padding: '12px var(--spacing-md)', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>PER PERSON SPLIT</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                {perPersonSplit.toFixed(2)} {baseCurrency}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            {/* Individual net balances */}
            <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.01)' }}>
              <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Individual Balances
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.values(memberBalances).map((b) => {
                  const net = b.paid - b.owed
                  const isCredit = net > 0.01
                  const isDebit = net < -0.01

                  let netClass = ''
                  let netText = 'Even'
                  if (isCredit) {
                    netClass = 'credit'
                    netText = `+${net.toFixed(2)} ${baseCurrency}`
                  } else if (isDebit) {
                    netClass = 'debit'
                    netText = `-${Math.abs(net).toFixed(2)} ${baseCurrency}`
                  }

                  return (
                    <div key={b.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '500' }}>{b.name}</span>
                      <span className={`balance-badge ${netClass}`} style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                        {netText}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Minimized transactions list */}
            <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.01)' }}>
              <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Settlement Paths
              </h3>
              {settlementsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>✅</div>
                  <h4 style={{ margin: 0, color: 'var(--text-main)' }}>Everyone is perfectly even!</h4>
                  <p style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>No transactions are needed to settle balances.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {settlementsList.map((tx, idx) => (
                    <div
                      key={idx}
                      className="settlement-row"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(255, 255, 255, 0.01)',
                        border: '1px solid var(--border-light)',
                        padding: '10px 14px',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '600' }}>{tx.fromName}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 'bold' }}>➡️ pays ➡️</span>
                        <span style={{ fontWeight: '600' }}>{tx.toName}</span>
                      </div>
                      <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                        {tx.amount.toFixed(2)} {baseCurrency}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {ledgerTab === 'analytics' && (
        <BudgetAnalyticsTab
          expenses={expenses}
          allTripOptions={allTripOptions}
          committedMembers={committedMembers}
          rates={rates}
          baseCurrency={baseCurrency}
          activeUser={activeUser}
        />
      )}
    </div>
  )
}
