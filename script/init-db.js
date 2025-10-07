import mysql from 'mysql2/promise';
import fs from 'fs';

const main = async () => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      multipleStatements: true
    });

    const sql = fs.readFileSync('./script/db.sql', 'utf8');

    console.log('Création de la base et des tables...');
    await connection.query(sql);

    console.log('Base de données créée avec succès !');
    await connection.end();
  } catch (err) {
    console.error('Erreur :', err.message);
  }
};

main();
