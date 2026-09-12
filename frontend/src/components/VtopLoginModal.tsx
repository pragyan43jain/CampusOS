import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  Lock,
  User,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { CampusAPI } from '../services/api';

interface VtopLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (data?: any) => void;
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

  const loadCaptcha = async (clearCurrent = false, preserveError = false) => {
    try {
      setLoadingCaptcha(true);
      if (!preserveError) {
        setErrorMsg('');
      }
      if (clearCurrent) {
        setCaptcha('');
      }

      const data = await CampusAPI.getVtopCaptcha('chennai');
      if (data && data.captchaImage && data.captchaImage.length > 50) {
        setSessionId(data.sessionId || '');
        setCaptchaImage(data.captchaImage);
      } else {
        throw new Error((data as any)?.message || 'VTOP did not return a valid captcha image.');
      }
    } catch (e: any) {
      setCaptchaImage('');
      setSessionId('');
      const msg = e?.message || '';
      if (!preserveError) {
        setErrorMsg(
          msg.includes('HTML instead of JSON')
            ? 'Backend API route is not reachable at this domain. Please ensure backend is running or configured.'
            : (msg || 'Could not fetch live CAPTCHA from VTOP (vtopcc.vit.ac.in). Click 🔄 to retry.')
        );
      }
    } finally {
      setLoadingCaptcha(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      setStatusStep('');
      loadCaptcha(false, false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toUpperCase();
    const cleanPassword = password;
    const cleanCaptcha = captcha.trim();

    if (!cleanUsername) {
      setErrorMsg('Please enter your VTOP Registration Number');
      return;
    }
    if (!cleanPassword) {
      setErrorMsg('Please enter your VTOP Password');
      return;
    }
    if (!cleanCaptcha) {
      setErrorMsg('Please enter the CAPTCHA characters shown in the image');
      return;
    }
    if (!sessionId) {
      setErrorMsg('No active VTOP session found. Please click 🔄 to refresh the CAPTCHA first.');
      return;
    }

    // Direct live VTOP portal verification
    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      setStatusStep('Connecting to VTOP portal (vtopcc.vit.ac.in)...');
      const response = await CampusAPI.loginVtop({
        username: cleanUsername,
        password: cleanPassword,
        captcha: cleanCaptcha,
        sessionId,
      });

      if (response && response.success) {
        setStatusStep('Extracting Timetable, Attendance & Marks...');
        setSuccessMsg(response.message || `VTOP Synchronized for ${cleanUsername}!`);
        setStatusStep('Sync Complete!');

        setTimeout(() => {
          onLoginSuccess(response.data);
          onClose();
        }, 400);
      } else {
        const msg = response?.message || '';
        const isCaptchaError = /captcha/i.test(msg) || (response as any)?.code === 1;
        const displayError = isCaptchaError
          ? '❌ Invalid CAPTCHA entered. The VTOP portal rejected the characters. A fresh CAPTCHA has been loaded below — please verify and try again.'
          : (msg || 'Authentication failed. Please check your registration number and password.');

        setErrorMsg(displayError);

        // Load new captcha while keeping the error message visible on screen
        if (isCaptchaError) {
          loadCaptcha(false, true);
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || '';
      const isCaptchaError = /captcha/i.test(errMsg);
      const displayError = isCaptchaError
        ? '❌ Invalid CAPTCHA entered. A fresh CAPTCHA has been loaded below.'
        : (errMsg || 'Network error communicating with VTOP portal.');

      setErrorMsg(displayError);
      if (isCaptchaError) {
        loadCaptcha(false, true);
      }
    } finally {
      setSubmitting(false);
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
              <h3 className="modal-title">VTOP Authentication</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                VIT Chennai (vtopcc.vit.ac.in) — Direct session synchronization
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '6px' }} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
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
              alignItems: 'flex-start',
              lineHeight: 1.4,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              overflow: 'hidden',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
              {errorMsg}
            </span>
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
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Registration Number */}
          <div className="form-group">
            <label className="form-label">Registration Number</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toUpperCase())}
                placeholder="e.g. 24BCE1234"
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
            <label className="form-label" style={{ marginBottom: '6px' }}>Verification Captcha</label>
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
                  <button
                    type="button"
                    onClick={() => loadCaptcha(true)}
                    style={{ background: 'none', border: 'none', color: '#666', fontSize: '0.72rem', cursor: 'pointer' }}
                  >
                    Click to load
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => loadCaptcha(true)}
                disabled={loadingCaptcha}
                className="btn btn-secondary"
                style={{ height: '44px', padding: '0 12px' }}
                title="Reload captcha image"
                aria-label="Refresh Captcha"
              >
                <RefreshCw size={15} className={loadingCaptcha ? 'animate-spin' : ''} />
              </button>

              <input
                type="text"
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                placeholder="Enter CAPTCHA"
                className="input-field"
                style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.95rem', letterSpacing: '1px' }}
                autoComplete="off"
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

export default VtopLoginModal;
