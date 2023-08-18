import { SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventSelectorModal } from '../components/eventSelectorModal';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import { PageLayout } from '../components/pageLayout';
import { useToolsOptionsDispatch } from '../store/appLayoutProvider';
import { useSelectedEventContext } from '../store/storeProvider';
import { ActualRacerStats } from './actual-racer-stats';
import { LeaderboardStats } from './leaderboard-stats';

const CommentatorRaceStats = () => {
  const { t } = useTranslation(['translation', 'help-race-stats']);

  const selectedEvent = useSelectedEventContext();

  const [eventSelectModalVisible, setEventSelectModalVisible] = useState(false);

  // Help panel
  const toolsOptionsDispatch = useToolsOptionsDispatch();
  const helpPanelHidden = false;
  useEffect(() => {
    toolsOptionsDispatch({
      type: 'UPDATE',
      value: {
        //isOpen: true,
        isHidden: helpPanelHidden,
        content: (
          <SimpleHelpPanelLayout
            headerContent={t('header', { ns: 'help-race-stats' })}
            bodyContent={t('content', { ns: 'help-race-stats' })}
            footerContent={t('footer', { ns: 'help-race-stats' })}
          />
        ),
      },
    });

    return () => {
      toolsOptionsDispatch({ type: 'RESET' });
    };
  }, [toolsOptionsDispatch]);

  // Show event selector modal if no event has been selected, timekeeper must have an event selected to work
  useEffect(() => {
    if (selectedEvent.eventId == null) {
      setEventSelectModalVisible(true);
    }
  }, [selectedEvent]);

  return (
    <>
      <PageLayout
        helpPanelHidden={helpPanelHidden}
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
