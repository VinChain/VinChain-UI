import React from "react";
import ZfApi from "react-foundation-apps/src/utils/foundation-api";
import BaseModal from "./BaseModal";
import Translate from "react-translate-component";
import {ChainStore, FetchChain} from "bitsharesjs/es";
import AccountSelect from "../Forms/AccountSelect";
import AmountSelector from "../Utility/AmountSelector";
import AccountStore from "stores/AccountStore";
import WalletUnlockStore from "stores/WalletUnlockStore";
import AccountSelector from "../Account/AccountSelector";
import TransactionConfirmStore from "stores/TransactionConfirmStore";
import {Asset} from "common/MarketClasses";
import {debounce, isNaN} from "lodash";
import {
    checkFeeStatusAsync,
    checkBalance,
    shouldPayFeeWithAssetAsync
} from "common/trxHelper";
import BalanceComponent from "../Utility/BalanceComponent";
import AccountActions from "actions/AccountActions";
import utils from "common/utils";
import counterpart from "counterpart";
import {connect} from "alt-react";
import classnames from "classnames";

class SendPaymentModal extends React.Component {
    static contextTypes = {
        router: React.PropTypes.object
    };

    constructor(props) {
        super(props);
        this.state = this.getInitialState(props);

        this.onTrxIncluded = this.onTrxIncluded.bind(this);

        this._updateFee = debounce(this._updateFee.bind(this), 250);
        this._checkBalance = this._checkBalance.bind(this);

        ZfApi.subscribe("transaction_confirm_actions", (name, msg) => {
            if (msg == "close") {
                this.setState({hidden: false});
            }
        });
    }

    getInitialState() {
        return {
            from_name: "",
            to_name: "",
            from_account: null,
            to_account: null,
            orig_account: null,
            amount: "",
            asset_id: null,
            asset: null,
            memo: "",
            error: null,
            feeAsset: null,
            fee_asset_id: null,
            feeAmount: new Asset({amount: 0}),
            feeStatus: {},
            maxAmount: false,
            hidden: false,
            returnURL: null
        };
    }

    show({to_account, amount, asset, memo, returnURL}) {
        this.setState({open: true, hidden: false}, () => {
            ZfApi.publish(this.props.id, "open");
            this._initForm({to_account, amount, asset, memo, returnURL});
        });
    }

    onClose(publishClose = true) {
        ZfApi.unsubscribe("transaction_confirm_actions");
        this.setState(
            {
                open: false,
                from_name: "",
                to_name: "",
                from_account: null,
                to_account: null,
                orig_account: null,
                amount: "",
                asset_id: null,
                asset: null,
                memo: "",
                error: null,
                feeAsset: null,
                fee_asset_id: null,
                feeAmount: new Asset({amount: 0}),
                feeStatus: {},
                maxAmount: false,
                hidden: false,
                returnURL: null
            },
            () => {
                if (publishClose) ZfApi.publish(this.props.id, "close");
            }
        );
    }

    onSubmit(e) {
        e.preventDefault();
        this.setState({error: null});

        const {asset} = this.state;
        let {amount} = this.state;
        const sendAmount = new Asset({
            real: amount,
            asset_id: asset.get("id"),
            precision: asset.get("precision")
        });

        this.setState({hidden: true});
        TransactionConfirmStore.listen(this.onTrxIncluded);

        AccountActions.transfer(
            this.state.from_account.get("id"),
            this.state.to_account.get("id"),
            sendAmount.getAmount(),
            asset.get("id"),
            new Buffer(this.state.memo, "utf-8"),
            null,
            this.state.feeAsset ? this.state.feeAsset.get("id") : "1.3.0",
            true
        )
            .then(() => {
                this.onClose();
            })
            .catch(e => {
                let msg = e.message
                    ? e.message.split("\n")[1] || e.message
                    : null;
                console.log("error: ", e, msg);
                this.setState({error: msg});
                this.backToMerchant(0, 0, msg);
            })
            .finally(() => {
                TransactionConfirmStore.unlisten(this.onTrxIncluded);
            });
    }

    _initForm({to_account, amount, asset, memo, returnURL}) {
        let to_name = to_account.get("name");
        let from_name = this.props.passwordAccount || this.props.currentAccount;

        if (from_name == to_name)
            from_name = this.props.myActiveAccounts.first();

        this.setState(
            {
                to_account: to_account,
                to_name: to_name,
                amount: amount,
                asset: asset,
                asset_id: asset.get("id"),
                feeAsset: asset,
                fee_asset_id: asset.get("id"),
                from_name: from_name,
                from_account: ChainStore.getAccount(from_name),
                feeAmount: new Asset({
                    amount: 0,
                    asset_id: asset.get("id"),
                    precision: asset.get("precision")
                }),
                memo: memo,
                returnURL: returnURL
            },
            this._updateFee
        );
    }

    componentWillMount() {
        this.nestedRef = null;
        this._updateFee();
    }

    _checkBalance() {
        const {feeAmount, amount, from_account, asset} = this.state;
        if (!asset || !from_account) return;
        this._updateFee();
        const balanceID = from_account.getIn(["balances", asset.get("id")]);
        const feeBalanceID = from_account.getIn([
            "balances",
            feeAmount.asset_id
        ]);
        if (!asset || !from_account) return;
        if (!balanceID) return this.setState({balanceError: true});
        let balanceObject = ChainStore.getObject(balanceID);
        let feeBalanceObject = feeBalanceID
            ? ChainStore.getObject(feeBalanceID)
            : null;
        if (!feeBalanceObject || feeBalanceObject.get("balance") === 0) {
            this.setState({fee_asset_id: "1.3.0"}, this._updateFee);
        }
        if (!balanceObject || !feeAmount) return;
        if (!amount) return this.setState({balanceError: false});
        const hasBalance = checkBalance(
            amount,
            asset,
            feeAmount,
            balanceObject
        );
        if (hasBalance === null) return;
        this.setState({balanceError: !hasBalance});
    }

    _updateFee(state = this.state) {
        let {fee_asset_id, from_account, asset_id} = state;
        const fee_asset_types = [asset_id];
        if (
            fee_asset_types.length === 1 &&
            fee_asset_types[0] !== fee_asset_id
        ) {
            fee_asset_id = fee_asset_types[0];
        }
        if (!from_account) return null;
        checkFeeStatusAsync({
            accountID: from_account.get("id"),
            feeID: fee_asset_id,
            options: ["percentage"],
            data: {
                amount: state.amount,
                isUia: fee_asset_id !== "1.3.0"
            }
        }).then(({fee, hasBalance, hasPoolBalance}) =>
            shouldPayFeeWithAssetAsync(from_account, fee).then(should =>
                should
                    ? this.setState({fee_asset_id: asset_id}, this._updateFee)
                    : this.setState({
                          feeAmount: fee,
                          fee_asset_id: fee.asset_id,
                          hasBalance,
                          hasPoolBalance,
                          error: !hasBalance || !hasPoolBalance
                      })
            )
        );
    }

    setNestedRef(ref) {
        this.nestedRef = ref;
    }

    onTrxIncluded(confirm_store_state) {
        if (
            confirm_store_state.included &&
            confirm_store_state.broadcasted_transaction
        ) {
            this.backToMerchant(
                confirm_store_state.trx_block_num,
                confirm_store_state.trx_id
            );
        } else if (confirm_store_state.error) {
            this.backToMerchant(0, 0, confirm_store_state.error);
        }
    }

    backToMerchant(trx_block_num, trx_id, errorText = null) {
        const {returnURL, memo} = this.state;
        if (!errorText) {
            let url = `${returnURL}?trx_block_num=${trx_block_num}&trx_id=${trx_id}&invoiceId=${memo}`;
            window.location.assign(url);
        } else {
            let url = `${returnURL}?trx_block_num=${0}&trx_id=${0}&invoiceId=${memo}&errorText=${errorText}`;
            window.location.assign(url);
        }
    }

    render() {
        let {
            from_account,
            to_account,
            asset,
            asset_id,
            feeAmount,
            amount,
            error,
            to_name,
            from_name,
            memo,
            feeAsset,
            fee_asset_id,
            balanceError,
            hidden
        } = this.state;
        let from_my_account =
            AccountStore.isMyAccount(from_account) ||
            from_name === this.props.passwordAccount;
        let from_error = from_account && !from_my_account ? true : false;

        let asset_types = [asset_id];
        let fee_asset_types = [asset_id];
        let balance = null;
        let balance_fee = null;

        // Estimate fee
        let fee = this.state.feeAmount.getAmount({real: true});
        if (from_account && from_account.get("balances") && !from_error) {
            let account_balances = from_account.get("balances").toJS();
            let _error = this.state.balanceError ? "has-error" : "";
            if (asset_types.length === 1)
                asset = ChainStore.getAsset(asset_types[0]);
            if (asset_types.length > 0) {
                let current_asset_id = asset ? asset.get("id") : asset_types[0];
                let feeID = feeAsset ? feeAsset.get("id") : "1.3.0";

                balance = (
                    <span>
                        <Translate
                            component="span"
                            content="transfer.available"
                        />
                        :{" "}
                        <span
                            className={_error}
                            style={{
                                borderBottom: "#A09F9F 1px dotted"
                            }}
                            onClick={() => {}}
                        >
                            <BalanceComponent
                                balance={account_balances[current_asset_id]}
                            />
                        </span>
                    </span>
                );

                if (feeID == current_asset_id && this.state.balanceError) {
                    balance_fee = (
                        <span>
                            <span className={_error}>
                                <Translate content="transfer.errors.insufficient" />
                            </span>
                        </span>
                    );
                }
            } else {
                balance = (
                    <span>
                        <span className={_error}>
                            <Translate content="transfer.errors.noFunds" />
                        </span>
                    </span>
                );
                balance_fee = (
                    <span>
                        <span className={_error}>
                            <Translate content="transfer.errors.noFunds" />
                        </span>
                    </span>
                );
            }
        }

        const amountValue = parseFloat(
            String.prototype.replace.call(amount, /,/g, "")
        );
        const isAmountValid = amountValue && !isNaN(amountValue);
        const isSendNotValid =
            !from_account ||
            !to_account ||
            !from_name ||
            !to_name ||
            !isAmountValid ||
            !asset ||
            from_error ||
            balanceError;

        let tabIndex = this.props.tabIndex; // Continue tabIndex on props count

        return !this.state.open ? null : (
            <div
                id="send_modal_wrapper"
                className={hidden || !this.state.open ? "hide" : ""}
            >
                <BaseModal
                    id={this.props.id}
                    overlay={true}
                    onClose={this.onClose.bind(this, false)}
                >
                    <div className="grid-block vertical no-overflow">
                        <div
                            className="content-block"
                            style={{textAlign: "center", textTransform: "none"}}
                        >
                            <div
                                style={{
                                    fontSize: "1.8rem",
                                    fontFamily:
                                        "Roboto-Medium, arial, sans-serif"
                                }}
                            >
                                <Translate
                                    unsafe
                                    content="modal.send.header"
                                    with={{fromName: from_name}}
                                />
                            </div>
                            <div
                                style={{
                                    marginTop: 10,
                                    fontSize: "0.9rem",
                                    marginLeft: "auto",
                                    marginRight: "auto"
                                }}
                            >
                                <p>
                                    <Translate content="transfer.header_subheader" />
                                </p>
                            </div>
                        </div>
                        {this.state.open ? (
                            <form noValidate>
                                <div>
                                    {/* T O */}
                                    <div className="content-block">
                                        <div className="header-area">
                                            <Translate
                                                className="left-label"
                                                component="label"
                                                content="transfer.to"
                                            />
                                        </div>
                                        <input
                                            style={{
                                                textTransform: "lowercase",
                                                fontVariant: "initial"
                                            }}
                                            name="username"
                                            id="username"
                                            type="text"
                                            value={to_name}
                                            placeholder={
                                                this.props.placeholder ||
                                                counterpart.translate(
                                                    "account.name"
                                                )
                                            }
                                            disabled={true}
                                        />
                                    </div>

                                    <div className="content-block transfer-input">
                                        {/*  A M O U N T  */}
                                        <AmountSelector
                                            label="transfer.amount"
                                            amount={amount}
                                            onChange={() => {}}
                                            asset={
                                                asset_types.length > 0 && asset
                                                    ? asset.get("id")
                                                    : asset_id
                                                    ? asset_id
                                                    : asset_types[0]
                                            }
                                            disabled={true}
                                            assets={asset_types}
                                            display_balance={balance}
                                            tabIndex={tabIndex++}
                                        />
                                    </div>
                                    <div className="content-block transfer-input">
                                        <div className="no-margin no-padding">
                                            {/*  F E E  */}
                                            <div
                                                id="txFeeSelector"
                                                className="small-12"
                                            >
                                                <AmountSelector
                                                    label="transfer.fee"
                                                    disabled={true}
                                                    amount={fee}
                                                    onChange={() => {}}
                                                    asset={
                                                        asset_types.length >
                                                            0 && asset
                                                            ? asset.get("id")
                                                            : asset_id
                                                            ? asset_id
                                                            : asset_types[0]
                                                    }
                                                    assets={[
                                                        asset_types.length >
                                                            0 && asset
                                                            ? asset.get("id")
                                                            : asset_id
                                                            ? asset_id
                                                            : asset_types[0]
                                                    ]}
                                                    display_balance={
                                                        balance_fee
                                                    }
                                                    tabIndex={tabIndex++}
                                                    error={
                                                        this.state
                                                            .hasPoolBalance ===
                                                        false
                                                            ? "transfer.errors.insufficient"
                                                            : null
                                                    }
                                                    scroll_length={2}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="content-block transfer-input">
                                        <div className="no-margin no-padding">
                                            <div
                                                className="small-6"
                                                style={{
                                                    display: "inline-block",
                                                    paddingRight: "10px"
                                                }}
                                            >
                                                <button
                                                    className={classnames(
                                                        "button primary",
                                                        {
                                                            disabled: isSendNotValid
                                                        }
                                                    )}
                                                    type="submit"
                                                    value="Submit"
                                                    onClick={
                                                        !isSendNotValid
                                                            ? this.onSubmit.bind(
                                                                  this
                                                              )
                                                            : null
                                                    }
                                                    tabIndex={tabIndex++}
                                                >
                                                    <Translate
                                                        component="span"
                                                        content="transfer.send"
                                                    />
                                                </button>
                                            </div>
                                            <div
                                                className="small-6"
                                                style={{
                                                    display: "inline-block",
                                                    paddingRight: "10px"
                                                }}
                                            >
                                                <button
                                                    className={classnames(
                                                        "button hollow primary"
                                                    )}
                                                    type="submit"
                                                    value="Cancel"
                                                    tabIndex={tabIndex++}
                                                    onClick={this.onClose.bind(
                                                        this
                                                    )}
                                                >
                                                    <Translate
                                                        component="span"
                                                        content="transfer.cancel"
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        ) : null}
                    </div>
                </BaseModal>
            </div>
        );
    }
}

class SendPaymentModalConnectWrapper extends React.Component {
    render() {
        return (
            <SendPaymentModal {...this.props} ref={this.props.refCallback} />
        );
    }
}

SendPaymentModalConnectWrapper = connect(
    SendPaymentModalConnectWrapper,
    {
        listenTo() {
            return [AccountStore];
        },
        getProps() {
            return {
                passwordAccount: AccountStore.getState().passwordAccount,
                currentAccount: AccountStore.getState().currentAccount,
                myActiveAccounts: AccountStore.getState().myActiveAccounts
            };
        }
    }
);

export default SendPaymentModalConnectWrapper;
