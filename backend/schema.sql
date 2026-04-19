-- AOB Terminal — PostgreSQL schema
-- Run this once against your Neon (or any cloud Postgres) database.

CREATE TABLE IF NOT EXISTS sessions (
    id          VARCHAR(128) PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    name        VARCHAR(255),
    avatar      VARCHAR(512),
    created_at  TIMESTAMP DEFAULT now(),
    expires_at  TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS allowed_emails (
    id       SERIAL PRIMARY KEY,
    email    VARCHAR(255) NOT NULL UNIQUE,
    added_at TIMESTAMP DEFAULT now(),
    added_by VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS trade_log (
    id              SERIAL PRIMARY KEY,
    user_email      VARCHAR(255) NOT NULL,
    user_name       VARCHAR(255),
    symbol          VARCHAR(20)  NOT NULL,
    side            VARCHAR(10)  NOT NULL,
    qty             NUMERIC(18,8) NOT NULL,
    order_type      VARCHAR(20)  NOT NULL,
    time_in_force   VARCHAR(10),
    limit_price     NUMERIC(18,4),
    alpaca_order_id VARCHAR(100),
    alpaca_status   VARCHAR(50),
    created_at      TIMESTAMP DEFAULT now()
);
