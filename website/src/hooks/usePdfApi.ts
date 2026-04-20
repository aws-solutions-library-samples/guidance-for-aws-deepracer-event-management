import { useCallback, useEffect, useRef, useState } from 'react';

import { graphqlMutate, graphqlQuery, graphqlSubscribe } from '../graphql/graphqlHelpers';
import { generateRaceResultsPdf } from '../graphql/mutations';
import { getPdfJob as getPdfJobQuery } from '../graphql/queries';
import { onPdfJobUpdated } from '../graphql/subscriptions';

export type PdfType =
    | 'ORGANISER_SUMMARY'
    | 'PODIUM'
    | 'RACER_CERTIFICATE'
    | 'RACER_CERTIFICATES_BULK';

export type PdfJobStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface PdfJob {
    jobId: string;
    status: PdfJobStatus;
    type: PdfType;
    eventId: string;
    userId?: string | null;
    trackId?: string | null;
    filename?: string | null;
    downloadUrl?: string | null;
    error?: string | null;
    createdBy: string;
    createdAt: string;
    completedAt?: string | null;
}

export interface GeneratePdfArgs {
    eventId: string;
    type: PdfType;
    userId?: string;
    trackId?: string;
}

// Lambda async retries give us up to ~15 minutes of worker runtime; 5 min is a
// comfortable client ceiling for the longest PDF in practice.
const TIMEOUT_MS = 5 * 60 * 1000;

function dedupKey(args: Pick<PdfJob, 'eventId' | 'type' | 'userId' | 'trackId'> | GeneratePdfArgs): string {
    return `${args.eventId}|${args.type}|${args.userId ?? '-'}|${args.trackId ?? '-'}`;
}

function triggerDownload(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

export function usePdfApi() {
    const [jobs, setJobs] = useState<Record<string, PdfJob>>({});
    const subscriptions = useRef<Map<string, { unsubscribe: () => void }>>(new Map());
    const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    useEffect(() => {
        return () => {
            subscriptions.current.forEach((s) => s.unsubscribe());
            timers.current.forEach((t) => clearTimeout(t));
        };
    }, []);

    const updateJob = useCallback((jobId: string, updates: Partial<PdfJob>) => {
        setJobs((prev) => {
            const existing = prev[jobId];
            if (!existing) return prev;
            return { ...prev, [jobId]: { ...existing, ...updates } };
        });
    }, []);

    const cleanupJob = useCallback((jobId: string) => {
        const sub = subscriptions.current.get(jobId);
        if (sub) {
            sub.unsubscribe();
            subscriptions.current.delete(jobId);
        }
        const timer = timers.current.get(jobId);
        if (timer) {
            clearTimeout(timer);
            timers.current.delete(jobId);
        }
    }, []);

    const generatePdf = useCallback(
        async (args: GeneratePdfArgs): Promise<PdfJob> => {
            const result = await graphqlMutate<{ generateRaceResultsPdf: PdfJob }>(
                generateRaceResultsPdf,
                args,
            );
            const job = result.generateRaceResultsPdf;
            setJobs((prev) => ({ ...prev, [job.jobId]: job }));

            const sub = graphqlSubscribe<{ onPdfJobUpdated: Partial<PdfJob> & { jobId: string; status: PdfJobStatus } }>(
                onPdfJobUpdated,
                { jobId: job.jobId },
            ).subscribe({
                next: async (event) => {
                    const updated = event.value.data.onPdfJobUpdated;
                    if (updated.status === 'SUCCESS') {
                        try {
                            const qResult = await graphqlQuery<{ getPdfJob: PdfJob | null }>(
                                getPdfJobQuery,
                                { jobId: job.jobId },
                            );
                            const full = qResult.getPdfJob;
                            if (full) {
                                updateJob(job.jobId, {
                                    status: 'SUCCESS',
                                    filename: full.filename,
                                    downloadUrl: full.downloadUrl,
                                    completedAt: full.completedAt,
                                });
                                if (full.downloadUrl && full.filename) {
                                    triggerDownload(full.downloadUrl, full.filename);
                                }
                            }
                        } catch (err) {
                            console.error('getPdfJob failed:', err);
                            updateJob(job.jobId, { status: 'FAILED', error: 'Failed to fetch download URL' });
                        }
                        cleanupJob(job.jobId);
                    } else if (updated.status === 'FAILED') {
                        updateJob(job.jobId, {
                            status: 'FAILED',
                            error: updated.error ?? 'Unknown error',
                            completedAt: updated.completedAt ?? null,
                        });
                        cleanupJob(job.jobId);
                    }
                },
                error: (err: unknown) => {
                    console.error('onPdfJobUpdated subscription error:', err);
                    updateJob(job.jobId, { status: 'FAILED', error: 'Subscription error' });
                    cleanupJob(job.jobId);
                },
            });
            subscriptions.current.set(job.jobId, sub);

            const timer = setTimeout(() => {
                updateJob(job.jobId, { status: 'FAILED', error: 'PDF generation timed out — please try again' });
                cleanupJob(job.jobId);
            }, TIMEOUT_MS);
            timers.current.set(job.jobId, timer);

            return job;
        },
        [updateJob, cleanupJob],
    );

    const isGenerating = useCallback(
        (args: GeneratePdfArgs) => {
            const key = dedupKey(args);
            return Object.values(jobs).some((j) => j.status === 'PENDING' && dedupKey(j) === key);
        },
        [jobs],
    );

    const dismissJob = useCallback(
        (jobId: string) => {
            cleanupJob(jobId);
            setJobs((prev) => {
                const copy = { ...prev };
                delete copy[jobId];
                return copy;
            });
        },
        [cleanupJob],
    );

    return { generatePdf, jobs, isGenerating, dismissJob };
}
