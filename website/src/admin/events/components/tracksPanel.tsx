import { Box, Button, SpaceBetween, Tabs, TabsProps } from '@cloudscape-design/components';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LeaderBoardConfigPanel } from './leaderboardConfigPanel';
import { Track } from '../../../types/domain';

interface TracksPanelProps {
  tracks: Track[];
  onChange: (value: { tracks: Track[] }) => void;
  onFormIsValid: () => void;
  onFormIsInvalid: () => void;
}

export const TracksPanel: React.FC<TracksPanelProps> = ({ tracks, onChange, onFormIsValid, onFormIsInvalid }) => {
  const { t } = useTranslation();
  const [activeTabId, setActiveTabId] = useState<string>('1');
  const [lastPressedTabId, setLastPressedTabId] = useState<string>('1');
  const [tabsContent, setTabsContent] = useState<TabsProps.Tab[]>([]);

  // Make sure the right tab is active
  useEffect(() => {
    if (tracks.length === 1) {
      const trackId = tracks[0].trackId.toString();
      setActiveTabId(trackId);
    } else if (lastPressedTabId === 'add') {
      const trackId = tracks[tracks.length - 2].trackId.toString();
      setActiveTabId(trackId);
    } else {
      setActiveTabId(lastPressedTabId.toString());
    }
  }, [tracks, lastPressedTabId]);

  const UpdateConfig = useCallback(
    (attr: Partial<Track>) => {
      const updated_tracks = structuredClone(tracks);

      const indexToUpdate = updated_tracks.findIndex((track) => track.trackId === attr.trackId);
      if (indexToUpdate > -1) {
        updated_tracks[indexToUpdate] = { ...updated_tracks[indexToUpdate], ...attr };
      }

      onChange({ tracks: updated_tracks });
    },
    [tracks, onChange]
  );

  const addTrackHandler = useCallback((): void => {
    const newTrack = structuredClone(tracks.slice(-1)[0]); // copy last element in tracks list
    let updatedTracks = [...tracks];

    // insert the new track before the combined leaderboard
    if (tracks.length >= 2) {
      newTrack.trackId = tracks.length.toString(); // assign new trackId
      updatedTracks.splice(tracks.length - 1, 0, newTrack);
    } else {
      newTrack.trackId = (tracks.length + 1).toString(); // assign new trackId
      updatedTracks.push(newTrack);
    }

    // create a combined leaderboard if there are more than 1 Track
    if (updatedTracks.length === 2) {
      const combinedLeaderboard = structuredClone(tracks.slice(-1)[0]);
      combinedLeaderboard.trackId = 'combined';
      updatedTracks = [...updatedTracks, combinedLeaderboard];
    }

    onChange({ tracks: updatedTracks });
  }, [tracks, onChange]);

  const deleteTrackHandler = useCallback(
    (index: number): void => {
      let updatedTracks = tracks.filter((track, trackConfigIndex) => trackConfigIndex !== index);
      updatedTracks = recalculateTrackIds(updatedTracks);

      // only one track left, remove combined leaderboard
      if (updatedTracks.length <= 2) {
        updatedTracks = updatedTracks.filter((track) => track.trackId !== 'combined');
      }

      onChange({ tracks: updatedTracks });
    },
    [tracks, onChange]
  );

  const recalculateTrackIds = (tracks: Track[]): Track[] => {
    return tracks.map((track, index) => {
      if (track.trackId !== 'combined') {
        return { ...track, trackId: (index + 1).toString() };
      } else return track;
    });
  };

  // only regenerate the tabs content if tracks is updated
  useEffect(() => {
    const deleteIsDisabled = tracks.length <= 1;
    setTabsContent(
      tracks.map((track, index) => {
        const trackId = track.trackId;
        const label =
          trackId === 'combined' ? t('events.combined') : t('events.track-prefix', { trackId });
        return {
          label: label,
          id: trackId.toString(),
          content: (
            <SpaceBetween size="xl">
              <LeaderBoardConfigPanel
                trackConfig={track}
                onChange={UpdateConfig}
                onFormIsValid={onFormIsValid}
                onFormIsInvalid={onFormIsInvalid}
              />
              <Box float="right">
                <Button
                  disabled={deleteIsDisabled || trackId === 'combined'}
                  onClick={() => {
                    deleteTrackHandler(index);
                  }}
                >
                  {t('button.delete')}
                </Button>
              </Box>
            </SpaceBetween>
          ),
        };
      })
    );
  }, [tracks, UpdateConfig, deleteTrackHandler, onFormIsInvalid, onFormIsValid, t]);

  return (
    <Tabs
      activeTabId={activeTabId}
      onChange={(event) => {
        if (event.detail.activeTabId != null) setLastPressedTabId(event.detail.activeTabId);
      }}
      variant="container"
      tabs={[
        ...tabsContent,
        {
          label: <Button iconName="add-plus" variant="icon" onClick={addTrackHandler} />,
          id: 'add',
        },
      ]}
    />
  );
};
