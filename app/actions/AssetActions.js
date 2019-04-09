import alt from "alt-instance";
import {Apis} from "bitsharesjs-ws";
import utils from "common/utils";
import WalletApi from "api/WalletApi";
import ApplicationApi from "api/ApplicationApi";
import WalletDb from "stores/WalletDb";
import {ChainStore} from "bitsharesjs/es";
import big from "bignumber.js";

let inProgress = {};

class AssetActions {
    fundPool(account_id, core, asset, amount) {
        let tr = WalletApi.new_transaction();
        let precision = utils.get_asset_precision(core.get("precision"));
        tr.add_type_operation("asset_fund_fee_pool", {
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            from_account: account_id,
            asset_id: asset.get("id"),
            amount: amount * precision
        });

        return dispatch => {
            return WalletDb.process_transaction(tr, null, true)
                .then(() => {
                    dispatch(true);
                })
                .catch(error => {
                    console.log(
                        "[AssetActions.js:150] ----- fundPool error ----->",
                        error
                    );
                    dispatch(false);
                });
        };
    }

    updateFeedProducers(account, asset, producers) {
        let tr = WalletApi.new_transaction();
        tr.add_type_operation("asset_update_feed_producers", {
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            issuer: account,
            asset_to_update: asset.get("id"),
            new_feed_producers: producers
        });

        return dispatch => {
            return WalletDb.process_transaction(tr, null, true)
                .then(() => {
                    dispatch(true);
                })
                .catch(error => {
                    console.log(
                        "[AssetActions.js:150] ----- updateFeedProducers error ----->",
                        error
                    );
                    dispatch(false);
                });
        };
    }

    claimPoolFees(account_id, asset, amount) {
        let tr = WalletApi.new_transaction();
        let precision = utils.get_asset_precision(asset.get("precision"));

        tr.add_type_operation("asset_claim_fees", {
            fee: {
                amount: 0,
                asset_id: 0
            },
            issuer: account_id,
            amount_to_claim: {
                asset_id: asset.get("id"),
                amount: amount * precision
            }
        });
        return dispatch => {
            return WalletDb.process_transaction(tr, null, true)
                .then(result => {
                    dispatch(true);
                })
                .catch(error => {
                    console.log(
                        "[AssetActions.js:150] ----- claimFees error ----->",
                        error
                    );
                    dispatch(false);
                });
        };
    }

    createAsset(
        account_id,
        createObject,
        flags,
        permissions,
        cer,
        description,
        extensions
    ) {
        // Create asset action here...
        console.log("create asset:", createObject, "flags:", flags);
        let tr = WalletApi.new_transaction();
        let precision = utils.get_asset_precision(createObject.precision);

        big.config({DECIMAL_PLACES: createObject.precision});
        let max_supply = new big(createObject.max_supply)
            .times(precision)
            .toString();
        let max_market_fee = new big(createObject.max_market_fee || 0)
            .times(precision)
            .toString();
        // console.log("max_supply:", max_supply);
        // console.log("max_market_fee:", max_market_fee);

        let corePrecision = utils.get_asset_precision(
            ChainStore.getAsset(cer.base.asset_id).get("precision")
        );

        let operationJSON = {
            fee: {
                amount: 0,
                asset_id: 0
            },
            issuer: account_id,
            symbol: createObject.symbol,
            precision: parseInt(createObject.precision, 10),
            common_options: {
                max_supply: max_supply,
                market_fee_percent: createObject.market_fee_percent * 100 || 0,
                max_market_fee: max_market_fee,
                issuer_permissions: permissions,
                flags: flags,
                core_exchange_rate: {
                    base: {
                        amount: cer.base.amount * corePrecision,
                        asset_id: cer.base.asset_id
                    },
                    quote: {
                        amount: cer.quote.amount * precision,
                        asset_id: "1.3.1"
                    }
                },
                whitelist_authorities: [],
                blacklist_authorities: [],
                whitelist_markets: [],
                blacklist_markets: [],
                description: description,
                extensions: {
                    payment_core_exchange_rate: {
                        base: {
                            amount:
                                extensions.payment_core_exchange_rate.base
                                    .amount * corePrecision,
                            asset_id:
                                extensions.payment_core_exchange_rate.base
                                    .asset_id
                        },
                        quote: {
                            amount:
                                extensions.payment_core_exchange_rate.quote
                                    .amount * precision,
                            asset_id: "1.3.1"
                        }
                    }
                }
            },
            is_prediction_market: false,
            extensions: null
        };

        tr.add_type_operation("asset_create", operationJSON);
        return dispatch => {
            return WalletDb.process_transaction(tr, null, true)
                .then(result => {
                    // console.log("asset create result:", result);
                    // this.dispatch(account_id);
                    dispatch(true);
                })
                .catch(error => {
                    console.log(
                        "[AssetActions.js:150] ----- createAsset error ----->",
                        error
                    );
                    dispatch(false);
                });
        };
    }

    updateAsset(
        issuer,
        new_issuer,
        update,
        core_exchange_rate,
        asset,
        flags,
        permissions,
        isBitAsset,
        bitasset_opts,
        original_bitasset_opts,
        description,
        auths,
        feedProducers,
        originalFeedProducers,
        payment_core_exchange_rate,
        assetChanged
    ) {
        // Create asset action here...
        let tr = WalletApi.new_transaction();
        if (assetChanged) {
            let quotePrecision = utils.get_asset_precision(
                asset.get("precision")
            );

            big.config({DECIMAL_PLACES: asset.get("precision")});
            let max_supply = new big(update.max_supply)
                .times(quotePrecision)
                .toString();
            let max_market_fee = new big(update.max_market_fee || 0)
                .times(quotePrecision)
                .toString();

            let cr_quote_asset = ChainStore.getAsset(
                core_exchange_rate.quote.asset_id
            );
            let cr_quote_precision = utils.get_asset_precision(
                cr_quote_asset.get("precision")
            );
            let cr_base_asset = ChainStore.getAsset(
                core_exchange_rate.base.asset_id
            );
            let cr_base_precision = utils.get_asset_precision(
                cr_base_asset.get("precision")
            );

            let cr_quote_amount = new big(core_exchange_rate.quote.amount)
                .times(cr_quote_precision)
                .toString();
            let cr_base_amount = new big(core_exchange_rate.base.amount)
                .times(cr_base_precision)
                .toString();

            let pcr_quote_asset = ChainStore.getAsset(
                payment_core_exchange_rate.quote.asset_id
            );
            let pcr_quote_precision = utils.get_asset_precision(
                pcr_quote_asset.get("precision")
            );
            let pcr_base_asset = ChainStore.getAsset(
                payment_core_exchange_rate.base.asset_id
            );
            let pcr_base_precision = utils.get_asset_precision(
                pcr_base_asset.get("precision")
            );

            let pcr_quote_amount = new big(
                payment_core_exchange_rate.quote.amount
            )
                .times(pcr_quote_precision)
                .toString();

            let pcr_base_amount = new big(
                payment_core_exchange_rate.base.amount
            )
                .times(pcr_base_precision)
                .toString();

            console.log("auths:", auths);
            let updateObject = {
                fee: {
                    amount: 0,
                    asset_id: 0
                },
                asset_to_update: asset.get("id"),
                extensions: asset.get("extensions"),
                issuer: issuer,
                new_issuer: new_issuer,
                new_options: {
                    max_supply: max_supply,
                    max_market_fee: max_market_fee,
                    market_fee_percent: update.market_fee_percent * 100,
                    description: description,
                    issuer_permissions: permissions,
                    flags: flags,
                    whitelist_authorities: auths.whitelist_authorities.toJS(),
                    blacklist_authorities: auths.blacklist_authorities.toJS(),
                    whitelist_markets: [],
                    blacklist_markets: [],
                    core_exchange_rate: {
                        quote: {
                            amount: cr_quote_amount,
                            asset_id: core_exchange_rate.quote.asset_id
                        },
                        base: {
                            amount: cr_base_amount,
                            asset_id: core_exchange_rate.base.asset_id
                        }
                    },
                    extensions: {
                        payment_core_exchange_rate: {
                            quote: {
                                amount: pcr_quote_amount,
                                asset_id:
                                    payment_core_exchange_rate.quote.asset_id
                            },
                            base: {
                                amount: pcr_base_amount,
                                asset_id:
                                    payment_core_exchange_rate.base.asset_id
                            }
                        }
                    }
                }
            };

            if (issuer === new_issuer || !new_issuer) {
                delete updateObject.new_issuer;
            }
            tr.add_type_operation("asset_update", updateObject);
        }

        console.log(
            "bitasset_opts:",
            bitasset_opts,
            "original_bitasset_opts:",
            original_bitasset_opts
        );

        console.log(
            "feedProducers:",
            feedProducers,
            "originalFeedProducers:",
            originalFeedProducers
        );

        return WalletDb.process_transaction(tr, null, true)
            .then(result => {
                // console.log("asset create result:", result);
                // this.dispatch(account_id);
                return true;
            })
            .catch(error => {
                console.log(
                    "[AssetActions.js:150] ----- updateAsset error ----->",
                    error
                );
                return false;
            });
    }

    issueAsset(to_account, from_account, asset_id, amount, memo) {
        ApplicationApi.issue_asset(
            to_account,
            from_account,
            asset_id,
            amount,
            memo
        );
    }

    getAssetList(start, count) {
        let id = start + "_" + count;
        return dispatch => {
            if (!inProgress[id]) {
                inProgress[id] = true;
                dispatch({loading: true});
                return Apis.instance()
                    .db_api()
                    .exec("list_assets", [start, count])
                    .then(assets => {
                        let bitAssetIDS = [];
                        let dynamicIDS = [];

                        assets.forEach(asset => {
                            ChainStore._updateObject(asset, false);
                            dynamicIDS.push(asset.dynamic_asset_data_id);

                            if (asset.bitasset_data_id) {
                                bitAssetIDS.push(asset.bitasset_data_id);
                            }
                        });

                        let dynamicPromise = Apis.instance()
                            .db_api()
                            .exec("get_objects", [dynamicIDS]);

                        let bitAssetPromise =
                            bitAssetIDS.length > 0
                                ? Apis.instance()
                                      .db_api()
                                      .exec("get_objects", [bitAssetIDS])
                                : null;

                        Promise.all([dynamicPromise, bitAssetPromise]).then(
                            results => {
                                delete inProgress[id];
                                dispatch({
                                    assets: assets,
                                    dynamic: results[0],
                                    bitasset_data: results[1],
                                    loading: false
                                });
                                return assets && assets.length;
                            }
                        );
                    })
                    .catch(error => {
                        console.log(
                            "Error in AssetActions.getAssetList: ",
                            error
                        );
                        dispatch({loading: false});
                        delete inProgress[id];
                    });
            }
        };
    }

    lookupAsset(symbol, searchID) {
        let asset = ChainStore.getAsset(symbol);

        if (asset) {
            return {
                assets: [asset],
                searchID: searchID,
                symbol: symbol
            };
        } else {
            return dispatch => {
                // Hack to retry once until we replace this method with a new api call to lookup multiple assets
                setTimeout(() => {
                    let asset = ChainStore.getAsset(symbol);
                    if (asset) {
                        dispatch({
                            assets: [asset],
                            searchID: searchID,
                            symbol: symbol
                        });
                    }
                }, 200);
            };
        }
    }

    reserveAsset(amount, assetId, payer) {
        var tr = WalletApi.new_transaction();
        tr.add_type_operation("asset_reserve", {
            fee: {
                amount: 0,
                asset_id: 0
            },
            amount_to_reserve: {
                amount: amount,
                asset_id: assetId
            },
            payer,
            extensions: []
        });
        return WalletDb.process_transaction(tr, null, true)
            .then(result => {
                return true;
            })
            .catch(error => {
                console.log(
                    "[AssetActions.js:150] ----- reserveAsset error ----->",
                    error
                );
                return false;
            });
    }
}

export default alt.createActions(AssetActions);
