import { useCallback, useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getGlobalStats } from '../graphql/queries';

const client = generateClient();

export interface GlobalStats {
  totalEvents: number;
  totalRacers: number;
  totalLaps: number;
  totalValidLaps: number;
  totalCountries: number;
  eventsByCountry: { countryCode: string; events: number; racers: number; laps: number }[];
  eventsByMonth: { month: string; events: number; races: number }[];
  eventTypeBreakdown: { typeOfEvent: string; count: number }[];
  trackTypeBreakdown: { trackType: string; count: number; bestLapMs: number | null }[];
  fastestLapsEver: {
    username: string;
    eventName: string;
    trackType: string;
    lapTimeMs: number;
    eventDate: string;
  }[];
}

export function useStatsApi() {
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGlobalStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await client.graphql({
        query: getGlobalStats,
        authMode: 'apiKey',
      });
      setGlobalStats((response as any).data.getGlobalStats);
    } catch (err: any) {
      console.error('Failed to fetch global stats:', err);
      setError(err.message || 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalStats();
  }, [fetchGlobalStats]);

  return { globalStats, loading, error, refetch: fetchGlobalStats };
}
