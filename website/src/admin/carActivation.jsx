import { API } from 'aws-amplify';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContentHeader } from '../components/contentHeader';
// import { ListOfFleets } from '../components/listOfFleets';
import * as mutations from '../graphql/mutations';
import { fleetContext } from '../store/fleetProvider';

import {
    Box,
    Button,
    ButtonDropdown,
    Container,
    ExpandableSection,
    Form,
    FormField,
    Grid,
    Header,
    Input,
    Popover,
    SpaceBetween,
    StatusIndicator,
    TextContent,
} from '@cloudscape-design/components';

const AdminActivation = (props) => {
    const { t } = useTranslation();

    const [dremUrl, setDremUrl] = useState('');
    const [result, setResult] = useState('');
    const [activationCode, setActivationCode] = useState('');
    const [activationId, setActivationId] = useState('');
    const [region, setRegion] = useState('');
    const [hostname, setHostname] = useState('');
    const [password, setPassword] = useState('');
    const [ssid, setSsid] = useState('');
    const [wifiPass, setWifiPass] = useState('');
    const [wifiActivation, setWifiActivation] = useState('');
    const [ssmCommand, setSsmCommand] = useState('');
    const [updateCommand, setUpdateCommand] = useState('');
    const [buttonDisabled, setButtonDisabled] = useState(true);
    const [loading, setLoading] = useState('');
    const [hostnameErrorMessage, setHostnameErrorMessage] = useState('');
    const [passwordErrorMessage, setPasswordErrorMessage] = useState('');

    const [dropDownFleets, setDropDownFleets] = useState([{ id: 'none', text: 'none' }]);
    const [dropDownSelectedItem, setDropDownSelectedItem] = useState({ fleetName: 'Select Fleet' });

    const [isLoading, setIsLoading] = useState(true);
    const [fleets] = useContext(fleetContext);

    // convert fleets data to dropdown format
    useEffect(() => {
        if (fleets.length > 0) {
            setDropDownFleets(
                fleets.map((thisFleet) => {
                    return {
                        id: thisFleet.fleetId,
                        text: thisFleet.fleetName,
                    };
                })
            );
        }
        return () => {
            // Unmounting
        };
    }, [fleets]);

    // watch properties for changes and enable generate button if required
    useEffect(() => {
        if (
            password !== '' &&
            hostname !== '' &&
            dropDownSelectedItem.fleetName !== 'Select Fleet'
        ) {
            setButtonDisabled(false);
        }
        return () => {
            // Unmounting
        };
    }, [password, hostname, dropDownSelectedItem]);

    async function getActivation() {
        const apiResponse = await API.graphql({
            query: mutations.carActivation,
            variables: {
                fleetId: dropDownSelectedItem.fleetId,
                fleetName: dropDownSelectedItem.fleetName,
                hostname: hostname,
            },
        });
        const response = apiResponse['data']['carActivation'];
        setDremUrl(
            window.location.protocol +
                '//' +
                window.location.hostname +
                (window.location.port ? ':' + window.location.port : '')
        );
        setResult(response);
        setActivationCode(response['activationCode']);
        setActivationId(response['activationId']);
        setRegion(response['region']);
        setSsmCommand(
            'sudo amazon-ssm-agent -register -code "' +
                response['activationCode'] +
                '" -id "' +
                response['activationId'] +
                '" -region "' +
                response['region'] +
                '"'
        );
        if (ssid.length > 0) {
            setWifiActivation(' -s ' + ssid + ' -w ' + wifiPass);
        }
        setUpdateCommand(
            'curl -O ' +
                dremUrl +
                '/login.html && curl -O ' +
                dremUrl +
                '/manual_update.sh && chmod +x ./manual_update.sh && sudo ./manual_update.sh -p ' +
                password +
                ' -h ' +
                hostname +
                ' -c ' +
                response['activationCode'] +
                ' -i ' +
                response['activationId'] +
                ' -r ' +
                response['region'] +
                wifiActivation
        );
        setLoading('');
    }

    return (
        <>
            <ContentHeader
                header={t('car-activation.header')}
                description={t('car-activation.description')}
                breadcrumbs={[
                    { text: t('home.breadcrumb'), href: '/' },
                    { text: t('admin.breadcrumb'), href: '/admin/home' },
                    { text: t('car-activation.breadcrumb') },
                ]}
            />
            <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
                <div></div>
                <SpaceBetween direction="vertical" size="l">
                    <Form
                        actions={
                            <SpaceBetween direction="horizontal" size="xs">
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        getActivation();
                                    }}
                                    disabled={buttonDisabled}
                                >
                                    {t('car-activation.generate')}
                                </Button>
                            </SpaceBetween>
                        }
                    >
                        <Container textAlign="center">
                            <SpaceBetween direction="vertical" size="l">
                                <FormField label={t('car-activation.fleet')}>
                                    <ButtonDropdown
                                        items={dropDownFleets}
                                        onItemClick={({ detail }) => {
                                            const index = fleets
                                                .map((e) => e.fleetId)
                                                .indexOf(detail.id);
                                            setDropDownSelectedItem(fleets[index]);
                                        }}
                                    >
                                        {dropDownSelectedItem.fleetName}
                                    </ButtonDropdown>
                                </FormField>
                                <FormField
                                    label={t('car-activation.hostname')}
                                    errorText={hostnameErrorMessage}
                                >
                                    <Input
                                        value={hostname}
                                        placeholder={t('car-activation.hostname-placeholder')}
                                        onChange={(fleet) => {
                                            setHostname(fleet.detail.value);
                                        }}
                                    />
                                </FormField>
                                <FormField
                                    label={t('car-activation.password')}
                                    errorText={passwordErrorMessage}
                                >
                                    <Input
                                        value={password}
                                        placeholder={t('car-activation.password-placeholder')}
                                        onChange={(fleet) => {
                                            setPassword(fleet.detail.value);
                                        }}
                                    />
                                </FormField>

                                <ExpandableSection header={t('car-activation.wifi-config')}>
                                    <FormField label={t('car-activation.ssid')}>
                                        <Input
                                            value={ssid}
                                            placeholder={t('car-activation.ssid-placeholder')}
                                            onChange={(fleet) => {
                                                setSsid(fleet.detail.value);
                                            }}
                                        />
                                    </FormField>
                                    <FormField label={t('car-activation.wifi')}>
                                        <Input
                                            value={wifiPass}
                                            placeholder={t('car-activation.wifi-placeholder')}
                                            onChange={(fleet) => {
                                                setWifiPass(fleet.detail.value);
                                            }}
                                        />
                                    </FormField>
                                </ExpandableSection>
                            </SpaceBetween>
                        </Container>
                    </Form>

                    <Container>
                        <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
                            <Header variant="h3">{t('car-activation.script')}</Header>
                            <Container>
                                <Box color="text-status-info" textAlign="center">
                                    {loading}
                                    <code>{updateCommand}</code>
                                </Box>
                            </Container>
                            <Popover
                                dismissButton={false}
                                position="right"
                                size="small"
                                triggerType="custom"
                                content={
                                    <StatusIndicator type="success">
                                        {t('car-activation.copied-to-clipboard')}
                                    </StatusIndicator>
                                }
                            >
                                <Button
                                    iconName="copy"
                                    onClick={() => {
                                        navigator.clipboard.writeText(updateCommand);
                                    }}
                                >
                                    {t('button.copy')}
                                </Button>
                            </Popover>
                        </Grid>

                        <ExpandableSection header="Advanced">
                            <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
                                <Header variant="h3">Code</Header>
                                <Container>
                                    <Box color="text-status-info" textAlign="center">
                                        {loading}
                                        <code>{activationCode}</code>
                                    </Box>
                                </Container>
                                <Popover
                                    dismissButton={false}
                                    position="right"
                                    size="small"
                                    triggerType="custom"
                                    content={
                                        <StatusIndicator type="success">
                                            {t('car-activation.copied-to-clipboard')}
                                        </StatusIndicator>
                                    }
                                >
                                    <Button
                                        iconName="copy"
                                        onClick={() => {
                                            navigator.clipboard.writeText(activationCode);
                                        }}
                                    >
                                        {t('button.copy')}
                                    </Button>
                                </Popover>
                            </Grid>

                            <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
                                <Header variant="h3">Id</Header>
                                <Container>
                                    <Box color="text-status-info" textAlign="center">
                                        {loading}
                                        <code>{activationId}</code>
                                    </Box>
                                </Container>
                                <Popover
                                    dismissButton={false}
                                    position="right"
                                    size="small"
                                    triggerType="custom"
                                    content={
                                        <StatusIndicator type="success">
                                            {t('car-activation.copied-to-clipboard')}
                                        </StatusIndicator>
                                    }
                                >
                                    <Button
                                        iconName="copy"
                                        onClick={() => {
                                            navigator.clipboard.writeText(activationId);
                                        }}
                                    >
                                        {t('button.copy')}
                                    </Button>
                                </Popover>
                            </Grid>

                            <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
                                <Header variant="h3">{t('car-activation.ssm-only')}</Header>
                                <Container>
                                    <Box color="text-status-info" textAlign="center">
                                        {loading}
                                        <code>{ssmCommand}</code>
                                    </Box>
                                </Container>
                                <Popover
                                    dismissButton={false}
                                    position="right"
                                    size="small"
                                    triggerType="custom"
                                    content={
                                        <StatusIndicator type="success">
                                            {t('car-activation.copied-to-clipboard')}
                                        </StatusIndicator>
                                    }
                                >
                                    <Button
                                        iconName="copy"
                                        onClick={() => {
                                            navigator.clipboard.writeText(ssmCommand);
                                        }}
                                    >
                                        {t('button.copy')}
                                    </Button>
                                </Popover>
                            </Grid>
                        </ExpandableSection>
                    </Container>

                    <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}>
                        <div></div>
                        <div>
                            <Button href="/manual_update.sh" iconAlign="right" iconName="external">
                                manual_update.sh {t('car-activation.script-lower')}
                            </Button>
                            <TextContent>
                                <p>{t('car-activation.script-warning')}</p>
                            </TextContent>
                        </div>
                    </Grid>
                </SpaceBetween>
                <div></div>
            </Grid>
        </>
    );
};

export { AdminActivation };
