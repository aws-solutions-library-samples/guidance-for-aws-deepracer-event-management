import { Container, Header, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LeaderBoardConfigPanel } from './leaderboardConfigPanel';
import { TrackConfigPanel } from './trackConfigPanel';

export const RacePanel = ({ tracks, onChange, onFormIsValid, onFormIsInvalid }) => {
    const { t } = useTranslation();
    const [trackConfig, setTrackConfig] = useState({
        trackId: 1,
        raceConfig: {
            numberOfResetsPerLap: undefined,
            raceTimeInMin: undefined,
            trackType: undefined,
            rankingMethod: undefined,
        },

        leaderboardConfig: {
            footerText: undefined,
            headerText: undefined,
            sponsor: undefined,
        },
    });

    useEffect(() => {
        if (tracks) {
            setTrackConfig(tracks[0]);
        }
    }, [tracks]);

    const UpdateConfig = (attr) => {
        onChange({ tracks: [{ ...attr }] });
    };

    // JSX
    return (
        <Container header={<Header variant="h2">Track {trackConfig.trackId}</Header>}>
            <SpaceBetween size="xl">
                <TrackConfigPanel
                    trackId={trackConfig.trackId}
                    {...trackConfig.raceConfig}
                    onChange={UpdateConfig}
                />
                <LeaderBoardConfigPanel
                    {...trackConfig.leaderboardConfig}
                    onChange={UpdateConfig}
                    onFormIsValid={onFormIsValid}
                    onFormIsInvalid={onFormIsInvalid}
                />
            </SpaceBetween>
        </Container>
    );
};
