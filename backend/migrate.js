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
      await pool.query("ALTER TABLE questions ADD COLUMN logic JSON");
      console.log('Added logic to questions.');
    } catch(e) { console.log('logic already exists or error', e.message); }

    try {
      await pool.query("ALTER TABLE questions ADD COLUMN validation_rules JSON");
      console.log('Added validation_rules to questions.');
    } catch(e) { console.log('validation_rules already exists or error', e.message); }

    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS survey_responses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        survey_id INT,
        user_id INT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_submission (survey_id, user_id)
      )`);
      console.log('Created survey_responses.');
    } catch(e) { console.log('Error creating survey_responses', e.message); }

    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS question_responses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        response_id INT,
        question_id INT,
        answer JSON NOT NULL,
        FOREIGN KEY (response_id) REFERENCES survey_responses(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      )`);
      console.log('Created question_responses.');
    } catch(e) { console.log('Error creating question_responses', e.message); }

    try {
      await pool.query("ALTER TABLE question_responses ADD COLUMN ai_insight JSON");
      console.log('Added ai_insight to question_responses.');
    } catch(e) { console.log('ai_insight already exists or error', e.message); }

    console.log('Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
