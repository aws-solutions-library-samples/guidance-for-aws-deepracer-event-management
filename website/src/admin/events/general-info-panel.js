import {
  Container,
  DatePicker,
  FormField,
  Header,
  Input,
  Select,
  SpaceBetween,
} from '@cloudscape-design/components';
import { getNames, registerLocale } from 'i18n-iso-countries';
import React, { useContext, useEffect, useState } from 'react';
import { eventContext } from '../../store/EventProvider';

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
        <FormField label="Name" description="The name of the Event." errorText={errorMessage}>
          <Input
            placeholder="My awsome event"
            ariaRequired={true}
            value={eventName}
            onChange={(event) => UpdateConfig({ eventName: event.detail.value })}
          />
        </FormField>

        <FormField label="Date" description="The date for when the event will be held">
          <DatePicker
            onChange={({ detail }) => UpdateConfig({ eventDate: detail.value })}
            value={eventDate}
            openCalendarAriaLabel={(selectedDate) =>
              'Choose event date' + (selectedDate ? `, selected date is ${selectedDate}` : '')
            }
            nextMonthAriaLabel="Next month"
            placeholder="YYYY/MM/DD"
            previousMonthAriaLabel="Previous month"
            todayAriaLabel="Today"
          />
        </FormField>
        <FormField label="Country" description="Where will the event be hosted">
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
