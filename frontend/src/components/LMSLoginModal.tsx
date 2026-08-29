import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  X,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { CampusAPI } from '../services/api';

interface LMSLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
  initialUsername?: string;
}

export const LMSLoginModal: React.FC<LMSLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialUsername = '',
}) => {
  const [authMode, setAuthMode] = useState<'credentials' | 'cookie'>('credentials');
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState('');
  const [sessionCookie, setSessionCookie] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);

  useEffect(() => {
    if (initialUsername && !username) {
      setUsername(initialUsername);
    }
  }, [initialUsername]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      setStep('Connecting to VIT LMS (https://lms.vit.ac.in)...');

      const payload =
        authMode === 'credentials'
          ? { username: username.trim(), password: password.trim() }
          : { sessionCookie: sessionCookie.trim(), username: username.trim() || undefined };

      if (authMode === 'credentials' && (!payload.username || !payload.password)) {
        throw new Error('Please enter both your VIT LMS username/registration number and password.');
      }
      if (authMode === 'cookie' && !payload.sessionCookie) {
        throw new Error('Please enter your MoodleSession cookie value.');
      }

      setStep('Verifying authentication and matching current semester courses...');
      const res = await CampusAPI.loginLMS(payload);

      if (!res.success) {
        throw new Error(res.message || 'Authentication with VIT LMS failed.');
      }

      setStep('Synchronizing authentic assignments from enrolled subjects...');
      setSuccessMsg(res.message || 'Successfully connected to VIT LMS.');

      setTimeout(() => {
        onLoginSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
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
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: '#ffffff',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Link VIT Moodle LMS
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Institutional Coursework & Moodle Portal
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
            href="https://lms.vit.ac.in"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--brand-color)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span>lms.vit.ac.in</span>
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Segmented Auth Mode Switch */}
        <div className="segmented-tabs-bar" style={{ width: '100%' }}>
          <button
            type="button"
            className={`segmented-tab-btn ${authMode === 'credentials' ? 'active' : ''}`}
            onClick={() => setAuthMode('credentials')}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Credentials Login
          </button>
          <button
            type="button"
            className={`segmented-tab-btn ${authMode === 'cookie' ? 'active' : ''}`}
            onClick={() => setAuthMode('cookie')}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            MoodleSession Cookie
          </button>
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
          {authMode === 'credentials' ? (
            <>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  LMS Registration Number / Username
                </label>
                <input
                  type="text"
                  placeholder="e.g. 24BLC1100"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toUpperCase())}
                  className="input-field"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  LMS Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter LMS password"
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
            </>
          ) : (
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                MoodleSession Cookie Value
              </label>
              <input
                type="text"
                placeholder="Paste MoodleSession cookie value from browser devtools..."
                value={sessionCookie}
                onChange={(e) => setSessionCookie(e.target.value)}
                className="input-field"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
              />
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Login to lms.vit.ac.in in browser, press F12 $\rightarrow$ Application $\rightarrow$ Cookies $\rightarrow$ copy <code>MoodleSession</code>.
              </p>
            </div>
          )}

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
              {loading ? 'Authenticating...' : 'Connect LMS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LMSLoginModal;
