'use strict';
const mongoose = require('mongoose');
const config = require('../../config');
const Schema = mongoose.Schema;

const generatorSchema = new Schema({
  name: {
    type: String,
    required: 'Missing Generator name'
  },
  active: {
    type: Boolean,
    default: true
  },
  slots: {
    type: Number,
    required: config.maxOrders
  },
  accuracy: {
    type: Number,
    required: 'Missing Generator Accuracy'
  },
  takeProfitThreshold: {
    type: Number,
    default: config.takeProfitThreshold
  },
  stopLossThreshold: {
    type: Number,
    default: config.stopLossThreshold
  },
  trailingLoss: {
    type: Boolean,
    default: false
  },
  trailingLossMargin: {
    type: Number,
    default: config.trailingLossMargin
  },
  trailingLossDownThreshold: {
    type: Number,
    default: (config.takeProfitThreshold - 1)/2 + 1
  },
  trailingLossDown: {
    type: Boolean,
    default: false
  },
  trailingLossDownMargin: {
    type: Number,
    default: (config.takeProfitThreshold - 1)/2
  },
});

module.exports = mongoose.model('Generator', generatorSchema);