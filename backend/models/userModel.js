const pool = require('../config/db');

const createUser = async (username, email, hashedPassword, roleId = 2) => {
  const [result] = await pool.execute(
    'INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, ?)',
    [username, email, hashedPassword, roleId]
  );
  return result.insertId;
};

const getUserByEmail = async (email) => {
  const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
};

module.exports = {
  createUser,
  getUserByEmail
};
