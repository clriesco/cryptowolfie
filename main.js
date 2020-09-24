'use strict';
const debug = require('debug')('cryptowolfie:main');
const express = require('express');
const cors = require('cors');
const logger = require('morgan');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const config = require('./config');

//Models
require('./api/models/db');

//Classes
const signalManager = require('./classes/signalManager');
const exchangeManager = require('./classes/exchangeManager');
const orderManager = require('./classes/orderManager');

//Generators
const generators = [];
generators.push(require('generator-discord'));
generators.push(require('generator-russian'));
generators.push(require('generator-human-discord'));
const app = express();
const routesApi = require('./api/routes/index');

const setupServer = async function() {

	app.use(logger('dev'));
	app.use(passport.initialize());
	app.use(bodyParser.urlencoded({ extended: true }));
	app.use(bodyParser.json());
	app.use('/api', routesApi);
	app.use(cookieParser());
	app.use(cors());

	app.listen(config.serverPort);
	setupAppErrors();
	await exchangeManager.init();
	await orderManager.init(exchangeManager);
	signalManager.init(exchangeManager, orderManager, generators);
	
	debug('Signal RESTful API server started on: ' + config.serverPort);
}

const setupAppErrors = function() {
	// catch 404 and forward to error handler
	app.use(function(req, res, next) {
		var err = new Error('Not Found');
		err.status = 404;
		next(err);
	});

	// error handlers

	// [SH] Catch unauthorised errors
	app.use(function (err, req, res, next) {
	if (err.name === 'UnauthorizedError') {
		res.status(401);
		res.json({"message" : err.name + ": " + err.message});
	}
	});

	// development error handler
	// will print stacktrace
	if (app.get('env') === 'development') {
		app.use(function(err, req, res, next) {
			res.status(err.status || 500);
			res.render('error', {
				message: err.message,
				error: err
			});
		});
	}

	// production error handler
	// no stacktraces leaked to user
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.render('error', {
			message: err.message,
			//error: {}
			error: err
		});
	});
}

setupServer();