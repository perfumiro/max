import bcrypt from 'bcryptjs';

const password = process.argv.slice(2).join(' ');

if (!password || password.length < 10) {
  console.error('Usage: npm run hash-password -- "your-strong-password"');
  console.error('Use at least 10 characters.');
  process.exit(1);
}

console.log(bcrypt.hashSync(password, 12));
