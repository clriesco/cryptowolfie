'use strict';

const mongoose = require('mongoose');
const moment = require('moment');
const momentDurationFormatSetup = require("moment-duration-format");
const signal = mongoose.model('Signal');
const debug = require('debug')('cryptowolfie:signalController');
const util = require('../../utils/util');

momentDurationFormatSetup(moment);

exports.getSignals = function(req, res) {
  debug('Getting Signals');
  const queryParams = req.query;
  debug(queryParams);
  let query = {}, sort = {};
  if (queryParams.filter && queryParams.filter !== null ) {
    query.currency = new RegExp(queryParams.filter.toUpperCase());
  }
  const filter = queryParams.filter || '';
  const pageNumber = parseInt(queryParams.pageNumber) || 0;
  const pageSize = parseInt(queryParams.pageSize) || 0;

  if (queryParams.sortDirection && queryParams.sortActive) sort[queryParams.sortActive] = (queryParams.sortDirection == 'asc') ? 1 : -1;
  signal.find(query, null, {sort: sort}, function(err, sig) {

    if (err)
      res.send(err);

    if (filter) {
      sig = sig.filter(sig => sig.currency.trim().toLowerCase().search(filter.toLowerCase()) >= 0);
    }
    if (!pageSize) return res.json(sig);
    const initialPos = pageNumber * pageSize;
    const signalPage = sig.slice(initialPos, initialPos + pageSize);
    res.json(signalPage);
  });
};

exports.getSignalsLength = function(req, res) {
  const queryParams = req.query;

  const filter = queryParams.filter || '';
  queryParams.status = util.extend(queryParams.status, {currency: { "$regex": filter.trim().toLowerCase(), "$options": "i" }} );
  signal.count(queryParams.status, function(err, count) {
    if (err)
      res.send(err);
    return res.json(count);
  });
};

exports.getStats = function(req, res) {

  Promise.all([last24Ended(), allTimeEnded()])
  .then(values => {
    //debug('promise all %j', values);
    return res.json({last24: values[0], alltime: values[1]});
  })
};

exports.postSignal = function(req, res) {
  var new_sig = new signal(req.body);
  new_sig.save(function(err, sig) {
    if (err)
      res.send(err);
    res.json(sig);
  });
};

exports.getSignal = function(req, res) {
  signal.findById(req.params.signal, function(err, sig) {
    if (err)
      res.send(err);
    res.json(sig);
  });
};

exports.putSignal = function(req, res) {
  signal.findOneAndUpdate({_id: req.params.signal}, req.body, {new: true}, function(err, sig) {
    if (err)
      res.send(err);
    res.json(sig);
  });
};

exports.deleteSignal = function(req, res) {
  signal.remove({
    _id: req.params.signal
  }, function(err, sig) {
    if (err)
      res.send(err);
    res.json({ message: 'Signal successfully deleted' });
  });
};

exports.deleteSignals = function(req, res) {
  signal.remove({}, function(err, sig) {
    if (err)
      res.send(err);
    res.json({ message: 'All Signals successfully deleted' });
  });
};

exports.localPostSignal = function(sig) {
  var new_sig = new signal(sig);
  return new_sig
    .save()
    .then((saved) => {
      return saved;
    })
    .catch((err) => {
      debug(err);
      //throw (err);
    });
}

exports.localGetSignals = function(options = {}) {
  return signal
    .find(options)
    .then((signals) => {
      return signals;
    })
    .catch((err) => {
      debug(err);
      //throw (err);
    });
};

exports.localGetSignal = function(options = {}) {
  return signal
    .find(options)
    .limit(1)
    .then((signals) => {
      if (!signals) return null;
      return signals[0];
    })
    .catch((err) => {
      debug(err);
      //throw (err);
    });
};

exports.localUpdateSignals = function(filter = {}, update = {}) {
  return signal.update(filter, update, {multi:true}, function(err, updated){
    if (err) {
      throw err;
    }
  });
}

exports.localUpdateSignal = function(filter = {}, update = {}) {
  return signal.update(filter, update, {}, function(err, updated){
    if (err) {
      throw err;
    }
    return updated;
  });
}

exports.rejectSignalsByKeepAlive = function(keepAlive) {
  let thresholdTime = moment().subtract(keepAlive, 'second');
  return signal.update({status: 'called', creationDate: {$lt: thresholdTime.toDate()}}, {status: 'timeout'}, {multi: true}, function(err, updated) {
    if (err)
      throw err;  
  });
}

exports.getActiveSignals = function(exchange) {
  let activeSignals = ['active'];
  return signal
    .find({status: {$in: activeSignals}, exchange: exchange})
    .then((signals) => {
      return signals;
    })
    .catch((err) => {
      throw (err);
    });
}

exports.getWaitingSignals = function() {
  return signal
    .find({status: 'called'})
    .then((signals) => {
      return signals;
    })
    .catch((err) => {
      throw (err);
    });
}

exports.getOldestOrder = function(exchange) {
  return signal
    .find({status: 'active', exchange: exchange})
    .sort({creation_date: 1})
    .limit(1)
    .then((signals) => {
      if (!signals) return null;
      return signals[0];
    })
    .catch((err) => {
      debug(err);
      //throw (err);
    });
};

let last24Ended = function() {
  const last24 = new Date(Date.now() - 24*60*60 * 1000);
  return signal.find({status: ['won', 'lost'], closeDate: {$gt: last24}})
    .exec()
    .then(sigs => {
      var stats = {};
      sigs.forEach(function(x) { stats[x.status] = (stats[x.status] || 0)+1; });
      debug(stats);
      return stats;
    });
}

let allTimeEnded = function () {
  return signal.find({status: ['won', 'lost']})
    .exec()
    .then(sigs => {
      var stats = {};
      sigs.forEach(function(x) { stats[x.status] = (stats[x.status] || 0)+1; });
      debug(stats);
      return stats;
    });
}