import React from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
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
    (acc, f) => acc + (f.paidAmount ?? (f.status === 'Paid' ? f.amount || f.totalAmount || 0 : 0)),
    0
  );
  const totalPending = fees.reduce(
    (acc, f) => acc + (f.pendingAmount ?? (f.status === 'Pending' ? f.amount || f.totalAmount || 0 : 0)),
    0
  );
  const totalFees = totalPaid + totalPending;

  return (
    <div className="page-container">
      {/* 1. Header Banner */}
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="hero-eyebrow">
              <CreditCard size={14} />
              <span>FINANCE &amp; ACCOUNTS DIVISION</span>
              <span>•</span>
              <span style={{ color: 'var(--text-muted)' }}>VIT CHENNAI</span>
            </div>
            <h2 className="hero-heading">Fee Management &amp; Receipts</h2>
            <p className="hero-desc">
              Authoritative financial ledger tracking tuition installments, hostel disbursements, mess balances, and official payment receipts.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              className={`status-badge ${totalPending === 0 ? 'safe' : 'warning'}`}
              style={{ padding: '8px 16px', fontSize: '0.86rem' }}
            >
              {totalPending === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              <span>
                {totalPending === 0
                  ? 'All Academic Dues Cleared ✓'
                  : `Pending Dues: ₹${totalPending.toLocaleString('en-IN')}`}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Financial Metrics Grid */}
      <div className="metrics-stat-grid">
        <MetricCard
          label="Total Institutional Fees"
          value={`₹${totalFees.toLocaleString('en-IN')}`}
          subtext="Tuition, hostel &amp; curriculum fee"
          icon={<CreditCard size={18} />}
          variant="cyan"
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
          subtext={totalPending === 0 ? 'Zero outstanding balance' : 'Payment due before deadline'}
          icon={<Clock size={18} />}
          variant={totalPending === 0 ? 'emerald' : 'amber'}
        />
      </div>

      {/* 3. Itemized Ledger Table */}
      <div className="card">
        <div className="card-header-bar">
          <div>
            <h3 className="card-title">
              <Receipt size={19} color="var(--accent-cyan)" />
              <span>Itemized Fee Invoices &amp; Transaction Ledger</span>
            </h3>
            <p className="card-description">
              Official university receipts with transaction IDs, payment dates, and invoice records.
            </p>
          </div>
        </div>

        {fees.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon">
              <Receipt size={26} />
            </div>
            <div className="empty-state-title">No Fee Records Synced</div>
            <p className="empty-state-desc">Synchronize with VTOP to view official fee statements.</p>
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table className="academic-data-table">
              <thead>
                <tr>
                  <th>Fee Title</th>
                  <th>Category / Semester</th>
                  <th>Total Amount</th>
                  <th>Paid Amount</th>
                  <th>Pending Due</th>
                  <th>Receipt Number</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee, idx) => {
                  const isPaid = fee.status === 'Paid' || (fee.pendingAmount === 0 && (fee.paidAmount || 0) > 0);
                  const paidVal = fee.paidAmount ?? (isPaid ? fee.amount || fee.totalAmount || 0 : 0);
                  const pendVal = fee.pendingAmount ?? (isPaid ? 0 : fee.amount || fee.totalAmount || 0);
                  const totalVal = fee.totalAmount ?? fee.amount ?? paidVal + pendVal;

                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {fee.title || 'Semester Tuition Fee'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {fee.category || fee.semester || 'Tuition'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        ₹{totalVal.toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--success-emerald)', fontWeight: 700 }}>
                        ₹{paidVal.toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: pendVal > 0 ? 'var(--warning-amber)' : 'var(--text-muted)' }}>
                        ₹{pendVal.toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                        {fee.receiptNumber || 'REC-' + (1000 + idx)}
                      </td>
                      <td>
                        <span className={`status-badge ${isPaid ? 'safe' : 'warning'}`}>
                          {isPaid ? 'Paid in Full ✓' : 'Payment Due'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
