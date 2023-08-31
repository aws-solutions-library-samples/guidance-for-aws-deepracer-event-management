import { FormField, Select } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/store';

export const RacerSelector = ({ onConfigUpdate, race, racerValidation, selectedEvent }) => {
  const { t } = useTranslation();
  const [userOptions, SetUserOptions] = useState([]);

  const [state] = useStore();
  const racers = state.users.users;
  const isLoadingRacers = state.users.isLoading;

  useEffect(() => {
    if (!isLoadingRacers) {
      SetUserOptions(
        racers.map((user) => {
          let option = { label: user.Username, value: user.sub };
          return option;
        })
      );
    }
  }, [racers, isLoadingRacers, selectedEvent]);

  const GetRacerOptionFromId = (id) => {
    if (!id) return;
    const selectedUser = userOptions.find((userOption) => userOption.value === id);
    if (selectedUser) return selectedUser;
    return undefined;
  };

  return (
    <>
      <FormField label={t('timekeeper.racer-selector.select-racer')}>
        <Select
          selectedOption={GetRacerOptionFromId(race.userId)}
          onChange={({ detail }) =>
            onConfigUpdate({
              userId: detail.selectedOption.value,
              username: detail.selectedOption.label,
            })
          }
          options={userOptions}
          selectedAriaLabel={t('timekeeper.racer-selector.selected')}
          filteringType="auto"
          virtualScroll
          invalid={racerValidation.isInvalid}
          disabled={racerValidation.isDisabled}
          loadingText={t('timekeeper.racer-selector.loading-racers')}
          statusType={isLoadingRacers ? t('timekeeper.racer-selector.loading') : ''}
        />
      </FormField>
    </>
  );
};
