const pool = require('./config/db');
const fs = require('fs');

async function runMigration() {
  try {
    const schema = fs.readFileSync('./schema.sql', 'utf8');
    const queries = schema.split(';').filter(q => q.trim() !== '');
    
    console.log('Running schema updates from schema.sql...');
    
    for (let query of queries) {
      if (query.trim()) {
        await pool.query(query);
      }
    }

    console.log('Migration complete. All tables created successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
