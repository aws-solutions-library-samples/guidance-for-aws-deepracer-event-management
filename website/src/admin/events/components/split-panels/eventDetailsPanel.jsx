import { Box, ColumnLayout, Grid, SpaceBetween, SplitPanel } from '@cloudscape-design/components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EventLinksButtons } from '../../../../components/eventLinksButtons';
import awsconfig from '../../../../config.json';
import { useFleetsContext } from '../../../../store/storeProvider';
import { GetTypeOfEventNameFromId } from '../../support-functions/eventDomain';
import {
  GetRaceResetsNameFromId,
  GetRankingNameFromId,
  GetTrackTypeNameFromId,
} from '../../support-functions/raceConfig';

const EventDetailsPanel = ({ event, i18nStrings }) => {
  const { t } = useTranslation();

  const [, , getFleetNameFromId] = useFleetsContext();
  const attributeField = (header, value) => {
    return (
      <SpaceBetween size="xxxs">
        <Box fontWeight="bold">{header}:</Box>
        <div>{value ?? '-'}</div>
      </SpaceBetween>
    );
  };
  // JSX
  console.info(event);
  return (
    <SplitPanel
      header={event.eventName}
      i18nStrings={{
        ...i18nStrings,
      }}
    >
      <ColumnLayout columns={4} variant="text-grid">
        <Grid gridDefinition={[{ colspan: 12 }, { colspan: 12 }, { colspan: 12 }, { colspan: 12 }]}>
          {attributeField(t('events.event-type'), GetTypeOfEventNameFromId(event.typeOfEvent))}
          {attributeField(t('events.event-date'), event.eventDate)}
          {attributeField(t('events.created-at'), event.createdAt)}
          {attributeField(t('events.created-by'), event.createdBy)}
        </Grid>
        <Grid gridDefinition={[{ colspan: 12 }, { colspan: 12 }, { colspan: 12 }]}>
          {attributeField(t('events.event-date'), event.eventDate)}
          {attributeField(t('events.country'), event.countryCode)}
          {attributeField(t('events.fleet-info.label'), getFleetNameFromId(event.fleetId))}
        </Grid>
        <Grid gridDefinition={[{ colspan: 12 }, { colspan: 12 }, { colspan: 12 }, { colspan: 12 }]}>
          {attributeField(
            t('events.race.ranking-method'),
            GetRankingNameFromId(event.tracks[0].raceConfig.rankingMethod)
          )}
          {attributeField(
            t('events.track-type'),
            GetTrackTypeNameFromId(event.tracks[0].raceConfig.trackType)
          )}
          {attributeField(t('events.race.race-time'), event.tracks[0].raceConfig.raceTimeInMin)}
          {attributeField(
            t('events.race.resets-per-lap'),
            GetRaceResetsNameFromId(event.tracks[0].raceConfig.numberOfResetsPerLap)
          )}
        </Grid>
        <Grid gridDefinition={[{ colspan: 12 }, { colspan: 12 }, { colspan: 12 }]}>
          {attributeField(
            t('events.leaderboard-link'),

            <EventLinksButtons
              href={`${
                awsconfig.Urls.leaderboardWebsite
              }/leaderboard/${event.eventId.toString()}/?qr=true&scroll=true`}
              linkTextPrimary={t('events.leaderboard-link-same-tab')}
              linkTextExternal={t('events.leaderboard-link-new-tab')}
            />
          )}
          {attributeField(
            t('events.leaderboard.header'),
            event.tracks[0].leaderboardConfig.headerText
          )}
          {attributeField(
            t('events.leaderboard.footer'),
            event.tracks[0].leaderboardConfig.footerText
          )}
        </Grid>
      </ColumnLayout>
    </SplitPanel>
  );
};

export { EventDetailsPanel };
