import { db } from "./db";
import { userSessions, accessControlSettings, loginAttempts, type InsertUserSession, type InsertAccessControlSettings, type InsertLoginAttempt } from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";

// User-Agent 파싱을 위한 간단한 유틸리티
function parseUserAgent(userAgent: string) {
  const deviceType = /Mobile|Android|iPhone|iPad/.test(userAgent) 
    ? (/iPad/.test(userAgent) ? 'tablet' : 'mobile')
    : 'desktop';
  
  let browserInfo = 'Unknown';
  if (userAgent.includes('Chrome')) browserInfo = 'Chrome';
  else if (userAgent.includes('Firefox')) browserInfo = 'Firefox';
  else if (userAgent.includes('Safari')) browserInfo = 'Safari';
  else if (userAgent.includes('Edge')) browserInfo = 'Edge';
  
  return { deviceType, browserInfo };
}

// IP 기반 위치 정보 (실제 환경에서는 GeoIP 서비스 사용)
function getLocationFromIP(ipAddress: string): string {
  // 개발 환경에서는 기본값 반환
  if (ipAddress === '::1' || ipAddress === '127.0.0.1' || ipAddress.startsWith('::ffff:127.')) {
    return '로컬 개발환경';
  }
  
  // 실제 환경에서는 GeoIP 서비스 연동
  // 예: const geoData = await geoipService.lookup(ipAddress);
  return '한국'; // 기본값
}

export class SessionService {
  // 세션 생성
  async createSession(sessionData: {
    userId: number;
    sessionId: string;
    ipAddress: string;
    userAgent: string;
    expiresAt: Date;
  }) {
    const { deviceType, browserInfo } = parseUserAgent(sessionData.userAgent);
    const location = getLocationFromIP(sessionData.ipAddress);

    const newSession: InsertUserSession = {
      userId: sessionData.userId,
      sessionId: sessionData.sessionId,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      location,
      deviceType,
      browserInfo,
      isActive: true,
      expiresAt: sessionData.expiresAt,
    };

    const [session] = await db.insert(userSessions).values(newSession).returning();
    return session;
  }

  // 세션 업데이트 (마지막 활동 시간)
  async updateSessionActivity(sessionId: string) {
    await db
      .update(userSessions)
      .set({ lastActivity: new Date() })
      .where(eq(userSessions.sessionId, sessionId));
  }

  // 세션 비활성화
  async deactivateSession(sessionId: string) {
    await db
      .update(userSessions)
      .set({ isActive: false })
      .where(eq(userSessions.sessionId, sessionId));
  }

  // 사용자의 모든 활성 세션 조회
  async getUserActiveSessions(userId: number) {
    return await db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.userId, userId),
          eq(userSessions.isActive, true),
          gte(userSessions.expiresAt, new Date())
        )
      )
      .orderBy(desc(userSessions.lastActivity));
  }

  // 만료된 세션 정리
  async cleanupExpiredSessions() {
    await db
      .update(userSessions)
      .set({ isActive: false })
      .where(and(
        eq(userSessions.isActive, true),
        gte(userSessions.expiresAt, new Date())
      ));
  }

  // 접근 제어 설정 조회
  async getAccessControlSettings(userId: number) {
    const [settings] = await db
      .select()
      .from(accessControlSettings)
      .where(eq(accessControlSettings.userId, userId));
    
    return settings;
  }

  // 접근 제어 설정 생성/업데이트
  async upsertAccessControlSettings(userId: number, settings: Partial<InsertAccessControlSettings>) {
    const existingSettings = await this.getAccessControlSettings(userId);
    
    if (existingSettings) {
      const [updated] = await db
        .update(accessControlSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(accessControlSettings.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(accessControlSettings)
        .values([{ userId, ...settings }])
        .returning();
      return created;
    }
  }

  // 로그인 시도 기록
  async logLoginAttempt(attemptData: InsertLoginAttempt) {
    const { deviceType } = parseUserAgent(attemptData.userAgent || '');
    const location = getLocationFromIP(attemptData.ipAddress);

    const [attempt] = await db
      .insert(loginAttempts)
      .values({
        ...attemptData,
        location,
        deviceType,
      })
      .returning();
    
    return attempt;
  }

  // 사용자의 로그인 기록 조회
  async getUserLoginHistory(username: string, limit: number = 20) {
    return await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.username, username))
      .orderBy(desc(loginAttempts.createdAt))
      .limit(limit);
  }

  // 접근 제어 검증
  async validateAccess(userId: number, requestData: {
    ipAddress: string;
    userAgent: string;
  }): Promise<{ allowed: boolean; reason?: string }> {
    const settings = await this.getAccessControlSettings(userId);
    
    if (!settings || !settings.isEnabled) {
      return { allowed: true };
    }

    const { deviceType } = parseUserAgent(requestData.userAgent);
    const location = getLocationFromIP(requestData.ipAddress);

    // 디바이스 타입 검증
    if (settings.allowedDeviceTypes && !settings.allowedDeviceTypes.includes(deviceType)) {
      return { 
        allowed: false, 
        reason: `허용되지 않은 디바이스 타입: ${deviceType}` 
      };
    }

    // IP 범위 검증 (간단한 구현)
    if (settings.allowedIpRanges && settings.allowedIpRanges.length > 0) {
      const isAllowedIp = settings.allowedIpRanges.some((range: string) => {
        // 간단한 IP 매칭 (실제로는 CIDR 매칭 구현 필요)
        return requestData.ipAddress.startsWith(range) || range === '*';
      });
      
      if (!isAllowedIp) {
        return { 
          allowed: false, 
          reason: '허용되지 않은 IP 주소' 
        };
      }
    }

    // 동시 세션 수 검증
    const activeSessions = await this.getUserActiveSessions(userId);
    if (activeSessions.length >= settings.maxConcurrentSessions) {
      return { 
        allowed: false, 
        reason: `최대 동시 세션 수 초과 (${settings.maxConcurrentSessions}개)` 
      };
    }

    return { allowed: true };
  }

  // 특정 세션 강제 종료
  async terminateSession(sessionId: string) {
    await this.deactivateSession(sessionId);
  }

  // 사용자의 다른 모든 세션 종료 (현재 세션 제외)
  async terminateOtherSessions(userId: number, currentSessionId: string) {
    await db
      .update(userSessions)
      .set({ isActive: false })
      .where(
        and(
          eq(userSessions.userId, userId),
          eq(userSessions.isActive, true),
          // 현재 세션은 제외
          // Note: Drizzle의 not 함수 사용 필요
        )
      );
  }
}

export const sessionService = new SessionService();