# backbone-api
[![CircleCI](https://circleci.com/gh/backbonelabs/backbone-api/tree/master.svg?style=shield&circle-token=286cc1fc458fb307bd3f58ee7c3380b5dfdd2914)](https://circleci.com/gh/backbonelabs/backbone-api/tree/master)

API server for the Backbone app

## Requirements

- Node.js 6.3.1
- MongoDB 3.2.8 (for local dev)

## Deploying to AWS

Production releases should be triggered from the `production` branch. Therefore, `master` could be ahead of `production` because we may merge in new changes but delibrately hold off on releasing until a later time. Using a separate branch for releases will allow us to further test and perform QA before releasing to the wild.

1. Make sure you have the Elastic Beanstalk CLI installed and configured. See http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3.html.
2. Checkout to the `production` branch and merge in the latest `master`
3. Run `eb deploy`
