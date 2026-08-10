# Production deployment setup

The `deploy.yml` workflow runs after every push to `main` (including a merged pull request). It authenticates to AWS with GitHub OpenID Connect rather than storing AWS access keys.

Create a GitHub Environment named `production`, then add the following repository/environment secrets:

| Secret | Purpose |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN trusted by this repository's GitHub OIDC provider. |
| `TF_STATE_BUCKET` | Existing, versioned S3 bucket used only for Terraform state. |
| `PEXELS_API_KEY` | Pexels API key passed to the API infrastructure. |
| `JWT_KEY` | At least 32 random characters used to sign app tokens. |
| `VITE_API_URL` | The public API URL ending in `/api`, for example `https://api.example.com/api`. |
| `FRONTEND_BUCKET` | Terraform output `frontend_bucket`. |

Optional repository variables are `AWS_REGION`, `ECR_REPOSITORY`, and `ECS_CLUSTER`. Their defaults are `eu-west-2`, `phrasex-prod-api`, and `phrasex-prod`.

The AWS role needs scoped permissions for the Terraform resources plus ECR push, ECS service updates, S3 frontend uploads, and CloudFront invalidation if one is added. Protect the `production` environment with required reviewers if infrastructure changes need an approval gate.
