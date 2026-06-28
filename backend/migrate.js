const pool = require('./config/db');
const fs = require('fs');

async function runMigration() {
  try {
    const schema = fs.readFileSync('./schema.sql', 'utf8');
    // Splitting by semicolon is risky if there are semicolons in strings, but fine for this simple schema
    const queries = schema.split(';').filter(q => q.trim() !== '');
    
    // For modifying existing tables if they exist without dropping data, we should use ALTER
    // But since this is Day 1/Day 2 and no production data exists, we can drop and recreate, 
    // OR we can just execute ALTER statements.
    
    // Actually, to be safe, I'll execute explicit ALTER statements here.
    console.log('Running schema updates...');
    
    try {
      await pool.query("ALTER TABLE surveys ADD COLUMN status ENUM('draft', 'published') DEFAULT 'draft'");
      console.log('Added status to surveys.');
    } catch(e) { console.log('status already exists or error', e.message); }

    try {
      await pool.query("ALTER TABLE questions ADD COLUMN options JSON");
      console.log('Added options to questions.');
    } catch(e) { console.log('options already exists or error', e.message); }

    try {
      await pool.query("ALTER TABLE questions ADD COLUMN order_index INT DEFAULT 0");
      console.log('Added order_index to questions.');
    } catch(e) { console.log('order_index already exists or error', e.message); }

    try {
      await pool.query("ALTER TABLE questions ADD COLUMN is_required BOOLEAN DEFAULT FALSE");
      console.log('Added is_required to questions.');
    } catch(e) { console.log('is_required already exists or error', e.message); }

    console.log('Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
