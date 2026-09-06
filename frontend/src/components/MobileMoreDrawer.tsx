import React from 'react';
import {
  CreditCard,
  Briefcase,
  Zap,
  LogOut,
  X,
  ExternalLink,
} from 'lucide-react';
import { NavView } from './Sidebar';

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  onOpenVtopModal?: () => void;
  onLogout?: () => void;
}

export const MobileMoreDrawer: React.FC<MobileMoreDrawerProps> = ({
  isOpen,
  onClose,
  activeView,
  onSelectView,
  onOpenVtopModal,
  onLogout,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--surface-primary)',
          borderTop: '1px solid var(--border-medium)',
          borderRadius: '24px 24px 0 0',
          padding: '20px 24px calc(24px + env(safe-area-inset-bottom, 16px))',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Handle & Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '4px',
              borderRadius: '9999px',
              backgroundColor: 'var(--border-medium)',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--gradient-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#07080D',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                }}
              >
                C
              </div>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                CampusOS Actions
              </span>
            </div>
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--surface-secondary)',
                border: '1px solid var(--border-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Action Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={() => {
              onSelectView('fees');
              onClose();
            }}
            className={`nav-item-btn ${activeView === 'fees' ? 'active' : ''}`}
            style={{
              height: '50px',
              padding: '0 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: activeView === 'fees' ? 'var(--surface-active)' : 'var(--surface-secondary)',
              border: '1px solid var(--border-card)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: 'var(--text-primary)',
            }}
          >
            <CreditCard size={18} color="var(--accent-yellow)" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>Fees & Financial Ledger</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Tuition receipts & pending dues</span>
            </div>
          </button>

          <button
            onClick={() => {
              onSelectView('placements');
              onClose();
            }}
            className={`nav-item-btn ${activeView === 'placements' ? 'active' : ''}`}
            style={{
              height: '50px',
              padding: '0 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: activeView === 'placements' ? 'var(--surface-active)' : 'var(--surface-secondary)',
              border: '1px solid var(--border-card)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: 'var(--text-primary)',
            }}
          >
            <Briefcase size={18} color="var(--accent-purple)" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>Placements & DSA Mastery</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>LeetCode tracker & career drives</span>
            </div>
          </button>
        </div>

        {/* Quick Sync & VTOP Portal Action */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {onOpenVtopModal && (
            <button
              onClick={() => {
                onClose();
                onOpenVtopModal();
              }}
              className="btn btn-primary"
              style={{ flex: 1, height: '46px', fontSize: '0.88rem' }}
            >
              <Zap size={16} />
              <span>Sync VTOP Live</span>
            </button>
          )}

          <a
            href="https://vtopcc.vit.ac.in/vtop"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ padding: '0 16px', height: '46px' }}
          >
            <ExternalLink size={16} />
          </a>
        </div>

        {/* Sign Out Button */}
        {onLogout && (
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="btn btn-danger"
            style={{
              width: '100%',
              height: '46px',
              fontSize: '0.88rem',
              marginTop: '4px',
            }}
          >
            <LogOut size={16} />
            <span>Sign Out Current Account</span>
          </button>
        )}

        <div style={{ textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          CampusOS Mobile v2.0 • 100% Local & Authentic
        </div>
      </div>
    </div>
  );
};
