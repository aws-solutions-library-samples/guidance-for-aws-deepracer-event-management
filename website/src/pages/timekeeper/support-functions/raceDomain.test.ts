import { describe, expect, it } from 'vitest';
import { buildRaceConfigFromEvent, extractUserAttribute } from './raceDomain';

describe('extractUserAttribute', () => {
  const attributes = [
    { Name: 'custom:countryCode', Value: 'GB' },
    { Name: 'email', Value: 'test@example.com' },
  ];

  it('returns value for existing attribute', () => {
    expect(extractUserAttribute(attributes, 'custom:countryCode')).toBe('GB');
  });

  it('returns undefined for missing attribute', () => {
    expect(extractUserAttribute(attributes, 'custom:missing')).toBeUndefined();
  });

  it('returns undefined for undefined attributes array', () => {
    expect(extractUserAttribute(undefined, 'custom:countryCode')).toBeUndefined();
  });

  it('returns undefined for empty attributes array', () => {
    expect(extractUserAttribute([], 'custom:countryCode')).toBeUndefined();
  });
});

describe('buildRaceConfigFromEvent', () => {
  it('merges the eventName onto a copy of the event raceConfig', () => {
    const event = {
      eventName: 'Summit 2026',
      raceConfig: { raceTimeInMin: '2', numberOfResetsPerLap: '9999' },
    };

    expect(buildRaceConfigFromEvent(event)).toEqual({
      raceTimeInMin: '2',
      numberOfResetsPerLap: '9999',
      eventName: 'Summit 2026',
    });
  });

  it('returns a NEW object, not the event raceConfig reference', () => {
    const event = { eventName: 'E', raceConfig: { raceTimeInMin: '2' } };

    const result = buildRaceConfigFromEvent(event);

    expect(result).not.toBe(event.raceConfig);
  });

  it('does not mutate the event raceConfig (no leaked eventName)', () => {
    const raceConfig = { raceTimeInMin: '2' };
    const event = { eventName: 'E', raceConfig };

    buildRaceConfigFromEvent(event);

    expect(raceConfig).toEqual({ raceTimeInMin: '2' });
    expect('eventName' in raceConfig).toBe(false);
  });

  it('tolerates an event with no raceConfig', () => {
    expect(buildRaceConfigFromEvent({ eventName: 'E' })).toEqual({ eventName: 'E' });
    expect(buildRaceConfigFromEvent({ eventName: 'E', raceConfig: null })).toEqual({
      eventName: 'E',
    });
  });

  it('tolerates an undefined event', () => {
    expect(buildRaceConfigFromEvent(undefined)).toEqual({ eventName: undefined });
  });
});
