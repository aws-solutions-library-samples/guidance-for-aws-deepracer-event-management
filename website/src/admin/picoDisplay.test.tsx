import { describe, it, expect } from 'vitest';
import { generateConfig } from './picoDisplay';

const CONNECTION = {
  endpoint: 'https://xxx.appsync-api.eu-west-1.amazonaws.com/graphql',
  apiKey: 'da2-abc123',
  region: 'eu-west-1',
};

const FORM = {
  eventId: 'uuid-event-1',
  trackId: '2',
  raceFormat: 'fastest' as const,
  brightness: 0.5,
  scrollSpeed: 40,
  topN: 5,
  ssid: 'TestNetwork',
  wifiPassword: 'TestPassword',
  debug: false,
};

describe('generateConfig', () => {
  it('populates appsync block from connection details', () => {
    const cfg = generateConfig(CONNECTION, FORM);
    expect(cfg.appsync.endpoint).toBe(CONNECTION.endpoint);
    expect(cfg.appsync.api_key).toBe(CONNECTION.apiKey);
    expect(cfg.appsync.region).toBe(CONNECTION.region);
  });

  it('populates event block from form values', () => {
    const cfg = generateConfig(CONNECTION, FORM);
    expect(cfg.event.event_id).toBe('uuid-event-1');
    expect(cfg.event.track_id).toBe('2');
    expect(cfg.event.race_format).toBe('fastest');
  });

  it('populates display block', () => {
    const cfg = generateConfig(CONNECTION, FORM);
    expect(cfg.display.brightness).toBe(0.5);
    expect(cfg.display.scroll_speed).toBe(40);
    expect(cfg.display.leaderboard_top_n).toBe(5);
  });

  it('wifi block uses form ssid and password', () => {
    const cfg = generateConfig(CONNECTION, FORM);
    expect(cfg.wifi.ssid).toBe('TestNetwork');
    expect(cfg.wifi.password).toBe('TestPassword');
  });

  it('debug false by default', () => {
    const cfg = generateConfig(CONNECTION, FORM);
    expect(cfg.debug).toBe(false);
  });

  it('debug true when enabled', () => {
    const cfg = generateConfig(CONNECTION, { ...FORM, debug: true });
    expect(cfg.debug).toBe(true);
  });

  it('average race_format is accepted', () => {
    const cfg = generateConfig(CONNECTION, { ...FORM, raceFormat: 'average' });
    expect(cfg.event.race_format).toBe('average');
  });
});
