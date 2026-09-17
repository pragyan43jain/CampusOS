import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getTimePeriod,
  getTimeGreetings,
  getPlayfulReturnGreetings,
  isGreetingValidForPeriod,
  generateGreeting,
  getSessionGreeting,
  cycleNextGreeting,
} from './greeting.ts';

describe('Greeting Utility - Time Period Determination', () => {
  it('correctly classifies morning hours (05:00 - 11:59)', () => {
    assert.strictEqual(getTimePeriod(5), 'morning');
    assert.strictEqual(getTimePeriod(8), 'morning');
    assert.strictEqual(getTimePeriod(11), 'morning');
  });

  it('correctly classifies afternoon hours (12:00 - 16:59)', () => {
    assert.strictEqual(getTimePeriod(12), 'afternoon');
    assert.strictEqual(getTimePeriod(14), 'afternoon');
    assert.strictEqual(getTimePeriod(16), 'afternoon');
  });

  it('correctly classifies evening hours (17:00 - 20:59)', () => {
    assert.strictEqual(getTimePeriod(17), 'evening');
    assert.strictEqual(getTimePeriod(19), 'evening'); // 19:36
    assert.strictEqual(getTimePeriod(20), 'evening');
  });

  it('correctly classifies night hours (21:00 - 04:59)', () => {
    assert.strictEqual(getTimePeriod(21), 'night');
    assert.strictEqual(getTimePeriod(23), 'night');
    assert.strictEqual(getTimePeriod(0), 'night');
    assert.strictEqual(getTimePeriod(3), 'night');
    assert.strictEqual(getTimePeriod(4), 'night');
  });
});

describe('Greeting Utility - Strict Period Compatibility', () => {
  it('rejects Good morning during evening or night', () => {
    assert.strictEqual(isGreetingValidForPeriod('Good morning, Pragyan', 'evening'), false);
    assert.strictEqual(isGreetingValidForPeriod('Good morning, Pragyan', 'night'), false);
    assert.strictEqual(isGreetingValidForPeriod('Good morning, Pragyan', 'afternoon'), false);
    assert.strictEqual(isGreetingValidForPeriod('Good morning, Pragyan', 'morning'), true);
  });

  it('rejects Good afternoon during morning, evening or night', () => {
    assert.strictEqual(isGreetingValidForPeriod('Good afternoon, Pragyan', 'morning'), false);
    assert.strictEqual(isGreetingValidForPeriod('Good afternoon, Pragyan', 'evening'), false);
    assert.strictEqual(isGreetingValidForPeriod('Good afternoon, Pragyan', 'night'), false);
    assert.strictEqual(isGreetingValidForPeriod('Good afternoon, Pragyan', 'afternoon'), true);
  });

  it('accepts evening and night greetings appropriately', () => {
    assert.strictEqual(isGreetingValidForPeriod('Good evening, Pragyan', 'evening'), true);
    assert.strictEqual(isGreetingValidForPeriod('Good evening, Pragyan', 'night'), true);
    assert.strictEqual(isGreetingValidForPeriod('Good evening, Pragyan', 'morning'), false);

    assert.strictEqual(isGreetingValidForPeriod('Working late tonight, Pragyan?', 'night'), true);
    assert.strictEqual(isGreetingValidForPeriod('Working late tonight, Pragyan?', 'evening'), false);
    assert.strictEqual(isGreetingValidForPeriod('Working late tonight, Pragyan?', 'morning'), false);
  });

  it('accepts playful time-agnostic greetings anytime', () => {
    assert.strictEqual(isGreetingValidForPeriod('Welcome back, Pragyan', 'evening'), true);
    assert.strictEqual(isGreetingValidForPeriod('Here comes Pragyan!', 'evening'), true);
    assert.strictEqual(isGreetingValidForPeriod('Pragyan returns!', 'night'), true);
    assert.strictEqual(isGreetingValidForPeriod('Good to see you, Pragyan', 'morning'), true);
  });
});

describe('Greeting Utility - Stale Session Storage Eviction', () => {
  it('evicts stale morning greeting from sessionStorage when accessed at evening/night', () => {
    const store = new Map<string, string>();
    (globalThis as any).window = {};
    (globalThis as any).sessionStorage = {
      getItem: (k: string) => store.get(k) || null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    };

    // Stale morning greeting in storage
    store.set('campus_session_greeting_Pragyan', 'Good morning, Pragyan');

    // Accessed at 19:36 (hour 19)
    for (let i = 0; i < 25; i++) {
      const g = getSessionGreeting('Pragyan', false, 19);
      assert.ok(
        !g.toLowerCase().includes('morning'),
        `Greeting at hour 19 must NEVER say morning! Got: "${g}"`
      );
    }

    // Accessed at 22:00 (hour 22, night)
    store.set('campus_session_greeting_Pragyan', 'Good morning, Pragyan');
    for (let i = 0; i < 25; i++) {
      const g = getSessionGreeting('Pragyan', false, 22);
      assert.ok(
        !g.toLowerCase().includes('morning'),
        `Greeting at hour 22 must NEVER say morning! Got: "${g}"`
      );
    }
  });
});
