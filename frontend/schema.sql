-- Create Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Drive Folders table
CREATE TABLE drive_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  folder_type TEXT NOT NULL CHECK (folder_type IN ('source', 'completed')),
  folder_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Social Accounts table (stores session cookies/tokens securely)
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'facebook')),
  username TEXT,
  session_cookies JSONB, -- Will store the playwright cookie array
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Publishing Rules table
CREATE TABLE publishing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'facebook')),
  caption_template TEXT DEFAULT 'Check out this video! {hashtags}',
  hashtags TEXT DEFAULT '#video #viral',
  max_videos_per_day INTEGER DEFAULT 2,
  time_slots JSONB DEFAULT '["10:00", "15:00"]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(profile_id, platform)
);

-- Create Video Jobs table (to track upload status)
CREATE TABLE video_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  platform_statuses JSONB DEFAULT '{"youtube": "pending", "tiktok": "pending", "instagram": "pending", "facebook": "pending"}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create UI Selectors table (for self-healing automation)
CREATE TABLE ui_selectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT UNIQUE NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'facebook', 'drive')),
  selectors JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default selectors (can be edited later in the UI)
INSERT INTO ui_selectors (platform, selectors) VALUES 
('tiktok', '{"upload_button": "#upload-btn", "file_input": "input[type=''file'']"}'),
('youtube', '{"upload_button": "#create-icon", "file_input": "input[type=''file'']"}');
