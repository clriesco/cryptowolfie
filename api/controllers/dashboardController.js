'use strict';

const mongoose = require('mongoose');
const debug = require('debug')('cryptowolfie:dashboardController');

function extend(obj, src) {
  Object.keys(src).forEach(function(key) { obj[key] = src[key]; });
  return obj;
}

exports.getHome = function(req, res) {
    res.json({});
};