// ---------------------------------------------------------------------------
// Pure business logic for the Pico Display admin page — extracted so the test
// suite (vitest) doesn't need to load picoDisplay.tsx, which imports the
// runtime-generated config.json that doesn't exist at synth-stage test time.
// ---------------------------------------------------------------------------

export interface PicoConnection {
  endpoint: string;
  apiKey: string;
  region: string;
}

export interface PicoFormValues {
  eventId: string;
  trackId: string;
  raceFormat: 'fastest' | 'average';
  brightness: number;
  scrollSpeed: number;
  topN: number;
  raceDisplayLines: 1 | 2;
  branding1: string;
  branding1Colour: string;
  branding2: string;
  branding2Colour: string;
  ssid: string;
  wifiPassword: string;
  otaBaseUrl: string;
  debug: boolean;
}

export interface PicoConfig {
  wifi: { ssid: string; password: string };
  appsync: { endpoint: string; api_key: string; region: string };
  event: { event_id: string; track_id: string; race_format: string };
  display: {
    brightness: number;
    scroll_speed: number;
    leaderboard_top_n: number;
    race_display_lines: 1 | 2;
    branding_1: string;
    branding_1_colour: string;
    branding_2: string;
    branding_2_colour: string;
  };
  ota: { base_url: string };
  debug: boolean;
}

export function generateConfig(conn: PicoConnection, form: PicoFormValues): PicoConfig {
  return {
    wifi: {
      ssid: form.ssid,
      password: form.wifiPassword,
    },
    appsync: {
      endpoint: conn.endpoint,
      api_key: conn.apiKey,
      region: conn.region,
    },
    event: {
      event_id: form.eventId,
      track_id: form.trackId,
      race_format: form.raceFormat,
    },
    display: {
      brightness: form.brightness,
      scroll_speed: form.scrollSpeed,
      leaderboard_top_n: form.topN,
      race_display_lines: form.raceDisplayLines,
      branding_1: form.branding1,
      branding_1_colour: form.branding1Colour,
      branding_2: form.branding2,
      branding_2_colour: form.branding2Colour,
    },
    ota: {
      base_url: form.otaBaseUrl,
    },
    debug: form.debug,
  };
}
