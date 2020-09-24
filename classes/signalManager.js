'use strict'
const debug = require('../utils/custom-debug')('cryptowolfie:signalManager');
const config = require('../config');
const signalController = require('../api/controllers/signalController');
const generatorController = require('../api/controllers/generatorController');

class SignalManager {
	
	constructor() {
		this.signals = [];
		this.generators = null;
		this.generatorsConfig = {};
	}

	init(exchangeManager, orderManager, generators) {
		this.exchangeManager = exchangeManager;
		this.orderManager = orderManager;
		this.generators = generators;
		generatorController
			.localGetGenerators({active: true})
			.then(gens => {
				for (let gen of gens) {
					this.generatorsConfig[gen.name] = gen;
				}
			});
		for (let gen of this.generators) {
			gen.on('signal', (sig) => this.addNewSignal(sig));
		}

		this.exchangeManager.on('ticker', () => this.checkSignals());
	}

	addNewSignal(sig) {
		if (!this.exchangeManager.isActive(sig.exchange)) {
			debug('%s - %s: Can\'t send signal to %s. Exchange not active', sig.generatorName, sig.symbol, sig.exchange);
			return;
		}
		if (this.generatorsConfig[sig.generatorName] == undefined) {
			debug('%s - %s: Can\'t handle signal. Generator not active', sig.generatorName, sig.symbol);
			return;
		}
		if (sig.currency == 'YOYO') {
			sig.currency = 'YOYOW';
			sig.symbol = sig.symbol.replace('YOYO', 'YOYOW');
		}
		let genConfig = this.generatorsConfig[sig.generatorName];
		sig.stopLossThreshold = sig.stopLossThreshold ? sig.stopLossThreshold : genConfig.stopLossThreshold;
		sig.takeProfitThreshold = sig.takeProfitThreshold ? sig.takeProfitThreshold : genConfig.takeProfitThreshold;
		sig.trailingLossMargin = genConfig.trailingLossMargin;
		sig.trailingLoss = genConfig.trailingLoss;
		//debug('Signal Received: %j', sig); return;
		signalController.localPostSignal(sig);
	}

	checkSignals() {
		if (!this.orderManager.ready)
			return;
		signalController
			.getWaitingSignals()
			.then(signals => {
				try {
					let newSignals = signals.filter(sig => !this.signals.some(sig2 => sig._id.equals(sig2._id)));
					if (newSignals.length > 0) {
						for (let sig of newSignals) {
							let marketPrice = this.exchangeManager.getAskPrice(sig.exchange, sig.symbol);
							debug('%s | New Signal for %s: %s | Price: %d | Current Market Price: %d', sig.generatorName, sig.exchange, sig.symbol, sig.price, marketPrice);
						}
					}
					this.signals = signals;
				} catch (e) {
					debug(e);
				}
				this.rejectTimedoutSignals();
				this.activateSuccessfulSignals();
			});
	}

	rejectTimedoutSignals() {
		signalController
			.rejectSignalsByKeepAlive(config.waitingSignalKeepAlive)
			.then((update) => {
				if (update.nModified != undefined && update.nModified > 0) {

					debug('%j signals rejected', update.nModified);
				} 
			});
	}

	activateSuccessfulSignals() {
		let debugMessage = '';
		for (let signal of this.signals) {
			let marketPrice = 0;
			try  {
				marketPrice = this.exchangeManager.getAskPrice(signal.exchange, signal.symbol);
			} catch (error) {
				debug('%s - %s Error getting price for signal: %s', signal.exchange, signal.symbol, error.message);
				continue;
			}

			if (marketPrice <= signal.price) {
				//debug('%s - %s | Market Price: %d | Signal Price: %d | Trying to create order', signal.exchange, signal.symbol, marketPrice, signal.price);
				this.orderManager
					.tryAndCreateOrderFromSignal(signal)
					.then((order) => {
						signal.status = 'active';
						signal.save();
						debug('ORDER CREATED: %s in %s | Price: %d | Cost: %d', signal.symbol, signal.exchange, order.price, (order.price*order.quantity).toFixed(5));
						this.signals = this.signals.filter(sig => !sig._id.equals(signal._id));
					})
					.catch(err => debug('%s - %s: Can\'t create order from signal. %s', signal.exchange, signal.symbol, err.message));
			} else {
				debugMessage += signal.exchange + ": " + signal.symbol + 
					" | Signal Price: " + signal.price + 
					" | Market Price " + 
					this.exchangeManager.getAskPrice(signal.exchange, signal.symbol) + "\n"; 
			}
		}
		if (debugMessage != "") debug("WAITING SIGNALS: \n" + debugMessage);
	}

}

module.exports = new SignalManager();