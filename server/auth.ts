import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { users } from '@shared/schema';
import { db } from './db';
import { eq } from 'drizzle-orm';
import type { User } from '@shared/schema';

// Passport Local Strategy 설정
passport.use(new LocalStrategy(
  {
    usernameField: 'username',
    passwordField: 'password'
  },
  async (username: string, password: string, done) => {
    try {
      // 사용자 찾기
      const [user] = await db.select().from(users).where(eq(users.username, username));
      
      if (!user) {
        return done(null, false, { message: '사용자를 찾을 수 없습니다.' });
      }

      if (!user.isActive) {
        return done(null, false, { message: '비활성화된 계정입니다.' });
      }

      // 비밀번호 확인
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValidPassword) {
        return done(null, false, { message: '비밀번호가 올바르지 않습니다.' });
      }

      // 마지막 로그인 시간 업데이트
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// 세션 직렬화
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// 세션 역직렬화
passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    done(null, user || null);
  } catch (error) {
    done(error);
  }
});

// 인증 미들웨어
export const requireAuth = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: '로그인이 필요합니다.' });
};

// 역할 기반 인증 미들웨어
export const requireRole = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    const user = req.user as User;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }

    return next();
  };
};

// 관리자 전용 미들웨어
export const requireAdmin = requireRole(['admin']);

// 관리자 또는 매니저 권한 미들웨어
export const requireManagerOrAdmin = requireRole(['admin', 'manager']);

export default passport;