# cryptowolfie

Cryptowolfie is a modular cryptobot developed in NodeJS, to be consumed by a frontend dashboard.

This cryptobot receives signals from several data endpoints, such as:
    - Telegram channels
    - Discord channels
    - in house developed algorithms

It manages an exchange account, given an API KEY and API SECRET and executes positions based on the signals received.

For each signal it receives, it has configured both Take Profit and Stop Loss thresholds and closes every position once one threshold is reached.

# THIS PROJECT IS DISCONTINUED. USE IT BY YOUR OWN RISK