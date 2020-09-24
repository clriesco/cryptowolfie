'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const exchangeSchema = new Schema({
  name: {
    type: String,
    default: 'binance'
  },
  active: {
    type: Boolean,
    default: true
  },
  enableRateLimit: {
    type: Boolean,
    default: true
  },
  maxOrders: {
    type: Number,
    default: 5
  },
  maxBTCPerOrder: {
    type: Number,
    default: 0.001 //BTCs por orden
  },
  apiKey: {
      type: String,
      default: ''
  },
  secret: {
      type: String,
      default: ''
  },
  test: {
    type: Boolean,
    default: false
  },
  martingale: {
    type: Boolean,
    default: false
  },
  martingaleLevel: {
    type: Number,
    default: 1
  }
});

module.exports = mongoose.model('Exchange', exchangeSchema);