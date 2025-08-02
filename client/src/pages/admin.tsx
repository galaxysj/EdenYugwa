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

// Payment Confirmation Dialog Component
function PaymentConfirmDialog({ 
  order, 
  open, 
  setOpen, 
  onConfirm 
}: { 
  order: Order | null; 
  open: boolean; 
  setOpen: (open: boolean) => void;
  onConfirm: (actualPaidAmount: number, discountReason: string) => void;
}) {
  const [actualPaidAmount, setActualPaidAmount] = useState("");
  const [discountType, setDiscountType] = useState("partial"); // "partial" or "discount"
  
  const handleConfirm = () => {
    const amount = parseInt(actualPaidAmount);
    if (isNaN(amount) || amount < 0) {
      return;
    }

    const expectedAmount = order?.totalAmount || 0;
    const difference = expectedAmount - amount;
    
    let discountReason = "";
    if (difference > 0) {
      if (discountType === "partial") {
        discountReason = `부분미입금 (미입금: ${difference.toLocaleString()}원)`;
      } else {
        discountReason = `할인 (할인금액: ${difference.toLocaleString()}원)`;
      }
    } else if (difference < 0) {
      discountReason = `과납입 (${Math.abs(difference).toLocaleString()}원 추가 입금)`;
    }

    onConfirm(amount, discountReason);
    setActualPaidAmount("");
    setDiscountType("partial");
    setOpen(false);
  };

  if (!order) return null;

  const expectedAmount = order.totalAmount;
  const paidAmount = parseInt(actualPaidAmount) || 0;
  const difference = expectedAmount - paidAmount;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>입금 확인</DialogTitle>
          <DialogDescription>
            실제 입금된 금액을 입력해주세요.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-md">
            <div className="text-sm space-y-1">
              <div><strong>주문번호:</strong> {order.orderNumber}</div>
              <div><strong>고객명:</strong> {order.customerName}</div>
              <div><strong>주문금액:</strong> {order.totalAmount.toLocaleString()}원</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="actualPaidAmount">실제 입금금액</Label>
            <Input
              id="actualPaidAmount"
              type="number"
              placeholder="실제 입금된 금액을 입력하세요"
              value={actualPaidAmount}
              onChange={(e) => setActualPaidAmount(e.target.value)}
            />
          </div>
          
          {actualPaidAmount && difference > 0 && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-md border">
                <div className="text-sm">
                  <div className="text-orange-600 font-medium">
                    미입금: {difference.toLocaleString()}원
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>미입금 사유 선택</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partial">부분미입금 (고객이 부분적으로만 입금)</SelectItem>
                    <SelectItem value="discount">할인 (의도적인 할인 적용)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          {actualPaidAmount && difference < 0 && (
            <div className="p-3 bg-green-50 rounded-md border">
              <div className="text-sm">
                <div className="text-green-600 font-medium">
                  과납입: {Math.abs(difference).toLocaleString()}원
                </div>
              </div>
            </div>
          )}
          
          {actualPaidAmount && difference === 0 && (
            <div className="p-3 bg-green-50 rounded-md border">
              <div className="text-sm">
                <div className="text-green-600 font-medium">
                  정확한 금액 입금
                </div>
              </div>
            </div>
          )}
          
          <div className="text-xs text-gray-500">
            <div>계좌: 농협 352-1701-3342-63 (예금주: 손*진)</div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setOpen(false);
                setActualPaidAmount("");
                setDiscountType("partial");
              }}
              className="flex-1"
            >
              취소
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!actualPaidAmount || paidAmount < 0}
              className="flex-1"
            >
              입금 확인
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Financial Dialog Component
function FinancialDialog({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);

  const { data: settings } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  });
  
  // 전역 설정에서 원가 가져오기
  const smallCostSetting = settings?.find(s => s.key === "smallBoxCost");
  const largeCostSetting = settings?.find(s => s.key === "largeBoxCost");
  const smallCost = smallCostSetting ? parseInt(smallCostSetting.value) : 0;
  const largeCost = largeCostSetting ? parseInt(largeCostSetting.value) : 0;
  
  // 원가 계산
  const wrappingCost = order.wrappingQuantity * 2000; // 보자기 개당 2,000원 원가
  const totalCost = (order.smallBoxQuantity * smallCost) + (order.largeBoxQuantity * largeCost) + wrappingCost;
  const totalItems = order.smallBoxQuantity + order.largeBoxQuantity;
  const shippingFee = totalItems >= 6 ? 0 : 4000;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();



  const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null || isNaN(price)) return '0원';
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
        
        <div className="space-y-4">

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
                      <div className="text-gray-600">원가 합계:</div>
                      <div>총 원가: {formatPrice(totalCost)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        실제 수익 계산을 위해서는 입금상태를 '입금완료'로 변경하세요.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              type="button" 
              onClick={() => setOpen(false)}
            >
              닫기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("all");
  const [selectedTrashItems, setSelectedTrashItems] = useState<Set<number>>(new Set());
  const [selectedOrderItems, setSelectedOrderItems] = useState<Set<number>>(new Set());
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);

  // Clear selections when switching tabs
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setSelectedOrderItems(new Set());
    setSelectedTrashItems(new Set());
  };

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

  // Bulk permanent delete mutation
  const bulkPermanentDeleteMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const deletePromises = orderIds.map(id => api.orders.permanentDelete(id));
      await Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders/trash'] });
      setSelectedTrashItems(new Set());
      toast({
        title: "영구 삭제 완료",
        description: `선택된 ${selectedTrashItems.size}개 주문이 영구적으로 삭제되었습니다.`,
      });
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "일괄 영구 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const deletePromises = orderIds.map(id => api.orders.delete(id));
      await Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setSelectedOrderItems(new Set());
      toast({
        title: "삭제 완료",
        description: `선택된 ${selectedOrderItems.size}개 주문이 삭제되었습니다.`,
      });
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "일괄 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Toggle selection for trash items
  const toggleTrashSelection = (orderId: number) => {
    const newSelection = new Set(selectedTrashItems);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedTrashItems(newSelection);
  };

  // Select all trash items
  const selectAllTrash = () => {
    const allIds = new Set<number>(deletedOrders.map((order: Order) => order.id));
    setSelectedTrashItems(allIds);
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedTrashItems(new Set());
    setSelectedOrderItems(new Set());
  };

  // Order selection functions
  const toggleOrderSelection = (orderId: number) => {
    const newSelection = new Set(selectedOrderItems);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedOrderItems(newSelection);
  };

  const selectAllOrders = (ordersList: Order[]) => {
    const allIds = new Set(ordersList.map(order => order.id));
    setSelectedOrderItems(allIds);
  };

  // Handle bulk permanent delete
  const handleBulkPermanentDelete = () => {
    if (selectedTrashItems.size === 0) return;
    
    if (confirm(`선택된 ${selectedTrashItems.size}개 주문을 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      bulkPermanentDeleteMutation.mutate(Array.from(selectedTrashItems));
    }
  };

  // Filter orders by status
  const filterOrdersByStatus = (status: string) => {
    if (status === "all") return orders;
    return orders.filter((order: Order) => order.status === status);
  };

  const allOrders = orders;
  const pendingOrders = filterOrdersByStatus("pending");
  const scheduledOrders = filterOrdersByStatus("scheduled");
  const deliveredOrders = filterOrdersByStatus("delivered");

  // Render revenue report function
  const renderRevenueReport = () => {
    const paidOrders = orders.filter((order: Order) => order.paymentStatus === 'confirmed');
    
    // Filter orders by date
    const getFilteredOrders = () => {
      let filtered = paidOrders;
      
      if (dateFilter === 'today') {
        const today = new Date().toDateString();
        filtered = paidOrders.filter(order => new Date(order.createdAt).toDateString() === today);
      } else if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = paidOrders.filter(order => new Date(order.createdAt) >= weekAgo);
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filtered = paidOrders.filter(order => new Date(order.createdAt) >= monthAgo);
      } else if (dateFilter === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the entire end date
        filtered = paidOrders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= start && orderDate <= end;
        });
      }
      
      return filtered;
    };
    
    const filteredOrders = getFilteredOrders();
    
    // Calculate totals for filtered orders
    const filteredTotals = filteredOrders.reduce((acc, order) => {
      acc.count++;
      acc.totalAmount += order.totalAmount;
      acc.actualRevenue += order.actualPaidAmount || order.totalAmount;
      acc.totalDiscounts += order.discountAmount || 0;
      acc.totalPartialUnpaid += (order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount) 
        ? (order.totalAmount - order.actualPaidAmount) : 0;
      acc.netProfit += order.netProfit || 0;
      return acc;
    }, {
      count: 0,
      totalAmount: 0,
      actualRevenue: 0,
      totalDiscounts: 0,
      totalPartialUnpaid: 0,
      netProfit: 0
    });
    
    const handleRevenueExcelDownload = async () => {
      try {
        const response = await fetch('/api/export/revenue');
        
        if (!response.ok) {
          throw new Error('Export failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `에덴한과_매출관리_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "다운로드 완료",
          description: "매출관리 엑셀 파일이 성공적으로 다운로드되었습니다.",
        });
      } catch (error) {
        toast({
          title: "다운로드 실패",
          description: "매출관리 엑셀 파일 다운로드 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    };

    return (
      <div className="space-y-6">
        {/* 매출 요약 */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">매출 관리 리포트</h3>
          <Button onClick={handleRevenueExcelDownload} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            매출 엑셀 다운로드
          </Button>
        </div>

        {/* 날짜 필터 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={dateFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('all')}
                >
                  전체
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === 'today' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('today')}
                >
                  오늘
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === 'week' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('week')}
                >
                  최근 7일
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === 'month' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('month')}
                >
                  최근 30일
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === 'custom' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('custom')}
                >
                  기간 설정
                </Button>
              </div>
              
              {dateFilter === 'custom' && (
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                  />
                  <span className="text-gray-500">~</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 필터링된 매출 총합계 */}
        <Card className="bg-gradient-to-r from-eden-red/5 to-eden-brown/5 border-2 border-eden-red/20">
          <CardHeader>
            <CardTitle className="text-center text-eden-red">
              📊 매출 총합계 ({dateFilter === 'all' ? '전체 기간' : 
                dateFilter === 'today' ? '오늘' :
                dateFilter === 'week' ? '최근 7일' :
                dateFilter === 'month' ? '최근 30일' :
                dateFilter === 'custom' && startDate && endDate ? `${startDate} ~ ${endDate}` : '기간 설정'})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-gray-700">{filteredTotals.count}</div>
                <div className="text-sm text-gray-600">주문 건수</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-eden-red">{formatPrice(filteredTotals.totalAmount)}</div>
                <div className="text-sm text-gray-600">주문 금액</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-green-600">{formatPrice(filteredTotals.actualRevenue)}</div>
                <div className="text-sm text-gray-600">실제 입금</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-blue-600">{formatPrice(filteredTotals.totalDiscounts)}</div>
                <div className="text-sm text-gray-600">할인 금액</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-red-600">{formatPrice(filteredTotals.totalPartialUnpaid)}</div>
                <div className="text-sm text-gray-600">부분 미입금</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className={`text-2xl font-bold ${filteredTotals.netProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                  {formatPrice(filteredTotals.netProfit)}
                </div>
                <div className="text-sm text-gray-600">실제 수익</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 전체 매출 통계 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center bg-eden-red/5">
              <div className="text-xl font-bold text-eden-red">
                {formatPrice(stats.totalRevenue)}
              </div>
              <div className="text-xs text-gray-600">총 주문 금액</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-green-50">
              <div className="text-xl font-bold text-green-600">
                {formatPrice(stats.actualRevenue)}
              </div>
              <div className="text-xs text-gray-600">실제 입금 금액</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-blue-50">
              <div className="text-xl font-bold text-blue-600">
                {formatPrice(stats.totalDiscounts)}
              </div>
              <div className="text-xs text-gray-600">총 할인 금액</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-red-50">
              <div className="text-xl font-bold text-red-600">
                {formatPrice(stats.totalPartialUnpaid)}
              </div>
              <div className="text-xs text-gray-600">부분 미입금</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-purple-50">
              <div className="text-xl font-bold text-purple-600">
                {formatPrice(stats.totalNetProfit)}
              </div>
              <div className="text-xs text-gray-600">총 실제 수익</div>
            </CardContent>
          </Card>
        </div>

        {/* 주문 현황 통계 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center bg-gray-50">
              <div className="text-2xl font-bold text-gray-600">
                {stats.total}
              </div>
              <div className="text-sm text-gray-600">총 주문 수</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-green-50">
              <div className="text-2xl font-bold text-green-600">
                {stats.paidOrders}
              </div>
              <div className="text-sm text-gray-600">입금완료 주문</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-orange-50">
              <div className="text-2xl font-bold text-orange-600">
                {stats.partialOrders}
              </div>
              <div className="text-sm text-gray-600">부분결제 주문</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-blue-50">
              <div className="text-2xl font-bold text-blue-600">
                {stats.unpaidOrders}
              </div>
              <div className="text-sm text-gray-600">입금대기 주문</div>
            </CardContent>
          </Card>
        </div>

        {/* 입금완료 주문별 상세 매출 */}
        <Card>
          <CardHeader>
            <CardTitle>
              입금완료 주문 상세 
              {dateFilter !== 'all' && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({dateFilter === 'today' ? '오늘' :
                    dateFilter === 'week' ? '최근 7일' :
                    dateFilter === 'month' ? '최근 30일' :
                    dateFilter === 'custom' ? '선택 기간' : ''} - {filteredOrders.length}건)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {dateFilter === 'all' ? '입금완료된 주문이 없습니다.' : '해당 기간에 입금완료된 주문이 없습니다.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">주문번호</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">고객명</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">주문일</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">주문내역</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">주문금액</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">실제입금</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">할인/부분미입금</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">실제수익</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Sort by date descending
                      .map((order: Order) => {
                      const smallBoxTotal = order.smallBoxQuantity * 19000;
                      const largeBoxTotal = order.largeBoxQuantity * 21000;
                      const wrappingTotal = order.wrappingQuantity * 1000;
                      const totalItems = order.smallBoxQuantity + order.largeBoxQuantity;
                      const shippingFee = totalItems >= 6 ? 0 : 4000;
                      
                      return (
                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">#{order.orderNumber}</td>
                          <td className="py-3 px-4">{order.customerName}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <div className="space-y-1">
                              {order.smallBoxQuantity > 0 && (
                                <div>소박스 {order.smallBoxQuantity}개</div>
                              )}
                              {order.largeBoxQuantity > 0 && (
                                <div>대박스 {order.largeBoxQuantity}개</div>
                              )}
                              {order.wrappingQuantity > 0 && (
                                <div>보자기 {order.wrappingQuantity}개</div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <div className="space-y-1">
                              {order.smallBoxQuantity > 0 && (
                                <div className="text-gray-600">소박스: {formatPrice(smallBoxTotal)}</div>
                              )}
                              {order.largeBoxQuantity > 0 && (
                                <div className="text-gray-600">대박스: {formatPrice(largeBoxTotal)}</div>
                              )}
                              {order.wrappingQuantity > 0 && (
                                <div className="text-gray-600">보자기: {formatPrice(wrappingTotal)}</div>
                              )}
                              {shippingFee > 0 && (
                                <div className="text-gray-600">배송비: {formatPrice(shippingFee)}</div>
                              )}
                              <div className="font-medium text-eden-red border-t pt-1">
                                합계: {formatPrice(order.totalAmount)}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-green-600">
                              {order.actualPaidAmount ? formatPrice(order.actualPaidAmount) : formatPrice(order.totalAmount)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {order.discountAmount && order.discountAmount > 0 ? (
                              <div className="text-blue-600 font-medium">
                                할인: -{formatPrice(order.discountAmount)}
                                {order.discountReason && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    사유: {order.discountReason}
                                  </div>
                                )}
                              </div>
                            ) : order.actualPaidAmount && order.actualPaidAmount < order.totalAmount ? (
                              <div className="text-red-600 font-medium">
                                부분미입금: {formatPrice(order.totalAmount - order.actualPaidAmount)}
                              </div>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {order.netProfit !== undefined && order.netProfit !== null ? (
                              <span className={`font-medium ${order.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {formatPrice(order.netProfit)}
                              </span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

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
        {/* Bulk Actions Header */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedTrashItems.size === ordersList.length && ordersList.length > 0}
                onChange={() => {
                  if (selectedTrashItems.size === ordersList.length) {
                    clearAllSelections();
                  } else {
                    selectAllTrash();
                  }
                }}
                className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm font-medium text-gray-700">
                전체 선택 ({selectedTrashItems.size}/{ordersList.length})
              </span>
            </div>
            {selectedTrashItems.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkPermanentDelete}
                disabled={bulkPermanentDeleteMutation.isPending}
                className="flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                선택항목 영구삭제 ({selectedTrashItems.size}개)
              </Button>
            )}
          </div>
          {selectedTrashItems.size > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={clearAllSelections}
              className="text-gray-600"
            >
              선택 해제
            </Button>
          )}
        </div>

        {ordersList.map((order: Order) => (
          <Card key={order.id} className={`border-red-200 ${selectedTrashItems.has(order.id) ? 'bg-red-100 border-red-300' : 'bg-red-50'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedTrashItems.has(order.id)}
                    onChange={() => toggleTrashSelection(order.id)}
                    className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
                  />
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
                <th className="w-8 py-3 px-4">
                  <input
                    type="checkbox"
                    checked={selectedOrderItems.size === ordersList.length && ordersList.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        selectAllOrders(ordersList);
                      } else {
                        setSelectedOrderItems(new Set());
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">주문번호</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">고객명</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">상품</th>
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
                      <input
                        type="checkbox"
                        checked={selectedOrderItems.has(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">#{order.orderNumber}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </div>
                      {order.scheduledDate && (
                        <div className="mt-1">
                          <div className="text-red-600 font-bold text-sm">
                            고객 예약발송: {new Date(order.scheduledDate).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit', 
                              day: '2-digit',
                              weekday: 'short'
                            })}
                          </div>
                        </div>
                      )}
                      {order.status === 'scheduled' && !order.scheduledDate && (
                        <div className="mt-1">
                          <div className="text-orange-600 font-bold text-sm">
                            발송예약 (날짜 미설정)
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">{order.customerName}</div>
                    </td>
                    <td className="py-4 px-4 min-w-[120px]">
                      <div className="space-y-1">
                        {order.smallBoxQuantity > 0 && (
                          <div className="text-sm font-medium text-gray-900 whitespace-nowrap">
                            소박스 × {order.smallBoxQuantity}개
                          </div>
                        )}
                        {order.largeBoxQuantity > 0 && (
                          <div className="text-sm font-medium text-gray-900 whitespace-nowrap">
                            대박스 × {order.largeBoxQuantity}개
                          </div>
                        )}
                        {order.wrappingQuantity > 0 && (
                          <div className="text-sm font-medium text-eden-brown whitespace-nowrap">
                            보자기 × {order.wrappingQuantity}개
                          </div>
                        )}
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
                        {order.actualPaidAmount && order.actualPaidAmount > 0 && (
                          <div className="text-green-600">
                            실입금: {formatPrice(order.actualPaidAmount)}
                          </div>
                        )}
                        {order.discountAmount && order.discountAmount > 0 && (
                          <div className="text-blue-600">
                            할인: -{formatPrice(order.discountAmount)}
                          </div>
                        )}
                        {order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && (
                          <div className="text-red-600">
                            부분미입금: {formatPrice(order.totalAmount - order.actualPaidAmount)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-2">
                        <Select
                          value={
                            order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && order.paymentStatus === 'confirmed'
                              ? 'partial'
                              : order.paymentStatus || 'pending'
                          }
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
                            <SelectItem value="partial">
                              <div className="flex items-center space-x-2">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                <span className="text-red-500">부분결제</span>
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
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedOrderItems.has(order.id)}
                          onChange={() => toggleOrderSelection(order.id)}
                          className="rounded border-gray-300 mt-1"
                        />
                        <div>
                          <div className="font-medium text-gray-900 text-lg">#{order.orderNumber}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                        </div>
                        {order.scheduledDate && (
                          <div className="mt-1">
                            <div className="text-red-600 font-bold text-base">
                              고객 예약발송: {new Date(order.scheduledDate).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit', 
                                day: '2-digit',
                                weekday: 'short'
                              })}
                            </div>
                          </div>
                        )}
                        {order.status === 'scheduled' && !order.scheduledDate && (
                          <div className="mt-1">
                            <div className="text-orange-600 font-bold text-base">
                              발송예약 (날짜 미설정)
                            </div>
                          </div>
                        )}
                        </div>
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
                          {order.smallBoxQuantity > 0 && (
                            <div className="font-medium">소박스 × {order.smallBoxQuantity}개</div>
                          )}
                          {order.largeBoxQuantity > 0 && (
                            <div className="font-medium">대박스 × {order.largeBoxQuantity}개</div>
                          )}
                          {order.wrappingQuantity > 0 && (
                            <div className="font-medium text-eden-brown">보자기 × {order.wrappingQuantity}개</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-2">매출현황</div>
                        <div className="space-y-2">
                          {/* 주문 구성 요소별 금액 */}
                          <div className="text-xs text-gray-500 space-y-1">
                            {order.smallBoxQuantity > 0 && (
                              <div>소박스: {formatPrice(order.smallBoxQuantity * 19000)}</div>
                            )}
                            {order.largeBoxQuantity > 0 && (
                              <div>대박스: {formatPrice(order.largeBoxQuantity * 21000)}</div>
                            )}
                            {order.wrappingQuantity > 0 && (
                              <div>보자기: {formatPrice(order.wrappingQuantity * 1000)}</div>
                            )}
                            {(() => {
                              const totalItems = order.smallBoxQuantity + order.largeBoxQuantity;
                              const shippingFee = totalItems >= 6 ? 0 : 4000;
                              return shippingFee > 0 && <div>배송비: {formatPrice(shippingFee)}</div>;
                            })()}
                          </div>
                          
                          <div className="text-sm text-gray-600 border-t pt-2">
                            주문금액: <span className="font-medium text-eden-brown">{formatPrice(order.totalAmount)}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            실제입금: <span className="font-medium text-red-600">
                              {order.actualPaidAmount ? formatPrice(order.actualPaidAmount) : '미입력'}
                            </span>
                            {order.discountAmount && order.discountAmount > 0 && (
                              <div className="mt-1 pt-1 border-t border-gray-200">
                                <span className="text-blue-600 font-medium">할인: -{formatPrice(order.discountAmount)}</span>
                              </div>
                            )}
                            {order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && (
                              <div className="mt-1 pt-1 border-t border-gray-200">
                                <span className="text-red-600 font-medium">부분미입금: {formatPrice(order.totalAmount - order.actualPaidAmount)}</span>
                              </div>
                            )}
                          </div>
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
                          value={
                            order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && order.paymentStatus === 'confirmed'
                              ? 'partial'
                              : order.paymentStatus || 'pending'
                          }
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
                            <SelectItem value="partial">
                              <div className="flex items-center space-x-2">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                <span className="text-red-500">부분결제</span>
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
    mutationFn: ({ id, paymentStatus, actualPaidAmount, discountReason }: { id: number; paymentStatus: string; actualPaidAmount?: number; discountReason?: string }) => 
      api.orders.updatePaymentStatus(id, paymentStatus, actualPaidAmount, discountReason),
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

  // Handle payment confirmation with actual amount and discount reason
  const handlePaymentConfirmation = (actualPaidAmount: number, discountReason: string) => {
    if (selectedOrderForPayment) {
      updatePaymentMutation.mutate({
        id: selectedOrderForPayment.id,
        paymentStatus: 'confirmed',
        actualPaidAmount,
        discountReason
      });
      setSelectedOrderForPayment(null);
    }
  };

  // Open payment confirmation dialog
  const openPaymentDialog = (order: Order) => {
    setSelectedOrderForPayment(order);
    setShowPaymentDialog(true);
  };

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateStatusMutation.mutate({ id: orderId, status: newStatus });
  };

  const handlePaymentStatusChange = (orderId: number, newPaymentStatus: string) => {
    if (newPaymentStatus === 'confirmed') {
      // 입금완료 선택시 실제 입금금액 입력 다이얼로그 열기
      const order = orders.find((o: Order) => o.id === orderId);
      if (order) {
        openPaymentDialog(order);
      }
    } else if (newPaymentStatus === 'partial') {
      // 부분결제 선택시도 실제 입금금액 입력 다이얼로그 열기
      const order = orders.find((o: Order) => o.id === orderId);
      if (order) {
        openPaymentDialog(order);
      }
    } else {
      // 다른 상태는 바로 업데이트
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

  const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null || isNaN(price)) return '0원';
    return `${price.toLocaleString()}원`;
  };



  // Calculate stats with actual payment information
  const stats = orders.reduce(
    (acc: any, order: Order) => {
      acc.total++;
      acc[order.status as keyof typeof acc]++;
      if (order.paymentStatus === 'confirmed') acc.paidOrders++;
      if (order.paymentStatus === 'pending') acc.unpaidOrders++;
      if (order.paymentStatus === 'partial') acc.partialOrders++;
      
      // Financial calculations based on actual payment data
      acc.totalRevenue += order.totalAmount;
      
      // Add actual revenue calculations
      if (order.actualPaidAmount) {
        acc.actualRevenue += order.actualPaidAmount;
      } else if (order.paymentStatus === 'confirmed') {
        acc.actualRevenue += order.totalAmount;
      }
      
      // Track discounts and partial payments
      if (order.discountAmount && order.discountAmount > 0) {
        acc.totalDiscounts += order.discountAmount;
      }
      
      if (order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount) {
        acc.totalPartialUnpaid += (order.totalAmount - order.actualPaidAmount);
      }
      
      // Track net profit
      if (order.netProfit !== undefined && order.netProfit !== null) {
        acc.totalNetProfit += order.netProfit;
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
      partialOrders: 0,
      totalRevenue: 0,
      actualRevenue: 0,
      totalDiscounts: 0,
      totalPartialUnpaid: 0,
      totalNetProfit: 0
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
              <Button 
                onClick={() => setActiveTab('revenue')}
                variant="ghost" 
                className={`text-white hover:text-gray-200 p-2 sm:px-4 sm:py-2 ${activeTab === 'revenue' ? 'bg-white/20' : ''}`}
              >
                <DollarSign className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">매출관리</span>
              </Button>
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
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="all">전체 ({allOrders.length})</TabsTrigger>
                  <TabsTrigger value="pending">주문접수 ({pendingOrders.length})</TabsTrigger>
                  <TabsTrigger value="scheduled">예약발송 ({scheduledOrders.length})</TabsTrigger>
                  <TabsTrigger value="delivered">발송완료 ({deliveredOrders.length})</TabsTrigger>
                  <TabsTrigger value="revenue" className="text-purple-600">
                    <DollarSign className="h-4 w-4 mr-1" />
                    매출관리
                  </TabsTrigger>
                  <TabsTrigger value="trash" className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-1" />
                    휴지통 ({deletedOrders.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="mt-6">
                  {selectedOrderItems.size > 0 && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-red-700">
                          {selectedOrderItems.size}개 주문이 선택되었습니다
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOrderItems(new Set())}
                          >
                            선택 해제
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`선택된 ${selectedOrderItems.size}개 주문을 삭제하시겠습니까?`)) {
                                bulkDeleteMutation.mutate(Array.from(selectedOrderItems));
                              }
                            }}
                            disabled={bulkDeleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            일괄 삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {renderOrdersList(allOrders)}
                </TabsContent>
                
                <TabsContent value="pending" className="mt-6">
                  {selectedOrderItems.size > 0 && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-red-700">
                          {selectedOrderItems.size}개 주문이 선택되었습니다
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOrderItems(new Set())}
                          >
                            선택 해제
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`선택된 ${selectedOrderItems.size}개 주문을 삭제하시겠습니까?`)) {
                                bulkDeleteMutation.mutate(Array.from(selectedOrderItems));
                              }
                            }}
                            disabled={bulkDeleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            일괄 삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {renderOrdersList(pendingOrders)}
                </TabsContent>
                
                <TabsContent value="scheduled" className="mt-6">
                  {selectedOrderItems.size > 0 && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-red-700">
                          {selectedOrderItems.size}개 주문이 선택되었습니다
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOrderItems(new Set())}
                          >
                            선택 해제
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`선택된 ${selectedOrderItems.size}개 주문을 삭제하시겠습니까?`)) {
                                bulkDeleteMutation.mutate(Array.from(selectedOrderItems));
                              }
                            }}
                            disabled={bulkDeleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            일괄 삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {renderOrdersList(scheduledOrders)}
                </TabsContent>
                
                <TabsContent value="delivered" className="mt-6">
                  {selectedOrderItems.size > 0 && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-red-700">
                          {selectedOrderItems.size}개 주문이 선택되었습니다
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOrderItems(new Set())}
                          >
                            선택 해제
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`선택된 ${selectedOrderItems.size}개 주문을 삭제하시겠습니까?`)) {
                                bulkDeleteMutation.mutate(Array.from(selectedOrderItems));
                              }
                            }}
                            disabled={bulkDeleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            일괄 삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {renderOrdersList(deliveredOrders)}
                </TabsContent>
                
                <TabsContent value="revenue" className="mt-6">
                  {renderRevenueReport()}
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

      {/* Payment Confirmation Dialog */}
      <PaymentConfirmDialog
        order={selectedOrderForPayment}
        open={showPaymentDialog}
        setOpen={setShowPaymentDialog}
        onConfirm={handlePaymentConfirmation}
      />
    </div>
  );
}
