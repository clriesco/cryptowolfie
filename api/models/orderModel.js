'use strict';
const mongoose = require('mongoose');
const config = require('../../config');
const Schema = mongoose.Schema;

const orderSchema = new Schema({
  symbol: {
    type: String,
    default: 'BTC/USD'
  },
  currency: {
    type: String,
    required: 'Introduce la moneda'
  },
  commodity: {
    type: String,
    default: 'BTC'
  },
  exchange: {
    type: String,
    default: 'Binance'
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
  trailingLossThreshold: {
    type: Number,
    default: config.takeProfitThreshold - config.trailingLossMargin
  },
  trailingLossMargin: {
    type: Number,
    default: config.trailingLossMargin
  },
  trailingLoss: {
    type: Boolean,
    default: false
  },
  trailingLossReached: {
    type: Boolean,
    default: false
  },
  trailingLossDown: {
    type: Boolean,
    default: false
  },
  trailingLossDownMargin: {
    type: Number,
    default: (config.takeProfitThreshold - 1)/2
  },
  trailingLossDownThreshold: {
    type: Number,
    default: (config.takeProfitThreshold - 1)/2 + 1
  },
  martingaleLevel: {
    type: Number,
    default: 0
  },
  martingaleBuyIds: [],
  martingaleSellIds: [],
  exchangeBuyId: {
    type: String,
    default: null
  },
  exchangeSellId: {
    type: String,
    default: null
  },
  signalId: {
    type: Schema.Types.ObjectId, 
    ref: 'Signal'
  },
  price: {
    type: Number,
    required: 'Introduce el precio de entrada'
  },
  quantity: {
    type: Number,
    required: 'Introduce la cantidad'
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
    enum: ['won', 'lost', 'tld',  'filling', 'active', 'timeoutTrigger', 'timeoutTriggerEnd', 'timeoutFill'],
    default: 'active'
  },
  priceHistory: [{
    price: {
      type: Number,
      default: null
    },
    date: {
      type: Date,
      default: null
    }
  }]
});

module.exports = mongoose.model('Order', orderSchema);