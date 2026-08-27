import React, { useState, useEffect } from 'react';
import { Lock, User, AlertCircle, CheckCircle2, Globe, ExternalLink, ShieldCheck, KeyRound } from 'lucide-react';
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

      const payload = authMode === 'credentials'
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
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
      setStep(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: '500px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 28px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'linear-gradient(180deg, rgba(14, 165, 233, 0.08) 0%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                flexShrink: 0,
              }}
            >
              🎓
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Connect VIT LMS
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                VIT Chennai Learning Management System (Moodle)
              </p>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Official Gateway Info */}
          <div
            style={{
              padding: '10px 14px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={15} color="#0284c7" />
              <span>Gateway: <b>https://lms.vit.ac.in</b></span>
            </div>
            <a
              href="https://lms.vit.ac.in/login/index.php"
              target="_blank"
              rel="noreferrer"
              style={{
                color: '#0284c7',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                textDecoration: 'none',
              }}
            >
              <span>Portal</span>
              <ExternalLink size={12} />
            </a>
          </div>

          {/* Auth Mode Tabs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              background: 'var(--bg-surface-elevated)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <button
              type="button"
              onClick={() => { setAuthMode('credentials'); setError(null); }}
              style={{
                padding: '7px',
                fontSize: '0.78rem',
                fontWeight: authMode === 'credentials' ? 800 : 600,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: authMode === 'credentials' ? 'var(--brand-color)' : 'transparent',
                color: authMode === 'credentials' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Registration Number & Password
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('cookie'); setError(null); }}
              style={{
                padding: '7px',
                fontSize: '0.78rem',
                fontWeight: authMode === 'cookie' ? 800 : 600,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: authMode === 'cookie' ? 'var(--brand-color)' : 'transparent',
                color: authMode === 'cookie' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Session Cookie (SSO)
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '12px 14px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '0.82rem',
                color: '#ef4444',
                lineHeight: 1.4,
              }}
            >
              <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <b>Authentication Failed:</b>
                <div style={{ marginTop: '2px' }}>{error}</div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div
              style={{
                padding: '12px 14px',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.84rem',
                color: '#22c55e',
                fontWeight: 700,
              }}
            >
              <CheckCircle2 size={17} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {authMode === 'credentials' ? (
            <>
              {/* Username Field */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                  }}
                >
                  Registration Number / Username
                </label>
                <div style={{ position: 'relative' }}>
                  <User
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="e.g. 24BLC1100"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 36px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                  }}
                >
                  VIT LMS Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <input
                    type="password"
                    placeholder="Enter your VIT LMS password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 36px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            /* Session Cookie Field */
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                MoodleSession Cookie Value
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '14px',
                    color: 'var(--text-muted)',
                  }}
                />
                <textarea
                  placeholder="Paste your MoodleSession cookie value from lms.vit.ac.in"
                  value={sessionCookie}
                  onChange={(e) => setSessionCookie(e.target.value)}
                  disabled={loading}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 36px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'none',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Tip: Log into lms.vit.ac.in in your browser &gt; Inspect &gt; Application &gt; Cookies &gt; copy <code>MoodleSession</code>.
              </span>
            </div>
          )}

          {/* Privacy & Accuracy Guarantee */}
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
              lineHeight: 1.45,
            }}
          >
            🔒 <b>Zero Fake Data Guarantee:</b> CampusOS connects directly with VIT LMS (Moodle). Raw passwords are never stored. Only authentic assignments and official submissions are synchronized.
          </div>

          {/* Step Indicator */}
          {loading && step && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(2, 132, 199, 0.1)',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                borderRadius: 'var(--radius-md)',
                color: '#0284c7',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid #0284c7',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span>{step}</span>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-outline"
              style={{ padding: '9px 16px', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                padding: '9px 20px',
                fontSize: '0.85rem',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: 'none',
                fontWeight: 800,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ShieldCheck size={16} />
              <span>{loading ? 'Verifying...' : 'Verify & Link LMS'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
