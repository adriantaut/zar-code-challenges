import { Tags, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Role, AccountPrincipal, User } from 'aws-cdk-lib/aws-iam';
import { KubectlV32Layer } from '@aws-cdk/lambda-layer-kubectl-v32';


export class EksStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    Tags.of(this).add('Project', 'zar-code-challenges');
    Tags.of(this).add('Environment', 'dev');


    const mastersRole = new Role(this, 'Eks-Masters-Role', {
      roleName: 'Eks-Masters-Role',
      assumedBy: new AccountPrincipal(this.account), // Security at it's best :)
    });

    const cluster = new eks.Cluster(this, 'eks-cluster', {
      clusterName: 'zar-code-challenges-eks',
      version: eks.KubernetesVersion.V1_32,
      kubectlLayer: new KubectlV32Layer(this, 'kubectl'),
      defaultCapacity: 2,
      defaultCapacityInstance: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      endpointAccess: eks.EndpointAccess.PUBLIC_AND_PRIVATE,
      albController: {
        version: eks.AlbControllerVersion.V2_8_2,
      },
      mastersRole,
      vpc: ec2.Vpc.fromLookup(this, 'VPC', { vpcName: 'zar-code-challenges-vpc'}),
    });

    new eks.Addon(this, 'eks-addon', {
      cluster,
      addonName: 'vpc-cni',
      addonVersion: 'v1.19.6-eksbuild.1',
    });

    new eks.Addon(this, 'coredns', {
      cluster,
      addonName: 'coredns',
      addonVersion: 'v1.11.4-eksbuild.14',
    });

    new eks.Addon(this, 'kube-proxy', {
      cluster,
      addonName: 'kube-proxy',
      addonVersion: 'v1.32.3-eksbuild.7',
    });
  }
}
