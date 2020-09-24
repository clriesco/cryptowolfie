const ccxt = require('ccxt');
const debug = require('debug')('cryptowolfie:RussianGenerator');

class BotData {
    
    constructor() {
        super();
        this.exchange = new ccxt[config.exchange]({enableRateLimit: true });

        this.init();
    }

    init() {
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
            body : [],
            abody : [], // average body
            bar : [],  // -1 , 1, 0
            
            max3:[],
            bodydivmax3:[],
            firstbullishopen:[],
            firstbearishopen:[],
            sma:[],
            meanfulbar:[], // значимая свеча. если длина больше средней, деленной на делитель, например (3). в некоторых индикаторах и стратегиях учитываются только значимые бары
            countmeanfulbullish:[],
            countmeanfulbearish:[],
        };
    }

    advice(){
        //process.stdout.write("advise start...")
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
                (strategy.position_size == 0 || cls < strategy.position_avg_price) &&
                (rsi1 < config.rsilimit1) &&
                (body > (abody / 5)) &&
                config.usersi1 == true
        //process.stdout.write(" up1 = " + up1)
        const dn1 = bar ==  1 && (strategy.position_size == 0 || cls > strategy.position_avg_price) && rsi1 > (100 - config.rsilimit1) && (body > (abody / 5)) && config.usersi1
        //process.stdout.write(" dn1 = " + dn1)
        
        const up2 = bar == -1 && (strategy.position_size == 0 || cls < strategy.position_avg_price) && rsi2 < config.rsilimit2 && body > abody / 5 && config.usersi2
        //process.stdout.write(" up2 = " + up2)
        const dn2 = bar == 1 && (strategy.position_size == 0 || cls > strategy.position_avg_price) && rsi2 > (100 - config.rsilimit2) && body > abody / 5 && config.usersi2
        //process.stdout.write(" dn2 = " + dn2)
        const norma = rsi1 > config.rsilimit1 && rsi1 < (100 - config.rsilimit1) && rsi2 > config.rsilimit2 && rsi2 < (100 - config.rsilimit2)
        //process.stdout.write(" norma = " + norma)
        var exitUp = strategy.position_size > 0 && bar == 1 
        var exitDn = strategy.position_size < 0 && bar == -1 
        exitUp = exitUp && norma && body > abody / 2
        exitDn = exitDn && norma && body > abody / 2
        const exit = exitUp || exitDn
        //process.stdout.write(" exit = " + exit)
        
        
        const strlen = strategy.profit.length
        strategy.profit[strlen] = strlen == 0 ? 0 : exit ? ((strategy.position_size > 0 && cls > strategy.position_avg_price) || (strategy.position_size < 0 && cls < strategy.position_avg_price)) ? 1 : -1 : strategy.profit[strlen - 1]
        strategy.mult[strlen] = strlen == 0 ? 0 : config.usemar ? exit ? profit == -1 ? strategy.mult[strlen-1] * 2 : 1 : strategy.mult[strlen-1] : 1
        strategy.lot[strlen] = strlen == 0 ? 0 : strategy.position_size == 0 ? strategy.equity / cls * strategy.capital / 100 * strategy.mult[strlen] : strategy.lot[strlen-1]
        
        const up3 =   (simpleMovingAVG(this.indic.bar.slice(-3) , 3) == -1) && (cls < this.indic.firstbullishopen[len]) && (strategy.position_size == 0 || cls < strategy.position_avg_price) && (body > abody / 5) && (config.useSMAfilter == false || cls < this.indic.sma[len])
        const up4 = (bar == -1) && (body > this.indic.max3[len] * 3) && (strategy.position_size == 0 || cls < strategy.position_avg_price) && (body > abody / 5) && ( config.useSMAfilter == false || cls < this.indic.sma[len])
        const up5 = (bar == -1) && (opn / cls > config.percentLongBar);
        
        const dn3 =  simpleMovingAVG(this.indic.bar.slice(-3) , 3) == 1 && (cls > this.indic.firstbearishopen[len]) && (strategy.position_size == 0 || cls > strategy.position_avg_price) && body > abody / 5 && (config.useSMAfilter == false || cls > this.indic.sma[len])
        const dn4 = bar == 1 && body > this.indic.max3[len] * 3 && (strategy.position_size == 0 || cls > strategy.position_avg_price) && body > abody / 5 && (config.useSMAfilter == false || cls > this.indic.sma[len])
        const dn5 = bar == 1 && (cls / opn > config.percentLongBar);

        if (config.needLong){
            if ((up1 || up2 || (up3 && config.useBar3)  || up4) && strategy.position_size < config.maxposition) {
                this.PutSignal("Long", this.CreateBotString("LONG up1(RSI7)=" + up1 + " up2(RSI14)=" + up2 + " up3(BAR3)=" +up3+" up4(LONGBAR)="+up4))
            } else if (exitUp){
                this.PutSignal("Close Long", this.CreateBotString("CLOSE_LONG "))
            }
        }
        
        if (config.needShort){
            if ((dn1 || dn2 || (dn3 && config.useBar3) || dn4) && strategy.position_size > - config.maxposition) {
                this.PutSignal("Short", this.CreateBotString("SHORT DN1(RSI7)=" + dn1 + " DN2(RSI14)=" + dn2 + " DN3(BAR3)=" +dn3+" DN4(LONGBAR)="+dn4))
            } else if (exitDn){
                this.PutSignal("Close Short", BotData.CreateBotString("CLOSE_SHORT"))
            }
        }	

    }

    PutSignal(signal, comment){
        console.log(comment)
        if (typeof dsc_client !== 'undefined' )dsc_client.dsc_client.PutSignals(comment);
        this.signal = signal
        this.signalAge = this.age
        this.signalParsed = false
        switch (signal) {
            case "Long":
                strategy.position_size ++
                strategy.position_avg_price = (this.lastCandle.close + strategy.position_avg_price*(strategy.position_size - 1)) / strategy.position_size
                break;
            case "Close Long":
                strategy.position_size = 0
                break;
            case "Short":
                strategy.position_size --
                strategy.position_avg_price = (this.lastCandle.close + strategy.position_avg_price*(Math.abs(strategy.position_size) - 1)) / Math.abs(strategy.position_size)
                break;
            case "Close Short":
                strategy.position_size = 0
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
        
        log(MyStrDate(this.lastCandle.Timestamp));

        const length = this.candleProps.close.length;
        this.candleProps.close[length] = this.lastCandle.close;
        this.candleProps.open[length] = this.lastCandle.open;
        this.candleProps.high[length] = this.lastCandle.high         // High price
        this.candleProps.low[length] = this.lastCandle.low       // Low price
        this.candleProps.volume[length] = this.lastCandle.volume         // Volume
        this.candleProps.Timestamp[length] = this.lastCandle.Timestamp        // Candle Timestamp
        this.processIndicators();
        
        log.yellow ("Close: "+ this.lastCandle.close+", FastRSI-7: " + this.indic["rsi1"][length] + ", SlowRSI-14: "+ this.indic["rsi2"][length] + ", BODYDIVMAX3=" +this.indic["bodydivmax3"][length].toFixed(2)+ ", Meanful=" + this.indic.meanfulbar[length] + ", MeanfulUp=" + this.indic.countmeanfulbullish[length] + ", MeanfulDn=" + this.indic.countmeanfulbearish[length]+ ", body="+ this.indic.body[length]+ ", abody="+this.indic.abody[length])


        for (var prop in this.candleProps)if (this.candleProps[prop].length > config.requiredHistory )this.candleProps[prop].splice(0,1)
        for (var prop in this.indic) {
            //process.stdout.write(prop + " " + this.indic[prop][length] + ", \t");
            if (this.indic[prop].length > config.requiredHistory )this.indic[prop].splice(0,1)
        } 
        
        return true;
    }
}
module.exports = new BotData();
