# PhraseX

PhraseX is an image-quote discovery app. Members can register, select multiple interests, and search Pexels images. Administrators can search Pexels, add a quote, and produce a branded image ready to share.

## Projects

- `web/` — React + TypeScript UI (Vite)
- `api/` — ASP.NET Core 8 API, PostgreSQL persistence, JWT login, and image compositor
- `infra/` — Terraform for AWS (S3/CloudFront, ECS/Fargate, ALB, RDS, ECR, IAM)

## Local development

### macOS one-command start

Install Docker Desktop, .NET 8 SDK, and Node.js 20+. Set your Pexels key, make the scripts executable once, and start the stack:

```sh
export PHRASEX_PEXELS_API_KEY='your-pexels-key'
chmod +x run-local.sh stop-local.sh
./run-local.sh
```

This starts PostgreSQL in Docker and runs the API and web app in the background. Browse to `http://localhost:5173`. Use `./stop-local.sh` to stop everything.

### Manual start

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



TODO:

Split tsx into separate UI files 
GIve me the list of similar quotes and force create ✅ 
As an admin i will need the ability to remove quotes ✅ 

create image should give me the ability preview quotes 
User management 
Stats page
fix missing author  ✅ 
HastTags Column in quotes in create quote and in config like for example (phrasex, apofthegmata, apofthagmata_zwhs) they are must have to  ✅  (in lambda config)
create collections of my quotes  ✅ 