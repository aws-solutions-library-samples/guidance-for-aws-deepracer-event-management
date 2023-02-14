import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { DockerImage, Duration } from 'aws-cdk-lib';
import * as apig from 'aws-cdk-lib/aws-apigateway';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { CodeFirstSchema, GraphqlType, ObjectType, ResolvableField } from 'awscdk-appsync-utils';

import { Construct } from 'constructs';

export interface UserManagerProps {
    adminGroupRole: IRole;
    userPoolId: string;
    userPoolArn: string;
    restApi: {
        api: apig.RestApi;
        apiAdminResource: apig.Resource;
        bodyValidator: apig.RequestValidator;
    };
    appsyncApi: {
        schema: CodeFirstSchema;
        api: appsync.IGraphqlApi;
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

export class UserManager extends Construct {
    // public readonly origin: cloudfront.IOrigin;
    // public readonly sourceBucket: s3.IBucket;

    constructor(scope: Construct, id: string, props: UserManagerProps) {
        super(scope, id);

        // List users Function
        const get_users_function = new lambdaPython.PythonFunction(this, 'get_users_function', {
            entry: 'lib/lambdas/get_users_function/',
            description: 'List the users in cognito',
            index: 'index.py',
            handler: 'lambda_handler',
            timeout: Duration.minutes(1),
            runtime: props.lambdaConfig.runtime,
            tracing: lambda.Tracing.ACTIVE,
            memorySize: 128,
            architecture: props.lambdaConfig.architecture,
            environment: {
                user_pool_id: props.userPoolId,
                POWERTOOLS_SERVICE_NAME: 'get_users',
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
        get_users_function.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cognito-idp:ListUsers'],
                resources: [props.userPoolArn],
            })
        );

        // API RESOURCES
        const api_users = props.restApi.api.root.addResource('users');
        api_users.addMethod('GET', new apig.LambdaIntegration(get_users_function), {
            authorizationType: apig.AuthorizationType.IAM,
        });

        // List users Function
        const users_handler = new lambdaPython.PythonFunction(this, 'users_handler', {
            entry: 'lib/lambdas/users_function/',
            description: 'Work with Cognito users',
            index: 'index.py',
            handler: 'lambda_handler',
            timeout: Duration.minutes(1),
            runtime: props.lambdaConfig.runtime,
            tracing: lambda.Tracing.ACTIVE,
            memorySize: 128,
            architecture: props.lambdaConfig.architecture,
            environment: {
                user_pool_id: props.userPoolId,
                POWERTOOLS_SERVICE_NAME: 'cognito_users',
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

        users_handler.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cognito-idp:ListUsers'],
                resources: [props.userPoolArn],
            })
        );

        // Define the data source for the API
        const users_data_source = props.appsyncApi.api.addLambdaDataSource(
            'users_data_source',
            users_handler
        );

        // Define API Schema
        const users_object_attributes_type = new ObjectType('users_object_attributes_type', {
            definition: {
                Name: GraphqlType.string({ isRequired: true }),
                Value: GraphqlType.string({ isRequired: true }),
            },
        });

        props.appsyncApi.schema.addType(users_object_attributes_type);

        const users_object_mfa_options_type = new ObjectType('users_object_mfa_options_type', {
            definition: {
                Name: GraphqlType.string({ isRequired: true }),
                Value: GraphqlType.string({ isRequired: true }),
            },
        });

        props.appsyncApi.schema.addType(users_object_mfa_options_type);

        const users_object_type = new ObjectType('users_object_type', {
            definition: {
                Username: GraphqlType.string(),
                Attributes: users_object_attributes_type.attribute(),
                UserCreateDate: GraphqlType.awsDateTime(),
                UserLastModifiedDate: GraphqlType.awsDateTime(),
                Enabled: GraphqlType.boolean(),
                UserStatus: GraphqlType.string(),
                MFAOptions: users_object_mfa_options_type.attribute(),
            },
        });

        props.appsyncApi.schema.addType(users_object_type);

        // Event methods
        props.appsyncApi.schema.addQuery(
            'listUsers',
            new ResolvableField({
                // args: {
                //     hostname: GraphqlType.string({ isRequired: true }),
                //     fleetId: GraphqlType.id({ isRequired: true }),
                //     fleetName: GraphqlType.string({ isRequired: true }),
                // },
                returnType: users_object_type.attribute(),
                dataSource: users_data_source,
            })
        );
    }
}
