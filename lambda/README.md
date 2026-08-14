# AWS deployment

Prerequisites: AWS CLI authenticated for the target account, Terraform 1.6+, Docker, Node 20+, and .NET 8 SDK.

1. Copy `terraform.tfvars.example` to `terraform.tfvars`, add real values, then provision the platform:

```sh
cd infra
terraform init
terraform apply
```

2. Build and publish the API (replace the values using Terraform outputs):

```sh
API_REPO=$(terraform output -raw api_ecr_repository)
aws ecr get-login-password --region eu-west-2 | docker login --username AWS --password-stdin "${API_REPO%/*}"
docker build -t phrasex-api ../api
docker tag phrasex-api:latest "$API_REPO:latest"
docker push "$API_REPO:latest"
aws ecs update-service --cluster phrasex-prod --service api --force-new-deployment
```

3. Build the web app and deploy its static files. Use the API output while building; the browser needs the full `/api` URL.

```sh
cd ../web
VITE_API_URL=$(cd ../infra && terraform output -raw api_url) npm install
VITE_API_URL=$(cd ../infra && terraform output -raw api_url) npm run build
aws s3 sync dist/ "s3://$(cd ../infra && terraform output -raw frontend_bucket)" --delete
```

The `frontend_url` output is the public site. This starter creates a plain HTTP ALB API endpoint; add an ACM certificate, HTTPS listener, and a custom DNS record before production use. The RDS instance uses `skip_final_snapshot` for easy iteration—change that before a production launch.

Local testing (scheduler checker)
--------------------------------

You can run a local Postgres and the scheduler checker container to validate posting logic:

```sh
cd infra
docker compose up --build
```

The compose file starts Postgres with a minimal schema and seeds a sample scheduled post. The `scheduler` container will poll and attempt to post using the `INSTAGRAM` tokens in the seeded DB (placeholders by default).

To run in AWS you'll need to build and push the Lambda container image to ECR and then apply Terraform. Terraform creates an ECR repo for the checker; build and push to the repo output `lambda_checker_ecr: <repo>` as `:latest`.

TODO:

Split into separate UI files 
GIve me the list of similar quotes and force create
Fix create view to look nicer
HastTags Column in quotes in create quote and in config like for example (phrasex, apofthegmata, apofthagmata_zwhs) they are must have to 
