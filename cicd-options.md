# GolfSync — CI/CD Options

## Option 1 — Manual CDK Deploy (current approach)

**How it works:** Make code changes locally → `npx cdk deploy` → CDK builds Docker images, pushes to ECR, updates ECS task definitions, triggers a rolling deploy.

**Pros:** No setup, works today, CDK handles everything end-to-end.

**Cons:** Must be done from your machine with an active SSO session. If you're on the go you can't ship a fix.

**Best for:** Dev environment right now, and fine for prod at small scale.

---

## Option 2 — GitHub Actions (recommended next step)

**How it works:** Push to `main` on golfsync-api or golfsync-web → GitHub Actions builds the Docker image, pushes to ECR, and triggers an ECS rolling update. CDK changes to golfsync-cdk also trigger a `cdk deploy`.

**Auth:** Use AWS OIDC federation (no long-lived AWS keys stored in GitHub — GitHub proves its identity to AWS directly).

**Cost:** Free for public repos; 2,000 min/month free for private repos (builds are ~3-5 min each, well within free tier).

**Pros:** Fully automated, runs in the cloud, no laptop needed, integrates with the existing GitHub workflow.

**Cons:** A few hours of setup. Separate workflows needed for api, web, and cdk repos.

**Rough workflow per repo:**
```
push to main
  → build Docker image (linux/amd64)
  → push to ECR
  → update ECS service (force new deployment)
```

---

## Option 3 — AWS CodePipeline + CodeBuild

**How it works:** Native AWS CI/CD. CodePipeline watches GitHub, CodeBuild builds images, pipeline deploys to ECS.

**Pros:** Stays entirely within AWS, integrates with CloudWatch.

**Cons:** More expensive (~$1/pipeline/month + CodeBuild minutes), significantly more setup, less intuitive than GitHub Actions. Not worth it at this scale.

---

## Option 4 — CDK Pipelines (self-mutating)

A CDK construct that creates a CodePipeline that can update itself when CDK code changes. Overkill for a two-environment solo project.

---

## Recommendation

**Pre-launch:** Keep doing manual `cdk deploy`. Fast, well-understood, and iteration is rapid.

**After soft launch:** Set up GitHub Actions on golfsync-api and golfsync-web:

1. Push to `main`
2. GitHub Actions builds and pushes the new image to ECR
3. `aws ecs update-service --force-new-deployment` triggers a rolling swap (zero downtime — ECS drains the old task while starting the new one)

CDK deploys (infrastructure changes) stay manual — they're infrequent and should be reviewed before running.

---

## When Ready to Implement GitHub Actions

Ask Claude to set up the GitHub Actions workflows for golfsync-api and golfsync-web. Key things it will need to do:

- Configure AWS OIDC trust in the CDK stack (one-time IAM role)
- Create `.github/workflows/deploy.yml` in each repo
- Store ECR repo URIs and cluster/service names as GitHub Actions secrets or env vars
