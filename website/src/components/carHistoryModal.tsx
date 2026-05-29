import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Modal,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Table,
} from '@cloudscape-design/components';
import { graphqlQuery } from '../graphql/graphqlHelpers';
import { getCarHistory } from '../graphql/queries';
import { formatAwsDateTime } from '../support-functions/time';

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
}

/**
 * Side-panel modal showing the lineage of a single physical car —
 * every managed-instance the chassisSerial has ever been registered as,
 * with the fleet/hostname it had at the time. Read-only.
 *
 * Powered by the `getCarHistory` AppSync query, which scans the
 * CarsHistory DDB table written by `register_car_serial` whenever a
 * chassis re-activates under a new mi-xxx.
 */
const CarHistoryModal: React.FC<CarHistoryModalProps> = ({
  visible,
  onDismiss,
  chassisSerial,
}) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<CarHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !chassisSerial) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setEntries(null);

    graphqlQuery<{ getCarHistory: CarHistoryEntry[] }>(getCarHistory, {
      chassisSerial,
    })
      .then((response) => {
        if (cancelled) return;
        // Most-recent first feels right for a history view; sort by
        // lastSeen desc, falling back to registrationDate.
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
        {loading && (
          <Box textAlign="center" padding="m">
            <Spinner size="large" />
          </Box>
        )}
        {error && <StatusIndicator type="error">{error}</StatusIndicator>}
        {!loading && !error && entries && entries.length === 0 && (
          <StatusIndicator type="info">
            {t('devices.car-history-empty')}
          </StatusIndicator>
        )}
        {!loading && !error && entries && entries.length > 0 && (
          <Table
            variant="embedded"
            items={entries}
            trackBy="managedInstanceId"
            columnDefinitions={[
              {
                id: 'carName',
                header: t('devices.host-name'),
                cell: (item) => item.carName || '-',
              },
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
                cell: (item) =>
                  formatAwsDateTime(item.registrationDate || '') || '-',
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
    </Modal>
  );
};

export { CarHistoryModal };
