const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
  deviceId: { type: Number, unique: true, required: true, index: true },
  stationId: { type: Number, required: true, index: true },
  name: String,
  deviceType: String,
  serial: String,
  status: { type: String, default: 'unknown' },
  lastSeen: Date,
  raw: Object,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

DeviceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Device', DeviceSchema);