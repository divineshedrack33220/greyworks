const mongoose = require('mongoose');

const MeasurementSchema = new mongoose.Schema({
  stationId: { type: Number, required: true, index: true },
  deviceId: { type: Number, required: true, index: true },
  timestamp: { type: Date, required: true, index: true },
  values: { type: Object, default: {} },  // power, energy, voltage, current, etc.
  raw: Object
}, { timestamps: true });

module.exports = mongoose.model('Measurement', MeasurementSchema);