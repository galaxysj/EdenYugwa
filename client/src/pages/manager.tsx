import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Package, Calendar, User, Phone, MapPin, MessageSquare, FileText, Download, LogOut } from "lucide-react";

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  zipCode: string;
  address1: string;
  address2?: string;
  smallBoxQuantity: number;
  largeBoxQuantity: number;
  wrappingQuantity: number;
  totalAmount: number;
  paymentStatus: 'pending' | 'confirmed' | 'refunded';
  status: 'pending' | 'scheduled' | 'delivered';
  scheduledDate?: string;
  specialRequests?: string;
  createdAt: string;
}

const statusOptions = [
  { value: "pending", label: "배송 준비중", variant: "secondary" as const },
  { value: "scheduled", label: "배송 예정", variant: "outline" as const },
  { value: "delivered", label: "배송 완료", variant: "default" as const }
];

const paymentStatusOptions = [
  { value: "pending", label: "입금 대기", variant: "destructive" as const },
  { value: "confirmed", label: "입금 완료", variant: "default" as const },
  { value: "refunded", label: "환불", variant: "secondary" as const }
];

export default function Manager() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    status: "",
    paymentStatus: "",
    scheduledDate: "",
    specialRequests: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/manager/check");
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const response = await fetch("/api/manager/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "로그인에 실패했습니다");
      }
      
      return response.json();
    },
    onSuccess: () => {
      setIsAuthenticated(true);
      setLoginError("");
      toast({
        title: "로그인 성공",
        description: "매니저 페이지에 접속했습니다.",
      });
    },
    onError: (error: any) => {
      setLoginError(error.message || "로그인에 실패했습니다.");
    },
  });

  // Fetch orders
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: isAuthenticated,
  });

  // Update order mutation
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error("주문 업데이트에 실패했습니다");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setIsEditDialogOpen(false);
      toast({
        title: "주문 정보 업데이트",
        description: "주문 정보가 성공적으로 업데이트되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "업데이트 실패",
        description: "주문 정보 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // SMS notification mutation
  const sendSmsNotificationMutation = useMutation({
    mutationFn: async ({ orderId, message, recipient }: { orderId: number; message: string; recipient: string }) => {
      const response = await fetch("/api/sms-notifications", {
        method: "POST",
        body: JSON.stringify({ orderId, message, recipient }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error("SMS 전송에 실패했습니다");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "SMS 알림 전송",
        description: "SMS 알림이 성공적으로 전송되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "SMS 전송 실패",
        description: "SMS 알림 전송에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Excel export
  const handleExcelExport = () => {
    const url = "/api/orders/export/excel";
    const link = document.createElement("a");
    link.href = url;
    link.download = `한과주문관리_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setLoginError("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    loginMutation.mutate({ username, password });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    toast({
      title: "로그아웃",
      description: "성공적으로 로그아웃되었습니다.",
    });
  };

  const openEditDialog = (order: Order) => {
    setSelectedOrder(order);
    setEditFormData({
      status: order.status,
      paymentStatus: order.paymentStatus,
      scheduledDate: order.scheduledDate ? format(new Date(order.scheduledDate), "yyyy-MM-dd") : "",
      specialRequests: order.specialRequests || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateOrder = () => {
    if (!selectedOrder) return;

    const updates: any = {
      status: editFormData.status,
      paymentStatus: editFormData.paymentStatus,
      specialRequests: editFormData.specialRequests || null,
    };

    if (editFormData.scheduledDate) {
      updates.scheduledDate = new Date(editFormData.scheduledDate).toISOString();
    }

    updateOrderMutation.mutate({
      id: selectedOrder.id,
      updates,
    });
  };

  const handleSendStatusUpdate = (order: Order) => {
    const statusText = statusOptions.find(opt => opt.value === order.status)?.label || order.status;
    const message = `[에덴한과] ${order.customerName}님의 주문 상태가 "${statusText}"로 변경되었습니다. 주문번호: ${order.orderNumber}`;
    
    sendSmsNotificationMutation.mutate({
      orderId: order.id,
      message,
      recipient: order.customerPhone,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-amber-800">매니저 로그인</CardTitle>
            <CardDescription>주문 관리 시스템에 접속하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">아이디</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="아이디를 입력하세요"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  required
                />
              </div>
              {loginError && (
                <div className="text-red-600 text-sm text-center">{loginError}</div>
              )}
              <Button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "로그인 중..." : "로그인"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="text-amber-800">주문 정보를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-amber-800">매니저 페이지</h1>
            <p className="text-amber-600 mt-1">주문 관리 및 상태 업데이트</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleExcelExport} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              엑셀 다운로드
            </Button>
            <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              로그아웃
            </Button>
          </div>
        </div>

        {/* Orders List */}
        <div className="grid gap-4">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">등록된 주문이 없습니다.</p>
              </CardContent>
            </Card>
          ) : (
            orders.map((order: Order) => (
              <Card key={order.id} className="border-l-4 border-l-amber-400">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Order Info */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-amber-600" />
                        <span className="font-semibold text-amber-800">주문번호: {order.orderNumber}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-amber-600" />
                        <span>{order.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-amber-600" />
                        <span>{order.customerPhone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-amber-600" />
                        <span className="text-sm text-gray-600">
                          {format(new Date(order.createdAt), "MM/dd HH:mm", { locale: ko })}
                        </span>
                      </div>
                    </div>

                    {/* Address & Items */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div className="text-sm">
                          <div>({order.zipCode})</div>
                          <div>{order.address1}</div>
                          {order.address2 && <div>{order.address2}</div>}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm">소박스: {order.smallBoxQuantity}개</div>
                        <div className="text-sm">대박스: {order.largeBoxQuantity}개</div>
                        {order.wrappingQuantity > 0 && (
                          <div className="text-sm text-amber-700">보자기포장: {order.wrappingQuantity}개</div>
                        )}
                      </div>
                    </div>

                    {/* Status & Special Requests */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={statusOptions.find(opt => opt.value === order.status)?.variant}>
                          {statusOptions.find(opt => opt.value === order.status)?.label}
                        </Badge>
                        <Badge variant={paymentStatusOptions.find(opt => opt.value === order.paymentStatus)?.variant}>
                          {paymentStatusOptions.find(opt => opt.value === order.paymentStatus)?.label}
                        </Badge>
                      </div>
                      {order.scheduledDate && (
                        <div className="text-sm text-amber-700">
                          예약발송: {format(new Date(order.scheduledDate), "MM/dd", { locale: ko })}
                        </div>
                      )}
                      {order.specialRequests && (
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-amber-600 mt-0.5" />
                          <div className="text-sm text-gray-600 line-clamp-2">{order.specialRequests}</div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => openEditDialog(order)}
                        className="bg-amber-600 hover:bg-amber-700"
                        size="sm"
                      >
                        상태 수정
                      </Button>
                      <Button
                        onClick={() => handleSendStatusUpdate(order)}
                        variant="outline"
                        size="sm"
                        disabled={sendSmsNotificationMutation.isPending}
                      >
                        상태 알림
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Edit Order Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>주문 정보 수정</DialogTitle>
              <DialogDescription>
                {selectedOrder && `주문번호: ${selectedOrder.orderNumber}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>배송 상태</Label>
                <Select value={editFormData.status} onValueChange={(value) => setEditFormData({...editFormData, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>결제 상태</Label>
                <Select value={editFormData.paymentStatus} onValueChange={(value) => setEditFormData({...editFormData, paymentStatus: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>예약 발송일</Label>
                <Input
                  type="date"
                  value={editFormData.scheduledDate}
                  onChange={(e) => setEditFormData({...editFormData, scheduledDate: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>특별 요청사항</Label>
                <Textarea
                  value={editFormData.specialRequests}
                  onChange={(e) => setEditFormData({...editFormData, specialRequests: e.target.value})}
                  placeholder="특별 요청사항을 입력하세요"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                취소
              </Button>
              <Button
                onClick={handleUpdateOrder}
                className="bg-amber-600 hover:bg-amber-700"
                disabled={updateOrderMutation.isPending}
              >
                {updateOrderMutation.isPending ? "업데이트 중..." : "업데이트"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}