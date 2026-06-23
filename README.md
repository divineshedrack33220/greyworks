# GWE SolarPulse

> Real-Time Solar Photovoltaic Monitoring & Analytics Platform

---

## Overview

GWE SolarPulse is a centralized monitoring solution designed for commercial and utility-scale solar PV installations. The platform aggregates real-time operational data from Solarman-compatible inverters, dataloggers, and energy meters across multiple geographically distributed plant sites into a single, unified dashboard.

The system provides live visibility into generation, consumption, battery storage, and grid interaction — enabling operators to detect performance anomalies, optimize energy dispatch, and generate compliance reports without manual data collection.

---

## The Problem

Solar plant operators managing fleets of installations across multiple sites face a fragmented monitoring landscape:

- **Vendor lock-in** — Each inverter manufacturer provides its own portal with inconsistent data models, update frequencies, and API capabilities
- **Latency blind spots** — Most portals update every 15–30 minutes, masking transient events like inverter trips, curtailment events, or battery state anomalies
- **No unified view** — Operators juggle multiple tabs, logins, and data formats to assess fleet-wide performance
- **Historical drift** — Energy totals drift between local meter readings and cloud-reported values, making reconciliation a manual spreadsheet exercise
- **Alert fatigue** — Generic alarms with no contextual enrichment lead to high false-positive rates and missed critical events

GWE SolarPulse addresses these gaps through a purpose-built integration layer that normalizes disparate data sources into a consistent real-time stream, with storage optimized for both live operational visibility and long-term analytical queries.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     EXTERNAL DATA SOURCES                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Solarman API   │  │  Solarman API   │  │  Solarman API   │  │
│  │  (Plant A)      │  │  (Plant B)      │  │  (Plant C)      │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                     DATA ACQUISITION LAYER                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Adaptive Sync Engine                         │   │
│  │  • Token lifecycle management & automatic rotation       │   │
│  │  • Multi-endpoint request orchestration                  │   │
│  │  • Response normalization & schema unification           │   │
│  │  • Configurable polling with backpressure control        │   │
│  │  • Idempotent upsert semantics                           │   │
│  └────────────────────────┬─────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                      STORAGE & STATE LAYER                       │
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │   Persistent Store   │    │      In-Memory State         │   │
│  │   (Document DB)      │    │      (Hot Cache)             │   │
│  │                      │    │                              │   │
│  │  • Plant metadata    │    │  • Latest readings           │   │
│  │  • Live metrics      │    │  • Active alarms             │   │
│  │  • Historical rolls  │    │  • Connected clients         │   │
│  │  • Device inventory  │    │  • Session state             │   │
│  └──────────────────────┘    └──────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    API & DELIVERY LAYER                          │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │   REST API       │  │   SSE Stream     │  │  Webhook Bus   │ │
│  │                  │  │                  │  │                │ │
│  │ • CRUD endpoints │  │ • Live plant     │  │ • Alarm        │ │
│  │ • Query params   │  │   data push      │  │   forwarding   │ │
│  │ • Pagination     │  │ • Auto-reconnect │  │ • Integration  │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬───────┘ │
└───────────┼─────────────────────┼──────────────────────┼─────────┘
            │                     │                      │
            ▼                     ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                     FRONTEND APPLICATION                         │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │Dashboard │  │ Plants   │  │ Devices  │  │ Analytics/Reports│ │
│  │──────────│  │──────────│  │──────────│  │──────────────────│ │
│  │Live grid │  │Map view  │  │Tree view │  │Energy charts     │ │
│  │KPI cards │  │Site info │  │Status    │  │Export (CSV/PDF)  │ │
│  │Alarms    │  │Thumbnails│  │Telemetry │  │Period selection  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Synchronization Cycle
A scheduled process initiates periodic data collection from the Solarman API. Each cycle performs a multi-stage fetch:

- **Plant List** — Retrieve the full inventory of monitored stations, including metadata such as name, location, installed capacity, and network connectivity status
- **Real-Time Metrics** — For each plant, fetch live operational data including instantaneous generation power (W), daily energy yield (kWh), cumulative lifetime generation, battery state of charge, battery power flow, load consumption, and grid import/export values
- **Device Inventory** — Enumerate all registered devices (inverters, dataloggers, meters) associated with each plant, capturing device type, serial number, and communication status
- **Device Telemetry** — For inverter-class devices, retrieve high-resolution current data including per-MPPT string power, grid voltage/frequency, and internal temperature readings

### 2. Data Normalization & Storage
Incoming data undergoes transformation before persistence:

- **Field Mapping** — Solarman's response keys vary across endpoints and versions; a normalization layer maps all variants to a canonical schema
- **Unit Standardization** — All values converted to SI base units (watts, watt-hours, Celsius) with consistent precision
- **Timestamp Alignment** — Server-side timestamps replace device-reported times where drift is detected, ensuring chronological consistency
- **Upsert Semantics** — Records are matched on unique station/device identifiers; existing records are updated in-place, new records are inserted atomically

### 3. Real-Time Distribution
After each sync cycle completes, the updated dataset is broadcast to all connected dashboard clients:

- **Broadcast Mechanism** — A lightweight publisher-subscriber pattern delivers the complete station list to every open dashboard session
- **Idempotent Delivery** — Clients receive the full dataset on each broadcast, eliminating the need for differential state tracking on the client side
- **Connection Management** — The server maintains a registry of active client connections with automatic cleanup on disconnect

### 4. Historical Reconstruction
For analytical use cases, the platform supports reconstruction of historical energy production:

- **On-Demand Generation** — History is computed at query time using stored plant metadata and configurable generation models
- **Period Aggregation** — Raw daily estimates are automatically rolled up into monthly and yearly totals based on the requested granularity
- **Seasonal Modeling** — Production estimates incorporate latitude-based solar irradiance curves with randomized daily variance for realistic distribution

---

## Features

### Dashboard
- **Live KPI Grid** — Auto-refreshing table displaying all plants with generation power, daily energy, battery SOC, load, and grid status
- **Status Indicators** — Color-coded network status badges (online, offline, alarm) for rapid fleet-wide health assessment
- **Responsive Layout** — Adaptive grid that reflows from multi-column desktop views to single-column mobile layouts

### Plant Management
- **Plant Directory** — Searchable, sortable list of all monitored sites with key metadata
- **Detail View** — Per-plant deep-dive showing address, installed capacity, contact information, and live telemetry
- **Geospatial Context** — Latitude/longitude stored for future map-based visualization layers

### Device Telemetry
- **Device Registry** — Complete inventory of all field devices grouped by parent plant
- **Inverter Data** — Real-time per-inverter metrics: DC input power, AC output power, daily yield, total yield, efficiency
- **Logger Status** — Communication health metrics for datalogger/gateway devices

### Energy Analytics
- **Multi-Period Charts** — Bar chart visualization for daily (30 days), monthly (12 months), and yearly (5 years) energy production
- **Seasonal Context** — Production data overlaid with expected generation curves based on site capacity and solar insolation models
- **Exportable Data** — Chart data available for CSV download for external analysis

### Alarm Management
- **Live Alarm Feed** — Real-time list of active and historical alarms per plant
- **Pagination** — Configurable page size for browsing large alarm histories
- **Status Tracking** — Alarm acknowledgment and resolution state machine

### System Features
- **Real-Time Streaming** — Server-Sent Events (SSE) for live data push to all connected clients without polling overhead
- **Automatic Sync** — Configurable cron-based synchronization with immediate initial sync on service startup
- **Graceful Degradation** — Individual endpoint failures (device list, real-time data) do not block overall sync completion; partial data is persisted with warnings logged
- **Collapsible Navigation** — Sidebar collapses to icon-only mode on small screens or on demand, maximizing content area

---

## Data Schema

### Plant Record
| Field | Type | Description |
|-------|------|-------------|
| stationId | Number | Unique Solarman station identifier |
| name | String | Plant name |
| address | String | Physical location |
| installedCapacity | Number | DC nameplate capacity (W) |
| networkStatus | String | Connectivity state |
| generationPower | Number | Instantaneous AC power output (W) |
| generationValue | Number | Daily energy production (kWh) |
| generationTotal | Number | Cumulative lifetime production (kWh) |
| loadPower | Number | Instantaneous load consumption (W) |
| loadEnergy | Number | Daily load consumption (kWh) |
| batterySOC | Number | Battery state of charge (%) |
| batteryPower | Number | Battery power flow (W, positive = discharging) |
| batteryChargeEnergy | Number | Daily battery charge energy (kWh) |
| batteryDischargeEnergy | Number | Daily battery discharge energy (kWh) |
| gridPower | Number | Grid power flow (W, positive = import) |
| gridExportEnergy | Number | Daily energy exported to grid (kWh) |
| gridImportEnergy | Number | Daily energy imported from grid (kWh) |
| latitude | Number | Site latitude |
| longitude | Number | Site longitude |
| lastUpdateTime | Date | Timestamp of last data refresh |

### Device Record
| Field | Type | Description |
|-------|------|-------------|
| deviceId | Number | Unique device identifier |
| stationId | Number | Parent plant identifier |
| name | String | Device name/label |
| deviceType | String | Device classification |
| serial | String | Manufacturer serial number |
| status | String | Operational status |
| lastSeen | Date | Last communication timestamp |

---

## API Endpoints

### `POST /api/sync/plants`
Triggers a full synchronization cycle. Fetches plant list, real-time metrics, device inventory, and device telemetry from Solarman. Upserts all records and broadcasts the updated dataset to connected dashboard clients.

**Response:**
```json
{
  "success": true,
  "saved": 12,
  "realTimeUpdated": 12,
  "timestamp": "2026-06-23T12:00:00.000Z"
}
```

### `GET /api/stations`
Returns the complete list of all monitored plants with their latest telemetry data. Supports no-arg retrieval of the full dataset for initial page load.

### `GET /api/plant-history?id=<stationId>&period=<daily|monthly|yearly>`
Generates historical energy production data for a specific plant. The period parameter controls aggregation granularity:
- `daily` — 30 individual day values
- `monthly` — 12 monthly aggregates
- `yearly` — 5 yearly aggregates

**Response:**
```json
{
  "history": [
    { "date": "2026-06-01", "kwh": 1250.4 },
    { "date": "2026-06-02", "kwh": 1102.7 }
  ]
}
```

### `GET /api/stream`
Opens a Server-Sent Events connection that pushes the full station dataset to the client whenever a sync cycle completes. Clients receive automatic updates without polling.

---

## Deployment Architecture

### Runtime Requirements
- **Node.js Runtime** — Event-loop based I/O for efficient handling of concurrent API requests and SSE connections
- **Document Database** — Schema-flexible storage for heterogeneous plant data with built-in upsert support
- **Process Manager** — Production process supervision with automatic restart on failure

### Environment Configuration
Sensitive parameters externalized via environment variables:
- MongoDB connection string
- API authentication tokens
- Sync schedule (cron expression)
- Service port binding
- HAR file path for credential extraction

### Startup Sequence
1. Connect to database with retry logic
2. Initialize HTTP server with middleware stack (CORS, logging, payload size limits)
3. Extract authentication credentials from configured source
4. Register API routes and SSE endpoint
5. Schedule periodic sync task via cron
6. Trigger initial synchronization after a brief stabilization delay
7. Log service readiness with access URL

---

## Security Considerations

- **Credential Isolation** — API tokens stored outside the codebase; extracted from offline capture files or environment variables; never committed to version control
- **No Direct Exposure** — Solarman API credentials are never exposed to the frontend; all third-party API calls occur server-side
- **CORS Policy** — Cross-origin requests explicitly permitted for dashboard access but can be restricted to specific origins in production deployments
- **Payload Limits** — Request body size capped to prevent resource exhaustion from oversized payloads
- **Graceful Shutdown** — Signal handlers ensure in-flight requests complete and database connections close cleanly on service termination

---

## Operational Notes

- **Sync Failure Isolation** — A failure to fetch data for one plant does not cascade; the sync engine logs the error, skips that plant, and continues processing remaining sites
- **Transient Error Handling** — Network timeouts and 404 responses for device endpoints are treated as non-fatal; the sync cycle records partial data rather than aborting entirely
- **Idempotent Syncs** — Repeated sync cycles are safe; upsert semantics prevent duplicate records and duplicate broadcasts are handled gracefully by SSE clients
- **Cache Invalidation** — The in-memory state is fully replaced on each sync cycle; no TTL-based invalidation required

---

*GWE SolarPulse — Built for Grey Works Energy*
