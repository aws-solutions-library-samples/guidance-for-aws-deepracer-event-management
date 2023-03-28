import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EventSelectorModal } from '../components/eventSelectorModal';
import { PageLayout } from '../components/pageLayout';
import { useSelectedEventContext } from '../store/storeProvider';
import { ActualRacerStats } from './actual-racer-stats';

import { SpaceBetween } from '@cloudscape-design/components';
import { LeaderboardStats } from './leaderboard-stats';

const CommentatorRaceStats = () => {
  const { t } = useTranslation();

  const selectedEvent = useSelectedEventContext();

  const [eventSelectModalVisible, setEventSelectModalVisible] = useState(false);

  // Show event selector modal if no event has been selected, timekeeper must have an event selected to work
  useEffect(() => {
    if (selectedEvent.eventId == null) {
      setEventSelectModalVisible(true);
    }
  }, [selectedEvent]);

  return (
    <>
      <PageLayout
        header={t('commentator.race.header')}
        description={t('commentator.race.stats')}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('commentator.breadcrumb') },
          { text: t('commentator.race.breadcrumb'), href: '/' },
        ]}
      >
        <EventSelectorModal
          visible={eventSelectModalVisible}
          onDismiss={() => setEventSelectModalVisible(false)}
          onOk={() => setEventSelectModalVisible(false)}
        />
        <SpaceBetween size="l">
          <ActualRacerStats></ActualRacerStats>
          <LeaderboardStats></LeaderboardStats>
        </SpaceBetween>
      </PageLayout>
    </>
  );
};

export { CommentatorRaceStats };
