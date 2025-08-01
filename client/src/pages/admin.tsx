import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { ArrowLeft, Settings, Package, Truck, CheckCircle, Clock, Eye, LogOut, DollarSign, AlertCircle, Download, Calendar, Trash2, PiggyBank, Edit, Cog, RefreshCw, X } from "lucide-react";
import { SmsDialog } from "@/components/sms-dialog";
import ScheduledDatePicker from "@/components/scheduled-date-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Order, Setting } from "@shared/schema";

const statusLabels = {
  pending: "주문접수",
  scheduled: "발송예약",
  delivered: "발송완료",
};

const statusIcons = {
  pending: Clock,
  scheduled: Calendar,
  delivered: CheckCircle,
};

// Cost Settings Dialog Component
function CostSettingsDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: settings } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  });
  
  const [smallBoxCost, setSmallBoxCost] = useState("");
  const [largeBoxCost, setLargeBoxCost] = useState("");
  
  // Load existing settings when dialog opens
  useEffect(() => {
    if (settings) {
      const smallCostSetting = settings.find(s => s.key === "smallBoxCost");
      const largeCostSetting = settings.find(s => s.key === "largeBoxCost");
      
      setSmallBoxCost(smallCostSetting?.value || "");
      setLargeBoxCost(largeCostSetting?.value || "");
    }
  }, [settings]);
  
  const updateCostMutation = useMutation({
    mutationFn: async (data: { key: string; value: string; description: string }) => {
      return await api.settings.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "원가 설정 완료",
        description: "전역 원가 설정이 업데이트되었습니다.",
      });
      setOpen(false);
    },
    onError: () => {
      toast({
        title: "오류 발생",
        description: "원가 설정 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    },
  });
  
  const handleSave = async () => {
    if (!smallBoxCost || !largeBoxCost) {
      toast({
        title: "입력 오류",
        description: "모든 원가 정보를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await updateCostMutation.mutateAsync({
        key: "smallBoxCost",
        value: smallBoxCost,
        description: "한과1호 (소박스) 원가"
      });
      
      await updateCostMutation.mutateAsync({
        key: "largeBoxCost", 
        value: largeBoxCost,
        description: "한과2호 (대박스) 원가"
      });
    } catch (error) {
      console.error("Cost settings update error:", error);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-white hover:text-gray-200 p-2 sm:px-4 sm:py-2">
          <Cog className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">원가 설정</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>전역 원가 설정</DialogTitle>
          <DialogDescription>
            모든 주문에 적용할 기본 원가를 설정합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="smallBoxCost">한과1호 (소박스) 원가</Label>
            <Input
              id="smallBoxCost"
              type="number"
              value={smallBoxCost}
              onChange={(e) => setSmallBoxCost(e.target.value)}
              placeholder="원가 입력 (원)"
            />
          </div>
          <div>
            <Label htmlFor="largeBoxCost">한과2호 (대박스) 원가</Label>
            <Input
              id="largeBoxCost"
              type="number"
              value={largeBoxCost}
              onChange={(e) => setLargeBoxCost(e.target.value)}
              placeholder="원가 입력 (원)"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateCostMutation.isPending}
          >
            {updateCostMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Financial Dialog Component
function FinancialDialog({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const [actualPaidAmount, setActualPaidAmount] = useState(order.actualPaidAmount?.toString() || '');
  const [discountReason, setDiscountReason] = useState(order.discountReason || '');

  const { data: settings } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  });
  
  // 할인금액 자동 계산
  const calculatedDiscount = actualPaidAmount ? 
    Math.max(0, order.totalAmount - parseInt(actualPaidAmount)) : 
    (order.discountAmount || 0);
    
  // 전역 설정에서 원가 가져오기
  const smallCostSetting = settings?.find(s => s.key === "smallBoxCost");
  const largeCostSetting = settings?.find(s => s.key === "largeBoxCost");
  const smallCost = smallCostSetting ? parseInt(smallCostSetting.value) : 0;
  const largeCost = largeCostSetting ? parseInt(largeCostSetting.value) : 0;
  
  // 원가 및 수익 계산
  const wrappingCost = order.wrappingQuantity * 2000; // 보자기 개당 2,000원 원가
  const totalCost = (order.smallBoxQuantity * smallCost) + (order.largeBoxQuantity * largeCost) + wrappingCost;
  const paidAmount = actualPaidAmount ? parseInt(actualPaidAmount) : 0;
  const totalItems = order.smallBoxQuantity + order.largeBoxQuantity;
  const shippingFee = totalItems >= 6 ? 0 : 4000;
  
  // 실제 수익 = 실입금 - 원가 - 보자기 - 배송비 - 할인금액
  const netProfit = paidAmount - totalCost - shippingFee - calculatedDiscount;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateFinancialMutation = useMutation({
    mutationFn: async (data: { 
      actualPaidAmount?: number; 
      discountAmount?: number; 
      discountReason?: string;
    }) => {
      const response = await fetch(`/api/orders/${order.id}/financial`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update financial info');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "성공",
        description: "매출 정보가 업데이트되었습니다.",
      });
      setOpen(false);
    },
    onError: () => {
      toast({
        title: "오류",
        description: "매출 정보 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: any = {};
    const paidAmount = actualPaidAmount ? parseInt(actualPaidAmount) : 0;
    
    if (actualPaidAmount) {
      data.actualPaidAmount = paidAmount;
      // 할인금액 자동 계산: 주문금액 - 실입금
      const calculatedDiscount = order.totalAmount - paidAmount;
      data.discountAmount = calculatedDiscount > 0 ? calculatedDiscount : 0;
    }
    if (discountReason) data.discountReason = discountReason;
    
    updateFinancialMutation.mutate(data);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price) + '원';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="flex items-center gap-1 w-full">
          <PiggyBank className="h-3 w-3" />
          매출 관리
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>매출 정보 관리</DialogTitle>
          <DialogDescription>
            주문 #{order.orderNumber}의 매출 정보를 관리합니다.
            <br />
            주문 금액: <span className="font-medium text-eden-brown">{formatPrice(order.totalAmount)}</span>
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="actualPaidAmount">실제 입금 금액</Label>
            <Input
              id="actualPaidAmount"
              type="number"
              placeholder="실제 입금된 금액을 입력하세요"
              value={actualPaidAmount}
              onChange={(e) => setActualPaidAmount(e.target.value)}
            />
            {actualPaidAmount && (
              <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-200">
                <div className="text-sm font-medium text-blue-800">
                  할인금액 자동 계산: <span className="text-blue-600">{formatPrice(calculatedDiscount)}</span>
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  주문금액 - 실입금 = 할인금액
                </div>
                <div className="text-xs text-blue-600">
                  {formatPrice(order.totalAmount)} - {formatPrice(parseInt(actualPaidAmount))} = {formatPrice(calculatedDiscount)}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>할인 정보</Label>
            <div className="p-3 bg-gray-50 rounded-md border">
              <div className="text-sm text-gray-700">
                할인금액: <span className="font-medium text-blue-600">{formatPrice(calculatedDiscount)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                실제 입금 금액을 입력하면 할인금액이 자동으로 계산됩니다.
              </p>
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <Label className="text-base font-semibold">원가 정보</Label>
            
            <div className="p-3 bg-gray-50 rounded-md border">
              <div className="text-sm font-medium text-gray-700 mb-2">원가 정보 (전역 설정값 자동 적용)</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">한과1호 원가:</div>
                  <div className="font-medium">{formatPrice(smallCost)} × {order.smallBoxQuantity}개</div>
                </div>
                <div>
                  <div className="text-gray-600">한과2호 원가:</div>
                  <div className="font-medium">{formatPrice(largeCost)} × {order.largeBoxQuantity}개</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                원가는 관리자 패널 상단의 "원가 설정" 버튼에서 변경할 수 있습니다.
              </div>
            </div>

            {(smallCost > 0 || largeCost > 0) && (
              <div className="p-4 bg-green-50 rounded-md border border-green-200">
                <div className="space-y-2 text-sm">
                  <div className="font-semibold text-green-800">수익 계산</div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="text-gray-600">총 원가:</div>
                      <div className="font-medium">
                        소박스: {order.smallBoxQuantity}개 × {formatPrice(smallCost)} = {formatPrice(order.smallBoxQuantity * smallCost)}
                      </div>
                      <div className="font-medium">
                        대박스: {order.largeBoxQuantity}개 × {formatPrice(largeCost)} = {formatPrice(order.largeBoxQuantity * largeCost)}
                      </div>
                      <div className="font-medium">
                        보자기: {order.wrappingQuantity}개 × {formatPrice(2000)} = {formatPrice(wrappingCost)}
                      </div>
                      <div className="font-semibold text-green-700 border-t pt-1 mt-1">
                        합계: {formatPrice(totalCost)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">수익 계산:</div>
                      <div>실입금: {formatPrice(paidAmount)}</div>
                      <div>원가: -{formatPrice(totalCost)}</div>
                      <div>배송비: -{formatPrice(shippingFee)}</div>
                      <div>할인: -{formatPrice(calculatedDiscount)}</div>
                      <div className="font-semibold text-green-700 border-t pt-1 mt-1">
                        실제수익: <span className={netProfit >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatPrice(netProfit)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="discountReason">할인 사유</Label>
            <Textarea
              id="discountReason"
              placeholder="할인 사유를 입력하세요 (선택사항)"
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              취소
            </Button>
            <Button 
              type="submit" 
              disabled={updateFinancialMutation.isPending}
              className="flex-1"
            >
              {updateFinancialMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("all");
  const [showPaymentConfirmDialog, setShowPaymentConfirmDialog] = useState(false);
  const [paymentConfirmOrder, setPaymentConfirmOrder] = useState<Order | null>(null);
  const [actualPaidAmounts, setActualPaidAmounts] = useState<{[key: number]: string}>({});

  const handleLogout = () => {
    toast({
      title: "로그아웃",
      description: "관리자 페이지에서 로그아웃되었습니다.",
    });
    setLocation("/admin/login");
  };

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['/api/orders'],
    queryFn: () => api.orders.getAll(),
    refetchInterval: 5000, // Refetch every 5 seconds
    refetchIntervalInBackground: true,
  });

  // Fetch deleted orders (trash)
  const { data: deletedOrders = [], isLoading: isLoadingTrash, error: trashError } = useQuery({
    queryKey: ['/api/orders/trash'],
    queryFn: () => api.orders.getTrash(),
    enabled: true, // Always load trash data for tab counter
    retry: 3,
    refetchInterval: activeTab === "trash" ? 5000 : false, // Only auto-refresh when trash tab is active
  });

  // Restore order mutation
  const restoreOrderMutation = useMutation({
    mutationFn: (orderId: number) => api.orders.restore(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders/trash'] });
      toast({
        title: "주문 복구 완료",
        description: "주문이 성공적으로 복구되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "복구 실패",
        description: "주문 복구에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Soft delete mutation
  const deleteOrderMutation = useMutation({
    mutationFn: (orderId: number) => api.orders.delete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "주문 삭제",
        description: "주문이 휴지통으로 이동되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "주문 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Permanent delete mutation
  const permanentDeleteMutation = useMutation({
    mutationFn: (orderId: number) => api.orders.permanentDelete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders/trash'] });
      toast({
        title: "영구 삭제 완료",
        description: "주문이 영구적으로 삭제되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "영구 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Filter orders by status
  const filterOrdersByStatus = (status: string) => {
    if (status === "all") return orders;
    return orders.filter((order: Order) => order.status === status);
  };

  const allOrders = orders;
  const pendingOrders = filterOrdersByStatus("pending");
  const scheduledOrders = filterOrdersByStatus("scheduled");
  const deliveredOrders = filterOrdersByStatus("delivered");

  // Render deleted orders function
  const renderTrashOrdersList = (ordersList: Order[]) => {
    if (ordersList.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Trash2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>휴지통이 비어있습니다.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {ordersList.map((order: Order) => (
          <Card key={order.id} className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">
                      주문번호: {order.orderNumber}
                    </h3>
                    <div className="text-sm text-gray-500">
                      삭제일: {order.deletedAt ? new Date(order.deletedAt).toLocaleDateString('ko-KR') : '-'}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">고객명:</span> {order.customerName}
                    </div>
                    <div>
                      <span className="font-medium">연락처:</span> {order.customerPhone}
                    </div>
                    <div>
                      <span className="font-medium">총 금액:</span> {order.totalAmount.toLocaleString()}원
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">주소:</span> ({order.zipCode}) {order.address1} {order.address2}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restoreOrderMutation.mutate(order.id)}
                    disabled={restoreOrderMutation.isPending}
                    className="flex items-center gap-1 text-green-600 border-green-200 hover:bg-green-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    복구
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm("이 주문을 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                        permanentDeleteMutation.mutate(order.id);
                      }
                    }}
                    disabled={permanentDeleteMutation.isPending}
                    className="flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    영구삭제
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // Render orders function
  const renderOrdersList = (ordersList: Order[]) => {
    if (ordersList.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          해당하는 주문이 없습니다.
        </div>
      );
    }

    return (
      <>
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">주문번호</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">고객정보 / 상품</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">연락처</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">배송주소</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">매출정보</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">입금상태</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">주문상태</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody>
              {ordersList.map((order: Order) => {
                const StatusIcon = statusIcons[order.status as keyof typeof statusIcons];
                return (
                  <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">#{order.orderNumber}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </div>
                      {(order.scheduledDate || order.status === 'scheduled') && (
                        <div className="mt-1">
                          <div className="text-red-600 font-bold text-sm">
                            예약발송 {order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit', 
                              day: '2-digit',
                              weekday: 'short'
                            }) : '날짜 미설정'}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 min-w-[200px]">
                      <div className="space-y-2">
                        <div className="font-medium text-gray-900 text-base">{order.customerName}</div>
                        <div className="space-y-1 text-sm">
                          <div className="text-gray-900 font-medium">
                            소박스 × {order.smallBoxQuantity}개
                          </div>
                          <div className="text-gray-900 font-medium">
                            대박스 × {order.largeBoxQuantity}개
                          </div>
                          <div className={order.wrappingQuantity > 0 ? "text-eden-brown font-medium" : "text-gray-500"}>
                            {order.wrappingQuantity > 0 ? `보자기 × ${order.wrappingQuantity}개` : '보자기 × 0개'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-gray-900">{order.customerPhone}</div>
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <div className="text-sm text-gray-900">
                        [{order.zipCode}] {order.address1} {order.address2}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1 text-sm">
                        <div className="font-medium text-gray-900">
                          주문: {formatPrice(order.totalAmount)}
                        </div>
                        {order.discountAmount && order.discountAmount > 0 && (
                          <div className="text-blue-600">
                            할인: -{formatPrice(order.discountAmount)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-2">
                        <Select
                          value={order.paymentStatus || 'pending'}
                          onValueChange={(newPaymentStatus) => handlePaymentStatusChange(order.id, newPaymentStatus)}
                          disabled={updatePaymentMutation.isPending}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">
                              <div className="flex items-center space-x-2">
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                                <span>입금 대기</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="confirmed">
                              <div className="flex items-center space-x-2">
                                <DollarSign className="h-4 w-4 text-green-500" />
                                <span>입금 완료</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="refunded">
                              <div className="flex items-center space-x-2">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                <span>환불</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {order.paymentStatus === 'confirmed' && !order.actualPaidAmount && (
                          <div className="space-y-1">
                            <Input
                              type="number"
                              placeholder="실제 입금금액"
                              value={actualPaidAmounts[order.id] || ''}
                              onChange={(e) => setActualPaidAmounts(prev => ({
                                ...prev,
                                [order.id]: e.target.value
                              }))}
                              className="w-32 text-xs"
                            />
                            <Button
                              size="sm"
                              onClick={() => handlePaymentConfirm(order.id)}
                              disabled={confirmPaymentMutation.isPending || !actualPaidAmounts[order.id]}
                              className="w-32 h-6 text-xs"
                            >
                              {confirmPaymentMutation.isPending ? "처리중..." : "금액저장"}
                            </Button>
                          </div>
                        )}
                        
                        {order.paymentStatus === 'confirmed' && order.actualPaidAmount && (
                          <div className="space-y-1 text-xs">
                            <div className="text-red-600 font-medium">
                              실입금: {formatPrice(order.actualPaidAmount)}
                            </div>
                            {order.netProfit !== undefined && order.netProfit !== null && (
                              <div className={order.netProfit >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                수익: {formatPrice(order.netProfit)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Select
                        value={order.status}
                        onValueChange={(newStatus) => handleStatusChange(order.id, newStatus)}
                        disabled={updateStatusMutation.isPending}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4 text-yellow-500" />
                              <span>주문접수</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="scheduled">
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4 text-blue-500" />
                              <span>발송예약</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="delivered">
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span>발송완료</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-2">
                        <SmsDialog order={order} />
                        <ScheduledDatePicker order={order} />
                        <FinancialDialog order={order} />
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteOrder(order.id)}
                          disabled={deleteOrderMutation.isPending}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {ordersList.map((order: Order) => {
            const StatusIcon = statusIcons[order.status as keyof typeof statusIcons];
            return (
              <Card key={order.id} className="border border-gray-200">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900 text-lg">#{order.orderNumber}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                        </div>
                        {(order.scheduledDate || order.status === 'scheduled') && (
                          <div className="mt-1">
                            <div className="text-red-600 font-bold text-base">
                              예약발송 {order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit', 
                                day: '2-digit',
                                weekday: 'short'
                              }) : '날짜 미설정'}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        {StatusIcon && <StatusIcon className="h-5 w-5 text-blue-500" />}
                        <span className="text-sm font-medium text-blue-600">
                          {statusLabels[order.status as keyof typeof statusLabels]}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500 mb-1">고객명</div>
                        <div className="font-medium">{order.customerName}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-1">연락처</div>
                        <div className="font-medium">{order.customerPhone}</div>
                      </div>
                    </div>

                    <div className="text-sm">
                      <div className="text-gray-500 mb-1">배송주소</div>
                      <div>
                        [{order.zipCode}] {order.address1} {order.address2}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500 mb-2">주문상품</div>
                        <div className="space-y-1">
                          <div className="font-medium">소박스 × {order.smallBoxQuantity}개</div>
                          <div className="font-medium">대박스 × {order.largeBoxQuantity}개</div>
                          <div className={order.wrappingQuantity > 0 ? "font-medium text-eden-brown" : "text-gray-500"}>
                            {order.wrappingQuantity > 0 ? `보자기 × ${order.wrappingQuantity}개` : '보자기 × 0개'}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-2">매출현황</div>
                        <div className="space-y-2">
                          <div className="text-sm text-gray-600">
                            주문금액: <span className="font-medium text-eden-brown">{formatPrice(order.totalAmount)}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            실제입금: <span className="font-medium text-red-600">
                              {order.actualPaidAmount ? formatPrice(order.actualPaidAmount) : '미입력'}
                            </span>
                          </div>
                          {order.discountAmount && order.discountAmount > 0 && (
                            <div className="text-sm text-gray-600">
                              할인금액: <span className="font-medium text-blue-600">-{formatPrice(order.discountAmount)}</span>
                              {order.discountReason && (
                                <span className="text-xs text-gray-500 block">({order.discountReason})</span>
                              )}
                            </div>
                          )}
                          {order.netProfit !== undefined && order.netProfit !== null && (
                            <div className="text-sm text-gray-600">
                              실제수익: <span className={`font-medium ${order.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {formatPrice(order.netProfit)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-gray-500 mb-2">입금상태</div>
                        <Select
                          value={order.paymentStatus || 'pending'}
                          onValueChange={(newPaymentStatus) => handlePaymentStatusChange(order.id, newPaymentStatus)}
                          disabled={updatePaymentMutation.isPending}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">
                              <div className="flex items-center space-x-2">
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                                <span>입금 대기</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="confirmed">
                              <div className="flex items-center space-x-2">
                                <DollarSign className="h-4 w-4 text-green-500" />
                                <span>입금 완료</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="refunded">
                              <div className="flex items-center space-x-2">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                <span>환불</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-2">주문상태</div>
                        <Select
                          value={order.status}
                          onValueChange={(newStatus) => handleStatusChange(order.id, newStatus)}
                          disabled={updateStatusMutation.isPending}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-yellow-500" />
                                <span>주문접수</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="scheduled">
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-blue-500" />
                                <span>발송예약</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="delivered">
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span>발송완료</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex flex-col gap-3">
                        <SmsDialog order={order} />
                        <ScheduledDatePicker order={order} />
                        <FinancialDialog order={order} />
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteOrder(order.id)}
                          disabled={deleteOrderMutation.isPending}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          삭제
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </>
    );
  };



  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => 
      api.orders.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "상태 업데이트",
        description: "주문 상태가 성공적으로 업데이트되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "업데이트 실패",
        description: "상태 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, paymentStatus }: { id: number; paymentStatus: string }) => 
      api.orders.updatePaymentStatus(id, paymentStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "입금 상태 업데이트",
        description: "입금 상태가 성공적으로 업데이트되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "업데이트 실패",
        description: "입금 상태 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 입금확인 및 실제 입금금액 업데이트 뮤테이션
  const confirmPaymentMutation = useMutation({
    mutationFn: async ({ id, actualPaidAmount }: { id: number; actualPaidAmount: number }) => {
      // 입금상태를 confirmed로 변경하고 실제 입금금액 업데이트
      await api.orders.updatePaymentStatus(id, 'confirmed');
      
      // 실제 입금금액을 매출 관리에 업데이트
      const response = await fetch(`/api/orders/${id}/financial`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualPaidAmount })
      });
      
      if (!response.ok) throw new Error('Failed to update actual paid amount');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setShowPaymentConfirmDialog(false);
      setPaymentConfirmOrder(null);
      // 해당 주문의 입금금액 상태 제거
      setActualPaidAmounts(prev => {
        const newState = { ...prev };
        delete newState[variables.id];
        return newState;
      });
      toast({
        title: "입금 확인 완료",
        description: "입금이 확인되었고 실제 입금금액이 기록되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "업데이트 실패",
        description: "입금 확인 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateStatusMutation.mutate({ id: orderId, status: newStatus });
  };

  const handlePaymentStatusChange = (orderId: number, newPaymentStatus: string) => {
    if (newPaymentStatus === 'confirmed') {
      // 입금완료로 변경할 때는 실제 입금금액 입력 다이얼로그 열기
      setPaymentConfirmOrder(orders.find(o => o.id === orderId) || null);
      setShowPaymentConfirmDialog(true);
    } else {
      updatePaymentMutation.mutate({ id: orderId, paymentStatus: newPaymentStatus });
    }
  };

  const handleDeleteOrder = (orderId: number) => {
    if (confirm("정말로 이 주문을 삭제하시겠습니까?")) {
      deleteOrderMutation.mutate(orderId);
    }
  };

  const handleExcelDownload = async () => {
    try {
      const response = await fetch('/api/orders/export/excel');
      if (!response.ok) {
        throw new Error('엑셀 파일 다운로드에 실패했습니다');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `에덴한과_주문목록_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "다운로드 완료",
        description: "엑셀 파일이 성공적으로 다운로드되었습니다.",
      });
    } catch (error) {
      toast({
        title: "다운로드 실패",
        description: "엑셀 파일 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: number) => `${price.toLocaleString()}원`;

  // 입금확인 핸들러 (개별 주문용)
  const handlePaymentConfirm = (orderId?: number) => {
    const targetOrderId = orderId || paymentConfirmOrder?.id;
    if (!targetOrderId) return;
    
    const paidAmountStr = actualPaidAmounts[targetOrderId];
    if (!paidAmountStr) {
      toast({
        title: "입력 오류",
        description: "실제 입금금액을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    const paidAmount = parseInt(paidAmountStr);
    if (paidAmount <= 0) {
      toast({
        title: "입력 오류", 
        description: "올바른 금액을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    confirmPaymentMutation.mutate({ 
      id: targetOrderId, 
      actualPaidAmount: paidAmount 
    });
  };

  // Calculate stats including financial data
  const stats = orders.reduce(
    (acc: any, order: Order) => {
      acc.total++;
      acc[order.status as keyof typeof acc]++;
      if (order.paymentStatus === 'confirmed') acc.paidOrders++;
      if (order.paymentStatus === 'pending') acc.unpaidOrders++;
      
      // Financial calculations
      acc.totalRevenue += order.totalAmount;
      acc.actualRevenue += order.actualPaidAmount || 0;
      acc.totalDiscounts += order.discountAmount || 0;
      
      // Total profit calculation
      if (order.netProfit !== undefined && order.netProfit !== null) {
        acc.totalProfit += order.netProfit;
      }
      
      return acc;
    },
    { 
      total: 0, 
      pending: 0, 
      scheduled: 0, 
      delivered: 0, 
      paidOrders: 0, 
      unpaidOrders: 0,
      totalRevenue: 0,
      actualRevenue: 0,
      totalDiscounts: 0,
      totalProfit: 0
    }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-eden-cream flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-eden-brown mx-auto mb-4"></div>
          <p className="text-eden-dark">주문 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-eden-cream">
      {/* Header */}
      <div className="bg-eden-red text-white p-4 sm:p-6">
        <div className="container mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/">
                <Button variant="ghost" className="text-white hover:text-gray-200 p-2 sm:px-4 sm:py-2">
                  <ArrowLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">홈으로</span>
                </Button>
              </Link>
              <h1 className="text-lg sm:text-2xl font-bold font-korean">
                <Settings className="inline mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6" />
                관리자 패널
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <CostSettingsDialog />
              <Button 
                onClick={handleExcelDownload}
                variant="ghost" 
                className="text-white hover:text-gray-200 p-2 sm:px-4 sm:py-2"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">엑셀 다운로드</span>
              </Button>
              <Button 
                onClick={handleLogout}
                variant="ghost" 
                className="text-white hover:text-gray-200 p-2 sm:px-4 sm:py-2"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">로그아웃</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 sm:p-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <Card>
            <CardContent className="p-2 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-xs sm:text-sm text-gray-600">총 주문</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2 sm:p-4 text-center bg-yellow-50">
              <div className="text-lg sm:text-2xl font-bold text-yellow-600">{stats.pending || 0}</div>
              <div className="text-xs sm:text-sm text-gray-600">주문접수</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2 sm:p-4 text-center bg-blue-50">
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.scheduled || 0}</div>
              <div className="text-xs sm:text-sm text-gray-600">발송예약</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2 sm:p-4 text-center bg-green-50">
              <div className="text-lg sm:text-2xl font-bold text-green-600">{stats.delivered || 0}</div>
              <div className="text-xs sm:text-sm text-gray-600">발송완료</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2 sm:p-4 text-center bg-emerald-50">
              <div className="text-lg sm:text-2xl font-bold text-emerald-600">{stats.paidOrders || 0}</div>
              <div className="text-xs sm:text-sm text-gray-600">입금 완료</div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <Card>
            <CardContent className="p-4 text-center bg-eden-red/5">
              <div className="text-xl sm:text-2xl font-bold text-eden-red">
                {formatPrice(stats.totalRevenue)}
              </div>
              <div className="text-sm text-gray-600">총 주문 금액</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-green-50">
              <div className="text-xl sm:text-2xl font-bold text-green-600">
                {formatPrice(stats.actualRevenue)}
              </div>
              <div className="text-sm text-gray-600">실제 입금 금액</div>
              <div className="text-xs text-gray-500 mt-1">
                수입률: {stats.totalRevenue > 0 ? Math.round((stats.actualRevenue / stats.totalRevenue) * 100) : 0}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-blue-50">
              <div className="text-xl sm:text-2xl font-bold text-blue-600">
                {formatPrice(stats.totalDiscounts)}
              </div>
              <div className="text-sm text-gray-600">총 할인 금액</div>
              <div className="text-xs text-gray-500 mt-1">
                할인률: {stats.totalRevenue > 0 ? Math.round((stats.totalDiscounts / stats.totalRevenue) * 100) : 0}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-purple-50">
              <div className={`text-xl sm:text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                {formatPrice(stats.totalProfit)}
              </div>
              <div className="text-sm text-gray-600">총 수익</div>
              <div className="text-xs text-gray-500 mt-1">
                수익률: {stats.actualRevenue > 0 ? Math.round((stats.totalProfit / stats.actualRevenue) * 100) : 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders List with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="font-korean">주문 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-eden-brown mx-auto mb-4"></div>
                <div className="text-gray-500">주문 목록을 불러오는 중...</div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                <div className="mb-2">주문 목록을 불러오는 중 오류가 발생했습니다.</div>
                <div className="text-sm text-gray-500">{error.message}</div>
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline" 
                  className="mt-4"
                >
                  다시 시도
                </Button>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="all">전체 ({allOrders.length})</TabsTrigger>
                  <TabsTrigger value="pending">주문접수 ({pendingOrders.length})</TabsTrigger>
                  <TabsTrigger value="scheduled">예약발송 ({scheduledOrders.length})</TabsTrigger>
                  <TabsTrigger value="delivered">발송완료 ({deliveredOrders.length})</TabsTrigger>
                  <TabsTrigger value="trash" className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-1" />
                    휴지통 ({deletedOrders.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="mt-6">
                  {renderOrdersList(allOrders)}
                </TabsContent>
                
                <TabsContent value="pending" className="mt-6">
                  {renderOrdersList(pendingOrders)}
                </TabsContent>
                
                <TabsContent value="scheduled" className="mt-6">
                  {renderOrdersList(scheduledOrders)}
                </TabsContent>
                
                <TabsContent value="delivered" className="mt-6">
                  {renderOrdersList(deliveredOrders)}
                </TabsContent>
                
                <TabsContent value="trash" className="mt-6">
                  {isLoadingTrash ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-eden-brown mx-auto mb-4"></div>
                      <div className="text-gray-500">휴지통을 불러오는 중...</div>
                    </div>
                  ) : trashError ? (
                    <div className="text-center py-8 text-red-500">
                      <div className="mb-2">휴지통을 불러오는 중 오류가 발생했습니다.</div>
                      <div className="text-sm text-gray-500">{trashError.message}</div>
                    </div>
                  ) : (
                    renderTrashOrdersList(deletedOrders)
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 입금확인 다이얼로그 */}
      <Dialog open={showPaymentConfirmDialog} onOpenChange={setShowPaymentConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>입금 확인</DialogTitle>
            <DialogDescription>
              실제 입금된 금액을 입력해주세요. 매출 관리에 자동으로 반영됩니다.
            </DialogDescription>
          </DialogHeader>
          
          {paymentConfirmOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-md">
                <div className="text-sm space-y-1">
                  <div><strong>주문번호:</strong> {paymentConfirmOrder.orderNumber}</div>
                  <div><strong>고객명:</strong> {paymentConfirmOrder.customerName}</div>
                  <div><strong>주문금액:</strong> {formatPrice(paymentConfirmOrder.totalAmount)}</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="actualPaidAmount">실제 입금금액</Label>
                <Input
                  id="actualPaidAmount"
                  type="number"
                  placeholder="실제 입금된 금액을 입력하세요"
                  value={paymentConfirmOrder ? (actualPaidAmounts[paymentConfirmOrder.id] || '') : ''}
                  onChange={(e) => paymentConfirmOrder && setActualPaidAmounts(prev => ({
                    ...prev,
                    [paymentConfirmOrder.id]: e.target.value
                  }))}
                />
              </div>
              
              <div className="text-xs text-gray-500">
                <div>계좌: 농협 352-1701-3342-63 (예금주: 손*진)</div>
                <div>입금금액이 주문금액과 다를 경우 할인금액이 자동 계산됩니다.</div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowPaymentConfirmDialog(false);
                    setPaymentConfirmOrder(null);
                  }}
                  className="flex-1"
                >
                  취소
                </Button>
                <Button 
                  onClick={handlePaymentConfirm}
                  disabled={confirmPaymentMutation.isPending}
                  className="flex-1"
                >
                  {confirmPaymentMutation.isPending ? "처리 중..." : "입금 확인"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
