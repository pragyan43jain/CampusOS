import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Clock,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import { FeeItem } from '../types';
import { MetricCard } from '../components/MetricCard';
import { CampusAPI } from '../services/api';

interface FeesViewProps {
  fees: FeeItem[];
  onRefresh?: () => Promise<void> | void;
}

export const FeesView: React.FC<FeesViewProps> = ({ fees: initialFees, onRefresh }) => {
  const [fees, setFees] = useState<FeeItem[]>(initialFees || []);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');

  const [showFeeDetails, setShowFeeDetails] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('campusos_hide_fee_details');
      return saved !== 'true';
    } catch {
      return true;
    }
  });

  // Keep fees synced with incoming prop or load on mount if empty
  useEffect(() => {
    if (initialFees && initialFees.length > 0) {
      setFees(initialFees);
    } else {
      loadFees();
    }
  }, [initialFees]);

  const loadFees = async () => {
    setLoading(true);
    try {
      const data = await CampusAPI.getFees();
      if (data && data.length > 0) {
        setFees(data);
      }
    } catch (err) {
      console.warn('[FeesView] Failed to load live fees:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    await loadFees();
    if (onRefresh) {
      try {
        await onRefresh();
      } catch (e) {
        console.warn('[FeesView] Parent refresh failed:', e);
      }
    }
  };

  const toggleShowFees = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowFeeDetails((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('campusos_hide_fee_details', (!next).toString());
      } catch {}
      return next;
    });
  };

  const totalPaid = useMemo(() => {
    return fees.reduce(
      (acc, f) => acc + (f.paidAmount ?? (f.status === 'Paid' ? f.amount || f.totalAmount || 0 : 0)),
      0
    );
  }, [fees]);

  const totalPending = useMemo(() => {
    return fees.reduce(
      (acc, f) => acc + (f.pendingAmount ?? (f.status === 'Pending' ? f.amount || f.totalAmount || 0 : 0)),
      0
    );
  }, [fees]);

  const totalFees = totalPaid + totalPending;

  const filteredFees = useMemo(() => {
    let list = fees;
    if (statusFilter === 'PAID') {
      list = list.filter((f) => f.status === 'Paid' || (f.pendingAmount === 0 && (f.paidAmount || 0) > 0));
    } else if (statusFilter === 'PENDING') {
      list = list.filter((f) => f.status === 'Pending' || (f.pendingAmount || 0) > 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((f) => {
        return (
          (f.title && f.title.toLowerCase().includes(q)) ||
          (f.receiptNumber && f.receiptNumber.toLowerCase().includes(q)) ||
          (f.category && f.category.toLowerCase().includes(q)) ||
          (f.date && f.date.toLowerCase().includes(q)) ||
          (f.paymentDate && f.paymentDate.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [fees, statusFilter, searchQuery]);

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
              Authoritative financial ledger tracking tuition installments, institutional disbursements, and official payment receipts.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              className={`status-badge ${totalPending === 0 ? 'safe' : 'warning'}`}
              style={{ padding: '8px 16px', fontSize: '0.86rem' }}
            >
              {totalPending === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              <span>
                {totalPending === 0
                  ? 'All Academic Dues Cleared ✓'
                  : showFeeDetails
                  ? `Pending Dues: ₹${totalPending.toLocaleString('en-IN')}`
                  : 'Pending Dues: ₹ ••••••'}
              </span>
            </span>

            <a
              href="https://vtop.vit.ac.in"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ExternalLink size={14} />
              <span>VTOP Portal</span>
            </a>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleManualRefresh}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Sync Fee Receipts</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Financial Metrics Grid */}
      <div className="metrics-stat-grid">
        <MetricCard
          label="Total Institutional Fees"
          value={showFeeDetails ? `₹${totalFees.toLocaleString('en-IN')}` : '₹ ••••••'}
          subtext={showFeeDetails ? "Tuition & curriculum fee" : "Fee details hidden • Click eye to reveal"}
          icon={
            <button
              onClick={toggleShowFees}
              title={showFeeDetails ? "Hide total fee details" : "Show total fee details"}
              aria-label={showFeeDetails ? "Hide total fee details" : "Show total fee details"}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'inherit',
                outline: 'none',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {showFeeDetails ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          }
          onClick={toggleShowFees}
          variant="cyan"
        />
        <MetricCard
          label="Amount Disbursed (Paid)"
          value={showFeeDetails ? `₹${totalPaid.toLocaleString('en-IN')}` : '₹ ••••••'}
          subtext={showFeeDetails ? `${fees.length} verified payment receipts` : "Verified university payments (Hidden)"}
          icon={<CheckCircle2 size={18} />}
          variant="emerald"
        />
        <MetricCard
          label="Pending Outstanding Dues"
          value={showFeeDetails ? `₹${totalPending.toLocaleString('en-IN')}` : '₹ ••••••'}
          subtext={
            !showFeeDetails
              ? 'Pending balance hidden'
              : totalPending === 0
              ? 'Zero outstanding balance'
              : 'Payment due before deadline'
          }
          icon={<Clock size={18} />}
          variant={totalPending === 0 ? 'emerald' : 'amber'}
        />
      </div>

      {/* 3. Itemized Ledger Table */}
      <div className="card">
        <div className="card-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h3 className="card-title">
              <Receipt size={19} color="var(--accent-cyan)" />
              <span>Itemized Fee Invoices &amp; Transaction Ledger</span>
            </h3>
            <p className="card-description">
              Official university receipts with transaction IDs, payment dates, and invoice records ({fees.length} Total).
            </p>
          </div>

          {/* Search bar & Status Filter */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              {(['ALL', 'PAID', 'PENDING'] as const).map((st) => (
                <button
                  key={st}
                  className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setStatusFilter(st)}
                  style={{ borderRadius: 0, fontSize: '0.78rem', padding: '4px 10px' }}
                >
                  {st === 'ALL' ? `All (${fees.length})` : st === 'PAID' ? 'Paid' : 'Pending'}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '220px', maxWidth: '100%' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Search receipt #, title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--input-bg, rgba(0,0,0,0.2))',
                  color: 'inherit',
                  fontSize: '0.8rem',
                }}
              />
            </div>
          </div>
        </div>

        {fees.length === 0 ? (
          <div className="empty-state-card" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div className="empty-state-icon" style={{ margin: '0 auto 12px' }}>
              <Receipt size={28} />
            </div>
            <div className="empty-state-title" style={{ fontSize: '1.1rem', fontWeight: 600 }}>No Fee Records Synced</div>
            <p className="empty-state-desc" style={{ maxWidth: '400px', margin: '6px auto 16px', color: 'var(--text-muted)' }}>
              Synchronize with official VTOP portal to retrieve your tuition installments and payment vouchers.
            </p>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleManualRefresh}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Fetch Fee Records Now</span>
            </button>
          </div>
        ) : filteredFees.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>No fee records matching "{searchQuery}"</p>
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table className="academic-data-table table-fees">
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Fee Title</th>
                  <th style={{ minWidth: 140 }}>Category / Semester</th>
                  <th style={{ minWidth: 120 }}>Total Amount</th>
                  <th style={{ minWidth: 120 }}>Paid Amount</th>
                  <th style={{ minWidth: 120 }}>Pending Due</th>
                  <th style={{ minWidth: 130 }}>Receipt Number</th>
                  <th style={{ minWidth: 110 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredFees.map((fee, idx) => {
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
                        {fee.category || fee.semester || 'Tuition / Academic Fee'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {showFeeDetails ? `₹${totalVal.toLocaleString('en-IN')}` : '₹ ••••••'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--success-emerald)', fontWeight: 700 }}>
                        {showFeeDetails ? `₹${paidVal.toLocaleString('en-IN')}` : '₹ ••••••'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: pendVal > 0 ? 'var(--warning-amber)' : 'var(--text-muted)' }}>
                        {showFeeDetails ? `₹${pendVal.toLocaleString('en-IN')}` : '₹ ••••••'}
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
