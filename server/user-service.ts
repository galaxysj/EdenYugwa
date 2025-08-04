import bcrypt from 'bcryptjs';
import { users } from '@shared/schema';
import { db } from './db';
import { eq } from 'drizzle-orm';
import type { User, InsertUser } from '@shared/schema';

export class UserService {
  // 사용자 생성
  async createUser(userData: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const [user] = await db.insert(users).values({
      username: userData.username,
      passwordHash: hashedPassword,
      role: userData.role,
      isActive: userData.isActive ?? true
    }).returning();

    return user;
  }

  // 사용자 조회 (ID)
  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  // 사용자 조회 (사용자명)
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  // 사용자 조회 (사용자명) - 별칭
  async findByUsername(username: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    return user || null;
  }

  // 사용자 목록 조회
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // 사용자 업데이트
  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  // 사용자 삭제 (비활성화)
  async deactivateUser(id: number): Promise<User | undefined> {
    const [user] = await db.update(users).set({ isActive: false }).where(eq(users.id, id)).returning();
    return user;
  }

  // 비밀번호 변경
  async changePassword(id: number, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const [user] = await db.update(users).set({ passwordHash: hashedPassword }).where(eq(users.id, id)).returning();
    return !!user;
  }

  // 사용자 인증
  async authenticate(username: string, password: string): Promise<User | null> {
    try {
      const user = await this.getUserByUsername(username);
      if (user && user.isActive && await bcrypt.compare(password, user.passwordHash)) {
        // Update last login time
        await this.updateLastLogin(user.id);
        return user;
      }
      return null;
    } catch (error) {
      console.error("Authentication error:", error);
      return null;
    }
  }

  // 마지막 로그인 시간 업데이트
  async updateLastLogin(id: number): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  }

  // 초기 관리자 계정 생성
  async createInitialAccounts(): Promise<void> {
    try {
      const adminUsername = process.env.ADMIN_USERNAME;
      const adminPassword = process.env.ADMIN_PASSWORD;
      const managerUsername = process.env.MANAGER_USERNAME;
      const managerPassword = process.env.MANAGER_PASSWORD;

      if (!adminUsername || !adminPassword || !managerUsername || !managerPassword) {
        console.log('Admin/Manager credentials not found in environment variables');
        return;
      }

      // 관리자 계정 확인 및 생성
      const existingAdmin = await this.getUserByUsername(adminUsername);
      if (!existingAdmin) {
        await this.createUser({
          username: adminUsername,
          password: adminPassword,
          role: 'admin',
          isActive: true
        });
        console.log('Admin account created successfully');
      } else {
        console.log('Admin account already exists');
      }

      // 매니저 계정 확인 및 생성
      const existingManager = await this.getUserByUsername(managerUsername);
      if (!existingManager) {
        await this.createUser({
          username: managerUsername,
          password: managerPassword,
          role: 'manager',
          isActive: true
        });
        console.log('Manager account created successfully');
      } else {
        console.log('Manager account already exists');
      }

    } catch (error) {
      console.error('Error creating initial accounts:', error);
    }
  }
}

export const userService = new UserService();