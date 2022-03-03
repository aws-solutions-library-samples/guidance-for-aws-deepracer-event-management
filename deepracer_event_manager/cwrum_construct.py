import decimal
#from constructs import Construct
from aws_cdk import (
    core as cdk,
    aws_iam as iam,
    aws_cognito as cognito,
    aws_rum as rum,
    custom_resources,
)

def cwrum_custom_resource(self, name: str): 
    on_create_aws_sdk_call=custom_resources.AwsSdkCall(
        physical_resource_id=custom_resources.PhysicalResourceId.from_response('AppMonitor.Id'),
        service="RUM",
        action="getAppMonitor", # https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RUM.html#getAppMonitor-property
        parameters={
            "Name": name,
        }
    )

    custom_resource = custom_resources.AwsCustomResource(self, "CwRum_custom_resource",
        policy=custom_resources.AwsCustomResourcePolicy.from_sdk_calls(
            resources=custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE
        ),
        on_create=on_create_aws_sdk_call,
        on_update=on_create_aws_sdk_call,
    )

    app_monitor_id = custom_resource.get_response_field('AppMonitor.Id')
    return app_monitor_id

class CwRumAppMonitor(cdk.Construct):

    def __init__(self, scope: cdk.Construct, id: str, domain_name: str, allow_cookies: bool = True, enable_x_ray: bool = True, session_sample_rate: decimal = 1, telemetries: list = ["performance","errors","http"], **kwargs):
        super().__init__(scope, id, **kwargs)

        stack = cdk.Stack.of(self)

        ## RUM Cognito Identity Pool
        rum_identity_pool = cognito.CfnIdentityPool(self, "CwRumIdentityPool",
            allow_unauthenticated_identities=True,
            allow_classic_flow=True
        )

        ## RUM Cognito Identity Pool Unauthenitcated Role
        rum_id_pool_unauth_user_role = iam.Role(self, "CwRumCognitoDefaultUnauthenticatedRole",
            assumed_by=iam.FederatedPrincipal(
                federated="cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": rum_identity_pool.ref,
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "unauthenticated",
                    },
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity"
            ),
            
        )

        rum_id_pool_unauth_user_role.apply_removal_policy(cdk.RemovalPolicy.DESTROY)

        cognito.CfnIdentityPoolRoleAttachment(self, "CwRumIdentityPoolRoleAttachment",
            identity_pool_id=rum_identity_pool.ref,
            roles={
                "unauthenticated": rum_id_pool_unauth_user_role.role_arn,
            }
        )

        ## RUM App Monitor
        cfn_app_monitor = rum.CfnAppMonitor(self, "CfnAppMonitor",
            domain=domain_name,
            name=domain_name,
            app_monitor_configuration=rum.CfnAppMonitor.AppMonitorConfigurationProperty(
                allow_cookies=allow_cookies,
                enable_x_ray=enable_x_ray,
                guest_role_arn=rum_id_pool_unauth_user_role.role_arn,
                identity_pool_id=rum_identity_pool.ref,
                session_sample_rate=session_sample_rate,
                telemetries=telemetries
            ),
        )

        rum_policy = iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "rum:PutRumEvents"
            ],
            resources=[
                "arn:aws:rum:{}:{}:appmonitor/{}".format(stack.region,stack.account,cfn_app_monitor.ref)
            ],
        )

        rum_id_pool_unauth_user_role.add_to_policy(rum_policy)

        rum_app_monitor_id = cwrum_custom_resource(self,
            name=cfn_app_monitor.ref
        )

        self.name=cfn_app_monitor.ref

        rum_script='<script>(function(n,i,v,r,s,c,x,z){{x=window.AwsRumClient={{q:[],n:n,i:i,v:v,r:r,c:c}};window[n]=function(c,p){{x.q.push({{c:c,p:p}});}};z=document.createElement(\'script\');z.async=true;z.src=s;document.head.insertBefore(z,document.getElementsByTagName(\'script\')[0]);}})(\'cwr\',\'{rum_app_monitor_id}\',\'1.0.0\',\'{region}\',\'https://client.rum.us-east-1.amazonaws.com/1.0.2/cwr.js\',{{sessionSampleRate:1,guestRoleArn:"{rum_guest_role}",identityPoolId:"{rum_identity_pool_id}",endpoint:"https://dataplane.rum.eu-west-1.amazonaws.com",telemetries:{rum_app_monitor_config_telemetries},allowCookies:{rum_app_monitor_config_cookies},enableXRay:{rum_app_monitor_config_x_ray}}});</script>'.format(
            rum_app_monitor_id=rum_app_monitor_id,
            region=stack.region,
            rum_guest_role=rum_id_pool_unauth_user_role.role_arn,
            rum_identity_pool_id=rum_identity_pool.ref,
            rum_app_monitor_config_x_ray=str(cfn_app_monitor.app_monitor_configuration.enable_x_ray).lower(),
            rum_app_monitor_config_cookies=str(cfn_app_monitor.app_monitor_configuration.allow_cookies).lower(),
            rum_app_monitor_config_telemetries=str(cfn_app_monitor.app_monitor_configuration.telemetries),
        )


        self.name=cfn_app_monitor.ref
        self.id=rum_app_monitor_id
        self.script=rum_script