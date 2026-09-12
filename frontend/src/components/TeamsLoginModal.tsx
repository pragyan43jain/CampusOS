import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  X,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Mail,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { CampusAPI } from '../services/api';

interface TeamsLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (data?: any) => void;
  onLoginFailure?: (errorMsg: string) => void;
  initialEmail?: string;
}

export const TeamsLoginModal: React.FC<TeamsLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onLoginFailure,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialEmail && !email) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Sync Failed');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await CampusAPI.loginTeams(email.trim(), password.trim());

      if (!res.success) {
        throw new Error(res.message || 'Sync Failed');
      }

      setSuccessMsg('✓ Microsoft Teams Connected');

      setTimeout(() => {
        onLoginSuccess(res);
        onClose();
      }, 700);
    } catch (err: any) {
      setError('Sync Failed');
      onLoginFailure?.('Sync Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content-glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 'min(480px, 94vw)', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
        {/* Modal Header */}
        <div className="modal-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-icon-box" style={{ width: '38px', height: '38px' }}>
              <ShieldCheck size={19} />
            </div>
            <div>
              <h3 className="modal-title">Link Microsoft Teams</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                University Microsoft 365 Education
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '6px' }} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Portal info badge */}
        <div
          style={{
            padding: '8px 12px',
            background: 'var(--surface-input)',
            border: '1px solid var(--border-secondary)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          <span style={{ whiteSpace: 'nowrap' }}>Official Portal:</span>
          <a
            href="https://www.microsoft.com/en-in/microsoft-teams/log-in"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--accent-cyan)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', wordBreak: 'break-all' }}
          >
            <span>teams.microsoft.com</span>
            <ExternalLink size={12} style={{ flexShrink: 0 }} />
          </a>
        </div>

        {/* Status / Error feedback */}
        {error && (
          <div
            className="status-badge error"
            style={{
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.80rem',
              gap: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              lineHeight: 1.4,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
                {error}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
              <button
                type="button"
                onClick={(e) => {
                  setError(null);
                  handleSubmit(e);
                }}
                disabled={loading}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem', padding: '4px 10px', height: '28px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <RotateCcw size={12} />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        )}

        {successMsg && (
          <div
            className="status-badge success"
            style={{
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              gap: '8px',
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              overflow: 'hidden',
            }}
          >
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
              {successMsg}
            </span>
          </div>
        )}


        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Microsoft Student Email</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name.surname2024@vitstudent.ac.in"
                className="input-field"
                style={{ paddingLeft: '38px' }}
                disabled={loading}
                autoComplete="email"
              />
              <Mail
                size={16}
                style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Microsoft 365 Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Microsoft password"
                className="input-field"
                style={{ paddingLeft: '38px', paddingRight: '38px' }}
                disabled={loading}
                autoComplete="current-password"
              />
              <Lock
                size={16}
                style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '13px', color: 'var(--text-muted)' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', height: '46px', marginTop: '4px' }}
          >
            {loading ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <span>Connect</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
