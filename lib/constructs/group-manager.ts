import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { DockerImage, Duration } from 'aws-cdk-lib';
import * as apig from 'aws-cdk-lib/aws-apigateway';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { CodeFirstSchema } from 'awscdk-appsync-utils';

import { Construct } from 'constructs';

export interface GroupManagerProps {
    adminGroupRole: IRole;
    userPoolId: string;
    userPoolArn: string;
    appsyncApi: {
        schema: CodeFirstSchema;
        api: appsync.IGraphqlApi;
    };
    restApi: {
        api: apig.RestApi;
        apiAdminResource: apig.Resource;
        bodyValidator: apig.RequestValidator;
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
}

export class GroupManager extends Construct {
    // public readonly origin: cloudfront.IOrigin;
    // public readonly sourceBucket: s3.IBucket;

    constructor(scope: Construct, id: string, props: GroupManagerProps) {
        super(scope, id);

        // GET groups users Function
        const get_groups_group_function = new lambdaPython.PythonFunction(
            this,
            'get_groups_group_function',
            {
                entry: 'lib/lambdas/get_groups_group_function/',
                description: 'Get the group details from cognito',
                index: 'index.py',
                handler: 'lambda_handler',
                timeout: Duration.minutes(1),
                runtime: props.lambdaConfig.runtime,
                tracing: lambda.Tracing.ACTIVE,
                memorySize: 128,
                architecture: props.lambdaConfig.architecture,
                environment: {
                    user_pool_id: props.userPoolId,
                    POWERTOOLS_SERVICE_NAME: 'get_groups_group',
                    LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                },
                bundling: {
                    image: props.lambdaConfig.bundlingImage,
                },
                layers: [
                    props.lambdaConfig.layersConfig.helperFunctionsLayer,
                    props.lambdaConfig.layersConfig.powerToolsLayer,
                ],
            }
        );
        get_groups_group_function.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cognito-idp:ListUsersInGroup'],
                resources: [props.userPoolArn],
            })
        );

        // Post groups group user Function
        const postGroupsGroupUserFunction = new lambdaPython.PythonFunction(
            this,
            'postGroupsGroupUserFunction',
            {
                entry: 'lib/lambdas/post_groups_group_user_function/',
                description: 'Add a user to a group in cognito',
                index: 'index.py',
                handler: 'lambda_handler',
                timeout: Duration.minutes(1),
                runtime: props.lambdaConfig.runtime,
                tracing: lambda.Tracing.ACTIVE,
                memorySize: 128,
                architecture: props.lambdaConfig.architecture,
                environment: {
                    user_pool_id: props.userPoolId,
                    POWERTOOLS_SERVICE_NAME: 'post_groups_group_user',
                    LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                },
                bundling: {
                    image: props.lambdaConfig.bundlingImage,
                },
                layers: [
                    props.lambdaConfig.layersConfig.helperFunctionsLayer,
                    props.lambdaConfig.layersConfig.powerToolsLayer,
                ],
            }
        );
        postGroupsGroupUserFunction.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cognito-idp:AdminAddUserToGroup'],
                resources: [props.userPoolArn],
            })
        );

        // Delete groups group user Function
        const deleteGroupsGroupUserFunction = new lambdaPython.PythonFunction(
            this,
            'deleteGroupsGroupUserFunction',
            {
                entry: 'lib/lambdas/delete_groups_group_user_function/',
                description: 'Remove a user from a group in cognito',
                index: 'index.py',
                handler: 'lambda_handler',
                timeout: Duration.minutes(1),
                runtime: props.lambdaConfig.runtime,
                tracing: lambda.Tracing.ACTIVE,
                memorySize: 128,
                architecture: props.lambdaConfig.architecture,
                environment: {
                    user_pool_id: props.userPoolId,
                    POWERTOOLS_SERVICE_NAME: 'delete_groups_group_user',
                    LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                },
                bundling: {
                    image: props.lambdaConfig.bundlingImage,
                },
                layers: [
                    props.lambdaConfig.layersConfig.helperFunctionsLayer,
                    props.lambdaConfig.layersConfig.powerToolsLayer,
                ],
            }
        );
        deleteGroupsGroupUserFunction.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cognito-idp:AdminRemoveUserFromGroup'],
                resources: [props.userPoolArn],
            })
        );

        // Get groups Function
        const get_groups_function = new lambdaPython.PythonFunction(this, 'get_groups_function', {
            entry: 'lib/lambdas/get_groups_function/',
            description: 'List the groups in cognito',
            index: 'index.py',
            handler: 'lambda_handler',
            timeout: Duration.minutes(1),
            runtime: props.lambdaConfig.runtime,
            tracing: lambda.Tracing.ACTIVE,
            memorySize: 128,
            architecture: props.lambdaConfig.architecture,
            environment: {
                user_pool_id: props.userPoolId,
                POWERTOOLS_SERVICE_NAME: 'get_groups',
                LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
            },
            bundling: {
                image: props.lambdaConfig.bundlingImage,
            },
            layers: [
                props.lambdaConfig.layersConfig.helperFunctionsLayer,
                props.lambdaConfig.layersConfig.powerToolsLayer,
            ],
        });

        get_groups_function.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cognito-idp:ListGroups'],
                resources: [props.userPoolArn],
            })
        );

        // Put groups group Function
        const put_groups_group_function = new lambdaPython.PythonFunction(
            this,
            'put_groups_group_function',
            {
                entry: 'lib/lambdas/put_groups_group_function/',
                description: 'Add a group to cognito',
                index: 'index.py',
                handler: 'lambda_handler',
                timeout: Duration.minutes(1),
                runtime: props.lambdaConfig.runtime,
                tracing: lambda.Tracing.ACTIVE,
                memorySize: 128,
                architecture: props.lambdaConfig.architecture,
                environment: {
                    user_pool_id: props.userPoolId,
                    POWERTOOLS_SERVICE_NAME: 'put_groups_group',
                    LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                },
                bundling: {
                    image: props.lambdaConfig.bundlingImage,
                },
                layers: [
                    props.lambdaConfig.layersConfig.helperFunctionsLayer,
                    props.lambdaConfig.layersConfig.powerToolsLayer,
                ],
            }
        );

        put_groups_group_function.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cognito-idp:CreateGroup'],
                resources: [props.userPoolArn],
            })
        );

        // Delete groups group Function
        const delete_groups_group_function = new lambdaPython.PythonFunction(
            this,
            'delete_groups_group_function',
            {
                entry: 'lib/lambdas/delete_groups_group_function/',
                description: 'Delete a group from cognito',
                index: 'index.py',
                handler: 'lambda_handler',
                timeout: Duration.minutes(1),
                runtime: props.lambdaConfig.runtime,
                tracing: lambda.Tracing.ACTIVE,
                memorySize: 128,
                architecture: props.lambdaConfig.architecture,
                environment: {
                    user_pool_id: props.userPoolId,
                    POWERTOOLS_SERVICE_NAME: 'delete_groups_group',
                    LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                },
                bundling: {
                    image: props.lambdaConfig.bundlingImage,
                },
                layers: [
                    props.lambdaConfig.layersConfig.helperFunctionsLayer,
                    props.lambdaConfig.layersConfig.powerToolsLayer,
                ],
            }
        );
        delete_groups_group_function.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cognito-idp:DeleteGroup'],
                resources: [props.userPoolArn],
            })
        );

        // API RESOURCES
        const username_groupname_model = props.restApi.api.addModel('UsernameGroupnameModel', {
            contentType: 'application/json',
            schema: {
                schema: apig.JsonSchemaVersion.DRAFT4,
                type: apig.JsonSchemaType.OBJECT,
                properties: {
                    username: { type: apig.JsonSchemaType.STRING },
                    groupname: { type: apig.JsonSchemaType.STRING },
                },
            },
        });

        // GET /admin/groups
        const apiAdminGroups = props.restApi.apiAdminResource.addResource('groups');
        apiAdminGroups.addMethod('GET', new apig.LambdaIntegration(get_groups_function), {
            authorizationType: apig.AuthorizationType.IAM,
        });

        // PUT /admin/groups
        apiAdminGroups.addMethod('PUT', new apig.LambdaIntegration(put_groups_group_function), {
            authorizationType: apig.AuthorizationType.IAM,
        });

        // /admin/groups/{groupname}
        const group = apiAdminGroups.addResource('{groupname}');

        // GET /admin/groups/{groupname}
        group.addMethod('GET', new apig.LambdaIntegration(get_groups_group_function), {
            authorizationType: apig.AuthorizationType.IAM,
        });

        // DELETE /admin/groups/{groupname}
        group.addMethod('DELETE', new apig.LambdaIntegration(delete_groups_group_function), {
            authorizationType: apig.AuthorizationType.IAM,
        });

        // POST /admin/groups/{groupname}
        group.addMethod('POST', new apig.LambdaIntegration(postGroupsGroupUserFunction), {
            authorizationType: apig.AuthorizationType.IAM,
            requestModels: { 'application/json': username_groupname_model },
            requestValidator: props.restApi.bodyValidator,
        });

        // /admin/groups/{groupname}/{username}
        const group_user = group.addResource('{username}');

        // DELETE /admin/groups/{groupname}/{username}
        group_user.addMethod('DELETE', new apig.LambdaIntegration(deleteGroupsGroupUserFunction), {
            authorizationType: apig.AuthorizationType.IAM,
        });
    }
}
