# backbone-api
[![CircleCI](https://circleci.com/gh/backbonelabs/backbone-api/tree/master.svg?style=shield&circle-token=286cc1fc458fb307bd3f58ee7c3380b5dfdd2914)](https://circleci.com/gh/backbonelabs/backbone-api/tree/master)

API server for the Backbone app

## Requirements

- Node.js 6.3.1
- MongoDB 3.2.8 (for local dev)

## Deploying to AWS

1. Make sure you have the Elastic Beanstalk CLI installed and configured. See http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3.html.
2. Checkout the Git branch you want to deploy (for now, we will use the `master` branch for production since we don't have a staging environment yet)
3. Run `eb deploy`
