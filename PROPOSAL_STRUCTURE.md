# GWE SolarPulse — Real-Time Solar Monitoring Platform

## 1. Executive Summary

A centralized, real-time solar PV monitoring dashboard that aggregates data from Solarman-compatible inverters and dataloggers across multiple plant sites. Delivers live power flows, historical energy analytics, alarm management, and automated reporting via a single pane of glass.

---

## 2. Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Solarman API   │────▶│  Sync Engine     │────▶│  Database Layer │
│  (3rd Party)    │     │  (Cloud Service) │     │  (Time-Series)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Frontend App   │◀────│  API Gateway     │◀────│  Live Stream    │
│  (Web/Mobile)   │     │  (REST + SSE)    │     │  (Server-Sent)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

**Key difference from conventional approaches:**  
Most solar monitoring tools poll on fixed intervals, introducing latency and API rate limits. Our sync engine uses a proprietary adaptive polling strategy combined with an event-streaming layer that pushes updates to the UI in real time without WebSocket overhead. The database schema is optimized for time-series queries without requiring a separate TSDB — keeping infrastructure costs low while maintaining sub-second query performance on year-long histories.

---

## 3. Core Modules

### 3.1 Data Acquisition Layer
- **Solarman API Client** — Custom HTTP client with automatic token rotation, request retry with exponential backoff, and payload normalization across v1/v2 endpoints.
- **Multi-Protocol Adapter** — Abstraction layer that normalizes Solarman's disparate response shapes (stations, inverters, loggers, alarms) into a unified internal model.
- **Adaptive Sync Scheduler** — Dynamic polling intervals based on plant activity level; idle plants poll less frequently, active plants poll more aggressively.

### 3.2 Storage Engine
- **Unified Document Schema** — Single collection for plant-level data with embedded live metrics; avoids expensive joins and keeps read paths efficient.
- **Rollup Aggregator** — On-write data rollups for hourly, daily, monthly, yearly views — eliminating the need for a separate analytics pipeline.
- **Cache Layer** — In-memory hot cache for live dashboard values; cold storage for historical lookups.

### 3.3 API & Streaming
- **RESTful Endpoints** — CRUD operations for plants, devices, alarms, and energy data.
- **Server-Sent Events (SSE)** — Lightweight real-time push to all connected dashboards without polling or WebSocket infrastructure.
- **Alert Webhook** — Configurable outbound hooks for alarm notifications (email, SMS, Slack).

### 3.4 Frontend Dashboard
- **Modular Component System** — Dashboard, Plants Map, Device Tree, Analytics Charts, Alarm Console, Report Builder.
- **Live Data Grid** — Auto-updating table with per-plant metrics (generation, consumption, battery, grid).
- **Charting Engine** — Multi-period energy bar charts (daily, monthly, yearly) with zoom and export.
- **Collapsible Navigation** — Responsive sidebar with iframe-based page isolation for modular development.

---

## 4. Implementation Phases

### Phase 1 — Foundation (Weeks 1–3)
- API client setup & authentication bridge
- Core data models & storage layer
- Basic sync pipeline (plants + real-time)
- Single-plant dashboard

### Phase 2 — Real-Time & Analytics (Weeks 4–6)
- SSE streaming infrastructure
- Historical energy rollups
- Multi-period charting
- Device-level drill-down

### Phase 3 — Alarms & Reporting (Weeks 7–9)
- Alarm ingestion & deduplication
- Push notifications
- PDF/CSV report generation
- Export workflows

### Phase 4 — Hardening & Scale (Weeks 10–12)
- Rate-limit handling & token lifecycle
- Multi-tenant isolation
- Performance optimization
- Deployment & monitoring

---

## 5. Technical Considerations

| Area | Challenge | Our Approach |
|------|-----------|-------------|
| **Auth** | Solarman tokens expire silently | Auto-extraction + refresh pipeline (patent-pending heuristic) |
| **API Limits** | 15 req/min per token | Multi-token pool with intelligent routing |
| **Data Inconsistency** | Different response shapes per endpoint | Schema normalization layer with smart merging |
| **Real-Time** | Polling is wasteful | SSE push from in-memory state store |
| **History** | MongoDB isn't ideal for time-series | Embedded rollup technique (no extra DB needed) |
| **Offline** | Network interruptions | Local buffering + reconciliation on reconnect |

---

## 6. Deliverables

- Fully functional web dashboard deployed on a private server
- Real-time data sync (every 5 min or configurable)
- Historical energy analytics (daily, monthly, yearly views)
- Alarm console with live updates
- Admin panel for plant/device management
- API documentation & integration guide
- Source code repository with deployment scripts

---

## 7. Commercial Terms

- **Timeline:** 12 weeks from kickoff
- **Deliverable Format:** Deployed instance + private Git repository
- **Post-Launch Support:** 2 months included (bug fixes, data corrections)
- **Training:** 2 sessions for operations team
- **Exclusivity:** Platform built specifically for GWE's monitoring needs

---

*Note: This document outlines the high-level approach. Implementation details, proprietary algorithms, and critical integration paths are covered under separate technical specification.*
