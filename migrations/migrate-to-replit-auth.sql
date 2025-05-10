-- Rename existing users table to preserve data
ALTER TABLE users RENAME TO old_users;

-- Create new users table with Replit Auth schema
CREATE TABLE users (
  "id" varchar PRIMARY KEY NOT NULL,
  "email" varchar UNIQUE,
  "first_name" varchar,
  "last_name" varchar,
  "profile_image_url" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Migrate any tracked products to use email only temporarily
UPDATE tracked_products SET user_id = NULL;

-- Create sessions table needed for Replit Auth
CREATE TABLE IF NOT EXISTS sessions (
  "sid" varchar PRIMARY KEY NOT NULL,
  "sess" jsonb NOT NULL,
  "expire" timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" USING btree ("expire");