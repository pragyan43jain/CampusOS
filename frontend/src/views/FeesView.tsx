import React from 'react';
import { FeeItem } from '../types';

interface FeesViewProps {
  fees: FeeItem[];
}

export const FeesView: React.FC<FeesViewProps> = ({ fees }) => {
  const totalDue = fees.reduce((acc, f) => acc + (f.pendingAmount ?? (f.status === 'Pending' ? (f.amount || f.totalAmount || 0) : 0)), 0);

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Fee Management & Official Receipts</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Track semester tuition, hostel & mess dues, and download digitally signed receipts.
          </p>
        </div>

        {totalDue > 0 ? (
          <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', padding: '8px 16px', borderRadius: 'var(--radius-md)', color: 'var(--warning-amber)', fontWeight: 600, fontSize: '0.85rem' }}>
            Pending Dues: ₹{totalDue.toLocaleString('en-IN')}
          </div>
        ) : (
          <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', padding: '8px 16px', borderRadius: 'var(--radius-md)', color: 'var(--success-emerald)', fontWeight: 600, fontSize: '0.85rem' }}>
            ✓ All Academic Fees Cleared
          </div>
        )}
      </div>

      <div className="assignments-container">
        {fees.length > 0 ? (
          fees.map((fee) => {
            const isPaid = fee.status === 'Paid';
            const amountDisplay = fee.totalAmount ?? fee.amount ?? 0;
            const pending = fee.pendingAmount ?? (isPaid ? 0 : amountDisplay);

            return (
              <div key={fee.id} className="assignment-item-card">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--brand-blue)' }}>
                      {fee.category}
                    </span>
                    {fee.semester && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fee.semester}</span>
                    )}
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {fee.title}
                  </h3>
                  {fee.receiptNumber && (
                    <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Receipt No: {fee.receiptNumber} • Paid on {fee.paymentDate || 'Recorded Date'}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    ₹{amountDisplay.toLocaleString('en-IN')}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`attendance-percentage-pill ${isPaid ? 'safe' : 'critical'}`}>
                      {fee.status}
                    </span>

                    {isPaid ? (
                      <button
                        className="btn-outline"
                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                        onClick={() => alert(`Downloading official PDF receipt: ${fee.receiptNumber || fee.id}`)}
                      >
                        Download Receipt 📄
                      </button>
                    ) : (
                      <button
                        className="btn-primary"
                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                        onClick={() => alert(`Redirecting to secure payment gateway for amount ₹${pending}`)}
                      >
                        Pay Now 💳
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state-box">
            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              No fee payment records or receipts found.
            </p>
            <p style={{ marginTop: '4px', fontSize: '0.85rem' }}>
              Connect and synchronize with VTOP to view official fee receipts and dues.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeesView;
