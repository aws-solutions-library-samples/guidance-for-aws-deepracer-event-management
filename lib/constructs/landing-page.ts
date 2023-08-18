import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
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

import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface LandingPageManagerProps {
    adminGroupRole: IRole;
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
export class LandingPageManager extends Construct {
    public readonly api: {
        landingPageConfigObjectType: ObjectType;
        landingPageConfigInputType: InputType;
    };
    constructor(scope: Construct, id: string, props: LandingPageManagerProps) {
        super(scope, id);

        // STORAGE
        const landingPageConfigsTable = new dynamodb.Table(this, 'landingPageConfigsTable', {
            partitionKey: {
                name: 'eventId',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            removalPolicy: RemovalPolicy.DESTROY,
            stream: dynamodb.StreamViewType.NEW_IMAGE,
        });

        const landingPageConfigDataSourceDdb = props.appsyncApi.api.addDynamoDbDataSource(
            'landingPageConfigDataSourceDdb',
            landingPageConfigsTable
        );
        landingPageConfigsTable.grantReadData(landingPageConfigDataSourceDdb);

        // Update landingPageConfigsTable when events are added or modified
        const copyLandingPageConfigLambda = new lambdaPython.PythonFunction(
            this,
            'copyLandingPageConfig',
            {
                entry: 'lib/lambdas/copy_landing_page_config_from_event/',
                description:
                    'Copy landing page configs from events table to landing pages config table.',
                index: 'index.py',
                handler: 'lambda_handler',
                timeout: Duration.minutes(1),
                runtime: props.lambdaConfig.runtime,
                tracing: lambda.Tracing.ACTIVE,
                memorySize: 128,
                bundling: { image: props.lambdaConfig.bundlingImage },
                layers: [
                    props.lambdaConfig.layersConfig.powerToolsLayer,
                    props.lambdaConfig.layersConfig.helperFunctionsLayer,
                ],

                environment: {
                    DDB_TABLE: landingPageConfigsTable.tableName,
                    POWERTOOLS_SERVICE_NAME: 'copy_landing_page_config',
                    LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
                },
            }
        );

        landingPageConfigsTable.grantReadWriteData(copyLandingPageConfigLambda);

        new Rule(this, 'copyLandingPageConfigLambdaRule', {
            description: 'Listen for events added, deleted, updated',
            eventPattern: {
                detailType: ['eventAdded', 'eventUpdated', 'eventDeleted'],
            },
            eventBus: props.eventbus,
        }).addTarget(new LambdaFunction(copyLandingPageConfigLambda));

        // Define API Schema
        const landingPageLinkObjectType = new ObjectType('landingPageLinkObjectType', {
            definition: {
                linkName: GraphqlType.string(),
                linkDescription: GraphqlType.string(),
                linkHref: GraphqlType.string(),
            },
            directives: [
                Directive.apiKey(),
                Directive.iam(),
                Directive.cognito('admin', 'operator', 'commentator'),
            ],
        });

        props.appsyncApi.schema.addType(landingPageLinkObjectType);

        const landingPageConfigObjectType = new ObjectType('landingPageConfigObjectType', {
            definition: {
                links: landingPageLinkObjectType.attribute({ isList: true }),
            },
            directives: [
                Directive.apiKey(),
                Directive.iam(),
                Directive.cognito('admin', 'operator', 'commentator'),
            ],
        });

        props.appsyncApi.schema.addType(landingPageConfigObjectType);

        const landingPageLinkInputType = new InputType('landingPageLinkInputType', {
            definition: {
                linkName: GraphqlType.string(),
                linkDescription: GraphqlType.string(),
                linkHref: GraphqlType.string(),
            },
        });

        props.appsyncApi.schema.addType(landingPageLinkInputType);

        const landingPageConfigInputType = new InputType('landingPageConfigInputType', {
            definition: {
                links: landingPageLinkInputType.attribute({ isList: true }),
            },
        });

        props.appsyncApi.schema.addType(landingPageConfigInputType);

        this.api = {
            landingPageConfigObjectType: landingPageConfigObjectType,
            landingPageConfigInputType: landingPageConfigInputType,
        };

        // AppSync Query
        props.appsyncApi.schema.addQuery(
            'getLandingPageConfig',
            new ResolvableField({
                returnType: landingPageConfigObjectType.attribute({ isList: false }),
                dataSource: landingPageConfigDataSourceDdb,
                args: {
                    eventId: GraphqlType.string({ isRequired: true }),
                },
                requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem(
                    'eventId',
                    'eventId'
                ),
                responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
                directives: [
                    Directive.apiKey(),
                    Directive.iam(),
                    Directive.cognito('admin', 'operator', 'commentator'),
                ],
            })
        );
    }
}
