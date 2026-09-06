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
  Settings2,
  Server,
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
  const [step, setStep] = useState<string | null>(null);

  // Backend connection settings toggle
  const [showServerConfig, setShowServerConfig] = useState<boolean>(false);
  const [customApiUrl, setCustomApiUrl] = useState<string>(CampusAPI.getApiBaseUrl());

  useEffect(() => {
    if (initialEmail && !email) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setStep(null);
      setCustomApiUrl(CampusAPI.getApiBaseUrl());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    CampusAPI.setCustomApiUrl(customApiUrl);
    setError(null);
    setSuccessMsg('API URL updated successfully');
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your university Microsoft email address.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your Microsoft account password.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setStep('Authenticating with Microsoft Online Services...');

    try {
      const res = await CampusAPI.loginTeams(email.trim(), password.trim());

      if (!res.success) {
        throw new Error(res.message || 'Authentication failed. Please check your credentials.');
      }

      setStep('Syncing Teams assignments & coursework...');
      setSuccessMsg(res.message || '✓ Microsoft Teams Connected');

      setTimeout(() => {
        onLoginSuccess(res);
        onClose();
      }, 700);
    } catch (err: any) {
      const errMsg = err?.message || '';
      const finalMsg = (errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('networkerror') || errMsg.toLowerCase().includes('unable to connect'))
        ? 'Unable to connect to Microsoft Teams right now. Check your network connection.'
        : (errMsg || 'Failed to authenticate with Microsoft Teams.');
      setError(finalMsg);
      onLoginFailure?.(finalMsg);
    } finally {
      setLoading(false);
      setStep(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content-glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
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
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="btn btn-ghost btn-sm"
              style={{ padding: '6px' }}
              title="Configure Backend API URL"
              aria-label="Server settings"
            >
              <Settings2 size={16} color={showServerConfig ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
            </button>
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '6px' }} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Expandable Server Config Panel */}
        {showServerConfig && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-card)',
              backgroundColor: 'var(--surface-sunken)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.80rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              <Server size={14} color="var(--accent-cyan)" />
              <span>CampusOS Backend Endpoint</span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              When connecting from a deployed web interface, configure your backend URL (e.g. your local or cloud HTTPS endpoint).
            </p>
            <form onSubmit={handleSaveApiUrl} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={customApiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000/api"
                className="input-field"
                style={{ flex: 1, fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}
              />
              <button type="submit" className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                Save
              </button>
            </form>
          </div>
        )}

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
          }}
        >
          <span>Official Portal:</span>
          <a
            href="https://www.microsoft.com/en-in/microsoft-teams/log-in"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--accent-cyan)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span>teams.microsoft.com</span>
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Status / Error feedback */}
        {error && (
          <div className="status-badge error" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.80rem', gap: '8px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', width: '100%' }}>
              <button
                type="button"
                onClick={() => setError(null)}
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
          <div className="status-badge success" style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '0.82rem', gap: '8px' }}>
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        {step && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.80rem', color: 'var(--accent-cyan)' }}>
            <RefreshCw size={13} className="animate-spin" />
            <span>{step}</span>
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
                <span>{step || 'Authenticating with Microsoft...'}</span>
              </>
            ) : (
              <span>Authenticate &amp; Link Teams</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
