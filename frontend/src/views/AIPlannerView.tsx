import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BrainCircuit,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Coffee,
  BookOpen,
  Calendar,
  CheckCircle2,
  Sparkles,
  Zap,
  Flame,
  Award,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AIStudyTask, TimetableSlot, Course, Attendance, Exam } from '../types';
import { MetricCard } from '../components/MetricCard';

interface AIPlannerViewProps {
  tasks?: AIStudyTask[];
  timetable?: TimetableSlot[];
  courses?: Course[];
  attendance?: Attendance[];
  exams?: Exam[];
}

type PomodoroMode = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';

interface CustomStudyPlan {
  id: string;
  day: string;
  timeSlot: string;
  courseCode: string;
  courseTitle: string;
  topic: string;
  completed: boolean;
  durationMinutes?: number;
}

const DAY_NAMES: Record<string, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
};

// Play a pleasant synthesizer chime via Web Audio API
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
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.3); // E5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(659.25, now + 0.15); // E5
    osc2.frequency.exponentialRampToValueAtTime(783.99, now + 0.5); // G5

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
    // Ignore audio context autoplay restrictions
  }
};

export const AIPlannerView: React.FC<AIPlannerViewProps> = ({
  tasks = [],
  timetable = [],
  courses = [],
  attendance = [],
  exams = [],
}) => {
  const [activeTab, setActiveTab] = useState<'POMODORO' | 'FREE_SLOTS' | 'TASKS'>('POMODORO');

  // --- Pomodoro State with Flexible Durations ---
  const [focusMinutes, setFocusMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('campusos_focus_minutes');
      return saved ? parseInt(saved, 10) : 25;
    } catch {
      return 25;
    }
  });

  const [shortBreakMinutes, setShortBreakMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('campusos_short_break_minutes');
      return saved ? parseInt(saved, 10) : 5;
    } catch {
      return 5;
    }
  });

  const [longBreakMinutes, setLongBreakMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('campusos_long_break_minutes');
      return saved ? parseInt(saved, 10) : 15;
    } catch {
      return 15;
    }
  });

  const [mode, setMode] = useState<PomodoroMode>('FOCUS');
  const [totalSeconds, setTotalSeconds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('campusos_focus_minutes');
      return (saved ? parseInt(saved, 10) : 25) * 60;
    } catch {
      return 25 * 60;
    }
  });
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('campusos_focus_minutes');
      return (saved ? parseInt(saved, 10) : 25) * 60;
    } catch {
      return 25 * 60;
    }
  });

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [focusTopic, setFocusTopic] = useState<string>(() => {
    try {
      return localStorage.getItem('campusos_focus_topic') || '';
    } catch {
      return '';
    }
  });

  const updateFocusTopic = (topic: string) => {
    setFocusTopic(topic);
    try {
      localStorage.setItem('campusos_focus_topic', topic);
    } catch {
      // ignore
    }
  };

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [completedSessions, setCompletedSessions] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('campusos_pomodoro_sessions');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [totalFocusMinutes, setTotalFocusMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('campusos_total_focus_minutes');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef<any>(null);

  // Set default selected course once courses load
  useEffect(() => {
    if (!selectedCourse && courses.length > 0) {
      setSelectedCourse(courses[0].code || '');
    }
  }, [courses, selectedCourse]);

  // Pomodoro countdown effect
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsRunning(false);
            if (soundEnabled) playChime();

            if (mode === 'FOCUS') {
              setCompletedSessions((c) => {
                const updated = c + 1;
                try {
                  localStorage.setItem('campusos_pomodoro_sessions', updated.toString());
                } catch {
                  // ignore
                }
                return updated;
              });
              setTotalFocusMinutes((m) => {
                const updated = m + focusMinutes;
                try {
                  localStorage.setItem('campusos_total_focus_minutes', updated.toString());
                } catch {
                  // ignore
                }
                return updated;
              });
              setMode('SHORT_BREAK');
              const breakSec = shortBreakMinutes * 60;
              setTotalSeconds(breakSec);
              return breakSec;
            } else {
              setMode('FOCUS');
              const focusSec = focusMinutes * 60;
              setTotalSeconds(focusSec);
              return focusSec;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isRunning, mode, soundEnabled, focusMinutes, shortBreakMinutes]);

  const setCustomFocusDuration = (mins: number) => {
    const valid = Math.max(1, Math.min(300, mins));
    setFocusMinutes(valid);
    try {
      localStorage.setItem('campusos_focus_minutes', valid.toString());
    } catch {
      // ignore
    }
    if (mode === 'FOCUS' && !isRunning) {
      setTotalSeconds(valid * 60);
      setTimeLeft(valid * 60);
    }
  };

  const setCustomBreakDuration = (mins: number) => {
    const valid = Math.max(1, Math.min(60, mins));
    setShortBreakMinutes(valid);
    try {
      localStorage.setItem('campusos_short_break_minutes', valid.toString());
    } catch {
      // ignore
    }
    if (mode === 'SHORT_BREAK' && !isRunning) {
      setTotalSeconds(valid * 60);
      setTimeLeft(valid * 60);
    }
  };

  const setCustomLongBreakDuration = (mins: number) => {
    const valid = Math.max(1, Math.min(120, mins));
    setLongBreakMinutes(valid);
    try {
      localStorage.setItem('campusos_long_break_minutes', valid.toString());
    } catch {
      // ignore
    }
    if (mode === 'LONG_BREAK' && !isRunning) {
      setTotalSeconds(valid * 60);
      setTimeLeft(valid * 60);
    }
  };

  const adjustMinutes = (delta: number) => {
    if (mode === 'FOCUS') {
      const updated = Math.max(1, Math.min(300, focusMinutes + delta));
      setCustomFocusDuration(updated);
    } else if (mode === 'SHORT_BREAK') {
      const updated = Math.max(1, Math.min(60, shortBreakMinutes + delta));
      setCustomBreakDuration(updated);
    } else {
      const updated = Math.max(1, Math.min(120, longBreakMinutes + delta));
      setCustomLongBreakDuration(updated);
    }
  };

  const extendFiveMinutes = () => {
    setTimeLeft((prev) => prev + 300);
    setTotalSeconds((prev) => prev + 300);
  };

  const switchMode = (newMode: PomodoroMode) => {
    setIsRunning(false);
    setMode(newMode);
    let sec = focusMinutes * 60;
    if (newMode === 'SHORT_BREAK') sec = shortBreakMinutes * 60;
    if (newMode === 'LONG_BREAK') sec = longBreakMinutes * 60;
    setTotalSeconds(sec);
    setTimeLeft(sec);
  };

  const resetTimer = () => {
    setIsRunning(false);
    let sec = focusMinutes * 60;
    if (mode === 'SHORT_BREAK') sec = shortBreakMinutes * 60;
    if (mode === 'LONG_BREAK') sec = longBreakMinutes * 60;
    setTotalSeconds(sec);
    setTimeLeft(sec);
  };

  const startFocusSession = (courseCode: string, topic: string, durationMinutes?: number) => {
    if (courseCode) setSelectedCourse(courseCode);
    updateFocusTopic(topic || '');
    const mins = durationMinutes && durationMinutes > 0 ? durationMinutes : focusMinutes;
    setCustomFocusDuration(mins);
    setMode('FOCUS');
    setTotalSeconds(mins * 60);
    setTimeLeft(mins * 60);
    setIsRunning(true);
    setActiveTab('POMODORO');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = useMemo(() => {
    if (totalSeconds <= 0) return 0;
    return Math.min(100, Math.max(0, ((totalSeconds - timeLeft) / totalSeconds) * 100));
  }, [timeLeft, totalSeconds]);

  // --- Free-Slot Detection Algorithm ---
  const [selectedDay, setSelectedDay] = useState<string>('MON');
  const [customPlans, setCustomPlans] = useState<CustomStudyPlan[]>(() => {
    try {
      const saved = localStorage.getItem('campusos_custom_study_plans');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const savePlans = (plans: CustomStudyPlan[]) => {
    setCustomPlans(plans);
    try {
      localStorage.setItem('campusos_custom_study_plans', JSON.stringify(plans));
    } catch {
      // ignore
    }
  };

  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  };

  const minutesToTime12 = (min: number): string => {
    const h24 = Math.floor(min / 60);
    const m = min % 60;
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const dailyFreeSlots = useMemo(() => {
    const daySlots = timetable.filter(
      (s) => (s.day || '').toUpperCase() === selectedDay.toUpperCase()
    );

    if (daySlots.length === 0) {
      return [
        {
          start: '09:00 AM',
          end: '05:00 PM',
          durationMinutes: 480,
          label: 'Entire Day Free for Self-Study & Revision',
        },
      ];
    }

    const sorted = [...daySlots].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );

    const freeWindows: { start: string; end: string; durationMinutes: number; label: string }[] = [];
    const dayStart = 510; // 08:30 AM
    const dayEnd = 1080;  // 06:00 PM
    let current = dayStart;

    sorted.forEach((cls) => {
      const clsStart = timeToMinutes(cls.startTime);
      const clsEnd = timeToMinutes(cls.endTime);

      if (clsStart > current && clsStart - current >= 45) {
        freeWindows.push({
          start: minutesToTime12(current),
          end: minutesToTime12(clsStart),
          durationMinutes: clsStart - current,
          label: `${Math.round((clsStart - current) / 60 * 10) / 10}h Free Study Window`,
        });
      }
      current = Math.max(current, clsEnd);
    });

    if (dayEnd > current && dayEnd - current >= 45) {
      freeWindows.push({
        start: minutesToTime12(current),
        end: minutesToTime12(dayEnd),
        durationMinutes: dayEnd - current,
        label: `${Math.round((dayEnd - current) / 60 * 10) / 10}h Evening Focus Window`,
      });
    }

    return freeWindows;
  }, [timetable, selectedDay]);

  // Free slots inline scheduler state
  const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null);
  const [slotTopic, setSlotTopic] = useState<string>('');
  const [slotCourse, setSlotCourse] = useState<string>('');
  const [slotDuration, setSlotDuration] = useState<number>(25);

  // Quick any-time study session state
  const [anyTimeTopic, setAnyTimeTopic] = useState<string>('');
  const [anyTimeCourse, setAnyTimeCourse] = useState<string>('');
  const [anyTimeDuration, setAnyTimeDuration] = useState<number>(25);

  // Revision blocks form state
  const [newPlanCourse, setNewPlanCourse] = useState<string>('');
  const [newPlanTopic, setNewPlanTopic] = useState<string>('');
  const [newPlanTime, setNewPlanTime] = useState<string>('');
  const [newPlanDuration, setNewPlanDuration] = useState<number>(25);

  // Auto-initialize course dropdowns once courses load
  useEffect(() => {
    if (courses.length > 0) {
      if (!newPlanCourse) setNewPlanCourse(courses[0].code || 'GENERAL');
      if (!slotCourse) setSlotCourse(courses[0].code || 'GENERAL');
      if (!anyTimeCourse) setAnyTimeCourse(courses[0].code || 'GENERAL');
    }
  }, [courses, newPlanCourse, slotCourse, anyTimeCourse]);

  const handleToggleSlotScheduler = (idx: number, slot: { start: string; end: string; durationMinutes: number }) => {
    if (activeSlotIdx === idx) {
      setActiveSlotIdx(null);
    } else {
      setActiveSlotIdx(idx);
      setSlotTopic('');
      setSlotCourse(newPlanCourse || courses[0]?.code || 'GENERAL');
      setSlotDuration(slot.durationMinutes > 0 && slot.durationMinutes <= 90 ? slot.durationMinutes : 30);
    }
  };

  const handleSaveSlotPlan = (slot: { start: string; end: string; durationMinutes: number }, startNow: boolean = false) => {
    if (!slotTopic.trim()) return;
    const courseCode = slotCourse || (courses[0]?.code || 'GENERAL');
    const courseObj = courses.find((c) => c.code === courseCode);
    const duration = slotDuration > 0 ? slotDuration : (slot.durationMinutes || 25);

    const newPlan: CustomStudyPlan = {
      id: `plan-${Date.now()}`,
      day: selectedDay,
      timeSlot: `${slot.start} – ${slot.end}`,
      courseCode: courseCode,
      courseTitle: courseObj?.title || 'Targeted Revision',
      topic: slotTopic.trim(),
      completed: false,
      durationMinutes: duration,
    };

    savePlans([...customPlans, newPlan]);

    if (startNow) {
      startFocusSession(courseCode, slotTopic.trim(), duration);
    }

    setActiveSlotIdx(null);
    setSlotTopic('');
  };

  const handleStartAnyTimeStudy = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const courseCode = anyTimeCourse || (courses[0]?.code || 'GENERAL');
    const topic = anyTimeTopic.trim() || 'General Study Session';
    const duration = anyTimeDuration > 0 ? anyTimeDuration : 25;

    const courseObj = courses.find((c) => c.code === courseCode);
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newPlan: CustomStudyPlan = {
      id: `plan-${Date.now()}`,
      day: selectedDay,
      timeSlot: `${nowStr} (${duration}m Focus)`,
      courseCode: courseCode,
      courseTitle: courseObj?.title || 'Targeted Revision',
      topic: topic,
      completed: false,
      durationMinutes: duration,
    };

    savePlans([...customPlans, newPlan]);
    startFocusSession(courseCode, topic, duration);
    setAnyTimeTopic('');
  };

  const addCustomStudyPlan = (e: React.FormEvent, startNow: boolean = false) => {
    e.preventDefault();
    if (!newPlanTopic.trim()) return;

    const courseCode = newPlanCourse || (courses[0]?.code || 'GENERAL');
    const courseObj = courses.find((c) => c.code === courseCode);
    const duration = newPlanDuration > 0 ? newPlanDuration : 25;

    const newPlan: CustomStudyPlan = {
      id: `plan-${Date.now()}`,
      day: selectedDay,
      timeSlot: newPlanTime.trim() || 'Free Period',
      courseCode: courseCode,
      courseTitle: courseObj?.title || 'Targeted Revision',
      topic: newPlanTopic.trim(),
      completed: false,
      durationMinutes: duration,
    };

    savePlans([...customPlans, newPlan]);

    if (startNow) {
      startFocusSession(courseCode, newPlanTopic.trim(), duration);
    }

    setNewPlanTopic('');
    setNewPlanTime('');
  };

  const togglePlanDone = (id: string) => {
    savePlans(
      customPlans.map((p) => (p.id === id ? { ...p, completed: !p.completed } : p))
    );
  };

  const deletePlan = (id: string) => {
    savePlans(customPlans.filter((p) => p.id !== id));
  };

  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const toggleTaskDone = (id: string) => {
    setCompletedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="page-container">
      {/* 1. Header Banner */}
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="hero-eyebrow">
              <Sparkles size={14} />
              <span>ACADEMIC FOCUS &amp; PRODUCTIVITY ENGINE</span>
              <span>•</span>
              <span style={{ color: 'var(--accent-cyan)' }}>TIMETABLE INTEGRATED</span>
            </div>
            <h2 className="hero-heading">AI Study Planner &amp; Focus Hub</h2>
            <p className="hero-desc">
              Harness your detected timetable free slots, plan daily revision blocks, and power through targeted study sprints with the built-in Pomodoro workstation.
            </p>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${activeTab === 'POMODORO' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('POMODORO')}
            >
              <Zap size={14} />
              <span>Pomodoro Station</span>
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'FREE_SLOTS' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('FREE_SLOTS')}
            >
              <Calendar size={14} />
              <span>Free-Slot Scheduler</span>
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'TASKS' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('TASKS')}
            >
              <CheckCircle2 size={14} />
              <span>Exam Targets ({tasks.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Metrics Row */}
      <div className="metrics-stat-grid">
        <MetricCard
          label="Today's Pomodoros"
          value={completedSessions}
          subtext={`${totalFocusMinutes} mins deep work logged`}
          icon={<Flame size={18} />}
          variant="crimson"
        />
        <MetricCard
          label="Free Study Slots"
          value={dailyFreeSlots.length}
          subtext={`Detected on ${DAY_NAMES[selectedDay] || selectedDay}`}
          icon={<Calendar size={18} />}
          variant="cyan"
        />
        <MetricCard
          label="Enrolled Courses"
          value={courses.length || attendance.length}
          subtext="Available for study allocation"
          icon={<BookOpen size={18} />}
          variant="purple"
        />
        <MetricCard
          label="Upcoming Exams"
          value={exams.length}
          subtext="CAT / FAT preparation goals"
          icon={<Award size={18} />}
          variant="emerald"
        />
      </div>

      {/* TAB 1: POMODORO FOCUS STATION */}
      {activeTab === 'POMODORO' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px' }}>
            {/* Mode Selectors */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                className={`btn btn-sm ${mode === 'FOCUS' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => switchMode('FOCUS')}
                style={{ borderRadius: '20px', padding: '6px 14px' }}
              >
                <Flame size={14} />
                <span>Focus ({focusMinutes}m)</span>
              </button>
              <button
                className={`btn btn-sm ${mode === 'SHORT_BREAK' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => switchMode('SHORT_BREAK')}
                style={{ borderRadius: '20px', padding: '6px 14px' }}
              >
                <Coffee size={14} />
                <span>Short Break ({shortBreakMinutes}m)</span>
              </button>
              <button
                className={`btn btn-sm ${mode === 'LONG_BREAK' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => switchMode('LONG_BREAK')}
                style={{ borderRadius: '20px', padding: '6px 14px' }}
              >
                <Award size={14} />
                <span>Long Break ({longBreakMinutes}m)</span>
              </button>
            </div>

            {/* Flexible Duration Presets & Stepper */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '16px', width: '100%', maxWidth: '380px' }}>
              {/* Quick Presets */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {mode === 'FOCUS' ? (
                  [15, 25, 30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setCustomFocusDuration(mins)}
                      className={`btn btn-sm ${focusMinutes === mins ? 'btn-secondary' : 'btn-ghost'}`}
                      style={{
                        fontSize: '0.74rem',
                        padding: '3px 10px',
                        borderRadius: '16px',
                        border: focusMinutes === mins ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                        color: focusMinutes === mins ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        fontWeight: focusMinutes === mins ? 700 : 500,
                      }}
                    >
                      {mins}m
                    </button>
                  ))
                ) : mode === 'SHORT_BREAK' ? (
                  [3, 5, 10, 15].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setCustomBreakDuration(mins)}
                      className={`btn btn-sm ${shortBreakMinutes === mins ? 'btn-secondary' : 'btn-ghost'}`}
                      style={{
                        fontSize: '0.74rem',
                        padding: '3px 10px',
                        borderRadius: '16px',
                        border: shortBreakMinutes === mins ? '1px solid var(--success-emerald)' : '1px solid var(--border-subtle)',
                        color: shortBreakMinutes === mins ? 'var(--success-emerald)' : 'var(--text-secondary)',
                        fontWeight: shortBreakMinutes === mins ? 700 : 500,
                      }}
                    >
                      {mins}m
                    </button>
                  ))
                ) : (
                  [10, 15, 20, 30].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setCustomLongBreakDuration(mins)}
                      className={`btn btn-sm ${longBreakMinutes === mins ? 'btn-secondary' : 'btn-ghost'}`}
                      style={{
                        fontSize: '0.74rem',
                        padding: '3px 10px',
                        borderRadius: '16px',
                        border: longBreakMinutes === mins ? '1px solid var(--success-emerald)' : '1px solid var(--border-subtle)',
                        color: longBreakMinutes === mins ? 'var(--success-emerald)' : 'var(--text-secondary)',
                        fontWeight: longBreakMinutes === mins ? 700 : 500,
                      }}
                    >
                      {mins}m
                    </button>
                  ))
                )}
              </div>

              {/* Custom Minutes Input & Steppers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Set Minutes:</span>
                <button
                  type="button"
                  onClick={() => adjustMinutes(-5)}
                  disabled={isRunning}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 8px', height: '26px', fontSize: '0.74rem' }}
                  title="Subtract 5 mins"
                >
                  -5m
                </button>
                <button
                  type="button"
                  onClick={() => adjustMinutes(-1)}
                  disabled={isRunning}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 6px', height: '26px', fontSize: '0.74rem' }}
                  title="Subtract 1 min"
                >
                  -1m
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'var(--surface-input)', border: '1px solid var(--border-secondary)', borderRadius: '6px', padding: '2px 6px' }}>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={mode === 'FOCUS' ? focusMinutes : mode === 'SHORT_BREAK' ? shortBreakMinutes : longBreakMinutes}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val > 0) {
                        if (mode === 'FOCUS') setCustomFocusDuration(val);
                        else if (mode === 'SHORT_BREAK') setCustomBreakDuration(val);
                        else setCustomLongBreakDuration(val);
                      }
                    }}
                    disabled={isRunning}
                    style={{
                      width: '44px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: '0.86rem',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>min</span>
                </div>
                <button
                  type="button"
                  onClick={() => adjustMinutes(1)}
                  disabled={isRunning}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 6px', height: '26px', fontSize: '0.74rem' }}
                  title="Add 1 min"
                >
                  +1m
                </button>
                <button
                  type="button"
                  onClick={() => adjustMinutes(5)}
                  disabled={isRunning}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 8px', height: '26px', fontSize: '0.74rem' }}
                  title="Add 5 mins"
                >
                  +5m
                </button>

                {isRunning && (
                  <button
                    type="button"
                    onClick={extendFiveMinutes}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 8px', height: '26px', fontSize: '0.72rem', gap: '3px', color: 'var(--accent-cyan)' }}
                    title="Add 5 minutes to current session"
                  >
                    <Plus size={12} />
                    <span>+5m more</span>
                  </button>
                )}
              </div>
            </div>

            {/* Huge Digital Clock Display */}
            <div
              style={{
                fontSize: 'clamp(3.8rem, 10vw, 5.2rem)',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: mode === 'FOCUS' ? 'var(--accent-cyan)' : 'var(--success-emerald)',
                letterSpacing: '2px',
                lineHeight: 1,
                margin: '8px 0 12px 0',
                textShadow: mode === 'FOCUS' ? '0 0 24px rgba(6, 182, 212, 0.25)' : '0 0 24px rgba(16, 185, 129, 0.25)',
              }}
            >
              {formatTime(timeLeft)}
            </div>

            {/* Focus Topic Indicator / Input */}
            <div style={{ margin: '4px 0 10px 0', width: '100%', maxWidth: '340px' }}>
              {focusTopic ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    background: 'rgba(6, 182, 212, 0.12)',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    borderRadius: '20px',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <Sparkles size={13} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Topic: {focusTopic}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateFocusTopic('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                    title="Clear topic"
                    aria-label="Clear topic"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={focusTopic}
                  onChange={(e) => updateFocusTopic(e.target.value)}
                  placeholder="Set focus topic / goal (optional)..."
                  className="input-field"
                  style={{ fontSize: '0.78rem', padding: '6px 12px', textAlign: 'center', width: '100%' }}
                />
              )}
            </div>

            <div style={{ margin: '8px 0 24px 0', width: '100%', maxWidth: '320px' }}>
              <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                CURRENT FOCUS SUBJECT
              </label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="input-field"
                style={{ fontSize: '0.82rem', padding: '8px 12px', width: '100%' }}
              >
                {courses.length > 0 ? (
                  courses.map((c) => {
                    const code = c.code || 'COURSE';
                    const title = c.title || code;
                    return (
                      <option key={code} value={code}>
                        {code} — {title}
                      </option>
                    );
                  })
                ) : (
                  <option value="GENERAL">General Self-Study &amp; Assignments</option>
                )}
              </select>
            </div>

            <div style={{ width: '100%', maxWidth: '340px', height: '6px', background: 'var(--surface-sunken)', borderRadius: '3px', overflow: 'hidden', marginBottom: '28px' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: mode === 'FOCUS' ? 'linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))' : 'var(--success-emerald)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'center' }}>
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`btn ${isRunning ? 'btn-secondary' : 'btn-primary'}`}
                style={{ height: '48px', padding: '0 28px', fontSize: '0.92rem', gap: '8px' }}
              >
                {isRunning ? <Pause size={18} /> : <Play size={18} />}
                <span>{isRunning ? 'Pause Session' : 'Start Focus'}</span>
              </button>

              <button
                onClick={resetTimer}
                className="btn btn-ghost"
                style={{ height: '48px', width: '48px', padding: 0 }}
                title="Reset timer"
                aria-label="Reset Timer"
              >
                <RotateCcw size={18} />
              </button>

              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="btn btn-ghost"
                style={{ height: '48px', width: '48px', padding: 0 }}
                title={soundEnabled ? 'Chime sound enabled' : 'Chime sound muted'}
                aria-label="Toggle sound"
              >
                {soundEnabled ? <Volume2 size={18} color="var(--accent-cyan)" /> : <VolumeX size={18} color="var(--text-muted)" />}
              </button>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card-header-bar">
              <div>
                <h3 className="card-title">
                  <Flame size={19} color="var(--accent-crimson)" />
                  <span>Pomodoro Technique Guidelines</span>
                </h3>
                <p className="card-description">Science-backed 25-minute intervals designed to eliminate exam cramming.</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '14px 16px', borderRadius: '8px', background: 'var(--surface-input)', border: '1px solid var(--border-subtle)', display: 'flex', gap: '12px' }}>
                <span style={{ fontSize: '1.2rem' }}>🎯</span>
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>1 Goal Per Pomodoro</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Pick one concrete module topic (e.g. solve 3 Dynamic Programming problems or read Module 2 lecture notes).
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: '8px', background: 'var(--surface-input)', border: '1px solid var(--border-subtle)', display: 'flex', gap: '12px' }}>
                <span style={{ fontSize: '1.2rem' }}>📵</span>
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>Zero Screen Distraction</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Put your phone on Do Not Disturb. If a random thought pops up, write it down and return to it during the 5-minute break.
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: '8px', background: 'var(--surface-input)', border: '1px solid var(--border-subtle)', display: 'flex', gap: '12px' }}>
                <span style={{ fontSize: '1.2rem' }}>☕</span>
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>Mandatory Physical Break</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    When the chime sounds, stand up, drink water, stretch, or look out the window. Give your eyes rest from screens.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'auto', padding: '12px 14px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Today's Total Focus Time:</span>
              <span style={{ fontSize: '0.90rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                {totalFocusMinutes} mins ({completedSessions} sessions)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FREE-SLOT WEEKLY STUDY SCHEDULER */}
      {activeTab === 'FREE_SLOTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Day of Week Selector */}
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <Calendar size={16} color="var(--accent-cyan)" />
                <span>Select Day of Week:</span>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    className={`btn btn-sm ${selectedDay === d ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                  >
                    {DAY_NAMES[d]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Study Session Hub: Set Topic & Timer At Any Time */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(139, 92, 246, 0.08))',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              padding: '16px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="var(--accent-cyan)" />
                <span style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                  Study Right Now — Set Topic &amp; Timer
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                Ready to study? Choose any duration and launch your focus session instantly.
              </span>
            </div>

            <form onSubmit={handleStartAnyTimeStudy} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>SUBJECT / COURSE</label>
                  <select
                    value={anyTimeCourse}
                    onChange={(e) => setAnyTimeCourse(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '0.80rem', padding: '8px 10px', width: '100%' }}
                  >
                    {courses.length > 0 ? (
                      courses.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.title}
                        </option>
                      ))
                    ) : (
                      <option value="GENERAL">General Self-Study</option>
                    )}
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>WHAT TOPIC ARE YOU STUDYING?</label>
                  <input
                    type="text"
                    value={anyTimeTopic}
                    onChange={(e) => setAnyTimeTopic(e.target.value)}
                    placeholder="e.g. Practice Chapter 3 problems, Unit 2 Quiz revision..."
                    className="input-field"
                    style={{ fontSize: '0.82rem', padding: '8px 12px', width: '100%' }}
                  />
                </div>
              </div>

              {/* Flexible Timer Presets & Stepper */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>SET TIMER:</span>
                  {[15, 25, 30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setAnyTimeDuration(mins)}
                      className={`btn btn-sm ${anyTimeDuration === mins ? 'btn-secondary' : 'btn-ghost'}`}
                      style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        height: '24px',
                        borderRadius: '12px',
                        border: anyTimeDuration === mins ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                        color: anyTimeDuration === mins ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        fontWeight: anyTimeDuration === mins ? 700 : 500,
                      }}
                    >
                      {mins}m
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setAnyTimeDuration((prev) => Math.max(1, prev - 5))}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 6px', height: '24px', fontSize: '0.70rem' }}
                    title="Subtract 5m"
                  >
                    -5m
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-input)', border: '1px solid var(--border-secondary)', borderRadius: '6px', padding: '2px 6px' }}>
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={anyTimeDuration}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v > 0) setAnyTimeDuration(v);
                      }}
                      style={{ width: '38px', background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.78rem', outline: 'none' }}
                    />
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>min</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAnyTimeDuration((prev) => Math.min(300, prev + 5))}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 6px', height: '24px', fontSize: '0.70rem' }}
                    title="Add 5m"
                  >
                    +5m
                  </button>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ padding: '0 18px', height: '34px', fontSize: '0.82rem', gap: '6px' }}
                >
                  <Play size={14} fill="currentColor" />
                  <span>Start Study Timer ({anyTimeDuration}m)</span>
                </button>
              </div>
            </form>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Free Timetable Slots Column */}
            <div className="card">
              <div className="card-header-bar">
                <div>
                  <h3 className="card-title">
                    <Clock size={19} color="var(--accent-cyan)" />
                    <span>Free Timetable Slots ({DAY_NAMES[selectedDay]})</span>
                  </h3>
                  <p className="card-description">
                    Gaps identified between your scheduled lecture and lab periods.
                  </p>
                </div>
              </div>

              {dailyFreeSlots.length === 0 ? (
                <div className="empty-state-card">
                  <CheckCircle2 size={24} color="var(--success-emerald)" />
                  <div className="empty-state-title">No Free Gaps Detected</div>
                  <p className="empty-state-desc">Full class schedule on this day.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {dailyFreeSlots.map((slot, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-input)',
                        border: activeSlotIdx === idx ? '1px solid var(--accent-cyan)' : '1px solid var(--border-card)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        transition: 'border-color 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                            {slot.start} – {slot.end}
                          </div>
                          <div style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {slot.label} ({slot.durationMinutes} minutes free)
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleSlotScheduler(idx, slot)}
                            className={`btn btn-sm ${activeSlotIdx === idx ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: '0.74rem', gap: '5px' }}
                          >
                            <Plus size={13} />
                            <span>{activeSlotIdx === idx ? 'Close Scheduler' : 'Schedule Topic'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => startFocusSession(courses[0]?.code || 'GENERAL', `${slot.label} Focus`, slot.durationMinutes <= 90 ? slot.durationMinutes : 45)}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.74rem', gap: '5px', color: 'var(--accent-cyan)', border: '1px solid rgba(6, 182, 212, 0.3)' }}
                            title={`Start focus timer for this slot`}
                          >
                            <Play size={12} fill="currentColor" />
                            <span>Start Timer ({slot.durationMinutes <= 90 ? slot.durationMinutes : 45}m)</span>
                          </button>
                        </div>
                      </div>

                      {/* Interactive Inline Scheduler Panel */}
                      {activeSlotIdx === idx && (
                        <div
                          style={{
                            padding: '14px 16px',
                            borderRadius: '8px',
                            background: 'var(--surface-sunken)',
                            border: '1px solid rgba(6, 182, 212, 0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            marginTop: '4px',
                          }}
                        >
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={13} color="var(--accent-cyan)" />
                            <span>Schedule Study Topic for {slot.start} – {slot.end}</span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                            <div>
                              <label style={{ fontSize: '0.70rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>SUBJECT / COURSE</label>
                              <select
                                value={slotCourse}
                                onChange={(e) => setSlotCourse(e.target.value)}
                                className="input-field"
                                style={{ fontSize: '0.78rem', padding: '6px 10px', width: '100%' }}
                              >
                                {courses.length > 0 ? (
                                  courses.map((c) => (
                                    <option key={c.code} value={c.code}>
                                      {c.code} — {c.title}
                                    </option>
                                  ))
                                ) : (
                                  <option value="GENERAL">General Self-Study</option>
                                )}
                              </select>
                            </div>

                            <div>
                              <label style={{ fontSize: '0.70rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>TOPIC / REVISION GOAL</label>
                              <input
                                type="text"
                                value={slotTopic}
                                onChange={(e) => setSlotTopic(e.target.value)}
                                placeholder="e.g. Practice Chapter 3 problems, review CAT notes"
                                className="input-field"
                                autoFocus
                                style={{ fontSize: '0.80rem', padding: '6px 10px', width: '100%' }}
                              />
                            </div>
                          </div>

                          {/* Timer Duration Selection */}
                          <div>
                            <label style={{ fontSize: '0.70rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                              SET TIMER DURATION FOR THIS TOPIC:
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              {[15, 25, 30, 45, 60, slot.durationMinutes].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((mins) => (
                                <button
                                  key={mins}
                                  type="button"
                                  onClick={() => setSlotDuration(mins)}
                                  className={`btn btn-sm ${slotDuration === mins ? 'btn-secondary' : 'btn-ghost'}`}
                                  style={{
                                    fontSize: '0.70rem',
                                    padding: '2px 8px',
                                    height: '24px',
                                    borderRadius: '12px',
                                    border: slotDuration === mins ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                                    color: slotDuration === mins ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                    fontWeight: slotDuration === mins ? 700 : 500,
                                  }}
                                >
                                  {mins === slot.durationMinutes ? `Full Slot (${mins}m)` : `${mins}m`}
                                </button>
                              ))}

                              <button
                                type="button"
                                onClick={() => setSlotDuration((prev) => Math.max(1, prev - 5))}
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 6px', height: '24px', fontSize: '0.70rem' }}
                                title="Subtract 5m"
                              >
                                -5m
                              </button>
                              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-input)', border: '1px solid var(--border-secondary)', borderRadius: '6px', padding: '2px 6px' }}>
                                <input
                                  type="number"
                                  min="1"
                                  max="300"
                                  value={slotDuration}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value, 10);
                                    if (!isNaN(v) && v > 0) setSlotDuration(v);
                                  }}
                                  style={{ width: '38px', background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.78rem', outline: 'none' }}
                                />
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>min</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSlotDuration((prev) => Math.min(300, prev + 5))}
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 6px', height: '24px', fontSize: '0.70rem' }}
                                title="Add 5m"
                              >
                                +5m
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                            <button
                              type="button"
                              onClick={() => setActiveSlotIdx(null)}
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '0.74rem' }}
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              disabled={!slotTopic.trim()}
                              onClick={() => handleSaveSlotPlan(slot, false)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.74rem', gap: '4px' }}
                            >
                              <CheckSquare size={13} />
                              <span>Save to Schedule</span>
                            </button>

                            <button
                              type="button"
                              disabled={!slotTopic.trim()}
                              onClick={() => handleSaveSlotPlan(slot, true)}
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: '0.74rem', gap: '5px' }}
                            >
                              <Play size={13} fill="currentColor" />
                              <span>Start Timer Now ({slotDuration}m)</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scheduled Revision Blocks Column */}
            <div className="card">
              <div className="card-header-bar">
                <div>
                  <h3 className="card-title">
                    <BookOpen size={19} color="var(--accent-purple)" />
                    <span>Scheduled Revision Blocks</span>
                  </h3>
                  <p className="card-description">Your planned study goals for {DAY_NAMES[selectedDay]}.</p>
                </div>
              </div>

              {/* Add Custom Revision Block Form */}
              <form onSubmit={(e) => addCustomStudyPlan(e, false)} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select
                    value={newPlanCourse}
                    onChange={(e) => setNewPlanCourse(e.target.value)}
                    className="input-field"
                    style={{ flex: 1, minWidth: '130px', fontSize: '0.80rem' }}
                  >
                    {courses.length > 0 ? (
                      courses.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.title}
                        </option>
                      ))
                    ) : (
                      <option value="GENERAL">General Self-Study</option>
                    )}
                  </select>

                  <input
                    type="text"
                    value={newPlanTime}
                    onChange={(e) => setNewPlanTime(e.target.value)}
                    placeholder="Time (e.g. 11:40 AM - 1:00 PM)"
                    className="input-field"
                    style={{ flex: 1, minWidth: '140px', fontSize: '0.80rem' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newPlanTopic}
                    onChange={(e) => setNewPlanTopic(e.target.value)}
                    placeholder="Revision Goal (e.g. Practice Chapter 3 problems)"
                    className="input-field"
                    style={{ flex: 1, fontSize: '0.82rem' }}
                  />
                </div>

                {/* Target Timer Duration Selector */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>Timer:</span>
                    {[15, 25, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setNewPlanDuration(mins)}
                        className={`btn btn-sm ${newPlanDuration === mins ? 'btn-secondary' : 'btn-ghost'}`}
                        style={{
                          fontSize: '0.70rem',
                          padding: '1px 6px',
                          height: '22px',
                          borderRadius: '10px',
                          border: newPlanDuration === mins ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                          color: newPlanDuration === mins ? 'var(--accent-purple)' : 'var(--text-secondary)',
                          fontWeight: newPlanDuration === mins ? 700 : 500,
                        }}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="submit" className="btn btn-secondary btn-sm" style={{ fontSize: '0.74rem', gap: '4px' }}>
                      <Plus size={13} />
                      <span>Add Goal</span>
                    </button>
                    <button
                      type="button"
                      disabled={!newPlanTopic.trim()}
                      onClick={(e) => addCustomStudyPlan(e, true)}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.74rem', gap: '4px' }}
                    >
                      <Play size={12} fill="currentColor" />
                      <span>Start ({newPlanDuration}m)</span>
                    </button>
                  </div>
                </div>
              </form>

              {customPlans.filter((p) => p.day === selectedDay).length === 0 ? (
                <div className="empty-state-card" style={{ padding: '24px' }}>
                  <div className="empty-state-title" style={{ fontSize: '0.88rem' }}>No study goals added for {DAY_NAMES[selectedDay]}</div>
                  <p className="empty-state-desc" style={{ fontSize: '0.76rem' }}>
                    Click "Schedule Topic" on any free gap above to allocate your study time.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {customPlans
                    .filter((p) => p.day === selectedDay)
                    .map((p) => (
                      <div
                        key={p.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          background: 'var(--surface-input)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                          <button
                            onClick={() => togglePlanDone(p.id)}
                            style={{ color: p.completed ? 'var(--success-emerald)' : 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                            aria-label="Toggle plan completion"
                          >
                            {p.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: p.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: p.completed ? 'line-through' : 'none', wordBreak: 'break-word' }}>
                              <span style={{ color: 'var(--accent-purple)', marginRight: '6px' }}>[{p.courseCode}]</span>
                              {p.topic}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span>{p.timeSlot}</span>
                              <span>•</span>
                              <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                ⏱️ {p.durationMinutes || 25} mins
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => startFocusSession(p.courseCode, p.topic, p.durationMinutes || 25)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.72rem', gap: '4px', color: 'var(--accent-cyan)', border: '1px solid rgba(6, 182, 212, 0.3)' }}
                            title="Start study timer for this topic"
                          >
                            <Play size={11} fill="currentColor" />
                            <span>Start ({p.durationMinutes || 25}m)</span>
                          </button>

                          <button
                            onClick={() => deletePlan(p.id)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px', color: 'var(--accent-crimson)' }}
                            title="Delete plan"
                            aria-label="Delete plan"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EXAM REVISION RADAR & TASKS */}
      {activeTab === 'TASKS' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <BrainCircuit size={19} color="var(--accent-purple)" />
                <span>Calibrated Academic Targets &amp; Priorities</span>
              </h3>
              <p className="card-description">
                Subjects requiring immediate attention based on verified VTOP internal scores, attendance deficit, and CAT/FAT exams.
              </p>
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="empty-state-card">
              <CheckCircle2 size={26} color="var(--success-emerald)" />
              <div className="empty-state-title">All Academic Targets Safe!</div>
              <p className="empty-state-desc">Your attendance and marks across all courses are safely buffered above required thresholds.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {tasks.map((task) => {
                const isDone = completedTaskIds.includes(task.id);
                const isHigh = (task.urgency || '').toUpperCase() === 'HIGH';

                return (
                  <div
                    key={task.id}
                    style={{
                      padding: '18px 20px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--surface-input)',
                      border: '1px solid var(--border-card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '260px' }}>
                      <button
                        onClick={() => toggleTaskDone(task.id)}
                        style={{ color: isDone ? 'var(--success-emerald)' : 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
                        aria-label="Toggle task status"
                      >
                        {isDone ? <CheckSquare size={20} /> : <Square size={20} />}
                      </button>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.80rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-purple)' }}>
                            {task.courseCode || task.subjectCode || 'COURSE'}
                          </span>
                          <span className={`status-badge ${isHigh ? 'critical' : 'warning'}`}>
                            {task.urgency} Priority
                          </span>
                          {(task.courseTitle || task.subjectTitle) && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              • {task.courseTitle || task.subjectTitle}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.98rem', fontWeight: 700, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none', marginTop: '4px' }}>
                          {task.headline}
                        </div>

                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {task.reason || task.actionReason}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() =>
                          startFocusSession(
                            task.courseCode || task.subjectCode || '',
                            task.headline,
                            25
                          )
                        }
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.76rem', gap: '6px' }}
                      >
                        <Zap size={13} color="var(--accent-cyan)" />
                        <span>Start Pomodoro</span>
                      </button>

                      <span className={`status-badge ${isDone ? 'safe' : 'neutral'}`}>
                        {isDone ? 'Completed ✓' : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIPlannerView;

