# PyCode-SLM Research Dashboard

A professional AI research lab workspace for designing, documenting, and managing the development of a Python-focused Small Language Model (SLM).

![Dashboard Preview](https://placeholder.com/dashboard)

## Features

| Feature | Description |
|---------|-------------|
| **Project Overview** | Stats, progress bars, roadmap completion |
| **Roadmap Tracker** | 12-phase development roadmap with task checklists |
| **Documentation** | Markdown docs with code highlighting, tables, diagrams |
| **Dataset Manager** | Track datasets with filtering and metadata |
| **Experiment Tracker** | Training runs with loss curves and benchmark scores |
| **Model Versioning** | Track quantized model versions and deployments |
| **Research Notes** | Markdown notes with tagging and pinning |
| **Global Search** | Search across all content with keyboard shortcuts |
| **AI Chatbot** | Floating Gemini-powered assistant (bottom-right) |

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI**: Tailwind CSS + Radix UI components
- **Database**: Prisma ORM + Azure PostgreSQL
- **Charts**: Recharts
- **Markdown**: react-markdown + remark-gfm
- **AI**: Google Gemini 2.0 Flash

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Azure PostgreSQL
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"

# Google Gemini AI
GOOGLE_GEMINI_API_KEY=your_api_key_here
```

**Get a Gemini API key**: https://aistudio.google.com/apikey (free)

### 3. Set up the database

```bash
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database
npm run db:seed        # Seed with initial data
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Database Commands

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema changes |
| `npm run db:seed` | Seed with sample data |
| `npm run db:studio` | Open Prisma Studio |

## Project Structure

```
slm-research-dashboard/
├── app/
│   ├── page.tsx                    # Dashboard overview
│   ├── layout.tsx                  # Root layout with sidebar
│   ├── globals.css                 # Global styles
│   ├── roadmap/page.tsx            # Roadmap tracker
│   ├── docs/
│   │   ├── page.tsx                # Docs listing
│   │   └── [slug]/page.tsx         # Doc detail
│   ├── datasets/page.tsx           # Dataset manager
│   ├── experiments/page.tsx        # Experiment tracker
│   ├── models/page.tsx             # Model versions
│   ├── notes/page.tsx              # Research notes
│   └── api/
│       ├── roadmap/                # Roadmap CRUD
│       ├── datasets/               # Datasets CRUD
│       ├── experiments/            # Experiments CRUD
│       ├── notes/                  # Notes CRUD
│       ├── search/                 # Global search
│       └── chat/                   # Gemini AI chat
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   ├── dashboard/
│   │   └── global-search.tsx
│   ├── docs/
│   │   └── doc-content.tsx
│   └── chatbot/
│       └── chatbot-widget.tsx
├── lib/
│   ├── prisma.ts                   # Prisma client singleton
│   └── utils.ts                    # Utility functions
└── prisma/
    ├── schema.prisma               # Database schema
    └── seed.ts                     # Seed data
```

## Model Target Specifications

| Specification | Target |
|---------------|--------|
| Architecture | TinyLlama-1.1B (base) |
| Parameter Count | 300M–500M (post-optimization) |
| Training Method | QLoRA (4-bit, r=64) |
| Context Length | 4096 tokens |
| Quantized Size | ~700MB (GGUF Q4_K_M) |
| RAM Requirement | 2–4GB |
| HumanEval Target | ≥ 35% pass@1 |

## AI Chatbot

The floating chat button (bottom-right) opens a Gemini-powered assistant that:

- Answers questions about documentation
- Explains ML concepts (LoRA, QLoRA, quantization)
- Generates code examples
- Summarizes roadmap steps
- Provides context-aware answers using your docs

**Example queries:**
- "Explain LoRA fine-tuning"
- "Generate a data cleaning script"
- "What quantization method should I use?"
- "Summarize the training pipeline"

## Development

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # Lint code
```

## License

MIT
