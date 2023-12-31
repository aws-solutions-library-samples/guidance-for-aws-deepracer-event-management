import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3';
import { CodeFirstSchema, Directive, GraphqlType, InputType, ObjectType, ResolvableField } from 'awscdk-appsync-utils';
import { NagSuppressions } from 'cdk-nag';
import { StandardLambdaPythonFunction } from './standard-lambda-python-function';

import { Construct } from 'constructs';
import { Cdn } from './cdn';
import { Website } from './website';

export interface LeaderboardProps {
  userPoolId: string;
  userPoolArn: string;
  logsBucket: IBucket;
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
      appsyncHelpersLayer: lambda.ILayerVersion;
      powerToolsLayer: lambda.ILayerVersion;
    };
  };
  eventbus: EventBus;
}

export class Leaderboard extends Construct {
  public readonly distribution: Distribution;
  public readonly websiteBucket: Bucket;
  public readonly api: {
    leaderboardConfigObjectType: ObjectType;
    leaderboardConfigInputype: InputType;
  };

  constructor(scope: Construct, id: string, props: LeaderboardProps) {
    super(scope, id);

    // STORAGE
    const ddbTable = new dynamodb.Table(this, 'Table', {
      partitionKey: {
        name: 'eventId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // WEBSITE
    const websiteHosting = new Website(this, 'websiteHosting', {
      logsBucket: props.logsBucket,
    });

    const cdn = new Cdn(this, 'cdn', {
      defaultOrigin: websiteHosting.origin,
      logsBucket: props.logsBucket,
    });
    this.distribution = cdn.distribution;
    this.websiteBucket = websiteHosting.sourceBucket;

    // BACKEND
    // Event bridge integration
    const evbLcLambda = new StandardLambdaPythonFunction(this, 'evbLcLambda', {
      entry: 'lib/lambdas/leaderboard_config_evb/',
      description: 'Leaderboard handler',
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
        DDB_TABLE: ddbTable.tableName,
        POWERTOOLS_SERVICE_NAME: 'leaderboard_config_evb',
      },
    });
    ddbTable.grantReadWriteData(evbLcLambda);

    new Rule(this, 'EventEvbRule', {
      description: 'Listen for events added, deleted, updated',
      eventPattern: {
        detailType: ['eventAdded', 'eventUpdated', 'eventDeleted'],
      },
      eventBus: props.eventbus,
    }).addTarget(new LambdaFunction(evbLcLambda));

    const evbLeLambda = new StandardLambdaPythonFunction(this, 'evbLeLambda', {
      entry: 'lib/lambdas/leaderboard_entry_evb/',
      description: 'Leaderboard handler',
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
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
      ],
      environment: {
        DDB_TABLE: ddbTable.tableName,
        USER_POOL_ID: props.userPoolId,
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
        POWERTOOLS_SERVICE_NAME: 'leaderboard_entry_evb',
      },
    });
    ddbTable.grantReadWriteData(evbLeLambda);
    props.appsyncApi.api.grantMutation(evbLeLambda, 'addLeaderboardEntry');
    props.appsyncApi.api.grantMutation(evbLeLambda, 'updateLeaderboardEntry');
    props.appsyncApi.api.grantMutation(evbLeLambda, 'deleteLeaderboardEntry');

    evbLeLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-idp:ListUsers'],
        resources: [props.userPoolArn],
      })
    );

    new Rule(this, 'RaceSummaryEvbRule', {
      description: 'Listen for new race summaries',
      eventPattern: {
        detailType: ['raceSummaryAdded', 'raceSummaryUpdated', 'raceSummaryDeleted'],
      },
      eventBus: props.eventbus,
    }).addTarget(new LambdaFunction(evbLeLambda));

    // API integration
    const apiLambda = new StandardLambdaPythonFunction(this, 'apiLambda', {
      entry: 'lib/lambdas/leaderboard_api/',
      description: 'Leaderboard handler',
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
        DDB_TABLE: ddbTable.tableName,
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
        POWERTOOLS_SERVICE_NAME: 'leaderboard_api',
      },
    });
    ddbTable.grantReadWriteData(apiLambda);

    const leaderboardDataSource = props.appsyncApi.api.addLambdaDataSource('LeaderboardDataSource', apiLambda);

    NagSuppressions.addResourceSuppressions(
      leaderboardDataSource,
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

    const noneDataSource = props.appsyncApi.noneDataSource;

    const leaderboardDataSourceDdb = props.appsyncApi.api.addDynamoDbDataSource('LeaderboardDataSourceDdb', ddbTable);
    ddbTable.grantReadWriteData(leaderboardDataSourceDdb);

    // API Schema
    const averageLapObjectType = new ObjectType('LeaderboardAverageLap', {
      definition: {
        startLapId: GraphqlType.int(),
        endLapId: GraphqlType.int(),
        avgTime: GraphqlType.float(),
      },
      directives: [Directive.apiKey(), Directive.iam(), Directive.cognito('admin', 'operator', 'commentator')],
    });
    props.appsyncApi.schema.addType(averageLapObjectType);

    const averageLapInputType = new InputType('LeaderboardAverageLapInput', {
      definition: {
        startLapId: GraphqlType.int(),
        endLapId: GraphqlType.int(),
        avgTime: GraphqlType.float(),
      },
    });
    props.appsyncApi.schema.addType(averageLapInputType);

    const leaderboardEntryObjectType = new ObjectType('LeaderBoardEntry', {
      definition: {
        eventId: GraphqlType.id(),
        trackId: GraphqlType.id(),
        username: GraphqlType.string(),
        racedByProxy: GraphqlType.boolean(),
        numberOfValidLaps: GraphqlType.int(),
        numberOfInvalidLaps: GraphqlType.int(),
        fastestLapTime: GraphqlType.float(),
        fastestAverageLap: averageLapObjectType.attribute(),
        avgLapTime: GraphqlType.float(),
        lapCompletionRatio: GraphqlType.float(),
        avgLapsPerAttempt: GraphqlType.float(),
        countryCode: GraphqlType.string(),
        mostConcecutiveLaps: GraphqlType.int(),
      },
      directives: [Directive.apiKey(), Directive.iam(), Directive.cognito('admin', 'operator', 'commentator')],
    });

    const leaderboardEntryArgs = {
      eventId: GraphqlType.id({ isRequired: true }),
      trackId: GraphqlType.id({ isRequired: true }),
      username: GraphqlType.string({ isRequired: true }),
      racedByProxy: GraphqlType.boolean({ isRequired: true }),
      numberOfValidLaps: GraphqlType.int(),
      numberOfInvalidLaps: GraphqlType.int(),
      fastestLapTime: GraphqlType.float(),
      fastestAverageLap: averageLapInputType.attribute(),
      avgLapTime: GraphqlType.float(),
      lapCompletionRatio: GraphqlType.float(),
      avgLapsPerAttempt: GraphqlType.float(),
      countryCode: GraphqlType.string(),
      mostConcecutiveLaps: GraphqlType.int(),
    };

    props.appsyncApi.schema.addType(leaderboardEntryObjectType);

    const leaderboardConfigObjectType = new ObjectType('LeaderBoardConfig', {
      definition: {
        // eventId: GraphqlType.string(),
        // trackId: GraphqlType.string(),
        leaderBoardTitle: GraphqlType.string(),
        // rankingMethod: raceRankingMethodEnum.attribute(),
        leaderBoardFooter: GraphqlType.string(),
        sponsor: GraphqlType.string(),
      },
      directives: [Directive.apiKey(), Directive.iam(), Directive.cognito('admin', 'operator', 'commentator')],
    });

    props.appsyncApi.schema.addType(leaderboardConfigObjectType);

    const leaderboardObjectType = new ObjectType('LeaderBoard', {
      definition: {
        config: leaderboardConfigObjectType.attribute({ isRequired: true }),
        entries: leaderboardEntryObjectType.attribute({ isList: true }),
      },
      directives: [Directive.apiKey(), Directive.iam(), Directive.cognito('admin', 'operator', 'commentator')],
    });

    props.appsyncApi.schema.addType(leaderboardObjectType);

    const leaderboardConfigInputType = new InputType('LeaderBoardConfigInputType', {
      definition: {
        leaderBoardTitle: GraphqlType.string({ isRequired: true }),
        // rankingMethod: raceRankingMethodEnum.attribute({ isRequired: true }),
        leaderBoardFooter: GraphqlType.string({ isRequired: true }),
        sponsor: GraphqlType.string(),
      },
    });

    props.appsyncApi.schema.addType(leaderboardConfigInputType);

    this.api = {
      leaderboardConfigObjectType: leaderboardConfigObjectType,
      leaderboardConfigInputype: leaderboardConfigInputType,
    };

    props.appsyncApi.schema.addQuery(
      'updateLeaderboardConfigs',
      new ResolvableField({
        args: {
          eventId: GraphqlType.string({ isRequired: true }),
          leaderboardConfigs: leaderboardConfigInputType.attribute({
            isRequiredList: true,
          }),
        },
        returnType: leaderboardConfigObjectType.attribute({ isList: true }),
        dataSource: leaderboardDataSource,
      })
    );

    props.appsyncApi.schema.addQuery(
      'getLeaderboard',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          trackId: GraphqlType.id(),
        },
        returnType: leaderboardObjectType.attribute(),
        dataSource: leaderboardDataSource,
        directives: [Directive.apiKey(), Directive.iam(), Directive.cognito('admin', 'operator', 'commentator')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'addLeaderboardEntry',
      new ResolvableField({
        args: leaderboardEntryArgs,
        returnType: leaderboardEntryObjectType.attribute(),
        dataSource: noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.iam()],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onNewLeaderboardEntry',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          trackId: GraphqlType.id(),
        },
        returnType: leaderboardEntryObjectType.attribute(),
        dataSource: noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [
          Directive.subscribe('addLeaderboardEntry'),
          Directive.apiKey(),
          Directive.cognito('admin', 'operator', 'commentator'),
        ],
      })
    );

    props.appsyncApi.schema.addMutation(
      'updateLeaderboardEntry',
      new ResolvableField({
        args: leaderboardEntryArgs,
        returnType: leaderboardEntryObjectType.attribute(),
        dataSource: noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.iam()],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onUpdateLeaderboardEntry',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          trackId: GraphqlType.id(),
        },
        returnType: leaderboardEntryObjectType.attribute(),
        dataSource: noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('updateLeaderboardEntry'), Directive.apiKey(), Directive.iam()],
      })
    );

    props.appsyncApi.schema.addMutation(
      'deleteLeaderboardEntry',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          trackId: GraphqlType.id({ isRequired: true }),
          username: GraphqlType.string({ isRequired: true }),
        },
        returnType: leaderboardEntryObjectType.attribute(),
        dataSource: noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.iam()],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onDeleteLeaderboardEntry',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          trackId: GraphqlType.id(),
        },
        returnType: leaderboardEntryObjectType.attribute(),
        dataSource: noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('deleteLeaderboardEntry'), Directive.apiKey(), Directive.iam()],
      })
    );
  }
}
