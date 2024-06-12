import { DockerImage, Duration } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { EventBus } from 'aws-cdk-lib/aws-events';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import {
  CodeFirstSchema,
  Directive,
  EnumType,
  GraphqlType,
  InputType,
  ObjectType,
  ResolvableField,
} from 'awscdk-appsync-utils';
import { NagSuppressions } from 'cdk-nag';
import { StandardLambdaPythonFunction } from './standard-lambda-python-function';

import { Construct } from 'constructs';

export interface RaceManagerProps {
  appsyncApi: {
    schema: CodeFirstSchema;
    api: appsync.GraphqlApi;
    noneDataSource: appsync.NoneDataSource;
  };
  lambdaConfig: {
    runtime: lambda.Runtime;
    architecture: lambda.Architecture;
    bundlingImage: DockerImage;
    layersConfig: {
      powerToolsLogLevel: string;
      helperFunctionsLayer: lambda.ILayerVersion;
      powerToolsLayer: lambda.ILayerVersion;
    };
  };
  eventbus: EventBus;
}

export class RaceManager extends Construct {
  public readonly distribution: Distribution;
  public readonly websiteBucket: Bucket;

  constructor(scope: Construct, id: string, props: RaceManagerProps) {
    super(scope, id);

    const noneDataSource = props.appsyncApi.noneDataSource;

    // STORAGE
    const raceTable = new dynamodb.Table(this, 'Table', {
      partitionKey: {
        name: 'eventId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
    });

    // BACKEND
    const raceLambda = new StandardLambdaPythonFunction(this, 'raceLambda', {
      entry: 'lib/lambdas/race_api/',
      description: 'Race handler',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      memorySize: 128,
      architecture: props.lambdaConfig.architecture,
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [props.lambdaConfig.layersConfig.helperFunctionsLayer, props.lambdaConfig.layersConfig.powerToolsLayer],
      environment: {
        DDB_TABLE: raceTable.tableName,
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
        EVENT_BUS_NAME: props.eventbus.eventBusName,
        POWERTOOLS_SERVICE_NAME: 'race_handler',
      },
    });
    raceTable.grantReadWriteData(raceLambda);
    props.eventbus.grantPutEventsTo(raceLambda);
    props.appsyncApi.api.grantMutation(raceLambda, 'addLeaderboardEntry');

    const raceDataSource = props.appsyncApi.api.addLambdaDataSource('RaceDataSource', raceLambda);

    NagSuppressions.addResourceSuppressions(
      raceDataSource,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Suppress wildcard that covers Lambda aliases in resource path',
          appliesTo: [
            {
              regex: '/^Resource::(.+):\\*$/g',
            },
          ],
        },
      ],
      true
    );

    // API Schema
    const lapObjectType = new ObjectType('Lap', {
      definition: {
        lapId: GraphqlType.id(),
        // raceId: GraphqlType.id(),
        // modelId: GraphqlType.id(),
        // carId: GraphqlType.id(),
        time: GraphqlType.float(),
        resets: GraphqlType.int(),
        // crashes: GraphqlType.int(),
        isValid: GraphqlType.boolean(),
        autTimerConnected: GraphqlType.boolean(),
        carName: GraphqlType.string(),
      },
      directives: [Directive.cognito('admin', 'operator', 'commentator')],
    });

    const lapInputObjectType = new InputType('LapInput', {
      definition: {
        lapId: GraphqlType.id(),
        // raceId: GraphqlType.id(),
        // trackId: GraphqlType.int(),
        // modelId: GraphqlType.id(),
        // carId: GraphqlType.id(),
        time: GraphqlType.float(),
        resets: GraphqlType.int(),
        // crashes: GraphqlType.int(),
        isValid: GraphqlType.boolean(),
        autTimerConnected: GraphqlType.boolean(),
        carName: GraphqlType.string(),
      },
      directives: [Directive.cognito('admin', 'operator')],
    });

    props.appsyncApi.schema.addType(lapObjectType);
    props.appsyncApi.schema.addType(lapInputObjectType);

    const averageLapObjectType = new ObjectType('AverageLap', {
      definition: {
        startLapId: GraphqlType.int(),
        endLapId: GraphqlType.int(),
        avgTime: GraphqlType.float(),
      },
      directives: [Directive.cognito('admin', 'operator', 'commentator')],
    });

    const averageLapInputObjectType = new InputType('AverageLapInput', {
      definition: {
        startLapId: GraphqlType.int(),
        endLapId: GraphqlType.int(),
        avgTime: GraphqlType.float(),
      },
      directives: [Directive.cognito('admin', 'operator', 'commentator')],
    });

    props.appsyncApi.schema.addType(averageLapObjectType);
    props.appsyncApi.schema.addType(averageLapInputObjectType);

    const raceObjectType = new ObjectType('Race', {
      definition: {
        eventId: GraphqlType.id({ isRequired: true }),
        trackId: GraphqlType.id({ isRequired: true }),
        userId: GraphqlType.id({ isRequired: true }),
        racedByProxy: GraphqlType.boolean({ isRequired: true }),
        raceId: GraphqlType.id({ isRequired: true }),
        createdAt: GraphqlType.awsDateTime(),
        laps: lapObjectType.attribute({ isList: true }),
        averageLaps: averageLapObjectType.attribute({ isList: true }),
      },
      directives: [Directive.cognito('admin', 'operator', 'commentator')],
    });

    props.appsyncApi.schema.addType(raceObjectType);

    const raceDeleteInputType = new InputType('RaceDeleteInput', {
      definition: {
        userId: GraphqlType.id({ isRequired: true }),
        raceId: GraphqlType.id({ isRequired: true }),
        trackId: GraphqlType.id({ isRequired: true }),
      },
      directives: [Directive.cognito('admin', 'operator')],
    });

    props.appsyncApi.schema.addType(raceDeleteInputType);

    const raceDeleteObjectType = new ObjectType('RaceDeleteObject', {
      definition: {
        eventId: GraphqlType.id({ isRequired: true }),
        raceIds: GraphqlType.id({ isList: true }),
      },
      directives: [Directive.cognito('admin', 'operator')],
    });

    props.appsyncApi.schema.addType(raceDeleteObjectType);

    props.appsyncApi.schema.addMutation(
      'addRace',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          trackId: GraphqlType.id({ isRequired: true }),
          userId: GraphqlType.id({ isRequired: true }),
          racedByProxy: GraphqlType.boolean({ isRequired: true }),
          laps: lapInputObjectType.attribute({ isRequiredList: true }),
          averageLaps: averageLapInputObjectType.attribute({ isList: true }),
        },
        returnType: raceObjectType.attribute(),
        dataSource: raceDataSource,
        directives: [Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onAddedRace',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          trackId: GraphqlType.id(),
        },
        returnType: raceObjectType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('addRace'), Directive.cognito('admin', 'operator', 'commentator')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'updateRace',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          raceId: GraphqlType.id({ isRequired: true }),
          trackId: GraphqlType.id({ isRequired: true }),
          userId: GraphqlType.id({ isRequired: true }),
          racedByProxy: GraphqlType.boolean({ isRequired: true }),
          laps: lapInputObjectType.attribute({ isRequiredList: true }),
          averageLaps: averageLapInputObjectType.attribute({ isRequiredList: true }),
        },
        returnType: raceObjectType.attribute(),
        dataSource: raceDataSource,
        directives: [Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onUpdatedRace',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          trackId: GraphqlType.id(),
        },
        returnType: raceObjectType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('updateRace'), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'deleteRaces',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          racesToDelete: raceDeleteInputType.attribute({ isRequiredList: true }),
        },
        returnType: raceDeleteObjectType.attribute(),
        dataSource: raceDataSource,
        directives: [Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onDeletedRaces',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          trackId: GraphqlType.id(),
        },
        returnType: raceDeleteObjectType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('deleteRaces'), Directive.cognito('admin', 'operator')],
      })
    );

    // Event Admin methods
    props.appsyncApi.schema.addQuery(
      'getRaces',
      new ResolvableField({
        args: {
          eventId: GraphqlType.string({ isRequired: true }),
        },
        returnType: raceObjectType.attribute({ isList: true }),
        dataSource: raceDataSource,
        directives: [Directive.cognito('admin', 'operator', 'commentator')],
      })
    );

    // OVERLAY METHODS
    const raceStatusEnum = new EnumType('RaceStatusEnum', {
      definition: [
        'NO_RACER_SELECTED',
        'READY_TO_START',
        'RACE_IN_PROGRESS',
        'RACE_PAUSED',
        'RACE_FINSIHED',
        'RACE_SUBMITTED',
      ],
    });
    props.appsyncApi.schema.addType(raceStatusEnum);

    // broadcast Overlays
    const overlayObjectType = new ObjectType('Overlay', {
      definition: {
        eventId: GraphqlType.id({ isRequired: true }),
        eventName: GraphqlType.string(),
        trackId: GraphqlType.id(),
        username: GraphqlType.string(),
        userId: GraphqlType.string(),
        countryCode: GraphqlType.string(),
        laps: lapObjectType.attribute({ isList: true }),
        averageLaps: averageLapObjectType.attribute({ isList: true }),
        timeLeftInMs: GraphqlType.float(),
        currentLapTimeInMs: GraphqlType.float(),
        raceStatus: raceStatusEnum.attribute({ isRequired: true }),
      },
      directives: [Directive.apiKey(), Directive.iam(), Directive.cognito('admin', 'operator', 'commentator')],
    });

    props.appsyncApi.schema.addType(overlayObjectType);

    props.appsyncApi.schema.addMutation(
      'updateOverlayInfo',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          eventName: GraphqlType.string(),
          trackId: GraphqlType.id(),
          username: GraphqlType.string(),
          countryCode: GraphqlType.string(),
          userId: GraphqlType.string(),
          laps: lapInputObjectType.attribute({ isList: true }),
          averageLaps: averageLapInputObjectType.attribute({ isList: true }),
          timeLeftInMs: GraphqlType.float(),
          currentLapTimeInMs: GraphqlType.float(),
          raceStatus: raceStatusEnum.attribute({ isRequired: true }),
        },
        returnType: overlayObjectType.attribute(),
        dataSource: noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onNewOverlayInfo',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          trackId: GraphqlType.id(),
        },
        returnType: overlayObjectType.attribute(),
        dataSource: noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [
          Directive.subscribe('updateOverlayInfo'),
          Directive.apiKey(),
          Directive.iam(),
          Directive.cognito('admin', 'operator', 'commentator'),
        ],
      })
    );
  }
}
