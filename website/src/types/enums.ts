// Enums for constant values used throughout the application

export enum RaceTypeEnum {
  TIME_TRIAL = 'TIME_TRIAL',
  HEAD_TO_HEAD = 'HEAD_TO_HEAD',
  OBJECT_AVOIDANCE = 'OBJECT_AVOIDANCE',
}

export enum RaceFormatEnum {
  SIMPLE = 'SIMPLE',
  ADVANCED = 'ADVANCED',
}

export enum RaceStatusEnum {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

export enum EventTypeEnum {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export enum UserRoleEnum {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  COMMENTATOR = 'commentator',
  RACER = 'racer',
}

export enum DeviceStatusEnum {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export enum AssetStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum UploadStatusEnum {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
