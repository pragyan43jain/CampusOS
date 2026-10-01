import React, { useState } from 'react';
import {
  TrendingUp,
  Users,
  Handshake,
  DollarSign,
  Search,
  Bell,
  Home,
  Building2,
  CheckSquare,
  FileText,
  Settings,
  ChevronDown,
  Check,
  Phone,
  Mail,
} from 'lucide-react';

export interface CrmDashboardProps {
  className?: string;
}

export const CrmDashboard: React.FC<CrmDashboardProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'contacts' | 'companies' | 'deals' | 'tasks' | 'reports' | 'settings'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('Last 6 months');

  return (
    <div
      className={`w-full rounded-2xl border border-gray-800/80 bg-[#0c0e14] text-white shadow-2xl overflow-hidden font-sans ${className}`}
    >
      <div className="flex flex-col md:flex-row min-h-[640px]">
        {/* Left Sidebar */}
        <aside className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-gray-800/70 bg-[#090b0f] p-4 flex flex-col justify-between">
          <div>
            {/* Sidebar Brand Header */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 mb-6">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-white/10 text-white">
                <TrendingUp size={15} />
              </div>
              <span className="font-semibold text-sm tracking-tight text-white">CRM Studio</span>
            </div>

            {/* Sidebar Nav Items */}
            <nav className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-gray-800/70 text-white border border-gray-700/60 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                }`}
              >
                <Home size={15} />
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('contacts')}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'contacts'
                    ? 'bg-gray-800/70 text-white border border-gray-700/60 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                }`}
              >
                <Users size={15} />
                <span>Contacts</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('companies')}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'companies'
                    ? 'bg-gray-800/70 text-white border border-gray-700/60 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                }`}
              >
                <Building2 size={15} />
                <span>Companies</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('deals')}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'deals'
                    ? 'bg-gray-800/70 text-white border border-gray-700/60 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                }`}
              >
                <Handshake size={15} />
                <span>Deals</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tasks')}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'tasks'
                    ? 'bg-gray-800/70 text-white border border-gray-700/60 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                }`}
              >
                <CheckSquare size={15} />
                <span>Tasks</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'reports'
                    ? 'bg-gray-800/70 text-white border border-gray-700/60 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                }`}
              >
                <FileText size={15} />
                <span>Reports</span>
              </button>
            </nav>
          </div>

          {/* Bottom Settings Link */}
          <div className="pt-4 border-t border-gray-800/60 mt-6">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full ${
                activeTab === 'settings'
                  ? 'bg-gray-800/70 text-white border border-gray-700/60'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
              }`}
            >
              <Settings size={15} />
              <span>Settings</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-5 md:p-6 bg-[#0c0e14] overflow-y-auto">
          {/* Header Row: Title & Search/Notifications */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Dashboard</h1>
              <p className="text-xs text-gray-400 mt-0.5">Welcome back, John! Here's what's happening today.</p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-48 sm:w-56 bg-gray-900/80 border border-gray-800/90 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
                />
              </div>

              {/* Notification Icon */}
              <div className="relative p-2 rounded-lg bg-gray-900/80 border border-gray-800/90 text-gray-400 hover:text-white cursor-pointer transition-colors">
                <Bell size={15} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-[#0c0e14]" />
              </div>
            </div>
          </div>

          {/* Row 1: 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {/* Card 1: Total Contacts */}
            <div className="card-hover bg-[#12141c] border border-gray-800/80 rounded-xl p-4 transition-all duration-300 hover:border-[#ff2bd6] hover:shadow-[0_0_25px_rgba(255,43,214,0.35)] flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs text-gray-400 font-medium">Total Contacts</span>
                  <div className="text-2xl font-bold text-white mt-1">2,847</div>
                </div>
                <div className="p-2 rounded-lg bg-gray-800/60 text-gray-300">
                  <Users size={16} />
                </div>
              </div>
              <div className="text-xs text-emerald-400 font-medium mt-3">+12% from last month</div>
            </div>

            {/* Card 2: Active Deals */}
            <div className="card-hover bg-[#12141c] border border-gray-800/80 rounded-xl p-4 transition-all duration-300 hover:border-[#ff2bd6] hover:shadow-[0_0_25px_rgba(255,43,214,0.35)] flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs text-gray-400 font-medium">Active Deals</span>
                  <div className="text-2xl font-bold text-white mt-1">127</div>
                </div>
                <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
                  <Handshake size={16} />
                </div>
              </div>
              <div className="text-xs text-emerald-400 font-medium mt-3">+8% from last month</div>
            </div>

            {/* Card 3: Revenue */}
            <div className="card-hover bg-[#12141c] border border-gray-800/80 rounded-xl p-4 transition-all duration-300 hover:border-[#ff2bd6] hover:shadow-[0_0_25px_rgba(255,43,214,0.35)] flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs text-gray-400 font-medium">Revenue</span>
                  <div className="text-2xl font-bold text-white mt-1">$847K</div>
                </div>
                <div className="p-2 rounded-lg bg-purple-950/60 border border-purple-800/40 text-purple-400">
                  <DollarSign size={16} />
                </div>
              </div>
              <div className="text-xs text-rose-400 font-medium mt-3">-3% from last month</div>
            </div>

            {/* Card 4: Conversion Rate */}
            <div className="card-hover bg-[#12141c] border border-gray-800/80 rounded-xl p-4 transition-all duration-300 hover:border-[#ff2bd6] hover:shadow-[0_0_25px_rgba(255,43,214,0.35)] flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs text-gray-400 font-medium">Conversion Rate</span>
                  <div className="text-2xl font-bold text-white mt-1">24.3%</div>
                </div>
                <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-800/40 text-amber-400">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div className="text-xs text-emerald-400 font-medium mt-3">+5% from last month</div>
            </div>
          </div>

          {/* Row 2: Revenue Overview & Deal Pipeline Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            {/* Chart 1: Revenue Overview Area Chart */}
            <div className="card-hover bg-[#12141c] border border-gray-800/80 rounded-xl p-5 transition-all duration-300 hover:border-[#ff2bd6] hover:shadow-[0_0_25px_rgba(255,43,214,0.35)] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">Revenue Overview</h2>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setTimeRange((prev) => (prev === 'Last 6 months' ? 'Last 30 days' : prev === 'Last 30 days' ? 'This Year' : 'Last 6 months'));
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-300 bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 rounded-md transition-colors cursor-pointer"
                  >
                    <span>{timeRange}</span>
                    <ChevronDown size={13} className="text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Area Chart SVG */}
              <div className="w-full h-44 relative">
                <svg viewBox="0 0 460 170" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="crmRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines & Y-Axis */}
                  <line x1="35" y1="20" x2="450" y2="20" stroke="#1f2430" strokeDasharray="3 3" />
                  <text x="5" y="24" fill="#64748b" fontSize="10" fontFamily="sans-serif">200</text>

                  <line x1="35" y1="55" x2="450" y2="55" stroke="#1f2430" strokeDasharray="3 3" />
                  <text x="5" y="59" fill="#64748b" fontSize="10" fontFamily="sans-serif">150</text>

                  <line x1="35" y1="90" x2="450" y2="90" stroke="#1f2430" strokeDasharray="3 3" />
                  <text x="5" y="94" fill="#64748b" fontSize="10" fontFamily="sans-serif">100</text>

                  <line x1="35" y1="125" x2="450" y2="125" stroke="#1f2430" strokeDasharray="3 3" />
                  <text x="10" y="129" fill="#64748b" fontSize="10" fontFamily="sans-serif">50</text>

                  <line x1="35" y1="150" x2="450" y2="150" stroke="#252b3b" />
                  <text x="15" y="153" fill="#64748b" fontSize="10" fontFamily="sans-serif">0</text>

                  {/* Gradient Area Fill */}
                  <path
                    d="M 45,78 L 125,66 L 205,55 L 285,62 L 365,42 L 445,28 L 445,150 L 45,150 Z"
                    fill="url(#crmRevenueGrad)"
                  />

                  {/* Line Curve */}
                  <path
                    d="M 45,78 L 125,66 L 205,55 L 285,62 L 365,42 L 445,28"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Data Points */}
                  <circle cx="45" cy="78" r="3.5" fill="#ffffff" stroke="#12141c" strokeWidth="2" />
                  <circle cx="125" cy="66" r="3.5" fill="#ffffff" stroke="#12141c" strokeWidth="2" />
                  <circle cx="205" cy="55" r="3.5" fill="#ffffff" stroke="#12141c" strokeWidth="2" />
                  <circle cx="285" cy="62" r="3.5" fill="#ffffff" stroke="#12141c" strokeWidth="2" />
                  <circle cx="365" cy="42" r="3.5" fill="#ffffff" stroke="#12141c" strokeWidth="2" />
                  <circle cx="445" cy="28" r="4" fill="#ffffff" stroke="#12141c" strokeWidth="2" />
                </svg>

                {/* X-Axis Month Labels */}
                <div className="flex justify-between pl-8 pr-3 text-[11px] text-gray-500 mt-1">
                  <span>Jan</span>
                  <span>Feb</span>
                  <span>Mar</span>
                  <span>Apr</span>
                  <span>May</span>
                  <span>Jun</span>
                </div>
              </div>
            </div>

            {/* Chart 2: Deal Pipeline Donut Chart */}
            <div className="card-hover bg-[#12141c] border border-gray-800/80 rounded-xl p-5 transition-all duration-300 hover:border-[#ff2bd6] hover:shadow-[0_0_25px_rgba(255,43,214,0.35)] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-white">Deal Pipeline</h2>
                <a href="#pipeline" className="text-xs text-gray-400 hover:text-white transition-colors">
                  View All
                </a>
              </div>

              {/* Donut Chart with Callout Labels */}
              <div className="relative w-full h-52 flex items-center justify-center">
                <svg viewBox="0 0 340 220" className="w-full h-full overflow-visible">
                  {/*
                    Donut Radius = 44, Circumference = 2 * PI * 44 = 276.46
                    Segments:
                    - Qualified: 45% -> 124.4, color #10b981 (mint green)
                    - Proposal: 25% -> 69.1, color #d1d5db (light gray)
                    - Negotiation: 20% -> 55.3, color #fb923c (orange)
                    - Closed: 10% -> 27.6, color #f87171 (coral red)
                  */}
                  <g transform="translate(170, 110)">
                    {/* Qualified: 45% (starts top right at -45 deg) */}
                    <circle
                      cx="0"
                      cy="0"
                      r="44"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="24"
                      strokeDasharray="124.4 276.5"
                      strokeDashoffset="0"
                      transform="rotate(-50)"
                    />
                    {/* Proposal: 25% (starts bottom right) */}
                    <circle
                      cx="0"
                      cy="0"
                      r="44"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="24"
                      strokeDasharray="69.1 276.5"
                      strokeDashoffset="-124.4"
                      transform="rotate(-50)"
                    />
                    {/* Negotiation: 20% (starts left) */}
                    <circle
                      cx="0"
                      cy="0"
                      r="44"
                      fill="none"
                      stroke="#fb923c"
                      strokeWidth="24"
                      strokeDasharray="55.3 276.5"
                      strokeDashoffset="-193.5"
                      transform="rotate(-50)"
                    />
                    {/* Closed: 10% (top left) */}
                    <circle
                      cx="0"
                      cy="0"
                      r="44"
                      fill="none"
                      stroke="#f87171"
                      strokeWidth="24"
                      strokeDasharray="27.6 276.5"
                      strokeDashoffset="-248.8"
                      transform="rotate(-50)"
                    />
                  </g>

                  {/* Connectors and Labels */}
                  {/* 1. Closed: 10.0% (top) */}
                  <polyline points="152,65 145,35 125,35" fill="none" stroke="#475569" strokeWidth="1" />
                  <text x="120" y="38" textAnchor="end" fill="#f87171" fontSize="10" fontWeight="600">
                    Closed: 10.0%
                  </text>

                  {/* 2. Qualified: 45.0% (right) */}
                  <polyline points="220,110 240,110 260,110" fill="none" stroke="#475569" strokeWidth="1" />
                  <text x="265" y="113" fill="#10b981" fontSize="10" fontWeight="600">
                    Qualified: 45.0%
                  </text>

                  {/* 3. Negotiation: 20.0% (left) */}
                  <polyline points="120,105 100,105 80,105" fill="none" stroke="#475569" strokeWidth="1" />
                  <text x="75" y="108" textAnchor="end" fill="#fb923c" fontSize="10" fontWeight="600">
                    Negotiation: 20.0%
                  </text>

                  {/* 4. Proposal: 25.0% (bottom left) */}
                  <polyline points="150,155 140,185 110,185" fill="none" stroke="#475569" strokeWidth="1" />
                  <text x="105" y="188" textAnchor="end" fill="#e2e8f0" fontSize="10" fontWeight="600">
                    Proposal: 25.0%
                  </text>
                </svg>
              </div>
            </div>
          </div>

          {/* Row 3: Recent Contacts & Recent Activities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Box 1: Recent Contacts */}
            <div className="card-hover bg-[#12141c] border border-gray-800/80 rounded-xl p-5 transition-all duration-300 hover:border-[#ff2bd6] hover:shadow-[0_0_25px_rgba(255,43,214,0.35)] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">Recent Contacts</h2>
                <a href="#contacts" className="text-xs text-gray-400 hover:text-white transition-colors">
                  View All
                </a>
              </div>

              <div className="flex flex-col gap-3">
                {/* Contact 1 */}
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <img
                      src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80"
                      alt="Sarah Johnson"
                      className="w-9 h-9 rounded-full object-cover ring-1 ring-gray-700"
                    />
                    <div>
                      <div className="text-xs font-semibold text-white">Sarah Johnson</div>
                      <div className="text-[11px] text-gray-400">sarah@company.com</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                    Hot Lead
                  </span>
                </div>

                {/* Contact 2 */}
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
                      alt="Mike Chen"
                      className="w-9 h-9 rounded-full object-cover ring-1 ring-gray-700"
                    />
                    <div>
                      <div className="text-xs font-semibold text-white">Mike Chen</div>
                      <div className="text-[11px] text-gray-400">mike@startup.io</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/40">
                    Warm
                  </span>
                </div>
              </div>
            </div>

            {/* Box 2: Recent Activities */}
            <div className="card-hover bg-[#12141c] border border-gray-800/80 rounded-xl p-5 transition-all duration-300 hover:border-[#ff2bd6] hover:shadow-[0_0_25px_rgba(255,43,214,0.35)] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">Recent Activities</h2>
                <a href="#activities" className="text-xs text-gray-400 hover:text-white transition-colors">
                  View All
                </a>
              </div>

              <div className="flex flex-col gap-3">
                {/* Activity 1 */}
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-emerald-950/80 border border-emerald-800/50 flex items-center justify-center text-emerald-400 shrink-0">
                    <Check size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">Deal closed with TechCorp</div>
                    <div className="text-[11px] text-gray-500">2 hours ago</div>
                  </div>
                </div>

                {/* Activity 2 */}
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-950/80 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0">
                    <Phone size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">Called Sarah Johnson</div>
                    <div className="text-[11px] text-gray-500">4 hours ago</div>
                  </div>
                </div>

                {/* Activity 3 */}
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-purple-950/80 border border-purple-800/50 flex items-center justify-center text-purple-400 shrink-0">
                    <Mail size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">Email sent to 15 contacts</div>
                    <div className="text-[11px] text-gray-500">6 hours ago</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CrmDashboard;
