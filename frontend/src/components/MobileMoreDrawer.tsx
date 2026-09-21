import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Briefcase,
  Zap,
  LogOut,
  X,
  ExternalLink,
  Palette,
  Check,
  Smartphone,
  DownloadCloud,
} from 'lucide-react';
import { NavView } from './Sidebar';
import { ThemeType, THEMES } from './Header';
import { MobileBridge, registerBackAction, usePWAInstallPrompt } from '../services/mobileBridge';

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  currentTheme?: ThemeType;
  onSelectTheme?: (t: ThemeType) => void;
  onSync?: () => void;
  syncing?: boolean;
  onOpenVtopModal?: () => void;
  onLogout?: () => void;
}

export const MobileMoreDrawer: React.FC<MobileMoreDrawerProps> = ({
  isOpen,
  onClose,
  activeView,
  onSelectView,
  currentTheme = 'cyber-dark',
  onSelectTheme,
  onSync,
  syncing = false,
  onOpenVtopModal,
  onLogout,
}) => {
  const { promptInstall, subscribeInstallState } = usePWAInstallPrompt();
  const [canInstall, setCanInstall] = useState<boolean>(false);
  const isStandalone = MobileBridge.isStandalone();

  useEffect(() => {
    const unsub = subscribeInstallState((val) => setCanInstall(val));
    return unsub;
  }, [subscribeInstallState]);

  // Register Android hardware back-button handler to close drawer
  useEffect(() => {
    if (!isOpen) return;
    const unregister = registerBackAction(() => {
      onClose();
      return true; // Handled
    });
    return unregister;
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAction = (cb?: () => void) => {
    MobileBridge.vibrate('light');
    if (cb) cb();
  };

  const handleInstallClick = async () => {
    MobileBridge.vibrate('medium');
    const installed = await promptInstall();
    if (installed) {
      MobileBridge.vibrate('success');
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
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
          padding: '18px 20px calc(24px + env(safe-area-inset-bottom, 16px))',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          maxHeight: '88vh',
          overflowY: 'auto',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.7)',
          animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Handle & Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '42px',
              height: '4.5px',
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
                cursor: 'pointer',
              }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Install App Banner (shown when installable or not standalone) */}
        {!isStandalone && canInstall && (
          <button
            onClick={handleInstallClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(45, 231, 211, 0.15) 0%, rgba(16, 185, 129, 0.1) 100%)',
              border: '1px solid rgba(45, 231, 211, 0.35)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'var(--accent-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#07080D',
                }}
              >
                <Smartphone size={18} strokeWidth={2.4} />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                  Install CampusOS App
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  Add to home screen for native full-screen experience
                </div>
              </div>
            </div>
            <DownloadCloud size={18} color="var(--accent-cyan)" />
          </button>
        )}

        {/* Action Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => {
              handleAction(() => onSelectView('fees'));
              onClose();
            }}
            className={`nav-item-btn ${activeView === 'fees' ? 'active' : ''}`}
            style={{
              height: '52px',
              padding: '0 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: activeView === 'fees' ? 'var(--surface-active)' : 'var(--surface-secondary)',
              border: '1px solid var(--border-card)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <CreditCard size={19} color="var(--accent-yellow)" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>Fees & Financial Ledger</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Tuition receipts & pending dues</span>
            </div>
          </button>

          <button
            onClick={() => {
              handleAction(() => onSelectView('placements'));
              onClose();
            }}
            className={`nav-item-btn ${activeView === 'placements' ? 'active' : ''}`}
            style={{
              height: '52px',
              padding: '0 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: activeView === 'placements' ? 'var(--surface-active)' : 'var(--surface-secondary)',
              border: '1px solid var(--border-card)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <Briefcase size={19} color="var(--accent-purple)" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>Placements & DSA Mastery</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>LeetCode tracker & career drives</span>
            </div>
          </button>
        </div>

        {/* Appearance & Themes Section */}
        {onSelectTheme && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.6px' }}>
                <Palette size={13} color="var(--accent-cyan)" />
                <span>Theme Appearance</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {THEMES.find((t) => t.id === currentTheme || (t.id === 'cyber-dark' && currentTheme === 'midnight-slate'))?.label}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {THEMES.map((th) => {
                const isSelected =
                  currentTheme === th.id ||
                  (th.id === 'cyber-dark' && currentTheme === 'midnight-slate');
                return (
                  <button
                    key={th.id}
                    onClick={() => {
                      MobileBridge.vibrate('selection');
                      onSelectTheme(th.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'var(--surface-active)' : 'var(--surface-secondary)',
                      border: `1px solid ${isSelected ? 'var(--border-highlight)' : 'var(--border-card)'}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      touchAction: 'manipulation',
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        backgroundColor: th.previewBg,
                        border: `1px solid ${isSelected ? th.previewAccent : 'rgba(128,128,128,0.3)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontFamily: th.fontFamily,
                        fontSize: '10px',
                        fontWeight: 800,
                        color: th.previewText,
                      }}
                    >
                      Aa
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, lineHeight: 1.15 }}>
                      <span style={{ fontFamily: th.fontFamily, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {th.label}
                      </span>
                      <span style={{ fontSize: '0.64rem', color: 'var(--accent-cyan)' }}>
                        {th.fontName}
                      </span>
                    </div>
                    {isSelected && <Check size={13} color="var(--accent-cyan)" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Sync & VTOP Portal Action */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => {
              MobileBridge.vibrate('light');
              onClose();
              if (onSync) onSync();
              else if (onOpenVtopModal) onOpenVtopModal();
            }}
            disabled={syncing}
            className="btn btn-primary"
            style={{ flex: 1, height: '48px', fontSize: '0.88rem' }}
          >
            <Zap size={16} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing...' : 'Sync VTOP Live'}</span>
          </button>

          <a
            href="https://vtopcc.vit.ac.in/vtop"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ padding: '0 16px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Open VTOP Portal in browser"
          >
            <ExternalLink size={16} />
          </a>
        </div>

        {/* Sign Out Button */}
        {onLogout && (
          <button
            onClick={() => {
              MobileBridge.vibrate('medium');
              onClose();
              onLogout();
            }}
            className="btn btn-danger"
            style={{
              width: '100%',
              height: '46px',
              fontSize: '0.88rem',
              marginTop: '2px',
            }}
          >
            <LogOut size={16} />
            <span>Sign Out Current Account</span>
          </button>
        )}

        <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {isStandalone ? 'CampusOS Native Mobile' : 'CampusOS Mobile Web'} • 100% Local & Authentic
        </div>
      </div>
    </div>
  );
};
