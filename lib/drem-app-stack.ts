import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';
import { DockerImage, Duration, Expiration } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { IUserPool, UserPool } from 'aws-cdk-lib/aws-cognito';
import { EventBus, IEventBus } from 'aws-cdk-lib/aws-events';
import { Role } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as os from 'os';
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
}

export class DeepracerEventManagerStack extends cdk.Stack {
  public readonly distributionId: cdk.CfnOutput;
  public readonly sourceBucketName: cdk.CfnOutput;
  public readonly leaderboardDistributionId: cdk.CfnOutput;
  public readonly leaderboardSourceBucketName: cdk.CfnOutput;
  public readonly streamingOverlayDistributionId: cdk.CfnOutput;
  public readonly streamingOverlaySourceBucketName: cdk.CfnOutput;
  public readonly dremWebsiteUrl: cdk.CfnOutput;
  public readonly appsyncId: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: DeepracerEventManagerStackProps) {
    super(scope, id, props);

    const stack = cdk.Stack.of(this);
    const ssmBase = `/${props.baseStackName}`;

    // Lambda config — defined locally, these are constants
    const lambda_architecture = lambda.Architecture.ARM_64;
    const lambda_runtime = lambda.Runtime.PYTHON_3_12;
    let lambda_bundling_image = DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.12:latest');
    if (os.arch() === 'arm64') {
      lambda_bundling_image = DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.12:latest-arm64');
    }

    const lambdaConfig = {
      runtime: lambda_runtime,
      architecture: lambda_architecture,
      bundlingImage: lambda_bundling_image,
      layersConfig: this.lambdaLayers(props.baseStackName),
    };

    // SSM reads — resolved by CloudFormation at deploy time, no cross-stack Fn::ImportValue
    const cloudfrontDistributionId = ssm.StringParameter.valueForStringParameter(this, `${ssmBase}/cloudfrontDistributionId`);
    const cloudfrontDistributionDomainName = ssm.StringParameter.valueForStringParameter(this, `${ssmBase}/cloudfrontDistributionDomainName`);
    const cloudfrontDomainName = ssm.StringParameter.valueForStringParameter(this, `${ssmBase}/cloudfrontDomainName`);
    const logsBucketName = ssm.StringParameter.valueForStringParameter(this, `${ssmBase}/logsBucketName`);
    const websiteBucketName = ssm.StringParameter.valueForStringParameter(this, `${ssmBase}/websiteBucketName`);
    const eventBusArn = ssm.StringParameter.valueForStringParameter(this, `${ssmBase}/eventBusArn`);
    const userPoolId = ssm.StringParameter.valueForStringParameter(this, `${ssmBase}/userPoolId`);
    const identityPoolId = ssm.StringParameter.valueForStringParameter(this, `${ssmBase}/identityPoolId`);
    const userPoolClientWebId = ssm.StringParameter.valueForStringParameter(this, `${ssmBase}/userPoolClientWebId`);
    const adminGroupRoleArn = ssm.StringParameter.valueForStringParameter(this, `${ssmBase}/adminGroupRoleArn`);
    const operatorGroupRoleArn = ssm.StringParameter.valueForStringParameter(this, `${ssmBase}/operatorGroupRoleArn`);
    const commentatorGroupRoleArn = ssm.StringParameter.valueForStringParameter(this, `${ssmBase}/commentatorGroupRoleArn`);
    const registrationGroupRoleArn = ssm.StringParameter.valueForStringParameter(this, `${ssmBase}/registrationGroupRoleArn`);
    const authenticatedUserRoleArn = ssm.StringParameter.valueForStringParameter(this, `${ssmBase}/authenticatedUserRoleArn`);

    // Reconstruct CDK objects from SSM values
    const cloudfrontDistribution = Distribution.fromDistributionAttributes(this, 'ImportedDistribution', {
      domainName: cloudfrontDistributionDomainName,
      distributionId: cloudfrontDistributionId,
    });
    const logsBucket = Bucket.fromBucketName(this, 'ImportedLogsBucket', logsBucketName);
    const dremWebsiteBucket = Bucket.fromBucketName(this, 'ImportedWebsiteBucket', websiteBucketName);
    const eventbus: IEventBus = EventBus.fromEventBusArn(this, 'ImportedEventBus', eventBusArn);
    const userPool: IUserPool = UserPool.fromUserPoolId(this, 'ImportedUserPool', userPoolId);
    const adminGroupRole = Role.fromRoleArn(this, 'ImportedAdminGroupRole', adminGroupRoleArn, { mutable: true });
    const operatorGroupRole = Role.fromRoleArn(this, 'ImportedOperatorGroupRole', operatorGroupRoleArn, { mutable: true });
    const commentatorGroupRole = Role.fromRoleArn(this, 'ImportedCommentatorGroupRole', commentatorGroupRoleArn, { mutable: true });
    const registrationGroupRole = Role.fromRoleArn(this, 'ImportedRegistrationGroupRole', registrationGroupRoleArn, { mutable: true });
    const authenticatedUserRole = Role.fromRoleArn(this, 'ImportedAuthenticatedUserRole', authenticatedUserRoleArn, { mutable: true });

    // Get the WAF Web ACL ARN from SSM, created in the base stack
    const wafWebAclRegionalArn = ssm.StringParameter.valueForStringParameter(
      this,
      `${ssmBase}/regionalWafWebAclArn`
    );

    // Appsync API
    const appsyncResources = this.appsyncApi(this.stackName, userPool, wafWebAclRegionalArn);

    const modelsManager = new ModelsManager(this, 'ModelsManager', {
      adminGroupRole: adminGroupRole,
      operatorGroupRole: operatorGroupRole,
      authenticatedUserRole: authenticatedUserRole,
      appsyncApi: appsyncResources,
      lambdaConfig: lambdaConfig,
      logsBucket: logsBucket,
      eventbus: eventbus,
    });

    const clamscan = new ClamscanServerless(this, 'ClamscanServerless', {
      logsBucket: logsBucket,
      uploadBucket: modelsManager.uploadBucket,
      scannedBucked: modelsManager.modelsBucket,
      account: this.account,
      lambdaConfig: lambdaConfig,
      eventbus: eventbus,
      appsyncApi: appsyncResources,
    });

    const modelOptimizer = new ModelOptimizer(this, 'ModelOptimizer', {
      logsBucket: logsBucket,
      modelsBucket: modelsManager.modelsBucket,
      account: this.account,
      eventbus: eventbus,
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
      eventbus: eventbus,
    });

    new CarLogsManager(this, 'CarLogsManager', {
      appsyncApi: appsyncResources,
      logsBucket: logsBucket,
      modelsBucket: modelsManager.modelsBucket,
      lambdaConfig: lambdaConfig,
      eventbus: eventbus,
    });

    new RaceManager(this, 'RaceManager', {
      appsyncApi: appsyncResources,
      lambdaConfig: lambdaConfig,
      eventbus: eventbus,
    });

    const leaderboard = new Leaderboard(this, 'Leaderboard', {
      logsBucket: logsBucket,
      appsyncApi: appsyncResources,
      lambdaConfig: lambdaConfig,
      userPoolId: userPool.userPoolId,
      userPoolArn: userPool.userPoolArn,
      eventbus: eventbus,
    });

    const cwRumLeaderboardAppMonitor = new CwRumAppMonitor(this, 'CwRumLeaderboardAppMonitor', {
      domainName: leaderboard.distribution.distributionDomainName,
    });

    const landingPage = new LandingPageManager(this, 'LandingPageManager', {
      adminGroupRole: adminGroupRole,
      appsyncApi: appsyncResources,
      lambdaConfig: lambdaConfig,
      eventbus: eventbus,
    });

    new EventsManager(this, 'EventsManager', {
      appsyncApi: appsyncResources,
      lambdaConfig: lambdaConfig,
      leaderboardApi: leaderboard.api,
      landingPageApi: landingPage.api,
      eventbus: eventbus,
    });

    new FleetsManager(this, 'FleetsManager', {
      appsyncApi: appsyncResources,
      lambdaConfig: lambdaConfig,
      userPoolId: userPool.userPoolId,
      eventbus: eventbus,
    });

    const streamingOverlay = new StreamingOverlay(this, 'streamingOverlay', {
      logsBucket: logsBucket,
    });

    new SystemsManager(this, 'SystemManager');

    new UserManager(this, 'UserManager', {
      authenticatedUserRole: authenticatedUserRole,
      lambdaConfig: lambdaConfig,
      userPoolArn: userPool.userPoolArn,
      userPoolId: userPool.userPoolId,
      appsyncApi: appsyncResources,
      eventbus: eventbus,
    });

    new LabelPrinter(this, 'LabelPrinter', {
      lambdaConfig: lambdaConfig,
      logsbucket: logsBucket,
      appsyncApi: appsyncResources,
      carStatusDataHandlerLambda: carManager.carStatusDataHandlerLambda,
    });

    const cwRumAppMonitor = new CwRumAppMonitor(this, 'CwRumAppMonitor', {
      domainName: cloudfrontDomainName,
    });

    // Outputs
    new cdk.CfnOutput(this, 'DremWebsite', {
      value: 'https://' + cloudfrontDomainName,
    });
    this.dremWebsiteUrl = new cdk.CfnOutput(this, 'DremWebsiteDistributionDomainName', {
      value: 'https://' + cloudfrontDistributionDomainName,
    });
    this.distributionId = new cdk.CfnOutput(this, 'distributionId', {
      value: cloudfrontDistributionId,
    });

    this.sourceBucketName = new cdk.CfnOutput(this, 'sourceBucketName', {
      value: dremWebsiteBucket.bucketName,
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

    this.appsyncId = new cdk.CfnOutput(this, 'appsyncId', { value: appsyncResources.api.apiId });

    new cdk.CfnOutput(this, 'appsyncEndpoint', {
      value: appsyncResources.api.graphqlUrl,
    });

    new cdk.CfnOutput(this, 'appsyncApiKey', {
      value: appsyncResources.api.apiKey || '',
    });

    new cdk.CfnOutput(this, 'userPoolWebClientId', {
      value: userPoolClientWebId,
    });

    new cdk.CfnOutput(this, 'identityPoolId', {
      value: identityPoolId,
    });

    new cdk.CfnOutput(this, 'userPoolId', {
      value: userPoolId,
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
      definition: {
        schema: schema,
      },
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
