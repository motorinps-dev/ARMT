#!/usr/bin/env node

import Database from 'better-sqlite3';
import { createInterface } from 'readline';

const db = new Database('vpn_platform.db');

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('=== Добавление администратора ARMT VPN ===\n');

  const emailOrId = await question('Введите email или Telegram ID пользователя: ');
  
  let user;
  
  if (emailOrId.includes('@')) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(emailOrId);
  } else if (/^\d+$/.test(emailOrId)) {
    user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(parseInt(emailOrId));
  } else {
    console.log('❌ Неверный формат. Введите email или числовой Telegram ID.');
    rl.close();
    return;
  }

  if (!user) {
    console.log('❌ Пользователь не найден!');
    console.log('\nДля создания нового администратора:');
    console.log('1. Зарегистрируйтесь на сайте или в боте');
    console.log('2. Запустите этот скрипт снова');
    rl.close();
    return;
  }

  if (user.is_admin === 1) {
    console.log('✅ Этот пользователь уже является администратором!');
    console.log(`   Email: ${user.email || 'не указан'}`);
    console.log(`   Telegram ID: ${user.telegram_id || 'не указан'}`);
    rl.close();
    return;
  }

  console.log('\nНайден пользователь:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email || 'не указан'}`);
  console.log(`   Telegram ID: ${user.telegram_id || 'не указан'}`);
  console.log(`   Никнейм: ${user.nickname || 'не указан'}\n`);

  const confirm = await question('Сделать этого пользователя администратором? (yes/no): ');

  if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
    console.log('\n✅ Пользователь успешно назначен администратором!');
    console.log('\nТеперь можно войти на сайт и перейти в /admin');
  } else {
    console.log('\n❌ Операция отменена.');
  }

  rl.close();
}

main().catch(err => {
  console.error('❌ Ошибка:', err);
  rl.close();
  process.exit(1);
});
