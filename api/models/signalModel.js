'use strict';
const mongoose = require('mongoose');
const config = require('../../config');
const Schema = mongoose.Schema;

const signalSchema = new Schema({
  symbol: {
    type: String,
    required: 'Missing Symbol. Ex: "XRP/BTC"'
  },
  currency: {
    type: String,
    required: 'Missing Currency'
  },
  commodity: {
    type: String,
    required: 'Missing Commodity'
  },
  exchange: {
    type: String,
    required: 'Missing exchange. Ex: "binance"'
  },
  generatorName: {
    type: String,
    default: 'base'
  },
  stopLossThreshold: {
    type: Number,
    default: config.stopLossThreshold
  },
  takeProfitThreshold: {
    type: Number,
    default: config.takeProfitThreshold
  },
  trailingLossMargin: {
    type: Number,
    default: config.trailingLossMargin
  },
  trailingLossDownMargin: {
    type: Number,
    default: (config.takeProfitThreshold - 1)/2
  },
  trailingLossDownThreshold: {
    type: Number,
    default: (config.takeProfitThreshold - 1)/2 + 1
  },
  trailingLoss: {
    type: Boolean,
    default: false
  },
  trailingLossDown: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    required: 'Missing Price'
  },
  closePrice: {
    type: Number,
    default: null
  },
  creationDate: {
    type: Date,
    default: Date.now
  },
  closeDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['called', 'won', 'lost', 'active', 'timeout', 'timeoutTrigger', 'timeoutTriggerEnd'],
    default: 'called'
  }
});

module.exports = mongoose.model('Signal', signalSchema);