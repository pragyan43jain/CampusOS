import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BrainCircuit,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Calendar,
  CheckCircle2,
  Sparkles,
  Zap,
  Award,
  ChevronDown,
  X,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { AIStudyTask, TimetableSlot, Course, Attendance, Exam } from '../types';

export interface PlannerTask {
  id: string;
  title: string;
  headline?: string;
  courseCode?: string;
  estimatedMinutes?: number;
  priority?: 'high' | 'medium' | 'low' | string;
  completed?: boolean;
  source?: string;
}

interface AIPlannerViewProps {
  tasks?: AIStudyTask[];
  timetable?: TimetableSlot[];
  courses?: Course[];
  attendance?: Attendance[];
  exams?: Exam[];
}

type FocusPreset = 'POMODORO' | 'DEEP_WORK' | 'CAT2_REVISION' | 'CUSTOM';

const playChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.3);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(659.25, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(783.99, now + 0.5);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.15);
    osc1.stop(now + 0.9);
    osc2.stop(now + 0.9);
  } catch {
    // Ignore audio autoplay restrictions
  }
};

export const AIPlannerView: React.FC<AIPlannerViewProps> = ({
  tasks = [],
  timetable = [],
  courses = [],
  attendance: _attendance = [],
  exams = [],
}) => {
  const [preset, setPreset] = useState<FocusPreset>('POMODORO');
  const [totalSeconds, setTotalSeconds] = useState<number>(25 * 60);
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>(
    courses[0]?.code || 'BCSE302L'
  );
  const [sprintObjective, setSprintObjective] = useState<string>(
    'Derive strict 2PL transaction schedules and verify conflict serializability.'
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showAlertBanner, setShowAlertBanner] = useState<boolean>(true);

  // User created / dynamic tasks list
  const [customTasks, setCustomTasks] = useState<PlannerTask[]>(() => {
    try {
      const saved = localStorage.getItem('campusos_ai_study_tasks');
      if (saved) return JSON.parse(saved);
    } catch {}
    return tasks.length > 0
      ? tasks.map((t) => ({
          id: t.id,
          title: t.headline,
          headline: t.headline,
          courseCode: t.courseCode,
          estimatedMinutes: Math.round(t.estimatedHours * 60) || 30,
          completed: false,
          source: 'ai_suggested',
        }))
      : [
          {
            id: 't-1',
            title: 'Review Raft Consensus Algorithm',
            courseCode: 'BECE355L',
            estimatedMinutes: 45,
            priority: 'high',
            completed: false,
            source: 'ai_suggested',
          },
          {
            id: 't-2',
            title: 'Probability Distributions Problem Set 5',
            courseCode: 'BMAT202L',
            estimatedMinutes: 60,
            priority: 'high',
            completed: false,
            source: 'exam_prep',
          },
          {
            id: 't-3',
            title: 'Packet Tracer Subnetting Lab Mock Test',
            courseCode: 'BCSE308L',
            estimatedMinutes: 30,
            priority: 'medium',
            completed: true,
            source: 'lab_assignment',
          },
        ];
  });

  const [newTaskTitle, setNewTaskTitle] = useState<string>('');

  useEffect(() => {
    try {
      localStorage.setItem('campusos_ai_study_tasks', JSON.stringify(customTasks));
    } catch {}
  }, [customTasks]);

  // Handle preset selection
  const handleSelectPreset = (p: FocusPreset) => {
    setPreset(p);
    setIsRunning(false);
    let seconds = 25 * 60;
    if (p === 'POMODORO') seconds = 25 * 60;
    else if (p === 'DEEP_WORK') seconds = 50 * 60;
    else if (p === 'CAT2_REVISION') seconds = 90 * 60;
    else if (p === 'CUSTOM') seconds = 20 * 60;

    setTotalSeconds(seconds);
    setTimeLeft(seconds);
  };

  // Timer interval
  const timerRef = useRef<any>(null);
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsRunning(false);
            if (soundEnabled) playChime();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, soundEnabled]);

  const toggleTimer = () => setIsRunning((prev) => !prev);
  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(totalSeconds);
  };

  // Format mm:ss
  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Circular progress ring calculation
  const radius = 102;
  const circumference = 2 * Math.PI * radius; // ~640.88
  const progressRatio = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;
  const strokeDashoffset = circumference - progressRatio * circumference;

  // Next official slot from timetable
  const nextSlot = useMemo(() => {
    if (timetable.length > 0) return timetable[0];
    return null;
  }, [timetable]);

  // Toggle custom task status
  const toggleTask = (taskId: string) => {
    setCustomTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const deleteTask = (taskId: string) => {
    setCustomTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask: PlannerTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      headline: newTaskTitle.trim(),
      courseCode: selectedCourseCode,
      estimatedMinutes: 30,
      priority: 'medium',
      completed: false,
      source: 'manual',
    };
    setCustomTasks((prev) => [newTask, ...prev]);
    setNewTaskTitle('');
  };

  return (
    <div className="flex flex-col w-full gap-6">
      {/* =========================================================================
          1. OPERATIONAL SYNCHRONIZATION & LIVE TIMETABLE GAP HEADER
          ========================================================================= */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 p-5 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 shadow-sm">
            <BrainCircuit size={22} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-headline-sm text-base md:text-lg font-semibold text-on-surface">
                Academic Focus Engine
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary-fixed/50 text-on-secondary-fixed font-label-sm text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                Engine Active
              </span>
            </div>
            <span className="font-label-md text-xs text-outline truncate">
              Synced with VTOP Timetable Slot Set 1 • Real-time Academic Buffer Monitor
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3.5 self-start xl:self-auto shrink-0 flex-wrap">
          <div className="flex items-center gap-3 px-3.5 py-2 rounded bg-surface-container-low text-on-surface border border-outline-variant/20">
            <div className="flex flex-col text-right">
              <span className="font-label-sm text-[10px] text-outline uppercase tracking-wider font-semibold">
                Next Academic Slot
              </span>
              <span className="font-tabular-data text-xs font-semibold text-primary">
                {nextSlot
                  ? `${nextSlot.startTime || '02:00 PM'} • ${nextSlot.courseCode} ${nextSlot.courseTitle}`
                  : '02:00 PM • CSE3002 Internet of Things'}
              </span>
            </div>
            <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-on-surface-variant">
              <Clock size={16} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
            title={soundEnabled ? 'Mute Chime' : 'Enable Chime'}
          >
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. DETECTED TIMETABLE FREE WINDOWS ALERT BANNER
          ========================================================================= */}
      {showAlertBanner && (
        <div className="relative overflow-hidden rounded-xl bg-secondary-container text-on-secondary-container p-4 md:p-5 shadow-sm border border-secondary-fixed/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start md:items-center gap-3.5">
              <div className="p-2 rounded bg-surface-container-lowest/80 text-secondary shrink-0 shadow-sm mt-0.5 md:mt-0">
                <Zap size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-label-md text-xs font-semibold text-on-secondary-fixed uppercase tracking-wider">
                    Optimal Focus Opportunity Detected
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-container-lowest/90 text-on-surface font-label-sm text-[11px] font-semibold">
                    No Attendance Conflict
                  </span>
                </div>
                <p className="font-body-md text-xs md:text-sm text-on-secondary-container mt-1 leading-relaxed">
                  <strong className="font-semibold text-on-secondary-fixed">
                    Monday 11:30 AM – 1:15 PM
                  </strong>{' '}
                  • Optimal{' '}
                  <span className="font-semibold text-primary">
                    1h 45m Deep Study Window
                  </span>{' '}
                  verified between Cloud Computing (SJB 402) and Networks Lab (SJB 211).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
              <button
                type="button"
                onClick={() => handleSelectPreset('DEEP_WORK')}
                className="px-3.5 py-1.5 rounded bg-surface-container-lowest text-on-secondary-fixed font-label-md text-xs font-semibold shadow-sm hover:bg-surface-container transition-colors"
              >
                Auto-Schedule Sprint
              </button>
              <button
                type="button"
                onClick={() => setShowAlertBanner(false)}
                className="p-1.5 rounded hover:bg-surface-container-lowest/40 text-on-secondary-container transition-colors"
                title="Dismiss suggestion"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. MAIN WORKSTATION LAYOUT GRID (5 COLS TIMER + 7 COLS SCHEDULE/TASKS)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: FOCUS TIMER & SESSION SETUP (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-xl bg-surface-container-lowest p-5 md:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-5">
            {/* Mode Architecture Selector Pills */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                  Mode Architecture
                </span>
                <span className="font-label-sm text-xs text-secondary font-tabular-data font-semibold">
                  {preset}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectPreset('POMODORO')}
                  className={`p-2.5 rounded text-left transition-all flex flex-col border ${
                    preset === 'POMODORO'
                      ? 'bg-primary text-on-primary border-primary font-semibold shadow-sm'
                      : 'bg-surface-container text-on-surface border-transparent hover:bg-surface-variant'
                  }`}
                >
                  <span className="font-label-md text-xs leading-tight">Pomodoro Focus</span>
                  <span className={`font-label-sm text-[10px] mt-0.5 ${preset === 'POMODORO' ? 'opacity-80' : 'text-outline'}`}>
                    25 min block
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset('DEEP_WORK')}
                  className={`p-2.5 rounded text-left transition-all flex flex-col border ${
                    preset === 'DEEP_WORK'
                      ? 'bg-primary text-on-primary border-primary font-semibold shadow-sm'
                      : 'bg-surface-container text-on-surface border-transparent hover:bg-surface-variant'
                  }`}
                >
                  <span className="font-label-md text-xs leading-tight">Deep Work Block</span>
                  <span className={`font-label-sm text-[10px] mt-0.5 ${preset === 'DEEP_WORK' ? 'opacity-80' : 'text-outline'}`}>
                    50 min block
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset('CAT2_REVISION')}
                  className={`p-2.5 rounded text-left transition-all flex flex-col border ${
                    preset === 'CAT2_REVISION'
                      ? 'bg-primary text-on-primary border-primary font-semibold shadow-sm'
                      : 'bg-surface-container text-on-surface border-transparent hover:bg-surface-variant'
                  }`}
                >
                  <span className="font-label-md text-xs leading-tight">CAT-2 Revision</span>
                  <span className={`font-label-sm text-[10px] mt-0.5 ${preset === 'CAT2_REVISION' ? 'opacity-80' : 'text-outline'}`}>
                    90 min sprint
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset('CUSTOM')}
                  className={`p-2.5 rounded text-left transition-all flex flex-col border ${
                    preset === 'CUSTOM'
                      ? 'bg-primary text-on-primary border-primary font-semibold shadow-sm'
                      : 'bg-surface-container text-on-surface border-transparent hover:bg-surface-variant'
                  }`}
                >
                  <span className="font-label-md text-xs leading-tight">Custom Sprint</span>
                  <span className={`font-label-sm text-[10px] mt-0.5 ${preset === 'CUSTOM' ? 'opacity-80' : 'text-outline'}`}>
                    Adjustable
                  </span>
                </button>
              </div>
            </div>

            {/* Circular Visualizer & Countdown Station */}
            <div className="relative py-4 flex flex-col items-center justify-center bg-surface-container-low/40 rounded-xl border border-outline-variant/10">
              <div className="relative w-60 h-60 flex items-center justify-center">
                {/* SVG Progress Ring */}
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 240 240">
                  <circle
                    className="text-surface-container"
                    cx="120"
                    cy="120"
                    fill="transparent"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="6"
                  />
                  <circle
                    className="text-primary transition-all duration-1000 ease-linear"
                    cx="120"
                    cy="120"
                    fill="transparent"
                    r={radius}
                    stroke="currentColor"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    strokeWidth="7"
                  />
                </svg>

                {/* Center Countdown Typography & Meta */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mb-1 rounded bg-secondary-fixed/60 text-on-secondary-fixed font-label-sm text-[11px] font-semibold">
                    <span
                      className={`w-1.5 h-1.5 rounded-full bg-secondary ${
                        isRunning ? 'animate-pulse' : ''
                      }`}
                    />
                    <span>{isRunning ? 'In Deep Focus' : 'Session Ready'}</span>
                  </div>
                  <div className="font-display-lg text-4xl text-on-surface tracking-tight font-semibold font-tabular-data">
                    {formatTime(timeLeft)}
                  </div>
                  <div className="flex items-center gap-1 text-outline font-label-sm text-[11px] mt-1">
                    <Sparkles size={12} className="text-secondary" />
                    <span>Active Wave: 40Hz Beta/Alpha</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Play/Pause and Reset */}
              <div className="flex items-center gap-2.5 mt-3">
                <button
                  type="button"
                  onClick={toggleTimer}
                  className="px-5 py-2 rounded bg-primary text-on-primary font-label-md text-xs font-semibold flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
                >
                  {isRunning ? <Pause size={16} /> : <Play size={16} />}
                  <span>{isRunning ? 'Pause Session' : 'Start Session'}</span>
                </button>
                <button
                  type="button"
                  onClick={resetTimer}
                  className="px-3.5 py-2 rounded bg-surface-container hover:bg-surface-variant text-on-surface font-label-md text-xs font-semibold flex items-center gap-1.5 transition-colors border border-outline-variant/20"
                  title="Reset timer"
                >
                  <RotateCcw size={15} />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Target Academic Module Dropdown */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                Allocated Academic Module
              </label>
              <div className="relative">
                <select
                  value={selectedCourseCode}
                  onChange={(e) => setSelectedCourseCode(e.target.value)}
                  className="w-full h-10 px-3 pr-8 rounded bg-surface-container-low text-on-surface font-label-md text-xs appearance-none cursor-pointer focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 transition-all"
                >
                  {(courses.length > 0 ? courses : [
                    { code: 'BCSE302L', title: 'Database Systems — Relational Algebra & SQL Normalization' },
                    { code: 'BMAT202L', title: 'Applied Probability — Random Variables & Stochastic Modeling' },
                    { code: 'BCSE308L', title: 'Computer Networks — Subnetting & Sliding Window Protocol' },
                    { code: 'BCSE303P', title: 'Operating Systems Lab — Thread Synchronization & Semaphores' },
                  ]).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} • {c.title}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-2.5 top-3 text-on-surface-variant pointer-events-none"
                />
              </div>
            </div>

            {/* Immediate Sprint Objective (Editable) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                  Immediate Sprint Objective
                </label>
                <span className="font-label-sm text-[10px] text-outline font-medium">Markdown Enabled</span>
              </div>
              <textarea
                value={sprintObjective}
                onChange={(e) => setSprintObjective(e.target.value)}
                rows={2}
                className="w-full p-2.5 rounded bg-surface-container-low text-on-surface font-body-sm text-xs focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 resize-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TIMETABLE FREE SLOTS, TASKS, PROTOCOLS (7 COLS) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Module 1: Detected Timetable Free Slots (Today) */}
          <div className="rounded-xl bg-surface-container-lowest p-5 md:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-primary" />
                <h2 className="font-headline-sm text-base font-semibold text-on-surface">
                  Detected Timetable Free Slots (Today)
                </h2>
              </div>
              <span className="font-label-sm text-[11px] text-outline uppercase tracking-wider font-semibold">
                2 Opportunities Found
              </span>
            </div>

            <div className="space-y-3">
              {/* Free Slot 1 */}
              <div className="p-3.5 rounded-lg bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-outline-variant/10">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-secondary-fixed/70 text-on-secondary-fixed flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-tabular-data text-xs font-semibold text-on-surface">
                        11:45 AM – 12:45 PM
                      </span>
                      <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface font-label-sm text-[10px] font-semibold border border-outline-variant/20">
                        60m Block
                      </span>
                    </div>
                    <div className="font-body-md text-xs text-on-surface-variant mt-0.5">
                      Allocated to{' '}
                      <span className="font-semibold text-on-surface">
                        Database Systems Relational Calculus & Indexing Practice
                      </span>
                    </div>
                    <span className="font-label-sm text-[11px] text-secondary flex items-center gap-1 mt-1">
                      <CheckCircle2 size={12} />
                      Target completed on schedule • 4 query structures verified
                    </span>
                  </div>
                </div>
                <div className="shrink-0 self-end sm:self-auto">
                  <span className="px-2.5 py-1 rounded bg-surface-container text-on-surface-variant font-label-sm text-[10px] font-semibold">
                    Archived
                  </span>
                </div>
              </div>

              {/* Free Slot 2 */}
              <div className="p-3.5 rounded-lg bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-outline-variant/10">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={16} />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-tabular-data text-xs font-semibold text-primary">
                        04:45 PM – 06:00 PM
                      </span>
                      <span className="px-2 py-0.5 rounded bg-secondary-fixed/50 text-on-secondary-fixed font-label-sm text-[10px] font-semibold">
                        75m Open Window
                      </span>
                      <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-[10px] font-semibold">
                        High Value
                      </span>
                    </div>
                    <div className="font-body-md text-xs text-on-surface mt-0.5">
                      Suggested:{' '}
                      <span className="font-semibold text-on-surface">
                        Cloud Computing Architecture Review
                      </span>{' '}
                      before practical laboratory session.
                    </div>
                    <span className="font-label-sm text-[11px] text-outline mt-0.5">
                      Gap located directly between IoT Lecture and Evening study block.
                    </span>
                  </div>
                </div>
                <div className="shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('DEEP_WORK')}
                    className="px-3 py-1.5 rounded bg-primary text-on-primary font-label-md text-xs font-semibold shadow-sm hover:opacity-90 transition-opacity"
                  >
                    Allocate Slot
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Module 2: Exam Countdown & Sprint Targets */}
          <div className="rounded-xl bg-surface-container-lowest p-5 md:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <Award size={18} className="text-secondary" />
                <h2 className="font-headline-sm text-base font-semibold text-on-surface">
                  Exam Countdown & Sprint Targets
                </h2>
              </div>
              <span className="font-label-sm text-[11px] text-outline uppercase tracking-wider font-semibold">
                Winter 2024–25 Schedule
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Exam Target 1 */}
              <div className="p-4 rounded-lg bg-surface-container-low flex flex-col justify-between gap-3 border border-outline-variant/10">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-label-sm text-[10px] text-error font-semibold uppercase tracking-wider">
                      Critical Priority
                    </span>
                    <h3 className="font-headline-sm text-sm font-semibold text-on-surface mt-0.5">
                      {exams[0]?.title || 'BCSE302L CAT-2'}
                    </h3>
                    <p className="font-body-sm text-xs text-outline">Database Management Systems</p>
                  </div>
                  <div className="text-right">
                    <span className="font-metric-display text-2xl font-bold text-primary leading-none font-tabular-data">
                      09
                    </span>
                    <span className="font-label-sm text-[10px] text-outline block">Days Left</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between font-label-sm text-[11px]">
                    <span className="text-on-surface-variant font-medium">Curriculum Progress</span>
                    <span className="font-tabular-data text-primary font-semibold">3 Modules Pending</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '58%' }} />
                  </div>
                  <p className="font-label-sm text-[10px] text-on-surface-variant pt-0.5">
                    Target: Functional Dependency, 3NF/BCNF Decompositions, B+ Trees.
                  </p>
                </div>
              </div>

              {/* Exam Target 2 */}
              <div className="p-4 rounded-lg bg-surface-container-low flex flex-col justify-between gap-3 border border-outline-variant/10">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-label-sm text-[10px] text-secondary font-semibold uppercase tracking-wider">
                      High Priority
                    </span>
                    <h3 className="font-headline-sm text-sm font-semibold text-on-surface mt-0.5">
                      {exams[1]?.title || 'BMAT202L CAT-2'}
                    </h3>
                    <p className="font-body-sm text-xs text-outline">Probability & Statistics</p>
                  </div>
                  <div className="text-right">
                    <span className="font-metric-display text-2xl font-bold text-secondary leading-none font-tabular-data">
                      12
                    </span>
                    <span className="font-label-sm text-[10px] text-outline block">Days Left</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between font-label-sm text-[11px]">
                    <span className="text-on-surface-variant font-medium">Curriculum Progress</span>
                    <span className="font-tabular-data text-secondary font-semibold">2 Modules Pending</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                    <div className="bg-secondary h-2 rounded-full" style={{ width: '74%' }} />
                  </div>
                  <p className="font-label-sm text-[10px] text-on-surface-variant pt-0.5">
                    Focus: Random Variables, Joint Distributions & Central Limit Theorem.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Module 3: Priority Revision Backlog & Add Task Form */}
          <div className="rounded-xl bg-surface-container-lowest p-5 md:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <CheckSquare size={18} className="text-primary" />
                <h2 className="font-headline-sm text-base font-semibold text-on-surface">
                  Priority Revision Backlog
                </h2>
              </div>
              <span className="font-label-sm text-[11px] text-outline uppercase tracking-wider font-semibold">
                {customTasks.filter((t) => !t.completed).length} Tasks Remaining
              </span>
            </div>

            {/* Add Task Quick Form */}
            <form onSubmit={addTask} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add revision task or topic..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 px-3 py-2 rounded bg-surface-container-low text-xs text-on-surface border border-outline-variant/30 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded bg-primary text-on-primary font-label-md text-xs font-semibold flex items-center gap-1 shadow-sm hover:opacity-90"
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            </form>

            <div className="space-y-2">
              {customTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-3 rounded-lg flex items-center justify-between gap-3 border transition-colors ${
                    task.completed
                      ? 'bg-surface-container-low/50 border-outline-variant/10 opacity-70'
                      : 'bg-surface-container-low border-outline-variant/20 hover:border-primary/30'
                  }`}
                >
                  <div
                    onClick={() => toggleTask(task.id)}
                    className="flex items-center gap-3 cursor-pointer min-w-0"
                  >
                    <button type="button" className="text-primary shrink-0">
                      {task.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                    <div className="flex flex-col min-w-0">
                      <span
                        className={`font-label-md text-xs font-medium truncate ${
                          task.completed ? 'line-through text-outline' : 'text-on-surface'
                        }`}
                      >
                        {task.title}
                      </span>
                      <span className="font-label-sm text-[10px] text-outline font-tabular-data">
                        {task.courseCode} • {task.estimatedMinutes} mins est.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteTask(task.id)}
                    className="text-outline hover:text-error p-1 rounded transition-colors shrink-0"
                    title="Delete task"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
