-- ============================================================
-- Nail Habit App — Database Setup
-- Run this in Supabase SQL Editor (same project as kreiraj-ips)
-- ============================================================

-- 1. Create nail_habit_profiles table
-- (separate from user_profiles used by kreiraj-ips)

CREATE TABLE IF NOT EXISTS nail_habit_profiles (
  id                    UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email                 TEXT,
  full_name             TEXT,
  avatar_url            TEXT,
  trial_end_date        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  subscription_status   TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired')),
  subscription_plan     TEXT CHECK (subscription_plan IN ('monthly', 'yearly') OR subscription_plan IS NULL),
  subscription_end_date TIMESTAMPTZ,
  paypal_subscription_id TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security

ALTER TABLE nail_habit_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "nail_habit_profiles_select" ON nail_habit_profiles;
DROP POLICY IF EXISTS "nail_habit_profiles_insert" ON nail_habit_profiles;
DROP POLICY IF EXISTS "nail_habit_profiles_update" ON nail_habit_profiles;

CREATE POLICY "nail_habit_profiles_select"
  ON nail_habit_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "nail_habit_profiles_insert"
  ON nail_habit_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "nail_habit_profiles_update"
  ON nail_habit_profiles FOR UPDATE
  USING (auth.uid() = id);

-- 3. Auto-create profile on first user signup
-- (coexists with kreiraj-ips trigger — different trigger name)

CREATE OR REPLACE FUNCTION public.handle_nail_habit_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.nail_habit_profiles (id, email, full_name, avatar_url, trial_end_date)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_nail_habit_auth_user_created ON auth.users;

CREATE TRIGGER on_nail_habit_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_nail_habit_new_user();

-- 4. Updated_at trigger

CREATE OR REPLACE FUNCTION public.set_nail_habit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nail_habit_profiles_updated_at ON nail_habit_profiles;

CREATE TRIGGER nail_habit_profiles_updated_at
  BEFORE UPDATE ON nail_habit_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_nail_habit_updated_at();

-- ============================================================
-- Done. Add the Supabase URL and anon key to .env.local
-- ============================================================
