import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Save, Settings, Phone, Building, User, Users, Crown, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AdminSettings, User as UserType } from "@shared/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AdminHeader from "@/components/admin-header";

const adminSettingsSchema = z.object({
  adminName: z.string().min(1, "관리자명을 입력해주세요"),
  adminPhone: z.string().min(1, "관리자 전화번호를 입력해주세요"),
  businessName: z.string().min(1, "사업체명을 입력해주세요"),
  businessAddress: z.string().optional(),
  businessPhone: z.string().optional(),
  bankAccount: z.string().optional(),
});

type AdminSettingsFormData = z.infer<typeof adminSettingsSchema>;

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: adminSettings, isLoading } = useQuery<AdminSettings>({
    queryKey: ['/api/admin-settings'],
    retry: false,
  });

  const { data: allUsers = [], isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ['/api/users'],
    retry: false,
    staleTime: 0, // 항상 최신 데이터 가져오기
  });

  // Filter to show only admin and manager users
  const users = allUsers.filter(user => user.role === 'admin' || user.role === 'manager');

  // Manager username editing state
  const [editManagerDialogOpen, setEditManagerDialogOpen] = React.useState(false);
  const [editingManager, setEditingManager] = React.useState<UserType | null>(null);
  const [selectedUserId, setSelectedUserId] = React.useState<string>("");





  const form = useForm<AdminSettingsFormData>({
    resolver: zodResolver(adminSettingsSchema),
    defaultValues: {
      adminName: "",
      adminPhone: "",
      businessName: "에덴한과",
      businessAddress: "",
      businessPhone: "",
      bankAccount: "농협 352-1701-3342-63 (예금주: 손*진)",
    },
  });

  // Reset form when data is loaded
  React.useEffect(() => {
    if (adminSettings) {
      form.reset({
        adminName: adminSettings.adminName || "",
        adminPhone: adminSettings.adminPhone || "",
        businessName: adminSettings.businessName || "에덴한과",
        businessAddress: adminSettings.businessAddress || "",
        businessPhone: adminSettings.businessPhone || "",
        bankAccount: adminSettings.bankAccount || "농협 352-1701-3342-63 (예금주: 손*진)",
      });
    }
  }, [adminSettings, form]);

  const updateMutation = useMutation({
    mutationFn: (data: AdminSettingsFormData) => {
      console.log("Sending admin settings data:", data);
      return apiRequest('POST', '/api/admin-settings', data);
    },
    onSuccess: (response) => {
      console.log("Admin settings update successful:", response);
      queryClient.invalidateQueries({ queryKey: ['/api/admin-settings'] });
      toast({
        title: "설정 업데이트 완료",
        description: "관리자 설정이 성공적으로 업데이트되었습니다.",
      });
    },
    onError: (error: any) => {
      console.error("Admin settings update error:", error);
      toast({
        title: "설정 업데이트 실패",
        description: error.message || "설정 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });



  const onSubmit = (data: AdminSettingsFormData) => {
    updateMutation.mutate(data);
  };

  const updateUserRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) => 
      apiRequest('PATCH', `/api/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "권한 변경 완료",
        description: "사용자 권한이 성공적으로 변경되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "권한 변경 실패",
        description: error.message || "권한 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleRoleChange = (userId: number, newRole: string) => {
    updateUserRoleMutation.mutate({ userId, role: newRole });
  };

  const handleEditManagerUsername = (manager: UserType) => {
    setEditingManager(manager);
    setSelectedUserId(""); // 빈 값으로 시작하여 사용자가 선택하도록 함
    setEditManagerDialogOpen(true);
  };

  const updateManagerUsernameMutation = useMutation({
    mutationFn: ({ managerId, newUserId }: { managerId: number; newUserId: number }) => 
      apiRequest('PATCH', `/api/users/${managerId}/change-user`, { newUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setEditManagerDialogOpen(false);
      setEditingManager(null);
      setSelectedUserId("");
      toast({
        title: "매니저 정보 변경 완료",
        description: "매니저의 사용자 정보가 성공적으로 변경되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "매니저 정보 변경 실패",
        description: error.message || "매니저 정보 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleSaveManagerUsername = () => {
    if (!editingManager || !selectedUserId) return;
    
    const newUserId = parseInt(selectedUserId);
    if (newUserId === editingManager.id) {
      setEditManagerDialogOpen(false);
      return;
    }

    updateManagerUsernameMutation.mutate({ 
      managerId: editingManager.id, 
      newUserId 
    });
  };



  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-500">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-6 w-6 text-eden-brown" />
          <h1 className="text-2xl font-bold text-gray-900">관리자 설정</h1>
        </div>



      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            관리자 정보 설정
          </CardTitle>
          <CardDescription>
            SMS 발송 및 사업 정보에 사용되는 관리자 정보를 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 관리자 정보 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    관리자 정보
                  </h3>
                  
                  <FormField
                    control={form.control}
                    name="adminName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>관리자명 *</FormLabel>
                        <FormControl>
                          <Input placeholder="관리자명을 입력하세요" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="adminPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          관리자 전화번호 * (SMS 발송용)
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="010-1234-5678" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-gray-500">
                          고객에게 SMS를 발송할 때 발신번호로 사용됩니다.
                        </p>
                      </FormItem>
                    )}
                  />
                </div>

                {/* 사업체 정보 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    사업체 정보
                  </h3>

                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>사업체명 *</FormLabel>
                        <FormControl>
                          <Input placeholder="에덴한과" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>사업체 전화번호</FormLabel>
                        <FormControl>
                          <Input placeholder="02-1234-5678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* 주소 및 계좌 정보 */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="businessAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>사업체 주소</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="사업체 주소를 입력하세요" 
                          rows={2} 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankAccount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>입금 계좌 정보</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="농협 352-1701-3342-63 (예금주: 손*진)" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-gray-500">
                        고객에게 안내되는 입금 계좌 정보입니다.
                      </p>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? "저장 중..." : "설정 저장"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* 사용자 권한 관리 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            사용자 권한 관리
          </CardTitle>
          <CardDescription>
            현재 관리자 및 매니저 권한을 가진 사용자들을 표시합니다. 일반 사용자에게 권한을 부여하려면 사용자 관리 탭을 이용하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="text-center py-8 text-gray-500">사용자 목록을 불러오는 중...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">관리자 또는 매니저 권한을 가진 사용자가 없습니다.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>사용자명</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>전화번호</TableHead>
                    <TableHead>현재 권한</TableHead>
                    <TableHead>권한 변경</TableHead>
                    <TableHead>가입일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.id}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.phoneNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.role === 'admin' ? (
                            <>
                              <Crown className="h-4 w-4 text-yellow-600" />
                              <span className="font-medium text-yellow-800">관리자</span>
                            </>
                          ) : user.role === 'manager' ? (
                            <>
                              <UserCheck className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-blue-800">매니저</span>
                            </>
                          ) : (
                            <>
                              <User className="h-4 w-4 text-gray-600" />
                              <span className="text-gray-700">일반 사용자</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            value={user.role}
                            onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                            disabled={updateUserRoleMutation.isPending}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">일반 사용자</SelectItem>
                              <SelectItem value="manager">매니저</SelectItem>
                              <SelectItem value="admin">관리자</SelectItem>
                            </SelectContent>
                          </Select>
                          {user.role === 'manager' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditManagerUsername(user)}
                              disabled={updateUserRoleMutation.isPending || updateManagerUsernameMutation.isPending}
                            >
                              사용자 변경
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 매니저 사용자명 수정 다이얼로그 */}
      <Dialog open={editManagerDialogOpen} onOpenChange={setEditManagerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>매니저 사용자 교체</DialogTitle>
            <DialogDescription>
              현재 매니저 "{editingManager?.username}"를 다른 회원가입자로 교체합니다. 
              기존 매니저는 일반 사용자로 변경되고, 선택한 사용자가 새로운 매니저가 됩니다.
              모든 회원가입된 사용자 중에서 선택할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">새 매니저로 지정할 사용자 선택</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="회원가입된 사용자를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter(user => user.id !== editingManager?.id)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
{user.username} - {user.name || '이름없음'} ({user.phoneNumber || '전화번호없음'}) {user.role === 'manager' ? '(매니저)' : user.role === 'admin' ? '(관리자)' : '(일반회원)'}
                      </SelectItem>
                    ))}
                  {allUsers.filter(user => user.id !== editingManager?.id).length === 0 && (
                    <div className="px-2 py-1 text-sm text-gray-500">사용자를 불러오는 중...</div>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                회원가입된 모든 사용자 중에서 매니저로 지정할 수 있습니다. 권한은 자동으로 매니저로 변경됩니다.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setEditManagerDialogOpen(false)}
              >
                취소
              </Button>
              <Button 
                onClick={handleSaveManagerUsername}
                disabled={!selectedUserId || updateManagerUsernameMutation.isPending}
              >
                {updateManagerUsernameMutation.isPending ? "교체 중..." : "매니저 교체"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SMS 발송 안내 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-600">
            <Phone className="h-5 w-5" />
            SMS 발송 안내
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>SMS 발송 연동:</strong> 위에서 설정한 관리자 전화번호가 고객에게 SMS를 발송할 때 
              발신번호로 사용됩니다. 주문 관리 페이지에서 "SMS 발송" 버튼을 클릭하면 
              설정된 관리자 번호를 통해 고객에게 배송 알림 메시지가 전송됩니다.
            </p>
            <p className="text-sm text-blue-700 mt-2">
              기본 메시지: "[에덴한과] 고객명님, 주문번호 XX 상품이 발송되었습니다. 3일이내 미 도착 시 반드시 연락주세요. 감사합니다. ^^"
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}