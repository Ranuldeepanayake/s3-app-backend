-- Run with an RDS PostgreSQL administrator through psql. The application role
-- authenticates with IAM, so no static database password is created or stored.
CREATE ROLE s3_app_user LOGIN;
GRANT rds_iam TO s3_app_user;

DROP DATABASE IF EXISTS "s3-app";

-- Try this.  
GRANT s3_app_user TO postgres;
CREATE DATABASE "s3-app" OWNER s3_app_user;

CREATE DATABASE "s3-app";
ALTER DATABASE "s3-app" OWNER TO s3_app_user;
GRANT ALL PRIVILEGES ON DATABASE "s3-app" TO s3_app_user;

-- Run the below to change ownership of existing objects because 
\connect "s3-app"

GRANT USAGE, CREATE ON SCHEMA public TO s3_app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO s3_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO s3_app_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO s3_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO s3_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO s3_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO s3_app_user;

-- Create a table.
CREATE TABLE public.app_users (
  user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_name VARCHAR(100) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  password TEXT NOT NULL
);

--- Insert sample data.
INSERT INTO public.app_users (
    user_name,
    first_name,
    password
)
VALUES
    ('ranul', 'Ranul', 'P@s$w0rD1!2B'),
    ('gehan', 'Gehan', 'P@s$w0rD1!2B'),
    ('damith', 'Damith', 'P@s$w0rD1!2B');


--- Migration to be done later.
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

