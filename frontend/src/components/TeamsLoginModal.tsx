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
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate with Microsoft Teams.');
    } finally {
      setLoading(false);
      setStep(null);
    }
  };

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              className="brand-icon-box"
              style={{
                width: '38px',
                height: '38px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#ffffff',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Link Microsoft Teams
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                University Microsoft 365 Education
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-outline btn-sm" style={{ padding: '6px' }} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Portal info badge */}
        <div
          style={{
            padding: '8px 12px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
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
            style={{ color: 'var(--brand-color)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span>microsoft.com/.../log-in</span>
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Status / Error feedback */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger-crimson)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--success-bg)',
              border: '1px solid var(--success-border)',
              color: 'var(--success-emerald)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {step && !error && !successMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-bg)',
              border: '1px solid var(--brand-border)',
              color: 'var(--brand-color)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <RefreshCw size={14} className="animate-spin" />
            <span>{step}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              University Microsoft Email
            </label>
            <input
              type="email"
              placeholder="e.g. pragyan.jain2024@vitstudent.ac.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Microsoft 365 Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ flex: 2 }}
            >
              {loading ? 'Authenticating...' : 'Connect Teams'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeamsLoginModal;
