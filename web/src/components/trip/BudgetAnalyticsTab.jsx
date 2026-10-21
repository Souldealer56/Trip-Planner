import React from 'react'
import { calculateTripBudgetAnalytics } from '../../utils/currency'
import { formatMoney } from '../../utils/format'

export function BudgetAnalyticsTab({
  expenses = [],
  allTripOptions = [],
  committedMembers = [],
  rates = null,
  baseCurrency = 'USD',
  activeUser = null
}) {
  const analytics = calculateTripBudgetAnalytics(
    expenses,
    allTripOptions,
    committedMembers,
    rates,
    baseCurrency
  )

  const activeUserStats = activeUser
    ? analytics.travelerStats.find((t) => String(t.userId) === String(activeUser.id))
    : null

  const categories = ['Accommodation', 'Transport', 'Activities', 'Food', 'Other']

  return (
    <div style={{ marginTop: '1.5rem' }} className="animate-fade-in">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Active User Personal Forecast Hero Card */}
        {activeUserStats && (
          <div
            className="glass-card"
            style={{
              padding: '1.5rem',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(168, 85, 247, 0.15))',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#c4b5fd', letterSpacing: '0.5px' }}>
                  🎯 My Personal Trip Cost Forecast
                </span>
                <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '4px' }}>
                  {formatMoney(activeUserStats.totalProjectedPersonalCost, baseCurrency)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-main)',
                    border: '1px solid rgba(255, 255, 255, 0.12)'
                  }}
                >
                  🧾 <strong>{formatMoney(activeUserStats.actualLoggedShare, baseCurrency)}</strong> Logged
                </span>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    background: 'rgba(168, 85, 247, 0.15)',
                    color: '#e9d5ff',
                    border: '1px solid rgba(168, 85, 247, 0.3)'
                  }}
                >
                  🔒 <strong>{formatMoney(activeUserStats.projectedFromLockedOptions, baseCurrency)}</strong> Pending Choices
                </span>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    background: activeUserStats.netBalance >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                    color: activeUserStats.netBalance >= 0 ? '#6ee7b7' : '#fda4af',
                    border: `1px solid ${activeUserStats.netBalance >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                    fontWeight: 'bold'
                  }}
                >
                  💳 {activeUserStats.netBalance >= 0 ? '+' : ''}{formatMoney(activeUserStats.netBalance, baseCurrency)} Net
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Summary Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Total Estimated Budget
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-light)', marginTop: '4px' }}>
              {formatMoney(analytics.totalEstimatedBudget, baseCurrency)}
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
              {formatMoney(analytics.totalActualSpend, baseCurrency)}
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
              {formatMoney(analytics.variance, baseCurrency)} ({analytics.variancePercent > 0 ? '+' : ''}
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
                      Actual: <strong>{formatMoney(act, baseCurrency)}</strong>{' '}
                      {est > 0 ? `/ Est: ${formatMoney(est, baseCurrency)}` : ''}
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
                  <th style={{ padding: '8px', textAlign: 'right' }}>Logged Share</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Pending Locked</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Personal Forecast</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Total Paid</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Net Balance</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Group Share</th>
                </tr>
              </thead>
              <tbody>
                {analytics.travelerStats.map((t) => {
                  const isCredit = t.netBalance > 0.01
                  const isDebit = t.netBalance < -0.01
                  const isUser = activeUser && String(t.userId) === String(activeUser.id)

                  return (
                    <tr
                      key={t.userId}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        background: isUser ? 'rgba(99, 102, 241, 0.08)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '10px 8px', fontWeight: '600' }}>
                        <span>{t.name}</span>
                        {isUser && (
                          <span
                            style={{
                              marginLeft: '6px',
                              fontSize: '0.7rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'var(--primary)',
                              color: '#ffffff'
                            }}
                          >
                            You
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {formatMoney(t.owed, baseCurrency)}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#c4b5fd' }}>
                        {formatMoney(t.projectedFromLockedOptions, baseCurrency)}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        {formatMoney(t.totalProjectedPersonalCost, baseCurrency)}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-main)' }}>
                        {formatMoney(t.paid, baseCurrency)}
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
                        {formatMoney(t.netBalance, baseCurrency)}
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
