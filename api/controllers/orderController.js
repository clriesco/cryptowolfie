'use strict';

const mongoose = require('mongoose');
const moment = require('moment');
const momentDurationFormatSetup = require("moment-duration-format");
const order = mongoose.model('Order');
const debug = require('debug')('cryptowolfie:orderController');
const util = require('../../utils/util');

momentDurationFormatSetup(moment);

exports.getOrders = function(req, res) {
    debug('Getting Orders');
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
    order.find(query, null, {sort: sort}, function(err, ord) {
  
      if (err)
        res.send(err);
  
      if (filter) {
        ord = ord.filter(ord => ord.currency.trim().toLowerCase().search(filter.toLowerCase()) >= 0);
      }
      if (!pageSize) return res.json(ord);
      const initialPos = pageNumber * pageSize;
      const orderPage = order.slice(initialPos, initialPos + pageSize);
      res.json(orderPage);
    });
};

exports.getOrdersLength = function(req, res) {
    const queryParams = req.query;
  
    const filter = queryParams.filter || '';
    queryParams.status = util.extend(queryParams.status, {currency: { "$regex": filter.trim().toLowerCase(), "$options": "i" }} );
    order.count(queryParams.status, function(err, count) {
      if (err)
        res.send(err);
      return res.json(count);
    });
};

exports.postOrder = function(req, res) {
    var new_ord = new order(req.body);
    new_ord.save(function(err, ord) {
        if (err)
            res.send(err);
        res.json(ord);
    });
};

exports.getOrder = function(req, res) {
    order.findById(req.params.order, function(err, ord) {
        if (err)
            res.send(err);
        res.json(ord);
    });
};
  
exports.putOrder = function(req, res) {
    order.findOneAndUpdate({_id: req.params.order}, req.body, {new: true}, function(err, ord) {
        if (err)
            res.send(err);
        res.json(ord);
    });
};
  
exports.deleteOrder = function(req, res) {
    order.remove({
        _id: req.params.order
    }, function(err, ord) {
        if (err)
            res.send(err);
        res.json({ message: 'Order successfully deleted' });
    });
};
  
exports.deleteOrders = function(req, res) {
    order.remove({}, function(err, ord) {
        if (err)
            res.send(err);
        res.json({ message: 'All orders successfully deleted' });
    });
};

exports.getActiveOrders = function() {
    let activeOrders = ['active'];
    return order
      .find({status: {$in: activeOrders}})
      .then((orders) => {
        return orders;
      })
      .catch((err) => {
        throw (err);
      });
}

exports.getAllActiveOrders = function() {
    let activeOrders = ['active', 'timeoutTrigger', 'filling'];
    return order
      .find({status: {$in: activeOrders}})
      .then((orders) => {
        return orders;
      })
      .catch((err) => {
        throw (err);
      });
}

exports.getFillingOrders = function() {
    let fillingOrders = ['filling'];
    return order
      .find({status: {$in: fillingOrders}})
      .then((orders) => {
        return orders;
      })
      .catch((err) => {
        throw (err);
      });
}

exports.createOrderFromSignal = function(signal) {
    let jOrder = JSON.parse(JSON.stringify(signal));
    delete jOrder._id;
    let ord = new order(jOrder);
    return ord;
}