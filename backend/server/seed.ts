/**
 * Seed Script - Setup reviewers and initial data
 * Run with: npx tsx server/seed.ts
 */
import { v4 as uuidv4 } from 'uuid';
import { supabase, testConnection } from './supabaseClient.js';

const sampleAlerts = [
  {
    title: 'Severe Thunderstorm Warning - Metro Area',
    description: 'The National Weather Service has issued a severe thunderstorm warning. Expect damaging winds up to 60 mph and quarter-sized hail. Seek shelter immediately.',
    category: 'WEATHER',
    severity: 'HIGH',
    source: 'NWS',
    verified: true,
    ai_processed: true,
    ai_confidence: 0.98,
  },
  {
    title: 'CVE-2024-1234: Critical Remote Code Execution',
    description: 'A critical vulnerability has been discovered in widely-used software. Attackers can execute arbitrary code remotely. Patch immediately.',
    category: 'CYBER',
    severity: 'HIGH',
    source: 'CISA',
    source_url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-1234',
    verified: true,
    ai_processed: true,
    ai_confidence: 0.95,
    action_step: 'Update all affected software immediately and verify patches are applied.',
    steps: JSON.stringify([
      'Identify all systems running the affected software',
      'Apply the security patch from the official vendor',
      'Restart affected services after patching',
      'Monitor logs for any signs of exploitation'
    ]),
  },
  {
    title: 'Phone Scam Alert: Fake IRS Calls',
    description: 'Reports of scammers impersonating IRS agents demanding immediate payment via gift cards. The IRS never calls demanding immediate payment. Hang up and report.',
    category: 'SCAM',
    severity: 'MEDIUM',
    source: 'Consumer Protection Bureau',
    verified: true,
    ai_processed: true,
    ai_confidence: 0.92,
    action_step: 'Hang up immediately if someone claims to be from the IRS demanding payment.',
    steps: JSON.stringify([
      'Never provide personal information over the phone to unsolicited callers',
      'Report the scam call to the FTC at reportfraud.ftc.gov',
      'Block the caller number on your phone',
      'Warn family and friends about this scam'
    ]),
  },
  {
    title: 'Flash Flood Watch - Coastal Counties',
    description: 'A flash flood watch is in effect for coastal counties through tomorrow evening. 2-4 inches of rain expected. Avoid flood-prone areas.',
    category: 'WEATHER',
    severity: 'MEDIUM',
    location_lat: 40.7128,
    location_lng: -74.006,
    location_radius: 50,
    source: 'NWS',
    verified: true,
    ai_processed: true,
    ai_confidence: 0.97,
    action_step: 'Avoid driving through flooded roads - turn around, don\'t drown.',
    steps: JSON.stringify([
      'Move to higher ground if you are in a flood-prone area',
      'Avoid walking or driving through flood waters',
      'Keep emergency supplies ready including flashlight and water',
      'Monitor local news and weather alerts'
    ]),
  },
  {
    title: 'Vehicle Break-ins Reported Downtown',
    description: 'Police report increased vehicle break-ins in downtown parking garages. Do not leave valuables visible. Report suspicious activity.',
    category: 'CRIME',
    severity: 'MEDIUM',
    location_lat: 40.758,
    location_lng: -73.9855,
    location_radius: 5,
    source: 'Local Police Department',
    verified: true,
    ai_processed: true,
    ai_confidence: 0.88,
    action_step: 'Remove all valuables from your vehicle before parking.',
    steps: JSON.stringify([
      'Park in well-lit areas with security cameras when possible',
      'Do not leave bags, electronics, or packages visible in your car',
      'Lock all doors and close all windows completely',
      'Report any suspicious activity to police at 911'
    ]),
  },
  {
    title: 'Flu Activity Elevated - Get Vaccinated',
    description: 'Local health officials report elevated flu activity. Get your flu shot, wash hands frequently, and stay home if you feel unwell.',
    category: 'HEALTH',
    severity: 'LOW',
    source: 'County Health Department',
    verified: true,
    ai_processed: true,
    ai_confidence: 0.94,
    action_step: 'Get your flu vaccination if you haven\'t already this season.',
    steps: JSON.stringify([
      'Schedule a flu shot at your local pharmacy or doctor',
      'Wash hands frequently with soap for at least 20 seconds',
      'Stay home if you have flu symptoms to avoid spreading illness',
      'Cover coughs and sneezes with your elbow'
    ]),
  },
  // Alerts Tab seed data - location-based alerts with action_step and steps
  {
    external_id: 'SEED-TAB-001',
    title: 'UPI scam campaign active in Bengaluru',
    description: 'Fake SMS links impersonating SBI and HDFC are targeting Bengaluru residents.',
    action_step: 'Do not click any SMS link claiming to be from your bank.',
    steps: JSON.stringify([
      'Call 1930 (National Cybercrime Helpline) and report the SMS',
      'Change your UPI PIN immediately from the official bank app',
      'Check your last 10 transactions for unauthorised payments',
      'Block the sender number from your telecom provider\'s app'
    ]),
    category: 'news',
    severity: 'high',
    source: 'NDTV',
    source_url: 'https://www.ndtv.com',
    verified: true,
    ai_processed: true,
    ai_confidence: 0.96,
    location_lat: 12.9716,
    location_lng: 77.5946,
  },
  {
    external_id: 'SEED-TAB-002',
    title: 'Chain snatching spree near Jayanagar, Bengaluru',
    description: 'Three chain-snatching incidents reported near Jayanagar this week. Avoid isolated streets after dark.',
    action_step: 'Avoid wearing visible jewellery while travelling alone in this area.',
    steps: JSON.stringify([
      'Avoid isolated streets and poorly lit areas especially after 8pm',
      'Call 100 (Police) immediately if you witness or experience an incident',
      'Share your live location with a trusted contact when travelling alone',
      'Report incidents at the nearest police station within 24 hours'
    ]),
    category: 'crime',
    severity: 'high',
    source: 'Times of India',
    source_url: 'https://timesofindia.indiatimes.com',
    verified: true,
    ai_processed: true,
    ai_confidence: 0.89,
    location_lat: 12.9279,
    location_lng: 77.5829,
  },
  {
    external_id: 'SEED-TAB-003',
    title: 'Phishing emails targeting IT employees',
    description: 'CERT-In advisory: spear-phishing campaign targeting tech sector employees nationwide.',
    action_step: 'Do not open email attachments from unknown senders.',
    steps: JSON.stringify([
      'Enable multi-factor authentication on your work email account',
      'Report suspicious emails to your IT security team immediately',
      'Do not click links in unexpected emails even from known addresses',
      'Run a malware scan if you opened any suspicious attachment'
    ]),
    category: 'cyber',
    severity: 'medium',
    source: 'CERT-In',
    source_url: 'https://www.cert-in.org.in',
    verified: true,
    ai_processed: true,
    ai_confidence: 0.94,
    location_lat: null,
    location_lng: null,
  },
];

async function seed() {
  console.log('🌱 Community Guardian Seed Script');
  console.log('================================\n');

  // Test connection
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Database connection failed. Check your .env file.');
    process.exit(1);
  }
  console.log('✅ Database connected\n');

  // Check if incidents already exist
  const { count } = await supabase
    .from('incidents')
    .select('*', { count: 'exact', head: true });

  if (count && count > 0) {
    console.log(`ℹ️  Database already has ${count} incidents.`);
    console.log('   Skipping seed to avoid duplicates.\n');
    console.log('   To re-seed, clear the incidents table first.');
    process.exit(0);
  }

  // Insert sample alerts
  console.log('📝 Inserting sample alerts...');

  const now = new Date();
  const incidents = sampleAlerts.map((alert, i) => ({
    ...alert,
    id: uuidv4(),
    created_at: new Date(now.getTime() - i * 3600000).toISOString(),
    expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));

  const { error } = await supabase.from('incidents').insert(incidents);

  if (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }

  console.log(`✅ Seeded ${incidents.length} sample alerts\n`);
  console.log('Categories seeded:');
  console.log('  - WEATHER: 2 alerts');
  console.log('  - CYBER: 1 alert');
  console.log('  - SCAM: 1 alert');
  console.log('  - CRIME: 1 alert');
  console.log('  - HEALTH: 1 alert');
  console.log('\n🎉 Seed complete!');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
