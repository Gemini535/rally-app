import { resolve } from 'node:path';

// `tsx watch` does not load workspace env files itself; Vercel supplies these.
process.loadEnvFile(resolve(process.cwd(), '../../.env'));

const { default: app } = await import('./app.js');
const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`Rally API listening on http://localhost:${port}`);
});
