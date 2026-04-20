// @vitest-environment jsdom
import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../graphql/graphqlHelpers', () => ({
    graphqlMutate: vi.fn(),
    graphqlQuery: vi.fn(),
    graphqlSubscribe: vi.fn(),
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
    };
}

describe('usePdfApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

    test('failure path — FAILED status surfaces error', async () => {
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

        const { result } = renderHook(() => usePdfApi());
        await act(async () => {
            await result.current.generatePdf({ eventId: 'e-1', type: 'PODIUM' });
        });

        act(() => {
            sub.emit({ jobId: 'j-2', status: 'FAILED', error: 'Unknown eventId: e-1' });
        });

        await waitFor(() => {
            expect(
                Object.values(result.current.jobs).some(
                    (j) => j.status === 'FAILED' && j.error === 'Unknown eventId: e-1',
                ),
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
