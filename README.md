# backbone-api
[![CircleCI](https://circleci.com/gh/backbonelabs/backbone-api/tree/master.svg?style=shield&circle-token=286cc1fc458fb307bd3f58ee7c3380b5dfdd2914)](https://circleci.com/gh/backbonelabs/backbone-api/tree/master)

API server for the Backbone app

## Requirements

- Node.js 6.2.2
- MongoDB 3.2.8

## Setup

Ensure the MongoDB server is running before launching the API server.

Ask another developer for the following environment variables values, which you'll store in your `.env.local` file (create the file if it doesn't already exist):

* BL_ACCESS_TOKEN_SECRET
* BL_MAILGUN_API

### Email settings

By default, emails will not be sent in development mode. To have emails be sent, set the `BL_SILENT_EMAIL` environment variable to `false`. Furthermore, emails sent in development mode will be sent to the email address specified in `BL_TEST_EMAIL`, so feel free to set it to an email address you have access to by storing it in your `.env.local` file.

## Deploying to AWS

Production releases should be triggered from the `production` branch. Therefore, `master` could be ahead of `production` because we may merge in new changes but delibrately hold off on releasing until a later time. Using a separate branch for releases will allow us to further test and perform QA before releasing to the wild.

1. Make sure you have the Elastic Beanstalk CLI installed and configured. See http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3.html.
2. Checkout to the `production` branch and merge in the latest `master`
3. Run `eb deploy`
