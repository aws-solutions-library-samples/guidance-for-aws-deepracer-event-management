import {
  AttributeEditor,
  Container,
  Header,
  Input,
  SpaceBetween,
} from '@cloudscape-design/components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const LandingPageConfigPanel = ({ onChange, onFormIsValid, onFormIsInvalid }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);

  useEffect(() => {
    console.debug(items);
    UpdateConfig(items);
  }, [items]);
  const UpdateConfig = (attr) => {
    const landingPageConfig = {
      landingPageConfig: {
        // We merge this data upstream, so removing elements becomes impossible.
        links: items,
      },
    };
    onChange(landingPageConfig);
  };

  const Control = React.memo(({ value, index, placeholder, setItems, prop }) => {
    return (
      <Input
        value={value}
        placeholder={placeholder}
        onChange={({ detail }) => {
          setItems((items) => {
            const updatedItems = [...items];
            updatedItems[index] = {
              ...updatedItems[index],
              [prop]: detail.value,
            };
            return updatedItems;
          });
        }}
      />
    );
  });

  const definition = useMemo(
    () => [
      {
        label: t('events.landing-page.settings.link-name'),
        control: (item, itemIndex) => (
          <Control
            prop="linkName"
            value={item.linkName}
            index={itemIndex}
            placeholder="Enter Link Name"
            setItems={setItems}
          />
        ),
      },
      {
        label: t('events.landing-page.settings.link-description'),
        control: (item, itemIndex) => (
          <Control
            prop="linkDescription"
            value={item.linkDescription}
            index={itemIndex}
            placeholder="Enter Link Description"
            setItems={setItems}
          />
        ),
      },
      {
        label: 'Link href',
        control: (item, itemIndex) => (
          <Control
            prop="linkHref"
            value={item.linkHref}
            index={itemIndex}
            placeholder="Enter href"
            setItems={setItems}
          />
        ),
      },
    ],
    []
  );

  const onAddButtonClick = useCallback(() => {
    setItems((items) => [...items, {}]);
  }, []);

  const onRemoveButtonClick = useCallback(({ detail: { itemIndex } }) => {
    setItems((items) => {
      const newItems = items.slice();
      newItems.splice(itemIndex, 1);
      return newItems;
    });
  }, []);

  // JSX
  return (
    <>
      <Container header={<Header variant="h2">{t('events.landing-page.settings.header')}</Header>}>
        <SpaceBetween size="xl">
          <AttributeEditor
            onAddButtonClick={onAddButtonClick}
            onRemoveButtonClick={onRemoveButtonClick}
            items={items}
            addButtonText={t('events.landing-page.settings.add-new-link-button')}
            definition={definition}
            removeButtonText={t('events.landing-page.settings.remove-button')}
          />
        </SpaceBetween>
      </Container>
    </>
  );
};
