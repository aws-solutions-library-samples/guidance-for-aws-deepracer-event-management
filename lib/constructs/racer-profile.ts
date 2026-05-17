import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { CodeFirstSchema, Directive, GraphqlType, InputType, ObjectType, ResolvableField } from 'awscdk-appsync-utils';
import { Construct } from 'constructs';

export interface AppsyncApiProps {
  api: appsync.GraphqlApi;
  schema: CodeFirstSchema;
}

export interface RacerProfileProps {
  appsyncApi: AppsyncApiProps;
}

export class RacerProfile extends Construct {
  public readonly table: dynamodb.ITable;
  public readonly profileObjectType: ObjectType;

  constructor(scope: Construct, id: string, props: RacerProfileProps) {
    super(scope, id);

    // ----- DynamoDB table -----
    const table = new dynamodb.Table(this, 'RacerProfileTable', {
      partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.table = table;

    const dataSource = props.appsyncApi.api.addDynamoDbDataSource('RacerProfileDataSource', table);

    // ----- GraphQL types -----
    const profileObjectType = new ObjectType('RacerProfile', {
      definition: {
        username: GraphqlType.string({ isRequired: true }),
        avatarConfig: GraphqlType.awsJson(),
        highlightColour: GraphqlType.string(),
        updatedAt: GraphqlType.awsDateTime(),
      },
      directives: [Directive.apiKey(), Directive.iam(), Directive.cognito('admin', 'operator', 'commentator', 'racer', 'registration')],
    });
    props.appsyncApi.schema.addType(profileObjectType);
    this.profileObjectType = profileObjectType;

    const profileInputType = new InputType('RacerProfileInput', {
      definition: {
        avatarConfig: GraphqlType.awsJson(),
        highlightColour: GraphqlType.string(),
      },
    });
    props.appsyncApi.schema.addType(profileInputType);

    // ----- updateRacerProfile (own) -----
    props.appsyncApi.schema.addMutation(
      'updateRacerProfile',
      new ResolvableField({
        args: { input: profileInputType.attribute({ isRequired: true }) },
        returnType: profileObjectType.attribute(),
        dataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(`
{
  "version": "2018-05-29",
  "operation": "UpdateItem",
  "key": {
    "username": $util.dynamodb.toDynamoDBJson($context.identity.username)
  },
  "update": {
    "expression": "SET avatarConfig = :ac, highlightColour = :hc, updatedAt = :ua",
    "expressionValues": {
      ":ac": $util.dynamodb.toDynamoDBJson($context.arguments.input.avatarConfig),
      ":hc": $util.dynamodb.toDynamoDBJson($context.arguments.input.highlightColour),
      ":ua": $util.dynamodb.toDynamoDBJson($util.time.nowISO8601())
    }
  }
}
`),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.cognito('admin', 'operator', 'commentator', 'racer', 'registration')],
      })
    );

    // ----- updateRacerProfileForUser (admin override) -----
    props.appsyncApi.schema.addMutation(
      'updateRacerProfileForUser',
      new ResolvableField({
        args: {
          username: GraphqlType.string({ isRequired: true }),
          input: profileInputType.attribute({ isRequired: true }),
        },
        returnType: profileObjectType.attribute(),
        dataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(`
{
  "version": "2018-05-29",
  "operation": "UpdateItem",
  "key": {
    "username": $util.dynamodb.toDynamoDBJson($context.arguments.username)
  },
  "update": {
    "expression": "SET avatarConfig = :ac, highlightColour = :hc, updatedAt = :ua",
    "expressionValues": {
      ":ac": $util.dynamodb.toDynamoDBJson($context.arguments.input.avatarConfig),
      ":hc": $util.dynamodb.toDynamoDBJson($context.arguments.input.highlightColour),
      ":ua": $util.dynamodb.toDynamoDBJson($util.time.nowISO8601())
    }
  }
}
`),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.cognito('admin')],
      })
    );

    // ----- getRacerProfile (public) -----
    props.appsyncApi.schema.addQuery(
      'getRacerProfile',
      new ResolvableField({
        args: { username: GraphqlType.string({ isRequired: true }) },
        returnType: profileObjectType.attribute(),
        dataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(`
{
  "version": "2018-05-29",
  "operation": "GetItem",
  "key": {
    "username": $util.dynamodb.toDynamoDBJson($context.arguments.username)
  }
}
`),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.apiKey(), Directive.iam(), Directive.cognito('admin', 'operator', 'commentator', 'racer', 'registration')],
      })
    );
  }
}
