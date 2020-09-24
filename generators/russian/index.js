const debug = require('debug')('cryptowolfie:RussianGenerator');
const events = require('events');
const ccxt = require('ccxt');
const config = require('./config.json');

class RussianGenerator extends events.EventEmitter {

    constructor() {
        super();

        this.symbol = config.symbol;
        this.showDebug = false;
        this.signal = "";
        this.signalAge = 0;
        this.signalParsed = false;

        this.candleProps = {
            Timestamp: [],
            open: [],
            high: [],
            low: [],
            close: [],
            volume: [],
            trades: []
        };

        this.lastCandle = {
            open: 0,
            high: 0,
            low: 0,
            close: 0,
            volume: 0,
            vwp: 0,
            trades: 0,
            Timestamp: 0
        };
	
        this.indic = { // индикаторные переменные
            changeUp : [], // рост (close - open) или 0
            changeDn : [],  // падение (close - open) или 0
            rmaUp1 : [],
            rmaDn1 : [],
            rmaUp2 : [],
            rmaDn2 : [],
            rsi1 : [],
            rsi2 : [],	
            body : [], // Candle Length (Close - Open)
            abody : [], // average body (last 10 candles)
            bar : [],  // 1: Last bar Close > Last bar Open. 0: Last bar Close == Last bar Open. -1: Last bar Close < Last bar Open
            
            max3:[],
            bodydivmax3:[],
            firstbullishopen:[],
            firstbearishopen:[],
            sma:[],
            meanfulbar:[], // значимая свеча. если длина больше средней, деленной на делитель, например (3). в некоторых индикаторах и стратегиях учитываются только значимые бары
            countmeanfulbullish:[],
            countmeanfulbearish:[],
        };

        this.strategy = {
            position_size : 0,
            equity : 1000,
            capital :100,
            position_avg_price : 0 ,
            profit: [],
            mult: [],
            lot: []
        }
        this.exchange = new ccxt[config.exchange]({enableRateLimit: true });
        this.lastCandleTime = new Date();

        this.init();
    }

    async init() {	
        const hourms = 1000 * 60 * 60;
        let ohlcv = await this.exchange.fetchOHLCV (this.symbol, config.timeFrame , undefined, config.requiredHistory + 1 );
        for (var i = ohlcv.length - config.requiredHistory - 1 ; i < ohlcv.length - 1  ; i++) {
            this.pushCandle(ohlcv[i])
            this.advice();
        }
        let lastCandle = ohlcv[ohlcv.length - 1];//taking unovered candle
        this.lastCandleTime.setTime(lastCandle[0]);
        this.fetchNewCandle();
        setInterval(this.fetchNewCandle.bind(this), config.candlesRefreshRate);
        this.showDebug = true;
        debug('Russian Generator initialized');
    }

    async fetchNewCandle() {
        try{
            let ticker = await this.exchange.fetchTicker (this.symbol);
            let CurrentTime = new Date();
            CurrentTime.setTime(ticker.timestamp);
            if(CurrentTime.getHours()  > this.lastCandleTime.getHours() ){
                //new period
                this.lastCandleTime = CurrentTime;

                let ohlcv2 = await this.exchange.fetchOHLCV (this.symbol, config.timeFrame, undefined, 2);
                let lastCandle = ohlcv2[0];
                //getting current unfinished candle and previous - finished and good one.
                this.pushCandle(lastCandle);
                //log.yellow (lastCandle)
                this.advice();
            }
        } catch (e){
            debug(e.message);
        }
    }

    CreateBotString(str){
        return "pos=" + this.strategy.position_size + " " + this.symbol + " " + str + " price=" + this.lastCandle.close + " @ " + MyStrDate(this.lastCandle.Timestamp);
    }

    CreateDebugString(str){
        return this.symbol + " " + str + " Open=" + this.lastCandle.open + ", Close=" + this.lastCandle.close + " @ " + MyStrDate(this.lastCandle.Timestamp);
    }
    
    advice(){
        const len = this.candleProps.close.length - 1;

        const bar = this.indic.bar[len]
        const cls = this.lastCandle.close
        const opn = this.lastCandle.open
        const body = this.indic.body[len]
        const abody = this.indic.abody[len]
        const rsi1 = this.indic.rsi1[len]
        const rsi2 = this.indic.rsi2[len]
        const up1 = 
                (bar == -1) && 
                (this.strategy.position_size == 0 || cls < this.strategy.position_avg_price) &&
                (rsi1 < config.rsilimit1) &&
                (body > (abody / 5)) &&
                config.usersi1 == true

        const dn1 = bar ==  1 && (this.strategy.position_size == 0 || cls > this.strategy.position_avg_price) && rsi1 > (100 - config.rsilimit1) && (body > (abody / 5)) && config.usersi1

        const up2 = bar == -1 && (this.strategy.position_size == 0 || cls < this.strategy.position_avg_price) && rsi2 < config.rsilimit2 && body > abody / 5 && config.usersi2

        const dn2 = bar == 1 && (this.strategy.position_size == 0 || cls > this.strategy.position_avg_price) && rsi2 > (100 - config.rsilimit2) && body > abody / 5 && config.usersi2

        const norma = rsi1 > config.rsilimit1 && rsi1 < (100 - config.rsilimit1) && rsi2 > config.rsilimit2 && rsi2 < (100 - config.rsilimit2)

        var exitUp = this.strategy.position_size > 0 && bar == 1 && norma && body > abody / 2
        var exitDn = this.strategy.position_size < 0 && bar == -1 && norma && body > abody / 2
        
        const up3 =   (simpleMovingAVG(this.indic.bar.slice(-3) , 3) == -1) && (cls < this.indic.firstbullishopen[len]) && (this.strategy.position_size == 0 || cls < this.strategy.position_avg_price) && (body > abody / 5) && (config.useSMAfilter == false || cls < this.indic.sma[len])
        const up4 = (bar == -1) && (body > this.indic.max3[len] * 3) && (this.strategy.position_size == 0 || cls < this.strategy.position_avg_price) && (body > abody / 5) && ( config.useSMAfilter == false || cls < this.indic.sma[len])
        const up5 = (bar == -1) && (opn / cls > config.percentLongBar);

        const dn3 =  simpleMovingAVG(this.indic.bar.slice(-3) , 3) == 1 && (cls > this.indic.firstbearishopen[len]) && (this.strategy.position_size == 0 || cls > this.strategy.position_avg_price) && body > abody / 5 && (config.useSMAfilter == false || cls > this.indic.sma[len])
        const dn4 = bar == 1 && body > this.indic.max3[len] * 3 && (this.strategy.position_size == 0 || cls > this.strategy.position_avg_price) && body > abody / 5 && (config.useSMAfilter == false || cls > this.indic.sma[len]);
        const dn5 = bar == 1 && (cls / opn > config.percentLongBar);
        up5 && debug(this.CreateDebugString('Caída: '+ up5));
        dn5 && debug(this.CreateDebugString('Subida: '+ dn5));

        return;
        if (config.needLong){
            //debug('Long: %s, %s, %s, %s, %d, %d', up1, up2, up3 && config.useBar3, up4, this.strategy.position_size, config.maxposition);
            if ((up1 || up2 || (up3 && config.useBar3)  || up4) && this.strategy.position_size < config.maxposition) {
                this.PutSignal("Long", this.CreateBotString("LONG up1(RSI7)=" + up1 + " up2(RSI14)=" + up2 + " up3(BAR3)=" +up3+" up4(LONGBAR)="+up4))
            } else if (exitUp){
                if (this.showDebug)debug('Exit up');
                this.PutSignal("Close Long", this.CreateBotString("CLOSE_LONG "))
            }
        }
        
        if (config.needShort){
            //debug('Short: %s, %s, %s, %s, %d, %d', dn1, dn2, dn3 && config.useBar3, dn4, this.strategy.position_size, config.maxposition);
            if ((dn1 || dn2 || (dn3 && config.useBar3) || dn4) && this.strategy.position_size > - config.maxposition) {
                this.PutSignal("Short", this.CreateBotString("SHORT DN1(RSI7)=" + dn1 + " DN2(RSI14)=" + dn2 + " DN3(BAR3)=" +dn3+" DN4(LONGBAR)="+dn4))
            } else if (exitDn){
                this.PutSignal("Close Short", this.CreateBotString("CLOSE_SHORT"))
            }
        }	

    }

    PutSignal(signal, comment){
        if (this.showDebug)
            debug(comment);
        //TODO: Send Signal to database

        this.signal = signal
        this.signalAge = this.age
        this.signalParsed = false
        switch (signal) {
            case "Long":
                this.strategy.position_size ++
                this.strategy.position_avg_price = (this.lastCandle.close + this.strategy.position_avg_price*(this.strategy.position_size - 1)) / this.strategy.position_size
                break;
            case "Close Long":
                this.strategy.position_size = 0
                break;
            case "Short":
                this.strategy.position_size --
                this.strategy.position_avg_price = (this.lastCandle.close + this.strategy.position_avg_price*(Math.abs(this.strategy.position_size) - 1)) / Math.abs(this.strategy.position_size)
                break;
            case "Close Short":
                this.strategy.position_size = 0
                break;

            default:
                break;
        }

    }
	
    processIndicators() {
        const len = this.indic.changeUp.length;
        
        this.indic.changeUp[len] = (this.lastCandle.close > this.lastCandle.open ? this.lastCandle.close - this.lastCandle.open : 0.0).toFixed(6)
        const chUp = this.indic.changeUp[len]
        this.indic.changeDn[len] = (this.lastCandle.close < this.lastCandle.open ? - (this.lastCandle.close - this.lastCandle.open) : 0.0).toFixed(6)
        const chDn = this.indic.changeDn[len]
        
        this.indic.rmaUp1[len] = len == 0 ? 0 : ((  +(this.indic.rmaUp1[len-1]) * (config.fastRSIperiod-1)) + parseFloat(chUp)) / config.fastRSIperiod 
        this.indic.rmaDn1[len] = len == 0 ? 0 : ((  +(this.indic.rmaDn1[len-1]) * (config.fastRSIperiod-1)) + parseFloat(chDn)) / config.fastRSIperiod 
        this.indic.rmaUp2[len] = len == 0 ? 0 : ((  +(this.indic.rmaUp2[len-1]) * (config.slowRSIperiod-1)) + parseFloat(chUp)) / config.slowRSIperiod 
        this.indic.rmaDn2[len] = len == 0 ? 0 : ((  +(this.indic.rmaDn2[len-1]) * (config.slowRSIperiod-1)) + parseFloat(chDn)) / config.slowRSIperiod 

        this.indic.rsi1[len] = (this.indic.rmaDn1[len] == 0 ? 100 : this.indic.rmaUp1[len] == 0 ? 0 : 100 - (100 / (1+parseFloat(this.indic.rmaUp1[len]) / this.indic.rmaDn1[len]))).toFixed(6)
        this.indic.rsi2[len] = (this.indic.rmaDn2[len] == 0 ? 100 : this.indic.rmaUp2[len] == 0 ? 0 : 100 - (100 / (1+parseFloat(this.indic.rmaUp2[len]) / this.indic.rmaDn2[len]))).toFixed(6)
        this.indic.body[len] = (Math.abs(this.lastCandle.close - this.lastCandle.open)).toFixed(6)
        this.indic.abody[len] = simpleMovingAVG(this.indic.body.slice(-10) , 10).toFixed(6)
        this.indic.bar[len] = this.lastCandle.close > this.lastCandle.open ? 1 : this.lastCandle.close < this.lastCandle.open ? - 1 : 0 


        this.indic.max3[len] = len < 4 ? 1 : Math.max(this.candleProps.close[len-1], this.candleProps.close[len-2], this.candleProps.close[len-3], this.candleProps.open[len-1], this.candleProps.open[len-2], this.candleProps.open[len-3]) - Math.min(this.candleProps.close[len-1], this.candleProps.close[len-2], this.candleProps.close[len-3], this.candleProps.open[len-1], this.candleProps.open[len-2], this.candleProps.open[len-3]) 
        this.indic.bodydivmax3[len] = (this.lastCandle.close - this.lastCandle.open)/this.indic.max3[len]
        this.indic.firstbullishopen[len] = len == 0 ? 0 : this.indic.bar[len] == 1 && this.indic.bar[len-1] != 1 ? this.lastCandle.open : this.indic.firstbullishopen[len-1]
        this.indic.firstbearishopen[len] = len == 0 ? 0 : this.indic.bar[len] == -1 && this.indic.bar[len-1] != -1 ? this.lastCandle.open : this.indic.firstbearishopen[len-1]
        this.indic.sma[len] = simpleMovingAVG(this.candleProps.close.slice(-config.SMAfilterlimit) , config.SMAfilterlimit)
        
        this.indic.meanfulbar[len] = this.indic.body[len] > this.indic.abody[len] / config.meanfulbardiv;
        this.indic.countmeanfulbullish[len] = len == 0 ? this.indic.bar[len]==1 ? 1 : 0 : this.indic.meanfulbar[len] ? this.indic.bar[len]==1 ? this.indic.countmeanfulbullish[len-1] + 1 : 0 : this.indic.countmeanfulbullish[len-1]
        this.indic.countmeanfulbearish[len] = len == 0 ? this.indic.bar[len]==-1 ? 1 : 0 : this.indic.meanfulbar[len] ? this.indic.bar[len]==-1 ? this.indic.countmeanfulbearish[len-1] + 1 : 0 : this.indic.countmeanfulbearish[len-1]
    }

    pushCandle(Candle) {
        this.age ++
        this.lastCandle.close = Candle[4];
        this.lastCandle.open = Candle[1];
        this.lastCandle.high = Candle[2];
        this.lastCandle.low = Candle[3];
        this.lastCandle.volume = Candle[5];
        this.lastCandle.Timestamp = Candle[0];
        
        //debug(MyStrDate(this.lastCandle.Timestamp));

        const length = this.candleProps.close.length;
        this.candleProps.close[length] = this.lastCandle.close;
        this.candleProps.open[length] = this.lastCandle.open;
        this.candleProps.high[length] = this.lastCandle.high         // High price
        this.candleProps.low[length] = this.lastCandle.low       // Low price
        this.candleProps.volume[length] = this.lastCandle.volume         // Volume
        this.candleProps.Timestamp[length] = this.lastCandle.Timestamp        // Candle Timestamp
        this.processIndicators();
        
        //debug ("Close: "+ this.lastCandle.close+", FastRSI-7: " + this.indic["rsi1"][length] + ", SlowRSI-14: "+ this.indic["rsi2"][length] + ", BODYDIVMAX3=" +this.indic["bodydivmax3"][length].toFixed(2)+ ", Meanful=" + this.indic.meanfulbar[length] + ", MeanfulUp=" + this.indic.countmeanfulbullish[length] + ", MeanfulDn=" + this.indic.countmeanfulbearish[length]+ ", body="+ this.indic.body[length]+ ", abody="+this.indic.abody[length])


        for (var prop in this.candleProps)if (this.candleProps[prop].length > config.requiredHistory )this.candleProps[prop].splice(0,1)
        for (var prop in this.indic) {
            if (this.indic[prop].length > config.requiredHistory )this.indic[prop].splice(0,1)
        } 
        
        return true;
    }
}

var MyStrDate = function(tst){
    let CurrentTime = new Date();
    CurrentTime.setTime(tst);
    CurrentTime.addHours(2);
    return CurrentTime.toLocaleString ( 'es-ES', { timeZone: 'Europe/Madrid' });
} 

var simpleMovingAVG = function(dataObjArray, timePeriods){
	var sum = 0;
	var result = false;
	try{
		for(var i = Math.min(timePeriods - 1, dataObjArray.length - 1); i > -1; i --){
			sum += parseFloat(dataObjArray[i]);
		}
		result = (parseFloat(sum) / parseFloat(Math.min(timePeriods, dataObjArray.length)));
		//console.log('SMA Result : ' + result);
	} catch(err) {
		result = false;
		debug("SMA Error : " + err);
	}
	return result;
};

Date.prototype.addHours= function(h){
    this.setHours(this.getHours()+h);
    return this;
}

module.exports = new RussianGenerator();