# CRM Prospection Platform

Full-stack CRM platform for managing field prospection teams, with real-time dashboards, a probabilistic scoring engine, and comprehensive lead tracking.

---

## Overview

This platform covers the full lifecycle of field prospection: from lead assignment and real-time KPI monitoring to gamified performance tracking and cartographic visualization. It's built around a clean architecture with DDD principles, designed to scale across large teams operating in the field.

---

## Tech Stack

**Backend**
- NestJS
- GraphQL (Code-First) with Apollo Server
- Prisma ORM
- PostgreSQL
- Redis

**Frontend**
- React / Next.js
- TanStack Query
- Tailwind CSS + ShadCN/UI
- Mapbox (cartographic integration)

**Auth**
- Keycloak SSO
- JWT / OAuth2
- Role-Based Access Control (RBAC)

**Mobile**
- React Native + Expo (companion field app)

**Infrastructure**
- Docker
- GitHub Actions (CI/CD)
- Sentry (error monitoring)

---

## Features

- ~130 GraphQL endpoints across 12 resolvers
- 15 Prisma data models covering the full prospection domain
- Probabilistic scoring dashboard with Redis-optimized performance
- Real-time prospection KPI tracking per agent and team
- Cartographic integration with Mapbox for territory visualization
- Gamification system: badges, leaderboards, and agent evaluations
- Audio listening module via LiveKit
- RGPD-compliant data handling
- Clean Architecture with Domain-Driven Design principles

---

## Architecture

The backend follows a modular NestJS structure organized by domain. Each module exposes a GraphQL resolver, a service layer, and Prisma-backed repositories. The frontend consumes the API through TanStack Query with typed GraphQL operations.

Authentication flows through Keycloak, with JWT tokens validated at the API gateway level and RBAC enforced per resolver.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL
- A running Keycloak instance

### Setup

```bash
# Clone the repo
git clone https://github.com/HatimBenzahra/crm-prospection-web.git
cd crm-prospection-web

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start services
docker compose up -d

# Run database migrations
npx prisma migrate dev

# Start the dev server
npm run dev
```

---

## Project Structure

```
.
├── apps/
│   ├── api/          # NestJS backend (GraphQL, Prisma)
│   └── web/          # Next.js frontend
├── packages/
│   └── shared/       # Shared types and utilities
├── prisma/
│   └── schema.prisma # 15 data models
└── docker-compose.yml
```

---

## License

Private. All rights reserved.
