module.exports = {
  BASE_URL: 'https://globalpro.solarmanpv.com',
  endpoints: {
    plantList: '/maintain-s/operating/station/v2/search?page=1&size=50&order.direction=ASC&order.property=name',
    plantSummary: '/maintain-s/operating/station/summary',
    stationRealtime: '/station/v1/station/getStationRealData',
    deviceList: '/station/device/page',  // From HAR/docs: POST with {stationId, page, size}
    deviceDetail: '/maintain-s/device/detail',
    deviceRealtime: '/device/v1/currentData',  // Real-time data for devices/inverters
    inverterRealtime: '/inverter/v1/inverter/getRealData',
    stationDay: '/station/v1/energy/day',  // Daily energy charts
    stationHour: '/station/v1/energy/hour',  // Hourly (extend for custom)
    stationMonth: '/station/v1/energy/month',  // Monthly
    alarms: '/station/v1/alarm/page',  // Alarms list with pagination
    loggerStatus: '/device/v1/logger/status'  // Logger/device status
  }
};