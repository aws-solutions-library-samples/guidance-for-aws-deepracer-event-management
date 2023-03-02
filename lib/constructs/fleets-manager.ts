import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { EventBus } from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {
    CodeFirstSchema,
    Directive,
    GraphqlType,
    ObjectType,
    ResolvableField,
} from 'awscdk-appsync-utils';

import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';

import { Construct } from 'constructs';

export interface FleetsManagerProps {
    adminGroupRole: IRole;
    userPoolId: string;
    appsyncApi: {
        schema: CodeFirstSchema;
        api: appsync.IGraphqlApi;
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

export class FleetsManager extends Construct {
    constructor(scope: Construct, id: string, props: FleetsManagerProps) {
        super(scope, id);

        const fleets_table = new dynamodb.Table(this, 'FleetsTable', {
            partitionKey: {
                name: 'fleetId',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const fleets_handler = new lambdaPython.PythonFunction(this, 'fleetsFunction', {
            entry: 'lib/lambdas/fleets_function/',
            description: 'Fleets Resolver',
            index: 'index.py',
            handler: 'lambda_handler',
            timeout: Duration.minutes(1),
            runtime: props.lambdaConfig.runtime,
            tracing: lambda.Tracing.ACTIVE,
            memorySize: 128,
            architecture: props.lambdaConfig.architecture,
            bundling: {
                image: props.lambdaConfig.bundlingImage,
            },
            layers: [props.lambdaConfig.layersConfig.powerToolsLayer],
            environment: {
                DDB_TABLE: fleets_table.tableName,
                user_pool_id: props.userPoolId,
                POWERTOOLS_SERVICE_NAME: 'fleets_resolver',
                LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                eventbus_name: props.eventbus.eventBusName,
            },
        });

        fleets_table.grantReadWriteData(fleets_handler);
        props.eventbus.grantPutEventsTo(fleets_handler);

        // Define the data source for the API
        const fleets_data_source = props.appsyncApi.api.addLambdaDataSource(
            'FleetsDataSource',
            fleets_handler
        );

        // Define API Schema

        const fleets_object_Type = new ObjectType('Fleet', {
            definition: {
                fleetName: GraphqlType.string(),
                fleetId: GraphqlType.id(),
                createdAt: GraphqlType.awsDateTime(),
                carIds: GraphqlType.id({ isList: true }),
            },
        });

        props.appsyncApi.schema.addType(fleets_object_Type);

        // Fleet methods
        props.appsyncApi.schema.addQuery(
            'getAllFleets',
            new ResolvableField({
                returnType: fleets_object_Type.attribute({ isList: true }),
                dataSource: fleets_data_source,
            })
        );
        props.appsyncApi.schema.addMutation(
            'addFleet',
            new ResolvableField({
                args: {
                    fleetName: GraphqlType.string({ isRequired: true }),
                    carIds: GraphqlType.string({ isList: true }),
                },
                returnType: fleets_object_Type.attribute(),
                dataSource: fleets_data_source,
            })
        );
        props.appsyncApi.schema.addSubscription(
            'onAddedFleet',
            new ResolvableField({
                returnType: fleets_object_Type.attribute(),
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
                directives: [Directive.subscribe('addFleet')],
            })
        );

        props.appsyncApi.schema.addMutation(
            'deleteFleets',
            new ResolvableField({
                args: { fleetIds: GraphqlType.string({ isRequiredList: true }) },
                returnType: fleets_object_Type.attribute({ isList: true }),
                dataSource: fleets_data_source,
            })
        );
        props.appsyncApi.schema.addSubscription(
            'onDeletedFleets',
            new ResolvableField({
                returnType: fleets_object_Type.attribute({ isList: true }),
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
                directives: [Directive.subscribe('deleteFleets')],
            })
        );

        props.appsyncApi.schema.addMutation(
            'updateFleet',
            new ResolvableField({
                args: {
                    fleetId: GraphqlType.string({ isRequired: true }),
                    fleetName: GraphqlType.string(),
                    carIds: GraphqlType.id({ isList: true }),
                },
                returnType: fleets_object_Type.attribute(),
                dataSource: fleets_data_source,
            })
        );
        props.appsyncApi.schema.addSubscription(
            'onUpdatedFleet',
            new ResolvableField({
                returnType: fleets_object_Type.attribute(),
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
                directives: [Directive.subscribe('updateFleet')],
            })
        );

        // Grant access so API methods can be invoked
        const admin_api_policy = new iam.Policy(this, 'adminApiPolicy', {
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['appsync:GraphQL'],
                    resources: [
                        `${props.appsyncApi.api.arn}/types/Query/fields/getAllFleets`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/addFleet`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/addedFleet`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/deleteFleet`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/deletedFleet`,
                        `${props.appsyncApi.api.arn}/types/Mutation/fields/updateFleet`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/addedFleet`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/deletedFleet`,
                        `${props.appsyncApi.api.arn}/types/Subscription/fields/updatedFleet`,
                    ],
                }),
            ],
        });
        admin_api_policy.attachToRole(props.adminGroupRole);
    }
}
