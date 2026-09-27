-- Run with an RDS PostgreSQL administrator through psql. The application role
-- authenticates with IAM, so no static database password is created or stored.
CREATE USER s3_app_user WITH LOGIN;
GRANT rds_iam TO s3_app_user;

CREATE DATABASE "s3-app" OWNER s3_app_user;
GRANT ALL PRIVILEGES ON DATABASE "s3-app" TO s3_app_user;

\connect "s3-app"

GRANT USAGE, CREATE ON SCHEMA public TO s3_app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO s3_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO s3_app_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO s3_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO s3_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO s3_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO s3_app_user;

CREATE TABLE public.app_users (
  user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_name VARCHAR(100) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  password TEXT NOT NULL
);
