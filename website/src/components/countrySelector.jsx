import { FormField, Select } from '@cloudscape-design/components';
import { getNames, registerLocale } from 'i18n-iso-countries';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag } from './flag';


export function CountrySelector(props) {
    const [countryOptions, setCountryOptions] = useState();
    const [countryCode, setCountryCode] = useState('');
    
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

    const GetCountryOptionFromId = (id) => {
        if (countryOptions) {
            return countryOptions.find((option) => option.value === id);
        }
    };

    return (
        <FormField
            label={t('events.country')}
            description={t('events.country-description')}
        >
            <Select
                selectedOption={GetCountryOptionFromId(countryCode)}
                onChange={({ detail }) =>
                    console.log(detail.selectedOption.value)
                }
                options={countryOptions}
                selectedAriaLabel="Selected"
                filteringType="auto"
            />
            <Flag countryCode={countryCode}></Flag>
        </FormField>
    )
}