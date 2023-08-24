import {
  Container,
  DatePicker,
  FormField,
  Grid,
  Header,
  Input,
  Select,
  SpaceBetween,
} from '@cloudscape-design/components';
import { getNames, registerLocale } from 'i18n-iso-countries';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag } from '../../../components/flag';
import { useEventsContext } from '../../../store/storeProvider';
import { EventTypeConfig, GetTypeOfEventOptionFromId } from '../support-functions/eventDomain';

export const EventInfoPanel = ({
  onFormIsValid,
  onFormIsInvalid,
  onChange,
  typeOfEvent,
  eventName = undefined,
  countryCode = '',
  eventDate = undefined,
  sponsor,
}) => {
  const [errorMessage, setErrorMessage] = useState();
  const [typeOfEventErrorMessage, setTypeOfEventErrorMessage] = useState();
  const [countryOptions, setCountryOptions] = useState();
  const [events] = useEventsContext();
  const eventTypeOptions = EventTypeConfig();
  const { t } = useTranslation();

  // Populate country options for select dropdown
  useEffect(() => {
    registerLocale(require('i18n-iso-countries/langs/en.json'));
    setCountryOptions(
      Object.entries(getNames('en', { select: 'official' })).map((_countryCode) => {
        return { label: _countryCode[1], value: _countryCode[0] };
      })
    );
  }, []);

  // Input validation
  useEffect(() => {
    if (eventName) {
      setErrorMessage('');
      onFormIsValid();
    } else {
      setErrorMessage(`Not allowed to be empty`);
      onFormIsInvalid();
    }
  }, [eventName, events, onFormIsInvalid, onFormIsValid]);

  useEffect(() => {
    if (typeOfEvent) {
      setTypeOfEventErrorMessage('');
      onFormIsValid();
    } else {
      setTypeOfEventErrorMessage(`Not allowed to be empty`);
      onFormIsInvalid();
    }
  }, [typeOfEvent, onFormIsInvalid, onFormIsValid]);

  const GetCountryOptionFromId = (id) => {
    if (countryOptions) {
      return countryOptions.find((option) => option.value === id);
    }
  };

  return (
    <Container header={<Header variant="h2">General settings</Header>}>
      <SpaceBetween size="l">
        <FormField
          label={t('events.event-type')}
          description={t('events.event-type-description')}
          errorText={typeOfEventErrorMessage}
        >
          <Select
            selectedOption={GetTypeOfEventOptionFromId(typeOfEvent)}
            onChange={({ detail }) => onChange({ typeOfEvent: detail.selectedOption.value })}
            options={eventTypeOptions}
            selectedAriaLabel="Selected"
            filteringType="auto"
          />
        </FormField>

        <FormField
          label={t('events.event-name')}
          description={t('events.event-name-description')}
          errorText={errorMessage}
        >
          <Input
            placeholder={t('events.event-name-placeholder')}
            ariaRequired={true}
            value={eventName}
            onChange={(event) => onChange({ eventName: event.detail.value })}
          />
        </FormField>

        <FormField label={t('events.event-date')} description={t('events.event-date-description')}>
          <DatePicker
            onChange={({ detail }) => onChange({ eventDate: detail.value })}
            value={eventDate ?? eventDate | undefined}
            openCalendarAriaLabel={(selectedDate) =>
              t('events.event-date-choose') +
              (selectedDate ? `, ` + t('events.event-date-selected') + ` ${selectedDate}` : '')
            }
            nextMonthAriaLabel={t('events.event-date-next-month')}
            placeholder={t('events.event-date-placeholder')}
            previousMonthAriaLabel={t('events.event-date-previous-month')}
            todayAriaLabel={t('events.event-date-today')}
            isDateEnabled={(date) => date >= new Date().setHours(0, 0, 0, 0)}
          />
        </FormField>
        <FormField label={t('events.country')} description={t('events.country-description')}>
          <Grid gridDefinition={[{ colspan: 10 }, { colspan: 2 }]}>
            <Select
              selectedOption={GetCountryOptionFromId(countryCode)}
              onChange={({ detail }) => onChange({ countryCode: detail.selectedOption.value })}
              options={countryOptions}
              selectedAriaLabel="Selected"
              filteringType="auto"
            />
            <Flag countryCode={countryCode}></Flag>
          </Grid>
        </FormField>
        <FormField
          label={t('events.leaderboard.sponsor')}
          description={t('events.leaderboard.sponsor-description')}
        >
          <Input onChange={({ detail }) => onChange({ sponsor: detail.value })} value={sponsor} />
        </FormField>
      </SpaceBetween>
    </Container>
  );
};
