#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { K8SStack } from '../lib/k8s-stack';

const app = new cdk.App();

const imageUri = app.node.tryGetContext('imageUri');
if (!imageUri) {
  throw new Error('imageUri context variable is required. Please provide it using --context imageUri=<your-image-uri>');
}

new K8SStack(app, 'K8SStack', {
  imageUri: imageUri,
});
