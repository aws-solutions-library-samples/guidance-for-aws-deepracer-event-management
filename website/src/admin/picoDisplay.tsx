import React from 'react';

// ---------------------------------------------------------------------------
// Types
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
  pollInterval: number;
  topN: number;
}

export interface PicoConfig {
  wifi: { ssid: string; password: string };
  appsync: { endpoint: string; api_key: string; region: string };
  event: { event_id: string; track_id: string; race_format: string };
  display: {
    brightness: number;
    scroll_speed: number;
    leaderboard_poll_interval: number;
    leaderboard_top_n: number;
    race_items: string[];
  };
}

// ---------------------------------------------------------------------------
// Pure business logic (exported for testing)
// ---------------------------------------------------------------------------

export function generateConfig(conn: PicoConnection, form: PicoFormValues): PicoConfig {
  return {
    wifi: {
      ssid: 'YourNetworkName',
      password: 'YourWiFiPassword',
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
      leaderboard_poll_interval: form.pollInterval,
      leaderboard_top_n: form.topN,
      race_items: [
        'time_remaining',
        'laps_completed',
        'fastest_lap',
        'last_lap',
        'resets',
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Page component — stub (built out in Task 4)
// ---------------------------------------------------------------------------

export const AdminPicoDisplay: React.FC = () => {
  return <div>Pico Display</div>;
};
