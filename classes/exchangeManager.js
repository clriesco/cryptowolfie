'use strict'
const debug = require('../utils/custom-debug')('cryptowolfie:exchangeManager');
const config = require('../config');
const exchangeController = require('../api/controllers/exchangeController');
const generatorController = require('../api/controllers/generatorController');
const events = require('events');
const ccxt = require('ccxt');

class exchangeManager extends events.EventEmitter {

	constructor() {
		super();
		this.exchanges = {};
		this.generators = {};
    }
    
    async init() {
		return new Promise((resolve, reject) => {
			exchangeController
			.getActiveExchanges()
			.then(exchanges => {
				if (!exchanges.length) {
					debug('No active exchanges!');
					return reject();
				}
				for (let ex of exchanges) {
					this.exchanges[ex.name] = {
						model: ex,
						lib: new ccxt[ex.name]({
							apiKey: ex.apiKey,
							secret: ex.secret, 
							enableRateLimit: ex.enableRateLimit
						}),
						market: null,
						ticker: null,
						martingaleMaxSlots: ex.martingale ? Math.pow(2, ex.martingaleLevel + 1) : 0,
						martingaleSlots: 0,
						slots:{},
						balance: 0,
						balPerOrder: 0
					}
				}
				Promise.all([
					this.getMarkets(),
					this.getTickers(),
					this.updateWallet(),
					this.updateGenerators()
				]).then(() => {
					setInterval(this.getTickers.bind(this), config.tickerRefreshRate);
					return resolve();
				})

			});
		})
		
    }

	getMarkets() {
		let prom = []
		for (let ex in this.exchanges) {
			prom.push(this.exchanges[ex].lib.loadMarkets()
				.then(market => this.exchanges[ex].market = market)
			);
		}
		return Promise.all(prom);
	}

	async getTickers() {
		for (let ex in this.exchanges) {
			await this.exchanges[ex].lib
				.fetchTickers()
				.then(ticker => {
					this.exchanges[ex].ticker = ticker;
				})
				.catch(err => {
					debug(err.message);
				})
		} 
		this.emit('ticker', true);
	}

    getAskPrice(exchange, symbol) {
        if (this.exchanges[exchange] == undefined) {
           throw new Error('No info for exchange ' + exchange); 
        }
        if (this.exchanges[exchange].ticker[symbol] == undefined) {
           throw new Error('No info for symbol ' + symbol + ' in ' + exchange); 
        }
        return this.exchanges[exchange].ticker[symbol].ask;
	}
	
    getBidPrice(exchange, symbol) {
        if (this.exchanges[exchange] == undefined) {
           throw new Error('No info for exchange ' + exchange); 
        }
        if (this.exchanges[exchange].ticker[symbol] == undefined) {
           throw new Error('No info for symbol ' + symbol + ' in ' + exchange); 
        }
        return this.exchanges[exchange].ticker[symbol].bid;
	}

	updateSlots(orders) {
		let slotsInfo = {};

		for (let order of orders) {
			if (this.exchanges[order.exchange] == undefined) continue;
			if (slotsInfo[order.exchange] == undefined)
				slotsInfo[order.exchange] = {martingaleSlots: 0};
			if (slotsInfo[order.exchange][order.generatorName] == undefined)
				slotsInfo[order.exchange][order.generatorName] = {slots: 0, amount: 0};
			slotsInfo[order.exchange][order.generatorName].slots++;
			slotsInfo[order.exchange][order.generatorName].amount+= order.price*order.quantity;
			if (order.martingaleLevel > 0)
				slotsInfo[order.exchange].martingaleSlots += Math.pow(2, order.martingaleLevel + 1 ) - 2;
		}
		for (let exchange in this.exchanges) {
			let exAmount = 0;
			let weights = 0;
			for (let gen in this.generators){
				if (slotsInfo[exchange] !== undefined && slotsInfo[exchange][gen] !== undefined) {
					exAmount += slotsInfo[exchange][gen].amount;
					if (this.exchanges[exchange].slots == null) debug(this.exchanges[exchange]);
					this.exchanges[exchange].slots[gen].used = slotsInfo[exchange][gen].slots;
				} else {
					if (slotsInfo[exchange] == undefined) slotsInfo[exchange] = {};
					slotsInfo[exchange][gen] = {amount: 0, slots: 0};
				}
				weights += this.generators[gen].accuracy;
			}
			
			this.exchanges[exchange].martingaleSlots = slotsInfo[exchange].martingaleSlots || 0;
			exAmount += this.exchanges[exchange].balance;
			for (let gen in this.generators) {
				this.exchanges[exchange].slots[gen].balPerOrder = exAmount*this.generators[gen].accuracy/(weights*(this.exchanges[exchange].slots[gen].max+this.exchanges[exchange].martingaleMaxSlots));
				//debug('balPerOrder for %s in %s: %d', gen, exchange, this.exchanges[exchange].slots[gen].balPerOrder );
			}
		}
		
		
	}

	async updateWallet() {
		for (let exchange in this.exchanges) {
			await this.exchanges[exchange].lib
				.fetchBalance()
				.then(bal => {
					debug('%s Balance: %d', exchange,  bal.free['BTC']);
					this.exchanges[exchange].balance = bal.free['BTC'];
				});
		}
	}

	updateGenerators() {
		generatorController
			.localGetGenerators({active: true})
			.then(gens => {
				for (let ex in this.exchanges) {
					for (let gen of gens) {
						this.exchanges[ex].slots[gen.name] = { 
							max: gen.slots,
							used: 0,
							balPerOrder: 0
						}
						if (this.generators[gen.name] == undefined) 
							this.generators[gen.name] = gen;
					}
				}
			});
	}

	getAvailableBalanceFor(exchange, quote, leverage, generator) {
        if (this.exchanges[exchange] == undefined) {
		   debug('No balance for exchange ' + exchange); 
		   return 0;
        }
        if (this.exchanges[exchange].balance == 0) {
		   debug('No balance for asset ' + quote + ' in ' + exchange); 
		   return 0;
		}
		let balPerOrder = this.exchanges[exchange].slots[generator].balPerOrder;
		if (this.exchanges[exchange].model.maxBTCPerOrder > 0 && this.exchanges[exchange].model.maxBTCPerOrder < balPerOrder)
			balPerOrder = this.exchanges[exchange].model.maxBTCPerOrder;

		if (leverage > 0) {
			let slotsToCover = Math.min(this.exchanges[exchange].martingaleMaxSlots - this.exchanges[exchange].martingaleSlots, Math.pow(2, leverage));
			return Math.min(balPerOrder*slotsToCover, this.exchanges[exchange].balance);
		}

		return Math.min(balPerOrder, this.exchanges[exchange].balance);
	}

	getQuantity(order, bal, price = order.price) {
		let amount = bal/price;
		let market = this.exchanges[order.exchange].market[order.symbol];
		amount = Math.floor(amount*Math.pow(10,market.precision.amount))/Math.pow(10, market.precision.amount);
		return amount;
	}

	getSlotsFor(exchange, generator, leverage) {
        if (this.exchanges[exchange] == undefined) {
		   debug('Exchange %j missing', exchange); 
		   return 0;
		}
		if (leverage) {
			return this.exchanges[exchange].martingaleMaxSlots - this.exchanges[exchange].martingaleSlots;
		}
        return this.exchanges[exchange].slots[generator].max - this.exchanges[exchange].slots[generator].used;
	}

	placeOrder(order) {
		return new Promise((resolve, reject) => {
			this.testLimits(order)
				.then(() => this.exchanges[order.exchange].lib.createLimitBuyOrder(order.symbol, order.quantity, order.price))
				.then(res => {
					this.exchanges[order.exchange].slots[order.generatorName].used++;
					resolve(res);
				})
				.catch(err => reject(err))
		});
	}

	placeMartingaleOrder(order, price, quantity) {
		return new Promise((resolve, reject) => {
			this.testLimits(order)
				.then(() => this.exchanges[order.exchange].lib.createLimitBuyOrder(order.symbol, quantity, price))
				.then(res => {
					let slots = Math.ceil(price / this.exchanges[order.exchange].slots[order.generatorName].balPerOrder);
					debug('[Martingale] %s - %s: La Orden ha costado %d BTC y ha ocupado %d slots', order.exchange, order.symbol, price, slots);
					this.exchanges[order.exchange].martingaleSlots += slots;
					resolve(res);
				})
				.catch(err => reject(err))
		});
	}

	closeOrder(order, price) {
		return new Promise((resolve, reject) => {
			this.testLimits(order, price)
				.then(() => this.exchanges[order.exchange].lib.createLimitSellOrder(order.symbol, order.quantity, price))
				.then(res => {
					this.exchanges[order.exchange].slots[order.generatorName].used--;
					resolve(res);
				})
				.catch(err => reject(err))
		});
	}

	closeMartingaleOrder(order, price, quantity) {
		debug('Closing %s order with qty %d', order.symbol, quantity);
		return new Promise((resolve, reject) => {
			this.testLimits(order, price, quantity)
				.then(() => this.exchanges[order.exchange].lib.createLimitSellOrder(order.symbol, quantity, price))
				.then(res => {
					debug('Closed order with qty %d (Sell Order Id = %s) ', quantity, res.id);
					resolve(res);
				})
				.catch(err => reject(err))
		});
	}

	testLimits(order, price = order.price, quantity = order.quantity) {
		return new Promise((resolve, reject) => {
			let limits = this.exchanges[order.exchange].market[order.symbol].limits;
			if (limits.amount.min != undefined && quantity < limits.amount.min) return reject(new Error('Order quantity below MIN limits'));
			if (limits.amount.max != undefined && quantity > limits.amount.max) return reject(new Error('Order quantity above MAX limits'));
			if (limits.price.min != undefined && price < limits.price.min) return reject(new Error('Order price below MIN limits'));
			if (limits.price.max != undefined && price > limits.price.max) return reject(new Error('Order price above MAX limits'));
			if (limits.cost != undefined && limits.cost.min != undefined && price*quantity < limits.cost.min) return reject(new Error('Order cost below MIN limits'));
			if (limits.cost != undefined && limits.cost.max != undefined && price*quantity > limits.cost.max) return reject(new Error('Order cost above MAX limits'));
			
			return resolve();
		});
	}

	async getOrderInfo(ex, orderId, symbol) {
		return await this.exchanges[ex].lib.fetchOrder(orderId, symbol);
	}

	async cancelOrder(order) {
		return await this.exchanges[order.exchange].lib.cancelOrder(order.exchangeBuyId, order.symbol);
	}

	isActive(exchange) {
		return this.exchanges[exchange] !== undefined;
	}

	canMartingale(exchange, orderMartingaleLevel) {
		if (!this.exchanges[exchange].model.martingale) {
			//debug('%s: Martingale Disabled', exchange); 
			return false;
		}
		if (orderMartingaleLevel >= this.exchanges[exchange].model.martingaleLevel)
			return false;
		return true;
	}

	async fetchAllMartingaleOrders(order) {
		let orders = await this.exchanges[order.exchange].lib.fetchClosedOrders(order.symbol);
		return orders;
	}
}

module.exports = new exchangeManager();
