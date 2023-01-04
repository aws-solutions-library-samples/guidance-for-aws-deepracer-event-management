from aws_cdk import aws_cloudwatch as cloudwatch
from aws_cdk import aws_iam as iam
from aws_cdk import aws_ssm as ssm
from constructs import Construct


class SystemsManager(Construct):
    def __init__(
        self,
        scope: Construct,
        id: str,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        # CloudWatch Agent on the cars
        cloudwatch_monitor_role = iam.Role(
            self,
            "CloudWatchAgentServerRole",
            assumed_by=iam.ServicePrincipal("ec2.amazonaws.com"),
        )

        # arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
        # arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy

        cloudwatch_monitor_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name(
                "AmazonSSMManagedInstanceCore"
            )
        )
        cloudwatch_monitor_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name(
                "CloudWatchAgentServerPolicy"
            )
        )

        # Create config in SSM Parameter store for CloudWatch
        # https://docs.aws.amazon.com/cdk/api/v1/python/aws_cdk.aws_ssm/README.html

        # SSM Document
        # https://docs.aws.amazon.com/cdk/api/v1/python/aws_cdk.aws_ssm/CfnDocument.html
        # https://docs.aws.amazon.com/systems-manager/latest/userguide/document-schemas-features.html
        cloudwatch_ssm_document = ssm.CfnDocument(
            self,
            "CloudWatch-SSM-Document",
            content={
                "schemaVersion": "2.2",
                "description": "Cloudwatch Agent Install",
                "parameters": {
                    "Message": {
                        "type": "String",
                        "description": "Example parameter",
                        "default": "Hello World",
                    }
                },
                "mainSteps": [
                    {
                        "action": "aws:runPowerShellScript",
                        "name": "example",
                        "inputs": {
                            "timeoutSeconds": "60",
                            "runCommand": ["Write-Output {{Message}}"],
                        },
                    }
                ],
            },
            document_type="Policy",
            target_type="/",
            update_method="NewVersion",
        )

        # Create the SSM Association
        # https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ssm.CfnAssociation.html
        # https://docs.aws.amazon.com/cdk/api/v1/python/aws_cdk.aws_ssm/CfnAssociation.html
        cloudwatch_association = ssm.CfnAssociation(
            self,
            "cloudwatch_association",
            name="CloudWatch-SSM-Document",
            targets=[
                ssm.CfnAssociation.TargetProperty(key="Type", values=["deepracer"])
            ],
            document_version="1",
            max_concurrency="10",
            sync_compliance="AUTO",
            wait_for_success_timeout_seconds=30,
        )

        cloudwatch.Dashboard(self, "Dashboard", dashboard_name="Car-Status", widgets=[])

        # Create config in SSM Parameter store for CloudWatch
        # https://docs.aws.amazon.com/cdk/api/v1/python/aws_cdk.aws_ssm/README.html
        car_update_ssm_document = ssm.CfnDocument(
            self,
            "Car-Update-SSM-Document",
            content={
                "schemaVersion": "2.2",
                "description": "Car update",
                "parameters": {
                    "Message": {
                        "type": "String",
                        "description": "Example parameter",
                        "default": "Hello World",
                    }
                },
                "mainSteps": [
                    {
                        "action": "aws:runPowerShellScript",
                        "name": "example",
                        "inputs": {
                            "timeoutSeconds": "60",
                            "runCommand": ["Write-Output {{Message}}"],
                        },
                    }
                ],
            },
            document_type="Policy",
            target_type="/",
            update_method="NewVersion",
        )

        # Manual update, in SSM
        car_update_association = ssm.CfnAssociation(
            self,
            "car_update_association",
            name="Car-Update-SSM-Document",
            targets=[
                ssm.CfnAssociation.TargetProperty(key="Type", values=["deepracer"])
            ],
            document_version="1",
            sync_compliance="AUTO",
            wait_for_success_timeout_seconds=30,
        )

        timer_update_ssm_document = ssm.CfnDocument(
            self,
            "Timer-Update-SSM-Document",
            content={
                "schemaVersion": "2.2",
                "description": "Timer install / update",
                "parameters": {
                    "Message": {
                        "type": "String",
                        "description": "Example parameter",
                        "default": "Hello World",
                    }
                },
                "mainSteps": [
                    {
                        "action": "aws:runPowerShellScript",
                        "name": "example",
                        "inputs": {
                            "timeoutSeconds": "60",
                            "runCommand": ["Write-Output {{Message}}"],
                        },
                    }
                ],
            },
            document_type="Policy",
            target_type="/",
            update_method="NewVersion",
        )

        # Timer install, in SSM
        timer_update_association = ssm.CfnAssociation(
            self,
            "timer_update_association",
            name="Timer-Update-SSM-Document",
            targets=[ssm.CfnAssociation.TargetProperty(key="Type", values=["timer"])],
            document_version="1",
            sync_compliance="AUTO",
            wait_for_success_timeout_seconds=30,
        )
