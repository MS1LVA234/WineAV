const mysql = require('./backend/node_modules/mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: 'maglev.proxy.rlwy.net',
    port: 20946,
    user: 'root',
    password: 'IkTQiIvPqEiPKzGlGxWsWNbNtpjQwVrz',
    database: 'railway'
  });

  const [users] = await connection.execute('SELECT id, username, email FROM users');
  console.log('Utilizadores registados:');
  console.table(users);

  await connection.end();
}

run().catch(console.error);
