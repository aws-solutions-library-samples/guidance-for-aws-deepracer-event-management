import { FormField, Select } from '@cloudscape-design/components';
import { getNames, registerLocale } from 'i18n-iso-countries';
import React, { useEffect, useState } from 'react';

export function CountrySelector(props) {
    const [countryOptions, setCountryOptions] = useState();

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
            label={props.label}
            description={props.description}
        >
            <Select
                selectedOption={GetCountryOptionFromId(props.countryCode)}
                onChange={({ detail }) => {
                    props.setCountryCode(detail.selectedOption.value);
                }}
                options={countryOptions}
                selectedAriaLabel="Selected"
                filteringType="auto"
            />
        </FormField>
    )
}