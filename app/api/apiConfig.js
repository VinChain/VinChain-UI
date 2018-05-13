export const blockTradesAPIs = {
    BASE: "https://api.blocktrades.us/v2",
    BASE_OL: "https://ol-api1.openledger.info/api/v0/ol/support",
    COINS_LIST: "/coins",
    ACTIVE_WALLETS: "/active-wallets",
    TRADING_PAIRS: "/trading-pairs",
    DEPOSIT_LIMIT: "/deposit-limits",
    ESTIMATE_OUTPUT: "/estimate-output-amount",
    ESTIMATE_INPUT: "/estimate-input-amount"
};

export const rudexAPIs = {
    BASE: "https://gateway.rudex.org/api/v0_1",
    COINS_LIST: "/coins",
    NEW_DEPOSIT_ADDRESS: "/new-deposit-address"
};

export const widechainAPIs = {
    BASE: "https://gateway.winex.pro/api/v0/ol/support",
    COINS_LIST: "/coins",
    ACTIVE_WALLETS: "/active-wallets",
    NEW_DEPOSIT_ADDRESS: "/new-deposit-address",
    WITHDRAW_HISTORY: "/latelyWithdraw",
    TRADING_PAIRS: "/trading-pairs",
    DEPOSIT_HISTORY: "/latelyRecharge"
};

export const settingsAPIs = {
    DEFAULT_WS_NODE: "wss://node.vinchain.io:11011/",
    WS_NODE_LIST: [
        {url: "wss://node.vinchain.io:11011/", location: "Vinchain Alpha"}
        // {url: "wss://18.205.32.20:11011/", location: "Vinchain Beta"},
        // {url: "wss://18.205.82.249:11011/", location: "Vinchain Gamma"},
        // {url: "wss://18.184.56.212:11011/", location: "Vinchain Delta"},
        // {url: "wss://18.197.162.20:11011/", location: "Vinchain Epsilon"},
    ],
    DEFAULT_FAUCET: "https://wallet.vinchain.io/", // 2017-12-infrastructure worker proposal
    TESTNET_FAUCET: "https://wallet.vinchain.io/",
    RPC_URL: "https://openledger.info/api/"
};

export const gdexAPIs = {
    BASE: "https://api.gdex.io",
    ASSET_LIST: "/gateway/asset/assetList",
    ASSET_DETAIL: "/gateway/asset/assetDetail",
    GET_DEPOSIT_ADDRESS: "/gateway/address/getAddress",
    CHECK_WITHDRAY_ADDRESS: "/gateway/address/checkAddress",
    DEPOSIT_RECORD_LIST: "/gateway/deposit/recordList",
    DEPOSIT_RECORD_DETAIL: "/gateway/deposit/recordDetail",
    WITHDRAW_RECORD_LIST: "/gateway/withdraw/recordList",
    WITHDRAW_RECORD_DETAIL: "/gateway/withdraw/recordDetail",
    GET_USER_INFO: "/gateway/user/getUserInfo",
    USER_AGREEMENT: "/gateway/user/isAgree",
    WITHDRAW_RULE: "/gateway/withdraw/rule"
};
