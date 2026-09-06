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
  User,
  Lock,
} from 'lucide-react';
import { CampusAPI } from '../services/api';

interface LMSLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (data?: any) => void;
  onLoginFailure?: (errorMsg: string) => void;
  initialRegNo?: string;
  initialUsername?: string;
}

export const LMSLoginModal: React.FC<LMSLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onLoginFailure,
  initialRegNo = '',
  initialUsername = '',
}) => {
  const initialVal = initialRegNo || initialUsername;
  const [campus, setCampus] = useState<'chennai' | 'vellore'>('chennai');
  const [loginMode, setLoginMode] = useState<'credentials' | 'session_cookie'>('credentials');
  const [username, setUsername] = useState(initialVal);
  const [password, setPassword] = useState('');
  const [sessionCookie, setSessionCookie] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);

  useEffect(() => {
    if (initialVal && !username) {
      setUsername(initialVal);
    }
  }, [initialVal]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMode === 'credentials') {
      if (!username.trim()) {
        setError('Please enter your university Registration Number.');
        return;
      }
      if (!password.trim()) {
        setError('Please enter your LMS / Moodle password.');
        return;
      }
    } else {
      if (!sessionCookie.trim()) {
        setError('Please paste your active MoodleSession cookie value.');
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setStep('Connecting to university Moodle LMS server...');

    try {
      const res = await CampusAPI.loginLMS({
        username: loginMode === 'credentials' ? username.trim().toUpperCase() : undefined,
        password: loginMode === 'credentials' ? password.trim() : undefined,
        sessionCookie: loginMode === 'session_cookie' ? sessionCookie.trim() : undefined,
        campus: campus,
      });

      if (!res.success) {
        throw new Error(res.message || 'LMS authentication failed.');
      }

      setStep('Parsing course modules, submissions & deadline logs...');
      setSuccessMsg('Successfully linked VIT Moodle LMS.');

      setTimeout(() => {
        onLoginSuccess(res);
        onClose();
      }, 800);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to authenticate with LMS.';
      setError(errMsg);
      onLoginFailure?.(errMsg);
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
              <h3 className="modal-title">Link Moodle LMS</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                VIT Chennai Moodle Learning Management System
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
            href="https://lms.vit.ac.in"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--accent-cyan)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span>lms.vit.ac.in</span>
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
            <label className="form-label">Campus</label>
            <select
              value={campus}
              onChange={(e) => setCampus(e.target.value as any)}
              className="input-field"
            >
              <option value="chennai">VIT Chennai (lmscc.vit.ac.in)</option>
              <option value="vellore">VIT Vellore (lms.vit.ac.in)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setLoginMode('credentials')}
              className={`btn btn-sm ${loginMode === 'credentials' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
            >
              Direct Login
            </button>
            <button
              type="button"
              onClick={() => setLoginMode('session_cookie')}
              className={`btn btn-sm ${loginMode === 'session_cookie' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
            >
              Moodle Cookie
            </button>
          </div>

          {loginMode === 'credentials' ? (
            <>
              <div className="form-group">
                <label className="form-label">Registration Number</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toUpperCase())}
                    placeholder="e.g. 24BLC1100"
                    className="input-field"
                    style={{ paddingLeft: '38px', fontFamily: 'var(--font-mono)' }}
                    disabled={loading}
                  />
                  <User
                    size={16}
                    style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">LMS Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter LMS password"
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
            </>
          ) : (
            <div className="form-group">
              <label className="form-label">MoodleSession Cookie Value</label>
              <textarea
                value={sessionCookie}
                onChange={(e) => setSessionCookie(e.target.value)}
                placeholder="Paste active MoodleSession cookie value..."
                className="input-field"
                style={{ height: '80px', padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
                disabled={loading}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', height: '46px', marginTop: '4px' }}
          >
            {loading ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Linking Moodle LMS...</span>
              </>
            ) : (
              <span>Authenticate & Link LMS</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
