import { Tags, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KubectlV32Layer } from '@aws-cdk/lambda-layer-kubectl-v32';
import * as eks from 'aws-cdk-lib/aws-eks';

export interface K8SStackProps extends StackProps {
    imageUri: string;
}

export class K8SStack extends Stack {
  constructor(scope: Construct, id: string, props?: K8SStackProps) {
    super(scope, id, props);

    Tags.of(this).add('Project', 'zar-code-challenges');
    Tags.of(this).add('Environment', 'dev');

    const cluster = eks.Cluster.fromClusterAttributes(this, 'zar-code-challenges-eks', {
      clusterName: 'zar-code-challenges-eks',
      kubectlRoleArn: `arn:aws:iam::${this.account}:role/Eks-Masters-Role`,
      kubectlLayer: new KubectlV32Layer(this, 'kubectl'),
    });

    const deployment = cluster.addManifest('deployment', {
      "apiVersion": "apps/v1",
      "kind": "Deployment",
      "metadata": {
        "name": "flask-app"
      },
      "spec": {
        "replicas": 1,
        "selector": {
          "matchLabels": {
            "app": "flask-app"
          }
        },
        "template": {
          "metadata": {
            "labels": {
              "app": "flask-app"
            }
          },
          "spec": {
            "containers": [
              {
                "name": "flask-app",
                "image": props?.imageUri,
                "ports": [
                  {
                    "containerPort": 5000
                  }
                ],
                "resources": {
                  "limits": {
                    "cpu": "500m",
                    "memory": "512Mi"
                  },
                  "requests": {
                    "cpu": "100m",
                    "memory": "128Mi"
                  }
                },
                "livenessProbe": {
                  "httpGet": {
                    "path": "/healthz",
                    "port": 5000
                  },
                  "initialDelaySeconds": 30,
                  "periodSeconds": 10,
                  "timeoutSeconds": 5
                },
                "readinessProbe": {
                  "httpGet": {
                    "path": "/ready",
                    "port": 5000
                  },
                  "initialDelaySeconds": 5,
                  "periodSeconds": 5
                }
              }
            ]
          }
        }
      }
    });

    const service = cluster.addManifest('service', {
      "apiVersion": "v1",
      "kind": "Service",
      "metadata": {
        "name": "flask-app-service",
        "annotations": {
          "service.beta.kubernetes.io/aws-load-balancer-internal": "false"
        }
      },
      "spec": {
        "type": "LoadBalancer",
        "selector": {
          "app": "flask-app"
        },
        "ports": [
          {
            "protocol": "TCP",
            "port": 80,
            "targetPort": 5000
          }
        ]
      }
    });

    service.node.addDependency(deployment);
  }
}
