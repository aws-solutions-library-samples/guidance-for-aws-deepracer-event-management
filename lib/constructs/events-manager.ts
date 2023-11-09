import { DockerImage, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { EventBus } from 'aws-cdk-lib/aws-events';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
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

export interface EventsManagerProps {
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
  leaderboardApi: {
    leaderboardConfigObjectType: ObjectType;
    leaderboardConfigInputype: InputType;
  };
  landingPageApi: {
    landingPageConfigObjectType: ObjectType;
    landingPageConfigInputType: InputType;
  };
  eventbus: EventBus;
}
export class EventsManager extends Construct {
  constructor(scope: Construct, id: string, props: EventsManagerProps) {
    super(scope, id);

    const stack = Stack.of(this);

    const eventsTable = new dynamodb.Table(this, 'EventsTable', {
      partitionKey: {
        name: 'eventId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      pointInTimeRecovery: true,
    });

    const ddbstreamToEventBridgeFunction = new StandardLambdaPythonFunction(this, 'ddbStreamToEvbFunction', {
      entry: 'lib/lambdas/events_ddb_stream_to_evb_function/',
      description: 'Events - DDB stream to EVB',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      memorySize: 128,
      bundling: { image: props.lambdaConfig.bundlingImage },
      layers: [props.lambdaConfig.layersConfig.powerToolsLayer, props.lambdaConfig.layersConfig.helperFunctionsLayer],

      environment: {
        EVENT_BUS_NAME: props.eventbus.eventBusName,
        POWERTOOLS_SERVICE_NAME: 'events_ddb_stream_to_evb',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
      },
    });
    props.eventbus.grantPutEventsTo(ddbstreamToEventBridgeFunction.grantPrincipal);
    ddbstreamToEventBridgeFunction.addEventSource(
      new DynamoEventSource(eventsTable, {
        startingPosition: StartingPosition.LATEST,
        batchSize: 1,
      })
    );

    const eventsFunction = new StandardLambdaPythonFunction(this, 'eventsFunction', {
      entry: 'lib/lambdas/events_api/',
      description: 'Events Resolver',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      memorySize: 128,
      bundling: { image: props.lambdaConfig.bundlingImage },
      layers: [props.lambdaConfig.layersConfig.powerToolsLayer, props.lambdaConfig.layersConfig.helperFunctionsLayer],

      environment: {
        DDB_TABLE: eventsTable.tableName,
        POWERTOOLS_SERVICE_NAME: 'events_resolver',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
      },
    });

    eventsTable.grantReadWriteData(eventsFunction);

    const eventsDataSourceDdb = props.appsyncApi.api.addDynamoDbDataSource('EventsDataSourceDdb', eventsTable);
    eventsTable.grantReadWriteData(eventsDataSourceDdb);

    // Define the data source for the API
    const eventsDataSource = props.appsyncApi.api.addLambdaDataSource('EventsDataSource', eventsFunction);

    NagSuppressions.addResourceSuppressions(
      eventsDataSource,
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

    // Define API Schema
    const trackTypeMethodEnum = new EnumType('TrackType', {
      definition: ['REINVENT_2018', 'REINVENT_2019', 'SUMMIT_SPEEDWAY', 'ATOZ_SPEEDWAY', 'OTHER'],
    });
    props.appsyncApi.schema.addType(trackTypeMethodEnum);

    const raceRankingMethodEnum = new EnumType('RankingMethod', {
      definition: ['BEST_LAP_TIME'],
    });
    props.appsyncApi.schema.addType(raceRankingMethodEnum);

    const raceConfigObjectType = new ObjectType('RaceConfig', {
      definition: {
        raceTimeInMin: GraphqlType.int(),
        numberOfResetsPerLap: GraphqlType.int(),
        trackType: trackTypeMethodEnum.attribute(),
        rankingMethod: raceRankingMethodEnum.attribute(),
        maxRunsPerRacer: GraphqlType.string(),
      },
      directives: [Directive.cognito('admin', 'commentator', 'operator')],
    });
    props.appsyncApi.schema.addType(raceConfigObjectType);

    const raceConfigInputType = new InputType('RaceInputConfig', {
      definition: {
        raceTimeInMin: GraphqlType.int(),
        numberOfResetsPerLap: GraphqlType.int(),
        trackType: trackTypeMethodEnum.attribute(),
        rankingMethod: raceRankingMethodEnum.attribute(),
        maxRunsPerRacer: GraphqlType.string(),
      },
      directives: [Directive.cognito('admin', 'operator')],
    });
    props.appsyncApi.schema.addType(raceConfigInputType);

    const trackObjectType = new ObjectType('Track', {
      definition: {
        trackId: GraphqlType.id(),
        fleetId: GraphqlType.id(),
        leaderBoardTitle: GraphqlType.string(),
        leaderBoardFooter: GraphqlType.string(),
      },
      directives: [Directive.cognito('admin', 'commentator', 'operator')],
    });
    props.appsyncApi.schema.addType(trackObjectType);

    const trackInputType = new InputType('TrackInput', {
      definition: {
        trackId: GraphqlType.id({ isRequired: true }),
        fleetId: GraphqlType.id(),
        leaderBoardTitle: GraphqlType.string({ isRequired: true }),
        leaderBoardFooter: GraphqlType.string({ isRequired: true }),
      },
      directives: [Directive.cognito('admin', 'operator')],
    });
    props.appsyncApi.schema.addType(trackInputType);

    const typeOfEventEnum = new EnumType('TypeOfEvent', {
      definition: ['PRIVATE_WORKSHOP', 'PRIVATE_TRACK_RACE', 'OFFICIAL_WORKSHOP', 'OFFICIAL_TRACK_RACE', 'OTHER'],
    });
    props.appsyncApi.schema.addType(typeOfEventEnum);

    const eventObjectType = new ObjectType('Event', {
      definition: {
        eventId: GraphqlType.id(),
        createdAt: GraphqlType.awsDateTime(),
        createdBy: GraphqlType.id(),
        eventName: GraphqlType.string(),
        typeOfEvent: typeOfEventEnum.attribute(),
        eventDate: GraphqlType.awsDate(),
        sponsor: GraphqlType.string(),
        countryCode: GraphqlType.string(),
        raceConfig: raceConfigObjectType.attribute(),
        tracks: trackObjectType.attribute({ isList: true }),
        landingPageConfig: props.landingPageApi.landingPageConfigObjectType.attribute(),
      },
      directives: [Directive.cognito('admin', 'operator', 'commentator', 'registration')],
    });

    props.appsyncApi.schema.addType(eventObjectType);

    // Event methods
    props.appsyncApi.schema.addQuery(
      'getEvents',
      new ResolvableField({
        returnType: eventObjectType.attribute({ isList: true }),
        dataSource: eventsDataSourceDdb,
        requestMappingTemplate: appsync.MappingTemplate.dynamoDbScanTable(),
        responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
        directives: [Directive.cognito('admin', 'operator', 'commentator', 'registration')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'addEvent',
      new ResolvableField({
        args: {
          eventName: GraphqlType.string({ isRequired: true }),
          typeOfEvent: typeOfEventEnum.attribute({ isRequired: true }),
          tracks: trackInputType.attribute({ isRequiredList: true }),
          eventDate: GraphqlType.awsDate(),
          sponsor: GraphqlType.string(),
          countryCode: GraphqlType.string(),
          raceConfig: raceConfigInputType.attribute({ isRequired: true }),
          landingPageConfig: props.landingPageApi.landingPageConfigInputType.attribute(),
        },
        returnType: eventObjectType.attribute(),
        dataSource: eventsDataSource,
        directives: [Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onAddedEvent',
      new ResolvableField({
        returnType: eventObjectType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('addEvent'), Directive.cognito('admin', 'commentator', 'operator')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'deleteEvents',
      new ResolvableField({
        args: { eventIds: GraphqlType.string({ isRequiredList: true }) },
        returnType: GraphqlType.awsJson({ isList: true }),
        dataSource: eventsDataSource,
        directives: [Directive.cognito('admin', 'operator')],
      })
    );
    props.appsyncApi.schema.addSubscription(
      'onDeletedEvents',
      new ResolvableField({
        returnType: GraphqlType.awsJson({ isList: true }),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('deleteEvents'), Directive.cognito('admin', 'commentator', 'operator')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'updateEvent',
      new ResolvableField({
        args: {
          eventId: GraphqlType.string({ isRequired: true }),
          eventName: GraphqlType.string({ isRequired: true }),
          typeOfEvent: typeOfEventEnum.attribute({ isRequired: true }),
          tracks: trackInputType.attribute({ isRequiredList: true }),
          eventDate: GraphqlType.awsDate(),
          sponsor: GraphqlType.string(),
          countryCode: GraphqlType.string(),
          raceConfig: raceConfigInputType.attribute({ isRequired: true }),
          landingPageConfig: props.landingPageApi.landingPageConfigInputType.attribute(),
        },
        returnType: eventObjectType.attribute(),
        dataSource: eventsDataSource,
        directives: [Directive.cognito('admin', 'operator')],
      })
    );
    props.appsyncApi.schema.addSubscription(
      'onUpdatedEvent',
      new ResolvableField({
        returnType: eventObjectType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('updateEvent'), Directive.cognito('admin', 'commentator', 'operator')],
      })
    );
  }
}
