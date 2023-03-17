import * as cdk from 'aws-cdk-lib';
import { Environment, Stage } from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codePipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { BaseStack } from './base-stack';
import { DeepracerEventManagerStack } from './drem-app-stack';

// Constants
const NODE_VERSION = '16'; // other possible options: stable, latest, lts
const CDK_VERSION = '2.60.0'; // other possible options: latest

export interface InfrastructurePipelineStageProps extends cdk.StackProps {
    branchName: string;
    email: string;
    env: Environment;
}

class InfrastructurePipelineStage extends Stage {
    public readonly distributionId: cdk.CfnOutput;
    public readonly sourceBucketName: cdk.CfnOutput;
    public readonly leaderboardDistributionId: cdk.CfnOutput;
    public readonly leaderboardSourceBucketName: cdk.CfnOutput;
    public readonly streamingOverlayDistributionId: cdk.CfnOutput;
    public readonly streamingOverlaySourceBucketName: cdk.CfnOutput;

    constructor(scope: Construct, id: string, props: InfrastructurePipelineStageProps) {
        super(scope, id, props);

        const baseStack = new BaseStack(this, 'base', { email: props.email });
        const stack = new DeepracerEventManagerStack(this, 'infrastructure', {
            branchName: props.branchName,
            cloudfrontDistribution: baseStack.cloudfrontDistribution,
            tacCloudfrontDistribution: baseStack.tacCloudfrontDistribution,
            logsBucket: baseStack.logsBucket,
            lambdaConfig: baseStack.lambdaConfig,
            adminGroupRole: baseStack.idp.adminGroupRole,
            operatorGroupRole: baseStack.idp.operatorGroupRole,
            commentatorGroupRole: baseStack.idp.commentatorGroupRole,
            registrationGroupRole: baseStack.idp.registrationGroupRole,
            authenticatedUserRole: baseStack.idp.authenticatedUserRole,
            userPool: baseStack.idp.userPool,
            identiyPool: baseStack.idp.identityPool,
            userPoolClientWeb: baseStack.idp.userPoolClientWeb,
            dremWebsiteBucket: baseStack.dremWebsitebucket,
            eventbus: baseStack.eventbridge.eventbus,
        });

        this.distributionId = stack.distributionId;
        this.sourceBucketName = stack.sourceBucketName;
        this.leaderboardSourceBucketName = stack.leaderboardSourceBucketName;
        this.leaderboardDistributionId = stack.leaderboardDistributionId;
        this.streamingOverlaySourceBucketName = stack.streamingOverlaySourceBucketName;
        this.streamingOverlayDistributionId = stack.streamingOverlayDistributionId;
    }
}
export interface CdkPipelineStackProps extends cdk.StackProps {
    branchName: string;
    email: string;
    env: Environment;
}

export class CdkPipelineStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: CdkPipelineStackProps) {
        super(scope, id, props);

        // setup for pseudo parameters
        const stack = cdk.Stack.of(this);

        const s3_repo_bucket_parameter_store = ssm.StringParameter.fromStringParameterAttributes(
            this,
            'S3RepoBucketValue',
            { parameterName: '/drem/S3RepoBucket' }
        );

        const s3_repo_bucket = s3.Bucket.fromBucketArn(
            this,
            'S3RepoBucket',
            s3_repo_bucket_parameter_store.stringValue
        );

        const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
            dockerEnabledForSynth: true,
            publishAssetsInParallel: false,
            synth: new pipelines.CodeBuildStep('SynthAndDeployBackend', {
                buildEnvironment: {
                    buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_2_0,
                },
                input: pipelines.CodePipelineSource.s3(
                    s3_repo_bucket,
                    props.branchName + '/drem.zip',
                    {
                        trigger: codePipelineActions.S3Trigger.POLL,
                    }
                ),
                commands: [
                    // Node update
                    `n ${NODE_VERSION}`,
                    'node --version',

                    'npm install',
                    `npx cdk@${CDK_VERSION} synth --all`,
                ],
                // partialBuildSpec: codebuild.BuildSpec.fromObject(
                //     {
                //         "reports": {
                //             "pytest_reports": {
                //                 "files": ["unittest-report.xml"],
                //                 "base-directory": "reports",
                //                 "file-format": "JUNITXML",
                //             }
                //         }
                //     }
                // ),
                rolePolicyStatements: [
                    new iam.PolicyStatement({
                        actions: ['sts:AssumeRole'],
                        resources: ['*'],
                        conditions: {
                            StringEquals: {
                                'iam:ResourceTag/aws-cdk:bootstrap-role': 'lookup',
                            },
                        },
                    }),
                ],
            }),
        });

        // Dev Stage
        const env = { account: stack.account, region: stack.region };

        const infrastructure = new InfrastructurePipelineStage(
            this,
            `drem-backend-${props.branchName}`,
            { ...props }
        );

        const infrastructure_stage = pipeline.addStage(infrastructure);

        const rolePolicyStatementsForWebsiteDeployStages = [
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['s3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
                resources: ['*'],
            }),
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cloudfront:CreateInvalidation'],
                resources: ['*'],
            }),
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cloudformation:DescribeStacks'],
                resources: ['*'],
            }),
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['appsync:GetIntrospectionSchema'],
                resources: ['*'],
            }),
        ];

        // Main website Deploy to S3
        infrastructure_stage.addPost(
            new pipelines.CodeBuildStep('MainSiteDeployToS3', {
                installCommands: ['npm install -g @aws-amplify/cli'],
                buildEnvironment: {
                    privileged: true,
                    computeType: codebuild.ComputeType.LARGE,
                },
                commands: [
                    // configure and deploy DREM website
                    "echo 'Starting to deploy the DREM website'",
                    'echo website bucket= $sourceBucketName',
                    'aws cloudformation describe-stacks --stack-name ' +
                        `drem-backend-${props.branchName}-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs`,
                    'python scripts/generate_amplify_config_cfn.py',
                    'python scripts/update_index_html_with_script_tag_cfn.py',
                    'appsyncId=`cat appsyncId.txt` && aws appsync' +
                        ' get-introspection-schema --api-id $appsyncId --format SDL' +
                        ' ./website/src/graphql/schema.graphql',
                    'cd ./website/src/graphql',
                    'amplify codegen', // this is on purpose
                    'amplify codegen', // I'm not repeating myself ;)
                    'cd ../..',
                    'docker run --rm -v $(pwd):/foo -w /foo' +
                        " public.ecr.aws/sam/build-nodejs16.x bash -c 'npm install" +
                        " --cache /tmp/empty-cache && npm run build'",
                    'aws s3 sync ./build/ s3://$sourceBucketName/ --delete',
                    'echo distributionId=$distributionId',
                    "aws cloudfront create-invalidation --distribution-id $distributionId --paths '/*'",
                    'cd ..',
                ],
                envFromCfnOutputs: {
                    sourceBucketName: infrastructure.sourceBucketName,
                    distributionId: infrastructure.distributionId,
                },
                rolePolicyStatements: rolePolicyStatementsForWebsiteDeployStages,
            })
        );

        // Leaderboard website Deploy to S3
        infrastructure_stage.addPost(
            new pipelines.CodeBuildStep('LeaderboardDeployToS3', {
                installCommands: ['npm install -g @aws-amplify/cli'],
                buildEnvironment: {
                    privileged: true,
                    computeType: codebuild.ComputeType.LARGE,
                },
                commands: [
                    // configure and deploy Leaderboard website
                    "echo 'Starting to deploy the Leaderboard website'",
                    'echo website bucket= $leaderboardSourceBucketName',
                    'aws cloudformation describe-stacks --stack-name ' +
                        `drem-backend-${props.branchName}-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs`, // TODO add when paralazing the website deployments
                    'python scripts/generate_amplify_config_cfn.py',
                    'python scripts/generate_leaderboard_amplify_config_cfn.py',
                    'appsyncId=`cat appsyncId.txt` && aws appsync' +
                        ' get-introspection-schema --api-id $appsyncId --format SDL' +
                        ' ./website-leaderboard/src/graphql/schema.graphql',
                    'cd ./website-leaderboard/src/graphql',
                    'amplify codegen', // this is on purpose
                    'amplify codegen', // I'm not repeating myself ;)
                    'cd ../..',
                    'docker run --rm -v $(pwd):/foo -w /foo' +
                        " public.ecr.aws/sam/build-nodejs16.x bash -c 'npm install" +
                        " --cache /tmp/empty-cache && npm run build'",
                    'aws s3 sync ./build/ s3://$leaderboardSourceBucketName/ --delete',
                    "aws cloudfront create-invalidation --distribution-id $leaderboardDistributionId --paths '/*'",
                    'cd ..',
                ],
                envFromCfnOutputs: {
                    leaderboardSourceBucketName: infrastructure.leaderboardSourceBucketName,
                    leaderboardDistributionId: infrastructure.leaderboardDistributionId,
                },
                rolePolicyStatements: rolePolicyStatementsForWebsiteDeployStages,
            })
        );

        // Streaming overlay website Deploy to S3
        infrastructure_stage.addPost(
            new pipelines.CodeBuildStep('StreamingOverlayDeployToS3', {
                // installCommands: ['npm install -g @aws-amplify/cli'],
                buildEnvironment: {
                    privileged: true,
                    computeType: codebuild.ComputeType.LARGE,
                },
                commands: [
                    // configure and deploy Streaming overlay website
                    "echo 'Starting to deploy the Streaming overlay website'",
                    'echo website bucket= $streamingOverlaySourceBucketName',
                    'aws s3 sync ./website-stream-overlays/ s3://$streamingOverlaySourceBucketName/ --delete',
                    "aws cloudfront create-invalidation --distribution-id $streamingOverlayDistributionId --paths '/*'",
                ],
                envFromCfnOutputs: {
                    streamingOverlaySourceBucketName:
                        infrastructure.streamingOverlaySourceBucketName,
                    streamingOverlayDistributionId: infrastructure.streamingOverlayDistributionId,
                },
                rolePolicyStatements: rolePolicyStatementsForWebsiteDeployStages,
            })
        );
    }
}
