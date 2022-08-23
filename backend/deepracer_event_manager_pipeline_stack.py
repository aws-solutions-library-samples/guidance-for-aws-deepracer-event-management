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

from backend.deepracer_event_manager_stack import CdkDeepRacerEventManagerStack

class InfrastructurePipelineStage(Stage):
    def __init__(self, scope: Construct, construct_id: str, env: Environment, branchname: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        stack = CdkDeepRacerEventManagerStack(self, "infrastructure", env=env)
        
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
                    "python -m venv venv",
                    ". venv/bin/activate",
                    "pip install --upgrade pip",
                    "pip install -r requirements-dev.txt", 
                    # "npm ci", 
                    # "npm run build", 
                    "python -m pytest --junitxml=reports/unittest-report.xml",
                    "npx cdk synth",
                    "pwd",
                    "ls -lah",
                    "ls $CODEBUILD_SRC_DIR/reports"
                ],
                partial_build_spec=codebuild.BuildSpec.from_object({
                        "reports": {
                            "pytest_reports": {
                                "files": [
                                        "unittest-report.xml"
                                ],
                                "base-directory": "reports",
                                "file-format": "JUNITXML"
        
                            }
                        }
                }),
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
            )
        )

        ## Dev Stage
        # Region
        env=stack

        infrastructure = InfrastructurePipelineStage(self, "drem-backend-" + branchname, env, branchname)
        infrastructure_stage = pipeline.add_stage(infrastructure)

        # Add Generate Amplify Config and Deploy to S3
        infrastructure_stage.add_post(
            pipelines.CodeBuildStep("DeployAmplifyToS3",
                build_environment=codebuild.BuildEnvironment(
                    build_image=codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_2_0
                ),
                input=pipelines.CodePipelineSource.s3(
                    bucket=s3_repo_bucket,
                    object_key=branchname + "/drem.zip",
                    trigger=codepipeline_actions.S3Trigger.POLL
                ),
                commands=[
                    "python -m venv venv",
                    ". venv/bin/activate",
                    "pip install --upgrade pip",
                    "pip install -r requirements-dev.txt", 
                    # Node update
                    "n stable",
                    "node --version",
                    # Python
                    "python -m pytest --junitxml=reports/unittest-report.xml",
                    "npx cdk synth",
                    "pwd",
                    "ls -lah",
                    "ls $CODEBUILD_SRC_DIR/reports"
                ],
                env_from_cfn_outputs={
                    "sourceBucketName": infrastructure.sourceBucketName,
                    "distributionId": infrastructure.distributionId,
                },
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
                    ),
                    iam.PolicyStatement(
                        effect=iam.Effect.ALLOW,
                        actions=[
                            "cloudformation:DescribeStacks"
                        ],
                        resources=["*"]
                    )
                ]
            )
        )

        
