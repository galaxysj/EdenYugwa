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
        return <Badge variant="destructive" className="gap-1 admin-text-xs">{getRoleIcon(role)} 관리자</Badge>;
      case 'manager':
        return <Badge variant="default" className="gap-1 admin-text-xs">{getRoleIcon(role)} 매니저</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1 admin-text-xs">{getRoleIcon(role)} 일반사용자</Badge>;
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
            <span className="ml-2 admin-text">사용자 목록을 불러오는 중...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 admin-subtitle">
            <Users className="h-5 w-5" />
            회원 관리
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="admin-text-sm text-gray-600 mb-4">
            총 {users.length}명의 회원이 등록되어 있습니다.
          </div>
          
          {/* 데스크탑 테이블 뷰 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium admin-text-sm">사용자명</th>
                  <th className="text-left p-3 font-medium admin-text-sm">이름</th>
                  <th className="text-left p-3 font-medium admin-text-sm">전화번호</th>
                  <th className="text-left p-3 font-medium admin-text-sm">권한</th>
                  <th className="text-left p-3 font-medium admin-text-sm">상태</th>
                  <th className="text-left p-3 font-medium admin-text-sm">가입일</th>
                  <th className="text-left p-3 font-medium admin-text-sm">최근 로그인</th>
                  <th className="text-left p-3 font-medium admin-text-sm">작업</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 admin-text-xxs">{user.username}</td>
                    <td className="p-3 admin-text-xxs">{user.name}</td>
                    <td className="p-3 admin-text-xxs">{user.phoneNumber}</td>
                    <td className="p-3">{getRoleBadge(user.role)}</td>
                    <td className="p-3">
                      {user.isActive ? (
                        <Badge variant="outline" className="gap-1 admin-text-xs">
                          <CheckCircle className="h-3 w-3" />
                          활성
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 admin-text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          비활성
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 admin-text-xs">{formatDate(user.createdAt)}</td>
                    <td className="p-3 admin-text-xs">{formatDate(user.lastLoginAt)}</td>
                    <td className="p-3">
                      {user.role !== 'admin' && (
                        <div className="flex gap-2">
                          {user.role === 'user' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRoleChange(user, 'manager')}
                              disabled={updateRoleMutation.isPending}
                              className="admin-text-xxs px-2 py-1 h-6"
                            >
                              매니저 승격
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRoleChange(user, 'user')}
                              disabled={updateRoleMutation.isPending}
                              className="admin-text-xxs px-2 py-1 h-6"
                            >
                              일반사용자로 변경
                            </Button>
                          )}
                        </div>
                      )}
                      {user.role === 'admin' && (
                        <span className="admin-text-sm text-gray-400">최고 관리자</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 리스트 뷰 */}
          <div className="md:hidden space-y-2">
            {users.map((user) => (
              <div key={user.id} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  {/* 왼쪽: 사용자 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium admin-text-xxs truncate">{user.name}</h3>
                      {getRoleBadge(user.role)}
                    </div>
                    <div className="flex items-center gap-3 admin-text-xs text-gray-500">
                      <span className="admin-text-xxs">@{user.username}</span>
                      <span className="flex items-center gap-1 admin-text-xxs">
                        <Phone className="h-3 w-3" />
                        {user.phoneNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {user.isActive ? (
                        <Badge variant="outline" className="gap-1 admin-text-xs px-1 py-0">
                          <CheckCircle className="h-2 w-2" />
                          활성
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 admin-text-xs px-1 py-0">
                          <AlertTriangle className="h-2 w-2" />
                          비활성
                        </Badge>
                      )}
                      <span className="admin-text-xs text-gray-400">
                        가입: {formatDate(user.createdAt)}
                      </span>
                    </div>
                  </div>
                  
                  {/* 오른쪽: 작업 버튼 */}
                  <div className="flex-shrink-0 ml-2">
                    {user.role !== 'admin' ? (
                      user.role === 'user' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRoleChange(user, 'manager')}
                          disabled={updateRoleMutation.isPending}
                          className="admin-text-xxs px-2 py-1 h-6"
                        >
                          승격
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRoleChange(user, 'user')}
                          disabled={updateRoleMutation.isPending}
                          className="admin-text-xxs px-2 py-1 h-6"
                        >
                          일반
                        </Button>
                      )
                    ) : (
                      <span className="admin-text-xs text-gray-400">최고관리자</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {users.length === 0 && (
            <div className="text-center py-8 admin-text text-gray-500">
              등록된 사용자가 없습니다.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 권한 변경 확인 다이얼로그 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="admin-subtitle">권한 변경 확인</DialogTitle>
            <DialogDescription className="admin-text">
              {selectedUser && (
                <>
                  <strong>{selectedUser.name}</strong>님의 권한을{' '}
                  <strong>{targetRole === 'manager' ? '매니저' : '일반 사용자'}</strong>로 변경하시겠습니까?
                  <br />
                  <br />
                  {targetRole === 'manager' ? (
                    <span className="text-blue-600 admin-text-sm">
                      매니저 권한이 부여되면 매니저 페이지에 접근할 수 있습니다.
                    </span>
                  ) : (
                    <span className="text-orange-600 admin-text-sm">
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