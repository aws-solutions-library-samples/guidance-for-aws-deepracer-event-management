import { Button, Form, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageLayout } from '../../components/pageLayout';
import useMutation from '../../hooks/useMutation';
import { merge } from '../../support-functions/merge';
import { useStore } from '../../store/store';
import { DevicesPanel } from './devicesPanel';
import { fleet, FleetConfig } from './fleetDomain';
import { GeneralInfoPanel } from './generalInfoPanel';
import { Breadcrumbs } from './support-functions/supportFunctions';

/**
 * EditFleet component for editing existing fleet configurations
 * @returns Rendered edit fleet form
 */
export const EditFleet = (): JSX.Element => {
  const { t } = useTranslation();
  const location = useLocation();
  const selectedFleet = location.state as FleetConfig | undefined;
  const navigate = useNavigate();
  const [state, dispatch] = useStore();
  
  const mutationResult = useMutation();
  const send = mutationResult[0] as (method: string, payload: any) => Promise<void>;
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

  // Ensure that also offline cars are loaded
  useEffect(() => {
    if (state.cars && !state.cars.offlineCars) {
      (async () => {
        await dispatch('REFRESH_CARS', true);
      })();
    }
  }, [dispatch, state.cars]);

  const updateConfigHandler = (attr: Partial<FleetConfig>): void => {
    console.debug('EditFleet - Changed Cars - Updating fleetConfig', JSON.stringify(attr));
    if ('carIds' in attr && Array.isArray(attr.carIds)) {
      setFleetConfig((prevState) => {
        return { ...prevState, carIds: attr.carIds };
      });
    } else if (attr) {
      setFleetConfig((prevState) => {
        return merge({ ...prevState }, attr) as Partial<FleetConfig>;
      });
    }
  };

  useEffect(() => {
    if (selectedFleet) {
      setFleetConfig(selectedFleet);
    }
  }, [selectedFleet, dispatch, state.cars]);

  const onSaveHandler = async (): Promise<void> => {
    console.debug('Sending fleet updates', fleetConfig);
    await send('updateFleet', fleetConfig);
  };

  const formIsValidHandler = (): void => {
    setCreateButtonIsDisabled(false);
  };

  const formIsInvalidHandler = (): void => {
    setCreateButtonIsDisabled(true);
  };

  const breadcrumbs = Breadcrumbs();
  breadcrumbs.push({ text: t('fleets.edit-fleet'), href: '' });

  return (
    <PageLayout
      helpPanelHidden={true}
      header={t('fleets.edit-fleet')}
      description={t('fleets.edit-description')}
      onLinkClick={(event: React.MouseEvent) => event.preventDefault()}
      breadcrumbs={breadcrumbs}
    >
      <form onSubmit={(event: React.FormEvent) => event.preventDefault()}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate(-1)} disabled={isLoading}>
                {t('button.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={onSaveHandler}
                disabled={isLoading || createButtonIsDisabled}
              >
                {t('button.save-changes')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <GeneralInfoPanel
              fleetName={fleetConfig.fleetName || ''}
              onChange={updateConfigHandler}
              onFormIsValid={formIsValidHandler}
              onFormIsInvalid={formIsInvalidHandler}
            />
            <DevicesPanel 
              onChange={updateConfigHandler} 
              fleetName={fleetConfig.fleetName || ''} 
              fleetId={fleetConfig.fleetId || ''} 
            />
          </SpaceBetween>
        </Form>
      </form>
    </PageLayout>
  );
};
