import ColumnLayout from "@cloudscape-design/components/column-layout";
import { API, graphqlOperation } from 'aws-amplify';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getLeaderboard } from "../../graphql/queries";
import { onNewOverlayInfo } from '../../graphql/subscriptions';
import { eventContext } from '../../store/eventProvider';
import { ContentHeader } from '../contentHeader';

import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";

import { Box, SpaceBetween, Table } from '@cloudscape-design/components';
import { convertMsToString } from "../../support-functions/convertMsToString";



const CommenatorRaceStats = () => {
    const { t } = useTranslation();
    const [subscription, SetSubscription] = useState();

    const { selectedEvent } = useContext(eventContext);
    const [ actualRacer, SetActualRacer ] = useState('No active Racer');

    const [ fastesRacerTime, SetFastesRacerTime ] = useState()

    const [ fastesLapsForTrack, SetFastestLapsForTrack] = useState([])
    const [ slowestLapsForTrack, SetSlowestLapsForTrack ] = useState([])
    
    useEffect(() => {
        if (selectedEvent) {
            const loadLeaderboard = async () => {
                const eventId = selectedEvent.eventId
    
                const response = await API.graphql(
                    graphqlOperation(getLeaderboard, { eventId: eventId, trackId: 1 })
                );
                const leaderboard = response.data.getLeaderboard;
                console.info(response.data.getLeaderboard)

                SetFastestLapsForTrack(leaderboard.entries > 5 ? leaderboard.entries.slice(5): leaderboard.entries)
                SetSlowestLapsForTrack(leaderboard.entries > 5 ? leaderboard.entries.slice(-5).reverse(): leaderboard.entries.slice().reverse())
            }

            loadLeaderboard();
        }
    }, [selectedEvent]);



    useEffect(() => {
        if(selectedEvent) {
            if (subscription) {
                subscription.unsubscribe();
            }
            
            const eventId = selectedEvent.eventId
            console.info(eventId)

            SetSubscription(API.graphql(
                    graphqlOperation(onNewOverlayInfo, { eventId: eventId })
                ).subscribe({
                    next: (event) => {
                        const eventData =  event.value.data.onNewOverlayInfo
                        console.log(eventData.username);
                        if(eventData.username !== actualRacer)
                            SetActualRacer(eventData.username)
                    },
                    error: (error) => console.warn(error),
                })
            );
        
            return () => {
                if(subscription) {
                    subscription.unsubscribe();
                }
            };
        }
      }, [selectedEvent]);

    const ValueWithLabel = ({ label, children }) => (
        <div>
            <Box variant="awsui-key-label">{label}</Box>
            <div>{children}</div>
        </div>
    );

    const columnDefinitions = [
        {
            id: "time",
            header: "time",
            cell: item => convertMsToString(item.fastestLapTime) || "-"
        },{
            id: "racerName",
            header: "Racer Name",
            cell: item => item.username || "-"
        },{
            id: "numberOfValidLaps",
            header: "Valid Laps",
            cell: item => item.numberOfValidLaps || "-"
        },{
            id: "avgLapsPerAttempt",
            header: "Average Laps",
            cell: item => item.avgLapsPerAttempt || "-"
        }
    ];

    return (
        <>
            <ContentHeader
                header={t('commentator.race.header')}
                description={t('commentator.race.stats')}
                breadcrumbs={[
                { text: t('home.breadcrumb'), href: '/' },
                { text: t('commentator.breadcrumb') },
                { text: t('commentator.race.breadcrumb'), href: '/' },
                ]}
            />

            <ColumnLayout columns={2}>
                <Container
                    header={
                        <Header
                            variant="h2"
                            description={t('commentator.race.actualRacerStats')}
                        >
                        Actual Racer
                        </Header>
                    }
                    >

                    <SpaceBetween size="l">
                        <ValueWithLabel label={t('commentator.race.racerName')}>{actualRacer}</ValueWithLabel>
                        <ValueWithLabel label={t('commentator.race.racerFastestLap')}>{fastesRacerTime}</ValueWithLabel>
                    </SpaceBetween>
                </Container>

                <div></div>

                <Container
                    header={
                        <Header
                            variant="h2"
                        >
                        {t('commentator.race.overallFastestLaps')}
                        </Header>
                    }
                    >
                    <Table 
                        columnDefinitions={columnDefinitions}
                        visibleColumns={[
                            "time",
                            "racerName"
                          ]}
                        items={fastesLapsForTrack}
                        loadingText={t('commentator.race.loading')}
                        sortingDisabled>
                    </Table>
                </Container>

                <Container
                    header={
                        <Header
                            variant="h2"
                        >
                        {t('commentator.race.overallSlowestLaps')}
                        </Header>
                    }
                    >
                    <Table 
                        columnDefinitions={columnDefinitions}
                        visibleColumns={[
                            "time",
                            "racerName"
                          ]}
                        items={slowestLapsForTrack}
                        loadingText={t('commentator.race.loading')}
                        sortingDisabled>
                    </Table>
                </Container>
            </ColumnLayout>
        </>
    );
};

export { CommenatorRaceStats };
