import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Lock,
  User,
  Sparkles,
} from 'lucide-react';
import { CampusAPI } from '../services/api';

interface VtopLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (syncedData?: any) => void;
}

export const VtopLoginModal: React.FC<VtopLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [captcha, setCaptcha] = useState<string>('');
  const [captchaImage, setCaptchaImage] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loadingCaptcha, setLoadingCaptcha] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusStep, setStatusStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const loadCaptcha = async () => {
    try {
      setLoadingCaptcha(true);
      setErrorMsg('');
      const data = await CampusAPI.getVtopCaptcha('chennai');
      if (data) {
        setSessionId(data.sessionId || '');
        setCaptchaImage(data.captchaImage || '');
        setCaptcha(data.solvedCaptcha || '');
      }
    } catch (e: any) {
      console.warn('Captcha load failed:', e);
      setErrorMsg('Failed to reach VTOP portal. Please retry.');
    } finally {
      setLoadingCaptcha(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      setStatusStep('');
      loadCaptcha();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Please enter your VTOP Registration Number');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your VTOP Password');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      setStatusStep('Connecting to VTOP Chennai portal...');
      await new Promise((r) => setTimeout(r, 150));

      setStatusStep('Authenticating session & solving captcha...');
      const response = await CampusAPI.loginVtop({
        username: username.trim().toUpperCase(),
        password: password,
        captcha: captcha.trim(),
        sessionId,
      });

      if (response && response.success) {
        setStatusStep('Extracting Timetable, Attendance, Marks & OD...');
        setSuccessMsg(response.message || `VTOP Synchronized for ${username.trim().toUpperCase()}!`);
        setStatusStep('Sync Complete!');

        setTimeout(() => {
          onLoginSuccess(response.data);
          onClose();
        }, 500);
      } else {
        setErrorMsg(response?.message || 'Authentication failed. Please check your registration number and password.');
        loadCaptcha();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error communicating with VTOP.');
      loadCaptcha();
    } finally {
      setSubmitting(false);
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
              <h3 className="modal-title">VTOP Authentication</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                VIT Chennai (vtopcc.vit.ac.in) — Direct session synchronization
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '4px' }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="status-badge error" style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '0.82rem', gap: '8px' }}>
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="status-badge success" style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '0.82rem', gap: '8px' }}>
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Registration Number */}
          <div className="form-group">
            <label className="form-label">Registration Number</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toUpperCase())}
                placeholder="e.g. 5196BLC1100"
                className="input-field"
                style={{ paddingLeft: '38px', fontFamily: 'var(--font-mono)' }}
                autoComplete="username"
              />
              <User
                size={16}
                style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">VTOP Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="input-field"
                style={{ paddingLeft: '38px', paddingRight: '38px' }}
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

          {/* Verification Captcha */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Verification Captcha</label>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={11} /> Auto-solved
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div
                style={{
                  height: '44px',
                  minWidth: '130px',
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-input)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  border: '1px solid var(--border-primary)',
                }}
              >
                {loadingCaptcha ? (
                  <RefreshCw size={18} className="animate-spin" color="#111" />
                ) : captchaImage ? (
                  <img
                    src={captchaImage}
                    alt="Captcha"
                    style={{ height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ fontSize: '0.74rem', color: '#666' }}>Loaded</span>
                )}
              </div>

              <button
                type="button"
                onClick={loadCaptcha}
                disabled={loadingCaptcha}
                className="btn btn-secondary"
                style={{ height: '44px', padding: '0 12px' }}
                title="Reload captcha image"
              >
                <RefreshCw size={15} className={loadingCaptcha ? 'animate-spin' : ''} />
              </button>

              <input
                type="text"
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                placeholder="Captcha text"
                className="input-field"
                style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.95rem', letterSpacing: '1px' }}
              />
            </div>
          </div>

          {statusStep && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.80rem', color: 'var(--accent-cyan)' }}>
              <RefreshCw size={13} className="animate-spin" />
              <span>{statusStep}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ width: '100%', height: '46px', marginTop: '4px' }}
          >
            {submitting ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Authenticating &amp; Syncing with VTOP...</span>
              </>
            ) : (
              <span>Authenticate &amp; Sync</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
