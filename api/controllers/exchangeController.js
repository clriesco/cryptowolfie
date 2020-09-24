'use strict';

const mongoose = require('mongoose');
const exchange = mongoose.model('Exchange');
const debug = require('debug')('cryptowolfie:exchangeController');

exports.getExchanges = function(req, res) {
    debug('Getting Exchanges');
    exchange.find({}, function(err, ex) {
      if (err)
        res.send(err);
      res.json(ex);
    });
};

exports.postExchange = function(req, res) {
    debug('Posting exchange');
    debug(req.body);
    var new_ex = new exchange(req.body);
    new_ex.save(function(err, ex) {
        if (err)
            res.send(err);
        res.json(ex);
    })
    .catch(err => debug(err));
};

exports.getExchange = function(req, res) {
    exchange.findById(req.params.exchange, function(err, ex) {
        if (err)
            res.send(err);
        res.json(ex);
    });
};
  
exports.putExchange = function(req, res) {
    exchange.findOneAndUpdate({_id: req.params.exchange}, req.body, {new: true}, function(err, ex) {
        if (err)
            res.send(err);
        res.json(ex);
    });
};
  
exports.deleteExchange = function(req, res) {
    exchange.remove({
        _id: req.params.exchange
    }, function(err, ex) {
        if (err)
            res.send(err);
        res.json({ message: 'Exchange successfully deleted' });
    });
};
  
exports.deleteExchanges = function(req, res) {
    order.remove({}, function(err, ex) {
        if (err)
            res.send(err);
        res.json({ message: 'All exchanges successfully deleted' });
    });
};

exports.getActiveExchanges = function() {
    return exchange
      .find({active: true})
      .then((exchanges) => {
        return exchanges;
      })
      .catch((err) => {
        throw (err);
      });
}