-- ========================================
-- GAMIFICATION SYSTEM DATABASE SCHEMA
-- ========================================

-- User gamification stats (main table)
CREATE TABLE IF NOT EXISTS user_gamification_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  documents_created INTEGER DEFAULT 0,
  lines_of_code INTEGER DEFAULT 0,
  achievements JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT user_gamification_stats_user_id_unique UNIQUE(user_id),
  CONSTRAINT user_gamification_stats_streak_positive CHECK (current_streak >= 0),
  CONSTRAINT user_gamification_stats_xp_positive CHECK (total_xp >= 0),
  CONSTRAINT user_gamification_stats_level_positive CHECK (level >= 1)
);

-- Achievement definitions (static data)
CREATE TABLE IF NOT EXISTS achievements (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(10) NOT NULL,
  category VARCHAR(30) NOT NULL, -- 'coding', 'learning', 'streak', 'social'
  requirement_type VARCHAR(50) NOT NULL, -- 'documents_created', 'streak_days', 'xp_total', etc.
  requirement_value INTEGER NOT NULL,
  xp_reward INTEGER DEFAULT 0,
  rarity VARCHAR(20) DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- XP activity log (for analytics and history)
CREATE TABLE IF NOT EXISTS xp_activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  xp_earned INTEGER NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leaderboard view (for efficient queries)
CREATE OR REPLACE VIEW leaderboard_stats AS
SELECT 
  ugs.user_id,
  COALESCE(users.raw_user_meta_data->>'full_name', 
           split_part(users.email, '@', 1)) as display_name,
  users.email,
  ugs.total_xp,
  ugs.level,
  ugs.current_streak,
  ugs.longest_streak,
  ugs.documents_created,
  array_length(ugs.achievements, 1) as achievement_count,
  ugs.updated_at
FROM user_gamification_stats ugs
JOIN auth.users users ON users.id = ugs.user_id
ORDER BY ugs.total_xp DESC;

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on all tables
ALTER TABLE user_gamification_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_activities ENABLE ROW LEVEL SECURITY;

-- Policies for user_gamification_stats
CREATE POLICY "Users can read own gamification stats" ON user_gamification_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gamification stats" ON user_gamification_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gamification stats" ON user_gamification_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for xp_activities
CREATE POLICY "Users can read own xp activities" ON xp_activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own xp activities" ON xp_activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Achievements table is readable by all authenticated users
CREATE POLICY "Authenticated users can read achievements" ON achievements
  FOR SELECT USING (auth.role() = 'authenticated');

-- Leaderboard is readable by all authenticated users (limited data)
-- Note: This is handled by the view definition above

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Gamification stats indexes
CREATE INDEX IF NOT EXISTS idx_user_gamification_stats_user_id 
  ON user_gamification_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_gamification_stats_xp 
  ON user_gamification_stats(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_gamification_stats_level 
  ON user_gamification_stats(level DESC);
CREATE INDEX IF NOT EXISTS idx_user_gamification_stats_streak 
  ON user_gamification_stats(current_streak DESC);

-- XP activities indexes
CREATE INDEX IF NOT EXISTS idx_xp_activities_user_id 
  ON xp_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_activities_created_at 
  ON xp_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_activities_type 
  ON xp_activities(activity_type);

-- ========================================
-- FUNCTIONS AND TRIGGERS
-- ========================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_gamification_stats
DROP TRIGGER IF EXISTS update_user_gamification_stats_updated_at ON user_gamification_stats;
CREATE TRIGGER update_user_gamification_stats_updated_at
    BEFORE UPDATE ON user_gamification_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create gamification record for new users
CREATE OR REPLACE FUNCTION create_user_gamification_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_gamification_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to create gamification stats when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_gamification_stats();

-- ========================================
-- SEED DATA - ACHIEVEMENTS
-- ========================================

INSERT INTO achievements (id, name, description, icon, category, requirement_type, requirement_value, xp_reward, rarity) VALUES
-- Coding Achievements
('first_document', 'First Steps', 'Created your first HTML document', '👶', 'coding', 'documents_created', 1, 50, 'common'),
('documents_5', 'Getting Started', 'Created 5 HTML documents', '📝', 'coding', 'documents_created', 5, 100, 'common'),
('documents_10', 'Productive Coder', 'Created 10 HTML documents', '💻', 'coding', 'documents_created', 10, 200, 'rare'),
('documents_25', 'Code Machine', 'Created 25 HTML documents', '⚙️', 'coding', 'documents_created', 25, 400, 'rare'),
('documents_50', 'HTML Master', 'Created 50 HTML documents', '👑', 'coding', 'documents_created', 50, 800, 'epic'),
('documents_100', 'Legend', 'Created 100 HTML documents', '🏆', 'coding', 'documents_created', 100, 1500, 'legendary'),

-- Streak Achievements  
('streak_3', 'Getting Warmed Up', 'Maintained a 3-day coding streak', '🔥', 'streak', 'streak_days', 3, 100, 'common'),
('streak_7', 'On Fire!', 'Maintained a 7-day coding streak', '🚀', 'streak', 'streak_days', 7, 250, 'rare'),
('streak_14', 'Unstoppable', 'Maintained a 2-week coding streak', '⚡', 'streak', 'streak_days', 14, 500, 'epic'),
('streak_30', 'Coding Addict', 'Maintained a 30-day coding streak', '💎', 'streak', 'streak_days', 30, 1000, 'epic'),
('streak_100', 'Streak Legend', 'Maintained a 100-day coding streak', '🌟', 'streak', 'streak_days', 100, 2500, 'legendary'),

-- XP Achievements
('xp_100', 'Experience Gained', 'Earned your first 100 XP', '⭐', 'learning', 'xp_total', 100, 50, 'common'),
('xp_500', 'Knowledge Seeker', 'Earned 500 XP', '🎓', 'learning', 'xp_total', 500, 150, 'common'),
('xp_1000', 'Wisdom Keeper', 'Earned 1,000 XP', '🧠', 'learning', 'xp_total', 1000, 300, 'rare'),
('xp_2500', 'Master Learner', 'Earned 2,500 XP', '🎯', 'learning', 'xp_total', 2500, 600, 'epic'),
('xp_5000', 'XP Champion', 'Earned 5,000 XP', '👑', 'learning', 'xp_total', 5000, 1200, 'legendary'),

-- Level Achievements
('level_5', 'Rising Star', 'Reached level 5', '🌠', 'learning', 'level', 5, 200, 'common'),
('level_10', 'Expert Coder', 'Reached level 10', '💫', 'learning', 'level', 10, 500, 'rare'),
('level_20', 'Code Warrior', 'Reached level 20', '⚔️', 'learning', 'level', 20, 1000, 'epic'),
('level_50', 'Coding God', 'Reached level 50', '🌌', 'learning', 'level', 50, 2500, 'legendary')

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  requirement_type = EXCLUDED.requirement_type,
  requirement_value = EXCLUDED.requirement_value,
  xp_reward = EXCLUDED.xp_reward,
  rarity = EXCLUDED.rarity;

-- ========================================
-- HELPFUL QUERIES FOR TESTING
-- ========================================

/*
-- View user stats
SELECT * FROM user_gamification_stats WHERE user_id = 'your-user-id';

-- View leaderboard (top 10)
SELECT * FROM leaderboard_stats LIMIT 10;

-- View user's XP history
SELECT * FROM xp_activities WHERE user_id = 'your-user-id' ORDER BY created_at DESC;

-- Check achievements
SELECT * FROM achievements ORDER BY requirement_value;

-- Reset user progress (for testing)
DELETE FROM user_gamification_stats WHERE user_id = 'your-user-id';
DELETE FROM xp_activities WHERE user_id = 'your-user-id';
*/