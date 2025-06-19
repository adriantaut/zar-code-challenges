import { RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import { Repository, TagMutability } from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class InfrastructureStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    Tags.of(this).add('Project', 'zar-code-challenges');
    Tags.of(this).add('Environment', 'dev');

    this.createEcrRepo('zar-code-challenges-flask-app')
    this.createNetworkStack('zar-code-challenges-vpc');
    this.configureGithubOidc();
  }

  private configureGithubOidc() {

    const GHA_PROVIDER_URL = 'https://token.actions.githubusercontent.com';
    const GHA_PROVIDER_CLIENT_ID = 'sts.amazonaws.com';
    const GHA_PROVIDER_THUMBPRINTS= ['6938fd4d98bab03faadb97b34396831e3780aea1', '1c58a3a8518e8759bf075b76b750d4f2df264fcd'];

    const provider = new iam.OpenIdConnectProvider(this, 'GithubOidcProvider', {
      url: GHA_PROVIDER_URL,
      clientIds: [GHA_PROVIDER_CLIENT_ID],
      thumbprints: GHA_PROVIDER_THUMBPRINTS,
    });

    const oidcRole = new iam.Role(this, 'GithubOidcRole', {
      description: 'Role to be assumed by Github Actions worker',
      roleName: `GithubOidcRole`,
      assumedBy: new iam.OpenIdConnectPrincipal(provider, {
        'ForAnyValue:StringLike': {
          'token.actions.githubusercontent.com:sub': "repo:adriantaut/zar-code-challenges:*",
        },
        'ForAllValues:StringEquals': {
          'token.actions.githubusercontent.com:iss': GHA_PROVIDER_URL,
          'token.actions.githubusercontent.com:aud': GHA_PROVIDER_CLIENT_ID
        }
      })
    });

    oidcRole.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowECRPushPull',
      actions: [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:CompleteLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage"
      ],
      effect: iam.Effect.ALLOW,
      resources: ['*'],
    }));

    oidcRole.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowAssumeCdkRoles',
      actions: [
        "sts:AssumeRole"
      ],
      effect: iam.Effect.ALLOW,
      resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`],
    }));
  }

  private createNetworkStack(vpcName: string) {

    const vpc = new ec2.Vpc(this, 'ZarCodeChallengesVpc', {
      vpcName,
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      maxAzs: 2,
      natGateways: 1,
      createInternetGateway: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 22,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    Tags.of(vpc).add('Name', vpcName);

    vpc.selectSubnets({ subnetGroupName: 'Private' }).subnets.forEach(subnet => {
      Tags.of(subnet).add('kubernetes.io/role/internal-elb', '1');
    });

    vpc.selectSubnets({ subnetGroupName: 'Public' }).subnets.forEach(subnet => {
      Tags.of(subnet).add('kubernetes.io/role/elb', '1');
    });

    return vpc;

  }

  private createEcrRepo(repoName: string) {
    new Repository(this, repoName, {
      repositoryName: repoName,
      imageScanOnPush: true,
      imageTagMutability: TagMutability.IMMUTABLE,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
