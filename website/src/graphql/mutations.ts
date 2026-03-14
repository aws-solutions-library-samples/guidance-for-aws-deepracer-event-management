// Placeholder for GraphQL mutations
// These will be properly implemented in later steps

export const createModel = `mutation CreateModel($input: CreateModelInput!) {
  createModel(input: $input) {
    modelId
    modelName
    username
  }
}`;

export const updateModel = `mutation UpdateModel($input: UpdateModelInput!) {
  updateModel(input: $input) {
    modelId
    modelName
    username
  }
}`;

export const deleteModel = `mutation DeleteModel($modelId: ID!) {
  deleteModel(modelId: $modelId) {
    modelId
    modelName
    username
  }
}`;

export const createCarLog = `mutation CreateCarLog($input: CreateCarLogInput!) {
  createCarLog(input: $input) {
    carLogId
    username
  }
}`;

export const updateCarLog = `mutation UpdateCarLog($input: UpdateCarLogInput!) {
  updateCarLog(input: $input) {
    carLogId
    username
  }
}`;

export const deleteCarLog = `mutation DeleteCarLog($carLogId: ID!) {
  deleteCarLog(carLogId: $carLogId) {
    carLogId
    username
  }
}`;

export const createCar = `mutation CreateCar($input: CreateCarInput!) {
  createCar(input: $input) {
    carId
    carName
  }
}`;

export const updateCar = `mutation UpdateCar($input: UpdateCarInput!) {
  updateCar(input: $input) {
    carId
    carName
  }
}`;

export const deleteCar = `mutation DeleteCar($carId: ID!) {
  deleteCar(carId: $carId) {
    carId
    carName
  }
}`;

export const uploadModelToCar = `mutation UploadModelToCar($input: UploadModelToCarInput!) {
  uploadModelToCar(input: $input) {
    id
  }
}`;

export const carDeleteAllModels = `mutation CarDeleteAllModels($input: CarDeleteAllModelsInput!) {
  carDeleteAllModels(input: $input) {
    id
  }
}`;

export const startUploadToCar = `mutation StartUploadToCar($input: StartUploadToCarInput!) {
  startUploadToCar(input: $input) {
    id
  }
}`;

export const deviceActivation = `mutation DeviceActivation($input: DeviceActivationInput!) {
  deviceActivation(input: $input) {
    success
    message
  }
}`;

export const createUser = /* GraphQL */ `
    mutation CreateUser($countryCode: String!, $email: String!, $username: String!) {
        createUser(countryCode: $countryCode, email: $email, username: $username) {
            Attributes {
                Name
                Value
            }
            Enabled
            MFAOptions {
                Name
                Value
            }
            Roles
            UserCreateDate
            UserLastModifiedDate
            UserStatus
            Username
            sub
        }
    }
`;

export const deleteUser = `mutation DeleteUser($userId: ID!) {
  deleteUser(userId: $userId) {
    userId
    username
  }
}`;

export const deleteFleets = `mutation DeleteFleets($input: DeleteFleetsInput!) {
  deleteFleets(input: $input) {
    fleetIds
  }
}`;

export const startFetchFromCar = `mutation StartFetchFromCar(
  $carInstanceId: ID!
  $carName: String!
  $carFleetId: ID
  $carFleetName: String
  $carIpAddress: String
  $eventId: ID!
  $eventName: String!
  $laterThan: String
  $racerName: String
  $raceData: String
) {
  startFetchFromCar(
    carInstanceId: $carInstanceId
    carName: $carName
    carFleetId: $carFleetId
    carFleetName: $carFleetName
    carIpAddress: $carIpAddress
    eventId: $eventId
    eventName: $eventName
    laterThan: $laterThan
    racerName: $racerName
    raceData: $raceData
  ) {
    id
    status
  }
}`;

export const carRestartService = `mutation CarRestartService($resourceIds: [ID!]!) {
  carRestartService(resourceIds: $resourceIds) {
    success
  }
}`;

export const carEmergencyStop = `mutation CarEmergencyStop($resourceIds: [ID!]!) {
  carEmergencyStop(resourceIds: $resourceIds) {
    success
  }
}`;

export const carsDelete = `mutation CarsDelete($resourceIds: [ID!]!) {
  carsDelete(resourceIds: $resourceIds)
}`;

export const carsUpdateFleet = `mutation CarsUpdateFleet($resourceIds: [ID!]!, $fleetName: String!, $fleetId: ID!) {
  carsUpdateFleet(resourceIds: $resourceIds, fleetName: $fleetName, fleetId: $fleetId) {
    success
  }
}`;

export const carSetTaillightColor = `mutation CarSetTaillightColor($resourceIds: [ID!]!, $selectedColor: String!) {
  carSetTaillightColor(resourceIds: $resourceIds, selectedColor: $selectedColor) {
    success
  }
}`;

export const updateOverlayInfo = `mutation UpdateOverlayInfo(
  $eventId: ID!
  $eventName: String
  $trackId: ID
  $username: String
  $countryCode: String
  $userId: String
  $timeLeftInMs: Float
  $currentLapTimeInMs: Float
  $raceStatus: RaceStatusEnum!
) {
  updateOverlayInfo(
    eventId: $eventId
    eventName: $eventName
    trackId: $trackId
    username: $username
    countryCode: $countryCode
    userId: $userId
    timeLeftInMs: $timeLeftInMs
    currentLapTimeInMs: $currentLapTimeInMs
    raceStatus: $raceStatus
  ) {
    eventId
    eventName
    trackId
    username
    countryCode
    userId
    timeLeftInMs
    currentLapTimeInMs
    raceStatus
  }
}`;
