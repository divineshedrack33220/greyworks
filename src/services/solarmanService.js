const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config/solarman');
require('dotenv').config();

function loadToken() {
  if (process.env.SOLARMAN_TOKEN && process.env.SOLARMAN_TOKEN.trim() !== '') {
    return process.env.SOLARMAN_TOKEN.trim();
  }
  const cachePath = path.join(__dirname, '..', '..', '.token.cache');
  if (fs.existsSync(cachePath)) return fs.readFileSync(cachePath, 'utf8').trim();
  return null;
}

let TOKEN = loadToken();

const api = axios.create({
  baseURL: config.BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((req) => {
  if (!req.headers) req.headers = {};
  if (!TOKEN) {
    throw new Error('No Solarman token available. Set SOLARMAN_TOKEN or run extract-token.');
  }
  req.headers['Authorization'] = `Bearer ${TOKEN}`;
  req.headers['Content-Type'] = 'application/json';
  return req;
});

async function fetchPlantList() {
  try {
    const url = config.endpoints.plantList;
    const res = await api.post(url, {});
    return res.data;
  } catch (err) {
    try {
      const res = await api.get(config.endpoints.plantList);
      return res.data;
    } catch (e) {
      throw e;
    }
  }
}

async function fetchPlantRealtime(stationId) {
  const res = await api.post(config.endpoints.stationRealtime, { stationId });
  return res.data;
}

async function fetchDeviceList(stationId) {
  try {
    const res = await api.post(config.endpoints.deviceList, { stationId, page: 1, size: 200 });
    return res.data;
  } catch (err) {
    if (err.code === 'ECONNABORTED' || (err.response && err.response.status === 404)) {
      console.warn(`Device list error for station ${stationId}:`, err.message);
      return { data: [] };
    }
    throw err;
  }
}

async function fetchDeviceRealtime(deviceId) {
  try {
    const res = await api.post(config.endpoints.deviceRealtime, { deviceId });
    return res.data;
  } catch (err) {
    if (err.code === 'ECONNABORTED' || (err.response && err.response.status === 404)) {
      console.warn(`Device realtime error for device ${deviceId}:`, err.message);
      return { data: {} };
    }
    throw err;
  }
}

async function fetchStationEnergy(stationId, type = 'day') {
  let endpoint;
  switch (type) {
    case 'hour':
      endpoint = config.endpoints.stationDay.replace('/day', '/hour');
      break;
    case 'month':
      endpoint = config.endpoints.stationMonth;
      break;
    default:
      endpoint = config.endpoints.stationDay;
  }
  try {
    const res = await api.post(endpoint, { stationId });
    return res.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      console.warn(`Energy ${type} 404 for station ${stationId}: Returning empty.`);
      return { data: [] };
    }
    throw err;
  }
}

async function fetchLoggerStatus(deviceId) {
  try {
    const res = await api.post(config.endpoints.loggerStatus, { deviceId });
    return res.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      console.warn(`Logger status 404 for device ${deviceId}: Returning empty.`);
      return { data: {} };
    }
    throw err;
  }
}

async function fetchAlarms(stationId) {
  try {
    const res = await api.post(config.endpoints.alarms, { stationId, page: 1, size: 100 });
    return res.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      console.warn(`Alarms 404 for station ${stationId}: Returning empty.`);
      return { data: [] };
    }
    throw err;
  }
}

module.exports = {
  fetchPlantList,
  fetchPlantRealtime,
  fetchDeviceList,
  fetchDeviceRealtime,
  fetchStationEnergy,
  fetchLoggerStatus,
  fetchAlarms,
  setToken: (t) => { TOKEN = t; }
};