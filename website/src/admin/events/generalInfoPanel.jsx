import {
  Container,
  DatePicker,
  FormField,
  Header,
  Input,
  Select,
  SpaceBetween
} from '@cloudscape-design/components';
import { getNames, registerLocale } from 'i18n-iso-countries';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { eventContext } from '../../store/eventProvider';

export const EventInfoPanel = ({
  onFormIsValid,
  onFormIsInvalid,
  eventName,
  eventDate,
  countryCode,
  onChange,
}) => {
  const [errorMessage, setErrorMessage] = useState();
  const [countryOptions, setCountryOptions] = useState();
  const { events } = useContext(eventContext);
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

  // Input validation for eventName
  // TODO fix so that two events can´t have the same name
  useEffect(() => {
    if (eventName) {
      // if (
      //   events &&
      //   events
      //     .map((event) => {
      //       return event.eventName;
      //     })
      //     .includes(eventName.trim())
      // ) {
      //   console.info('Name match:' + eventName);
      //   if (currentEventName && currentEventName === eventName) {
      //     console.info('Name match for own name:' + eventName);
      //     setErrorMessage('');
      //     onFormIsValid();
      //   } else {
      //     console.info(
      //       'Name dows not match own name:' + eventName + ', Current name: ' + currentEventName
      //     );
      //     setErrorMessage(`Event with name ${eventName} already exists`);
      //     onFormIsInvalid();
      //   }
      // } else {
      setErrorMessage('');
      onFormIsValid();
      // }
    } else {
      setErrorMessage(`Event name cannot be empty`);
      onFormIsInvalid();
    }
  }, [eventName, events, onFormIsInvalid, onFormIsValid]);

  const UpdateConfig = (attr) => {
    onChange({ generalConfig: attr });
  };

  const GetCountryOptionFromId = (id) => {
    if (countryOptions) {
      return countryOptions.find((option) => option.value === id);
    }
  };

  return (
    <Container header={<Header variant="h2">General settings</Header>}>
      <SpaceBetween size="l">
        <FormField
          label={t('events.event-name')}
          description={t('events.event-name-description')}
          errorText={errorMessage}
        >
          <Input
            placeholder={t('events.event-name-placeholder')}
            ariaRequired={true}
            value={eventName}
            onChange={(event) => UpdateConfig({ eventName: event.detail.value })}
          />
        </FormField>

        <FormField label={t('events.event-date')} description={t('events.event-date-descriprion')}>
          <DatePicker
            onChange={({ detail }) => UpdateConfig({ eventDate: detail.value })}
            value={eventDate}
            openCalendarAriaLabel={(selectedDate) =>
              t('events.event-date-choose') +
              (selectedDate ? `, ` + t('events.event-date-selected') + ` ${selectedDate}` : '')
            }
            nextMonthAriaLabel={t('events.event-date-next-month')}
            placeholder={t('events.event-date-placeholder')}
            previousMonthAriaLabel={t('events.event-date-previous-month')}
            todayAriaLabel={t('events.event-date-today')}
          />
        </FormField>
        <FormField label={t('events.country')} description={t('events.country-description')}>
          <Select
            selectedOption={GetCountryOptionFromId(countryCode)}
            onChange={({ detail }) => UpdateConfig({ countryCode: detail.selectedOption.value })}
            options={countryOptions}
            selectedAriaLabel="Selected"
            filteringType="auto"
          />
        </FormField>
      </SpaceBetween>
    </Container>
  );
};
