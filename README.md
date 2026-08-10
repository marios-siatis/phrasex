# PhraseX

PhraseX is an image-quote discovery app. Members can register, select multiple interests, and search Pexels images. Administrators can search Pexels, add a quote, and produce a branded image ready to share.

## Projects

- `web/` — React + TypeScript UI (Vite)
- `api/` — ASP.NET Core 8 API, PostgreSQL persistence, JWT login, and image compositor
- `infra/` — Terraform for AWS (S3/CloudFront, ECS/Fargate, ALB, RDS, ECR, IAM)

## Local development

1. Set `api/appsettings.Development.json` values for `Jwt:Key`, `Pexels:ApiKey`, and (optionally) `Storage:LocalPath`.
2. Start the API: `dotnet run --project api`.
3. Copy `web/.env.example` to `web/.env`, then run `npm install && npm run dev` in `web/`.

The API seeds an administrator account for local development: `admin@phrasex.local` / `ChangeMe123!`. Change it immediately outside development.

## AWS deployment

Build and push the API image to the Terraform-created ECR repository. Build the React app with `VITE_API_URL=https://<api-domain>/api`, then upload its `dist/` contents to the Terraform-created frontend bucket. The [`infra/README.md`](infra/README.md) contains the exact commands.

## Required secrets

- `Jwt:Key` — a long random signing key
- `Pexels:ApiKey` — Pexels API key; only used server-side
- `Database:ConnectionString` — supplied automatically by the ECS task definition
