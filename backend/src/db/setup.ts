/**
 * Database Setup Script
 * 
 * Run this once to create tables and seed data.
 * You can also copy the SQL below and run it in the Supabase SQL Editor.
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ============================================
// Copy this SQL into Supabase SQL Editor
// ============================================
const createTablesSql = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  location_radius DOUBLE PRECISION,
  source TEXT NOT NULL,
  source_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  ai_processed BOOLEAN DEFAULT FALSE,
  ai_confidence DOUBLE PRECISION,
  action_step TEXT,
  steps JSONB,
  content_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Circles table
CREATE TABLE IF NOT EXISTS circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Circle members
CREATE TABLE IF NOT EXISTS circle_members (
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Location shares
CREATE TABLE IF NOT EXISTS location_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_incidents_category ON incidents(category);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_content_hash ON incidents(content_hash);
CREATE INDEX IF NOT EXISTS idx_messages_circle ON messages(circle_id, created_at);
CREATE INDEX IF NOT EXISTS idx_location_shares_circle ON location_shares(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id);
`;

// Seed data
const sampleIncidents = [
  {
    title: 'Phishing Scam Alert: Fake Bank Emails',
    description: 'Multiple reports of phishing emails impersonating major banks. The emails contain links to fake login pages designed to steal credentials. Do not click links in suspicious emails.',
    category: 'SCAM',
    severity: 'HIGH',
    source: 'Cyber Security Agency',
    source_url: 'https://example.com/alerts/phishing',
    verified: true,
    ai_confidence: 0.95
  },
  {
    title: 'Severe Weather Warning: Thunderstorms Expected',
    description: 'The National Weather Service has issued a severe thunderstorm warning for the metropolitan area. Expected between 3 PM and 8 PM today.',
    category: 'WEATHER',
    severity: 'MEDIUM',
    location_lat: 40.7128,
    location_lng: -74.0060,
    location_radius: 50,
    source: 'National Weather Service',
    verified: true,
    ai_confidence: 0.98
  },
  {
    title: 'Vehicle Break-ins Reported in Downtown Area',
    description: 'Police report an increase in vehicle break-ins in the downtown parking areas. Do not leave valuables visible in parked cars.',
    category: 'CRIME',
    severity: 'MEDIUM',
    location_lat: 40.7580,
    location_lng: -73.9855,
    location_radius: 5,
    source: 'Local Police Department',
    verified: true,
    ai_confidence: 0.88
  },
  {
    title: 'Data Breach: Popular Retail Chain Compromised',
    description: 'A major retail chain has disclosed a data breach affecting customer payment information. Monitor your credit card statements.',
    category: 'CYBER',
    severity: 'HIGH',
    source: 'Tech Security News',
    source_url: 'https://example.com/breach-alert',
    verified: true,
    ai_confidence: 0.92
  },
  {
    title: 'Road Closure: Main Street Construction',
    description: 'Main Street between 5th and 8th Avenue will be closed for emergency water main repairs. Expected duration: 48 hours.',
    category: 'OTHER',
    severity: 'LOW',
    location_lat: 40.7484,
    location_lng: -73.9857,
    location_radius: 1,
    source: 'City Transportation Dept',
    verified: true,
    ai_confidence: 0.99
  },
  {
    title: 'Health Advisory: Flu Season Peak',
    description: 'Local health officials report flu activity is at peak levels. Get vaccinated, wash hands frequently, and stay home if unwell.',
    category: 'HEALTH',
    severity: 'MEDIUM',
    source: 'County Health Department',
    verified: true,
    ai_confidence: 0.94
  }
];

async function setup() {
  console.log('📋 Creating tables...');
  console.log('');
  console.log('⚠️  Please run the following SQL in your Supabase SQL Editor:');
  console.log('   Go to: https://supabase.com/dashboard → SQL Editor → New Query');
  console.log('');
  console.log('='.repeat(60));
  console.log(createTablesSql);
  console.log('='.repeat(60));
  console.log('');
  console.log('After running the SQL above, press Enter to seed data...');

  // Wait for user input
  await new Promise<void>(resolve => {
    process.stdin.once('data', () => resolve());
  });

  console.log('🌱 Seeding incidents...');

  const now = new Date();
  const incidents = sampleIncidents.map((inc, i) => ({
    ...inc,
    id: uuidv4(),
    created_at: new Date(now.getTime() - i * 3600000).toISOString()
  }));

  const { error } = await supabase.from('incidents').insert(incidents);

  if (error) {
    console.error('❌ Seed error:', error.message);
    console.log('');
    console.log('If tables don\'t exist yet, run the SQL above first.');
  } else {
    console.log(`✅ Seeded ${incidents.length} incidents`);
  }

  process.exit(0);
}

setup().catch(console.error);
