const Pool = require('pg').Pool;
const bcrypt = require('bcrypt');
const format = require('pg-format');
const config = (process.env.NODE_ENV === 'test') ? require('./config/test_config') : require('./config/config');
const util = require('./util');
const conn_pool = new Pool({
   user: config.db_username,
   password: config.db_password,
   host: config.db_host,
   database: config.db_database,
   port: config.db_port
});

const login_query = 'SELECT * FROM users WHERE email = $1;';
const create_user_query = 'INSERT INTO users (email, passhash) VALUES ($1, $2) RETURNING id;';
const new_session_query = 'INSERT INTO sessions (user_id) VALUES ($1) RETURNING id;';
const add_wallet_session_query_template = "INSERT INTO walletBalance (sessionId, balance) VALUES %L RETURNING walletId;";
const add_transaction_query_template = "INSERT INTO sessionBlockTransactions " +
    "(sessionId, blockNum, transactionNum, fromWallet, toWallet, amount) VALUES" +
    " %L";


exports.login_with_name_and_pass = function (req, res, next) {
    const name = req.body.user;
    const pass = req.body.password;
    let message = "login unsuccessful";

    conn_pool.query(login_query, [name])
        .then(results => {
            if (results.rows.length > 0) {
                bcrypt.compare(pass, results.rows[0].passhash)
                    .then(compare_result => {
                        if (compare_result === true) {
                            req.body.id = results.rows[0].id;
                            next();
                        } else {
                            return util.error_response(res, 401, message, "password incorrect");
                        }
                    })
                    .catch(err => { util.error_response(res, 401, message, "user not found"); });
            } else {
                return util.error_response(res, 401, message, "user not found");
            }
        })
        .catch(err => { util.error_response(res, 401, message, err); });
};

exports.create_new_user = function (req, res, next) {
    const name = req.body.user;
    const pass = req.body.password;
    let message = "something went wrong creating user";

    bcrypt.hash(pass, config.salt_rounds)
        .then(hash_pass => {
            conn_pool.query(create_user_query, [name, hash_pass])
                .then(results => {
                    req.body.id = results.rows[0].id;
                    next();
                })
                .catch(err => { util.error_response(res, 500, message, err); });
        })
        .catch(err => { util.error_response(res, 500, message, err); });
};

exports.create_new_session = function (req, res, next) {
    const user_id = req.body.id;
    const token = req.headers['x-access-token'];
    if (user_id == null) return util.error_response(res, 400, "user id not supplied", "id " + user_id);
    let message = "something went wrong creating the session";
    conn_pool.query(new_session_query, [user_id])
        .then(results => {
                res.status(200).json({
                    session: results.rows[0].id,
                    token: token,
                    message: "successfully created new session!"
                });
                next();
            })
        .catch(err => { util.error_response(res, 500, message, err) });
};

exports.add_wallets_to_db = function (req, res, next) {
    const num_of_wallets = req.body.walletNum;
    const starting_balance = req.body.startingBalance;
    const session_id = req.body.sessionId;
    const token = req.headers['x-access-token'];
    let wallet_vals = [];
    [...Array(num_of_wallets)].map(() => wallet_vals.push([session_id, starting_balance]));
    let query = format(add_wallet_session_query_template, wallet_vals);

    conn_pool.query(query)
        .then(results => {
            res.status(200).json({
                wallets: results.rows,
                token: token,
                message: "successfully added new wallets!"
            });
            next();
        })
        .catch(err => { util.error_response(res, 500, "Database error adding wallet information", err) });
};

exports.add_transaction_to_db = function (req, res, next) {
    const sessionId = req.body.sessionId;
    const blockNum = req.body.blockNum;
    const token = req.headers['x-access-token'];
    const listOfTransactions = util.make_list_of_transactions_from_req_body(sessionId, blockNum, req.body.transactions);
    const query = format(add_transaction_query_template, listOfTransactions);
    conn_pool.query(query)
        .then(results => {
            res.status(200).json({
                token: token,
                message: "successfully added transaction(s)!"
            });
            next();
        })
        .catch(err => { util.error_response(res, 500, "Database error adding transaction information", err) });
};