import {
    Box,
    Button,
    FormField,
    Grid,
    Modal,
    Select,
    SpaceBetween,
} from '@cloudscape-design/components';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { carsContext } from '../../store/carProvider';
import { fleetContext } from '../../store/fleetProvider';

export const RaceSetupModal = ({
    onOk,
    onDismiss,
    onChange,
    events,
    config,
    visible,
    allRacersFromBackend,
    isLoadingRacers,
}) => {
    const { t } = useTranslation();
    const [cars] = useContext(carsContext);
    const [fleets] = useContext(fleetContext);

    const [eventValidation, setEventValidation] = useState({
        isInvalid: true,
        isLoading: false,
    });
    const [racerValidation, setRacerValidation] = useState({
        isInvalid: true,
        isDisabled: true,
    });
    const [carValidation, setCarValidation] = useState({
        isInvalid: true,
        isDisabled: true,
    });
    const [modelValidation, setModelValidation] = useState({
        isInvalid: true,
        isDisabled: true,
    });

    const [userOptions, SetUserOptions] = useState([]);
    const [modelOptions, setModelOptions] = useState([]);
    const [carOptions, setCarOptions] = useState([]);

    // input validation
    useEffect(() => {
        if (config.eventId) {
            setEventValidation((prevState) => {
                return { ...prevState, isInvalid: false };
            });
            setRacerValidation((prevState) => {
                return { ...prevState, isDisabled: false };
            });
        }
        if (config.userId) {
            setRacerValidation((prevState) => {
                return { ...prevState, isInvalid: false };
            });
            setCarValidation((prevState) => {
                return { ...prevState, isDisabled: false };
            });
            setModelValidation((prevState) => {
                return { ...prevState, isDisabled: false };
            });
        }

        return () => {
            setEventValidation((prevState) => {
                return { ...prevState, isInvalid: true };
            });
            setRacerValidation({ isInvalid: true, isDisabled: true });
            setCarValidation({ isInvalid: true, isDisabled: true });
            setModelValidation({ isInvalid: true, isDisabled: true });
        };
    }, [config.eventId, config.userId, config.currentModelId, config.currentCarId]);

    // Populate racer selection
    useEffect(() => {
        if (allRacersFromBackend) {
            SetUserOptions(
                allRacersFromBackend.map((user) => {
                    return { label: user.username, value: user.id };
                })
            );
        }
    }, [allRacersFromBackend]);

    const GetRacerOptionFromId = (id) => {
        if (!id) return;
        const selectedUser = userOptions.find((userOption) => userOption.value === id);
        if (selectedUser) return selectedUser;
        return undefined;
    };

    //TODO how to fix getting user models ????
    // // get all models for user
    // useEffect(() => {
    //     if (!config.userId) return;

    //     // TODO this is fetching models from the wrong store, should get from S3
    //     // the MD5 DDB table have all models a user has uploaded so may lead to duplications
    //     const getModelForUser = async (racerName) => {
    //         console.log(racerName);
    //         const response = await API.graphql({
    //             query: queries.getModelsForUser,
    //             variables: { racerName: racerName },
    //         });
    //         if (response && response.data && response.data.getModelsForUser) {
    //             const fetchedModels = response.data.getModelsForUser;
    //             setModelOptions(
    //                 fetchedModels.map((model) => {
    //                     const modelName = model.modelKey.split('/').pop();
    //                     return { label: modelName, value: model.modelId };
    //                 })
    //             );
    //         }
    //     };
    //     getModelForUser(config.username);
    // }, [config.userId]);

    // get all cars from fleet for curent event
    // TODO can be improved to be more efficent
    useEffect(() => {
        if (!config.eventId || !fleets) return;
        const selectedEvent = events.find((event) => event.eventId === config.eventId);
        const selectedFleet = fleets.find((fleet) => fleet.fleetId === selectedEvent.fleetId);
        const carsInFleet = cars.filter((car) => car.fleetId === selectedFleet.fleetId);
        setCarOptions(() =>
            carsInFleet.map((car) => {
                console.log(car);
                return { label: `${car.ComputerName} - ${car.IpAddress}`, value: car.InstanceId };
            })
        );
    }, [config.eventId, fleets, cars, events]);

    const GetModelOptionFromId = (id) => {
        if (!id) return;

        const selectedModel = modelOptions.find((modelOption) => modelOption.value === id);
        if (selectedModel) return selectedModel;
        return undefined;
    };

    const GetEventOptionFromId = (id) => {
        if (!id) return;

        const selectedEvent = events.find((event) => event.eventId === id);
        if (selectedEvent) {
            return { label: selectedEvent.eventName, value: selectedEvent.eventId };
        }
        return undefined;
    };

    const GetCarOptionFromId = (id) => {
        if (!id || !carOptions) return;
        const selectedCar = carOptions.find((carOption) => carOption.value === id);
        if (selectedCar) return selectedCar;
        return undefined;
    };

    return (
        <Modal
            onDismiss={() => onDismiss()}
            visible={visible}
            closeAriaLabel="Close modal"
            footer={
                <Box float="right">
                    <SpaceBetween direction="horizontal" size="xs">
                        <Button variant="link" onClick={() => onDismiss()}>
                            {t('button.cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            disabled={eventValidation.isInvalid || racerValidation.isInvalid}
                            onClick={() => {
                                onOk(config.userId);
                            }}
                        >
                            {t('button.ok')}
                        </Button>
                    </SpaceBetween>
                </Box>
            }
            header={t('timekeeper.racer-selector.get-ready')}
        >
            <Grid
                gridDefinition={[
                    { colspan: 12 },
                    { colspan: 12 },
                    { colspan: 12 },
                    { colspan: 12 },
                ]}
            >
                <FormField label={t('timekeeper.racer-selector.select-event')}>
                    <Select
                        selectedOption={GetEventOptionFromId(config.eventId)}
                        onChange={(detail) => {
                            onChange({ eventId: detail.detail.selectedOption.value });
                        }}
                        options={events.map((event) => {
                            return { label: event.eventName, value: event.eventId };
                        })}
                        selectedAriaLabel={t('timekeeper.racer-selector.selected')}
                        filteringType="auto"
                        virtualScroll
                        invalid={eventValidation.isInvalid}
                        loadingText={t('timekeeper.racer-selector.loading-events')}
                        statusType={
                            eventValidation.isLoading ? t('timekeeper.racer-selector.loading') : ''
                        } // TODO fix properly, now use loading for fetching users
                    />
                </FormField>
                <FormField label={t('timekeeper.racer-selector.select-racer')}>
                    <Select
                        selectedOption={GetRacerOptionFromId(config.userId)}
                        onChange={({ detail }) => onChange({ userId: detail.selectedOption.value })}
                        options={userOptions}
                        selectedAriaLabel={t('timekeeper.racer-selector.selected')}
                        filteringType="auto"
                        virtualScroll
                        invalid={racerValidation.isInvalid}
                        disabled={racerValidation.isDisabled}
                        loadingText={t('timekeeper.racer-selector.loading-racers')}
                        statusType={isLoadingRacers ? t('timekeeper.racer-selector.loading') : ''}
                    />
                </FormField>
                <FormField label={t('timekeeper.racer-selector.select-car')}>
                    <Select
                        selectedOption={GetCarOptionFromId(config.currentCarId)}
                        onChange={({ detail }) =>
                            onChange({ currentCarId: detail.selectedOption.value })
                        }
                        options={carOptions}
                        selectedAriaLabel={t('timekeeper.racer-selector.selected')}
                        filteringType="auto"
                        virtualScroll
                        // invalid={carValidation.isInvalid}
                        empty={t('timekeeper.racer-selector.select-car-empty')}
                        disabled={carValidation.isDisabled}
                        loadingText={t('timekeeper.racer-selector.loading-cars')}
                        // statusType={isLoadingCars ? t('timekeeper.racer-selector.loading') : ''} // TODO change to it´s own loading when API is in place
                    />
                </FormField>
                <FormField label={t('timekeeper.racer-selector.select-model')}>
                    <Select
                        selectedOption={GetModelOptionFromId(config.currentModelId)}
                        onChange={({ detail }) =>
                            onChange({ currentModelId: detail.selectedOption.value })
                        }
                        options={modelOptions}
                        selectedAriaLabel={t('timekeeper.racer-selector.selected')}
                        filteringType="auto"
                        virtualScroll
                        // invalid={modelValidation.isInvalid}
                        disabled={modelValidation.isDisabled}
                        loadingText={t('timekeeper.racer-selector.loading-racers')}
                        statusType={isLoadingRacers ? t('timekeeper.racer-selector.loading') : ''} // TODO change to it´s own loading when API is in place
                        empty={t('timekeeper.racer-selector.select-model-empty')}
                    />
                </FormField>
            </Grid>
        </Modal>
    );
};
