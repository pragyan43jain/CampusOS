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
} from 'lucide-react';
import { CampusAPI } from '../services/api';

interface TeamsLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
  initialEmail?: string;
}

export const TeamsLoginModal: React.FC<TeamsLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);

  useEffect(() => {
    if (initialEmail && !email) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your university Microsoft email address.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your Microsoft 365 password.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setStep('Verifying university tenant & authenticating with Microsoft Online...');

    try {
      const res = await CampusAPI.loginTeams(email.trim(), password.trim());

      if (!res.success) {
        throw new Error(res.message || 'Authentication failed. Please check your credentials.');
      }

      setStep('Synchronizing class coursework & assignments...');
      setSuccessMsg('Successfully authenticated with Microsoft Teams.');

      setTimeout(() => {
        onLoginSuccess();
        onClose();
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate with Microsoft Teams.');
    } finally {
      setLoading(false);
      setStep(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content-glass" onClick={(e) => e.stopPropagation()}>
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

          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '4px' }} aria-label="Close">
            <X size={18} />
          </button>
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
          <div className="status-badge error" style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '0.82rem', gap: '8px' }}>
            <AlertCircle size={15} />
            <span>{error}</span>
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
                placeholder="Enter password"
                className="input-field"
                style={{ paddingLeft: '38px', paddingRight: '38px' }}
                disabled={loading}
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
                <span>Verifying Microsoft Account...</span>
              </>
            ) : (
              <span>Authenticate & Link Teams</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
