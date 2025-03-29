import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';
import { DockerImage, Duration, Expiration } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { IDistribution } from 'aws-cdk-lib/aws-cloudfront';
import { CfnIdentityPool, IUserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { CodeFirstSchema } from 'awscdk-appsync-utils';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { CarLogsManager } from './constructs/car-logs-manager';
import { CarManager } from './constructs/cars-manager';
import { ClamscanServerless } from './constructs/clamscan-serverless';
import { CwRumAppMonitor } from './constructs/cw-rum';
import { EventsManager } from './constructs/events-manager';
import { FleetsManager } from './constructs/fleets-manager';
import { LabelPrinter } from './constructs/label-printer';
import { LandingPageManager } from './constructs/landing-page';
import { Leaderboard } from './constructs/leaderboard';
import { ModelOptimizer } from './constructs/model-optimizer';
import { ModelsManager } from './constructs/models-manager';
import { ModelsManagerDefaultModelsDeployment } from './constructs/models-manager-default-models';
import { RaceManager } from './constructs/race-manager';
import { StreamingOverlay } from './constructs/streaming-overlay';
import { SystemsManager } from './constructs/systems-manager';
import { UserManager } from './constructs/user-manager';

export interface DeepracerEventManagerStackProps extends cdk.StackProps {
  baseStackName: string;
  adminGroupRole: IRole;
  operatorGroupRole: IRole;
  commentatorGroupRole: IRole;
  registrationGroupRole: IRole;
  authenticatedUserRole: IRole;
  userPool: IUserPool;
  identiyPool: CfnIdentityPool;
  userPoolClientWeb: UserPoolClient;
  cloudfrontDistribution: IDistribution;
  tacCloudfrontDistribution?: IDistribution;
  tacSourceBucket?: IBucket;
  logsBucket: IBucket;
  lambdaConfig: {
    runtime: lambda.Runtime;
    architecture: lambda.Architecture;
    bundlingImage: DockerImage;
  };
  dremWebsiteBucket: IBucket;
  eventbus: EventBus;
}

export class DeepracerEventManagerStack extends cdk.Stack {
  public readonly distributionId: cdk.CfnOutput;
  public readonly sourceBucketName: cdk.CfnOutput;
  public readonly leaderboardDistributionId: cdk.CfnOutput;
  public readonly leaderboardSourceBucketName: cdk.CfnOutput;
  public readonly streamingOverlayDistributionId: cdk.CfnOutput;
  public readonly streamingOverlaySourceBucketName: cdk.CfnOutput;
  public readonly tacWebsitedistributionId: cdk.CfnOutput;
  public readonly tacSourceBucketName: cdk.CfnOutput; // this is missing

  constructor(scope: Construct, id: string, props: DeepracerEventManagerStackProps) {
    super(scope, id, props);

    const stack = cdk.Stack.of(this);

    const lambdaConfig = {
      ...props.lambdaConfig,
      layersConfig: this.lambdaLayers(props.baseStackName),
    };

    // Get the WAF Web ACL ARN from SSM, created in the base stack
    const wafWebAclRegionalArn = ssm.StringParameter.valueForStringParameter(
      this,
      `/${props.baseStackName}/regionalWafWebAclArn`
    );

    // Appsync API
    const appsyncResources = this.appsyncApi(this.stackName, props.userPool, wafWebAclRegionalArn);

    const modelsManager = new ModelsManager(this, 'ModelsManager', {
      adminGroupRole: props.adminGroupRole,
      operatorGroupRole: props.operatorGroupRole,
      authenticatedUserRole: props.authenticatedUserRole,
      appsyncApi: appsyncResources,
      lambdaConfig: lambdaConfig,
      logsBucket: props.logsBucket,
      eventbus: props.eventbus,
    });

    const clamscan = new ClamscanServerless(this, 'ClamscanServerless', {
      logsBucket: props.logsBucket,
      uploadBucket: modelsManager.uploadBucket,
      scannedBucked: modelsManager.modelsBucket,
      account: this.account,
      lambdaConfig: lambdaConfig,
      eventbus: props.eventbus,
      appsyncApi: appsyncResources,
    });

    const modelOptimizer = new ModelOptimizer(this, 'ModelOptimizer', {
      logsBucket: props.logsBucket,
      modelsBucket: modelsManager.modelsBucket,
      account: this.account,
      eventbus: props.eventbus,
      appsyncApi: appsyncResources,
      clamScanPost: clamscan.postLambda,
    });

    const defaultModelsDeployment = new ModelsManagerDefaultModelsDeployment(this, 'DefaultModelsDeployment', {
      uploadBucket: modelsManager.uploadBucket,
      modelsBucket: modelsManager.modelsBucket,
    });
    defaultModelsDeployment.node.addDependency(clamscan);
    defaultModelsDeployment.node.addDependency(modelOptimizer);

    const carManager = new CarManager(this, 'CarManager', {
      appsyncApi: appsyncResources,
      lambdaConfig: lambdaConfig,
      eventbus: props.eventbus,
    });

    new CarLogsManager(this, 'CarLogsManager', {
      appsyncApi: appsyncResources,
      logsBucket: props.logsBucket,
      modelsBucket: modelsManager.modelsBucket,
      lambdaConfig: lambdaConfig,
      eventbus: props.eventbus,
    });

    new RaceManager(this, 'RaceManager', {
      appsyncApi: appsyncResources,
      lambdaConfig: lambdaConfig,
      eventbus: props.eventbus,
    });

    const leaderboard = new Leaderboard(this, 'Leaderboard', {
      logsBucket: props.logsBucket,
      appsyncApi: appsyncResources,
      lambdaConfig: lambdaConfig,
      userPoolId: props.userPool.userPoolId,
      userPoolArn: props.userPool.userPoolArn,
      eventbus: props.eventbus,
    });

    const cwRumLeaderboardAppMonitor = new CwRumAppMonitor(this, 'CwRumLeaderboardAppMonitor', {
      domainName: leaderboard.distribution.distributionDomainName,
    });

    const landingPage = new LandingPageManager(this, 'LandingPageManager', {
      adminGroupRole: props.adminGroupRole,
      appsyncApi: appsyncResources,
      lambdaConfig: lambdaConfig,
      eventbus: props.eventbus,
    });

    new EventsManager(this, 'EventsManager', {
      appsyncApi: appsyncResources,
      lambdaConfig: lambdaConfig,
      leaderboardApi: leaderboard.api,
      landingPageApi: landingPage.api,
      eventbus: props.eventbus,
    });

    new FleetsManager(this, 'FleetsManager', {
      appsyncApi: appsyncResources,
      lambdaConfig: lambdaConfig,
      userPoolId: props.userPool.userPoolId,
      eventbus: props.eventbus,
    });

    const streamingOverlay = new StreamingOverlay(this, 'streamingOverlay', {
      logsBucket: props.logsBucket,
    });

    new SystemsManager(this, 'SystemManager');

    new UserManager(this, 'UserManager', {
      authenticatedUserRole: props.authenticatedUserRole,
      lambdaConfig: lambdaConfig,
      userPoolArn: props.userPool.userPoolArn,
      userPoolId: props.userPool.userPoolId,
      appsyncApi: appsyncResources,
      eventbus: props.eventbus,
    });

    new LabelPrinter(this, 'LabelPrinter', {
      lambdaConfig: lambdaConfig,
      logsbucket: props.logsBucket,
      appsyncApi: appsyncResources,
      carStatusDataHandlerLambda: carManager.carStatusDataHandlerLambda,
    });

    const cwRumAppMonitor = new CwRumAppMonitor(this, 'CwRumAppMonitor', {
      domainName: props.cloudfrontDistribution.distributionDomainName,
    });

    // Outputs
    new cdk.CfnOutput(this, 'DremWebsite', {
      value: 'https://' + props.cloudfrontDistribution.distributionDomainName,
    });

    this.distributionId = new cdk.CfnOutput(this, 'distributionId', {
      value: props.cloudfrontDistribution.distributionId,
    });

    this.sourceBucketName = new cdk.CfnOutput(this, 'sourceBucketName', {
      value: props.dremWebsiteBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'LeaderboardWebsite', {
      value: 'https://' + leaderboard.distribution.distributionDomainName,
    });
    this.leaderboardDistributionId = new cdk.CfnOutput(this, 'leaderboardDistributionId', {
      value: leaderboard.distribution.distributionId,
    });
    this.leaderboardSourceBucketName = new cdk.CfnOutput(this, 'leaderboardSourceBucketName', {
      value: leaderboard.websiteBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'streamingOverlayWebsite', {
      value: 'https://' + streamingOverlay.distribution.distributionDomainName,
    });
    this.streamingOverlayDistributionId = new cdk.CfnOutput(this, 'streamingOverlayDistributionId', {
      value: streamingOverlay.distribution.distributionId,
    });
    this.streamingOverlaySourceBucketName = new cdk.CfnOutput(this, 'streamingOverlaySourceBucketName', {
      value: streamingOverlay.websiteBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'uploadBucketName', {
      value: modelsManager.uploadBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'modelsBucketName', {
      value: modelsManager.modelsBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'region', { value: stack.region });

    new cdk.CfnOutput(this, 'rumScript', {
      value: cwRumAppMonitor.script,
    });

    new cdk.CfnOutput(this, 'cwRumAppMonitorId', {
      value: cwRumAppMonitor.id,
    });

    new cdk.CfnOutput(this, 'cwRumAppMonitorRegion', {
      value: cwRumAppMonitor.region,
    });

    new cdk.CfnOutput(this, 'cwRumAppMonitorConfig', {
      value: cwRumAppMonitor.config,
    });

    new cdk.CfnOutput(this, 'cwRumLeaderboardAppMonitorId', {
      value: cwRumLeaderboardAppMonitor.id,
    });

    new cdk.CfnOutput(this, 'cwRumLeaderboardAppMonitorRegion', {
      value: cwRumLeaderboardAppMonitor.region,
    });

    new cdk.CfnOutput(this, 'cwRumLeaderboardAppMonitorConfig', {
      value: cwRumLeaderboardAppMonitor.config,
    });

    new cdk.CfnOutput(this, 'appsyncId', { value: appsyncResources.api.apiId });

    new cdk.CfnOutput(this, 'appsyncEndpoint', {
      value: appsyncResources.api.graphqlUrl,
    });

    new cdk.CfnOutput(this, 'appsyncApiKey', {
      value: appsyncResources.api.apiKey || '',
    });

    new cdk.CfnOutput(this, 'userPoolWebClientId', {
      value: props.userPoolClientWeb.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'identityPoolId', {
      value: props.identiyPool.ref,
    });

    new cdk.CfnOutput(this, 'userPoolId', {
      value: props.userPool.userPoolId,
    });
  }

  lambdaLayers = (baseStackName: string) => {
    // Helper functions layer
    const helperFunctionsLambdaLayerArn = ssm.StringParameter.valueForStringParameter(
      this,
      `/${baseStackName}/helperFunctionsLambdaLayerArn`
    );

    const helperFunctionsLambdaLayer = lambdaPython.PythonLayerVersion.fromLayerVersionArn(
      this,
      'helperFunctionsLambdaLayer',
      helperFunctionsLambdaLayerArn
    );

    // Power tools layer
    const powertoolsLambdaLayerArn = ssm.StringParameter.valueForStringParameter(
      this,
      `/${baseStackName}/powertoolsLambdaLayerArn`
    );

    const powertoolsLambdaLayer = lambdaPython.PythonLayerVersion.fromLayerVersionArn(
      this,
      'lambdaPowertoolsLambdaLayer',
      powertoolsLambdaLayerArn
    );

    // Appsync helpers layer
    const appsyncHelpersLambdaLayerArn = ssm.StringParameter.valueForStringParameter(
      this,
      `/${baseStackName}/appsyncHelpersLambdaLayerArn`
    );
    const appsyncHelpersLambdaLayer = lambdaPython.PythonLayerVersion.fromLayerVersionArn(
      this,
      'appsyncHelpersLambdaLayer',
      appsyncHelpersLambdaLayerArn
    );

    return {
      powerToolsLogLevel: 'INFO',
      powerToolsLayer: powertoolsLambdaLayer,
      helperFunctionsLayer: helperFunctionsLambdaLayer,
      appsyncHelpersLayer: appsyncHelpersLambdaLayer,
    };
  };

  appsyncApi = (stackName: string, userPool: IUserPool, wafWebAclRegionalArn: string) => {
    const schema = new CodeFirstSchema();
    const appsyncApi = new appsync.GraphqlApi(this, 'graphQlApi', {
      name: `api-${stackName}`,
      schema: schema,
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: userPool,
            // defaultAction: appsync.UserPoolDefaultAction.DENY, // NOT possible to use when having addiotnal auth modes
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.API_KEY,
            apiKeyConfig: {
              name: 'unauthApiKey',
              expires: Expiration.after(Duration.days(365)),
            },
          },
          {
            authorizationType: appsync.AuthorizationType.IAM,
          },
        ],
      },
      xrayEnabled: true,
      logConfig: {
        retention: RetentionDays.ONE_WEEK,
      },
    });

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      `${appsyncApi.node.findChild('ApiLogsRole').node.path}/Resource`,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'AppSync Construct uses AWSAppSyncPushToCloudWatchLogs managed policy to push logs to CW Logs',
        },
      ]
    );

    // protect Appsync API with WAF
    new wafv2.CfnWebACLAssociation(this, 'cognitoWafAssociation', {
      webAclArn: wafWebAclRegionalArn,
      resourceArn: appsyncApi.arn,
    });

    const noneDataSoure = appsyncApi.addNoneDataSource('none');

    return {
      noneDataSource: noneDataSoure,
      api: appsyncApi,
      schema: schema,
    };
  };
}
