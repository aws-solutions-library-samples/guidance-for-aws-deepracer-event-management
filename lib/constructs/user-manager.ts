import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { DockerImage, Duration } from 'aws-cdk-lib';
import * as apig from 'aws-cdk-lib/aws-apigateway';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { EventBus } from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {
    CodeFirstSchema,
    Directive,
    GraphqlType,
    InputType,
    ObjectType,
    ResolvableField,
} from 'awscdk-appsync-utils';

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
    eventbus: EventBus;
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

        // AppSync //

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
                actions: ['cognito-idp:ListUsers', 'cognito-idp:AdminCreateUser'],
                resources: [props.userPoolArn],
            })
        );

        // Define the data source for the API
        const users_data_source = props.appsyncApi.api.addLambdaDataSource(
            'users_data_source',
            users_handler
        );

        // Define API Schema
        const user_object_attributes = new ObjectType('UserObjectAttributes', {
            definition: {
                Name: GraphqlType.string({ isRequired: true }),
                Value: GraphqlType.string({ isRequired: true }),
            },
        });

        props.appsyncApi.schema.addType(user_object_attributes);

        const user_object_attributes_input = new InputType('UserObjectAttributesInput', {
            definition: {
                Name: GraphqlType.string({ isRequired: true }),
                Value: GraphqlType.string({ isRequired: true }),
            },
        });

        props.appsyncApi.schema.addType(user_object_attributes_input);

        const user_object_mfa_options = new ObjectType('UsersObjectMfaOptions', {
            definition: {
                Name: GraphqlType.string({ isRequired: true }),
                Value: GraphqlType.string({ isRequired: true }),
            },
        });

        props.appsyncApi.schema.addType(user_object_mfa_options);

        const user_object_mfa_options_input = new InputType('UsersObjectMfaOptionsInput', {
            definition: {
                Name: GraphqlType.string({ isRequired: true }),
                Value: GraphqlType.string({ isRequired: true }),
            },
        });

        props.appsyncApi.schema.addType(user_object_mfa_options_input);

        const user_object = new ObjectType('userObject', {
            definition: {
                Username: GraphqlType.string(),
                Attributes: user_object_attributes.attribute({ isList: true }),
                UserCreateDate: GraphqlType.awsDateTime(),
                UserLastModifiedDate: GraphqlType.awsDateTime(),
                Enabled: GraphqlType.boolean(),
                UserStatus: GraphqlType.string(),
                MFAOptions: user_object_mfa_options.attribute({ isList: true, isRequired: false }),
                sub: GraphqlType.id({ isRequired: false }),
            },
        });

        props.appsyncApi.schema.addType(user_object);

        // Event methods
        props.appsyncApi.schema.addQuery(
            'listUsers',
            new ResolvableField({
                returnType: user_object.attribute({ isList: true }),
                dataSource: users_data_source,
            })
        );

        props.appsyncApi.schema.addMutation(
            'createUser',
            new ResolvableField({
                args: {
                    username: GraphqlType.string({ isRequired: true }),
                    email: GraphqlType.string({ isRequired: true }),
                },
                returnType: user_object.attribute(),
                dataSource: users_data_source,
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    `#if (!$util.isNull($context.result.error))
                        $util.error($context.result.error.message, $ctx.result.error.type)
                    #end
                                        
                    $utils.toJson($context.result)`
                ),
            })
        );

        props.appsyncApi.schema.addMutation(
            'newUser',
            new ResolvableField({
                args: {
                    Username: GraphqlType.string(),
                    Attributes: user_object_attributes_input.attribute({ isList: true }),
                    UserCreateDate: GraphqlType.awsDateTime(),
                    UserLastModifiedDate: GraphqlType.awsDateTime(),
                    Enabled: GraphqlType.boolean(),
                    UserStatus: GraphqlType.string(),
                    MFAOptions: user_object_mfa_options_input.attribute({
                        isList: true,
                        isRequired: false,
                    }),
                    sub: GraphqlType.id({ isRequired: false }),
                },
                returnType: user_object.attribute(),
                dataSource: props.appsyncApi.noneDataSource,
                requestMappingTemplate: appsync.MappingTemplate.fromString(
                    `{
                        "version": "2017-02-28",
                    "payload": $util.toJson($context.arguments)
                    }`
                ),
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    '$util.toJson($context.result)'
                ),
            })
        );

        props.appsyncApi.schema.addSubscription(
            'onNewUser',
            new ResolvableField({
                returnType: user_object.attribute(),
                dataSource: props.appsyncApi.noneDataSource,
                requestMappingTemplate: appsync.MappingTemplate.fromString(
                    `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
                ),
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    '$util.toJson($context.result)'
                ),
                directives: [Directive.subscribe('newUser')],
            })
        );

        // Grant access so API methods can be invoked
        const admin_api_policy = new iam.Policy(this, 'adminApiPolicy', {
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['appsync:GraphQL'],
                    resources: [
                        `${props.appsyncApi.api.arn}/types/Query/fields/listUsers`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/createUser`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/newUser`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/onNewUser`,
                    ],
                }),
            ],
        });
        admin_api_policy.attachToRole(props.adminGroupRole);

        const requestsAws4authLayer = new lambdaPython.PythonLayerVersion(
            this,
            'requestsAws4authLayer',
            {
                entry: 'lib/lambdas/helper_functions_layer/requests_aws4auth/',
                compatibleArchitectures: [props.lambdaConfig.architecture],
                compatibleRuntimes: [props.lambdaConfig.runtime],
                bundling: { image: props.lambdaConfig.bundlingImage },
            }
        );

        // Eventbus Functions //

        // respond to new user event
        // const new_user_event_handler = new lambdaPython.PythonFunction(
        //     this,
        //     'new_user_event_handler',
        //     {
        //         entry: 'lib/lambdas/users_function/',
        //         description: 'Work with Cognito users',
        //         index: 'new_user_event.py',
        //         handler: 'lambda_handler',
        //         timeout: Duration.minutes(1),
        //         runtime: props.lambdaConfig.runtime,
        //         tracing: lambda.Tracing.ACTIVE,
        //         memorySize: 128,
        //         architecture: props.lambdaConfig.architecture,
        //         environment: {
        //             graphqlUrl: props.appsyncApi.api.graphqlUrl,
        //         },
        //         bundling: {
        //             image: props.lambdaConfig.bundlingImage,
        //         },
        //         layers: [
        //             props.lambdaConfig.layersConfig.helperFunctionsLayer,
        //             props.lambdaConfig.layersConfig.powerToolsLayer,
        //             requestsAws4authLayer,
        //         ],
        //     }
        // );

        // props.appsyncApi.api.grantMutation(new_user_event_handler, 'newUser');

        // // EventBridge Rule
        // const rule = new Rule(this, 'new_user_event_handler_rule', {
        //     eventBus: props.eventbus,
        // });
        // rule.addEventPattern({
        //     source: ['idp'],
        //     detailType: ['userCreated'],
        // });
        // rule.addTarget(new targets.LambdaFunction(new_user_event_handler));
    }
}
