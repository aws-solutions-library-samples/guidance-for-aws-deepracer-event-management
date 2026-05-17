// @vitest-environment jsdom
import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../graphql/graphqlHelpers', () => ({
    graphqlMutate: vi.fn(),
    graphqlQuery: vi.fn(),
    graphqlSubscribe: vi.fn(),
}));

const dispatchMock = vi.fn();
vi.mock('../store/store', () => ({
    useStore: () => [{}, dispatchMock],
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, opts?: Record<string, string>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) }),
}));

import { graphqlMutate, graphqlQuery, graphqlSubscribe } from '../graphql/graphqlHelpers';
import { usePdfApi } from './usePdfApi';

type NextHandler = (event: unknown) => void;

function fakeSubscription() {
    const handlers: Array<{ next: NextHandler; error?: (e: unknown) => void }> = [];
    return {
        subscribe: (h: { next: NextHandler; error?: (e: unknown) => void }) => {
            handlers.push(h);
            return { unsubscribe: vi.fn() };
        },
        emit: (data: unknown) =>
            handlers.forEach((h) => h.next({ value: { data: { onPdfJobUpdated: data } } })),
        emitNull: () =>
            handlers.forEach((h) => h.next({ value: { data: { onPdfJobUpdated: null } } })),
    };
}

describe('usePdfApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dispatchMock.mockClear();
    });

    test('success path — PENDING → SUCCESS, exposes downloadUrl, triggers download', async () => {
        (graphqlMutate as any).mockResolvedValue({
            generateRaceResultsPdf: {
                jobId: 'j-1',
                status: 'PENDING',
                type: 'PODIUM',
                eventId: 'e-1',
                createdBy: 'u-1',
                createdAt: '2026-04-20T00:00:00Z',
            },
        });
        const sub = fakeSubscription();
        (graphqlSubscribe as any).mockReturnValue(sub);
        (graphqlQuery as any).mockResolvedValue({
            getPdfJob: {
                jobId: 'j-1',
                status: 'SUCCESS',
                filename: 'podium.pdf',
                downloadUrl: 'https://signed.example/podium.pdf',
                type: 'PODIUM',
                eventId: 'e-1',
                createdBy: 'u-1',
                createdAt: '2026-04-20T00:00:00Z',
                completedAt: '2026-04-20T00:00:05Z',
            },
        });

        // Stub document.createElement('a').click to assert without triggering real navigation.
        const clickSpy = vi.fn();
        const appendSpy = vi.spyOn(document.body, 'appendChild');
        const removeSpy = vi.spyOn(document.body, 'removeChild');
        const origCreate = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            const el = origCreate(tag) as HTMLElement;
            if (tag === 'a') {
                (el as HTMLAnchorElement).click = clickSpy;
            }
            return el;
        });

        const { result } = renderHook(() => usePdfApi());

        await act(async () => {
            await result.current.generatePdf({ eventId: 'e-1', type: 'PODIUM' });
        });

        expect(
            Object.values(result.current.jobs).some((j) => j.status === 'PENDING'),
        ).toBe(true);

        act(() => {
            sub.emit({ jobId: 'j-1', status: 'SUCCESS', filename: 'podium.pdf' });
        });

        await waitFor(() => {
            expect(graphqlQuery).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(
                Object.values(result.current.jobs).some(
                    (j) => j.status === 'SUCCESS' && j.downloadUrl === 'https://signed.example/podium.pdf',
                ),
            ).toBe(true);
        });
        expect(clickSpy).toHaveBeenCalled();
        appendSpy.mockRestore();
        removeSpy.mockRestore();
    });

    test('failure path — FAILED status surfaces error (fetched via getPdfJob)', async () => {
        (graphqlMutate as any).mockResolvedValue({
            generateRaceResultsPdf: {
                jobId: 'j-2',
                status: 'PENDING',
                type: 'PODIUM',
                eventId: 'e-1',
                createdBy: 'u-1',
                createdAt: '2026-04-20T00:00:00Z',
            },
        });
        const sub = fakeSubscription();
        (graphqlSubscribe as any).mockReturnValue(sub);
        (graphqlQuery as any).mockResolvedValue({
            getPdfJob: {
                jobId: 'j-2',
                status: 'FAILED',
                error: 'Unknown eventId: e-1',
                type: 'PODIUM',
                eventId: 'e-1',
                createdBy: 'u-1',
                createdAt: '2026-04-20T00:00:00Z',
                completedAt: '2026-04-20T00:00:05Z',
            },
        });

        const { result } = renderHook(() => usePdfApi());
        await act(async () => {
            await result.current.generatePdf({ eventId: 'e-1', type: 'PODIUM' });
        });

        act(() => {
            // Subscription fires — shape doesn't matter, the hook re-queries getPdfJob
            sub.emit({ jobId: 'j-2', status: 'FAILED' });
        });

        await waitFor(() => {
            expect(
                Object.values(result.current.jobs).some(
                    (j) => j.status === 'FAILED' && j.error === 'Unknown eventId: e-1',
                ),
            ).toBe(true);
        });
    });

    test('null subscription payload is tolerated — hook still queries getPdfJob', async () => {
        (graphqlMutate as any).mockResolvedValue({
            generateRaceResultsPdf: {
                jobId: 'j-null',
                status: 'PENDING',
                type: 'PODIUM',
                eventId: 'e-1',
                createdBy: 'u-1',
                createdAt: '2026-04-20T00:00:00Z',
            },
        });
        const sub = fakeSubscription();
        (graphqlSubscribe as any).mockReturnValue(sub);
        (graphqlQuery as any).mockResolvedValue({
            getPdfJob: {
                jobId: 'j-null',
                status: 'SUCCESS',
                filename: 'podium.pdf',
                downloadUrl: 'https://signed.example/podium.pdf',
                type: 'PODIUM',
                eventId: 'e-1',
                createdBy: 'u-1',
                createdAt: '2026-04-20T00:00:00Z',
                completedAt: '2026-04-20T00:00:05Z',
            },
        });

        const { result } = renderHook(() => usePdfApi());
        await act(async () => {
            await result.current.generatePdf({ eventId: 'e-1', type: 'PODIUM' });
        });

        act(() => {
            sub.emitNull();
        });

        await waitFor(() => {
            expect(graphqlQuery).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(
                Object.values(result.current.jobs).some((j) => j.status === 'SUCCESS'),
            ).toBe(true);
        });
    });

    test('isGenerating returns true while job for same (event,type,user,track) is PENDING', async () => {
        (graphqlMutate as any).mockResolvedValue({
            generateRaceResultsPdf: {
                jobId: 'j-3',
                status: 'PENDING',
                type: 'PODIUM',
                eventId: 'e-1',
                createdBy: 'u-1',
                createdAt: '2026-04-20T00:00:00Z',
            },
        });
        const sub = fakeSubscription();
        (graphqlSubscribe as any).mockReturnValue(sub);

        const { result } = renderHook(() => usePdfApi());
        await act(async () => {
            await result.current.generatePdf({ eventId: 'e-1', type: 'PODIUM' });
        });
        expect(result.current.isGenerating({ eventId: 'e-1', type: 'PODIUM' })).toBe(true);
        expect(result.current.isGenerating({ eventId: 'e-1', type: 'ORGANISER_SUMMARY' })).toBe(false);
    });

    test('immediate placeholder notification — pushed before mutation resolves, then swapped for jobId-keyed one', async () => {
        // Hold the mutation in a pending state so we can assert the pre-mutation
        // notification arrives synchronously. The 5-second roundtrip on the real
        // backend is exactly the gap this placeholder is meant to bridge.
        let resolveMutate!: (value: unknown) => void;
        (graphqlMutate as any).mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveMutate = resolve;
                }),
        );
        (graphqlSubscribe as any).mockReturnValue(fakeSubscription());

        const { result } = renderHook(() => usePdfApi());
        let pending: Promise<unknown>;
        act(() => {
            pending = result.current.generatePdf({ eventId: 'e-1', type: 'ORGANISER_SUMMARY' });
        });

        // Before the mutation resolves we should already have dispatched the
        // placeholder ADD_NOTIFICATION with the loading flag.
        const placeholderCall = dispatchMock.mock.calls.find(
            ([action, payload]) =>
                action === 'ADD_NOTIFICATION' &&
                typeof payload === 'object' &&
                payload?.id?.startsWith('pdf-pending-') &&
                payload?.loading === true,
        );
        expect(placeholderCall).toBeDefined();
        const placeholderId = placeholderCall![1].id;

        await act(async () => {
            resolveMutate({
                generateRaceResultsPdf: {
                    jobId: 'j-imm',
                    status: 'PENDING',
                    type: 'ORGANISER_SUMMARY',
                    eventId: 'e-1',
                    createdBy: 'u-1',
                    createdAt: '2026-04-20T00:00:00Z',
                },
            });
            await pending;
        });

        // After the mutation resolves the placeholder should have been dismissed
        // and a real jobId-keyed notification dispatched.
        expect(dispatchMock).toHaveBeenCalledWith('DISMISS_NOTIFICATION', placeholderId);
        expect(
            dispatchMock.mock.calls.some(
                ([action, payload]) =>
                    action === 'ADD_NOTIFICATION' && payload?.id === 'pdf-j-imm',
            ),
        ).toBe(true);
    });

    test('placeholder notification is dismissed when the mutation throws', async () => {
        (graphqlMutate as any).mockRejectedValue(new Error('AppSync 500'));

        const { result } = renderHook(() => usePdfApi());
        await act(async () => {
            await expect(
                result.current.generatePdf({ eventId: 'e-1', type: 'PODIUM' }),
            ).rejects.toThrow('AppSync 500');
        });

        const placeholderAdds = dispatchMock.mock.calls.filter(
            ([action, payload]) =>
                action === 'ADD_NOTIFICATION' && payload?.id?.startsWith('pdf-pending-'),
        );
        const placeholderDismisses = dispatchMock.mock.calls.filter(
            ([action, payload]) =>
                action === 'DISMISS_NOTIFICATION' && payload?.startsWith?.('pdf-pending-'),
        );
        expect(placeholderAdds).toHaveLength(1);
        expect(placeholderDismisses).toHaveLength(1);
    });

    test('dismissJob removes the entry from jobs state', async () => {
        (graphqlMutate as any).mockResolvedValue({
            generateRaceResultsPdf: {
                jobId: 'j-4',
                status: 'PENDING',
                type: 'PODIUM',
                eventId: 'e-1',
                createdBy: 'u-1',
                createdAt: '2026-04-20T00:00:00Z',
            },
        });
        const sub = fakeSubscription();
        (graphqlSubscribe as any).mockReturnValue(sub);

        const { result } = renderHook(() => usePdfApi());
        await act(async () => {
            await result.current.generatePdf({ eventId: 'e-1', type: 'PODIUM' });
        });
        expect(Object.keys(result.current.jobs)).toContain('j-4');

        act(() => {
            result.current.dismissJob('j-4');
        });
        expect(Object.keys(result.current.jobs)).not.toContain('j-4');
    });
});
