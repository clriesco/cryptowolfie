'use strict'
const debug = require('../utils/custom-debug')('cryptowolfie:orderManager');
const orderController = require('../api/controllers/orderController');
const moment = require('moment');
const config = require('../config');

class OrderManager {

	constructor() {
		this.orders = [];
		this.fillingOrders = [];
		this.ready = false;
    }

	async init(exchangeManager) {
		this.exchangeManager = exchangeManager;
		this.exchangeManager.on('ticker', () => {
			this.loadOrders();
		});

		return await this.loadOrders();
	}
	
	async loadOrders() {
		return await orderController
			.getAllActiveOrders()
			.then((orders) => {
				this.orders = orders;
				this.exchangeManager.updateSlots(orders);
				this.checkPrices();
				this.checkFillingOrders();
				this.ready = true;
			});
	}

	async checkFillingOrders() {
		let fillingOrders = this.orders.filter(ord => ord.status == 'filling');
		if (fillingOrders.length > 0) {
			this.exchangeManager.updateWallet();
		} 
		for (let order of fillingOrders) {
			let orderInfo = await this.exchangeManager.getOrderInfo(order.exchange, order.exchangeBuyId, order.symbol);
			order.quantity = orderInfo.filled;
			if (orderInfo.status == 'closed') {
				order.status = 'active';
				order.save();
			} else {
				let percent = Math.floor(orderInfo.filled*100/orderInfo.amount);
				debug('Order %s: %d% filled', order.symbol, percent);
			}
		}
	}

	checkPrices() {
		for (let order of this.orders) {
			let marketPrice = this.exchangeManager.getBidPrice(order.exchange, order.symbol);
			order.priceHistory.push({price: marketPrice, date: Date.now()});

			//Losing Order
			if (marketPrice < order.price*order.stopLossThreshold) {
				if (this.exchangeManager.canMartingale(order.exchange, order.martingaleLevel)) {
					this.executeMartingale(order, marketPrice);
				} else if (order.martingaleLevel > 0) {
					this.loseMartingaleOrder(order, marketPrice);
				} else this.loseOrder(order, marketPrice);
				continue;
			}	

			//Trailing Loss Down
			if (order.trailingLossDown && (marketPrice >= order.price*order.trailingLossDownThreshold)) {
				debug("%s | %s | Market Price: %s | Order Price: %s | Half Target reached. Activating trailing loss Down", 
					order.exchange, 
					order.symbol, 
					marketPrice, 
					order.price
				);
				order.stopLossThreshold = marketPrice/order.price - order.trailingLossDownMargin;
				order.trailingLossDownThreshold = marketPrice/order.price;
			}

			//Trailing Loss, Not reached before
			if (order.trailingLoss && !order.trailingLossReached) {
				if (marketPrice > order.price*order.takeProfitThreshold) {
					debug("%s | %s | Market Price: %s | Order Price: %s | Target reached. Activating trailing loss", 
						order.exchange, 
						order.symbol, 
						marketPrice, 
						order.price
					);
					order.trailingLossReached = true;
					let profitPercent = marketPrice/order.price;
					order.trailingLossThreshold = profitPercent - order.trailingLossMargin;
				}
				order.save();
				continue;
			} 
			
			//Trailing Loss, reached.
			if (order.trailingLoss && order.trailingLossReached) {
				if (marketPrice > order.price*(order.trailingLossThreshold + order.trailingLossMargin)) {
					let profitPercent = marketPrice/order.price;
					let oldTrailingLoss = order.trailingLossThreshold;
					order.trailingLossThreshold = profitPercent - order.trailingLossMargin;
				} else if (marketPrice <= order.price*order.trailingLossThreshold){
					this.winOrder(order, order.price*order.trailingLossThreshold);
				} 
				order.save();
				continue;
			} 

			//Not Trailing loss, wining order
			if (marketPrice >= order.price*order.takeProfitThreshold) {
				if (order.martingaleLevel > 0)
					this.winMartingaleOrder(order, marketPrice);
				else this.winOrder(order, marketPrice);
			} else {
				//Not Trailing loss, between normal range.
				order.save();
			}
		}
		this.logOpenOrders();
	}

	tryAndCreateOrderFromSignal(signal) {
		return new Promise((resolve, reject) => {
			let bal = this.exchangeManager.getAvailableBalanceFor(signal.exchange, signal.commodity, 0, signal.generatorName);
			if (bal <= 0) return reject(new Error ('No balance for commodity'));

			let slots = this.exchangeManager.getSlotsFor(signal.exchange, signal.generatorName, false);
			if (slots <= 0) return reject(new Error ('No free slots for generator '+signal.generatorName));

			//Creamos la orden a partir de la señal
			let order = orderController.createOrderFromSignal(signal);
			order.price = this.exchangeManager.getAskPrice(order.exchange, order.symbol);
			order.quantity = this.exchangeManager.getQuantity(order, bal);
			this.exchangeManager
				.placeOrder(order)
				.then(res => {
					order.exchangeBuyId = res.id;
					order.status = 'filling';
					order.signalId = signal._id;
					order.save();
					this.orders.push(order);
					return resolve(order);
				})
				.catch(err => {
					debug("Error trying to create order %s in %s (cost: %d): %s", order.symbol, order.exchange, order.price*order.quantity, err.message);
					reject(err);
				});
		});
	}

	winOrder(order, closePrice) {
		if (order.status != 'active' && order.status != 'filling') {
			debug('Can\'t close order. Status is %s', order.status);
		}

		if (order.status == 'filling') {
			this.exchangeManager
			.cancelOrder(order)
			.then(res => {	
				this.exchangeManager.closeOrder(order, closePrice)
			})
			.then(res => {
				order.exchangeSellId = res.id;
				order.status = 'won';
				order.closePrice = closePrice;
				order.closeDate = Date.now();
				order.save();
				this.orders = this.orders.filter(ord => !ord._id.equals(order._id));
				debug('%s: +++WON+++ | Initial Price: %d, Last Price %d (%d%), TP: %d%', 
					order.symbol, 
					order.price, order.closePrice, 
					parseFloat((order.closePrice/order.price -1)*100).toFixed(2),
					(order.takeProfitThreshold*100 - 100).toFixed(2)
				);
			})
			.catch(err => {
				debug('ERROR closing order after cancelling: %s: ', err.message);
			});
		} else {
			this.exchangeManager
				.closeOrder(order, closePrice)
				.then(res => {
					order.exchangeSellId = res.id;
					order.status = 'won';
					order.closePrice = closePrice;
					order.closeDate = Date.now();
					order.save();
					this.orders = this.orders.filter(ord => !ord._id.equals(order._id));
					debug('%s: +++WON+++ | Initial Price: %d, Last Price %d (%d%), TP: %d%', 
						order.symbol, 
						order.price, order.closePrice, 
						parseFloat((order.closePrice/order.price -1)*100).toFixed(2),
						(order.takeProfitThreshold*100 - 100).toFixed(2)
					);
				})
				.catch(err => debug("Error wining order: %s", err.message));
		}
	}

	loseOrder(order, closePrice) {
		if (order.status != 'active') {
			debug('Can\'t close order. Status is %s', order.status);
		}
		this.exchangeManager
			.closeOrder(order, closePrice)
			.then(res => {
				if  (closePrice > order.price) {
					order.status = 'tld';
				} else {
					order.status = 'lost';
				}
				order.exchangeSellId = res.id;
				order.closePrice = closePrice;
				order.closeDate = Date.now();
				order.save();
				this.orders = this.orders.filter(ord => !ord._id.equals(order._id));
				debug('%s: ---%s--- | Initial Price: %d, Last Price %d (%d%), SL: %d%', 
					order.symbol, 
					order.status.toUpperCase(),
					order.price, order.closePrice, 
					parseFloat((order.closePrice/order.price -1)*100).toFixed(2),
					(order.stopLossThreshold*100 - 100).toFixed(2)
				);
			})
			.catch(err => debug("Error losing order %s in %s (cost: %d): %s", order.symbol, order.exchange, order.price*order.quantity, err.message));
	}

	async winMartingaleOrder(order, closePrice) {
		debug('Let\'s win martingale order');
		if (order.status != 'active') {
			debug('Can\'t close order. Status is %s', order.status);
		}
		let orderIds = order.martingaleBuyIds;
		orderIds.push(order.exchangeBuyId);
		debug('Getting all orders for symbol %d', order.symbol );
		let allOrders = [];
		try {
			allOrders = await this.exchangeManager.fetchAllMartingaleOrders(order);
		} catch (err) {
			debug(err.message);
			setTimeout(() => {this.winMartingaleOrder(order, closePrice)}, 3000);
		}

		debug('%d orders received', allOrders.length);
		let promises = [];
		for (let ord of allOrders) {
			if (orderIds.includes(ord.id)) {
				debug('Going to close order with price %d and amount %d', order.price, ord.amount);
				promises.push(this.exchangeManager.closeMartingaleOrder(order, order.price, ord.amount));
			}
		}
		Promise.all(promises)
			.then(results => {
				for (let res of results) {
					order.martingaleSellIds.push(res.id);
				}
				order.status = 'won';
				order.closePrice = closePrice;
				order.closeDate = Date.now();
				order.save();
				this.orders = this.orders.filter(ord => !ord._id.equals(order._id));
				this.exchangeManager.updateSlots(this.orders);
				debug('%s: +++WON+++ | Initial Price: %d, Last Price %d (%d%), SL: %d%, Martingale Level: %d', 
					order.symbol, 
					order.price, order.closePrice, 
					parseFloat((order.closePrice/order.price -1)*100).toFixed(2),
					(order.stopLossThreshold*100 - 100).toFixed(2),
					order.martingaleLevel
				);
			});
	}

	async loseMartingaleOrder(order, closePrice) {
		if (order.status != 'active') {
			debug('Can\'t close order. Status is %s', order.status);
		}
		let orderIds = order.martingaleBuyIds;
		orderIds.push(order.exchangeBuyId);
		let allOrders = [];
		try {
			allOrders = await this.exchangeManager.fetchAllMartingaleOrders(order);
				
		} catch (err) {
			debug(err.message);
			setTimeout(() => {this.loseMartingaleOrder(order, closePrice)}, 3000);
		}
		let promises = [];
		for (let ord of allOrders) {
			if (orderIds.includes(ord.id)) {
				promises.push(this.exchangeManager.closeMartingaleOrder(order, ord.price, ord.amount));
			}
		}
		Promise.all(promises)
			.then(results => {
				for (let res of results) {
					order.martingaleSellIds.push(res.id);
				}
				order.status = 'lost';
				order.closePrice = closePrice;
				order.closeDate = Date.now();
				order.save();
				this.orders = this.orders.filter(ord => !ord._id.equals(order._id));
				this.exchangeManager.updateSlots(this.orders);
				debug('%s: ---LOST--- | Initial Price: %d, Last Price %d (%d%), SL: %d%, Martingale Level: %d', 
					order.symbol, 
					order.price, order.closePrice, 
					parseFloat((order.closePrice/order.price -1)*100).toFixed(2),
					(order.stopLossThreshold*100 - 100).toFixed(2),
					order.martingaleLevel
				);
			});
	}

	logOpenOrders() {
		if (!this.orders.length) 
			return;
		debug("OPEN ORDERS:");
		for (let order of this.orders) {
			let debugTL = '';
			let marketPrice = this.exchangeManager.getBidPrice(order.exchange, order.symbol);
			if (order.trailingLossReached) debugTL = ' | TL: ' + (order.trailingLossThreshold*100 - 100).toFixed(2) + "%";
			debug(order.exchange + ": " + order.symbol + 
						" | Order Price: " + order.price + 
						" | Market Price " + marketPrice + 
						" | SL: " + (order.stopLossThreshold*100 - 100).toFixed(2) + "%" + 
						" | TP: " + (order.takeProfitThreshold*100 - 100).toFixed(2) + "%" + 
						debugTL + 
						" | Current: " + parseFloat((marketPrice/order.price -1)*100).toFixed(2) + "%" +
						" | Cost: " + (order.price*order.quantity).toFixed(5)

					); 
		}
	}

	executeMartingale(order, mPrice) {
		let leverage = order.martingaleLevel + 1;
		this.exchangeManager.updateSlots(this.orders);
		let bal = this.exchangeManager.getAvailableBalanceFor(order.exchange, order.commodity, leverage, order.generatorName);
		if (bal <= 0) {
			debug ('No balance for martingale');
		}

		let mQuantity = this.exchangeManager.getQuantity(order, bal, mPrice);
		debug('Current qty: %d | Next qty: %d | Current Order Price: %d | Next order Price: %d | Martingale Level: %d ', 
			order.quantity,
			mQuantity,
			order.price,
			mPrice,
			leverage
		);
		let newQuantity = mQuantity + order.quantity;
		let newPrice = (order.price*order.quantity + mPrice*mQuantity) / (order.quantity + mQuantity);
		newPrice = parseFloat(newPrice.toFixed(8));
		debug('Avg price: %d | Total Quantity: %d | New SL Price: %d | New TP Price: %d', 
			newPrice, 
			newQuantity, 
			newPrice*order.stopLossThreshold,
			newPrice*order.takeProfitThreshold
		);
		this.exchangeManager
			.placeMartingaleOrder(order, mPrice, mQuantity)
			.then((res) => {
				order.price = newPrice;
				order.quantity = newQuantity;
				order.martingaleBuyIds.push(res.id)
				order.martingaleLevel++;
				debug('Martingale Order placed. %d %s at %d %s with id %s', mQuantity, order.currency, mPrice, order.commodity, res.id);
				order.save();
			})
	}
}

module.exports = new OrderManager();