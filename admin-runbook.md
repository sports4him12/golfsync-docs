# GolfSync — Admin & Troubleshooting Runbook

**Audience:** Admin operators responding to user issues or system alerts  
**Last updated:** 2026-04-09

---

## Quick Reference

| What you need | Where to look |
|---|---|
| All API errors | CloudWatch → `/golfsync-prod/api` |
| DB migration output | CloudWatch → `/golfsync-prod/liquibase` |
| Error rate alarm | CloudWatch Alarms → `golfsync-prod-api-error-rate` |
| Admin dashboard | `https://golfsync.com/admin` (ADMIN role required) |
| Admin API | `GET /api/admin/analytics`, `GET /api/admin/users` |
| Health check | `GET /api/courses` → 200 means API is up |
| Live container shell | `aws ecs execute-command` (see §9) |

---

## 1. CloudWatch Log Groups

All logs are structured and shipped via the AWS Logs driver on the ECS task.

| Log Group | What's in it | Retention |
|---|---|---|
| `/golfsync-prod/api` | All Spring Boot output — requests, errors, Stripe events, email sends, Camunda | 90 days |
| `/golfsync-dev/api` | Same for dev stack | 30 days |
| `/golfsync-prod/liquibase` | Liquibase migration runs — schema change history | 90 days |
| `/golfsync-dev/liquibase` | Same for dev stack | 30 days |

**Log stream naming:** `api/<task-id>` within each log group. Each ECS task start creates a new stream. Filter by time to scope to the incident window.

### Navigating to logs

1. AWS Console → **CloudWatch** → **Log groups**
2. Open `/golfsync-prod/api`
3. Click **Search log group** (top right)
4. Set time range to the incident window
5. Enter a filter pattern (see §2 for patterns)

### Useful CloudWatch Insights queries

```sql
-- All ERROR-level events in the last hour
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100

-- Errors for a specific user email
fields @timestamp, @message
| filter @message like /user@example.com/
| sort @timestamp desc

-- Stripe webhook events
fields @timestamp, @message
| filter @message like /checkout.session/ or @message like /invoice./ or @message like /subscription/
| sort @timestamp desc

-- Payment failures
fields @timestamp, @message
| filter @message like /invoice.payment_failed/ or @message like /payment failed/
| sort @timestamp desc

-- Email send failures
fields @timestamp, @message
| filter @message like /Failed to send/ or @message like /MailException/
| sort @timestamp desc

-- Rate limit hits (429 responses)
fields @timestamp, @message
| filter @message like /429/ or @message like /Rate limit/
| sort @timestamp desc
```

---

## 2. CloudWatch Alarm

**Alarm name:** `golfsync-prod-api-error-rate`  
**Trigger:** 5 or more ERROR-level log events in any 5-minute window  
**Action:** SNS → email to `GOLFSYNC_PROD_ALARM_EMAIL`

When this alarm fires, go to `/golfsync-prod/api` and filter by `ERROR` in the 5-minute window that triggered it.

---

## 3. Issue: User Cannot Log In

### Symptoms
- User reports "Invalid credentials" error
- User reports being locked out

### Steps

**1. Check if the account exists:**
```
GET /api/admin/users
```
Find the user by email in the response list. Confirm `banned`, `role`, `trialExpiresAt`, `membershipTier`, `membershipExpiresAt`.

**2. Check for ban:**
Look for `"banned": true` on the user record. If banned, either the user was manually banned by an admin or reported and actioned. Check `/api/admin/user-reports` for context.

To unban via admin API:
```
PATCH /api/admin/users/{userId}
Body: { "banned": false }
```

**3. Check for password expiry:**
Passwords expire every 90 days (`golfsync.password.expiry-days`). The user will see "PASSWORD_EXPIRED" with HTTP 401. Direct them to `/change-password`.

**4. Search logs for login attempt:**
```sql
-- In CloudWatch Insights on /golfsync-prod/api
fields @timestamp, @message
| filter @message like /user@example.com/ and @message like /login/
| sort @timestamp desc
```

Look for `"Invalid credentials"` or `ForbiddenException: This account has been suspended.`

---

## 4. Issue: User Can't Access Features (Trial / Membership)

### Symptoms
- User sees "Your free access period has ended" banner
- User gets 403 responses from the API
- User reports being locked out after paying

### Error codes returned by the API (HTTP 403)

| Code | Meaning |
|---|---|
| `TRIAL_EXPIRED` | 30-day trial lapsed, no paid membership |
| `MEMBERSHIP_REQUIRED` | No trial set (unusual legacy path) |
| `FORBIDDEN` | Account banned or insufficient role |

### Steps

**1. Check user's membership state:**
```
GET /api/admin/users  → find user → check fields:
  trialExpiresAt      — when the trial ends
  membershipTier      — FREE / MONTHLY / ANNUAL
  membershipExpiresAt — when paid membership expires
  stripeCustomerId    — links to Stripe dashboard
  stripeSubscriptionId
```

**2. User paid but access not granted:**

Check CloudWatch for the Stripe `checkout.session.completed` webhook:
```sql
fields @timestamp, @message
| filter @message like /checkout.session.completed/ and @message like /user@example.com/
| sort @timestamp desc
```

If the webhook was received, you'll see:
```
checkout.session.completed: provisioned MONTHLY for user@example.com (expires ...)
```

If no log entry exists, the webhook was never received. Check the Stripe dashboard:
- Stripe Dashboard → Developers → Webhooks → Endpoint `https://golfsync.com/api/payments/webhook`
- Look for failed delivery attempts and re-send manually

**3. Manually activate membership:**
If Stripe webhook failed and the user has a confirmed payment, activate via admin API:
```
POST /api/admin/users/{userId}/membership
Body: { "plan": "MONTHLY", "paymentIntentId": "pi_..." }
```

**4. Extend trial manually:**
```
PATCH /api/admin/users/{userId}
Body: { "trialExpiresAt": "2026-05-31T23:59:59" }
```

---

## 5. Issue: User Not Receiving Emails

### Symptoms
- User never got the welcome email
- Password reset email not arriving
- Marketing drip emails stopped

### Steps

**1. Check email send logs:**
```sql
-- CloudWatch Insights on /golfsync-prod/api
fields @timestamp, @message
| filter @message like /user@example.com/ and (@message like /email/ or @message like /mail/ or @message like /send/)
| sort @timestamp desc
```

Successful send looks like:
```
Reminder email sent to user@example.com for tournament '...' (3d away)
```

Failure looks like:
```
Failed to send reminder email to user@example.com: <SMTP error message>
```

**2. Check for email marketing opt-out:**
The user may have opted out of marketing emails. Check their record:
```
GET /api/admin/users → find user → check emailMarketingOptOut: true
```
If opted out, trial drip and marketing emails are silently skipped (by design — CAN-SPAM compliance). This is expected behavior. Transactional emails (payment confirmation, payment failed, subscription cancelled) are NOT affected by opt-out.

**3. Check SES sending limits (prod):**
- AWS Console → SES → Account dashboard → Sending statistics
- If in sandbox mode, only verified addresses can receive emails
- If daily sending quota is hit, emails queue and drop

**4. Check SMTP credentials (dev — Gmail):**
```bash
aws secretsmanager get-secret-value \
  --secret-id golfsync-dev/gmail-smtp-credentials \
  --query SecretString --output text
```
Gmail app passwords expire or get revoked if 2FA settings change. Regenerate at: Google Account → Security → App passwords.

**5. Check drip email bitmask:**
The drip sequence uses a bitmask (`dripEmailsSentMask`) to track which emails were sent. If a bit is set, that email will never send again even if timing conditions are met.

| Bit | Email | Day |
|---|---|---|
| 0x01 | Welcome + feature tour | Day 0 |
| 0x02 | Friend nudge | Day 3 |
| 0x04 | Round nudge | Day 7 |
| 0x08 | Trial ending soon | Day 21 |
| 0x10 | Last-chance personalized | Day 27 |

---

## 6. Issue: Payment / Billing Problems

### Symptoms
- User charged but no membership granted
- User cancelled but still being charged
- "Stripe is not configured" error

### Steps

**1. Check Stripe webhook delivery:**
Stripe Dashboard → Developers → Webhooks → `https://golfsync.com/api/payments/webhook`

Events to look for:
- `checkout.session.completed` — subscription provisioned
- `invoice.paid` — renewal extended
- `invoice.payment_failed` — payment failed (email sent, access NOT revoked — Stripe retries)
- `customer.subscription.deleted` — access revoked, cancellation email sent

**2. Search for webhook processing in logs:**
```sql
fields @timestamp, @message
| filter @message like /\[evt_/ or @message like /invoice.paid/ or @message like /subscription.deleted/
| sort @timestamp desc
```

Each webhook is logged with its Stripe event ID (`[evt_...]`) for traceability.

**3. "Stripe is not configured" error:**
This means `stripe.secret-key` is blank. Check:
```bash
aws secretsmanager get-secret-value \
  --secret-id golfsync-prod/stripe-secret-key \
  --query SecretString --output text
```
If it still shows `REPLACE_WITH_STRIPE_SECRET_KEY`, the key was never populated. Follow the billing activation checklist in `AWS_DeploymentGuide.md`.

**4. User's subscription cancelled but tier not downgraded:**
Check logs for `customer.subscription.deleted` with the user's Stripe customer ID. If missing, look up the Stripe customer ID from the user record and search logs by that ID.

---

## 7. Issue: API Returning 5xx Errors

### Steps

**1. Check ECS service health:**
```bash
aws ecs describe-services \
  --cluster golfsync-prod \
  --services ApiService \
  --query 'services[0].{running:runningCount,desired:desiredCount,deployments:deployments}'
```

**2. Check ALB health check:**
- AWS Console → EC2 → Target Groups → `golfsync-prod-ApiTg`
- Look for targets with status **unhealthy**
- Health check path: `GET /api/courses` → must return 200

**3. Check for OOM / container crash:**
```bash
aws ecs describe-tasks \
  --cluster golfsync-prod \
  --tasks $(aws ecs list-tasks --cluster golfsync-prod --service-name ApiService --query 'taskArns' --output text)
```
Look for `stopCode: EssentialContainerExited` or `OutOfMemoryError` in the logs.

**4. Search logs for exceptions:**
```sql
fields @timestamp, @message
| filter @message like /Exception/ or @message like /INTERNAL_ERROR/
| sort @timestamp desc
| limit 50
```

**5. Check RDS connectivity:**
```sql
fields @timestamp, @message
| filter @message like /Unable to acquire JDBC/ or @message like /Communications link failure/
| sort @timestamp desc
```
If RDS connection errors appear, check:
- RDS instance status: AWS Console → RDS → `golfsync-prod-GolfSyncDb`
- Security group: `RdsSg` must allow port 3306 from `ApiSg`

---

## 8. Issue: Rate Limit Complaints (User Getting 429)

### Rate limits in place

| Endpoint group | Limit | Scope |
|---|---|---|
| Auth (`/api/auth/**`) | 10 req/min | Per IP |
| AI assistant (`/api/ai/**`) | 5 req/min | Per user |
| Search (`/api/courses/search`, `/api/tournaments/search`) | 30 req/min | Per IP |
| Tee times (`/api/tee-times/**`) | 10 req/min | Per IP |

### Steps

**1. Confirm it's a rate limit:**
HTTP 429 response with body `{ "error": "Too Many Requests" }`.

**2. Check logs:**
```sql
fields @timestamp, @message
| filter @message like /429/ or @message like /rate limit/ or @message like /Too Many Requests/
| sort @timestamp desc
```

**3. Legitimate user hitting AI limit:**
The 5/min AI cap is intentional (cost control). If a specific user needs a higher limit for a valid reason, the rate limit configuration is in `application.properties` (`golfsync.rate-limit.*`). Changes require redeployment.

**4. Suspicious traffic (bot / scraper):**
If a single IP is hammering endpoints, escalate to WAF configuration or block at the ALB security group level.

---

## 9. ECS Exec — Shell Access to Live Container

Use when you need to inspect the running container directly (check env vars, test DB connectivity, read logs inline).

```bash
# Get the running task ID
TASK_ID=$(aws ecs list-tasks \
  --cluster golfsync-prod \
  --service-name ApiService \
  --query 'taskArns[0]' --output text | awk -F/ '{print $NF}')

# Open a shell
aws ecs execute-command \
  --cluster golfsync-prod \
  --task $TASK_ID \
  --interactive \
  --command "/bin/sh"
```

Inside the container you can:
```bash
# Test DB connectivity
curl -sf http://localhost:8080/api/courses && echo "API healthy"

# Check env vars (redacted in real output)
env | grep STRIPE
env | grep SPRING_MAIL

# Check Java heap
ps aux | grep java
```

**Dev cluster:** replace `golfsync-prod` with `golfsync-dev` and `ApiService` with the dev service name.

---

## 10. Reporting / Admin Dashboard

The admin panel at `/admin` (requires ADMIN role) surfaces:

- **Analytics:** signups/day, trial→paid conversions, active trials, churn, round creation rate
- **Users:** full user list with membership state
- **Rounds:** all rounds across all users
- **Tournament reports:** user-submitted reports
- **User reports:** reported accounts
- **Promo codes:** create / list
- **Featured content:** promoted courses and tournaments
- **Camunda tasks:** pending BPMN workflow tasks

### Promoting a user to ADMIN role

Currently requires a direct database update. Use ECS Exec to connect, or run from a bastion:
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@golfsync.com';
```

### Banning a user

```
PATCH /api/admin/users/{userId}
Body: { "banned": true }
```

Banned users receive HTTP 403 `"This account has been suspended."` on login.

---

## 11. Database — Direct Access

Use only for read-only investigation. Never write directly to production without a Liquibase migration.

```bash
# Get RDS endpoint
aws rds describe-db-instances \
  --db-instance-identifier golfsync-prod-GolfSyncDb \
  --query 'DBInstances[0].Endpoint.Address' --output text

# Get credentials from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id golfsync-prod/db-credentials \
  --query SecretString --output text | python3 -m json.tool
```

Key tables for user issue investigation:

| Table | Purpose |
|---|---|
| `users` | Account state — role, trial, membership, Stripe IDs, ban status, opt-out |
| `user_events` | Funnel events — trial_started, first_round_created, trial_converted, etc. |
| `rounds` / `round_players` | Round and invite state |
| `friend_requests` | Pending/accepted friend relationships |
| `messages` | Group chat messages per round |
| `availability_polls` | Availability poll data |
| `subscriptions` | (Stripe subscription state mirrored on `users` table) |

```sql
-- Full user state
SELECT id, email, username, role, banned,
       trial_expires_at, membership_tier, membership_expires_at,
       stripe_customer_id, stripe_subscription_id,
       email_marketing_opt_out, drip_emails_sent_mask, created_at
FROM users WHERE email = 'user@example.com';

-- Funnel events for a user
SELECT event_type, created_at FROM user_events
WHERE user_id = <id> ORDER BY created_at;

-- Rounds a user is part of
SELECT r.id, r.course_name, r.status, rp.status as player_status
FROM rounds r
JOIN round_players rp ON rp.round_id = r.id
JOIN users u ON u.id = rp.user_id
WHERE u.email = 'user@example.com'
ORDER BY r.created_at DESC;
```

---

## 12. Liquibase Migration Failures

If the API fails to start and CloudWatch shows migration errors:

**1. Check migration logs:**
CloudWatch → `/golfsync-prod/liquibase` → most recent stream

Look for:
```
Caused by: liquibase.exception.LockException: Could not acquire change log lock
```
This means a previous migration run didn't release the lock. Fix:
```sql
DELETE FROM DATABASECHANGELOGLOCK WHERE ID = 1;
```

**2. Re-run the Liquibase task:**
The Liquibase run command is output by CDK as `LiquibaseMigrateCommand` after every deploy. Re-run it:
```bash
aws ecs run-task \
  --cluster golfsync-prod \
  --task-definition golfsync-prod-LiquibaseTaskDef:<revision> \
  --network-configuration "awsvpcConfiguration={subnets=[<subnet-id>],securityGroups=[<sg-id>]}"
```

---

## 13. Escalation Checklist

When a user contacts support:

1. Get their **email address** and the **approximate time** the issue occurred
2. Search `/golfsync-prod/api` CloudWatch logs for their email in that window
3. Check their user record via `GET /api/admin/users` (membership state, ban, opt-out)
4. Check Stripe dashboard if payment-related
5. Check SES sending statistics if email-related
6. If the issue is a data corruption or requires a direct DB fix, use ECS Exec + MySQL to investigate, and never write without a migration

**Support email (current):** `ryanrpick@gmail.com`  
**Permanent address (planned):** `support@golfsync.com` — update before public launch
