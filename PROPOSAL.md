# Proposal: Persistent Solar Fleet Monitoring & Historical Analytics

**Prepared for:** GWE Operations & Engineering Team  
**From:** Divine Shedrack — Senior Software Engineer / AI Engineer  
**Collaborator:** Great Itodo — UI/UX / Frontend Developer  
**Subject:** Solving data volatility across multi-site solar PV installations

---

## The Problem You Are Facing

Your team manages solar plants across **multiple locations and different site areas**. You have a dashboard that shows live plant data — generation power, daily energy, battery status, grid interaction. It works in the moment.

But here is what happens in practice:

- **You open the dashboard, data is there.**
- **You close it. You open it again. The data is gone.**
- There is no record of what happened yesterday, last week, or last month.
- You cannot compare performance between sites.
- You cannot prove to stakeholders that a plant underperformed or exceeded expectations.
- When an issue occurs, you have no before-and-after data to diagnose root cause.
- Every visit to the dashboard starts from zero.

This is not a display problem. This is a **data persistence problem**. The information is transient. It flows in, it is shown momentarily, and it disappears. There is no memory.

### Current State vs. Target State

```
                    BEFORE (Current)                       AFTER (Proposed)
                    ═══════════════                       ═══════════════

┌──────────────┐                    ┌──────────────┐     ┌──────────────┐                    ┌──────────────┐
│  Solar Plant  │──── live data ────▶│   Dashboard   │     │  Solar Plant  │──── live data ────▶│  Sync Engine  │
│  (Solarman)   │                   │  (ephemeral)  │     │  (Solarman)   │                   │  (Persistent) │
└──────────────┘                    └──────────────┘     └──────────────┘                    └──────┬───────┘
       │                                                                                             │
       │    ┌───────────────────────────────────────┐               ┌────────────────────────────────┤
       │    │  ❌ Close browser → all data lost     │               │                                │
       │    │  ❌ No yesterday's data               │               ▼                                ▼
       │    │  ❌ No trend to analyse               │     ┌──────────────┐                  ┌──────────────┐
       │    │  ❌ Cannot compare sites              │     │  Database     │                  │  Dashboard    │
       │    │  ❌ No performance history            │     │  (Historical) │◀──── queries ────│  (Live + All  │
       │    └───────────────────────────────────────┘     └──────────────┘                  │   History)    │
                                                                                           └──────────────┘
                                                                                     ┌────────────────────────┐
                                                                                     │  ✅ Close browser →     │
                                                                                     │     data still there    │
                                                                                     │  ✅ Yesterday's data    │
                                                                                     │  ✅ Trends & analytics  │
                                                                                     │  ✅ Site comparisons     │
                                                                                     └────────────────────────┘
```

For a fleet operator, this means:

- **No accountability** — You cannot verify performance over time
- **No trend analysis** — You cannot spot degradation before it becomes a failure
- **No reporting** — Generating monthly or quarterly production reports requires manual collection or third-party tools
- **No audit trail** — If a dispute arises with an utility or an EPC contractor, there is no data to support your position
- **No operational intelligence** — You are flying blind beyond the current moment

This is the gap we identified. This is what we solved.

---

## Our Approach

We built a system that fundamentally changes how your plant data is handled. The core principle is simple:

> **Data should be captured once and available forever.**

Instead of relying on live-only views that refresh into emptiness, our solution introduces a persistent layer between your plants and your dashboard. This layer:

1. **Continuously collects data** from every plant at regular intervals — generation, consumption, battery, grid, alarms, device status
2. **Stores everything** in a structured, queryable format — nothing is discarded
3. **Serves historical data on demand** — daily trends, monthly aggregates, yearly comparisons
4. **Updates in real time** — new data flows in continuously without losing what came before
5. **Survives refreshes** — close the browser, open it tomorrow, everything is still there

The result: you get the live view you have now, **plus** the full historical record you have been missing.

### End-to-End Data Flow

```
 SOLARMAN API                        SYNC ENGINE                        DATABASE                          FRONTEND
 ═════════════                       ════════════                       ════════                          ════════

                    ┌──────────────────────────────┐
 ───────────────────│  1. Fetch Plant List         │
   POST /station/   │     (all stations)           │
   search           └─────────────┬────────────────┘
                                  │
                    ┌─────────────▼────────────────┐
 ───────────────────│  2. Fetch Real-Time Data     │
   POST /station/   │     (power, energy, status)  │
   realtime         └─────────────┬────────────────┘
                                  │
                    ┌─────────────▼────────────────┐
 ───────────────────│  3. Fetch Device Inventory  │
   POST /device/    │     (inverters, loggers)    │
   page             └─────────────┬────────────────┘
                                  │
                    ┌─────────────▼────────────────┐
 ───────────────────│  4. Fetch Device Telemetry  │
   POST /device/    │     (per-inverter metrics)  │
   currentData      └─────────────┬────────────────┘
                                  │
                    ┌─────────────▼────────────────┐
                    │  5. Normalize & Map Fields   │
                    │     (unify response shapes)  │
                    └─────────────┬────────────────┘
                                  │
                    ┌─────────────▼────────────────┐
                    │  6. Upsert to Database       │───── upsert ───▶  ┌──────────────────┐
                    │     (insert or update)       │                   │  Station Record  │
                    └─────────────┬────────────────┘                   │  Device Record   │
                                  │                                    │  Alarm Record    │
                                  │                                    └──────────────────┘
                                  │
                    ┌─────────────▼────────────────┐
                    │  7. Broadcast to Clients     │───── SSE push ──▶  ┌──────────────────┐
                    │     (live update all UIs)    │                    │  Dashboard UI    │
                    └──────────────────────────────┘                    │  (auto-refresh)  │
                                                                       └──────────────────┘
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────────────┐    ┌──────────────────────┐  │
│  │              │    │                      │    │                      │  │
│  │  Solarman    │◄──►│   ACQUISITION LAYER  │◄──►│   STORAGE LAYER     │  │
│  │  API         │    │                      │    │                      │  │
│  │  (External)  │    │  ┌────────────────┐  │    │  ┌────────────────┐  │  │
│  └──────────────┘    │  │ Sync Engine    │  │    │  │ MongoDB        │  │  │
│                      │  │                │  │    │  │ (Persistent)   │  │  │
│                      │  │ • Auth handler │  │    │  │                │  │  │
│                      │  │ • Rate limiter │  │    │  │ • Stations     │  │  │
│                      │  │ • Retry logic  │  │    │  │ • Devices      │  │  │
│                      │  │ • Normalizer   │  │    │  │ • Alarms       │  │  │
│                      │  └────────────────┘  │    │  └────────────────┘  │  │
│                      └──────────────────────┘    └──────────────────────┘  │
│                                                          │                 │
│                                                          ▼                 │
│                      ┌─────────────────────────────────────────────┐      │
│                      │           DELIVERY LAYER                    │      │
│                      │                                             │      │
│                      │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │      │
│                      │  │ REST API │  │ SSE Push │  │ Webhooks │  │      │
│                      │  └──────────┘  └──────────┘  └──────────┘  │      │
│                      └─────────────────────┬───────────────────────┘      │
│                                            │                               │
│                                            ▼                               │
│                      ┌─────────────────────────────────────────────┐      │
│                      │           PRESENTATION LAYER                │      │
│                      │                                             │      │
│                      │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │      │
│                      │  │Dashboard │  │Analytics │  │Alarms    │  │      │
│                      │  │ Live Grid│  │ Charts   │  │ Console  │  │      │
│                      │  └──────────┘  └──────────┘  └──────────┘  │      │
│                      └─────────────────────────────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Most solar monitoring tools poll on fixed intervals, introducing latency and API rate limits. Our sync engine uses a proprietary adaptive polling strategy combined with an event-streaming layer that pushes updates to the UI in real time without WebSocket overhead. The database schema is optimized for time-series queries without requiring a separate TSDB — keeping infrastructure costs low while maintaining sub-second query performance on year-long histories.

---

## Core Modules

### Data Acquisition Layer
- **Solarman API Client** — Custom HTTP client with automatic token rotation, request retry with exponential backoff, and payload normalization across v1/v2 endpoints
- **Multi-Protocol Adapter** — Abstraction layer that normalizes Solarman's disparate response shapes (stations, inverters, loggers, alarms) into a unified internal model
- **Adaptive Sync Scheduler** — Dynamic polling intervals based on plant activity level; idle plants poll less frequently, active plants poll more aggressively

### Storage Engine
- **Unified Document Schema** — Single collection for plant-level data with embedded live metrics; avoids expensive joins and keeps read paths efficient
- **Rollup Aggregator** — On-write data rollups for hourly, daily, monthly, yearly views — eliminating the need for a separate analytics pipeline
- **Cache Layer** — In-memory hot cache for live dashboard values; cold storage for historical lookups

### API & Streaming
- **RESTful Endpoints** — CRUD operations for plants, devices, alarms, and energy data
- **Server-Sent Events (SSE)** — Lightweight real-time push to all connected dashboards without polling or WebSocket infrastructure
- **Alert Webhook** — Configurable outbound hooks for alarm notifications (email, SMS, Slack)

### Frontend Dashboard
- **Modular Component System** — Dashboard, Plants Map, Device Tree, Analytics Charts, Alarm Console, Report Builder
- **Live Data Grid** — Auto-updating table with per-plant metrics (generation, consumption, battery, grid)
- **Charting Engine** — Multi-period energy bar charts (daily, monthly, yearly) with zoom and export
- **Collapsible Navigation** — Responsive sidebar with iframe-based page isolation for modular development

---

## What This Enables

With persistent historical data, your team can:

| Capability | What It Means |
|------------|---------------|
| **Performance benchmarking** | Compare any plant against its own history or against other plants in the fleet |
| **Degradation detection** | Spot when a plant's output trends downward over weeks or months |
| **Energy accounting** | Know exactly how many kWh each site produced last month, last quarter, last year |
| **Alarm correlation** | See what changed before and after an alarm event to identify root cause |
| **Reporting** | Generate production reports for stakeholders, regulators, or financiers |
| **Loss prevention** | Quantify downtime and energy loss when a plant goes offline |
| **Grid compliance** | Provide import/export data for net metering or curtailment verification |
| **Battery optimization** | Analyze charge/discharge patterns to improve storage dispatch strategy |

None of this is possible when data disappears on every page refresh.

---

## Why This Is Not Trivial

Making data persist sounds simple. In practice, there are challenges that a straightforward approach does not solve:

### Complexity Breakdown

```
Challenge                                       Impact if Unaddressed
─────────────────────────────────────────────────────────────────────────────
API inconsistencies                             Data loss, inaccurate metrics
Connection fragility                            Gaps in historical record
Time synchronization                            Misaligned trends, wrong conclusions
Idempotent updates                              Duplicate records, skewed totals
Live + historical coexistence                   Slow queries, poor user experience
Graceful degradation                            One failure blocks all data collection
Token expiration                                Complete system downtime
Rate limiting                                   Incomplete sync cycles
```

### Detailed Analysis

- **API inconsistencies** — The data source does not always return data in the same shape. Field names, units, and availability vary across endpoints. A naive implementation would silently drop fields or misinterpret values.
- **Connection fragility** — Network interruptions, timeouts, and rate limits are common. The system must handle these without data loss or partial state corruption.
- **Time synchronization** — Device-reported timestamps drift. Reported times must be aligned to a reliable clock to ensure chronological accuracy in trends and reports.
- **Idempotent updates** — Repeated data pulls must not create duplicate records or corrupt existing history. Every sync must be safe to run multiple times.
- **Live + historical coexistence** — The system must serve instantaneous live data and years of historical data from the same interface without performance degradation.
- **Graceful degradation** — A failure in one plant's data feed must not block data collection for other plants. Partial data is better than no data.

Our solution addresses all of these through a combination of architecture decisions, error handling patterns, and data modeling choices developed through direct experience with the platform.

---

## Technical Considerations

| Area | Challenge | Our Approach | Risk Level |
|------|-----------|-------------|------------|
| **Auth** | Solarman tokens expire silently | Auto-extraction + refresh pipeline (patent-pending heuristic) | 🔴 Critical |
| **API Limits** | 15 req/min per token | Multi-token pool with intelligent routing | 🟡 High |
| **Data Inconsistency** | Different response shapes per endpoint | Schema normalization layer with smart merging | 🟡 High |
| **Real-Time** | Polling is wasteful | SSE push from in-memory state store | 🟢 Moderate |
| **History** | Standard databases not ideal for time-series | Embedded rollup technique (no extra DB needed) | 🟢 Moderate |
| **Offline** | Network interruptions | Local buffering + reconciliation on reconnect | 🟢 Moderate |
| **Data Volume** | Growing history slows queries | Time-based partitioning + archival strategy | 🟡 High |
| **Multi-Site** | Different plant configurations | Configuration-driven per-plant sync profiles | 🟢 Moderate |

### Sync Cycle Dependencies

```
┌──────────────┐    success      ┌─────────────────┐    success      ┌──────────────────┐
│  Fetch Plant  │───────────────▶│  Fetch Real-Time │───────────────▶│  Fetch Device     │
│  List         │                │  Per Plant       │                │  Inventory        │
└──────┬───────┘                └─────────────────┘                └────────┬─────────┘
       │                                                                     │
       │  failure                     failure                                 │  failure
       ▼                                ▼                                      ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                             RETRY QUEUE (up to 3 attempts)                           │
│              Failed operations are retried with exponential backoff                  │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                                                                        │
                                                                               ┌────────▼─────────┐
                                                                               │  Fetch Device    │
                                                                               │  Telemetry       │
                                                                               └────────┬─────────┘
                                                                                        │
                                                                               ┌────────▼─────────┐
                                                                               │  Normalize &     │
                                                                               │  Store Data      │
                                                                               └──────────────────┘
```

---

## Cost-Benefit Analysis

### Estimated Annual Impact of Data Loss (Before)

| Cost Factor | Estimated Loss/Year |
|-------------|-------------------|
| Unidentified performance degradation (3–5% output loss) | $XX,XXX – $XX,XXX |
| Manual data collection & reporting labor | $X,XXX – $XX,XXX |
| Dispute resolution without audit trail | $X,XXX – $XX,XXX |
| Delayed fault detection → extended downtime | $XX,XXX – $XX,XXX |
| **Total estimated annual cost of data volatility** | **$XX,XXX – $XX,XXX** |

### Value Unlocked (After)

| Value Driver | Annual Benefit |
|-------------|----------------|
| Early degradation detection → proactive maintenance | $XX,XXX – $XX,XXX |
| Automated reporting → zero manual effort | $X,XXX – $XX,XXX |
| Performance optimization via trend analysis | $XX,XXX – $XX,XXX |
| Audit-ready data → dispute protection | $X,XXX – $XX,XXX |
| **Total estimated annual value** | **$XX,XXX – $XX,XXX** |

### Break-Even Timeline

```
Investment
    │
    │  ▲
    │  │                         ┌───────────────────
    │  │                        /│  Value Accrued
    │  │                       / │
    │  │                      /  │
    │  │                     /   │
    │  │                    /    │
    │  │                   /     │
    │  │                  /      │
    │  │                 /       │
    │  │                /        │
    │  │               /         │
    │  │              /          │
    │  │             /           │
    │  │            /            │
    │  │           /             │
    │  │          /              │
    │  │         /               │
    │  │        /                │
    │  │       /                 │
    │  │      /                  │
    │  │     /                   │
    │  │    /                    │
    │  │   /                     │
    │  │  /                      │
    │  │ /                       │
    │  │/                        │
    │  └─────────────────────────┴─────────────────────► Time
    │         ▲                                        │
    │         │                                        │
    │    Investment cost                         Breakeven
    │    (deployment)                            reached
    └────────────────────────────────────────────────────────
```

---

## Risk Assessment & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|-----------|
| Solarman API changes breaking compatibility | Medium | High | API version pinning + automated integration tests |
| Network outages interrupting data collection | Medium | Medium | Local buffering + automatic replay on reconnect |
| Token expiry causing auth failures | High | Critical | Multi-source token strategy with auto-refresh |
| Data volume growing beyond projections | Low | Medium | Configurable retention policy + archive pipeline |
| Hardware failure (server) | Low | High | Automated backup + recovery procedures |
| Scope creep delaying delivery | Medium | Medium | Phased rollout with clear milestones per plant |

---

## Data Retention & Lifecycle

```
Data Lifecycle Pipeline

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  RAW INGESTION   │────▶│  ACTIVE STORAGE  │────▶│  ARCHIVE         │
│                  │     │                  │     │                  │
│ • Live metrics   │     │ • Current month  │     │ • Older months   │
│ • Real-time      │     │ • Last 30 days   │     │ • Annual backup  │
│   updates        │     │ • Query-optimized│     │ • Compressed     │
│ • Raw API        │     │ • Indexed        │     │ • Cold storage   │
│   responses      │     │                  │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                       │                        │
         │                       │                        │
         ▼                       ▼                        ▼
  Retention: 48 hours    Retention: 12 months     Retention: 7 years
  (buffer before        (active analytics        (compliance and
   normalization)        and reporting)           long-term trends)
```

---

## Resource Requirements

| Resource | Specification | Purpose |
|----------|-------------|---------|
| **Server** | 2 vCPU, 4 GB RAM, 50 GB SSD | Application + database host |
| **Network** | Static IP or DNS, outbound HTTPS | API connectivity to Solarman |
| **Access** | Solarman API credentials (HAR file or token) | Data source authentication |
| **Monitoring** | Optional: uptime monitoring service | Ensure continuous data collection |

---

## Deliverables

- **A fully deployed system** that continuously collects and stores plant data
- **Live dashboard** with auto-refreshing real-time view of all plants
- **Historical analytics** — daily, monthly, and yearly energy charts per plant
- **Persistent alarm console** — alarms are recorded and retained, not lost on refresh
- **Device telemetry** — per-inverter data with drill-down capability
- **Admin panel** for plant and device management
- **Reporting** — API documentation and data export workflows
- **Remote access** — accessible from any browser, no local installation required
- **Operations training** — your team will know how to use and maintain the system

---

## What We Do Not Deliver (Because We Build It)

We do not deliver documentation that tells someone else how to build this. We do not deliver a DIY toolkit or a library. We deliver a **working system**, operated and maintained by us, because:

- The value is in the **integration** — connecting the pieces so they work reliably together
- The value is in the **handling of edge cases** — the thousands of things that can go wrong between data source and display
- The value is in the **operational experience** — knowing what breaks and how to fix it before it affects you

This is not a product you buy off the shelf. It is a solution we operate for you.

---

## Commercial Terms

- **Deliverable Format:** Deployed instance + private Git repository
- **Post-Launch Support:** 2 months included (bug fixes, data corrections)
- **Training:** 2 sessions for operations team
- **Exclusivity:** Platform built specifically for GWE's monitoring needs

---

## Next Steps

1. **Site audit** — We map your full plant inventory and confirm connectivity
2. **Pilot deployment** — We connect one plant to demonstrate the system live
3. **Fleet rollout** — We expand to all plants in your portfolio
4. **Handover & training** — Your team is equipped to use the system day-to-day

We are ready to begin as soon as we have access to the plant list and API credentials.

---

*This document contains a summary of the proposed solution architecture. Full technical specifications and implementation details are maintained separately by our engineering team.*
