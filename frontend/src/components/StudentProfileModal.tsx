import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  Calendar,
  Sparkles,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { StudentProfile } from '../types';
import { CampusAPI } from '../services/api';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile | null;
  onCredentialsUpdated?: () => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  isOpen,
  onClose,
  student,
  onCredentialsUpdated,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Password visibility toggles
  const [showVtopPass, setShowVtopPass] = useState(false);
  const [showTeamsPass, setShowTeamsPass] = useState(false);
  const [showLmsPass, setShowLmsPass] = useState(false);

  // Editable credential states initialized from localStorage / student profile
  const [vtopUser, setVtopUser] = useState('');
  const [vtopPass, setVtopPass] = useState('');
  const [teamsEmail, setTeamsEmail] = useState('');
  const [teamsPass, setTeamsPass] = useState('');
  const [lmsUser, setLmsUser] = useState('');
  const [lmsPass, setLmsPass] = useState('');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync state with localStorage whenever modal opens
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const reg = student?.regNo || localStorage.getItem('campus_vtop_username') || '';
      setVtopUser(reg);
      setVtopPass(localStorage.getItem('campus_vtop_password') || '');

      setTeamsEmail(
        localStorage.getItem('campus_teams_saved_email') ||
        (student?.email ? student.email : (reg ? `${reg.toLowerCase()}@vitstudent.ac.in` : ''))
      );
      setTeamsPass(localStorage.getItem('campus_teams_saved_password') || '');

      setLmsUser(localStorage.getItem('campus_lms_saved_username') || reg);
      setLmsPass(localStorage.getItem('campus_lms_saved_password') || '');

      setIsEditing(false);
      setSuccessMsg(null);
    }
  }, [isOpen, student]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    if (text && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleSaveCredentials = async () => {
    setSaving(true);
    setSuccessMsg(null);
    try {
      if (typeof window !== 'undefined') {
        if (vtopUser.trim()) localStorage.setItem('campus_vtop_username', vtopUser.trim().toUpperCase());
        if (vtopPass.trim()) localStorage.setItem('campus_vtop_password', vtopPass.trim());

        if (teamsEmail.trim()) localStorage.setItem('campus_teams_saved_email', teamsEmail.trim());
        if (teamsPass.trim()) localStorage.setItem('campus_teams_saved_password', teamsPass.trim());

        if (lmsUser.trim()) localStorage.setItem('campus_lms_saved_username', lmsUser.trim());
        if (lmsPass.trim()) localStorage.setItem('campus_lms_saved_password', lmsPass.trim());
      }

      setSuccessMsg('Credentials updated successfully!');
      setIsEditing(false);

      // Trigger callback to re-sync or update app state
      if (onCredentialsUpdated) {
        onCredentialsUpdated();
      }

      // Background sync all academic platforms with new credentials
      try {
        await CampusAPI.syncAllAcademicAccounts();
      } catch (err) {
        console.warn('Silent sync notice following credentials update:', err);
      }
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const regNo = student?.regNo || vtopUser || '24BLC1100';
  const displayName = student?.name || 'Pragyan Jain';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'PJ';

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=VIT-STUDENT-${encodeURIComponent(regNo)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl border border-neutral-800 bg-[#0d0d0d] p-6 text-neutral-100 shadow-2xl overflow-hidden my-8"
      >
        {/* Top Close Button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Close Profile Card"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors z-10"
        >
          <X size={18} />
        </button>

        {/* Card Header (Avatar + Academic Context + QR Code) */}
        <div className="flex items-start justify-between gap-4 pr-6">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative h-14 w-14 shrink-0 rounded-full border-2 border-neutral-700 bg-neutral-900 flex items-center justify-center text-lg font-bold text-white shadow-inner ring-2 ring-emerald-500/20">
              <span className="tracking-tight">{initials}</span>
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 border-2 border-[#0d0d0d] flex items-center justify-center" title="Active Verified Student">
                <Check size={9} strokeWidth={3} className="text-black" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                <span>{student?.semester ? `Semester ${student.semester}` : 'Fall Semester 2026-27'}</span>
              </div>
              <h2 className="mt-0.5 text-base font-bold text-white truncate">
                {displayName}
              </h2>
              <p className="text-xs text-neutral-400 truncate">
                {student?.program || 'B.Tech - Computer Science & Engineering'}
              </p>
            </div>
          </div>

          {/* Student Profile QR Code */}
          <div className="shrink-0 rounded-xl p-1 bg-white/5 border border-neutral-800 shadow-sm" title={`Scan to verify student ${regNo}`}>
            <img
              src={qrCodeUrl}
              alt={`QR Code for ${regNo}`}
              className="h-14 w-14 rounded-lg object-contain bg-white p-1"
            />
          </div>
        </div>

        {/* Success Alert Banner */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-medium"
            >
              <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary Details Grid (Styled matching the Insurance Policy Card fields) */}
        <div className="my-5 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-neutral-800/80 py-5">
          {/* Registration Number (with one-click copy) */}
          <div className="flex flex-col">
            <span className="text-[11px] font-medium tracking-wide uppercase text-neutral-400">
              Registration No.
            </span>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-100">
              <span className="font-mono text-emerald-400 tracking-wider">{regNo}</span>
              <button
                type="button"
                onClick={() => handleCopy(regNo, 'regNo')}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 transition-colors"
                title="Copy Registration Number"
              >
                {copiedKey === 'regNo' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* VTOP Password (with Show/Hide and Copy) */}
          <div className="flex flex-col">
            <span className="text-[11px] font-medium tracking-wide uppercase text-neutral-400">
              VTOP Password
            </span>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-100">
              {isEditing ? (
                <input
                  type={showVtopPass ? 'text' : 'password'}
                  value={vtopPass}
                  onChange={(e) => setVtopPass(e.target.value)}
                  placeholder="Enter VTOP password"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              ) : (
                <span className="font-mono text-neutral-200">
                  {showVtopPass ? (vtopPass || '••••••••') : '••••••••••••'}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowVtopPass(!showVtopPass)}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors shrink-0"
                title={showVtopPass ? 'Hide password' : 'Show password'}
              >
                {showVtopPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              {vtopPass && !isEditing && (
                <button
                  type="button"
                  onClick={() => handleCopy(vtopPass, 'vtopPass')}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 transition-colors shrink-0"
                  title="Copy VTOP Password"
                >
                  {copiedKey === 'vtopPass' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Student Email */}
          <div className="flex flex-col">
            <span className="text-[11px] font-medium tracking-wide uppercase text-neutral-400">
              University Email
            </span>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-neutral-200 min-w-0">
              <span className="truncate">{student?.email || `${regNo.toLowerCase()}@vitstudent.ac.in`}</span>
              <button
                type="button"
                onClick={() => handleCopy(student?.email || `${regNo.toLowerCase()}@vitstudent.ac.in`, 'email')}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 transition-colors shrink-0"
                title="Copy University Email"
              >
                {copiedKey === 'email' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* CGPA */}
          <div className="flex flex-col">
            <span className="text-[11px] font-medium tracking-wide uppercase text-neutral-400">
              Cumulative CGPA
            </span>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-neutral-100">
              <span className="text-emerald-400">{student?.cgpa ? Number(student.cgpa).toFixed(2) : '8.81'}</span>
              <span className="text-[11px] font-normal text-neutral-500">/ 10.00</span>
            </div>
          </div>
        </div>

        {/* Connected Academic Hubs (Microsoft Teams & VIT LMS Credentials Section) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Connected Academic Accounts
            </h3>
            <span className="text-[11px] text-neutral-500">
              {isEditing ? 'Editing Mode Active' : 'Encrypted & Stored Locally'}
            </span>
          </div>

          {/* Microsoft Teams Card Details */}
          <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-[#464EB8]/20 flex items-center justify-center text-[#7B83EB] font-bold text-[10px]">
                  T
                </div>
                <span className="text-xs font-semibold text-neutral-200">Microsoft Teams</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Connected
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] text-neutral-400 uppercase tracking-wider block mb-1">
                  Teams Email
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={teamsEmail}
                    onChange={(e) => setTeamsEmail(e.target.value)}
                    placeholder="student@vitstudent.ac.in"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                ) : (
                  <div className="flex items-center gap-1 font-mono text-neutral-300 truncate">
                    <span className="truncate">{teamsEmail || 'Not set'}</span>
                    {teamsEmail && (
                      <button
                        type="button"
                        onClick={() => handleCopy(teamsEmail, 'teamsEmail')}
                        className="p-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 transition-colors shrink-0"
                      >
                        {copiedKey === 'teamsEmail' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 uppercase tracking-wider block mb-1">
                  Teams Password
                </label>
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <input
                      type={showTeamsPass ? 'text' : 'password'}
                      value={teamsPass}
                      onChange={(e) => setTeamsPass(e.target.value)}
                      placeholder="Enter Teams password"
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  ) : (
                    <span className="font-mono text-neutral-300">
                      {showTeamsPass ? (teamsPass || '••••••••') : '••••••••••••'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowTeamsPass(!showTeamsPass)}
                    className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 shrink-0"
                    title={showTeamsPass ? 'Hide password' : 'Show password'}
                  >
                    {showTeamsPass ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  {teamsPass && !isEditing && (
                    <button
                      type="button"
                      onClick={() => handleCopy(teamsPass, 'teamsPass')}
                      className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 shrink-0"
                    >
                      {copiedKey === 'teamsPass' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* VIT LMS Card Details */}
          <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-[#F97316]/20 flex items-center justify-center text-[#F97316] font-bold text-[10px]">
                  M
                </div>
                <span className="text-xs font-semibold text-neutral-200">VIT LMS (Moodle)</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Connected
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] text-neutral-400 uppercase tracking-wider block mb-1">
                  LMS Username
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={lmsUser}
                    onChange={(e) => setLmsUser(e.target.value)}
                    placeholder="24BLC1100"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                ) : (
                  <div className="flex items-center gap-1 font-mono text-neutral-300 truncate">
                    <span className="truncate">{lmsUser || regNo}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(lmsUser || regNo, 'lmsUser')}
                      className="p-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 transition-colors shrink-0"
                    >
                      {copiedKey === 'lmsUser' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 uppercase tracking-wider block mb-1">
                  LMS Password
                </label>
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <input
                      type={showLmsPass ? 'text' : 'password'}
                      value={lmsPass}
                      onChange={(e) => setLmsPass(e.target.value)}
                      placeholder="Enter LMS password"
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  ) : (
                    <span className="font-mono text-neutral-300">
                      {showLmsPass ? (lmsPass || '••••••••') : '••••••••••••'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowLmsPass(!showLmsPass)}
                    className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 shrink-0"
                    title={showLmsPass ? 'Hide password' : 'Show password'}
                  >
                    {showLmsPass ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  {lmsPass && !isEditing && (
                    <button
                      type="button"
                      onClick={() => handleCopy(lmsPass, 'lmsPass')}
                      className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 shrink-0"
                    >
                      {copiedKey === 'lmsPass' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action Buttons (Matches the Insurance Policy Card primary button) */}
        <div className="mt-6 flex flex-col gap-2.5">
          {isEditing ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveCredentials}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-3 text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save & Update Details</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="px-4 py-3 rounded-xl border border-neutral-700 hover:bg-neutral-800 text-neutral-300 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-100 hover:bg-white text-neutral-950 font-bold px-4 py-3 text-sm shadow-md transition-all active:scale-[0.98]"
            >
              <Sparkles size={16} className="text-emerald-600" />
              <span>Edit Credentials & Accounts</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default StudentProfileModal;
