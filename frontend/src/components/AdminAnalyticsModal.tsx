import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  Users,
  Activity,
  Calendar,
  Clock,
  RefreshCw,
  BarChart3,
  TrendingUp,
  KeyRound,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { CampusAnalytics } from '../services/analytics';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface AdminAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentRegNo?: string;
}

export const AdminAnalyticsModal: React.FC<AdminAnalyticsModalProps> = ({
  isOpen,
  onClose,
  studentRegNo,
}) => {
  useLockBodyScroll(isOpen);
  const [adminKey, setAdminKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.sessionStorage.getItem('campusos_admin_key') || '';
    }
    return '';
  });
  const [keyInput, setKeyInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'users' | 'activity'>('overview');

  const fetchAnalytics = async (keyToUse: string) => {
    if (!keyToUse && !studentRegNo) {
      setError('Please provide an Admin Authorization Key.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const summary = await CampusAnalytics.getAdminSummary(keyToUse);
      setData(summary);
      if (typeof window !== 'undefined' && keyToUse) {
        window.sessionStorage.setItem('campusos_admin_key', keyToUse);
      }
      setAdminKey(keyToUse);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin analytics. Please verify your admin key.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (adminKey) {
        fetchAnalytics(adminKey);
      } else {
        // Try requesting with regNo header directly if user is an authorized admin
        fetchAnalytics('');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden overscroll-contain"
        onWheel={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card, #121826)',
          borderColor: 'var(--border-subtle, rgba(255,255,255,0.1))',
          color: 'var(--text-primary, #ffffff)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border-subtle, rgba(255,255,255,0.08))' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">CampusOS Admin Telemetry & Analytics</h2>
              <p className="text-xs text-slate-400">Live Supabase Database Insights & Feature Usage</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Input if not authorized or error */}
          {(!data || error) && (
            <div
              className="p-5 rounded-xl border flex flex-col gap-3"
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderColor: 'var(--border-subtle, rgba(255,255,255,0.1))',
              }}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-400">
                <KeyRound size={16} />
                <span>Admin Passkey Authentication</span>
              </div>
              <p className="text-xs text-slate-400">
                To inspect student adoption and feature telemetry, enter the configured{' '}
                <code className="px-1 py-0.5 rounded bg-white/10 text-indigo-300">CAMPUSOS_ADMIN_KEY</code>:
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Enter admin authorization key..."
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-black/40 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') fetchAnalytics(keyInput);
                  }}
                />
                <button
                  onClick={() => fetchAnalytics(keyInput)}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <RefreshCw size={14} className="animate-spin" />}
                  Verify & Unlock
                </button>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-xs text-rose-400 mt-1">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {data && (
            <>
              {/* Navigation Tabs */}
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
                <div className="flex gap-2">
                  {[
                    { id: 'overview', label: 'Overview', icon: BarChart3 },
                    { id: 'features', label: 'Feature Usage', icon: Activity },
                    { id: 'users', label: 'Students', icon: Users },
                    { id: 'activity', label: 'Event Feed', icon: Clock },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Icon size={14} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => fetchAnalytics(adminKey || keyInput)}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Top Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Total Users</span>
                        <Users size={14} />
                      </div>
                      <div className="text-2xl font-bold text-white">{data.totalUsers || 0}</div>
                      <div className="text-[10px] text-emerald-400 mt-1">Verified student profiles</div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Active Today</span>
                        <Activity size={14} />
                      </div>
                      <div className="text-2xl font-bold text-indigo-400">{data.activeToday || 0}</div>
                      <div className="text-[10px] text-slate-400 mt-1">DAU (past 24h)</div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Active 7 Days</span>
                        <TrendingUp size={14} />
                      </div>
                      <div className="text-2xl font-bold text-cyan-400">{data.activeLast7Days || 0}</div>
                      <div className="text-[10px] text-slate-400 mt-1">WAU (past 7 days)</div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Active 30 Days</span>
                        <Calendar size={14} />
                      </div>
                      <div className="text-2xl font-bold text-amber-400">{data.activeLast30Days || 0}</div>
                      <div className="text-[10px] text-slate-400 mt-1">MAU (past 30 days)</div>
                    </div>
                  </div>

                  {/* Growth & New Users */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                        New Registrations
                      </h3>
                      <div className="flex items-center justify-around py-2">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-emerald-400">
                            +{data.newUsersLast7Days || 0}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">Last 7 Days</div>
                        </div>
                        <div className="w-px h-10 bg-white/10" />
                        <div className="text-center">
                          <div className="text-2xl font-bold text-emerald-400">
                            +{data.newUsersLast30Days || 0}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">Last 30 Days</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                        Database Telemetry Status
                      </h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Supabase Engine</span>
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 size={12} /> Connected
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Identity Mode</span>
                          <span className="text-slate-200">VTOP Registration Number</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Last Telemetry Run</span>
                          <span className="text-slate-400">
                            {data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : 'Just now'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Daily Active Users Table */}
                  {data.dailyActiveUsers && data.dailyActiveUsers.length > 0 && (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                        Daily Active Student Trend
                      </h3>
                      <div className="flex items-end gap-2 h-28 pt-4 overflow-x-auto">
                        {data.dailyActiveUsers.map((d: any, idx: number) => {
                          const heightPct = Math.max(15, Math.min(100, (d.active_users / (data.activeToday || 1)) * 100));
                          return (
                            <div key={idx} className="flex-1 min-w-[32px] flex flex-col items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-mono">{d.active_users}</span>
                              <div
                                className="w-full rounded-t bg-indigo-500 hover:bg-indigo-400 transition-all"
                                style={{ height: `${heightPct}%` }}
                                title={`${d.date}: ${d.active_users} active student(s)`}
                              />
                              <span className="text-[9px] text-slate-500">{d.date.slice(5)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: FEATURE USAGE */}
              {activeTab === 'features' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                      Feature Usage & Interaction Volume
                    </h3>
                    <div className="space-y-2">
                      {(data.featureUsage || []).map((f: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-black/20 border border-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-slate-500 w-5">#{idx + 1}</span>
                            <div>
                              <div className="text-sm font-medium text-white">{f.event_name}</div>
                              <div className="text-[10px] text-slate-400">
                                {f.unique_users} unique student(s) • Last active{' '}
                                {f.last_triggered_at ? new Date(f.last_triggered_at).toLocaleTimeString() : 'Recently'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-semibold font-mono">
                              {f.count} hits
                            </span>
                          </div>
                        </div>
                      ))}
                      {(!data.featureUsage || data.featureUsage.length === 0) && (
                        <div className="text-center py-8 text-xs text-slate-500">
                          No feature events recorded yet. Events will appear as students use features.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: REGISTERED USERS */}
              {activeTab === 'users' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                      Registered Student Profiles ({data.recentUsers?.length || 0})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400 font-medium">
                            <th className="pb-2">Reg No</th>
                            <th className="pb-2">Name</th>
                            <th className="pb-2">Branch / Program</th>
                            <th className="pb-2">CGPA</th>
                            <th className="pb-2">Last Active</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {(data.recentUsers || []).map((u: any, idx: number) => (
                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                              <td className="py-2.5 font-mono font-semibold text-indigo-400">{u.reg_no}</td>
                              <td className="py-2.5 text-slate-200">{u.name || 'Student'}</td>
                              <td className="py-2.5 text-slate-400">{u.branch || u.program || '-'}</td>
                              <td className="py-2.5 font-mono text-emerald-400">{u.cgpa ? Number(u.cgpa).toFixed(2) : '-'}</td>
                              <td className="py-2.5 text-slate-400">
                                {u.last_active_at ? new Date(u.last_active_at).toLocaleString() : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(!data.recentUsers || data.recentUsers.length === 0) && (
                        <div className="text-center py-8 text-xs text-slate-500">
                          No students recorded yet. Student profiles sync automatically upon VTOP login.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: RECENT ACTIVITY */}
              {activeTab === 'activity' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                      Live Telemetry Stream (Latest 50 Events)
                    </h3>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {(data.recentActivity || []).map((a: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/5 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-indigo-400">{a.reg_no}</span>
                            <span className="text-slate-300 font-medium">{a.event_name}</span>
                            {a.page && <span className="text-slate-500 font-mono">({a.page})</span>}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {a.created_at ? new Date(a.created_at).toLocaleTimeString() : ''}
                          </span>
                        </div>
                      ))}
                      {(!data.recentActivity || data.recentActivity.length === 0) && (
                        <div className="text-center py-8 text-xs text-slate-500">
                          No recent telemetry records found.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
