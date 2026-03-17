import { FormField, Select, SelectProps } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/store';

interface RaceConfig {
  userId?: string;
  username?: string;
}

interface RacerValidation {
  isInvalid: boolean;
  isDisabled: boolean;
}

interface RacerSelectorProps {
  onConfigUpdate: (config: RaceConfig) => void;
  race: RaceConfig;
  racerValidation: RacerValidation;
  selectedEvent: any; // TODO: Type this properly with Event type
  description?: string;
}

type UserOption = SelectProps.Option;

export const RacerSelector: React.FC<RacerSelectorProps> = ({
  onConfigUpdate,
  race,
  racerValidation,
  selectedEvent,
  description,
}) => {
  const { t } = useTranslation();
  const [userOptions, SetUserOptions] = useState<UserOption[]>([]);

  const [state] = useStore();
  const racers = state.users?.users ?? [];
  const isLoadingRacers = state.users?.isLoading ?? false;

  useEffect(() => {
    if (!isLoadingRacers) {
      SetUserOptions(
        racers.map((user) => {
          const option: UserOption = { label: user.Username, value: user.sub };
          return option;
        })
      );
    }
  }, [racers, isLoadingRacers, selectedEvent]);

  const GetRacerOptionFromId = (id?: string): UserOption | undefined => {
    if (!id) return undefined;
    const selectedUser = userOptions.find((userOption) => userOption.value === id);
    if (selectedUser) return selectedUser;
    return undefined;
  };

  return (
    <>
      <FormField label={t('timekeeper.racer-selector.select-racer')} description={description}>
        <Select
          selectedOption={GetRacerOptionFromId(race.userId) ?? null}
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
          statusType={isLoadingRacers ? 'loading' : 'finished'}
        />
      </FormField>
    </>
  );
};
