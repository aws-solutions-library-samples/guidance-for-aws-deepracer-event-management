import { describe, expect, it } from 'vitest';
import { deriveCountryMetric } from './countryMetric';

const fixture = [
  { countryCode: 'GB', events: 10, racers: 50, laps: 200 },
  { countryCode: 'US', events: 4, racers: 12, laps: 100 },
  { countryCode: 'JP', events: 0, racers: 0, laps: 0 }, // defensive: server normally excludes these
];

describe('deriveCountryMetric', () => {
  it('returns events as value when metric is "events"', () => {
    const out = deriveCountryMetric(fixture, 'events');
    expect(out.map((r) => r.value)).toEqual([10, 4, 0]);
  });

  it('returns laps as value when metric is "laps"', () => {
    const out = deriveCountryMetric(fixture, 'laps');
    expect(out.map((r) => r.value)).toEqual([200, 100, 0]);
  });

  it('returns laps/events as value when metric is "avgLapsPerEvent"', () => {
    const out = deriveCountryMetric(fixture, 'avgLapsPerEvent');
    expect(out[0].value).toBe(20); // 200 / 10
    expect(out[1].value).toBe(25); // 100 / 4
  });

  it('returns 0 (not NaN) when events is 0 and metric is "avgLapsPerEvent"', () => {
    const out = deriveCountryMetric(fixture, 'avgLapsPerEvent');
    expect(out[2].value).toBe(0);
  });

  it('preserves countryCode + raw events/racers/laps in every output row', () => {
    const out = deriveCountryMetric(fixture, 'laps');
    expect(out[0]).toEqual({
      countryCode: 'GB',
      value: 200,
      events: 10,
      racers: 50,
      laps: 200,
    });
  });

  it('preserves input order', () => {
    const out = deriveCountryMetric(fixture, 'events');
    expect(out.map((r) => r.countryCode)).toEqual(['GB', 'US', 'JP']);
  });
});
