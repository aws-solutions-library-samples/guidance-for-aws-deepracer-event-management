import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Modal,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Table,
  Tabs,
  ColumnLayout,
} from '@cloudscape-design/components';
import { graphqlQuery } from '../graphql/graphqlHelpers';
import { getCarHistory, getCarRaceHistory } from '../graphql/queries';
import { formatAwsDateTime } from '../support-functions/time';
import { flattenRaceHistory, CarRaceHistory, RaceHistoryRow } from './carRaceHistory';

interface CarHistoryEntry {
  chassisSerial: string;
  managedInstanceId: string;
  carName?: string | null;
  fleetId?: string | null;
  fleetName?: string | null;
  registrationDate?: string | null;
  lastSeen?: string | null;
  deregisteredAt?: string | null;
}

interface CarHistoryModalProps {
  visible: boolean;
  onDismiss: () => void;
  chassisSerial: string;
  eventsById: Record<string, { eventName?: string }>;
}

/**
 * Side-panel modal for one physical car (chassisSerial). Two tabs:
 *  - Activations: the managed-instance lineage (getCarHistory).
 *  - Race history: every lap across all hostnames, time-bounded by the
 *    lineage windows (getCarRaceHistory, #66). Lazily fetched on first open
 *    of the tab — it scans the race table, so we don't pay for it unless asked.
 */
const CarHistoryModal: React.FC<CarHistoryModalProps> = ({
  visible,
  onDismiss,
  chassisSerial,
  eventsById,
}) => {
  const { t } = useTranslation();
  const [activeTabId, setActiveTabId] = useState('lineage');

  // --- Activations (lineage) ---
  const [entries, setEntries] = useState<CarHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Race history (#66) ---
  const [raceHistory, setRaceHistory] = useState<CarRaceHistory | null>(null);
  const [racesLoading, setRacesLoading] = useState(false);
  const [racesError, setRacesError] = useState<string | null>(null);

  // Reset both panes whenever the modal opens for a (new) car.
  useEffect(() => {
    if (!visible) return;
    setActiveTabId('lineage');
    setRaceHistory(null);
    setRacesError(null);
    setRacesLoading(false);
  }, [visible, chassisSerial]);

  useEffect(() => {
    if (!visible || !chassisSerial) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEntries(null);

    graphqlQuery<{ getCarHistory: CarHistoryEntry[] }>(getCarHistory, { chassisSerial })
      .then((response) => {
        if (cancelled) return;
        const rows = [...(response.getCarHistory ?? [])].sort((a, b) => {
          const aKey = a.lastSeen || a.registrationDate || '';
          const bKey = b.lastSeen || b.registrationDate || '';
          return bKey.localeCompare(aKey);
        });
        setEntries(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('getCarHistory failed', err);
        setError(err?.message || 'Failed to load car history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, chassisSerial]);

  // Lazy-load race history only when its tab is opened.
  useEffect(() => {
    if (!visible || !chassisSerial) return;
    if (activeTabId !== 'races' || raceHistory || racesLoading) return;
    let cancelled = false;
    setRacesLoading(true);
    setRacesError(null);

    graphqlQuery<{ getCarRaceHistory: CarRaceHistory }>(getCarRaceHistory, { chassisSerial })
      .then((response) => {
        if (cancelled) return;
        setRaceHistory(response.getCarRaceHistory ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('getCarRaceHistory failed', err);
        setRacesError(err?.message || 'Failed to load race history');
      })
      .finally(() => {
        if (!cancelled) setRacesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, chassisSerial, activeTabId, raceHistory, racesLoading]);

  const raceRows: RaceHistoryRow[] = useMemo(
    () => flattenRaceHistory(raceHistory, eventsById),
    [raceHistory, eventsById]
  );

  const lineageTab = (
    <SpaceBetween size="m">
      {loading && (
        <Box textAlign="center" padding="m">
          <Spinner size="large" />
        </Box>
      )}
      {error && <StatusIndicator type="error">{error}</StatusIndicator>}
      {!loading && !error && entries && entries.length === 0 && (
        <StatusIndicator type="info">{t('devices.car-history-empty')}</StatusIndicator>
      )}
      {!loading && !error && entries && entries.length > 0 && (
        <Table
          variant="embedded"
          items={entries}
          trackBy="managedInstanceId"
          columnDefinitions={[
            { id: 'carName', header: t('devices.host-name'), cell: (item) => item.carName || '-' },
            {
              id: 'fleetName',
              header: t('devices.fleet-name'),
              cell: (item) => item.fleetName || '-',
            },
            {
              id: 'managedInstanceId',
              header: t('devices.instance'),
              cell: (item) => item.managedInstanceId,
            },
            {
              id: 'registrationDate',
              header: t('devices.registration-date'),
              cell: (item) => formatAwsDateTime(item.registrationDate || '') || '-',
            },
            {
              id: 'deregisteredAt',
              header: t('devices.deregistered-at'),
              cell: (item) =>
                item.deregisteredAt
                  ? formatAwsDateTime(item.deregisteredAt) || '-'
                  : t('devices.car-history-active'),
            },
          ]}
        />
      )}
    </SpaceBetween>
  );

  const summary = raceHistory?.summary;
  const racesTab = (
    <SpaceBetween size="m">
      {racesLoading && (
        <Box textAlign="center" padding="m">
          <Spinner size="large" />
        </Box>
      )}
      {racesError && <StatusIndicator type="error">{racesError}</StatusIndicator>}
      {!racesLoading && !racesError && raceHistory && (
        <>
          <ColumnLayout columns={3} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">{t('devices.car-history-total-races')}</Box>
              <div>{summary?.totalRaces ?? 0}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">{t('devices.car-history-total-laps')}</Box>
              <div>{summary?.totalLaps ?? 0}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">{t('devices.car-history-best-lap')}</Box>
              <div>{summary?.bestLapTime != null ? summary.bestLapTime.toFixed(3) : '-'}</div>
            </div>
          </ColumnLayout>
          {raceRows.length === 0 ? (
            <StatusIndicator type="info">{t('devices.car-history-races-empty')}</StatusIndicator>
          ) : (
            <Table
              variant="embedded"
              items={raceRows}
              trackBy="key"
              columnDefinitions={[
                { id: 'hostName', header: t('devices.host-name'), cell: (r) => r.hostName },
                {
                  id: 'eventName',
                  header: t('devices.car-history-col-event'),
                  cell: (r) => r.eventName,
                },
                {
                  id: 'trackName',
                  header: t('devices.car-history-col-track'),
                  cell: (r) => r.trackName,
                },
                {
                  id: 'date',
                  header: t('devices.car-history-col-date'),
                  cell: (r) => formatAwsDateTime(r.createdAt) || '-',
                },
                {
                  id: 'lapTime',
                  header: t('devices.car-history-col-lap-time'),
                  cell: (r) => (r.lapTime != null ? r.lapTime.toFixed(3) : '-'),
                },
                {
                  id: 'valid',
                  header: t('devices.car-history-col-valid'),
                  cell: (r) =>
                    r.isValid ? (
                      <StatusIndicator
                        type="success"
                        iconAriaLabel={t('devices.car-history-valid')}
                      />
                    ) : (
                      <StatusIndicator
                        type="stopped"
                        iconAriaLabel={t('devices.car-history-invalid')}
                      />
                    ),
                },
              ]}
            />
          )}
        </>
      )}
    </SpaceBetween>
  );

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={t('devices.car-history-header')}
      size="large"
      footer={
        <Box float="right">
          <Button variant="primary" onClick={onDismiss}>
            {t('button.ok')}
          </Button>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Box variant="awsui-key-label">
          {t('devices.chassis-serial')}: {chassisSerial}
        </Box>
        <Tabs
          activeTabId={activeTabId}
          onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
          tabs={[
            { id: 'lineage', label: t('devices.car-history-lineage-tab'), content: lineageTab },
            { id: 'races', label: t('devices.car-history-races-tab'), content: racesTab },
          ]}
        />
      </SpaceBetween>
    </Modal>
  );
};

export { CarHistoryModal };
