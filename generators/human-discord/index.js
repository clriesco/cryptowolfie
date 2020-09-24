const Discord = require("discord.js");
const debug = require('debug')('cryptowolfie:HumanDiscordGenerator');
const client = new Discord.Client();
const events = require('events');
const config = require("./config.json");

class GeneratorHumanDiscord extends events.EventEmitter {

    constructor() {
		super();
        client.on("ready", () => {
            debug('Human Discord Generator initialized');
        });
        
        client.on("message", async message => {

            switch(message.channel.id) {
                case "461836497906302976": //Cryptowolfie-test
                case "442391458423767060": //Base-cracks-binance
                    this.onBaseCracks(message, 'binance');
                    break;
                case "442391484407480320":
                    this.onBaseCracks(message, 'bittrex');
                    break;
                case "442391509980151818":
                    this.onBaseCracks(message, 'hitbtc');
                    break;
                default:
                    return;
            }
        });

        client.login(config.humanToken);
    }

    onCryptowolfie(message) {
        debug('----------------------------------');
        debug('--NEW HUMAN CRYPTOWOLFIE MESSAGE--');
        debug('----------------------------------');
        debug(message.content);
    }

    onBaseCracks(message, exchange) {
        debug('--------------------------------------------------------');
        debug('------NEW BASE CRACKS MESSAGE (exchange %s)------', exchange);
        debug('--------------------------------------------------------');
        debug("%s@%s (id: %s): ", message.author.username, message.channel.name, message.channel.id);
        debug(message.content);
        let regexps = [
			new RegExp("^(.*)/(.*), volume: (.*) BTC, price: (.*)$", 'g'),
			new RegExp("^(.*) below base of (.*)$", 'g')
		];
        try {
            const msgArray = message.content.split(/\r?\n/g);
            if (!msgArray || !msgArray.length) {
                debug('msg array not exists');
                return false;
            }
            const coinInfoArray = regexps[0].exec(msgArray[0]);
            if (!coinInfoArray || !coinInfoArray.length) {
                debug('Not coin info');
                return false;
            }
            const tpArray = regexps[1].exec(msgArray[1]);
            if (!tpArray || !tpArray.length) {
                debug('Not tp');
                return false;
            }

            if (coinInfoArray[2] != 'BTC') {
                debug('Commodity not BTC (%s)', coinInfoArray[2]);
            }

            let sig = {};
            sig.exchange = exchange;
            sig.currency = coinInfoArray[1];
            sig.commodity = coinInfoArray[2];
            sig.symbol = sig.currency+"/"+sig.commodity;
            sig.price = coinInfoArray[4];
            sig.takeProfitThreshold = tpArray[2]/sig.price;
            sig.stopLossThreshold = config.qflStopLoss;
            sig.trailingLoss = true;
            sig.trailingLossDown = true;
            sig.trailingLossMargin = config.qflTLMargin;
            sig.generatorName = config.qflName;

            this.emit('signal', sig);
        } catch (err) {
            debug(err);
        }

    }

}

module.exports = new GeneratorHumanDiscord();