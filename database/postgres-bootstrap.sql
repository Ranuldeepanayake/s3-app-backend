-- Run with an RDS PostgreSQL administrator through psql. The application role
-- authenticates with IAM, so no static database password is created or stored.
-- Create the login role and grant the RDS IAM authentication capability it needs.
CREATE ROLE s3_app_user LOGIN;
GRANT rds_iam TO s3_app_user;

-- Recreate the database from scratch. This permanently removes its existing data.
DROP DATABASE IF EXISTS "s3-app";

-- Allow the administrative role to act as the application role while creating
-- the database with the application role as its owner.
GRANT s3_app_user TO postgres;
CREATE DATABASE "s3-app" OWNER s3_app_user;

-- Grant the application role database-level access for connections and use.
CREATE DATABASE "s3-app";
ALTER DATABASE "s3-app" OWNER TO s3_app_user;
GRANT ALL PRIVILEGES ON DATABASE "s3-app" TO s3_app_user;

-- Connect to the new database before setting privileges on its public schema.
\connect "s3-app"

-- Allow schema use and manage existing objects, plus objects created later.
GRANT USAGE, CREATE ON SCHEMA public TO s3_app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO s3_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO s3_app_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO s3_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO s3_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO s3_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO s3_app_user;

-- Create the login lookup table used by the application.
CREATE TABLE public.app_users (
  user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_name VARCHAR(100) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  password TEXT NOT NULL
);

-- Insert local/demo accounts. Replace these example credentials before use.
INSERT INTO public.app_users (
    user_name,
    first_name,
    password
)
VALUES
    ('ranul', 'Ranul', 'P@s$w0rD1!2B'),
    ('gehan', 'Gehan', 'P@s$w0rD1!2B'),
    ('damith', 'Damith', 'P@s$w0rD1!2B');


-- Example future migration: add profile and authorization fields to each sample.
ALTER TABLE public.app_users
    ADD COLUMN last_name VARCHAR(100),
    ADD COLUMN role VARCHAR(50);

UPDATE public.app_users
SET
    last_name = CASE user_name
        WHEN 'ranul' THEN 'Doe'
        WHEN 'gehan' THEN 'Smith'
        WHEN 'damith' THEN 'Wilson'
    END,
    role = CASE user_name
        WHEN 'ranul' THEN 'admin'
        WHEN 'gehan' THEN 'user'
        WHEN 'damith' THEN 'manager'
    END
WHERE user_name IN ('ranul', 'gehan', 'damith');

