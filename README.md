# 🤖 Blastradius

> A Requirement Compliance Engine for GitHub PRs.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)
[![Built with Gemini](https://img.shields.io/badge/AI-Gemini%202.5--Flash-orange.svg)](https://ai.google.dev/)

<img width="720" height="406" alt="Video Project 7" src="https://github.com/user-attachments/assets/f7e1c161-e0d1-4a8d-a0a5-3a2ed48371ed" />

---

## 💡 The Problem
Most AI code reviewers act as noisy linter extensions—focusing on syntax, typos, and formatting. But the real engineering danger lies in **architectural divergence** and **unintended downstream side effects**.

When a developer changes a harmless-looking analytics file and it silently touches a core authentication module, traditional tools miss the intent gap.

**Blastradius** is a **Requirement Compliance Engine** that proves whether a Pull Request satisfies the business requirements (via Linear API) and maps the exact AST structural impact (via `ts-morph`) to identify unintended side effects *before* code gets merged.

`Ticket Intent + AST Dependency Graph + PR Diff = Blast Radius Report`

---

## ⚙️ How It Works

Here is the deterministic pipeline that executes on every pull request event:

```mermaid
sequenceDiagram
    participant GH as GitHub Pull Request
    participant WH as Webhook Server (Docker)
    participant LN as Linear API
    participant AST as AST Walker (ts-morph)
    participant GM as Gemini LLM
    
    GH->>WH: Webhook Event (PR Open/Reopen)
    WH->>WH: Extract Linear Issue ID (e.g. BOT-1)
    WH->>LN: Fetch Ticket Title & Description
    LN-->>WH: Return Intent Data
    WH->>WH: Secure Ephemeral git clone (Depth 1)
    WH->>AST: Run AST Static Reference Analysis
    AST-->>WH: Return Modified Symbols & Affected Files
    WH->>GM: Compare Intent vs. Blast Radius (JSON Schema)
    GM-->>WH: Return Divergence & Reasoning
    WH->>GH: Post PR Review Comment
    WH->>WH: Clean up Temp Directories
```

---

## 🚀 Quick Start (Self-Hosted)

Deploy the bot in under 5 minutes using Docker Compose.

### 1. Prerequisites
Ensure you have **Docker** and **Git** installed on your server.

### 2. Configure Environment Variables
Create a `.env` file in the root directory:

```env
# GitHub App Configuration
GITHUB_APP_ID=your_app_id
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

# Integration API Keys
LINEAR_API_KEY=your_linear_api_key
GEMINI_API_KEY=your_gemini_api_key

# Settings
PORT=3000
```

### 3. Deploy
Launch the container:

```bash
docker-compose up -d --build
```

---

## 📊 Self Hosted vs Cloud

| Feature | Self-Hosted (Free) | Cloud (SaaS) |
| :--- | :--- | :--- |
| **Price** | **$0** (Free forever) | **$19/month** (Pro) |
| **Setup** | Manual (Docker + Server) | Instant (Click-to-Install) |
| **API Keys** | Use your own | Managed (No setup required) |
| **Security** | Runs inside your VPC | Secure TLS |
| **Multi-Repo Dashboard** | No | Yes |
| **Slack Notifications** | No | Yes |

---

## 🗺️ Roadmap

- [x] Ephemeral git clone pipeline
- [x] Deterministic AST symbol-traversal using `ts-morph`
- [x] Intent comparison using Gemini 2.5 Flash with JSON Schema
- [ ] Slack/Discord alert integrations
- [ ] No-code landing page + SaaS dashboard
- [ ] Support for Python and Go AST walking
