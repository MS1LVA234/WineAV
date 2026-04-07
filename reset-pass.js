const bcrypt = require('./backend/node_modules/bcryptjs');

const novaPassword = 'nova_password'; // muda aqui
const hash = bcrypt.hashSync(novaPassword, 10);
console.log('Hash gerado:');
console.log(hash);
