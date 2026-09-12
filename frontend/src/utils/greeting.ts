/**
 * Dynamic greeting generator inspired by Claude (claude.ai)
 * Checks the current time of day and returns a warm, context-aware intro phrase
 * with occasional playful return variations ("Here comes [Name]!", "[Name] returns!").
 */

export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Categorizes a given 24-hour hour into a time period
 * 05:00 - 11:59 -> morning
 * 12:00 - 16:59 -> afternoon
 * 17:00 - 21:59 -> evening
 * 22:00 - 04:59 -> night
 */
export function getTimePeriod(hour: number): TimePeriod {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

/**
 * Returns contextual time-of-day greetings
 */
export function getTimeGreetings(name: string, period: TimePeriod): string[] {
  switch (period) {
    case 'morning':
      return [
        `Good morning, ${name}`,
        `Welcome back, ${name}`,
        `Good to see you, ${name}`,
        `Ready to get started, ${name}?`,
      ];
    case 'afternoon':
      return [
        `Good afternoon, ${name}`,
        `Hope your day is going well, ${name}`,
        `Welcome back, ${name}`,
        `Good to see you, ${name}`,
      ];
    case 'evening':
      return [
        `Good evening, ${name}`,
        `Hope you had a good day, ${name}`,
        `Welcome back, ${name}`,
        `Good to see you, ${name}`,
      ];
    case 'night':
      return [
        `Good evening, ${name}`,
        `Burning the midnight oil, ${name}?`,
        `Working late tonight, ${name}?`,
        `Welcome back, ${name}`,
      ];
  }
}

/**
 * Returns playful Claude-inspired character & return variations
 * Featuring phrases explicitly requested by user:
 * - "Here comes [Name]!"
 * - "[Name] returns!"
 */
export function getPlayfulReturnGreetings(name: string): string[] {
  return [
    `Here comes ${name}!`,
    `${name} returns!`,
    `Welcome back, ${name}`,
    `Good to see you, ${name}`,
  ];
}

/**
 * Generates a greeting.
 * ~35% chance of selecting a playful return greeting ("Here comes Name!", "Name returns!"),
 * ~65% chance of selecting a time-of-day greeting.
 */
export function generateGreeting(name: string, hour?: number): string {
  const currentHour = hour !== undefined ? hour : new Date().getHours();
  const period = getTimePeriod(currentHour);
  const timePool = getTimeGreetings(name, period);
  const playfulPool = getPlayfulReturnGreetings(name);

  // 35% probability of playful/return greeting, 65% time-based
  const showPlayful = Math.random() < 0.35;
  if (showPlayful) {
    const idx = Math.floor(Math.random() * playfulPool.length);
    return playfulPool[idx];
  } else {
    const idx = Math.floor(Math.random() * timePool.length);
    return timePool[idx];
  }
}

/**
 * Cycles to a different greeting distinct from the current one
 */
export function cycleNextGreeting(current: string, name: string, hour?: number): string {
  const currentHour = hour !== undefined ? hour : new Date().getHours();
  const period = getTimePeriod(currentHour);
  const combined = [...getPlayfulReturnGreetings(name), ...getTimeGreetings(name, period)];
  const remaining = combined.filter((g) => g !== current);
  if (remaining.length === 0) return current;
  const idx = Math.floor(Math.random() * remaining.length);
  return remaining[idx];
}

/**
 * Gets or stores a session-stable greeting so it doesn't flicker during navigation,
 * with support for force-refreshing when clicked or re-rolled.
 */
export function getSessionGreeting(name: string, forceNew = false, hour?: number): string {
  if (!name) return 'Welcome to CampusOS';

  if (typeof window === 'undefined') {
    return generateGreeting(name, hour);
  }

  const storageKey = `campus_session_greeting_${name}`;
  if (!forceNew) {
    try {
      const cached = sessionStorage.getItem(storageKey);
      // Invalidate any legacy/tacky cached greetings
      if (
        cached &&
        !cached.includes('🦉') &&
        !cached.toLowerCase().includes('night owl') &&
        !cached.toLowerCase().includes('grind') &&
        !cached.toLowerCase().includes('focus mode')
      ) {
        return cached;
      }
    } catch (e) {
      // sessionStorage unavailable
    }
  }

  const fresh = generateGreeting(name, hour);
  try {
    sessionStorage.setItem(storageKey, fresh);
  } catch (e) {}
  return fresh;
}
