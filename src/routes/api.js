// src/routes/api.js  ← FINAL WORKING VERSION (2025) + PLANT HISTORY ENDPOINT
const express = require('express');
const router = express.Router();
const Station = require('../models/Station');
const solarman = require('../services/solarmanService');

// ====================== SSE CLIENTS & BROADCAST ======================
let sseClients = [];

async function broadcastStations() {
  try {
    const stations = await Station.find().lean();
    const payload = JSON.stringify(stations);
    sseClients.forEach(client => {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (e) { /* ignore closed */ }
    });
  } catch (err) {
    console.error('Broadcast failed:', err.message);
  }
}

// SSE Stream Endpoint
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.flushHeaders();

  broadcastStations();
  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

// ====================== FULL SYNC WITH REAL-TIME DATA ======================
router.post('/sync/plants', async (req, res) => {
  try {
    console.log('[SYNC] Starting full sync with real-time data...');

    const rawData = await solarman.fetchPlantList();

    let stations = [];
    if (Array.isArray(rawData)) {
      stations = rawData;
    } else if (rawData?.data && Array.isArray(rawData.data)) {
      stations = rawData.data;
    } else if (rawData?.stationList && Array.isArray(rawData.stationList)) {
      stations = rawData.stationList;
    } else {
      console.error('[SYNC] Unexpected response format:', JSON.stringify(rawData).slice(0, 500));
      return res.status(500).json({ error: 'Invalid response from Solarman' });
    }

    console.log(`[SYNC] Received ${stations.length} stations from Solarman`);

    let savedCount = 0;
    let realTimeUpdated = 0;

    for (const item of stations) {
      const s = item.station || item;

      if (!s?.id) continue;

      let realTime = {
        generationPower: s.generationPower || 0,
        dailyEnergy: s.generationValue || 0,
        totalEnergy: s.generationTotal || 0,
        lastUpdateTime: s.lastUpdateTime ? new Date(s.lastUpdateTime * 1000) : new Date(),
        batterySOC: null,
        batteryPower: null,
        gridPower: null,
        loadPower: null,
        timestamp: null
      };

      try {
        const devRes = await solarman.fetchDeviceList(s.id);
        const devices = devRes?.data?.list || devRes?.list || [];

        for (const dev of devices) {
          const sn = dev.deviceSn || dev.sn;
          if (!sn) continue;

          if (dev.deviceType !== 1 && !dev.productName?.toLowerCase().includes('inverter')) continue;

          try {
            const latest = await solarman.fetchLatestData(sn);
            if (latest?.success && latest.data) {
              const d = latest.data;
              realTime = {
                generationPower: Number(d.P_PV || d['P-PV'] || d.generationPower || 0),
                dailyEnergy: Number(d.E_Today || d['E-Today'] || d.generationValue || 0),
                totalEnergy: Number(d.E_Total || d['E-Total'] || d.generationTotal || 0),
                batterySOC: d.SOC !== undefined ? Number(d.SOC) : null,
                batteryPower: d.P_Bat || d['P-Bat'] || null,
                gridPower: d.P_Grid || d['P-Grid'] || null,
                loadPower: d.P_Load || d['P-Load'] || null,
                timestamp: d.collectTime || new Date().toISOString(),
              };
              realTimeUpdated++;
              break;
            }
          } catch (e) { /* silent */ }
        }
      } catch (err) {
        console.warn(`[WARN] Devices/real-time failed for station ${s.id}:`, err.message);
      }

      await Station.findOneAndUpdate(
        { stationId: s.id },
        {
          $set: {
            stationId: s.id,
            name: s.name || 'Unknown Plant',
            address: s.locationAddress || '',
            installedCapacity: Number(s.installedCapacity || 0),
            networkStatus: s.networkStatus || 'UNKNOWN',

            generationPower: realTime.generationPower,
            generationValue: realTime.dailyEnergy,
            generationTotal: realTime.totalEnergy,
            lastUpdateTime: realTime.lastUpdateTime,
            realTimeTimestamp: realTime.timestamp,

            batterySOC: realTime.batterySOC,
            batteryPower: realTime.batteryPower,
            gridPower: realTime.gridPower,
            loadPower: realTime.loadPower,

            latitude: s.locationLat || null,
            longitude: s.locationLng || null,
            image: s.stationImage || '',
            phone: s.contactPhone || '',
          }
        },
        { upsert: true }
      );

      savedCount++;
    }

    await broadcastStations();

    console.log(`[SYNC SUCCESS] ${savedCount} stations saved | ${realTimeUpdated} with live inverter data`);
    res.json({
      success: true,
      saved: savedCount,
      realTimeUpdated,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('[SYNC FAILED]', err.response?.data || err.message);
    res.status(500).json({
      error: 'Sync failed',
      details: err.message
    });
  }
});

// ====================== GET ALL STATIONS ======================
router.get('/stations', async (req, res) => {
  try {
    const stations = await Station.find({}).lean();
    res.json(stations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== PLANT HISTORY ENDPOINT (SIMULATED REALISTIC DATA) ======================
router.get('/plant-history', async (req, res) => {
  const { id, period = 'daily' } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id parameter' });

  try {
    const station = await Station.findOne({ stationId: Number(id) }).lean();
    if (!station) return res.status(404).json({ error: 'Plant not found' });

    const capacitykWp = Number(station.installedCapacity || 0) / 1000;
    const avgDailykWh = capacitykWp * 5; // 5 peak sun hours average

    const history = [];
    const now = new Date();

    let days;
    if (period === 'daily') days = 30;
    else if (period === 'monthly') days = 365;
    else if (period === 'yearly') days = 1825; // 5 years
    else days = 30;

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Seasonal variation: higher in summer months
      const month = date.getMonth() + 1;
      const seasonalFactor = 0.8 + 0.4 * Math.sin((month - 3) * Math.PI / 6);

      // Random daily variation ±20%
      const variation = 0.8 + Math.random() * 0.4;
      const kwh = Math.max(0, avgDailykWh * seasonalFactor * variation);

      history.push({
        date: date.toISOString().split('T')[0],
        kwh: Number(kwh.toFixed(1))
      });
    }

    // For monthly/yearly, aggregate daily into periods
    if (period === 'monthly' || period === 'yearly') {
      const aggregated = [];
      const map = new Map();

      history.forEach(entry => {
        const d = new Date(entry.date);
        const key = period === 'monthly' 
          ? d.toISOString().slice(0, 7) 
          : d.getFullYear().toString();

        if (!map.has(key)) map.set(key, { date: key, kwh: 0 });
        map.get(key).kwh += entry.kwh;
      });

      map.forEach(val => aggregated.push({ date: val.date, kwh: Number(val.kwh.toFixed(1)) }));
      aggregated.sort((a, b) => a.date.localeCompare(b.date));
      res.json({ history: aggregated });
    } else {
      res.json({ history });
    }
  } catch (err) {
    console.error('History endpoint error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export broadcast for cron use
router.broadcast = broadcastStations;

module.exports = router;