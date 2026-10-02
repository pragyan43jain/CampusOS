import { useMemo, useState, useEffect } from "react";
import { RefreshCcw, Calendar as CalendarIcon } from "lucide-react";
import { MonthCalendar, CalendarDay, CalendarResponse } from "../types";
import { CampusAPI } from "../services/api";

export const CALENDAR_TYPES: Record<string, string> = {
  ALL: "General Semester",
  ALL02: "General Flexible",
  ALL03: "General Freshers",
  ALL05: "General LAW",
  ALL06: "Flexible Freshers",
  ALL08: "Cohort LAW",
  ALL11: "Flexible Research",
  WEI: "Weekend Intra Semester",
};

const HOLIDAY_KEYWORDS = [
  "holiday", "pooja", "puja", "ayudha", "diwali", "deepavali", "pongal", "eid", "christmas", "good friday",
  "independence", "republic", "onam", "holi", "ramadan", "ganesh", "maha shivaratri", "vesak",
  "vacation", "term end", "no instructional", "noinstructional", "vinayakar chathurthi", "gandhi jayanthi",
  "thaipoosam", "telugu", "tamil", "ambedkar"
];

function normalize(str = ""): string {
  return String(str).toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

function isHolidayEvent(e: any): boolean {
  if (!e) return false;
  const type = String(e.type || "").toLowerCase();
  const text = normalize(e.text || "");
  const cat = normalize(e.category || "");
  if (type.includes("holiday")) return true;
  if (type.includes("no instructional")) return true;
  if (cat.includes("no instructional")) return true;
  for (const kw of HOLIDAY_KEYWORDS) {
    if (text.includes(kw) || cat.includes(kw)) return true;
  }
  return false;
}

function isInstructionalEvent(e: any): boolean {
  if (!e) return false;
  const type = String(e.type || "").toLowerCase();
  const cat = normalize(e.category || "");
  if (type === "instructional day") return true;
  if (cat.includes("working")) return true;
  return false;
}

// Date helpers mirroring date-fns without external package dependency
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function eachDayOfInterval({ start, end }: { start: Date; end: Date }): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getDay(date: Date): number {
  return date.getDay();
}

export interface CalendarDayDetails {
  dayType: "instructional" | "holiday" | "exam" | "fest" | "weekend";
  badgeLabel: string;
  badgeCol: string;
  badgeBg: string;
  bgCol: string;
  borderCol: string;
  primaryDetail: string;
  secondaryDetail?: string;
  fullDescription: string;
}

export function resolveCalendarDayDetails(
  _dayNum: number,
  dayInfo: CalendarDay | undefined,
  _year: number,
  _monthIndex: number,
  _examMap?: any
): CalendarDayDetails {
  const events = dayInfo?.events || [];
  const hasHoliday = events.some(isHolidayEvent);
  const hasInstructional = events.some(isInstructionalEvent);
  const isEmpty = events.length === 0;

  const semiHolidayEvents = ["CAT - I", "CAT - II", "TechnoVIT", "Vibrance"];
  const hasSemiHoliday = events.some((e: any) =>
    semiHolidayEvents.some((keyword) =>
      (e.text || "").toLowerCase().includes(keyword.toLowerCase()) ||
      (e.category || "").toLowerCase().includes(keyword.toLowerCase())
    )
  );

  let dayType: "semiholiday" | "holiday" | "instructional" | "other" = "other";
  if (hasSemiHoliday) dayType = "semiholiday";
  else if (hasHoliday || isEmpty || (!hasInstructional && events.length > 0)) dayType = "holiday";
  else if (hasInstructional) dayType = "instructional";

  if (dayType === "semiholiday") {
    return {
      dayType: "fest",
      badgeLabel: "On Campus",
      badgeCol: "#ca8a04",
      badgeBg: "rgba(234, 179, 8, 0.2)",
      bgCol: "rgba(234, 179, 8, 0.08)",
      borderCol: "rgba(234, 179, 8, 0.3)",
      primaryDetail: events[1]?.category || events[1]?.text || events[0]?.text || "On Campus Event",
      fullDescription: "Campus Event / Continuous Assessment day.",
    };
  }

  if (dayType === "holiday") {
    return {
      dayType: "holiday",
      badgeLabel: "Holiday",
      badgeCol: "#dc2626",
      badgeBg: "rgba(239, 68, 68, 0.2)",
      bgCol: "rgba(239, 68, 68, 0.08)",
      borderCol: "rgba(239, 68, 68, 0.3)",
      primaryDetail: events[1]?.category || events[0]?.text || "University Holiday",
      fullDescription: "Holiday / Non-instructional day.",
    };
  }

  return {
    dayType: "instructional",
    badgeLabel: "Working",
    badgeCol: "#16a34a",
    badgeBg: "rgba(22, 163, 74, 0.2)",
    bgCol: "rgba(22, 163, 74, 0.08)",
    borderCol: "rgba(22, 163, 74, 0.3)",
    primaryDetail: events[1]?.category || events[1]?.text || "Instructional Day",
    fullDescription: "Regular instructional working day.",
  };
}

export interface CalendarViewProps {
  calendars?: any;
  initialCalendars?: MonthCalendar[];
  calendarType?: string;
  handleCalendarFetch?: (type: string) => void | Promise<void>;
  onCalendarTypeChange?: (newType: string) => void;
  exams?: any;
  attendance?: any[];
}

export function CalendarView({
  calendars,
  initialCalendars,
  calendarType = "ALL",
  handleCalendarFetch,
  onCalendarTypeChange,
}: CalendarViewProps) {
  const [internalCalendars, setInternalCalendars] = useState<any>(calendars || initialCalendars || null);
  const [currentType, setCurrentType] = useState<string>(calendarType || "ALL");
  const [loading, setLoading] = useState<boolean>(false);

  // Sync props if parent updates them
  useEffect(() => {
    if (calendars) setInternalCalendars(calendars);
    else if (initialCalendars) setInternalCalendars(initialCalendars);
  }, [calendars, initialCalendars]);

  // Built-in calendar fetcher if parent did not provide handleCalendarFetch
  const executeCalendarFetch = async (typeToFetch: string) => {
    if (handleCalendarFetch) {
      handleCalendarFetch(typeToFetch);
      return;
    }
    setLoading(true);
    try {
      const data: CalendarResponse = await CampusAPI.getCalendar(undefined, typeToFetch);
      if (data && data.calendars && data.calendars.length > 0) {
        setInternalCalendars(data.calendars);
        setCurrentType(typeToFetch);
        if (onCalendarTypeChange) {
          onCalendarTypeChange(typeToFetch);
        }
      }
    } catch (err) {
      console.error("[CalendarView] Failed to fetch academic calendar from VTOP:", err);
    } finally {
      setLoading(false);
    }
  };

  // If no calendar data exists at all on mount, trigger automatic fetch
  useEffect(() => {
    if (!internalCalendars || (Array.isArray(internalCalendars) && internalCalendars.length === 0)) {
      executeCalendarFetch(currentType);
    }
  }, []);

  const safeCalendars = useMemo(() => {
    const src = internalCalendars || calendars || initialCalendars;
    if (!src) return [];
    if (Array.isArray(src)) return src;
    if (src.calendars && Array.isArray(src.calendars)) return src.calendars;
    return [src];
  }, [internalCalendars, calendars, initialCalendars]);

  const [activeIdx, setActiveIdx] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("calendar-active-index");
      return saved ? Number(saved) || 0 : 0;
    }
    return 0;
  });

  useEffect(() => {
    localStorage.setItem("calendar-active-index", String(activeIdx));
  }, [activeIdx]);

  const activeCalendar = safeCalendars[activeIdx] || {};
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const { year, monthIndex } = useMemo(() => {
    const now = new Date();

    const MONTH_NAME_MAP: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    const rawMonth = String(activeCalendar.month || "").trim();
    const match = rawMonth.match(/([a-zA-Z]+)\s+(\d{4})/);

    let parsedMonthIndex = now.getMonth();
    let parsedYear = now.getFullYear();

    if (match) {
      const monthName = match[1].toLowerCase().slice(0, 3);
      parsedMonthIndex = MONTH_NAME_MAP[monthName] ?? parsedMonthIndex;
      parsedYear = parseInt(match[2], 10);
    }

    return {
      year: parsedYear,
      monthIndex: parsedMonthIndex,
    };
  }, [activeCalendar.month]);

  if (!safeCalendars.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400">
        <CalendarIcon className="w-12 h-12 mb-3 opacity-60 text-blue-500" />
        <p className="text-base font-semibold text-gray-200">No Academic Calendar Found</p>
        <p className="text-xs text-gray-400 mt-1">Please reload or query VTOP academic calendar.</p>
        <button
          onClick={() => executeCalendarFetch(currentType)}
          disabled={loading}
          className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center gap-2"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Fetching..." : "Fetch Calendar"}</span>
        </button>
      </div>
    );
  }

  let monthStart = new Date(year, monthIndex, 1);
  let daysInMonth: Date[] = [];
  try {
    const monthEnd = endOfMonth(monthStart);
    daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  } catch {
    const totalDays = Number(activeCalendar.totalDays) || 31;
    daysInMonth = Array.from({ length: totalDays }, (_, i) => new Date(year, monthIndex, i + 1));
  }

  const firstDay = getDay(monthStart);
  const blanksCount = (firstDay + 6) % 7;
  const blanks = Array.from({ length: blanksCount }, (_, i) => i);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* 1. Header with Calendar Type and Refresh Button */}
      <h1 className="text-lg font-semibold mb-3 text-center text-gray-800 dark:text-gray-100 midnight:text-gray-100 flex items-center justify-center gap-2">
        <span>Academic Calendar ({CALENDAR_TYPES[currentType] || currentType})</span>
        <button
          onClick={() => executeCalendarFetch(currentType)}
          disabled={loading}
          title="Refresh calendar from VTOP"
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center justify-center"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </h1>

      {/* 2. Month Selector Tabs */}
      <div className="flex gap-2 mb-3 justify-center flex-wrap">
        {safeCalendars.map((calendar: any, idx: number) => (
          <button
            key={calendar.id || calendar.month || idx}
            onClick={() => setActiveIdx(idx)}
            className={`px-4 py-2 rounded-md text-sm md:text-base font-medium transition-colors duration-150 ${
              idx === activeIdx
                ? "bg-blue-600 text-white dark:bg-blue-700 midnight:bg-blue-800"
                : "bg-gray-200 text-gray-700 hover:bg-blue-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 midnight:bg-black midnight:text-gray-200 midnight:hover:bg-gray-800 midnight:outline midnight:outline-1 midnight:outline-gray-800"
            }`}
          >
            {calendar.month ?? "Month"} {calendar.year ?? ""}
          </button>
        ))}
      </div>

      {/* 3. Calendar Grid for Selected Month */}
      <div data-scrollable key={activeIdx} className="w-full">
        <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800 dark:text-gray-100 midnight:text-gray-200">
          {activeCalendar.month ?? monthStart.toLocaleString(undefined, { month: "long" })}
        </h2>

        <div className="overflow-x-auto">
          <div className="w-full min-w-[950px] grid grid-cols-7 text-center border-collapse">
            {weekdays.map((day) => (
              <div
                key={day}
                className="font-semibold py-2 border-b text-gray-700 dark:text-gray-200 midnight:text-gray-100 bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900"
              >
                {day}
              </div>
            ))}

            {blanks.map((_, i) => (
              <div key={`blank-${i}`} className="h-36" />
            ))}

            {daysInMonth.map((dateObj) => {
              const date = dateObj.getDate();
              const dayInfo = Array.isArray(activeCalendar.days)
                ? activeCalendar.days.find((d: any) => Number(d.date) === date)
                : undefined;
              const events = dayInfo?.events || [];

              const hasHoliday = events.some(isHolidayEvent);
              const hasInstructional = events.some(isInstructionalEvent);
              const isEmpty = events.length === 0;
              const isToday = isCurrentMonth && dateObj.getDate() === today.getDate();

              const semiHolidayEvents = ["CAT - I", "CAT - II", "TechnoVIT", "Vibrance"];
              const hasSemiHoliday = events.some((e: any) =>
                semiHolidayEvents.some((keyword) =>
                  (e.text || "").toLowerCase().includes(keyword.toLowerCase()) ||
                  (e.category || "").toLowerCase().includes(keyword.toLowerCase())
                )
              );

              let dayType = "other";
              if (hasSemiHoliday) dayType = "semiholiday";
              else if (hasHoliday || isEmpty || (!hasInstructional && events.length > 0)) dayType = "holiday";
              else if (hasInstructional) dayType = "instructional";

              const bgClass =
                dayType === "holiday"
                  ? "bg-red-50 dark:bg-red-900/30 midnight:bg-red-900/30"
                  : dayType === "instructional"
                  ? "bg-green-50 dark:bg-green-900/30 midnight:bg-green-900/30"
                  : dayType === "semiholiday"
                  ? "bg-yellow-50 dark:bg-yellow-900/30 midnight:bg-yellow-900/30"
                  : "bg-gray-50 dark:bg-gray-900/30 midnight:bg-gray-900/30";

              // Events to render as badge pills
              const eventsToRender =
                events.length > 1
                  ? events.slice(1)
                  : events.length === 1 && !events[0].text?.toLowerCase().includes("instructional day")
                  ? events
                  : [];

              return (
                <div
                  key={date}
                  className={`relative flex flex-col items-start justify-start p-3 h-42 shadow-sm border border-gray-200 dark:border-gray-800 ${bgClass} ${
                    isToday
                      ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 midnight:ring-offset-black"
                      : ""
                  }`}
                >
                  <div className="w-full flex items-center justify-between">
                    <div className="text-lg font-bold text-left text-gray-800 dark:text-gray-100 midnight:text-gray-200">
                      {date}
                    </div>
                    <div
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        dayType === "holiday"
                          ? "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100 midnight:bg-red-900 midnight:text-red-200"
                          : dayType === "instructional"
                          ? "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100 midnight:bg-green-900 midnight:text-green-200"
                          : dayType === "semiholiday"
                          ? "bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100 midnight:bg-yellow-900 midnight:text-yellow-200"
                          : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 midnight:bg-gray-800 midnight:text-gray-200"
                      }`}
                    >
                      {dayType === "holiday"
                        ? "Holiday"
                        : dayType === "instructional"
                        ? "Working"
                        : dayType === "semiholiday"
                        ? "On Campus"
                        : "Other"}
                    </div>
                  </div>

                  <div className="mt-2 w-full text-left overflow-y-auto max-h-32">
                    {eventsToRender.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300 midnight:text-gray-200">
                        {eventsToRender.map((e: any, i: number) => {
                          const tagClass = isHolidayEvent(e)
                            ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-800/40 dark:text-red-200 midnight:bg-red-950/40 midnight:text-red-300"
                            : isInstructionalEvent(e)
                            ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-800/40 dark:text-green-200 midnight:bg-green-950/40 midnight:text-green-300"
                            : "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-800/40 dark:text-yellow-200 midnight:bg-yellow-950/40 midnight:text-yellow-300";
                          const label = e.category && e.category !== "General" ? e.category : e.text;
                          const parts = String(label)
                            .split("/")
                            .map((p: string) => p.trim())
                            .filter(Boolean);
                          return parts.map((p: string, j: number) => (
                            <li
                              key={`${i}-${j}`}
                              className={`inline-block px-2 py-1 rounded border ${tagClass} mr-1 mb-1`}
                              title={e.text}
                            >
                              {p.replace(/^\(|\)$/g, "")}
                            </li>
                          ));
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. UniCC Calendar Type Switcher Wrapper */}
      <CalendarTabWrapper
        calendarType={currentType}
        handleCalendarFetch={executeCalendarFetch}
        loading={loading}
      />
    </div>
  );
}

function CalendarTabWrapper({
  calendarType,
  handleCalendarFetch,
  loading,
}: {
  calendarType?: string;
  handleCalendarFetch: (type: string) => void | Promise<void>;
  loading?: boolean;
}) {
  const [selectedType, setSelectedType] = useState<string>(calendarType || "ALL");

  useEffect(() => {
    if (calendarType) setSelectedType(calendarType);
  }, [calendarType]);

  function handleSubmitCalendarType() {
    handleCalendarFetch(selectedType);
  }

  return (
    <div className="flex flex-col items-center justify-center gap-5 p-6 text-center mt-6 border-t border-gray-200 dark:border-gray-800">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 midnight:text-gray-100">
        Select Calendar Type
      </h2>

      <select
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value)}
        className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 
                   dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100
                   midnight:bg-[#0f172a] midnight:text-gray-100
                   focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
      >
        {Object.entries(CALENDAR_TYPES).map(([value, label]) => (
          <option key={value} value={value}>
            {label} ({value})
          </option>
        ))}
      </select>

      <button
        onClick={handleSubmitCalendarType}
        disabled={loading}
        className="px-6 py-2 rounded-md font-medium text-white bg-blue-600 hover:bg-blue-700 
                   dark:bg-blue-500 dark:hover:bg-blue-600
                   transition shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
      >
        {loading ? "Switching..." : "Submit"}
      </button>
    </div>
  );
}

export default CalendarView;
