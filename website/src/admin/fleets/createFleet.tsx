import { Button, Form, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../../components/pageLayout';
import useMutation from '../../hooks/useMutation';
import { merge } from '../../support-functions/merge';
import { DevicesPanel } from './devicesPanel';
import { fleet, FleetConfig } from './fleetDomain';
import { GeneralInfoPanel } from './generalInfoPanel';

/**
 * CreateFleet component for creating new fleets
 * @returns Rendered fleet creation page
 */
export const CreateFleet = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const mutationResult = useMutation();
  const send = mutationResult[0] as (method: any, payload: any) => Promise<void>;
  const isLoading = mutationResult[1] as boolean;
  const errorMessage = mutationResult[2] as string;
  const data = mutationResult[3];

  const [createButtonIsDisabled, setCreateButtonIsDisabled] = useState<boolean>(false);
  const [fleetConfig, setFleetConfig] = useState<Partial<FleetConfig>>(fleet);

  useEffect(() => {
    if (!isLoading && data && !errorMessage) {
      navigate(-1);
    }
  }, [isLoading, data, errorMessage, navigate]);

  const UpdateConfigHandler = (attr: Partial<FleetConfig>): void => {
    if ('carIds' in attr && Array.isArray(attr.carIds) && attr.carIds.length === 0) {
      setFleetConfig((prevState) => {
        return { ...prevState, carIds: [] };
      });
    } else if (attr) {
      setFleetConfig((prevState) => {
        return merge({ ...prevState }, attr) as Partial<FleetConfig>;
      });
    }
  };

  const onCreateHandler = async (): Promise<void> => {
    if (typeof send === 'function') {
      send('addFleet', fleetConfig);
      send('carsUpdateFleet', {
        resourceIds: fleetConfig.carIds ?? [],
        fleetId: fleetConfig.fleetId,
        fleetName: fleetConfig.fleetName,
      });
    }
  };

  const formIsValidHandler = (): void => {
    setCreateButtonIsDisabled(false);
  };

  const formIsInvalidHandler = (): void => {
    setCreateButtonIsDisabled(true);
  };

  return (
    <PageLayout
      header={t('fleets.create-fleet')}
      description={t('fleets.description')}
      onLinkClick={(event: React.MouseEvent) => event.preventDefault()}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/admin/home' },
        { text: t('fleets.breadcrumb'), href: '/admin/fleets' },
        { text: t('fleets.create-fleet'), href: '#' },
      ]}
    >
      <form onSubmit={(event) => event.preventDefault()}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate(-1)} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={onCreateHandler}
                disabled={isLoading || createButtonIsDisabled}
              >
                Create Fleet
              </Button>
            </SpaceBetween>
          }
          errorText={errorMessage}
          errorIconAriaLabel="Error"
        >
          <SpaceBetween size="l">
            <GeneralInfoPanel
              fleetName={fleetConfig.fleetName || ''}
              onChange={UpdateConfigHandler}
              onFormIsValid={formIsValidHandler}
              onFormIsInvalid={formIsInvalidHandler}
            />
            <DevicesPanel 
              onChange={UpdateConfigHandler} 
              fleetName={fleetConfig.fleetName || ''} 
              fleetId={fleetConfig.fleetId || ''} 
            />
          </SpaceBetween>
        </Form>
      </form>
    </PageLayout>
  );
};
