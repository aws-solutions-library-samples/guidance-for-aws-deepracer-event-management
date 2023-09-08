import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rum from 'aws-cdk-lib/aws-rum';
import * as customResources from 'aws-cdk-lib/custom-resources';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface CwRumAppMonitorProps {
    domainName: string;
    allowCookies?: boolean;
    enableXray?: boolean;
    sessionSampleRate?: number;
    telemetries?: string[];
}

export class CwRumAppMonitor extends Construct {
    public readonly script: string;
    public readonly id: string;
    public readonly config: string;

    constructor(scope: Construct, id: string, props: CwRumAppMonitorProps) {
        super(scope, id);

        const stack = Stack.of(this);

        // RUM Cognito Identity Pool
        const rum_identity_pool = new cognito.CfnIdentityPool(this, 'CwRumIdentityPool', {
            allowUnauthenticatedIdentities: true,
            allowClassicFlow: true,
        });

        NagSuppressions.addResourceSuppressionsByPath(
            stack,
            `${scope.node.path}/${id}/CwRumIdentityPool`,
            [
                {
                    id: 'AwsSolutions-COG7',
                    reason: 'CloudWatch RUM requires an unauthenticated identity pool to operate.',
                },
            ]
        );

        // RUM Cognito Identity Pool Unauthenitcated Role
        const rum_id_pool_unauth_user_role = new iam.Role(
            this,
            'CwRumCognitoDefaultUnauthenticatedRole',
            {
                assumedBy: new iam.FederatedPrincipal(
                    'cognito-identity.amazonaws.com',
                    {
                        StringEquals: {
                            'cognito-identity.amazonaws.com:aud': rum_identity_pool.ref,
                        },
                        'ForAnyValue:StringLike': {
                            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
                        },
                    },
                    'sts:AssumeRoleWithWebIdentity'
                ),
            }
        );

        rum_id_pool_unauth_user_role.applyRemovalPolicy(RemovalPolicy.DESTROY);

        new cognito.CfnIdentityPoolRoleAttachment(this, 'CwRumIdentityPoolRoleAttachment', {
            identityPoolId: rum_identity_pool.ref,
            roles: {
                unauthenticated: rum_id_pool_unauth_user_role.roleArn,
            },
        });

        // RUM App Monitor
        const cfn_app_monitor = new rum.CfnAppMonitor(this, 'CfnAppMonitor', {
            domain: props.domainName,
            name: props.domainName,
            appMonitorConfiguration: {
                allowCookies: props.allowCookies,
                enableXRay: props.enableXray,
                guestRoleArn: rum_id_pool_unauth_user_role.roleArn,
                identityPoolId: rum_identity_pool.ref,
                sessionSampleRate: props.sessionSampleRate,
                telemetries: props.telemetries,
            },
        });

        const rum_policy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['rum:PutRumEvents'],
            resources: [
                `arn:aws:rum:${stack.region}:${stack.account}:appmonitor/${cfn_app_monitor.ref}`,
            ],
        });

        rum_id_pool_unauth_user_role.addToPolicy(rum_policy);

        const cwRumCr = new customResources.AwsCustomResource(this, 'test', {
            onCreate: {
                service: 'RUM',
                action: 'getAppMonitor',
                parameters: { Name: cfn_app_monitor.ref },
                physicalResourceId:
                    customResources.PhysicalResourceId.fromResponse('AppMonitor.Id'),
            },
            onUpdate: {
                service: 'RUM',
                action: 'getAppMonitor',
                parameters: { Name: cfn_app_monitor.ref },
                physicalResourceId:
                    customResources.PhysicalResourceId.fromResponse('AppMonitor.Id'),
            },
            policy: customResources.AwsCustomResourcePolicy.fromSdkCalls({
                resources: customResources.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
        });

        const appMonitorId = cwRumCr.getResponseField('AppMonitor.Id');

        const enableXray = props.enableXray ?? true;
        const allowCookies = props.allowCookies ?? true;
        const sessionSampleRate = props.sessionSampleRate ?? 1;
        const telemetries = props.telemetries ?? ['"performance"', '"errors"', '"http"'];

        const rumScript = `<script>
            (function(n,i,v,r,s,c,x,z){x=window.AwsRumClient={q:[],n:n,i:i,v:v,r:r,c:c};window[n]=function(c,p){x.q.push({c:c,p:p});};z=document.createElement('script');z.async=true;z.src=s;document.head.insertBefore(z,document.head.getElementsByTagName('script')[0]);})(
                'cwr',
                '${appMonitorId}',
                '1.0.0',
                '${stack.region}',
                'https://client.rum.us-east-1.amazonaws.com/1.12.0/cwr.js',
                {
                sessionSampleRate: ${sessionSampleRate},
                guestRoleArn: "${rum_id_pool_unauth_user_role.roleArn}",
                identityPoolId: "${rum_identity_pool.ref}",
                endpoint: "https://dataplane.rum.eu-west-1.amazonaws.com",
                telemetries: [${telemetries}],
                allowCookies: ${allowCookies},
                enableXRay: ${enableXray}
                }
            );
        </script>`;

        this.script = rumScript;
        // this.name = cfn_app_monitor.ref // TODO is this export needed?
        this.id = appMonitorId; // TODO is this export needed?

        const rumConfig = `{
            "sessionSampleRate": ${sessionSampleRate},
            "guestRoleArn": "${rum_id_pool_unauth_user_role.roleArn}",
            "identityPoolId": "${rum_identity_pool.ref}",
            "endpoint": "https://dataplane.rum.eu-west-1.amazonaws.com",
            "telemetries": [${telemetries}],
            "allowCookies": ${allowCookies},
            "enableXRay": ${enableXray}
        }`;
        this.config = rumConfig;
    }
}
