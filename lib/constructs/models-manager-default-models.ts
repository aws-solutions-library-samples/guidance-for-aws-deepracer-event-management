import { Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Deployment from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface ModelsManagerProps {
  uploadBucket: s3.IBucket;
  modelsBucket: s3.IBucket;
}

export class ModelsManagerDefaultModelsDeployment extends Construct {
  constructor(scope: Construct, id: string, props: ModelsManagerProps) {
    super(scope, id);

    const stack = Stack.of(this);

    const defaultModelsDeploymentRole = new iam.Role(this, 'defaultModelDeploymentRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'grants the custom CF Resource permission to write and delete from required buckets',
    });

    props.modelsBucket.grantReadWrite(defaultModelsDeploymentRole);
    props.uploadBucket.grantReadWrite(defaultModelsDeploymentRole);
    /* Deploy Default DeepRacer models. FOr the models to be properly index this needs to run
        after the antivirus deployment and lambda putting the models info into the models DDB table */
    new s3Deployment.BucketDeployment(this, 'ModelsDeploy', {
      sources: [s3Deployment.Source.asset('./lib/default_models')],
      destinationBucket: props.uploadBucket,
      destinationKeyPrefix: `private/${stack.region}:00000000-0000-0000-0000-000000000000/000000000000/default/`,
      retainOnDelete: false,
      memoryLimit: 512,
      role: defaultModelsDeploymentRole,
    });
  }
}
