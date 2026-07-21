import { z } from 'zod';

const EnvironmentSchema = z.object({
  DATABASE_URL: z.string().url(), DIRECT_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(), NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1), SUPABASE_JWT_SECRET: z.string().min(1),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().min(1), NEXT_PUBLIC_API_URL: z.string().url(),
  DEMO_PASSWORD: z.string().min(1), NEXT_PUBLIC_DEMO_EMAIL_1: z.string().email(),
  NEXT_PUBLIC_DEMO_EMAIL_2: z.string().email(), NEXT_PUBLIC_DEMO_PASSWORD: z.string().min(1),
});

const parsed = EnvironmentSchema.safeParse(process.env);
if (!parsed.success) {
  const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  console.error(`Missing or invalid required environment variables: ${missing}`);
  process.exit(1);
}
console.log('Environment validation passed.');
