import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Smartphone, 
  Monitor, 
  Tablet, 
  MapPin, 
  Clock, 
  Eye,
  Trash2,
  Settings,
  History,
  ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface UserSession {
  id: number;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  deviceType?: string;
  browserInfo?: string;
  isActive: boolean;
  lastActivity: string;
  createdAt: string;
  isCurrent?: boolean;
}

interface LoginAttempt {
  id: number;
  username?: string;
  ipAddress: string;
  userAgent?: string;
  location?: string;
  deviceType?: string;
  success: boolean;
  failureReason?: string;
  createdAt: string;
}

interface AccessControlSettings {
  userId: number;
  allowedIpRanges: string[];
  allowedCountries: string[];
  allowedDeviceTypes: string[];
  blockUnknownDevices: boolean;
  maxConcurrentSessions: number;
  sessionTimeout: number;
  requireLocationVerification: boolean;
  isEnabled: boolean;
}

interface ApprovalRequest {
  id: number;
  userId: number;
  sessionId: string;
  ipAddress: string;
  userAgent?: string;
  location?: string;
  deviceType?: string;
  requestReason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt: string;
}

export default function SecuritySettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [newIpRange, setNewIpRange] = useState("");
  const [newCountry, setNewCountry] = useState("");

  // 활성 세션 조회
  const { data: sessions, isLoading: sessionsLoading } = useQuery<UserSession[]>({
    queryKey: ['/api/auth/sessions'],
    refetchInterval: 30000, // 30초마다 자동 새로고침
  });

  // 로그인 기록 조회
  const { data: loginHistory, isLoading: historyLoading } = useQuery<LoginAttempt[]>({
    queryKey: ['/api/auth/login-history'],
  });

  // 승인 요청 조회 (관리자만)
  const { data: approvalRequests, isLoading: approvalRequestsLoading } = useQuery<ApprovalRequest[]>({
    queryKey: ['/api/auth/approval-requests'],
    refetchInterval: 10000, // 10초마다 자동 새로고침
  });

  // 접근 제어 설정 조회
  const { data: accessSettings, isLoading: settingsLoading } = useQuery<AccessControlSettings>({
    queryKey: ['/api/auth/access-control'],
  });

  // 세션 종료 뮤테이션
  const terminateSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('세션 종료에 실패했습니다');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/sessions'] });
      toast({
        title: "성공",
        description: "세션이 종료되었습니다",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 접근 제어 설정 업데이트 뮤테이션
  const updateAccessControlMutation = useMutation({
    mutationFn: async (settings: Partial<AccessControlSettings>) => {
      const response = await fetch('/api/auth/access-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        throw new Error('설정 업데이트에 실패했습니다');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/access-control'] });
      toast({
        title: "성공",
        description: "접근 제어 설정이 업데이트되었습니다",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType) {
      case 'mobile': return <Smartphone className="h-4 w-4" />;
      case 'tablet': return <Tablet className="h-4 w-4" />;
      case 'desktop': return <Monitor className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const getDeviceTypeLabel = (deviceType?: string) => {
    switch (deviceType) {
      case 'mobile': return '모바일';
      case 'tablet': return '태블릿';
      case 'desktop': return '데스크톱';
      case 'laptop': return '노트북';
      default: return '알 수 없음';
    }
  };

  const addIpRange = () => {
    if (!newIpRange.trim() || !accessSettings) return;
    
    const updatedSettings = {
      ...accessSettings,
      allowedIpRanges: [...accessSettings.allowedIpRanges, newIpRange.trim()]
    };
    updateAccessControlMutation.mutate(updatedSettings);
    setNewIpRange("");
  };

  const removeIpRange = (index: number) => {
    if (!accessSettings) return;
    
    const updatedSettings = {
      ...accessSettings,
      allowedIpRanges: accessSettings.allowedIpRanges.filter((_, i) => i !== index)
    };
    updateAccessControlMutation.mutate(updatedSettings);
  };

  const addCountry = () => {
    if (!newCountry.trim() || !accessSettings) return;
    
    const updatedSettings = {
      ...accessSettings,
      allowedCountries: [...accessSettings.allowedCountries, newCountry.trim()]
    };
    updateAccessControlMutation.mutate(updatedSettings);
    setNewCountry("");
  };

  const removeCountry = (index: number) => {
    if (!accessSettings) return;
    
    const updatedSettings = {
      ...accessSettings,
      allowedCountries: accessSettings.allowedCountries.filter((_, i) => i !== index)
    };
    updateAccessControlMutation.mutate(updatedSettings);
  };

  const updateSetting = (key: keyof AccessControlSettings, value: any) => {
    if (!accessSettings) return;
    
    const updatedSettings = {
      ...accessSettings,
      [key]: value
    };
    updateAccessControlMutation.mutate(updatedSettings);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6" />
          <h1 className="text-2xl font-bold">보안 설정</h1>
        </div>
        <Button 
          variant="outline" 
          onClick={() => setLocation('/admin')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          뒤로가기
        </Button>
      </div>

      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            활성 세션
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            로그인 기록
          </TabsTrigger>
          <TabsTrigger value="access-control" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            접근 제어
          </TabsTrigger>
        </TabsList>

        {/* 활성 세션 탭 */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>활성 세션 관리</CardTitle>
              <p className="text-sm text-gray-600">
                현재 로그인된 디바이스들을 확인하고 관리할 수 있습니다.
              </p>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <div className="text-center py-8">로딩 중...</div>
              ) : (
                <div className="space-y-4">
                  {sessions?.map((session) => (
                    <div 
                      key={session.id} 
                      className={`border rounded-lg p-4 ${session.isCurrent ? 'bg-blue-50 border-blue-200' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {getDeviceIcon(session.deviceType)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium">
                                {getDeviceTypeLabel(session.deviceType)}
                              </span>
                              {session.browserInfo && (
                                <Badge variant="secondary" className="text-xs">
                                  {session.browserInfo}
                                </Badge>
                              )}
                              {session.isCurrent && (
                                <Badge className="text-xs bg-green-100 text-green-800">
                                  현재 세션
                                </Badge>
                              )}
                            </div>
                            
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3 w-3" />
                                <span>{session.location || '알 수 없음'}</span>
                                <span className="text-gray-400">•</span>
                                <span>{session.ipAddress}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                <span>
                                  마지막 활동: {format(new Date(session.lastActivity), 'PPpp', { locale: ko })}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                로그인: {format(new Date(session.createdAt), 'PPpp', { locale: ko })}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {!session.isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => terminateSessionMutation.mutate(session.sessionId)}
                            disabled={terminateSessionMutation.isPending}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {!sessions?.length && (
                    <div className="text-center py-8 text-gray-500">
                      활성 세션이 없습니다.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 로그인 기록 탭 */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>로그인 기록</CardTitle>
              <p className="text-sm text-gray-600">
                최근 로그인 시도 기록을 확인할 수 있습니다.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {historyLoading ? (
                  <div className="text-center py-8">로딩 중...</div>
                ) : loginHistory && loginHistory.length > 0 ? (
                  loginHistory.map((attempt) => (
                    <div 
                      key={attempt.id} 
                      className={`border rounded-lg p-3 ${
                        attempt.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {getDeviceIcon(attempt.deviceType)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                variant={attempt.success ? "default" : "destructive"}
                                className="text-xs"
                              >
                                {attempt.success ? '성공' : '실패'}
                              </Badge>
                              {attempt.deviceType && (
                                <span className="text-sm text-gray-600">
                                  {getDeviceTypeLabel(attempt.deviceType)}
                                </span>
                              )}
                            </div>
                            
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3 w-3" />
                                <span>{attempt.location || '알 수 없음'}</span>
                                <span className="text-gray-400">•</span>
                                <span>{attempt.ipAddress}</span>
                              </div>
                              {!attempt.success && attempt.failureReason && (
                                <div className="text-red-600 text-xs">
                                  실패 사유: {attempt.failureReason}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          {format(new Date(attempt.createdAt), 'PPpp', { locale: ko })}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    아직 로그인 기록이 없습니다.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 접근 제어 설정 탭 */}
        <TabsContent value="access-control">
          <Card>
            <CardHeader>
              <CardTitle>접근 제어 설정</CardTitle>
              <p className="text-sm text-gray-600">
                로그인 접근을 제한하는 보안 규칙을 설정할 수 있습니다.
              </p>
            </CardHeader>
            <CardContent>
              {settingsLoading ? (
                <div className="text-center py-8">로딩 중...</div>
              ) : (
                <div className="space-y-6">
                  {/* 접근 제어 활성화 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">접근 제어 활성화</Label>
                      <p className="text-sm text-gray-600">
                        접근 제어 규칙을 활성화합니다
                      </p>
                    </div>
                    <Switch
                      checked={accessSettings?.isEnabled || false}
                      onCheckedChange={(checked) => updateSetting('isEnabled', checked)}
                    />
                  </div>

                  <Separator />

                  {/* 허용된 IP 범위 */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">허용된 IP 범위</Label>
                    <p className="text-sm text-gray-600">
                      특정 IP 주소나 IP 범위에서만 로그인을 허용합니다
                    </p>
                    
                    <div className="flex gap-2">
                      <Input
                        placeholder="예: 192.168.1.* 또는 192.168.1.100"
                        value={newIpRange}
                        onChange={(e) => setNewIpRange(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addIpRange()}
                      />
                      <Button onClick={addIpRange} disabled={!newIpRange.trim()}>
                        추가
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      {accessSettings?.allowedIpRanges?.map((ipRange, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <span className="text-sm">{ipRange}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeIpRange(index)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* 허용된 디바이스 타입 */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">허용된 디바이스 타입</Label>
                    <p className="text-sm text-gray-600">
                      특정 디바이스 타입에서만 로그인을 허용합니다
                    </p>
                    
                    <div className="space-y-2">
                      {['mobile', 'desktop', 'tablet', 'laptop'].map((deviceType) => (
                        <div key={deviceType} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={deviceType}
                            checked={accessSettings?.allowedDeviceTypes?.includes(deviceType) || false}
                            onChange={(e) => {
                              const currentTypes = accessSettings?.allowedDeviceTypes || [];
                              const newTypes = e.target.checked
                                ? [...currentTypes, deviceType]
                                : currentTypes.filter(t => t !== deviceType);
                              updateSetting('allowedDeviceTypes', newTypes);
                            }}
                            className="rounded"
                          />
                          <label htmlFor={deviceType} className="text-sm">
                            {getDeviceTypeLabel(deviceType)}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* 최대 동시 세션 수 */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">최대 동시 세션 수</Label>
                    <p className="text-sm text-gray-600">
                      동시에 로그인할 수 있는 세션의 최대 개수
                    </p>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={accessSettings?.maxConcurrentSessions || 3}
                      onChange={(e) => updateSetting('maxConcurrentSessions', parseInt(e.target.value))}
                      className="w-24"
                    />
                  </div>

                  <Separator />

                  {/* 세션 타임아웃 */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">세션 타임아웃 (시간)</Label>
                    <p className="text-sm text-gray-600">
                      세션이 자동으로 만료되는 시간
                    </p>
                    <Input
                      type="number"
                      min="1"
                      max="168"
                      value={accessSettings?.sessionTimeout || 24}
                      onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value))}
                      className="w-24"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}