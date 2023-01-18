import * as cdk from 'aws-cdk-lib';
import { DockerImage, Environment, Stage } from 'aws-cdk-lib';
import { IDistribution } from 'aws-cdk-lib/aws-cloudfront';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codePipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import { CfnIdentityPool, IUserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { BaseStack } from './base-stack';
import { DeepracerEventManagerStack } from './drem-app-stack';


// Constants
const NODE_VERSION = "16.17.0"  // other possible options: stable, latest, lts
const CDK_VERSION = "2.54.0"  // other possible options: latest

export interface BaseStackPipelineStageProps extends cdk.StackProps {
    branchName: string,
    email: string,
    env: Environment
}

class BaseStackPipelineStage extends Stage {
    constructor(scope: Construct, id: string, props: BaseStackPipelineStageProps) {
        super(scope, id, props);

        const stack = new BaseStack(this, "DremBase", {email: props.email}
        )
    }
}

export interface InfrastructurePipelineStageProps extends cdk.StackProps {
    branchName: string,
    email: string,
    env: Environment
    adminGroupRole: IRole
    operatorGroupRole: IRole
    authenticatedUserRole: IRole
    userPool: IUserPool
    identiyPool: CfnIdentityPool
    userPoolClientWeb: UserPoolClient
    cloudfrontDistribution: IDistribution
    logsBucket: IBucket
    lambdaConfig: { // TODO Break out to it´s own class/struct etc
        runtime: lambda.Runtime,
        architecture: lambda.Architecture,
        bundlingImage: DockerImage
        layersConfig: {
            powerToolsLogLevel: string
            helperFunctionsLayer: lambda.ILayerVersion
            powerToolsLayer: lambda.ILayerVersion
        }
    }
    dremWebsiteBucket: IBucket
}

class InfrastructurePipelineStage extends Stage {
    public readonly sourceBucketName: cdk.CfnOutput
    public readonly distributionId: cdk.CfnOutput

    constructor(scope: Construct, id: string, props: InfrastructurePipelineStageProps) {
        super(scope, id, props);

        const stack = new DeepracerEventManagerStack(this, "infrastructure", {
            cloudfrontDistribution: props.cloudfrontDistribution,
            logsBucket: props.logsBucket,
            lambdaConfig: props.lambdaConfig,
            adminGroupRole: props.adminGroupRole,
            operatorGroupRole: props.operatorGroupRole,
            authenticatedUserRole: props.authenticatedUserRole,
            userPool: props.userPool,
            identiyPool: props.identiyPool,
            userPoolClientWeb: props.userPoolClientWeb,
            dremWebsiteBucket: props.dremWebsiteBucket
        }
        )

        this.sourceBucketName = stack.sourceBucketName
        this.distributionId = stack.distributionId
    }
}
export interface DremPipelineStackProps extends cdk.StackProps {
    branchName: string,
    email: string,
    env: Environment
}

export class DremPipelineStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: DremPipelineStackProps) {
        super(scope, id, props);

        // setup for pseudo parameters
        const stack = cdk.Stack.of(this)

        const s3_repo_bucket_parameter_store = (
            ssm.StringParameter.fromStringParameterAttributes(this, "S3RepoBucketValue", { parameterName: "/drem/S3RepoBucket" })
        )

        const s3_repo_bucket = s3.Bucket.fromBucketArn(this, "S3RepoBucket", s3_repo_bucket_parameter_store.stringValue)

        const pipeline = new pipelines.CodePipeline(this, "Pipeline", {
            dockerEnabledForSynth: true,
            synth: new pipelines.CodeBuildStep("SynthAndDeployBackend", {
                buildEnvironment: {
                    buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_2_0,  // noqa: E501
                },
                input: pipelines.CodePipelineSource.s3(s3_repo_bucket, props.branchName + "/drem.zip", {
                    trigger: codePipelineActions.S3Trigger.POLL,
                }
                ),
                commands: [
                    "python -m venv venv",
                    ". venv/bin/activate",
                    "pip install --upgrade pip",
                    "pip install -r requirements-dev.txt",
                    // Node update
                    `${NODE_VERSION}`,
                    "node --version",
                    // Python unit tests
                    "python -m pytest",
                    `npx cdk@${CDK_VERSION} synth`,
                ],
                partialBuildSpec: codebuild.BuildSpec.fromObject(
                    {
                        "reports": {
                            "pytest_reports": {
                                "files": ["unittest-report.xml"],
                                "base-directory": "reports",
                                "file-format": "JUNITXML",
                            }
                        }
                    }
                ),
                rolePolicyStatements: [
                    new iam.PolicyStatement({
                        actions: ["sts:AssumeRole"],
                        resources: ["*"],
                        conditions: {
                            "StringEquals": {
                                "iam:ResourceTag/aws-cdk:bootstrap-role": "lookup"
                            }
                        },
                    })
                ],
            }),
        })

        // Dev Stage
        const env = { "account": stack.account, "region": stack.region }

        const base = new BaseStackPipelineStage(this, 'drem-base-' + props.branchName, {
            branchName: props.branchName,
            email: props.email,
            env: env
        })

        const infrastructure = new InfrastructurePipelineStage(this, "drem-backend-" + props.branchName, { ...props })

        const infrastructure_stage = pipeline.addStage(infrastructure)

        // Add Generate Amplify Config and Deploy to S3
        infrastructure_stage.addPost(
            new pipelines.CodeBuildStep("DeployAmplifyToS3", {
                installCommands: [
                    "npm install -g @aws-amplify/cli",
                ],
                buildEnvironment: {
                    privileged: true, computeType: codebuild.ComputeType.LARGE
                },
                commands: [
                    "echo $sourceBucketName",
                    "aws cloudformation describe-stacks --stack-name" +
                    `drem-backend-${props.branchName}-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs`,
                    "pwd",
                    "ls -lah",
                    "python generate_amplify_config_cfn.py",
                    "python update_index_html_with_script_tag_cfn.py",
                    // "npm install -g @aws-amplify/cli",
                    (
                        "appsyncId=`cat appsyncId.txt` && aws appsync" +
                        " get-introspection-schema --api-id $appsyncId --format SDL" +
                        " ./website/src/graphql/schema.graphql"
                    ),
                    "cd ./website/src/graphql",
                    "amplify codegen",  // this is on purpose
                    "amplify codegen",  // I'm not repeating mythis ;)
                    "ls -lah",
                    "cd ../..",
                    (
                        "docker run --rm -v $(pwd):/foo -w /foo" +
                        " public.ecr.aws/sam/build-nodejs16.x bash -c 'npm install" +
                        " --cache /tmp/empty-cache && npm run build'"
                    ),
                    "aws s3 sync ./build/ s3://$sourceBucketName/ --delete",
                    (
                        "aws cloudfront create-invalidation --distribution-id $distributionId --paths '/*'"
                    ),
                ],
                envFromCfnOutputs: {
                    "sourceBucketName": infrastructure.sourceBucketName,
                    "distributionId": infrastructure.distributionId,
                },
                rolePolicyStatements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ["s3:PutObject", "s3:ListBucket", "s3:DeleteObject"],
                        resources: ["*"],
                    }),
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ["cloudfront:CreateInvalidation"],
                        resources: ["*"],
                    }),
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ["cloudformation:DescribeStacks"],
                        resources: ["*"],
                    }),
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ["appsync:GetIntrospectionSchema"],
                        resources: ["*"],
                    }),
                ],
            })
        )
    }
}