import { Box, ColumnLayout, SpaceBetween } from '@cloudscape-design/components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EventLinksButtons } from '../../../components/eventLinksButtons';
import { Flag } from '../../../components/flag';
import awsconfig from '../../../config.json';
import { useUsers } from '../../../hooks/useUsers';
import { GetTypeOfEventNameFromId } from '../support-functions/eventDomain';
import {
  GetRaceResetsNameFromId,
  GetRankingNameFromId,
  GetTrackTypeNameFromId,
} from '../support-functions/raceConfig';
import { TrackTable } from './trackTable';

export const EventDetailsPanelContent = ({ event }) => {
  const { t } = useTranslation();

  const [, , getUserNameFromId] = useUsers();

  const attributeField = (header, value) => {
    return (
      <SpaceBetween size="xxxs">
        <Box fontWeight="bold">{header}</Box>
        <div>{value ?? '-'}</div>
      </SpaceBetween>
    );
  };
  // JSX

  return (
    <>
      <ColumnLayout columns={4} variant="text-grid">
        {attributeField(t('events.event-type'), GetTypeOfEventNameFromId(event.typeOfEvent))}
        {attributeField(t('events.created-by'), getUserNameFromId(event.createdBy || '-'))}

        {attributeField(t('events.event-date'), event.eventDate)}
        {attributeField(t('events.country'), <Flag countryCode={event.countryCode}></Flag>)}

        {attributeField(
          t('events.race.ranking-method'),
          GetRankingNameFromId(event.raceConfig.rankingMethod)
        )}
        {attributeField(t('events.track-type'), GetTrackTypeNameFromId(event.raceConfig.trackType))}
        {attributeField(t('events.race.race-time'), event.raceConfig.raceTimeInMin)}
        {attributeField(
          t('events.race.resets-per-lap'),
          GetRaceResetsNameFromId(event.raceConfig.numberOfResetsPerLap)
        )}
        {attributeField(t('events.sponsor.label'), event.sponsor || '-')}
        {attributeField(
          t('events.landing-page-link'),
          <EventLinksButtons
            href={`${awsconfig.Urls.leaderboardWebsite}/landing-page/${event.eventId.toString()}/`}
            linkTextPrimary={t('events.landing-page-link-same-tab')}
            linkTextExternal={t('events.landing-page-link-new-tab')}
          />
        )}
      </ColumnLayout>

      <br />

      <TrackTable eventId={event.eventId} tracks={event.tracks} />
    </>
  );
};
