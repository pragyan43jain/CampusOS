import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
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
      setErrorMsg('Please enter your VTOP Registration Number');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your VTOP Password');
      return;
    }
    if (!captcha.trim()) {
      setErrorMsg('Please enter the captcha shown');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      setStatusStep('Connecting to VTOP portal...');
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
      setErrorMsg(err.message || 'Network error communicating with VTOP.');
      loadCaptcha(campus);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-icon-box" style={{ width: '38px', height: '38px' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                VTOP Authentication
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Direct student session synchronization
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-outline btn-sm" style={{ padding: '6px' }} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
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
            <span>{errorMsg}</span>
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

        {statusStep && !errorMsg && !successMsg && (
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
            <span>{statusStep}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Campus Portal
            </label>
            <select
              value={campus}
              onChange={(e) => setCampus(e.target.value as any)}
              className="select-dropdown"
              style={{ width: '100%' }}
            >
              <option value="chennai">VIT Chennai (vtopcc.vit.ac.in)</option>
              <option value="vellore">VIT Vellore (vtop.vit.ac.in)</option>
              <option value="ap">VIT AP (vtop2.vitap.ac.in)</option>
              <option value="bhopal">VIT Bhopal (vtop.vitbhopal.ac.in)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              VTOP Username / Reg No
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
              VTOP Password
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

          {/* Captcha */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Captcha Security
              </label>
              <button
                type="button"
                onClick={() => loadCaptcha(campus)}
                disabled={loadingCaptcha}
                style={{ fontSize: '0.74rem', color: 'var(--brand-color)', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RefreshCw size={12} className={loadingCaptcha ? 'animate-spin' : ''} />
                <span>Reload</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {captchaImage ? (
                <img
                  src={captchaImage.startsWith('data:') ? captchaImage : `data:image/png;base64,${captchaImage}`}
                  alt="Captcha"
                  style={{
                    height: '42px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    background: '#ffffff',
                    padding: '2px 6px',
                  }}
                />
              ) : (
                <div style={{ height: '42px', width: '120px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Loading...
                </div>
              )}

              <input
                type="text"
                placeholder="Enter text"
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                className="input-field"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
              />
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
              disabled={submitting}
              className="btn btn-primary"
              style={{ flex: 2 }}
            >
              {submitting ? 'Connecting VTOP...' : 'Authenticate & Sync'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VtopLoginModal;
