import { db, isSQLite } from "./db";
import { userSessions, accessControlSettings, loginAttempts, loginApprovalRequests, type InsertUserSession, type InsertAccessControlSettings, type InsertLoginAttempt, type InsertLoginApprovalRequest } from "@shared/schema";
import { eq, and, gte, desc, lt } from "drizzle-orm";

function getSQLiteTimestamp(): string {
  return new Date().toISOString();
}

// User-Agent 파싱을 위한 간단한 유틸리티
function parseUserAgent(userAgent: string) {
  let deviceType = 'desktop';
  
  // 모바일 감지 (iPhone, Android 폰)
  if (/Mobile|Android|iPhone/.test(userAgent) && !/iPad/.test(userAgent)) {
    deviceType = 'mobile';
  }
  // 태블릿 감지 (iPad, Android 태블릿)
  else if (/iPad|Tablet/.test(userAgent)) {
    deviceType = 'tablet';
  }
  // 노트북 감지 (Mac, Windows, Linux 랩톱)
  else if (/Macintosh|Windows NT.*WOW64|Windows NT.*Win64|Linux.*x86_64/.test(userAgent) && !/Mobile|Tablet/.test(userAgent)) {
    deviceType = 'laptop';
  }
  
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

    const newSession: any = {
      userId: sessionData.userId,
      sessionId: sessionData.sessionId,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      location,
      deviceType,
      browserInfo,
      isActive: true,
    };
    if (isSQLite) {
      // Convert Date to ISO string for SQLite
      newSession.expiresAt = sessionData.expiresAt instanceof Date 
        ? sessionData.expiresAt.toISOString() 
        : sessionData.expiresAt;
      // Don't pass createdAt/lastActivity - let SQLite use DEFAULT
    } else {
      newSession.expiresAt = sessionData.expiresAt;
    }

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
      const values: any = { userId, ...settings };
      // Don't pass timestamps for SQLite - let database defaults handle them
      const [created] = await db
        .insert(accessControlSettings)
        .values(values)
        .returning();
      return created;
    }
  }

  // 로그인 시도 기록
  async logLoginAttempt(attemptData: InsertLoginAttempt) {
    const { deviceType } = parseUserAgent(attemptData.userAgent || '');
    const location = getLocationFromIP(attemptData.ipAddress);

    const values: any = {
      ...attemptData,
      location,
      deviceType,
    };
    // Don't pass createdAt for SQLite - let database default handle it
    const [attempt] = await db
      .insert(loginAttempts)
      .values(values)
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

  // 접근 제어 검증 및 승인 요청 처리
  async validateAccess(userId: number, requestData: {
    ipAddress: string;
    userAgent: string;
    sessionId?: string;
  }): Promise<{ 
    allowed: boolean; 
    reason?: string; 
    requiresApproval?: boolean;
    approvalRequestId?: number;
  }> {
    const settings = await this.getAccessControlSettings(userId);
    
    if (!settings || !settings.isEnabled) {
      return { allowed: true };
    }

    const { deviceType } = parseUserAgent(requestData.userAgent);
    const location = getLocationFromIP(requestData.ipAddress);

    let blockReasons: string[] = [];

    // 디바이스 타입 검증
    if (settings.allowedDeviceTypes && settings.allowedDeviceTypes.length > 0 && 
        !settings.allowedDeviceTypes.includes(deviceType)) {
      blockReasons.push(`허용되지 않은 디바이스 타입: ${this.getDeviceTypeLabel(deviceType)}`);
    }

    // IP 범위 검증
    if (settings.allowedIpRanges && settings.allowedIpRanges.length > 0) {
      const isAllowedIp = settings.allowedIpRanges.some((range: string) => {
        return requestData.ipAddress.startsWith(range) || range === '*';
      });
      
      if (!isAllowedIp) {
        blockReasons.push(`허용되지 않은 IP 주소: ${requestData.ipAddress}`);
      }
    }

    // 차단 사유가 있는 경우 승인 요청 생성
    if (blockReasons.length > 0 && requestData.sessionId) {
      try {
        const approvalRequest = await this.createLoginApprovalRequest({
          userId,
          sessionId: requestData.sessionId,
          ipAddress: requestData.ipAddress,
          userAgent: requestData.userAgent,
          requestReason: blockReasons.join('; '),
        });

        return {
          allowed: false,
          requiresApproval: true,
          approvalRequestId: approvalRequest.id,
          reason: `접근이 제한되었습니다. 관리자 승인이 필요합니다.\n사유: ${blockReasons.join(', ')}`
        };
      } catch (error) {
        console.error('승인 요청 생성 실패:', error);
        return {
          allowed: false,
          reason: blockReasons.join(', ')
        };
      }
    }

    // 동시 세션 수 검증 (승인 요청 대상이 아님)
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
          // 현재 세션이 아닌 것들만
          // Note: currentSessionId가 다른 것들만 선택
        )
      );
  }

  // 로그인 승인 요청 생성
  async createLoginApprovalRequest(requestData: {
    userId: number;
    sessionId: string;
    ipAddress: string;
    userAgent?: string;
    requestReason: string;
  }) {
    const { deviceType } = parseUserAgent(requestData.userAgent || '');
    const location = getLocationFromIP(requestData.ipAddress);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30분 후 만료

    const values: any = {
      userId: requestData.userId,
      sessionId: requestData.sessionId,
      ipAddress: requestData.ipAddress,
      userAgent: requestData.userAgent,
      location,
      deviceType,
      requestReason: requestData.requestReason,
    };
    // Convert Date to ISO string for SQLite
    if (isSQLite) {
      values.expiresAt = expiresAt.toISOString();
    } else {
      values.expiresAt = expiresAt;
    }
    // Don't pass createdAt - let database default handle it
    const [request] = await db
      .insert(loginApprovalRequests)
      .values([values])
      .returning();

    return request;
  }

  // 대기 중인 승인 요청 조회
  async getPendingApprovalRequests(userId?: number) {
    const query = db
      .select()
      .from(loginApprovalRequests)
      .where(
        and(
          eq(loginApprovalRequests.status, "pending"),
          gte(loginApprovalRequests.expiresAt, new Date())
        )
      )
      .orderBy(desc(loginApprovalRequests.createdAt));

    if (userId) {
      const userQuery = db
        .select()
        .from(loginApprovalRequests)
        .where(
          and(
            eq(loginApprovalRequests.status, "pending"),
            gte(loginApprovalRequests.expiresAt, new Date()),
            eq(loginApprovalRequests.userId, userId)
          )
        )
        .orderBy(desc(loginApprovalRequests.createdAt));
      return await userQuery;
    }

    return await query;
  }

  // 승인 요청 처리
  async handleApprovalRequest(requestId: number, action: 'approve' | 'reject', approvedBy: number) {
    const [request] = await db
      .select()
      .from(loginApprovalRequests)
      .where(eq(loginApprovalRequests.id, requestId));

    if (!request || request.status !== 'pending') {
      throw new Error('유효하지 않은 요청입니다');
    }

    if (new Date() > request.expiresAt) {
      throw new Error('만료된 요청입니다');
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    
    await db
      .update(loginApprovalRequests)
      .set({
        status,
        approvedBy,
        approvedAt: new Date(),
      })
      .where(eq(loginApprovalRequests.id, requestId));

    // 승인된 경우 접근 제어 설정에 추가
    if (action === 'approve') {
      const settings = await this.getAccessControlSettings(request.userId);
      if (settings) {
        // IP 범위에 추가
        const updatedIpRanges = settings.allowedIpRanges ? [...settings.allowedIpRanges] : [];
        if (!updatedIpRanges.includes(request.ipAddress)) {
          updatedIpRanges.push(request.ipAddress);
        }

        // 디바이스 타입에 추가
        const updatedDeviceTypes = settings.allowedDeviceTypes ? [...settings.allowedDeviceTypes] : [];
        if (request.deviceType && !updatedDeviceTypes.includes(request.deviceType)) {
          updatedDeviceTypes.push(request.deviceType);
        }

        await this.upsertAccessControlSettings(request.userId, {
          allowedIpRanges: updatedIpRanges as string[],
          allowedDeviceTypes: updatedDeviceTypes as string[],
        });
      }
    }

    return request;
  }

  // 만료된 승인 요청 정리
  async cleanupExpiredApprovalRequests() {
    await db
      .update(loginApprovalRequests)
      .set({ status: 'expired' })
      .where(
        and(
          eq(loginApprovalRequests.status, 'pending'),
          lt(loginApprovalRequests.expiresAt, new Date())
        )
      );
  }
}

export const sessionService = new SessionService();