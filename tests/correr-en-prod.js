// Corre la suite contra el sitio publicado.
// Existe porque en PowerShell 5.1 no sirve la sintaxis "VAR=x comando".
const { execSync } = require('child_process');

const base = process.env.AVIGO_BASE || 'https://teccapitalweb.github.io/avigo-app/';
console.log('Corriendo contra:', base, '\n');

try {
  execSync('npx playwright test ' + process.argv.slice(2).join(' '), {
    stdio: 'inherit',
    cwd: __dirname,
    env: { ...process.env, AVIGO_BASE: base },
  });
} catch (e) {
  process.exit(e.status || 1);
}
