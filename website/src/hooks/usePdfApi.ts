import { useCallback, useState } from 'react';
import { graphqlMutate } from '../graphql/graphqlHelpers';
import { generateRaceResultsPdf } from '../graphql/mutations';

export type PdfType = 'ORGANISER_SUMMARY' | 'PODIUM' | 'RACER_CERTIFICATE' | 'RACER_CERTIFICATES_BULK';

export interface PdfGenerationResult {
  downloadUrl: string;
  filename: string;
  expiresAt: string;
}

export function usePdfApi() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (args: { eventId: string; type: PdfType; userId?: string; trackId?: string }) => {
      setGenerating(true);
      setError(null);
      try {
        const response = await graphqlMutate<{ generateRaceResultsPdf: PdfGenerationResult }>(
          generateRaceResultsPdf,
          args
        );
        return response.generateRaceResultsPdf;
      } catch (err: any) {
        console.error('PDF generation failed:', err);
        const message = err?.errors?.[0]?.message || err.message || 'PDF generation failed';
        setError(message);
        return null;
      } finally {
        setGenerating(false);
      }
    },
    []
  );

  return { generate, generating, error };
}
