import { createRequire } from 'module';
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import passport from "./auth";
import { userService } from "./user-service";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { isSQLite } from "./db";

const require = createRequire(import.meta.url);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

const DATABASE_URL = process.env.DATABASE_URL || '';

// 세션 설정 (SQLite는 메모리 스토어, PostgreSQL은 pg 스토어)
if (isSQLite) {
  const MemStore = MemoryStore(session);
  app.use(session({
    store: new MemStore({
      checkPeriod: 86400000
    }),
    secret: process.env.SESSION_SECRET || 'eden-hangwa-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: false,
      httpOnly: true,
    },
  }));
  console.log('메모리 세션 스토어 사용 (SQLite 모드)');
} else {
  const connectPg = require('connect-pg-simple');
  const pgStore = connectPg(session);
  app.use(session({
    store: new pgStore({
      conString: DATABASE_URL,
      createTableIfMissing: false,
      tableName: 'sessions',
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: false,
      httpOnly: true,
    },
  }));
  console.log('PostgreSQL 세션 스토어 사용');
}

// Passport 초기화
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // 초기 관리자/매니저 계정 생성
  await userService.createInitialAccounts();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
