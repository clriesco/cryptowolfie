'use strict';

const mongoose = require('mongoose');
const generator = mongoose.model('Generator');
const debug = require('debug')('cryptowolfie:generatorController');

exports.getGenerators = function(req, res) {
    debug('Getting Generators');
    generator.find({}, function(err, gen) {
      if (err)
        res.send(err);
      res.json(gen);
    });
};

exports.postGenerator = function(req, res) {
    debug('Posting generator');
    debug(req.body);
    var new_gen = new generator(req.body);
    new_gen.save(function(err, gen) {
        if (err)
            res.send(err);
        res.json(gen);
    })
    .catch(err => debug(err));
};

exports.getGenerator = function(req, res) {
    generator.findById(req.params.generator, function(err, gen) {
        if (err)
            res.send(err);
        res.json(gen);
    });
};
  
exports.putGenerator = function(req, res) {
    generator.findOneAndUpdate({_id: req.params.generator}, req.body, {new: true}, function(err, gen) {
        if (err)
            res.send(err);
        res.json(gen);
    });
};
  
exports.deleteGenerator = function(req, res) {
    generator.remove({
        _id: req.params.generator
    }, function(err, gen) {
        if (err)
            res.send(err);
        res.json({ message: 'Generator successfully deleted' });
    });
};
  
exports.deleteGenerators = function(req, res) {
    order.remove({}, function(err, gen) {
        if (err)
            res.send(err);
        res.json({ message: 'All generators successfully deleted' });
    });
};

exports.getActiveGenerators = function() {
    return generator
      .find({active: true})
      .then((generators) => {
        return generators;
      })
      .catch((err) => {
        throw (err);
      });
}

exports.localGetGenerators = function(options = {}) {
  return generator
    .find(options)
    .then((generators) => {
      return generators;
    })
    .catch((err) => {
      debug(err);
      //throw (err);
    });
};