import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Shield, User, Crown, CheckCircle, AlertTriangle, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface User {
  id: number;
  username: string;
  name: string;
  phoneNumber: string;
  role: 'admin' | 'manager' | 'user';
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export function UserManagement() {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [targetRole, setTargetRole] = useState<'user' | 'manager'>('user');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    refetchInterval: 10000, // 10초마다 새로고침
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: 'user' | 'manager' }) => {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update role');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "권한 변경 완료",
        description: `${data.name}님의 권한이 ${data.role === 'manager' ? '매니저' : '일반 사용자'}로 변경되었습니다.`,
      });
      setShowConfirmDialog(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "권한 변경 실패",
        description: error.message || "권한 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleRoleChange = (user: User, newRole: 'user' | 'manager') => {
    setSelectedUser(user);
    setTargetRole(newRole);
    setShowConfirmDialog(true);
  };

  const confirmRoleChange = () => {
    if (selectedUser) {
      updateRoleMutation.mutate({ userId: selectedUser.id, role: targetRole });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-4 w-4" />;
      case 'manager':
        return <Shield className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive" className="gap-1">{getRoleIcon(role)} 관리자</Badge>;
      case 'manager':
        return <Badge variant="default" className="gap-1">{getRoleIcon(role)} 매니저</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1">{getRoleIcon(role)} 일반사용자</Badge>;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '없음';
    return new Date(dateString).toLocaleString('ko-KR');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">사용자 목록을 불러오는 중...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            회원 관리
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 mb-4">
            총 {users.length}명의 회원이 등록되어 있습니다.
          </div>
          
          {/* 데스크탑 테이블 뷰 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">사용자명</th>
                  <th className="text-left p-3 font-medium">이름</th>
                  <th className="text-left p-3 font-medium">전화번호</th>
                  <th className="text-left p-3 font-medium">권한</th>
                  <th className="text-left p-3 font-medium">상태</th>
                  <th className="text-left p-3 font-medium">가입일</th>
                  <th className="text-left p-3 font-medium">최근 로그인</th>
                  <th className="text-left p-3 font-medium">작업</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{user.username}</td>
                    <td className="p-3">{user.name}</td>
                    <td className="p-3">{user.phoneNumber}</td>
                    <td className="p-3">{getRoleBadge(user.role)}</td>
                    <td className="p-3">
                      {user.isActive ? (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          활성
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          비활성
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-sm">{formatDate(user.createdAt)}</td>
                    <td className="p-3 text-sm">{formatDate(user.lastLoginAt)}</td>
                    <td className="p-3">
                      {user.role !== 'admin' && (
                        <div className="flex gap-2">
                          {user.role === 'user' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRoleChange(user, 'manager')}
                              disabled={updateRoleMutation.isPending}
                            >
                              매니저 승격
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRoleChange(user, 'user')}
                              disabled={updateRoleMutation.isPending}
                            >
                              일반사용자로 변경
                            </Button>
                          )}
                        </div>
                      )}
                      {user.role === 'admin' && (
                        <span className="text-sm text-gray-400">최고 관리자</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 뷰 */}
          <div className="md:hidden space-y-4">
            {users.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="space-y-3">
                  {/* 상단: 이름과 권한 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-lg">{user.name}</h3>
                      <p className="text-sm text-gray-600">@{user.username}</p>
                    </div>
                    {getRoleBadge(user.role)}
                  </div>
                  
                  {/* 중간: 연락처와 상태 */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{user.phoneNumber}</span>
                    </div>
                    {user.isActive ? (
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        활성
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        비활성
                      </Badge>
                    )}
                  </div>
                  
                  {/* 하단: 날짜 정보와 작업 버튼 */}
                  <div className="space-y-2 text-xs text-gray-500">
                    <div>가입일: {formatDate(user.createdAt)}</div>
                    <div>최근 로그인: {formatDate(user.lastLoginAt)}</div>
                  </div>
                  
                  {/* 작업 버튼 */}
                  {user.role !== 'admin' && (
                    <div className="pt-2 border-t">
                      {user.role === 'user' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRoleChange(user, 'manager')}
                          disabled={updateRoleMutation.isPending}
                          className="w-full"
                        >
                          매니저로 승격
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRoleChange(user, 'user')}
                          disabled={updateRoleMutation.isPending}
                          className="w-full"
                        >
                          일반사용자로 변경
                        </Button>
                      )}
                    </div>
                  )}
                  {user.role === 'admin' && (
                    <div className="pt-2 border-t text-center text-sm text-gray-400">
                      최고 관리자 (변경 불가)
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {users.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              등록된 사용자가 없습니다.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 권한 변경 확인 다이얼로그 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>권한 변경 확인</DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <>
                  <strong>{selectedUser.name}</strong>님의 권한을{' '}
                  <strong>{targetRole === 'manager' ? '매니저' : '일반 사용자'}</strong>로 변경하시겠습니까?
                  <br />
                  <br />
                  {targetRole === 'manager' ? (
                    <span className="text-blue-600">
                      매니저 권한이 부여되면 매니저 페이지에 접근할 수 있습니다.
                    </span>
                  ) : (
                    <span className="text-orange-600">
                      일반 사용자로 변경되면 매니저 페이지에 접근할 수 없습니다.
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              취소
            </Button>
            <Button onClick={confirmRoleChange} disabled={updateRoleMutation.isPending}>
              {updateRoleMutation.isPending ? '변경 중...' : '확인'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}