import * as cdk from 'aws-cdk-lib';
import { DockerImage } from 'aws-cdk-lib';
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
import { Leaderboard } from './constructs/leaderboard-construct';
import { ModelsManager } from './constructs/models-manager';
import { RestApi } from './constructs/rest-api';
import { SystemsManager } from './constructs/systems-manager';
import { UserManager } from './constructs/user-manager';
import { Website } from './constructs/website';

export interface DeepracerEventManagerStackProps extends cdk.StackProps {
    adminGroupRole: IRole;
    operatorGroupRole: IRole;
    authenticatedUserRole: IRole;
    userPool: IUserPool;
    identiyPool: CfnIdentityPool;
    userPoolClientWeb: UserPoolClient;
    cloudfrontDistribution: IDistribution;
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
            requestsAws4authLayer: lambda.ILayerVersion;
        };
    };
    dremWebsiteBucket: IBucket;
    eventbus: EventBus;
}

export class DeepracerEventManagerStack extends cdk.Stack {
    public readonly sourceBucketName: cdk.CfnOutput;
    public readonly distributionId: cdk.CfnOutput;

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

        // Terms And Conditions
        const tncWebsite = new Website(this, 'TermsNConditions', {
            contentPath: './lib/constructs/terms_n_conditions/webpage/',
            pathPattern: '/terms_n_conditions.html',
            logsBucket: props.logsBucket,
            // cdnDistribution: props.cloudfrontDistribution // TODO not working to addBehaviour to dist that is another stack, implement as custom resource????
        });

        const carManager = new CarManager(this, 'CarManager', {
            adminGroupRole: props.adminGroupRole,
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
            },
            lambdaConfig: props.lambdaConfig,
        });

        new EventsManager(this, 'EventsManager', {
            adminGroupRole: props.adminGroupRole,
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
                noneDataSource: noneDataSoure,
            },
            userPoolId: props.userPool.userPoolId,
            lambdaConfig: props.lambdaConfig,
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
        });

        new Leaderboard(this, 'Leaderboard', {
            adminGroupRole: props.adminGroupRole,
            appsyncApi: {
                api: appsyncApi,
                schema: schema,
                noneDataSource: noneDataSoure,
            },
            lambdaConfig: props.lambdaConfig,
            userPoolArn: props.userPool.userPoolArn,
            userPoolId: props.userPool.userPoolId,
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
        new cdk.CfnOutput(this, 'CFURL', {
            value: 'https://' + props.cloudfrontDistribution.distributionDomainName,
        });

        this.distributionId = new cdk.CfnOutput(this, 'distributionId', {
            value: props.cloudfrontDistribution.distributionId,
        });

        this.sourceBucketName = new cdk.CfnOutput(this, 'sourceBucketName', {
            value: props.dremWebsiteBucket.bucketName,
        });

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

        // new cdk.CfnOutput(this,"DefaultAdminEmail" , {value: props.defaultAdminEmail})
    }
}
