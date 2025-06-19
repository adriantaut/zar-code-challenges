# Flask App DevOps Challenge

This all-in-one repository contains the necessary bits for deploying a provided Python Flask web application using modern DevOps practices.

The 1000-feet view consists of:
* The Python Flask application source code
* Containerization with Docker
* Infrastructure as Code using AWS CDK for:
  * AWS Infrastructure: AWS VPC, AWS ECR Repository, IAM Roles, Github OIDC Roles, etc
  * EKS Cluster
  * Kubernetes Deployment/Service
* Github Workflow for defining the CI/CD pipeline for building and releasing the Flask App

## Table of Contents

- [Flask App DevOps Challenge](#flask-app-devops-challenge)
   * [Repository Structure](#repository-structure)
   * [Main architectural components](#main-architectural-components)
      + [Infrastructure stack](#infrastructure-stack)
      + [EKS Cluster Stack](#eks-cluster-stack)
      + [Kubernetes Deployment](#kubernetes-deployment)
      + [CI/CD Automation](#cicd-automation)
         - [Flask Application](#flask-application)
         - [Infrastructure and EKS Stacks](#infrastructure-and-eks-stacks)
   * [How to release end-to-end](#how-to-release-end-to-end)

## Repository Structure

```bash
zar-code-challenges/
├── .github                   # Folder containing Github Workflow
│   └── workflows
│       └── app-build-and-deploy.yml
├── devops
│   ├── cdk                   # folder containing all the AWS CDK code
│   │   ├── eks               # AWS EKS Cluster CDK Stack
│   │   ├── infrastructure    # AWS Infrastructure (Networking, ECR, IAM) CDK Stack
│   │   └── k8s               # Kubernetes deployment CDK Stack
│   ├── devops-challenge.md   # DevOps Challenge instructions
│   ├── README.md             # Readme file
│   └── simple-flask-app      # Python Flask App folder
│       ├── app.py            # Source code
│       ├── Dockerfile        # Dockerfile for containerization of the app
│       ├── instance          # The SQLite DB
│       ├── requirements.txt  # Python dependencies file
│       └── venv              # Python virtual env
```

## Main architectural components

### Infrastructure stack

Is provisioned with AWS CDK and is generically named "infrastructure" as it is responsible with deploying resources in multiple AWS Services, not necessarily inter-connected. We can remember the following:
* `AWS ECR repository` - that hosts the Flask App container image
* `AWS VPC resources` - the AWS recommended networking setup with 2 Private and 2 Public subnets, NAT and Internet Gateways
* `Github OIDC IAM Roles` - an IAM Role and Policies to be assumed from Github Actions workflows during container image push and during k8s manifests deployments

### EKS Cluster Stack

Also provisioned with AWS CDK, the EKS Cluster Stack is responsible for setting up the EKS Cluster. It is separated from the Infrastructure Stack because of the different lifecycle each of the two stacks are having. Deep diving into the EKS Stack we can find an EKS Cluster with:
* running version `Kubernetes v1.32`
* a managed NodeGroup with `2 x t3.medium` instances
* EKS Endpoint access accesible both `private` and `public`
* Addons
  * AWS VPC CNI - for native AWS VPC Networking support
  * Core DNS - the kubernetes cluster DNS Server
  * Kube Proxy - for networking stack at k8s level
  * AWS Load Balancer Controller - managing AWS ELBs for exposing k8s workloads

The EKS Cluster is simplistic and there is room for a lot of Security improvements, but also production-ready mandatory features like autoscaling capabilities, external-dns, secrets management, etc.

### Kubernetes Deployment

Definitely would not opt for managing Kubernetes Manifests with AWS CDK in Production, but just for the sake of this ZAR Challenge and because I miss AWS CDK, I went for packaging these in a CDK Stack as well. The Kubernetes application is quite simple, consisting of a Deployment and a Service of type LoadBalancer that is publicly exposing the Flask Application.

### CI/CD Automation

#### Flask Application

The CI/CD Pipeline is built using a Github Workflow. This is triggered whenever there is a push on a branch of choice and it consists of two main jobs.

1. Build and Push the Container image

Using the Dockerfile that was created as part of this challenge, the Flask App is packaged into a container image and pushed into an AWS ECR Repository, in the same AWS Account and AWS Region where the EKS Cluster will reside, so that it is as close as possible to the destination.

The AWS ECR Login is possible by assuming the IAM Role that trusts Github OIDC's.

2. Deploy Kubernetes

Having a CDK App that is written in typescript, we need to prepare the Github Runners by installing NodeJS v24. Then the code is compiled with `npm` and by assuming the same IAM Role, we run a:
* `cdk diff` - for visualization of the differences to be applied
* `cdk deploy` - for actual deployment of the Kubernetes manifests

The two `cdk` commands also input the CDK Stack with the newly created container image by using CDK Contexts.

#### Infrastructure and EKS Stacks

Although it was not specifically requested as part of this challenge, there are two Github Workflows created for each of the Infrastructure and EKS Stacks. 

The first workflow just runs `cdk diff` so that Engineers can review the changes to be applied. This runs on every push to a specific branch. Once reviewed, the second workflow can be manually trigerred and the `cdk deploy` command runs. The two-step approach was chosen here because of the risks associated with deploying some unwanted changes in the Infrastructure or the EKS Stack.


## How to release end-to-end

The release process is fully relying on Github Actions. Thus, every code change can be deployed either automatically or by manually triggering Github Workflows as follows:

1. `Infrastructure Stack` - the `cdk diff` runs automatically, but the workflow responsible with `cdk deploy` needs to be manually triggered
2. `EKS Stack` - the `cdk diff` runs automatically, but the workflow responsible with `cdk deploy` needs to be manually triggered
3. `Flask Application` - once there is a code change, a new container image is being built and the Kubernetes Deployment is updated accordingly

PS: In an ideal world, different workflows should be triggered depending on the paths of the files changed in Github. Unfortunately, this is not easily achievable with Github Actions. Of course, in the same ideal world, the above 3 stacks should not be colocated :)

Cheers!