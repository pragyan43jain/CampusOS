import React from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Download,
  Receipt,
  Clock,
} from 'lucide-react';
import { FeeItem } from '../types';
import { MetricCard } from '../components/MetricCard';

interface FeesViewProps {
  fees: FeeItem[];
}

export const FeesView: React.FC<FeesViewProps> = ({ fees }) => {
  const totalPaid = fees.reduce(
    (acc, f) => acc + (f.paidAmount ?? (f.status === 'Paid' ? (f.amount || f.totalAmount || 0) : 0)),
    0
  );
  const totalPending = fees.reduce(
    (acc, f) => acc + (f.pendingAmount ?? (f.status === 'Pending' ? (f.amount || f.totalAmount || 0) : 0)),
    0
  );
  const totalFees = totalPaid + totalPending;

  return (
    <div className="page-container">
      {/* Header Banner */}
      <div
        className="card"
        style={{
          background: 'var(--brand-gradient-soft)',
          border: '1px solid var(--border-medium)',
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="status-badge info" style={{ fontSize: '0.7rem' }}>
                Finance & Accounts Division
              </span>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Official University Tuition & Hostel Dues
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              Fee Management & Official Receipts
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '640px' }}>
              Financial ledger tracking semester tuition schedules, hostel & mess disbursements, and digitally signed payment receipts.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`status-badge ${totalPending === 0 ? 'safe' : 'warning'}`} style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
              {totalPending === 0 ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              <span>{totalPending === 0 ? 'All Academic Dues Cleared' : `Pending Dues: ₹${totalPending.toLocaleString('en-IN')}`}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Financial Metrics Row */}
      <div className="metrics-stat-grid">
        <MetricCard
          label="Total Institutional Fees"
          value={`₹${totalFees.toLocaleString('en-IN')}`}
          subtext="Tuition, hostel & exam fees"
          icon={<CreditCard size={18} />}
          variant="blue"
        />
        <MetricCard
          label="Amount Disbursed (Paid)"
          value={`₹${totalPaid.toLocaleString('en-IN')}`}
          subtext="Verified university payments"
          icon={<CheckCircle2 size={18} />}
          variant="emerald"
        />
        <MetricCard
          label="Pending Outstanding Dues"
          value={`₹${totalPending.toLocaleString('en-IN')}`}
          subtext={totalPending === 0 ? 'Zero pending dues' : 'Payment due before deadline'}
          icon={<Clock size={18} />}
          variant={totalPending === 0 ? 'emerald' : 'amber'}
        />
      </div>

      {/* Ledger & Transactions Table */}
      <div className="card" style={{ gap: '16px' }}>
        <div className="card-header-bar">
          <div>
            <h3 className="card-title">
              <Receipt size={18} color="var(--brand-color)" />
              <span>Official Fee Invoices & Receipts</span>
            </h3>
            <p className="card-description">Itemized record of academic transactions and downloadable receipts</p>
          </div>
        </div>

        {fees.length > 0 ? (
          <div className="table-responsive-wrapper">
            <table className="academic-data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Fee Description</th>
                  <th>Semester</th>
                  <th>Receipt / Ref Number</th>
                  <th>Payment Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => {
                  const isPaid = fee.status === 'Paid';
                  const amountDisplay = fee.totalAmount ?? fee.amount ?? 0;
                  const receiptNo = fee.receiptNumber || `REC-${fee.id.substring(0, 8).toUpperCase()}`;

                  return (
                    <tr key={fee.id}>
                      <td>
                        <span className="status-badge neutral" style={{ fontSize: '0.72rem' }}>
                          {fee.category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{fee.title}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{fee.semester || 'Fall 2026-27'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--brand-color)' }}>
                        {isPaid ? receiptNo : '-'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {fee.paymentDate || (isPaid ? 'Recorded Date' : '-')}
                      </td>
                      <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                        ₹{amountDisplay.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span className={`status-badge ${isPaid ? 'safe' : 'warning'}`}>
                          {isPaid ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isPaid ? (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => alert(`Downloading official PDF receipt: ${receiptNo}`)}
                            style={{ padding: '4px 10px', fontSize: '0.76rem', gap: '4px' }}
                          >
                            <Download size={12} />
                            <span>Receipt</span>
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => alert(`Redirecting to payment gateway for ₹${amountDisplay.toLocaleString('en-IN')}`)}
                            style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                          >
                            Pay Now
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state-card">
            <div className="empty-state-icon-box">
              <Receipt size={24} />
            </div>
            <h4 className="empty-state-title">No Fee Records Found</h4>
            <p className="empty-state-desc">Synchronize with VTOP to view official semester fee schedules and transaction receipts.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeesView;
