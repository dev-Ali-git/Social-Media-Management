CREATE TABLE automation_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT UNIQUE NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'facebook', 'drive')),
  script_code TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
