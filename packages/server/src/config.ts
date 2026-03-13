import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface AppConfig {
  port: number;
  password: string | null;
  cookieSecret: string;
}

export function loadConfig(): AppConfig {
  const candidates = [
    resolve(process.cwd(), 'config.json'),
    resolve(import.meta.dirname, '../../../config.json'),
  ];

  for (const configPath of candidates) {
    if (existsSync(configPath)) {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
      return {
        port: raw.port ?? 3000,
        password: raw.password ?? null,
        cookieSecret: raw.cookieSecret ?? 'dev-secret',
      };
    }
  }

  return {
    port: parseInt(process.env.PORT || '3001'),
    password: null,
    cookieSecret: 'dev-secret',
  };
}
