
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rum from 'aws-cdk-lib/aws-rum';
import * as customResources from 'aws-cdk-lib/custom-resources';


import { Construct } from 'constructs';

function cwrumCustomResource(name: string) {

    const on_create_aws_sdk_call = new customResources.AwsSdkCall(
        physical_resource_id = customResources.PhysicalResourceId.fromResponse(
            "AppMonitor.Id"
        ),
        service: "RUM",
        action: "getAppMonitor",  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RUM.html//getAppMonitor-property // noqa: E501
        parameters = {
            "Name": name,
        },
    )

    const custom_resource = new customResources.AwsCustomResource(this, "CwRum_custom_resource", {
        policy: customResources.AwsCustomResourcePolicy.fromSdkCalls(
            resources: customResources.AwsCustomResourcePolicy.ANY_RESOURCE
        ),
        onCreate: on_create_aws_sdk_call,
        onUpdate: on_create_aws_sdk_call,
    }
    )

    const app_monitor_id = custom_resource.getResponseField("AppMonitor.Id")
    return app_monitor_id
}

export interface CwRumAppMonitorProps {
    domainName: string,
    allowCookies?: boolean = true,
    enableXray?: boolean = true,
    sessionSampleRate?:  number = 1, // TODO was ealier decimal = 1,
    telemetries?: string[] = ["performance", "errors", "http"],
}

export class CwRumAppMonitor extends Construct {

    constructor(scope: Construct, id: string, props: CwRumAppMonitorProps) {
        super(scope, id);

        const stack = Stack.of(this)

        // RUM Cognito Identity Pool
        const rum_identity_pool = new cognito.CfnIdentityPool(this, "CwRumIdentityPool", {
            allowUnauthenticatedIdentities: true,
            allowClassicFlow: true
        }
        )

        // RUM Cognito Identity Pool Unauthenitcated Role
        const rum_id_pool_unauth_user_role = new iam.Role(this, "CwRumCognitoDefaultUnauthenticatedRole", {
            assumedBy: new iam.FederatedPrincipal(
                "cognito-identity.amazonaws.com",
                {
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": rum_identity_pool.ref,
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "unauthenticated",
                    },
                },
                "sts:AssumeRoleWithWebIdentity",
            ),
        })

        rum_id_pool_unauth_user_role.applyRemovalPolicy(RemovalPolicy.DESTROY)

        new cognito.CfnIdentityPoolRoleAttachment(this, "CwRumIdentityPoolRoleAttachment", {
            identityPoolId: rum_identity_pool.ref,
            roles: {
                "unauthenticated": rum_id_pool_unauth_user_role.roleArn,
            },
        })

        // RUM App Monitor
        const cfn_app_monitor = new rum.CfnAppMonitor(this, "CfnAppMonitor", {
            domain: props.domainName,
            name: props.domainName,
            appMonitorConfiguration: {
                allowCookies: props.allowCookies,
                enableXRay: props.enableXray,
                guestRoleArn: rum_id_pool_unauth_user_role.roleArn,
                identityPoolId: rum_identity_pool.ref,
                sessionSampleRate: props.sessionSampleRate,
                telemetries: props.telemetries,
            }
        })

        const rum_policy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["rum:PutRumEvents"],
            resources: [
                `arn:aws:rum:${stack.region}:${stack.account}:appmonitor/${cfn_app_monitor.ref}`
            ],
        })

        rum_id_pool_unauth_user_role.addToPolicy(rum_policy)

        const rum_app_monitor_id = cwrumCustomResource(cfn_app_monitor.ref)

        // this.name = cfn_app_monitor.ref // TODO is this export needed?
        cfn_app_monitor.appMonitorConfiguration!

        // TODO fix this
        const rum_script = `<script>(function(n,i,v,r,s,c,x,z){{x=window.AwsRumClient={{q:[],n:n,i:i,v:v,r:r,c:c}};window[n]=function(c,p){{x.q.push({{c:c,p:p}});}};z=document.createElement('script');z.async=true;z.src=s;document.head.insertBefore(z,document.getElementsByTagName('script')[0]);}})('cwr','${rum_app_monitor_id}','1.0.0','${stack.region}','https://client.rum.us-east-1.amazonaws.com/1.0.2/cwr.js',{{sessionSampleRate:1,guestRoleArn:\"${rum_id_pool_unauth_user_role.roleArn}\",identityPoolId:\"${rum_identity_pool.ref}\",endpoint:\"https://dataplane.rum.eu-west-1.amazonaws.com\",telemetries:${rum_app_monitor_config_telemetries},allowCookies:${rum_app_monitor_config_cookies},enableXRay:${rum_app_monitor_config_x_ray}}});</script>`
            rum_app_monitor_config_x_ray = str(
                cfn_app_monitor.app_monitor_configuration.enable_x_ray
            ).lower(),
            rum_app_monitor_config_cookies = str(
                cfn_app_monitor.app_monitor_configuration.allow_cookies
            ).lower(),
            rum_app_monitor_config_telemetries = str(
                cfn_app_monitor.app_monitor_configuration.telemetries
            ),
        )

        // this.name = cfn_app_monitor.ref // TODO is this export needed?
        // this.id = rum_app_monitor_id // TODO is this export needed?
        // this.script = rum_script // TODO is this export needed?
    }
}