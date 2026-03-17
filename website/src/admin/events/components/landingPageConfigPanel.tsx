import {
  AttributeEditor,
  AttributeEditorProps,
  Container,
  Header,
  Input,
  SpaceBetween,
} from '@cloudscape-design/components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Landing page link configuration
 */
interface LandingPageLink {
  linkName?: string;
  linkDescription?: string;
  linkHref?: string;
}

/**
 * Landing page configuration structure
 */
interface LandingPageConfig {
  landingPageConfig: {
    links: LandingPageLink[];
  };
}

/**
 * Props for LandingPageConfigPanel component
 */
interface LandingPageConfigPanelProps {
  onChange: (config: LandingPageConfig) => void;
  onFormIsValid: () => void;
  onFormIsInvalid: () => void;
}

/**
 * Props for Control component
 */
interface ControlProps {
  value?: string;
  index: number;
  placeholder: string;
  setItems: React.Dispatch<React.SetStateAction<LandingPageLink[]>>;
  prop: keyof LandingPageLink;
}

export const LandingPageConfigPanel: React.FC<LandingPageConfigPanelProps> = ({
  onChange,
  onFormIsValid,
  onFormIsInvalid,
}) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<LandingPageLink[]>([]);

  useEffect(() => {
    console.debug(items);
    UpdateConfig(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const UpdateConfig = (attr: LandingPageLink[]) => {
    const landingPageConfig: LandingPageConfig = {
      landingPageConfig: {
        // We merge this data upstream, so removing elements becomes impossible.
        links: items,
      },
    };
    onChange(landingPageConfig);
  };

  const Control: React.FC<ControlProps> = React.memo(({ value, index, placeholder, setItems, prop }) => {
    return (
      <Input
        value={value || ''}
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

  const definition: AttributeEditorProps.FieldDefinition<LandingPageLink>[] = useMemo(
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
    [t]
  );

  const onAddButtonClick = useCallback(() => {
    setItems((items) => [...items, {}]);
  }, []);

  const onRemoveButtonClick = useCallback(({ detail: { itemIndex } }: { detail: { itemIndex: number } }) => {
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
