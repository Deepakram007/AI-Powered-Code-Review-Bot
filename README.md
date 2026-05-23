# AI-Powered Code Review Bot 🤖🚀

An automated, enterprise-grade GitHub App that reviews pull requests using AI, enforces organization-specific rules, learns from developer feedback, and sends notifications to Slack. 

Built using a scalable, multi-tenant **Node.js, TypeScript, Express, BullMQ, Redis, and PostgreSQL** stack.

---

## 🏗️ Architecture & Decoupled Execution

The system uses an asynchronous **producer-consumer queue architecture** built on top of **BullMQ** and **Redis**. This decouples the webhook ingestion from the heavy LLM analysis and database writes:

```
                  ┌──────────────────────┐
                  │   GitHub Webhook     │
                  └──────────┬───────────┘
                             │ (HMAC-SHA256 Signature verified)
                             ▼
                  ┌──────────────────────┐
                  │    Express Server    │ (Fast Response <10ms)
                  └──────────┬───────────┘
                             │
                             ▼
                    [ webhook-queue ]
                             │
                             ▼
                  ┌──────────────────────┐
                  │    webhookWorker     │
                  └──────────┬───────────┘
                             │ (Determines Event Type)
                             ▼
                    [  review-queue ] ◄─────── [ usageService ]
                             │                 (Limits & Quota check)
                             ▼
                  ┌──────────────────────┐
                  │     reviewWorker     │ ◄─────── [ aiService ]
                  └──────────┬───────────┘          (Diff Batcher / Prompter)
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌──────────────────────┐            ┌──────────────────────┐
│  GitHub PullRequest  │            │    [ slack-queue ]   │
│  (Comments Posted)   │            └──────────┬───────────┘
└──────────────────────┘                       ▼
                                    ┌──────────────────────┐
                                    │     slackWorker      │
                                    └──────────────────────┘
```

---

## ⚡ Key Capabilities

### 🛡️ Multi-Tenant SaaS DB Model
The database tracks multiple organizations (`Organizations` table) separately. Each tenant gets its own configuration of guidelines (`TeamRule`), PR review tracking, and monthly quota limits (`UsageTracking`).

### 💰 Cost-Optimized AI Engine
- **Intelligent File Filtering**: Excludes dependency locks (`package-lock.json`), binaries, media formats, and environment files before sending to the LLM.
- **Hunk-Based Parsing**: Uses a custom unified patch parser to only extract changed and added line blocks.
- **Batched Reviews**: Consolidates modified files in a single LLM prompt, reducing token consumption.
- **Line Validation**: Validates AI recommendations against modified line arrays to prevent comment post errors on unchanged code blocks.

### 🧠 Developer Sentiment Feedback Loop
- Evaluates replies to the bot's review comments on GitHub.
- Uses sentiment analysis to classify developer feedback as `APPROVED` (agreed/fixed) or `REJECTED` (disagreed/false positive).
- Feedback is fed into future prompts as few-shot training examples, helping the bot adapt to team-specific preferences over time.

---

## 🛠️ Tech Stack
- **Core runtime:** Node.js, TypeScript (v5+)
- **HTTP Routing:** Express, CORS, Morgan
- **ORM & Database:** Prisma, PostgreSQL
- **Background Queues:** BullMQ, Ioredis (Redis)
- **API Clients:** Octokit (GitHub API), OpenAI (structured JSON completions)
- **Validation:** Zod (Type-safe env validation)

---

## ⚙️ Configuration Setup

Create a `.env` file in the root directory using the keys below:

```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/review_bot?schema=public"
REDIS_URL="redis://localhost:6379"
NODE_ENV="development"

# OpenAI Keys
OPENAI_API_KEY="your-openai-api-key"
OPENAI_MODEL="gpt-4o-mini"

# GitHub App Integration
GITHUB_APP_ID="your-github-app-id"
GITHUB_PRIVATE_KEY="base64-encoded-private-key"
GITHUB_WEBHOOK_SECRET="your-github-webhook-secret"

# Slack Notification Webhook
SLACK_WEBHOOK_URL="your-slack-webhook-url"
```

---

## 🚀 Running the Platform

### Prerequisites
- Node.js (>= 18)
- Docker & Docker Desktop (Make sure the **Docker Desktop application is running** on your system to connect to the daemon)

### Step 1: Spin up PostgreSQL and Redis Databases
Launch local Docker containers for storage:
```bash
docker-compose up db redis -d
```

### Step 2: Install Packages & Generate Types
```bash
npm install
npm run prisma:generate
```

### Step 3: Run Database Migrations
Create the tables and indices in PostgreSQL:
```bash
npm run prisma:migrate
```

### Step 4: Run Application
- **Development Mode (Hot Reload):**
  ```bash
  npm run dev
  ```
- **Production Mode (Compiled):**
  ```bash
  npm run build
  npm start
  ```

---

## 📡 REST API Reference

### Health Diagnostics
- `GET /health` — Returns status of Postgres and Redis connections.

### Team Rules Rules Engine
- `GET /api/rules?organizationId=<id>` — Fetch rules configured for the organization.
- `POST /api/rules` — Register a new rule block.
- `PUT /api/rules/:id` — Update rule criteria/state.
- `DELETE /api/rules/:id` — Delete rule configuration.

### Metrics & Sentiment History
- `GET /api/feedback/stats` — Review count aggregates and accuracy metrics.
- `GET /api/feedback/history` — Paginated history of developer sentiment classification logs.

### Billing & Subscription Management
- `GET /api/billing/usage/:orgId` — Check organization monthly PR reviews usage vs subscription limits.
- `POST /api/billing/tier/:orgId` — Update organization plan (`FREE`, `PRO`, or `ENTERPRISE`).

### Security Audit Trails
- `GET /api/audit/:orgId` — Returns tenant action history logs for compliance monitoring.
