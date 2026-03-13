import { createHmac } from 'crypto';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import type { Request, Response, NextFunction } from 'express';

const COOKIE_NAME = 'ma_auth';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function sign(value: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(value).digest('base64url');
  return `${value}.${sig}`;
}

function unsign(signed: string, secret: string): string | false {
  const idx = signed.lastIndexOf('.');
  if (idx < 0) return false;
  const value = signed.slice(0, idx);
  if (sign(value, secret) === signed) return value;
  return false;
}

/** Check if a raw Cookie header contains a valid auth cookie */
export function isAuthenticated(cookieHeader: string | undefined, secret: string): boolean {
  if (!cookieHeader) return false;
  const cookies = parseCookie(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  return unsign(token, secret) === 'authenticated';
}

/** Express middleware: redirect to login if not authenticated */
export function requireAuth(password: string, secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Allow login endpoint through
    if (req.path === '/api/login') return next();

    if (isAuthenticated(req.headers.cookie, secret)) {
      return next();
    }

    // Serve login page for HTML requests, 401 for API/others
    if (req.accepts('html')) {
      return res.status(200).send(loginPageHtml());
    }
    return res.status(401).json({ error: 'Unauthorized' });
  };
}

/** POST /api/login handler */
export function loginHandler(password: string, secret: string) {
  return (req: Request, res: Response) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const submitted = params.get('password');

      if (submitted === password) {
        const token = sign('authenticated', secret);
        res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, token, {
          httpOnly: true,
          maxAge: COOKIE_MAX_AGE,
          path: '/',
          sameSite: 'lax',
        }));
        return res.redirect('/');
      }

      return res.status(200).send(loginPageHtml('密码错误，请重试'));
    });
  };
}

function loginPageHtml(error?: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>魔法运动会 — 登录</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0d0d1a;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .card {
      background: #1a171e;
      border: 3px solid #35303b;
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      max-width: 360px;
      width: 90%;
    }
    h1 { color: #ffd700; font-size: 24px; margin-bottom: 8px; }
    .sub { color: #888; margin-bottom: 24px; font-size: 14px; }
    input {
      width: 100%;
      padding: 12px 16px;
      border-radius: 8px;
      border: 2px solid #35303b;
      background: #0d0d1a;
      color: #fff;
      font-size: 16px;
      margin-bottom: 16px;
    }
    input:focus { outline: none; border-color: #ffd700; }
    button {
      width: 100%;
      padding: 12px;
      border-radius: 8px;
      border: none;
      background: #e81e3c;
      color: #fff;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
    }
    button:hover { background: #c4162f; }
    .error { color: #e81e3c; margin-bottom: 12px; font-size: 14px; }
  </style>
</head>
<body>
  <form class="card" method="POST" action="/api/login">
    <h1>魔法运动会</h1>
    <p class="sub">Magical Athlete</p>
    ${error ? `<p class="error">${error}</p>` : ''}
    <input type="password" name="password" placeholder="请输入密码" autofocus required />
    <button type="submit">进入游戏</button>
  </form>
</body>
</html>`;
}
