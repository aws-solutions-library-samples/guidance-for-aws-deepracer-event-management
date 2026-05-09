import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { graphqlMutate, graphqlQuery, graphqlSubscribe } from '../graphql/graphqlHelpers';
import { generateRaceResultsPdf } from '../graphql/mutations';
import { getPdfJob as getPdfJobQuery } from '../graphql/queries';
import { onPdfJobUpdated } from '../graphql/subscriptions';
import { useStore } from '../store/store';

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
    const { t } = useTranslation();
    const [, dispatch] = useStore();
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

    const pushNotification = useCallback(
        (jobId: string, type: PdfType, phase: 'PENDING' | 'SUCCESS' | 'FAILED', extras: { filename?: string | null; error?: string | null }) => {
            const typeLabel = t(`pdf.type.${type}`);
            if (phase === 'PENDING') {
                dispatch('ADD_NOTIFICATION', {
                    id: `pdf-${jobId}`,
                    type: 'info',
                    header: t('pdf.generating', { type: typeLabel }),
                    loading: true,
                    dismissible: true,
                    onDismiss: () => dispatch('DISMISS_NOTIFICATION', `pdf-${jobId}`),
                });
            } else if (phase === 'SUCCESS') {
                dispatch('ADD_NOTIFICATION', {
                    id: `pdf-${jobId}`,
                    type: 'success',
                    header: t('pdf.ready', { filename: extras.filename ?? typeLabel }),
                    dismissible: true,
                    onDismiss: () => dispatch('DISMISS_NOTIFICATION', `pdf-${jobId}`),
                });
            } else {
                dispatch('ADD_NOTIFICATION', {
                    id: `pdf-${jobId}`,
                    type: 'error',
                    header: t('pdf.failed', { error: extras.error ?? '' }),
                    dismissible: true,
                    onDismiss: () => dispatch('DISMISS_NOTIFICATION', `pdf-${jobId}`),
                });
            }
        },
        [dispatch, t],
    );

    const generatePdf = useCallback(
        async (args: GeneratePdfArgs): Promise<PdfJob> => {
            // Push a placeholder notification immediately so the user sees feedback
            // straight away — the generateRaceResultsPdf mutation can take ~5s
            // before returning a real jobId, and without this the click looks
            // unresponsive. We swap it for the real jobId-keyed notification once
            // the mutation resolves (or dismiss it on failure).
            const pendingId = `pdf-pending-${dedupKey(args)}`;
            const typeLabel = t(`pdf.type.${args.type}`);
            dispatch('ADD_NOTIFICATION', {
                id: pendingId,
                type: 'info',
                header: t('pdf.generating', { type: typeLabel }),
                loading: true,
                dismissible: false,
            });

            let result: { generateRaceResultsPdf: PdfJob };
            try {
                result = await graphqlMutate<{ generateRaceResultsPdf: PdfJob }>(
                    generateRaceResultsPdf,
                    args,
                );
            } catch (err) {
                dispatch('DISMISS_NOTIFICATION', pendingId);
                throw err;
            }
            dispatch('DISMISS_NOTIFICATION', pendingId);
            const job = result.generateRaceResultsPdf;
            setJobs((prev) => ({ ...prev, [job.jobId]: job }));
            pushNotification(job.jobId, job.type, 'PENDING', {});

            const sub = graphqlSubscribe<{ onPdfJobUpdated: Partial<PdfJob> | null }>(
                onPdfJobUpdated,
                { jobId: job.jobId },
            ).subscribe({
                // The subscription is used only as a "something changed" signal. The
                // authoritative state is fetched via getPdfJob, which re-reads the
                // DDB row and (for SUCCESS) generates a fresh pre-signed URL. This
                // makes us robust to the subscription payload being null (e.g., when
                // AppSync's projection of the mutation output fails a scalar check).
                next: async () => {
                    try {
                        const qResult = await graphqlQuery<{ getPdfJob: PdfJob | null }>(
                            getPdfJobQuery,
                            { jobId: job.jobId },
                        );
                        const full = qResult.getPdfJob;
                        if (!full || full.status === 'PENDING') {
                            // spurious event (or projection race) — ignore, keep waiting
                            return;
                        }
                        if (full.status === 'SUCCESS') {
                            updateJob(job.jobId, {
                                status: 'SUCCESS',
                                filename: full.filename,
                                downloadUrl: full.downloadUrl,
                                completedAt: full.completedAt,
                            });
                            pushNotification(job.jobId, job.type, 'SUCCESS', { filename: full.filename });
                            if (full.downloadUrl && full.filename) {
                                triggerDownload(full.downloadUrl, full.filename);
                            }
                        } else {
                            updateJob(job.jobId, {
                                status: 'FAILED',
                                error: full.error ?? 'Unknown error',
                                completedAt: full.completedAt,
                            });
                            pushNotification(job.jobId, job.type, 'FAILED', { error: full.error });
                        }
                        cleanupJob(job.jobId);
                    } catch (err) {
                        console.error('getPdfJob lookup failed:', err);
                        updateJob(job.jobId, { status: 'FAILED', error: 'Failed to fetch job status' });
                        pushNotification(job.jobId, job.type, 'FAILED', { error: 'Failed to fetch job status' });
                        cleanupJob(job.jobId);
                    }
                },
                error: (err: unknown) => {
                    console.error('onPdfJobUpdated subscription error:', err);
                    updateJob(job.jobId, { status: 'FAILED', error: 'Subscription error' });
                    pushNotification(job.jobId, job.type, 'FAILED', { error: 'Subscription error' });
                    cleanupJob(job.jobId);
                },
            });
            subscriptions.current.set(job.jobId, sub);

            const timer = setTimeout(() => {
                const msg = t('pdf.timedOut');
                updateJob(job.jobId, { status: 'FAILED', error: msg });
                pushNotification(job.jobId, job.type, 'FAILED', { error: msg });
                cleanupJob(job.jobId);
            }, TIMEOUT_MS);
            timers.current.set(job.jobId, timer);

            return job;
        },
        [dispatch, updateJob, cleanupJob, pushNotification, t],
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
            dispatch('DISMISS_NOTIFICATION', `pdf-${jobId}`);
            setJobs((prev) => {
                const copy = { ...prev };
                delete copy[jobId];
                return copy;
            });
        },
        [cleanupJob, dispatch],
    );

    return { generatePdf, jobs, isGenerating, dismissJob };
}
