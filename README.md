# 🤖 Kodetama Bot

**Personal Finance Assistant for Telegram** — A conversational bot that helps Indonesian users track their finances using natural language.

---

## 📌 Project Overview

Kodetama Bot is a **Telegram-based personal finance management system** that allows users to log transactions using casual Indonesian language (e.g., `makan 20rb`, `gaji 8jt`). The bot uses AI (via OpenRouter) to parse natural language into structured financial data.

### Key Features

- **Natural Language Transaction Parsing** — Log expenses/income with Indonesian shorthand (`rb`, `jt`, `k`)
- **Budget Management (50/30/20 Rule)** — Track spending across Needs, Wants, and Savings buckets
- **Multiple Tiers** — `standard`, `pro`, `family` with different feature sets
- **Admin Approval Flow** — New registrations require admin approval
- **Google Integration** — OAuth for future Google Sheets export and Drive storage
- **Mini App Dashboard** — Web-based dashboard accessible from Telegram

---

## 🏗️ Architecture

This is a **pnpm monorepo** with the following structure:

```
KodetamaBot/
├── apps/
│   ├── bot/          # Telegram bot (grammY)
│   ├── api/          # REST API server (Hono)
│   └── web/          # Mini App dashboard (Vite + React)
├── packages/
│   ├── db/           # Database layer (Drizzle ORM + PostgreSQL)
│   ├── ai/           # AI/LLM integration (OpenRouter)
│   └── shared/       # Shared utilities (formatRupiah, types)
└── docker/           # Docker configurations
```

---

## 📦 Technology Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js 20+ |
| **Package Manager** | pnpm 8+ |
| **Language** | TypeScript |
| **Bot Framework** | [grammY](https://grammy.dev/) with conversations, hydrate, runner plugins |
| **API Framework** | [Hono](https://hono.dev/) |
| **Database** | PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/) |
| **AI** | OpenRouter API (GPT-4 Turbo, Claude, etc.) |
| **Frontend** | Vite + React + TailwindCSS |
| **Infrastructure** | Docker, Redis |

---

## 🗄️ Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts with tier (`standard`, `pro`, `family`) |
| `telegram_accounts` | Linked Telegram accounts (telegramId, username) |
| `date_periods` | Monthly budget periods (e.g., "Januari 2025") |
| `budgets` | Budget allocation per period (50/30/20 split) |
| `transactions` | Financial transactions with AI confidence scoring |
| `categories` | Transaction categories with bucket assignment |

### Family Tier

| Table | Purpose |
|-------|---------|
| `groups` | Telegram group for family budgeting |
| `family_members` | Group membership with roles |

### Google Integration

| Table | Purpose |
|-------|---------|
| `google_tokens` | OAuth tokens for Google API |
| `google_sheets` | Linked spreadsheets for export |
| `google_drive_folders` | Linked Drive folders for files |

### Other

| Table | Purpose |
|-------|---------|
| `pending_registrations` | Admin approval queue |
| `files` | Uploaded invoice files (Pro tier) |
| `voice_transcripts` | Voice message transcriptions (Pro tier) |
| `ai_usage` | Token usage tracking for cost monitoring |

---

## 🤖 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Start or register |
| `/help` | Usage help |
| `/budget` | View current month's budget (personal or group budget depending on context) |
| `/summary` | Transaction summary (personal or group transactions depending on context) |
| `/undo` | Cancel last transaction (within 5 minutes) |
| `/wallet` | View wallet balance (coming soon) |
| `/export` | Export to Google Sheets (coming soon) |
| `/cancel` | Cancel current conversation |

---

## 🧠 AI Integration

The `@kodetama/ai` package provides an `AIOrchestrator` class that handles:

### Available AI Operations

1. **`parseTransaction(message)`** — Parse casual Indonesian text into structured transaction data
   - Returns: `{ type, amount, description, category, bucket, confidence }`
   - Handles Indonesian shorthand: `rb/ribu`, `jt/juta`, `k`

2. **`generateBudgetSplit(income, context)`** — Smart 50/30/20 budget suggestions

3. **`generateMonthlySummary(periodName, transactions, budget)`** — Monthly financial insights (Pro tier)

4. **`streamResponse(systemPrompt, userMessage)`** — Streaming chat responses

### Prompts Location

`packages/ai/src/prompts/`
- `parseTransaction.ts` — Transaction parsing prompts
- `budgetSplit.ts` — Budget allocation prompts
- `monthlySummary.ts` — Monthly summary prompts

---

## 📁 Key Files

### Bot (`apps/bot/src/`)

| File | Purpose |
|------|---------|
| `index.ts` | Main bot entry, command handlers, message routing |
| `types.ts` | Bot context and session types |
| `handlers/transaction.ts` | Transaction message handler with AI parsing |
| `handlers/group.ts` | Group message handler (Family tier) |
| `handlers/admin.ts` | Admin approval callbacks |
| `conversations/registration.ts` | Registration flow |
| `conversations/onboarding.ts` | Onboarding/setup flow |
| `services/` | Business logic (user, budget, transaction, period) |

### API (`apps/api/src/`)

| File | Purpose |
|------|---------|
| `index.ts` | Hono server setup |
| `routes/auth.ts` | JWT authentication |
| `routes/users.ts` | User endpoints |
| `routes/transactions.ts` | Transaction CRUD |
| `routes/budgets.ts` | Budget management |
| `routes/google.ts` | Google OAuth flow |

### Database (`packages/db/src/`)

| File | Purpose |
|------|---------|
| `schema.ts` | Drizzle schema definitions |
| `client.ts` | Database client setup |
| `drizzle/` | Migrations directory |

---

## 🚀 Development

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL
- Redis (optional)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env
# Edit .env with your values

# Run database migrations
pnpm db:migrate

# Start development
pnpm dev:bot   # Start bot only
pnpm dev:api   # Start API only
pnpm dev:web   # Start web only
pnpm dev       # Start all
```

### Docker

```bash
pnpm docker:up      # Start containers
pnpm docker:down    # Stop containers
pnpm docker:build   # Rebuild
```

---

## 🔧 Environment Variables

See `.env.example` for all available options. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `ADMIN_TELEGRAM_ID` | Your Telegram user ID for approvals |
| `OPENROUTER_API_KEY` | For AI parsing |
| `OPENROUTER_MODEL` | Model to use (e.g., `openai/gpt-4-turbo`) |
| `GOOGLE_CLIENT_ID/SECRET` | For Google OAuth |
| `BOT_MODE` | `polling` (dev) or `webhook` (prod) |
| `VITE_DEV_TELEGRAM_ID` | Your Telegram ID for Web App local dev auth |

### Web App Development

To develop the Mini App locally without opening it inside Telegram:

1. Set `VITE_DEV_TELEGRAM_ID` in your `.env` file.
2. Run `pnpm dev:web` and `pnpm dev:api`.
3. Open `http://localhost:5173`.
4. The app will automatically authenticate using the dev ID.

---

## 💡 Indonesian Currency Parsing

The bot understands Indonesian number shorthand:

| Input | Parsed Amount |
|-------|---------------|
| `20rb` / `20ribu` | 20,000 |
| `1.5jt` / `1,5juta` | 1,500,000 |
| `500k` | 500,000 |

Examples:
- `makan 20rb` → Expense, 20,000, Food category
- `gaji 8jt` → Income, 8,000,000, Salary category
- `transfer ke mama 500k` → Transfer, 500,000

---

## 👨‍👩‍👧‍👦 Family Tier - Group Usage

For Family tier users, group transactions are parsed when the bot is mentioned in Telegram groups:

### Group Setup - Automatic Registration
1. Register individual family members with Family tier
2. Any Family tier user can trigger `/start` in an unregistered group to automatically create and register it
3. The user becomes the group owner, others can be added later
4. Add additional family members to the group (optional)

### Group Transaction Usage
- **Mention bot first**: `@botusername makan 20rb` or `botusername makan 20rb`
- **Same natural language**: Supports all Indonesian shorthand like private chats
- **Shared categories**: Transaction categories are shared at group level
- **Member attribution**: Each transaction tracks which family member logged it
- **Group budgets**: Transactions are associated with shared group budget periods

### Commands in Groups
- **Commands work everywhere**: `/start`, `/help`, `/budget` work in both private and group chats
- **Bot-specific commands**: In groups with multiple bots, use `/start@botname`, `/help@botname`, etc.
- **Registration/onboarding**: Can be done in groups, but private chat recommended for privacy
- **Group focus**: Groups are primarily for transaction logging to avoid spam

---

## 📊 User Tiers

| Tier | Features |
|------|----------|
| **Standard** | Basic transaction logging, budget tracking |
| **Pro** | Voice transcription, invoice upload, AI summaries |
| **Family** | Shared group budgets, multi-user tracking, group transaction parsing |

---

## 🔮 Planned Features

- [ ] Voice message transcription (Pro tier)
- [ ] Invoice/receipt upload with OCR (Pro tier)
- [ ] Google Sheets export
- [ ] Google Drive backup
- [ ] Wallet/account management
- [ ] Recurring transactions
- [ ] Financial insights and reports

---

## 📝 License

Private project.