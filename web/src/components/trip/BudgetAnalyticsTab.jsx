import React from 'react'
import { calculateTripBudgetAnalytics } from '../../utils/currency'

export function BudgetAnalyticsTab({
  expenses = [],
  allTripOptions = [],
  committedMembers = [],
  rates = null,
  baseCurrency = 'USD'
}) {
  const analytics = calculateTripBudgetAnalytics(
    expenses,
    allTripOptions,
    committedMembers,
    rates,
    baseCurrency
  )

  const categories = ['Accommodation', 'Flights', 'Activities', 'Food', 'Transport', 'Other']

  return (
    <div style={{ marginTop: '1.5rem' }} className="animate-fade-in">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Summary Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Total Estimated Budget
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-light)', marginTop: '4px' }}>
              {analytics.totalEstimatedBudget.toFixed(2)} {baseCurrency}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              From locked itinerary choices
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Total Actual Logged
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '4px' }}>
              {analytics.totalActualSpend.toFixed(2)} {baseCurrency}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              From {expenses.length} logged expense{expenses.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Budget Variance
            </div>
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: analytics.variance <= 0 ? '#34d399' : '#f87171',
                marginTop: '4px'
              }}
            >
              {analytics.variance > 0 ? '+' : ''}
              {analytics.variance.toFixed(2)} {baseCurrency} ({analytics.variancePercent > 0 ? '+' : ''}
              {analytics.variancePercent.toFixed(1)}%)
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: analytics.variance <= 0 ? '#34d399' : '#f87171',
                marginTop: '4px',
                fontWeight: '600'
              }}
            >
              {analytics.variance <= 0 ? '✓ Under / On Budget' : '⚠️ Over Estimated Budget'}
            </div>
          </div>
        </div>

        {/* Category Spend Distribution */}
        <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid var(--border-light)' }}>
          <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
            📁 Category Spend Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {categories.map((cat) => {
              const est = analytics.categoryEstimates[cat] || 0
              const act = analytics.categoryActuals[cat] || 0
              const maxVal = Math.max(est, act, 1)
              const pct = Math.min((act / maxVal) * 100, 100)

              return (
                <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: '600' }}>{cat}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Actual: <strong>{act.toFixed(2)} {baseCurrency}</strong>{' '}
                      {est > 0 ? `/ Est: ${est.toFixed(2)} ${baseCurrency}` : ''}
                    </span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: 'var(--primary)',
                        borderRadius: '4px',
                        transition: 'width 0.3s'
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Per-Traveler Net Balance & Commitment Summary Table */}
        <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid var(--border-light)' }}>
          <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
            👥 Traveler Cost Commitment & Balance Breakdown
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px' }}>Traveler</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Total Paid</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Owed Share</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Net Balance</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Group Share</th>
                </tr>
              </thead>
              <tbody>
                {analytics.travelerStats.map((t) => {
                  const isCredit = t.netBalance > 0.01
                  const isDebit = t.netBalance < -0.01
                  return (
                    <tr key={t.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: '600' }}>{t.name}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-main)' }}>
                        {t.paid.toFixed(2)} {baseCurrency}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {t.owed.toFixed(2)} {baseCurrency}
                      </td>
                      <td
                        style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          fontWeight: 'bold',
                          color: isCredit ? '#34d399' : isDebit ? '#f87171' : 'var(--text-muted)'
                        }}
                      >
                        {isCredit ? '+' : ''}
                        {t.netBalance.toFixed(2)} {baseCurrency}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600' }}>
                        {t.sharePercent.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
