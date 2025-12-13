// models/Station.js ← FINAL 100% WORKING SCHEMA (2025)
const mongoose = require('mongoose');

const StationSchema = new mongoose.Schema({
  stationId: { type: Number, unique: true, required: true, index: true },
  name: { type: String, required: true },
  address: String,
  locationAddress: String,
  installedCapacity: Number,
  networkStatus: { type: String, default: 'UNKNOWN' },

  // LIVE POWER & ENERGY (W and kWh)
  generationPower: { type: Number, default: 0 },           // W
  generationValue: { type: Number, default: 0 },           // kWh today (Solar Generated)

  // THESE WERE MISSING → THIS IS WHY YOU SEE 0.0 kWh!
  loadEnergy: { type: Number, default: 0 },                // Consumed today (kWh)
  batteryChargeEnergy: { type: Number, default: 0 },       // Battery charged today
  batteryDischargeEnergy: { type: Number, default: 0 },    // Battery discharged today
  gridExportEnergy: { type: Number, default: 0 },          // Fed to grid today
  gridImportEnergy: { type: Number, default: 0 },          // From grid today

  batterySOC: { type: Number, default: null },             // %
  batteryPower: Number,                                    // W (charging/discharging)
  loadPower: Number,                                       // W (instant consumption)
  gridPower: Number,                                       // W

  generationTotal: Number,
  lastUpdateTime: Date,
  realTimeTimestamp: String,

  latitude: Number,
  longitude: Number,
  image: String,
  phone: String,
  contactPhone: String,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

StationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Station', StationSchema);