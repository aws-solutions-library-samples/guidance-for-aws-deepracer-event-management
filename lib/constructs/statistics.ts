import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { IEventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { DockerImage } from 'aws-cdk-lib';
import {
  CodeFirstSchema,
  Directive,
  GraphqlType,
  ObjectType,
  ResolvableField,
} from 'awscdk-appsync-utils';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { StandardLambdaPythonFunction } from './standard-lambda-python-function';

export interface StatisticsProps {
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
  eventbus: IEventBus;
  userPoolId: string;
  userPoolArn: string;
  raceTable: dynamodb.ITable;
  eventsTable: dynamodb.ITable;
}

export class Statistics extends Construct {
  constructor(scope: Construct, id: string, props: StatisticsProps) {
    super(scope, id);

    // STORAGE
    const statsTable = new dynamodb.Table(this, 'StatsTable', {
      partitionKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    statsTable.addGlobalSecondaryIndex({
      indexName: 'sk-pk-index',
      partitionKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
    });

    // BACKEND — EventBridge Lambda
    const evbLambda = new StandardLambdaPythonFunction(this, 'evbLambda', {
      entry: 'lib/lambdas/stats_evb/',
      description: 'Statistics EVB handler',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(5),
      runtime: props.lambdaConfig.runtime,
      memorySize: 256,
      architecture: props.lambdaConfig.architecture,
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
      ],
      environment: {
        STATS_TABLE: statsTable.tableName,
        RACE_TABLE: props.raceTable.tableName,
        EVENTS_TABLE: props.eventsTable.tableName,
        USER_POOL_ID: props.userPoolId,
        POWERTOOLS_SERVICE_NAME: 'stats_evb',
      },
    });
    statsTable.grantReadWriteData(evbLambda);
    props.raceTable.grantReadData(evbLambda);
    props.eventsTable.grantReadData(evbLambda);

    evbLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-idp:ListUsers'],
        resources: [props.userPoolArn],
      })
    );

    new Rule(this, 'RaceSummaryEvbRule', {
      description: 'Listen for race summaries to update statistics',
      eventPattern: {
        detailType: ['raceSummaryAdded', 'raceSummaryUpdated', 'raceSummaryDeleted'],
      },
      eventBus: props.eventbus,
    }).addTarget(new LambdaFunction(evbLambda));

    // BACKEND — API Lambda
    const apiLambda = new StandardLambdaPythonFunction(this, 'apiLambda', {
      entry: 'lib/lambdas/stats_api/',
      description: 'Statistics API handler',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      memorySize: 128,
      architecture: props.lambdaConfig.architecture,
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
      ],
      environment: {
        STATS_TABLE: statsTable.tableName,
        POWERTOOLS_SERVICE_NAME: 'stats_api',
      },
    });
    statsTable.grantReadData(apiLambda);

    const statsDataSource = props.appsyncApi.api.addLambdaDataSource('StatsDataSource', apiLambda);

    NagSuppressions.addResourceSuppressions(
      statsDataSource,
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

    // API SCHEMA
    const countryStatType = new ObjectType('CountryStat', {
      definition: {
        countryCode: GraphqlType.string({ isRequired: true }),
        events: GraphqlType.int({ isRequired: true }),
        racers: GraphqlType.int({ isRequired: true }),
        laps: GraphqlType.int({ isRequired: true }),
      },
      directives: [Directive.apiKey(), Directive.cognito('admin', 'operator', 'commentator')],
    });
    props.appsyncApi.schema.addType(countryStatType);

    const monthStatType = new ObjectType('MonthStat', {
      definition: {
        month: GraphqlType.string({ isRequired: true }),
        events: GraphqlType.int({ isRequired: true }),
        races: GraphqlType.int({ isRequired: true }),
      },
      directives: [Directive.apiKey(), Directive.cognito('admin', 'operator', 'commentator')],
    });
    props.appsyncApi.schema.addType(monthStatType);

    const eventTypeStatType = new ObjectType('EventTypeStat', {
      definition: {
        typeOfEvent: GraphqlType.string({ isRequired: true }),
        count: GraphqlType.int({ isRequired: true }),
      },
      directives: [Directive.apiKey(), Directive.cognito('admin', 'operator', 'commentator')],
    });
    props.appsyncApi.schema.addType(eventTypeStatType);

    const trackTypeStatType = new ObjectType('TrackTypeStat', {
      definition: {
        trackType: GraphqlType.string({ isRequired: true }),
        count: GraphqlType.int({ isRequired: true }),
        bestLapMs: GraphqlType.float(),
      },
      directives: [Directive.apiKey(), Directive.cognito('admin', 'operator', 'commentator')],
    });
    props.appsyncApi.schema.addType(trackTypeStatType);

    const fastestLapEntryType = new ObjectType('FastestLapEntry', {
      definition: {
        username: GraphqlType.string({ isRequired: true }),
        eventName: GraphqlType.string({ isRequired: true }),
        trackType: GraphqlType.string({ isRequired: true }),
        lapTimeMs: GraphqlType.float({ isRequired: true }),
        eventDate: GraphqlType.string({ isRequired: true }),
      },
      directives: [Directive.apiKey(), Directive.cognito('admin', 'operator', 'commentator')],
    });
    props.appsyncApi.schema.addType(fastestLapEntryType);

    const globalStatsType = new ObjectType('GlobalStats', {
      definition: {
        totalEvents: GraphqlType.int({ isRequired: true }),
        totalRacers: GraphqlType.int({ isRequired: true }),
        totalLaps: GraphqlType.int({ isRequired: true }),
        totalValidLaps: GraphqlType.int({ isRequired: true }),
        totalCountries: GraphqlType.int({ isRequired: true }),
        eventsByCountry: countryStatType.attribute({ isList: true, isRequired: true }),
        eventsByMonth: monthStatType.attribute({ isList: true, isRequired: true }),
        eventTypeBreakdown: eventTypeStatType.attribute({ isList: true, isRequired: true }),
        trackTypeBreakdown: trackTypeStatType.attribute({ isList: true, isRequired: true }),
        fastestLapsEver: fastestLapEntryType.attribute({ isList: true, isRequired: true }),
      },
      directives: [Directive.apiKey(), Directive.cognito('admin', 'operator', 'commentator')],
    });
    props.appsyncApi.schema.addType(globalStatsType);

    props.appsyncApi.schema.addQuery(
      'getGlobalStats',
      new ResolvableField({
        returnType: globalStatsType.attribute(),
        dataSource: statsDataSource,
        directives: [Directive.apiKey(), Directive.cognito('admin', 'operator', 'commentator')],
      })
    );
  }
}
