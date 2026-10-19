-- Create user_data table (key/value blob store for all user account data)
CREATE TABLE IF NOT EXISTS public.user_data (
  phone      text NOT NULL,
  role       text NOT NULL,
  data_key   text NOT NULL,
  value      text NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT user_data_phone_role_data_key_pk PRIMARY KEY (phone, role, data_key)
);
