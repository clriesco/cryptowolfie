'use strict';
const express = require('express');
const router = express.Router();
const signal = require('../controllers/signalController');
const order = require('../controllers/orderController');
const generator = require('../controllers/generatorController');
const exchange = require('../controllers/exchangeController');
const dashboard = require('../controllers/dashboardController');
/* GET home page. */
router
    .get('/', dashboard.getHome)

    .get('/signals', signal.getSignals)
    .get('/signals-length', signal.getSignalsLength)
    .get('/stats', signal.getStats)
    .post('/signals', signal.postSignal)
    .delete('/signals', signal.deleteSignals)
    .get('/signals/:signal', signal.getSignal)
    .post('/signals/:signal', signal.putSignal)
    .delete('/signals/:signal', signal.deleteSignal)

    .get('/orders', order.getOrders)
    .post('/orders', order.postOrder)
    .post('/orders/:order', order.putOrder)
    .get('/orders/:order', order.getOrder)
    .delete('/orders/:order', order.deleteOrder)

    .get('/generators', generator.getGenerator)
    .post('/generators', generator.postGenerator)
    .post('/generators/:generator', generator.putGenerator)
    .get('/generators/:generator', generator.getGenerator)
    .delete('/generators/:generator', generator.deleteGenerator)

    .get('/exchanges', exchange.getExchanges)
    .post('/exchanges', exchange.postExchange)
    .get('/exchanges/:exchange', exchange.getExchange)
    .post('/exchanges/:exchange', exchange.putExchange)
    .delete('/exchanges/:exchange', exchange.deleteExchange)


module.exports = router;