set +x

docker run \
  --name test-api-in-container \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=admin \
  -e POSTGRES_DB=test-apis \
  -p 42069:5432 \
  -d \
  postgres

sleep 3 # wait til docker-pg is up TODO figure out nonhack for this

export PGPASSWORD=admin

psql -X -h localhost -p 42069 -d test-apis -U admin -c \
"CREATE TABLE users (ID SERIAL PRIMARY KEY, email VARCHAR(30), passhash VARCHAR(255));"
psql -X -h localhost -p 42069 -d test-apis -U admin -c \
"CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(ID),
    active BOOLEAN DEFAULT 't'
);"
psql -X -h localhost -p 42069 -d test-apis -U admin -c \
"CREATE TABLE sessionBlockTransactions (
    sessionId INTEGER REFERENCES sessions(id),
    blockNum INTEGER NOT NULL,
    transactionNum INTEGER NOT NULL,
    fromWallet VARCHAR(255),
    toWallet VARCHAR(255),
    amount INTEGER NOT NULL,
    PRIMARY KEY (sessionId, blockNum, transactionNum)
);"
psql -X -h localhost -p 42069 -d test-apis -U admin -c \
"CREATE TABLE walletBalance (
    walletId SERIAL PRIMARY KEY,
    balance INTEGER NOT NULL
);"
psql -X -h localhost -p 42069 -d test-apis -U admin -c \
"CREATE TABLE sessionWalletRel (
    sessionId INTEGER REFERENCES sessions(id),
    walletId INTEGER REFERENCES walletBalance(walletId),
    PRIMARY KEY (sessionId, walletId)
);"


unset PGPASSWORD