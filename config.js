
module.exports = {

	//Signal Manager
	waitingSignalKeepAlive: 60*60*1, //Seconds
	//Order Manager
	fillingOrdersKeepAlive: 60*60*1, //Seconds

	//Price Listener
	tickerRefreshRate: 20 * 1000, //Miliseconds
	stopLossThreshold: 0.9,
	takeProfitThreshold: 1.05,
	trailingLossMargin: 0.02,

	//Wallet Manager
	maxOrders: 5,

	//Server
	serverPort: 3000,
	dbUri: 'mongodb://localhost/cryptowolfie',
}