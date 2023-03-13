import * as cdk from 'aws-cdk-lib';
import { DockerImage, Duration, Expiration } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { IDistribution } from 'aws-cdk-lib/aws-cloudfront';
import { CfnIdentityPool, IUserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { EventBus } from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
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
import { Leaderboard } from './constructs/leaderboard';
import { ModelsManager } from './constructs/models-manager';
import { RaceManager } from './constructs/race-manager';
import { RestApi } from './constructs/rest-api';
import { StreamingOverlay } from './constructs/streaming-overlay';
import { SystemsManager } from './constructs/systems-manager';
import { UserManager } from './constructs/user-manager';

export interface DeepracerEventManagerStackProps extends cdk.StackProps {
    branchName: string;
    adminGroupRole: IRole;
    operatorGroupRole: IRole;
    authenticatedUserRole: IRole;
    userPool: IUserPool;
    identiyPool: CfnIdentityPool;
    userPoolClientWeb: UserPoolClient;
    cloudfrontDistribution: IDistribution;
    tacCloudfrontDistribution: IDistribution;
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
                    authorizationType: appsync.AuthorizationType.IAM,
                },
                additionalAuthorizationModes: [
                    {
                        authorizationType: appsync.AuthorizationType.API_KEY,
                        apiKeyConfig: {
                            name: 'unauthApiKey',
                            expires: Expiration.after(Duration.days(365)),
                        },
                    },
                ],
            },
            xrayEnabled: true,
            logConfig: {
                retention: RetentionDays.ONE_WEEK,
            },
        });

        const noneDataSoure = appsyncApi.addNoneDataSource('none');

        // Rest API - API GW
        const restApi = new RestApi(this, 'restApi', {
            cloudFrontDistributionName: props.cloudfrontDistribution.distributionDomainName,
        });

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
            restApi: {
                api: restApi.api,
                apiAdminResource: restApi.apiAdminResource,
                bodyValidator: restApi.bodyValidator,
                instanceidCommandIdModel: restApi.instanceidCommandidModel,
            },
        });

        new CarManager(this, 'CarManager', {
            adminGroupRole: props.adminGroupRole,
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
            },
            lambdaConfig: props.lambdaConfig,
            eventbus: props.eventbus,
        });

        new RaceManager(this, 'RaceManager', {
            adminGroupRole: props.adminGroupRole,
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
                noneDataSource: noneDataSoure,
            },
            lambdaConfig: props.lambdaConfig,
            eventbus: props.eventbus,
        });

        const leaderboard = new Leaderboard(this, 'Leaderboard', {
            branchName: props.branchName,
            adminGroupRole: props.adminGroupRole,
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

        new EventsManager(this, 'EventsManager', {
            branchName: props.branchName,
            adminGroupRole: props.adminGroupRole,
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
                noneDataSource: noneDataSoure,
            },
            lambdaConfig: props.lambdaConfig,
            leaderboardApi: leaderboard.api,
            eventbus: props.eventbus,
        });

        new FleetsManager(this, 'FleetsManager', {
            adminGroupRole: props.adminGroupRole,
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
            branchName: props.branchName,
            logsBucket: props.logsBucket,
        });

        new SystemsManager(this, 'SystemManager');

        new GroupManager(this, 'GroupManagers', {
            adminGroupRole: props.adminGroupRole,
            lambdaConfig: props.lambdaConfig,
            userPoolArn: props.userPool.userPoolArn,
            userPoolId: props.userPool.userPoolId,
            restApi: {
                api: restApi.api,
                apiAdminResource: restApi.apiAdminResource,
                bodyValidator: restApi.bodyValidator,
            },
        });

        new UserManager(this, 'UserManager', {
            adminGroupRole: props.adminGroupRole,
            lambdaConfig: props.lambdaConfig,
            userPoolArn: props.userPool.userPoolArn,
            userPoolId: props.userPool.userPoolId,
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
                noneDataSource: noneDataSoure,
            },
            restApi: {
                api: restApi.api,
                apiAdminResource: restApi.apiAdminResource,
                bodyValidator: restApi.bodyValidator,
            },
            eventbus: props.eventbus,
        });

        new LabelPrinter(this, 'LabelPrinter', {
            adminGroupRole: props.adminGroupRole,
            lambdaConfig: props.lambdaConfig,
            logsbucket: props.logsBucket,
            restApi: {
                api: restApi.api,
                apiAdminResource: restApi.apiAdminResource,
                bodyValidator: restApi.bodyValidator,
                instanceidCommandIdModel: restApi.instanceidCommandidModel,
                apiCarsUploadResource: modelsManager.apiCarsUploadResource,
            },
        });

        const cwRumAppMonitor = new CwRumAppMonitor(this, 'CwRumAppMonitor', {
            domainName: props.cloudfrontDistribution.distributionDomainName,
        });

        // TODO should be boken up and moved to the correspinding module
        const adminPolicy = new iam.Policy(this, 'adminPolicy', {
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['execute-api:Invoke'],
                    resources: [
                        restApi.api.arnForExecuteApi('GET', '/models'),
                        restApi.api.arnForExecuteApi('GET', '/cars/label'),
                        restApi.api.arnForExecuteApi('POST', '/cars/upload'),
                        restApi.api.arnForExecuteApi('POST', '/cars/upload/status'),
                        restApi.api.arnForExecuteApi('GET', '/users'),
                        restApi.api.arnForExecuteApi('GET', '/admin/quarantinedmodels'),
                        restApi.api.arnForExecuteApi('GET', '/admin/groups'),
                        restApi.api.arnForExecuteApi('POST', '/admin/groups'),
                        restApi.api.arnForExecuteApi('DELETE', '/admin/groups'),
                        restApi.api.arnForExecuteApi('GET', '/admin/groups/*'),
                        restApi.api.arnForExecuteApi('POST', '/admin/groups/*'),
                        restApi.api.arnForExecuteApi('DELETE', '/admin/groups/*'),
                    ],
                }),
            ],
        });
        adminPolicy.attachToRole(props.adminGroupRole);

        // Outputs
        new cdk.CfnOutput(this, 'DremWebsite', {
            value: 'https://' + props.cloudfrontDistribution.distributionDomainName,
        });

        new cdk.CfnOutput(this, 'tacWebsite', {
            value: 'https://' + props.tacCloudfrontDistribution.distributionDomainName,
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

        new cdk.CfnOutput(this, 'apiGatewayEndpoint', {
            value: restApi.api.url,
        });

        new cdk.CfnOutput(this, 'rumScript', {
            value: cwRumAppMonitor.script,
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
