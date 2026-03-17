import { SelectField } from '@aws-amplify/ui-react';
import { FormField, Select, SelectProps } from '@cloudscape-design/components';
import { getNames, registerLocale } from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Country option for Select dropdown
 */
interface CountryOption {
  label: string;
  value: string;
}

/**
 * Props for CountrySelector component
 */
interface CountrySelectorProps {
  amplify?: boolean;
  label?: string;
  description?: string;
  countryCode?: string;
  setCountryCode?: (code: string) => void;
}

export function CountrySelector({
  amplify = false,
  label,
  description,
  countryCode,
  setCountryCode,
}: CountrySelectorProps) {
  const { t } = useTranslation();
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [countryOptionsAmplify, setCountryOptionsAmplify] = useState<JSX.Element[]>([]);

  // Populate country options for select dropdown
  useEffect(() => {
    registerLocale(enLocale);
    setCountryOptions(
      Object.entries(getNames('en', { select: 'official' })).map((_countryCode) => {
        return { label: _countryCode[1], value: _countryCode[0] };
      })
    );
  }, []);

  // Populate country options for Amplify select dropdown
  useEffect(() => {
    registerLocale(enLocale);
    setCountryOptionsAmplify(
      Object.entries(getNames('en', { select: 'official' })).map((_countryCode) => {
        return (
          <option key={_countryCode[0]} value={_countryCode[0]} label={_countryCode[1]}>
            {_countryCode[1]}
          </option>
        );
      })
    );
  }, []);

  const GetCountryOptionFromId = (id?: string): SelectProps.Option | undefined => {
    if (countryOptions && id) {
      return countryOptions.find((option) => option.value === id);
    }
    return undefined;
  };

  if (amplify === true) {
    return (
      <SelectField
        label={label || t('users.country-select')}
        name="custom:countryCode"
        placeholder={t('users.country-select')}
        descriptiveText={description}
      >
        {countryOptionsAmplify}
      </SelectField>
    );
  } else {
    return (
      <FormField label={label} description={description}>
        <Select
          selectedOption={GetCountryOptionFromId(countryCode) || null}
          onChange={({ detail }) => {
            if (setCountryCode && detail.selectedOption.value) {
              setCountryCode(detail.selectedOption.value);
            }
          }}
          options={countryOptions}
          selectedAriaLabel="Selected"
          filteringType="auto"
          placeholder={t('users.country-placeholder')}
        />
      </FormField>
    );
  }
}
