import React, { useState, useEffect } from 'react';
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
  const [campus, setCampus] = useState<'chennai' | 'vellore' | 'ap' | 'bhopal'>('chennai');
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

  const loadCaptcha = async (selectedCampus: string = campus) => {
    try {
      setLoadingCaptcha(true);
      setErrorMsg('');
      const data = await CampusAPI.getVtopCaptcha(selectedCampus);
      if (data) {
        setSessionId(data.sessionId);
        setCaptchaImage(data.captchaImage);
        setCaptcha(data.solvedCaptcha || '');
      }
    } catch (e: any) {
      console.warn('Captcha load failed:', e);
    } finally {
      setLoadingCaptcha(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      setStatusStep('');
      loadCaptcha(campus);
    }
  }, [isOpen, campus]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Please enter your VTOP Username / Registration Number');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your VTOP Password');
      return;
    }
    if (!captcha.trim()) {
      setErrorMsg('Please enter the captcha shown above');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      setStatusStep('Connecting to VTOP server...');
      await new Promise((r) => setTimeout(r, 200));

      setStatusStep('Authenticating & Fetching Profile...');
      const response = await CampusAPI.loginVtop({
        campus,
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
        setErrorMsg(response?.message || 'Authentication error. Please check your credentials.');
        loadCaptcha(campus);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with backend sync engine.');
      loadCaptcha(campus);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="login-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '480px',
          width: '90%',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="brand-logo-badge" style={{ width: '42px', height: '42px', fontSize: '1.2rem' }}>
              V
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>VTOP Live Sync</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Official VIT Student Portal Connector
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.4rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Status / Error / Success Alerts */}
        {errorMsg && (
          <div
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              fontSize: '0.85rem',
              color: 'var(--danger-crimson)',
              fontWeight: 600,
            }}
          >
            🚨 {errorMsg}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              background: 'var(--success-bg)',
              border: '1px solid var(--success-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              fontSize: '0.85rem',
              color: 'var(--success-emerald)',
              fontWeight: 600,
            }}
          >
            ✓ {successMsg}
          </div>
        )}

        {statusStep && submitting && (
          <div
            style={{
              background: 'var(--brand-bg)',
              border: '1px solid var(--brand-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              fontSize: '0.85rem',
              color: 'var(--brand-color)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ animation: 'spin 1s infinite linear' }}>🔄</span>
            <span>{statusStep}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Campus Selector */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Select Campus Portal
            </label>
            <select
              value={campus}
              onChange={(e) => setCampus(e.target.value as any)}
              style={{
                width: '100%',
                background: 'var(--bg-surface-elevated)',
                color: '#fff',
                border: '1px solid var(--border-medium)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            >
              <option value="chennai">VIT Chennai (vtopcc.vit.ac.in)</option>
              <option value="vellore">VIT Vellore (vtop.vit.ac.in)</option>
              <option value="ap">VIT AP (vtop2.vitap.ac.in)</option>
              <option value="bhopal">VIT Bhopal (vtop.vitbhopal.ac.in)</option>
            </select>
          </div>

          {/* Registration Number / Username */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              VTOP Registration Number / Username
            </label>
            <input
              type="text"
              placeholder="e.g. 24BLC1100"
              value={username}
              onChange={(e) => setUsername(e.target.value.toUpperCase())}
              style={{
                width: '100%',
                background: 'var(--bg-surface-elevated)',
                color: '#fff',
                border: '1px solid var(--border-medium)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.9rem',
                outline: 'none',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              VTOP Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your VTOP password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface-elevated)',
                  color: '#fff',
                  border: '1px solid var(--border-medium)',
                  padding: '10px 40px 10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {showPassword ? '👁️' : '🔒'}
              </button>
            </div>
          </div>

          {/* Captcha Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                VTOP Captcha
              </label>
              <button
                type="button"
                onClick={() => loadCaptcha(campus)}
                disabled={loadingCaptcha}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--brand-color)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {loadingCaptcha ? 'Refreshing...' : '🔄 Refresh Captcha'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {captchaImage ? (
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    border: '1px solid var(--border-medium)',
                    height: '42px',
                  }}
                >
                  <img
                    src={captchaImage}
                    alt="VTOP Captcha"
                    style={{ maxHeight: '34px', objectFit: 'contain' }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-medium)',
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {loadingCaptcha ? 'Loading Captcha...' : 'Captcha Ready'}
                </div>
              )}

              <input
                type="text"
                placeholder="Captcha text"
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--bg-surface-elevated)',
                  color: '#fff',
                  border: '1px solid var(--border-medium)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '1px',
                }}
              />
            </div>

            {captcha && (
              <span style={{ fontSize: '0.72rem', color: 'var(--success-emerald)', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                ✓ AI OCR auto-detected: <b>{captcha}</b>
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              className="btn-outline"
              onClick={onClose}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
              style={{ flex: 2, justifyContent: 'center', fontWeight: 800 }}
            >
              {submitting ? 'Authenticating...' : '🚀 Authenticate & Sync'}
            </button>
          </div>
        </form>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>
          🔐 Your credentials are used directly to authenticate with your university's official VTOP portal and sync your academic record.
        </div>
      </div>
    </div>
  );
};
