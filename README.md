# backbone-api

API server for the Backbone app

## Requirements

- Node.js 6+
- MongoDB 3.2+ (for local dev)

## Deploying to AWS

1. Make sure you have the Elastic Beanstalk CLI installed and configured. See http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3.html.
2. Checkout the Git branch you want to deploy (for now, we will use the `master` branch for production since we don't have a staging environment yet)
3. Run `eb deploy`
