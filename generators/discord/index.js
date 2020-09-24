const Discord = require("discord.js");
const debug = require('debug')('cryptowolfie:DiscordGenerator');
const client = new Discord.Client();
const events = require('events');
const config = require("./config.json");

class GeneratorDiscord extends events.EventEmitter {

    constructor() {
		super();
        client.on("ready", () => {
            debug('Discord Generator initialized');
        });
        
        client.on("message", async message => {
            if (message.author.bot === false) 
                return;


            switch(message.channel.name) {
                case "cryptoping-signals":
                    this.onCryptoping(message);
                    break;
                case "base-play-bot":
                    this.onBasePlay(message);
                    break;
                case "sell-wall-bot":
                    this.onSellWall(message);
                    break;
                default:
                    debug("");
                    debug('Unknown Discord Message. Not Implemented');
                    debug(message.content);
                    debug("");
            }
        });

        client.login(config.cryptoBotToken);
    }

    onBasePlay(message) {
        if (message.embeds.length > 0 && message.embeds[0].description == "A base just cracked! New trade opportunity.") {
            debug('------------------------');
            debug('--NEW BASE PLAY SIGNAL--');
            debug('------------------------');
            let fields = message.embeds[0].fields;
            let sig = {};
            sig.exchange = fields.find(item => item.name == 'Exchange:').value.toLowerCase();
            sig.currency = fields.find(item => item.name == 'Coin:').value;
            sig.commodity = 'BTC';
            sig.symbol = sig.currency+"/"+sig.commodity;
            sig.price = fields.find(item => item.name == 'Entry:').value;
            sig.takeProfitThreshold = fields.find(item => item.name == 'Target:').value/sig.price;
            sig.stopLossThreshold = config.basePlayStopLoss;
            sig.trailingLossDown = true;
            sig.trailingLossDownMargin = (sig.takeProfitThreshold - 1)/2;
            sig.trailingLossDownThreshold = (sig.takeProfitThreshold - 1)/2 + 1;
            sig.trailingLoss = true;
            sig.generatorName = config.baseName;

            this.emit('signal', sig);
        } else if (message.embeds.length > 0 && message.embeds[0].description == "Target reached!") {
            let fields = message.embeds[0].fields;
            let cur = fields.find(item => item.name == 'Coin:').value;;
            let prof = fields.find(item => item.name == 'Profit:').value;
            let low = fields.find(item => item.name == 'Low:').value;
            let duration = fields.find(item => item.name == 'Duration:').value;
            let exchange = fields.find(item => item.name == 'Exchange:').value;
            debug('--------------------------------');
            debug('----BASE PLAY TARGET REACHED----');
            debug('%s/BTC - Profit: %s | Low: %s', cur, prof, low);
            debug('Duration: %s - Exchange: %s', duration, exchange);
            debug('--------------------------------');
        }
    }

    onSellWall(message) {
        debug('-------------------------');
        debug('--NEW SELL WALL MESSAGE--');
        debug('-------------------------');
        debug(message.content);
        let regexps = [
			new RegExp("^(.*)ALERT: Sell wall passed(.*)$", 'g'),
			new RegExp("^Sell wall for \\*\\*([A-Z]{3,5})\\*\\* was at (.*)$", 'g'),
			new RegExp("^\\*\\*Buy ([A-Z]{3,5})\\*\\* on (.*)$", 'g'),
			new RegExp("^\\*\\*Buy Below:\\*\\* (.*)$", 'g'),
			new RegExp("^T1:\\*\\* (.*)$", 'g'),
			new RegExp("^\\*\\*Stop loss:\\*\\* (.*)$", 'g'),
		];
        try {
            const msgArray = message.content.split(/\r?\n/g);
            if (!msgArray || !msgArray.length) {
                debug('msg array not exists');
                return false;
            }
            const sellWallArray = regexps[0].exec(msgArray[0]);
            if (!sellWallArray || !sellWallArray.length) {
                debug('Not Sell Wall');
                return false;
            }
            const priceBreakArray = regexps[1].exec(msgArray[1]);
            if (!priceBreakArray || !priceBreakArray.length) {
                debug('Not Price Break');
                return false;
            }
            const curExchangeArray = regexps[2].exec(msgArray[3]);
            if (!curExchangeArray || !curExchangeArray.length) {
                debug('Not Cur Exchange');
                return false;
            }
            const priceArray = regexps[3].exec(msgArray[6]);
            if (!priceArray || !priceArray.length) {
                debug('Not Price');
                return false;
            }
            const tpArray = regexps[4].exec(msgArray[8]);
            if (!tpArray || !tpArray.length) {
                debug('Not TP');
                return false;
            }
            const slArray = regexps[5].exec(msgArray[12]);
            if (!slArray || !slArray.length) {
                debug('Not sl');
                return false;
            }

            let sig = {};
            sig.exchange = curExchangeArray[2].toLowerCase();
            sig.currency = curExchangeArray[1];
            sig.commodity = 'BTC';
            sig.symbol = sig.currency+"/"+sig.commodity;
            sig.price = priceArray[1];
            sig.takeProfitThreshold = tpArray[1]/sig.price;
            sig.stopLossThreshold = slArray[1]/sig.price;
            sig.trailingLoss = true;
            sig.trailingLossDown = true;
            sig.trailingLossMargin = config.sellWallTLMargin;
            sig.generatorName = config.sellWallName;

            this.emit('signal', sig);
        } catch (err) {
            debug(err);
        }

    }

    onCryptoping(message) {

        let regexps = [
			new RegExp("^(.*)\\*\\*([A-Z]{3,5})\\*\\*$", 'g'),
			new RegExp("^Up signal on \\[(.*)\\](.*)$", 'g'),
			new RegExp("^(.*), price: (.*) BTC(.*)$", 'g'),
		];
        try {
            const msgArray = message.content.split(/\r?\n/g);
            if (!msgArray.length) {
                return false;
            }
            const curArray = regexps[0].exec(msgArray[0]);
            if (!curArray.length) {
                return false;
            }
            const exArray = regexps[1].exec(msgArray[1]);
            if (!exArray.length) {
                return false;
            }
            const priceArray = regexps[2].exec(msgArray[3]);
            if (!priceArray.length) {
                return false;
            }

            let sig = {};
            sig.exchange = exArray[1].toLowerCase();
            sig.currency = curArray[2];
            sig.commodity = 'BTC';
            sig.symbol = sig.currency+"/"+sig.commodity;
            sig.price = priceArray[2];
            sig.takeProfitThreshold = config.cryptopingTakeProfit;
            sig.stopLossThreshold = config.cryptopingStopLoss;
            sig.trailingLoss = false;
            sig.trailingLossDown = false;
            sig.trailingLossMargin = config.cryptopingTLMargin;
            sig.generatorName = config.cryptopingName;

            //debug(sig);return;
            this.emit('signal', sig);
        } catch (err) {
            debug(err);
        }
    }
}

module.exports = new GeneratorDiscord();