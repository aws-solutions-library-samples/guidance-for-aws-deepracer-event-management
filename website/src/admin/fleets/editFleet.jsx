import { Button, Form, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/store';

import { useLocation, useNavigate } from 'react-router-dom';
import { PageLayout } from '../../components/pageLayout';
import useMutation from '../../hooks/useMutation';
import { merge } from '../../support-functions/merge';
import { DevicesPanel } from './devicesPanel';
import { fleet } from './fleetDomain';
import { GeneralInfoPanel } from './generalInfoPanel';
import { Breadcrumbs } from './support-functions/supportFunctions';

export const EditFleet = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const selectedFleet = location.state;
  const navigate = useNavigate();
  const [state, dispatch] = useStore();
  const [send, loading, errorMessage, data] = useMutation();
  const [createButtonIsDisabled, setCreateButtonIsDisabled] = useState(false);
  const [fleetConfig, setFleetConfig] = useState(fleet);

  useEffect(() => {
    if (!loading && data && !errorMessage) {
      navigate(-1);
    }
  }, [loading, data, errorMessage, navigate]);

  // Ensure that also offline cars are loaded
  useEffect(() => {
    if (!state.cars.offlineCars) {
      (async () => {
        await dispatch('REFRESH_CARS', true);
      })();
    }
  }, [dispatch, state.cars.offlineCars]);

  const updateConfigHandler = (attr) => {
    console.debug('EditFleet - Changed Cars - Updating fleetConfig', JSON.stringify(attr));
    if (Array.isArray(attr.carIds)) {
      setFleetConfig((prevState) => {
        return { ...prevState, carIds: attr.carIds };
      });
    } else if (attr) {
      setFleetConfig((prevState) => {
        return merge({ ...prevState }, attr);
      });
    }
  };

  useEffect(() => {
    if (selectedFleet) {
      setFleetConfig(selectedFleet);
    }
  }, [selectedFleet, dispatch, state.cars.offlineCars]);

  const onSaveHandler = async () => {
    console.debug('Sending fleet updates', fleetConfig);
    await send('updateFleet', fleetConfig);
  };

  const formIsValidHandler = () => {
    setCreateButtonIsDisabled(false);
  };

  const formIsInvalidHandler = () => {
    setCreateButtonIsDisabled(true);
  };

  const breadcrumbs = Breadcrumbs();
  breadcrumbs.push({ text: t('fleets.edit-fleet') });

  return (
    <PageLayout
      helpPanelHidden="true"
      header={t('fleets.edit-fleet')}
      description={t('fleets.edit-description')}
      breadcrumbs={breadcrumbs}
    >
      <form onSubmit={(event) => event.preventDefault()}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate(-1)} disabled={loading}>
                {t('button.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={onSaveHandler}
                disabled={loading || createButtonIsDisabled}
              >
                {t('button.save-changes')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <GeneralInfoPanel
              {...fleetConfig}
              onChange={updateConfigHandler}
              onFormIsValid={formIsValidHandler}
              onFormIsInvalid={formIsInvalidHandler}
            />
            <DevicesPanel onChange={updateConfigHandler} {...fleetConfig} />
          </SpaceBetween>
        </Form>
      </form>
    </PageLayout>
  );
};
