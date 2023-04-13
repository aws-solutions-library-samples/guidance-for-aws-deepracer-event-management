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
import { CodeFirstSchema } from 'awscdk-appsync-utils';
import { Construct } from 'constructs';
import { CarManager } from './constructs/cars-manager';
import { CwRumAppMonitor } from './constructs/cw-rum';
import { EventsManager } from './constructs/events-manager';
import { FleetsManager } from './constructs/fleets-manager';
import { GroupManager } from './constructs/group-manager';
import { LabelPrinter } from './constructs/label-printer';
import { LandingPageManager } from './constructs/landing-page';
import { Leaderboard } from './constructs/leaderboard';
import { ModelsManager } from './constructs/models-manager';
import { RaceManager } from './constructs/race-manager';
import { StreamingOverlay } from './constructs/streaming-overlay';
import { SystemsManager } from './constructs/systems-manager';
import { UserManager } from './constructs/user-manager';

export interface DeepracerEventManagerStackProps extends cdk.StackProps {
    branchName: string;
    adminGroupRole: IRole;
    operatorGroupRole: IRole;
    commentatorGroupRole: IRole;
    registrationGroupRole: IRole;
    authenticatedUserRole: IRole;
    userPool: IUserPool;
    identiyPool: CfnIdentityPool;
    userPoolClientWeb: UserPoolClient;
    cloudfrontDistribution: IDistribution;
    tacCloudfrontDistribution: IDistribution;
    tacSourceBucket: IBucket;
    logsBucket: IBucket;
    lambdaConfig: {
        // TODO Break out to it´s own class/struct etc
        runtime: lambda.Runtime;
        architecture: lambda.Architecture;
        bundlingImage: DockerImage;
        layersConfig: {
            powerToolsLogLevel: string;
            helperFunctionsLayer: lambda.ILayerVersion;
            powerToolsLayer: lambda.ILayerVersion;
        };
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

        // Appsync API
        const schema = new CodeFirstSchema();
        const appsyncApi = new appsync.GraphqlApi(this, 'graphQlApi', {
            name: `api-${stack.stackName}`,
            schema: schema,
            authorizationConfig: {
                defaultAuthorization: {
                    authorizationType: appsync.AuthorizationType.USER_POOL,
                    userPoolConfig: {
                        userPool: props.userPool,
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

        const noneDataSoure = appsyncApi.addNoneDataSource('none');

        const modelsManager = new ModelsManager(this, 'ModelsManager', {
            adminGroupRole: props.adminGroupRole,
            operatorGroupRole: props.operatorGroupRole,
            authenticatedUserRole: props.authenticatedUserRole,
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
                noneDataSource: noneDataSoure,
            },
            lambdaConfig: props.lambdaConfig,
            logsBucket: props.logsBucket,
        });

        const carManager = new CarManager(this, 'CarManager', {
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
            },
            lambdaConfig: props.lambdaConfig,
            eventbus: props.eventbus,
        });

        new RaceManager(this, 'RaceManager', {
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
                noneDataSource: noneDataSoure,
            },
            lambdaConfig: props.lambdaConfig,
            eventbus: props.eventbus,
        });

        const leaderboard = new Leaderboard(this, 'Leaderboard', {
            logsBucket: props.logsBucket,
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
                noneDataSource: noneDataSoure,
            },
            lambdaConfig: props.lambdaConfig,
            userPoolId: props.userPool.userPoolId,
            userPoolArn: props.userPool.userPoolArn,
            eventbus: props.eventbus,
        });

        const cwRumLeaderboardAppMonitor = new CwRumAppMonitor(this, 'CwRumLeaderboardAppMonitor', {
            domainName: leaderboard.distribution.distributionDomainName,
        });

        const landingPage = new LandingPageManager(this, 'LandingPageManager', {
            adminGroupRole: props.adminGroupRole,
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
                noneDataSource: noneDataSoure,
            },
            lambdaConfig: props.lambdaConfig,
            eventbus: props.eventbus,
        });

        new EventsManager(this, 'EventsManager', {
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
                noneDataSource: noneDataSoure,
            },
            lambdaConfig: props.lambdaConfig,
            leaderboardApi: leaderboard.api,
            landingPageApi: landingPage.api,
            eventbus: props.eventbus,
        });

        new FleetsManager(this, 'FleetsManager', {
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
                noneDataSource: noneDataSoure,
            },
            lambdaConfig: props.lambdaConfig,
            userPoolId: props.userPool.userPoolId,
            eventbus: props.eventbus,
        });

        const streamingOverlay = new StreamingOverlay(this, 'streamingOverlay', {
            logsBucket: props.logsBucket,
        });

        new SystemsManager(this, 'SystemManager');

        const userManager = new UserManager(this, 'UserManager', {
            authenticatedUserRole: props.authenticatedUserRole,
            lambdaConfig: props.lambdaConfig,
            userPoolArn: props.userPool.userPoolArn,
            userPoolId: props.userPool.userPoolId,
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
                noneDataSource: noneDataSoure,
            },
            eventbus: props.eventbus,
        });

        new GroupManager(this, 'GroupManagers', {
            lambdaConfig: props.lambdaConfig,
            userPoolArn: props.userPool.userPoolArn,
            userPoolId: props.userPool.userPoolId,
            userApiObject: userManager.userApiObject,
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
                noneDataSource: noneDataSoure,
            },
        });

        new LabelPrinter(this, 'LabelPrinter', {
            lambdaConfig: props.lambdaConfig,
            logsbucket: props.logsBucket,
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
            },
            carStatusDataHandlerLambda: carManager.carStatusDataHandlerLambda,
        });

        const cwRumAppMonitor = new CwRumAppMonitor(this, 'CwRumAppMonitor', {
            domainName: props.cloudfrontDistribution.distributionDomainName,
        });

        // Outputs
        new cdk.CfnOutput(this, 'DremWebsite', {
            value: 'https://' + props.cloudfrontDistribution.distributionDomainName,
        });

        new cdk.CfnOutput(this, 'tacWebsite', {
            value: 'https://' + props.tacCloudfrontDistribution.distributionDomainName,
        });
        this.tacWebsitedistributionId = new cdk.CfnOutput(this, 'tacWebsitedistributionId', {
            value: props.tacCloudfrontDistribution.distributionId,
        });
        new cdk.CfnOutput(this, 'tacWebsitedistributionName', {
            value: props.tacCloudfrontDistribution.distributionDomainName,
        });
        this.tacSourceBucketName = new cdk.CfnOutput(this, 'tacSourceBucketName', {
            value: props.tacSourceBucket.bucketName,
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
        this.streamingOverlayDistributionId = new cdk.CfnOutput(
            this,
            'streamingOverlayDistributionId',
            {
                value: streamingOverlay.distribution.distributionId,
            }
        );
        this.streamingOverlaySourceBucketName = new cdk.CfnOutput(
            this,
            'streamingOverlaySourceBucketName',
            {
                value: streamingOverlay.websiteBucket.bucketName,
            }
        );
        new cdk.CfnOutput(this, 'modelsBucketName', {
            value: modelsManager.modelsBucket.bucketName,
        });

        new cdk.CfnOutput(this, 'infectedBucketName', {
            value: modelsManager.infectedBucket.bucketName,
        });

        // new cdk.CfnOutput(this, "stackRegion", { value: stack.region })

        new cdk.CfnOutput(this, 'region', { value: stack.region });

        new cdk.CfnOutput(this, 'rumScript', {
            value: cwRumAppMonitor.script,
        });

        new cdk.CfnOutput(this, 'cwRumAppMonitorId', {
            value: cwRumAppMonitor.id,
        });

        new cdk.CfnOutput(this, 'cwRumAppMonitorConfig', {
            value: cwRumAppMonitor.config,
        });

        new cdk.CfnOutput(this, 'cwRumLeaderboardAppMonitorId', {
            value: cwRumLeaderboardAppMonitor.id,
        });

        new cdk.CfnOutput(this, 'cwRumLeaderboardAppMonitorConfig', {
            value: cwRumLeaderboardAppMonitor.config,
        });

        new cdk.CfnOutput(this, 'appsyncId', { value: appsyncApi.apiId });

        new cdk.CfnOutput(this, 'appsyncEndpoint', {
            value: appsyncApi.graphqlUrl,
        });

        new cdk.CfnOutput(this, 'appsyncApiKey', {
            value: appsyncApi.apiKey || '',
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

        // new cdk.CfnOutput(this, "DefaultAdminUserUsername", {value: defaultAdminUserName})
        // new cdk.CfnOutput(this, "DefaultAdminUserUsername", {value: defaultAdminUserName})

        // new cdk.CfnOutput(this,"DefaultAdminEmail" , {value: props.defaultAdminEmail})
        // new cdk.CfnOutput(this,"DefaultAdminEmail" , {value: props.defaultAdminEmail})
    }
}
