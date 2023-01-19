
import * as iam from 'aws-cdk-lib/aws-iam';


import { Construct } from 'constructs';

export interface SystemsManagerProps {

}

export class SystemsManager extends Construct {
    // public readonly origin: cloudfront.IOrigin;
    // public readonly sourceBucket: s3.IBucket;

    constructor(scope: Construct, id: string, props?: SystemsManagerProps) {
        super(scope, id);


        // CloudWatch Agent on the cars
        const cloudwatch_monitor_role = new iam.Role(this, "CloudWatchAgentServerRole", {
            assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
        })

        // arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
        // arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy

        cloudwatch_monitor_role.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName(
                "AmazonSSMManagedInstanceCore"
            )
        )
        cloudwatch_monitor_role.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName(
                "CloudWatchAgentServerPolicy"
            )
        )

        // Create config in SSM Parameter store for CloudWatch
        // https://docs.aws.amazon.com/cdk/api/v1/python/aws_cdk.aws_ssm/README.html

        // SSM Document
        // https://docs.aws.amazon.com/cdk/api/v1/python/aws_cdk.aws_ssm/CfnDocument.html
        // https://docs.aws.amazon.com/systems-manager/latest/userguide/document-schemas-features.html
        // const cloudwatch_ssm_document = new ssm.CfnDocument(this, "CloudWatch-SSM-Document", {
        //     content: {
        //         schemaVersion: "2.2",
        //         description: "Cloudwatch Agent Install",
        //         parameters: {
        //             Message: {
        //                 type: "String",
        //                 description: "Example parameter",
        //                 default: "Hello World",
        //             }
        //         },
        //         mainSteps: [
        //             {
        //                 action: "aws:runPowerShellScript",
        //                 name: "example",
        //                 inputs: {
        //                     timeoutSeconds: "60",
        //                     runCommand: ["Write-Output {{Message}}"],
        //                 },
        //             }
        //         ],
        //     },
        //     documentType: "Policy",
        //     targetType: "/",
        //     updateMethod: "NewVersion",
        // })

        // // Create the SSM Association
        // // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ssm.CfnAssociation.html
        // // https://docs.aws.amazon.com/cdk/api/v1/python/aws_cdk.aws_ssm/CfnAssociation.html
        // const cloudwatch_association = new ssm.CfnAssociation(this, "cloudwatch_association", {
        //     name: "CloudWatch-SSM-Document",
        //     targets: [
        //         {
        //             key: 'Type',
        //             values: ["deepracer"]
        //         }],
        //     documentVersion: "1",
        //     maxConcurrency: "10",
        //     syncCompliance: "AUTO",
        //     waitForSuccessTimeoutSeconds: 30,
        // })

        //new cloudwatch.Dashboard(this, "Dashboard", { dashboardName: "Car-Status", widgets: [] })

        // Create config in SSM Parameter store for CloudWatch
        // https://docs.aws.amazon.com/cdk/api/v1/python/aws_cdk.aws_ssm/README.html
        // const car_update_ssm_document = new ssm.CfnDocument(this, "Car-Update-SSM-Document", {
        //     content: {
        //         "schemaVersion": "2.2",
        //         "description": "Car update",
        //         "parameters": {
        //             "Message": {
        //                 "type": "String",
        //                 "description": "Example parameter",
        //                 "default": "Hello World",
        //             }
        //         },
        //         "mainSteps": [
        //             {
        //                 "action": "aws:runPowerShellScript",
        //                 "name": "example",
        //                 "inputs": {
        //                     "timeoutSeconds": "60",
        //                     "runCommand": ["Write-Output {{Message}}"],
        //                 },
        //             }
        //         ],
        //     },
        //     documentType: "Policy",
        //     targetType: "/",
        //     updateMethod: "NewVersion",
        // })

        // Manual update, in SSM
        // const car_update_association = new ssm.CfnAssociation(this, "car_update_association", {
        //     name: "Car-Update-SSM-Document",
        //     targets: [
        //         { key: "Type", values: ["deepracer"] }
        //     ],
        //     documentVersion: "1",
        //     syncCompliance: "AUTO",
        //     waitForSuccessTimeoutSeconds: 30,
        // })

        // const timer_update_ssm_document = new ssm.CfnDocument(this, "Timer-Update-SSM-Document", {
        //     content: {
        //         "schemaVersion": "2.2",
        //         "description": "Timer install / update",
        //         "parameters": {
        //             "Message": {
        //                 "type": "String",
        //                 "description": "Example parameter",
        //                 "default": "Hello World",
        //             }
        //         },
        //         "mainSteps": [
        //             {
        //                 "action": "aws:runPowerShellScript",
        //                 "name": "example",
        //                 "inputs": {
        //                     "timeoutSeconds": "60",
        //                     "runCommand": ["Write-Output {{Message}}"],
        //                 },
        //             }
        //         ],
        //     },
        //     documentType: "Policy",
        //     targetType: "/",
        //     updateMethod: "NewVersion",
        // })

        // Timer install, in SSM
        // const timer_update_association = new ssm.CfnAssociation(this, "timer_update_association", {
        //     name: "Timer-Update-SSM-Document",
        //     targets: [{ key: "Type", values: ["timer"] }],
        //     documentVersion: "1",
        //     syncCompliance: "AUTO",
        //     waitForSuccessTimeoutSeconds: 30,
        // })
    }
}
