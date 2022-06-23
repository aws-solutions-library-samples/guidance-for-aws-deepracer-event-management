from os import name
from aws_cdk import (
    Stack,
    Stage,
    Environment,
    aws_codecommit as codecommit,
    aws_codebuild as codebuild,
    aws_codepipeline as codepipeline,
    aws_codepipeline_actions as codepipeline_actions,
    pipelines as pipelines,
    aws_s3 as s3,
    aws_iam as iam
)
from constructs import Construct

from deepracer_event_manager_stack import CdkDeepRacerEventManagerStack

class InfrastructurePipelineStage(Stage):
    def __init__(self, scope: Construct, construct_id: str, env: Environment, branchname: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        stack = CdkDeepRacerEventManagerStack(self, "drem-" + branchname, env=env)
        
        self.sourceBucketName = stack.sourceBucketName
        self.distributionId = stack.distributionId
        self.stackRegion = stack.stackRegion
        self.userPoolId = stack.userPoolId
        self.userPoolWebClientId = stack.userPoolWebClientId
        self.identityPoolId = stack.identityPoolId
        self.apiUrl = stack.apiUrl

class CdkServerlessCharityPipelineStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, branchname: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        ## setup for pseudo parameters
        stack = Stack.of(self)

        # ## codecommit repo
        # repo = codecommit.Repository.from_repository_name(self, "SourceRepo",
        #     repository_name="cdk-serverless-charity"
        # )

        ## codepipeline
        #source_artifact = codepipeline.Artifact(artifact_name="source_artifact")

        s3_repo_bucket=s3.Bucket.from_bucket_arn(self, "S3RepoBucket", "arn:aws:s3:::drem-pipeline-zip-113122841518-eu-west-1")
        pipeline = pipelines.CodePipeline(self, "Pipeline",
            docker_enabled_for_synth=True,
            synth=pipelines.CodeBuildStep("SynthAndDeployBackend",
                input=pipelines.CodePipelineSource.s3(
                    bucket=s3_repo_bucket,
                    object_key=branchname + "/drem.zip",
                    trigger=codepipeline_actions.S3Trigger.POLL
                ),
                commands=[
                    "pip install -r requirements.txt", 
                    # "npm ci", 
                    # "npm run build", 
                    "npx cdk synth",
                ],
                primary_output_directory="cdk.out",
                role_policy_statements=[
                    iam.PolicyStatement(
                        actions=["sts:AssumeRole"],
                        resources=["*"],
                        conditions={
                            "StringEquals": {
                                "iam:ResourceTag/aws-cdk:bootstrap-role": "lookup"
                            }
                        }
                    )
                ],
                # build_environment=codebuild.BuildEnvironment(
                #     privileged=True
                # )
            )
        )

        ## Dev Stage
        # Region
        env=stack

        infrastructure = InfrastructurePipelineStage(self, 'InfrastructureDeploy', env, branchname)
        infrastructure_stage = pipeline.add_stage(infrastructure)

        # Add Generate Amplify Config and Deploy to S3
        infrastructure_stage.add_post(
            pipelines.CodeBuildStep("DeployAmplifyToS3",
                # build_environment=codebuild.BuildEnvironment(
                #     privileged=True
                # ),
                commands=[
                    "echo $sourceBucketName",
                    "pwd",
                    "ls -lah",
                    "python generate_amplify_config.py",
                    "python update_index_html_with_script_tag.py",
                    "cd ./website",
                    "docker run --rm -v $(pwd):/foo -w /foo public.ecr.aws/sam/build-nodejs14.x bash -c 'npm install --cache /tmp/empty-cache && npm run build'",
                    "aws s3 sync ./build/ s3://$sourceBucketName/ --delete",
                    "aws cloudfront create-invalidation --distribution-id $distributionId --paths '/*'"
                ],
                env_from_cfn_outputs={
                    "sourceBucketName": infrastructure.sourceBucketName,
                    "distributionId": infrastructure.distributionId,
                    # "stackRegion": infrastructure.stackRegion,
                    # "userPoolId": infrastructure.userPoolId,
                    # "userPoolWebClientId": infrastructure.userPoolWebClientId,
                    # "identityPoolId": infrastructure.identityPoolId,
                    # "apiUrl": infrastructure.apiUrl
                },
                #additional_artifacts=[source_artifact],
                role_policy_statements=[
                    iam.PolicyStatement(
                        effect=iam.Effect.ALLOW,
                        actions=[
                            "s3:PutObject",
                            "s3:ListBucket",
                            "s3:DeleteObject"
                        ],
                        resources=["*"]
                    ),
                    iam.PolicyStatement(
                        effect=iam.Effect.ALLOW,
                        actions=[
                            "cloudfront:CreateInvalidation"
                        ],
                        resources=["*"]
                    )
                ]
            )
        )

        
