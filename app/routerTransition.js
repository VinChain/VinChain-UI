import {Apis, Manager, ChainConfig} from "bitsharesjs-ws";
import {ChainStore} from "bitsharesjs/es";
import chainIds from "chain/chainIds";

// Stores
import iDB from "idb-instance";
import AccountRefsStore from "stores/AccountRefsStore";
import WalletManagerStore from "stores/WalletManagerStore";
import WalletDb from "stores/WalletDb";
import SettingsStore from "stores/SettingsStore";
import AccountStore from "stores/AccountStore";

import ls from "common/localStorage";
const STORAGE_KEY = "__graphene__";
const ss = new ls(STORAGE_KEY);
let latencyChecks;
import counterpart from "counterpart";

// Actions
import PrivateKeyActions from "actions/PrivateKeyActions";
import SettingsActions from "actions/SettingsActions";
import notify from "actions/NotificationActions";

ChainStore.setDispatchFrequency(60);

let connect = true;
let connectionManager;
let oldChain = "";

const filterAndSortURLs = (count, latencies) => {
    let urls = SettingsStore.getState()
        .defaults.apiServer.filter(a => {
            // Skip hidden nodes
            if (a.hidden) return false;
            /*
        * Since we don't want users accidentally connecting to the testnet,
        * we filter out the testnet address from the fallback list
        */
            if (!__TESTNET__ && a.url.indexOf("testnet") !== -1) return false;
            /* Also remove the automatic fallback dummy url */
            if (a.url.indexOf("fake.automatic-selection") !== -1) return false;
            /* Remove insecure websocket urls when using secure protocol */
            if (
                window.location.protocol === "https:" &&
                a.url.indexOf("ws://") !== -1
            ) {
                return false;
            }
            /* Use all the remaining urls if count = 0 */
            if (!count) return true;

            /* Only keep the nodes we were able to connect to */
            return !!latencies[a.url];
        })
        .sort((a, b) => {
            return latencies[a.url] - latencies[b.url];
        })
        .map(a => a.url);
    return urls;
};

let _connectInProgress = false;
let _connectionCheckPromise = null;
const willTransitionTo = (
    nextState,
    replaceState,
    callback,
    appInit = true
) => {
    // console.log(new Date().getTime(), nextState.location.pathname, "appInit", appInit);
    //appInit is true when called via router onEnter, and false when node is manually selected in access settings

    // Bypass the app init chain for the migration path which is only used at bitshares.org/wallet
    if (__DEPRECATED__) {
        ChainConfig.setChainId(chainIds.MAIN_NET);
        let dbPromise = iDB.init_instance(
            window.openDatabase ? shimIndexedDB || indexedDB : indexedDB
        ).init_promise;
        return dbPromise.then(() => {
            Promise.all([
                WalletDb.loadDbData().then(() => {
                    // console.log("wallet init done");
                    callback();
                }),
                WalletManagerStore.init()
            ]);
        });
    }

    if (nextState.location.pathname === "/init-error") {
        return callback();
    }

    const apiLatencies = SettingsStore.getState().apiLatencies;
    latencyChecks = ss.get("latencyChecks", 1);
    let apiLatenciesCount = Object.keys(apiLatencies).length;
    let connectionStart;

    if (connect) ss.set("latencyChecks", latencyChecks + 1); // Every 15 connect attempts we refresh the api latency list
    if (latencyChecks >= 5) {
        apiLatenciesCount = 0;
        ss.set("latencyChecks", 0);
    }

    let urls = filterAndSortURLs(apiLatenciesCount, apiLatencies);

    /*
    * We use a fake connection url to force a fallback to the best of
    * the pre-defined URLs, ranked by latency
    */
    let connectionString = SettingsStore.getSetting("apiServer");
    if (!connectionString) connectionString = urls[0];
    /* Don't use an insecure websocket url when using secure protocol */
    if (
        window.location.protocol === "https:" &&
        connectionString.indexOf("ws://") !== -1
    ) {
        connectionString = urls[0];
    }
    const autoSelection =
        connectionString.indexOf("fake.automatic-selection") !== -1;
    if (autoSelection) {
        connectionString = urls[0];
    }

    var onConnect = () => {
        // console.log(new Date().getTime(), "routerTransition onConnect", caller, "_connectInProgress", _connectInProgress);
        if (_connectInProgress) return callback();
        _connectInProgress = true;
        if (Apis.instance()) {
            let currentUrl = Apis.instance().url;
            SettingsActions.changeSetting({
                setting: "activeNode",
                value: currentUrl
            });
            if (!autoSelection)
                SettingsActions.changeSetting({
                    setting: "apiServer",
                    value: currentUrl
                });
            if (!(currentUrl in apiLatencies)) {
                apiLatencies[currentUrl] =
                    new Date().getTime() - connectionStart;
            }
        }
        const currentChain = Apis.instance().chain_id;
        const chainChanged = oldChain !== currentChain;
        oldChain = currentChain;
        var dbPromise = Promise.resolve();
        try {
            if (chainChanged) {
                iDB.close();
                dbPromise = iDB.init_instance(
                    window.openDatabase ? shimIndexedDB || indexedDB : indexedDB
                ).init_promise;
            }
        } catch (err) {
            console.error("db init error:", err);
            replaceState("/init-error");
            _connectInProgress = false;
            return callback();
        }

        return Promise.all([dbPromise, SettingsStore.init()])
            .then(() => {
                let chainStoreResetPromise = chainChanged
                    ? ChainStore.resetCache(false)
                    : Promise.resolve();
                return chainStoreResetPromise.then(() => {
                    return Promise.all([
                        PrivateKeyActions.loadDbData().then(() => {
                            return AccountRefsStore.loadDbData();
                        }),
                        WalletDb.loadDbData()
                            .then(() => {
                                // if (!WalletDb.getWallet() && nextState.location.pathname === "/") {
                                //     replaceState("/dashboard");
                                // }
                                if (
                                    nextState.location.pathname.indexOf(
                                        "/auth/"
                                    ) === 0
                                ) {
                                    replaceState("/dashboard");
                                }
                            })
                            .then(() => {
                                if (chainChanged) {
                                    // ChainStore.clearCache();
                                    // ChainStore.subscribed = false;
                                    // return ChainStore.resetCache().then(() => {
                                    AccountStore.reset();
                                    return AccountStore.loadDbData(
                                        currentChain
                                    ).catch(err => {
                                        console.error(err);
                                    });
                                    // });
                                }
                            })
                            .catch(error => {
                                console.error(
                                    "----- WalletDb.willTransitionTo error ----->",
                                    error
                                );
                                replaceState("/init-error");
                            }),
                        WalletManagerStore.init()
                    ]).then(() => {
                        _connectInProgress = false;
                        SettingsActions.changeSetting({
                            setting: "activeNode",
                            value: connectionManager.url
                        });
                        callback();
                    });
                });
            })
            .catch(err => {
                console.error(err);
                replaceState("/init-error");
                _connectInProgress = false;
                callback();
            });
    };

    var onResetError = err => {
        console.error("onResetError:", err);
        oldChain = "old";
        connect = true;
        notify.addNotification({
            message: counterpart.translate("settings.connection_error", {
                url: connectionString
            }),
            level: "error",
            autoDismiss: 10
        });
        return Apis.close().then(() => {
            return willTransitionTo(nextState, replaceState, callback, true);
        });
    };

    connectionManager = new Manager({url: connectionString, urls});
    let connectionCheckPromise = !apiLatenciesCount
        ? _connectionCheckPromise
            ? _connectionCheckPromise
            : connectionManager.checkConnections()
        : null;
    _connectionCheckPromise = connectionCheckPromise;

    Promise.all([connectionCheckPromise])
        .then(res => {
            _connectionCheckPromise = null;
            if (connectionCheckPromise && res[0]) {
                let [latencies] = res;
                urls = filterAndSortURLs(
                    Object.keys(latencies).length,
                    latencies
                );
                connectionManager.url = urls[0];
                connectionManager.urls = urls;
                /* Update the latencies object */
                SettingsActions.updateLatencies(latencies);
            }
            // let latencies = ss.get("apiLatencies", {});
            // let connectionStart = new Date().getTime();
            connectionStart = new Date().getTime();

            if (appInit) {
                connectionManager
                    .connectWithFallback(connect)
                    .then(() => {
                        if (!autoSelection)
                            SettingsActions.changeSetting({
                                setting: "apiServer",
                                value: connectionManager.url
                            });

                        onConnect();
                    })
                    .catch(error => {
                        console.error(
                            "----- App.willTransitionTo error ----->",
                            error,
                            new Error().stack
                        );
                        if (error.name === "InvalidStateError") {
                            if (__ELECTRON__) {
                                replaceState("/dashboard");
                            } else {
                                alert(
                                    "Can't access local storage.\nPlease make sure your browser is not in private/incognito mode."
                                );
                            }
                        } else {
                            replaceState("/init-error");
                            callback();
                        }
                    });
            } else {
                oldChain = "old";
                Apis.reset(connectionManager.url, true).then(instance => {
                    instance.init_promise.then(onConnect).catch(onResetError);
                });
            }

            /* Only try initialize the API with connect = true on the first onEnter */
            connect = false;
        })
        .catch(err => {
            console.error(err);
            replaceState("/init-error");
            callback();
        });

    // Every 15 connections we check the latencies of the full list of nodes
    if (connect && !apiLatenciesCount && !connectionCheckPromise)
        connectionManager.checkConnections().then(res => {
            console.log("Connection latencies:", res);
            SettingsActions.updateLatencies(res);
        });
};

export default willTransitionTo;
