import { Button, Form, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

  const [send, loading, errorMessage, data] = useMutation();
  const [createButtonIsDisabled, setCreateButtonIsDisabled] = useState(false);
  const [fleetConfig, setFleetConfig] = useState(fleet);

  useEffect(() => {
    if (!loading && data && !errorMessage) {
      navigate(-1);
    }
  }, [loading, data, errorMessage, navigate]);

  const UpdateConfigHandler = (attr) => {
    if (Array.isArray(attr.carIds) && attr.carIds.length === 0) {
      setFleetConfig((prevState) => {
        return { ...prevState, carIds: [] };
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
  }, [selectedFleet]);

  const onUpdateHandler = async () => {
    send('carUpdates', {
      resourceIds: fleetConfig.carIds,
      fleetId: fleetConfig.fleetId,
      fleetName: fleetConfig.fleetName,
    });
    send('updateFleet', fleetConfig);
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
                onClick={onUpdateHandler}
                disabled={loading || createButtonIsDisabled}
              >
                {t('button.save-changes')}
              </Button>
            </SpaceBetween>
          }
          errorText={errorMessage}
          errorIconAriaLabel="Error"
        >
          <SpaceBetween size="l">
            <GeneralInfoPanel
              {...fleetConfig}
              onChange={UpdateConfigHandler}
              onFormIsValid={formIsValidHandler}
              onFormIsInvalid={formIsInvalidHandler}
            />
            <DevicesPanel onChange={UpdateConfigHandler} {...fleetConfig} />
          </SpaceBetween>
        </Form>
      </form>
    </PageLayout>
  );
};
