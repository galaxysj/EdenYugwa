import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { ArrowLeft, Settings, Package, Truck, CheckCircle, Clock, Eye, LogOut, DollarSign, AlertCircle, Download, Calendar, Trash2, PiggyBank, Edit, Cog, RefreshCw, X, Users } from "lucide-react";
import { SmsDialog } from "@/components/sms-dialog";
import ScheduledDatePicker from "@/components/scheduled-date-picker";
import { DeliveredDatePicker } from "@/components/delivered-date-picker";
import { CustomerManagement } from "@/components/customer-management";
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
  const [wrappingCost, setWrappingCost] = useState("");
  
  // Load existing settings when dialog opens
  useEffect(() => {
    if (settings) {
      const smallCostSetting = settings.find(s => s.key === "smallBoxCost");
      const largeCostSetting = settings.find(s => s.key === "largeBoxCost");
      const wrappingCostSetting = settings.find(s => s.key === "wrappingCost");
      
      setSmallBoxCost(smallCostSetting?.value || "");
      setLargeBoxCost(largeCostSetting?.value || "");
      setWrappingCost(wrappingCostSetting?.value || "");
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
    if (!smallBoxCost || !largeBoxCost || !wrappingCost) {
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
      
      await updateCostMutation.mutateAsync({
        key: "wrappingCost",
        value: wrappingCost,
        description: "보자기 원가"
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
          <div>
            <Label htmlFor="wrappingCost">보자기 원가</Label>
            <Input
              id="wrappingCost"
              type="number"
              value={wrappingCost}
              onChange={(e) => setWrappingCost(e.target.value)}
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
                      {order.smallBoxQuantity > 0 && (
                        <div className="font-medium">
                          한과1호×{order.smallBoxQuantity}개: {formatPrice(smallCost)} × {order.smallBoxQuantity} = {formatPrice(order.smallBoxQuantity * smallCost)}
                        </div>
                      )}
                      {order.largeBoxQuantity > 0 && (
                        <div className="font-medium">
                          한과2호×{order.largeBoxQuantity}개: {formatPrice(largeCost)} × {order.largeBoxQuantity} = {formatPrice(order.largeBoxQuantity * largeCost)}
                        </div>
                      )}
                      {order.wrappingQuantity > 0 && (
                        <div className="font-medium">
                          보자기×{order.wrappingQuantity}개: {formatPrice(2000)} × {order.wrappingQuantity} = {formatPrice(wrappingCost)}
                        </div>
                      )}
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
  const [showCustomerManagement, setShowCustomerManagement] = useState(false);
  const [selectedTrashItems, setSelectedTrashItems] = useState<Set<number>>(new Set());
  const [selectedOrderItems, setSelectedOrderItems] = useState<Set<number>>(new Set());
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [orderDateFilter, setOrderDateFilter] = useState<string>('all');
  const [orderStartDate, setOrderStartDate] = useState<string>('');
  const [orderEndDate, setOrderEndDate] = useState<string>('');
  const [customerNameFilter, setCustomerNameFilter] = useState<string>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'payment-status' | 'order-status' | 'delivery-date'>('latest');

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

  // Fetch settings for cost calculations
  const { data: settings } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
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

  // Sort orders function
  const sortOrders = (ordersList: Order[]) => {
    const sorted = [...ordersList];
    
    if (sortOrder === 'latest') {
      // Latest first, but delivered orders at the bottom
      return sorted.sort((a, b) => {
        // If one is delivered and the other isn't, delivered goes to bottom
        if (a.status === 'delivered' && b.status !== 'delivered') return 1;
        if (b.status === 'delivered' && a.status !== 'delivered') return -1;
        
        // If both have same delivery status, sort by date (latest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sortOrder === 'oldest') {
      // Oldest first
      return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortOrder === 'payment-status') {
      // Sort by payment status: pending -> partial at top, confirmed at bottom
      const paymentPriority = { 'pending': 1, 'partial': 2, 'confirmed': 3 };
      return sorted.sort((a, b) => {
        const aPriority = paymentPriority[a.paymentStatus as keyof typeof paymentPriority] || 4;
        const bPriority = paymentPriority[b.paymentStatus as keyof typeof paymentPriority] || 4;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        // If same payment status, sort by date (latest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sortOrder === 'order-status') {
      // Sort by order status: scheduled orders first, then by scheduled date (earliest first)
      return sorted.sort((a, b) => {
        // If one is scheduled and the other isn't, scheduled goes to top
        if (a.status === 'scheduled' && b.status !== 'scheduled') return -1;
        if (b.status === 'scheduled' && a.status !== 'scheduled') return 1;
        
        // Both are scheduled - sort by scheduled date (earliest first)
        if (a.status === 'scheduled' && b.status === 'scheduled') {
          // Orders with scheduled date first, then by scheduled date (earliest first)
          if (a.scheduledDate && !b.scheduledDate) return -1;
          if (!a.scheduledDate && b.scheduledDate) return 1;
          
          if (a.scheduledDate && b.scheduledDate) {
            return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
          }
          
          // Both don't have scheduled date - sort by creation date (latest first)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        
        // Neither is scheduled - sort by creation date (latest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sortOrder === 'delivery-date') {
      // Sort by delivery date: orders without delivery date first, then by delivery date (earliest first)
      return sorted.sort((a, b) => {
        // Orders without delivery date go to top
        if (!a.deliveredDate && b.deliveredDate) return -1;
        if (a.deliveredDate && !b.deliveredDate) return 1;
        
        // Both have delivery dates - sort by delivery date (earliest first)
        if (a.deliveredDate && b.deliveredDate) {
          return new Date(a.deliveredDate).getTime() - new Date(b.deliveredDate).getTime();
        }
        
        // Neither has delivery date - sort by creation date (latest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    
    return sorted;
  };

  // Filter orders for main list with multiple criteria
  const getFilteredOrdersList = (ordersList: Order[]) => {
    let filtered = ordersList;

    // Date filter
    if (orderDateFilter === 'today') {
      const today = new Date().toDateString();
      filtered = filtered.filter(order => new Date(order.createdAt).toDateString() === today);
    } else if (orderDateFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(order => new Date(order.createdAt) >= weekAgo);
    } else if (orderDateFilter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(order => new Date(order.createdAt) >= monthAgo);
    } else if (orderDateFilter === 'custom' && orderStartDate && orderEndDate) {
      const start = new Date(orderStartDate);
      const end = new Date(orderEndDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= start && orderDate <= end;
      });
    }

    // Customer name filter
    if (customerNameFilter.trim()) {
      filtered = filtered.filter(order => 
        order.customerName.toLowerCase().includes(customerNameFilter.toLowerCase().trim())
      );
    }

    // Payment status filter
    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(order => order.paymentStatus === paymentStatusFilter);
    }

    // Order status filter
    if (orderStatusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === orderStatusFilter);
    }

    // Apply sorting
    return sortOrders(filtered);
  };

  const allOrders = getFilteredOrdersList(orders);
  const pendingOrders = getFilteredOrdersList(filterOrdersByStatus("pending"));
  const scheduledOrders = getFilteredOrdersList(filterOrdersByStatus("scheduled"));
  const deliveredOrders = getFilteredOrdersList(filterOrdersByStatus("delivered"));

  // Render revenue report function
  const renderRevenueReport = () => {
    // Get cost values from settings
    const smallBoxCostValue = settings?.find(s => s.key === "smallBoxCost")?.value ? 
      parseInt(settings.find(s => s.key === "smallBoxCost")?.value || "0") : 15000;
    const largeBoxCostValue = settings?.find(s => s.key === "largeBoxCost")?.value ? 
      parseInt(settings.find(s => s.key === "largeBoxCost")?.value || "0") : 16000;
    const wrappingCostValue = settings?.find(s => s.key === "wrappingCost")?.value ? 
      parseInt(settings.find(s => s.key === "wrappingCost")?.value || "0") : 1000;
    
    // Include all orders with confirmed payment status (including scheduled and delivered orders)
    const paidOrders = orders.filter((order: Order) => 
      order.paymentStatus === 'confirmed'
    );
    
    // Filter orders by date
    const getFilteredOrders = () => {
      let filtered = paidOrders;
      
      if (dateFilter === 'today') {
        const today = new Date().toDateString();
        filtered = paidOrders.filter((order: Order) => new Date(order.createdAt).toDateString() === today);
      } else if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = paidOrders.filter((order: Order) => new Date(order.createdAt) >= weekAgo);
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filtered = paidOrders.filter((order: Order) => new Date(order.createdAt) >= monthAgo);
      } else if (dateFilter === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the entire end date
        filtered = paidOrders.filter((order: Order) => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= start && orderDate <= end;
        });
      }
      
      return filtered;
    };
    
    const filteredOrders = getFilteredOrders();
    
    // Calculate totals for filtered orders
    const filteredTotals = filteredOrders.reduce((acc: any, order: Order) => {
      acc.count++;
      acc.totalAmount += order.totalAmount;
      acc.actualRevenue += order.actualPaidAmount || order.totalAmount;
      acc.totalDiscounts += order.discountAmount || 0;
      acc.totalPartialUnpaid += (order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount) 
        ? (order.totalAmount - order.actualPaidAmount) : 0;
      acc.netProfit += order.netProfit || 0;
      
      // Calculate product costs and fees - only core costs
      const smallBoxCost = order.smallBoxQuantity * (smallBoxCostValue || 15000);
      const largeBoxCost = order.largeBoxQuantity * (largeBoxCostValue || 16000);
      const wrappingCost = order.wrappingQuantity * (wrappingCostValue || 1000);
      const totalItems = order.smallBoxQuantity + order.largeBoxQuantity;
      const shippingCost = totalItems >= 6 ? 0 : 4000;
      
      acc.totalCost += smallBoxCost + largeBoxCost + wrappingCost + shippingCost;
      acc.smallBoxAmount += order.smallBoxQuantity * 19000;
      acc.largeBoxAmount += order.largeBoxQuantity * 21000;
      acc.wrappingAmount += order.wrappingQuantity * 1000; // 보자기 판매가격
      
      // Calculate quantities
      acc.smallBoxQuantity += order.smallBoxQuantity;
      acc.largeBoxQuantity += order.largeBoxQuantity;
      acc.wrappingQuantity += order.wrappingQuantity;
      
      // Calculate shipping fees and count orders with shipping
      if (shippingCost > 0) acc.shippingOrders++;
      acc.shippingAmount += shippingCost;
      
      return acc;
    }, {
      count: 0,
      totalAmount: 0,
      actualRevenue: 0,
      totalDiscounts: 0,
      totalPartialUnpaid: 0,
      netProfit: 0,
      totalCost: 0,
      smallBoxAmount: 0,
      largeBoxAmount: 0,
      wrappingAmount: 0,
      shippingAmount: 0,
      smallBoxQuantity: 0,
      largeBoxQuantity: 0,
      wrappingQuantity: 0,
      shippingOrders: 0
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
          <div>
            <h3 className="text-lg font-semibold">매출 관리 리포트</h3>
            <p className="text-sm text-gray-600 mt-1">
              입금완료된 모든 주문 (발송예약, 발송완료 포함)
            </p>
          </div>
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

        {/* 매출 총합계 - 통합 테이블 버전 */}
        <Card className="bg-white border-eden-red/20">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-eden-red mb-2">
                매출 총합계 ({dateFilter === 'all' ? '전체 기간' : 
                  dateFilter === 'today' ? '오늘' :
                  dateFilter === 'week' ? '최근 7일' :
                  dateFilter === 'month' ? '최근 30일' :
                  dateFilter === 'custom' && startDate && endDate ? `${startDate} ~ ${endDate}` : '기간 설정'})
              </h3>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-center">
                <div>
                  <div className="font-semibold text-gray-700 mb-1">주문건수</div>
                  <div className="text-lg font-bold text-gray-800">{filteredTotals.count}건</div>
                </div>
                
                <div>
                  <div className="font-semibold text-amber-700 mb-1">한과1호</div>
                  <div className="text-lg font-bold text-amber-600">{filteredTotals.smallBoxQuantity}개</div>
                </div>
                
                <div>
                  <div className="font-semibold text-orange-700 mb-1">한과2호</div>
                  <div className="text-lg font-bold text-orange-600">{filteredTotals.largeBoxQuantity}개</div>
                </div>
                
                <div>
                  <div className="font-semibold text-eden-brown mb-1">보자기</div>
                  <div className="text-lg font-bold text-eden-brown">{filteredTotals.wrappingQuantity}개</div>
                </div>
                
                <div>
                  <div className="font-semibold text-blue-700 mb-1">택배발송</div>
                  <div className="text-lg font-bold text-blue-600">{filteredTotals.shippingOrders}건</div>
                </div>
                
                <div>
                  <div className="font-semibold text-green-700 mb-1">실제입금</div>
                  <div className="text-lg font-bold text-green-600">{formatPrice(filteredTotals.actualRevenue)}</div>
                </div>
                
                <div>
                  <div className="font-semibold text-red-700 mb-1">총원가</div>
                  <div className="text-lg font-bold text-red-600">
                    {formatPrice(filteredTotals.totalCost)}
                  </div>
                </div>
                
                <div>
                  <div className="font-semibold text-purple-700 mb-1">실제수익</div>
                  <div className={`text-lg font-bold ${(filteredTotals.totalAmount - filteredTotals.totalCost - filteredTotals.totalDiscounts) >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                    {formatPrice(filteredTotals.totalAmount - filteredTotals.totalCost - filteredTotals.totalDiscounts)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>



        {/* 매출관리 주문 상세 리스트 */}
        {filteredOrders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>주문 상세 내역</span>
                <span className="text-sm font-normal text-gray-500">
                  {filteredOrders.length}건
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-sm">
                      <th className="text-left py-2 px-3 font-medium text-gray-600">주문번호</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">고객명</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">주문일</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">주문내역</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">주문가격</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">실제입금</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">할인/미입금</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">원가분석</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">실제수익</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders
                      .sort((a: Order, b: Order) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((order: Order) => {
                      const smallBoxTotal = order.smallBoxQuantity * 19000;
                      const largeBoxTotal = order.largeBoxQuantity * 21000;
                      const wrappingTotal = order.wrappingQuantity * 1000;
                      const totalItems = order.smallBoxQuantity + order.largeBoxQuantity;
                      const shippingFee = totalItems >= 6 ? 0 : 4000;
                      
                      // Get global cost settings
                      const smallCostSetting = settings?.find((s: Setting) => s.key === "smallBoxCost");
                      const largeCostSetting = settings?.find((s: Setting) => s.key === "largeBoxCost");
                      const smallCost = smallCostSetting ? parseInt(smallCostSetting.value) : 0;
                      const largeCost = largeCostSetting ? parseInt(largeCostSetting.value) : 0;
                      
                      // Calculate actual costs
                      const wrappingCostSetting = settings?.find((s: Setting) => s.key === "wrappingCost");
                      const wrappingCostValue = wrappingCostSetting ? parseInt(wrappingCostSetting.value) : 1000;
                      const wrappingCost = order.wrappingQuantity * wrappingCostValue;
                      const smallBoxesCost = order.smallBoxQuantity * smallCost;
                      const largeBoxesCost = order.largeBoxQuantity * largeCost;
                      const totalCost = smallBoxesCost + largeBoxesCost + wrappingCost;
                      
                      // Calculate discount and unpaid amounts
                      const discountAmount = order.discountAmount || 0;
                      const unpaidAmount = (order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount) 
                        ? (order.totalAmount - order.actualPaidAmount) : 0;
                      
                      return (
                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">#{order.orderNumber}</td>
                          <td className="py-3 px-4">{order.customerName}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            <div>{new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
                            <div className="text-xs">{new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <div className="space-y-1">
                              {order.smallBoxQuantity > 0 && (
                                <div>한과1호×{order.smallBoxQuantity}개</div>
                              )}
                              {order.largeBoxQuantity > 0 && (
                                <div>한과2호×{order.largeBoxQuantity}개</div>
                              )}
                              {order.wrappingQuantity > 0 && (
                                <div>보자기×{order.wrappingQuantity}개</div>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right text-sm font-medium text-gray-700">
                            {formatPrice(order.totalAmount)}
                          </td>
                          <td className="py-2 px-3 text-right text-sm font-medium text-green-600">
                            {order.actualPaidAmount ? formatPrice(order.actualPaidAmount) : formatPrice(order.totalAmount)}
                          </td>
                          <td className="py-2 px-3 text-right text-sm">
                            {discountAmount > 0 ? (
                              <span className="text-blue-600 font-medium">
                                할인 {formatPrice(discountAmount)}
                              </span>
                            ) : unpaidAmount > 0 ? (
                              <span className="text-red-600 font-medium">
                                미입금 {formatPrice(unpaidAmount)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-xs">
                            <div className="space-y-1">
                              {order.smallBoxQuantity > 0 && (
                                <div className="text-gray-600">
                                  한과1호원가: {formatPrice(smallBoxesCost)}
                                </div>
                              )}
                              {order.largeBoxQuantity > 0 && (
                                <div className="text-gray-600">
                                  한과2호원가: {formatPrice(largeBoxesCost)}
                                </div>
                              )}
                              {order.wrappingQuantity > 0 && (
                                <div className="text-gray-600">
                                  보자기원가: {formatPrice(wrappingCost)}
                                </div>
                              )}
                              {shippingFee > 0 && (
                                <div className="text-gray-600">
                                  배송비: {formatPrice(shippingFee)}
                                </div>
                              )}

                              {unpaidAmount > 0 && (
                                <div className="text-red-600">
                                  미입금: {formatPrice(unpaidAmount)}
                                </div>
                              )}
                              <div className="font-medium text-red-600 border-t pt-1">
                                총원가: {formatPrice(totalCost)}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right text-sm">
                            {(() => {
                              // 실제수익 = 주문가격 - 원가 - 배송비 - 할인/미입금
                              const actualProfit = order.totalAmount - totalCost - shippingFee - discountAmount - unpaidAmount;
                              return (
                                <span className={`font-medium ${actualProfit >= 0 ? "text-purple-600" : "text-red-600"}`}>
                                  {formatPrice(actualProfit)}
                                </span>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
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
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          주문번호: {order.orderNumber}
                        </h3>
                        <div className="text-xs text-gray-500">
                          <div>주문일: {new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
                          <div>{new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
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

  // Clear all filters
  const clearAllFilters = () => {
    setOrderDateFilter('all');
    setOrderStartDate('');
    setOrderEndDate('');
    setCustomerNameFilter('');
    setPaymentStatusFilter('all');
    setOrderStatusFilter('all');
    setSortOrder('latest');
  };

  // Render filter UI
  const renderOrderFilters = () => (
    <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
        {/* Date Filter - Simplified */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">기간</label>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={orderDateFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setOrderDateFilter('all')}
              className="flex-1 h-8 text-xs"
            >
              전체
            </Button>
            <Button
              size="sm"
              variant={orderDateFilter === 'today' ? 'default' : 'outline'}
              onClick={() => setOrderDateFilter('today')}
              className="flex-1 h-8 text-xs"
            >
              오늘
            </Button>
            <Button
              size="sm"
              variant={orderDateFilter === 'week' ? 'default' : 'outline'}
              onClick={() => setOrderDateFilter('week')}
              className="flex-1 h-8 text-xs"
            >
              7일
            </Button>
          </div>
          {orderDateFilter === 'custom' && (
            <div className="flex gap-1 mt-2">
              <input
                type="date"
                value={orderStartDate}
                onChange={(e) => setOrderStartDate(e.target.value)}
                className="flex-1 px-2 py-1 border rounded text-xs"
              />
              <input
                type="date"
                value={orderEndDate}
                onChange={(e) => setOrderEndDate(e.target.value)}
                className="flex-1 px-2 py-1 border rounded text-xs"
              />
            </div>
          )}
        </div>

        {/* Customer Name Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">고객명</label>
          <input
            type="text"
            placeholder="고객명 검색"
            value={customerNameFilter}
            onChange={(e) => setCustomerNameFilter(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm h-8"
          />
        </div>

        {/* Payment Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">입금상태</label>
          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm h-8"
          >
            <option value="all">전체</option>
            <option value="pending">입금대기</option>
            <option value="confirmed">입금완료</option>
            <option value="partial">부분결제</option>
            <option value="refunded">환불</option>
          </select>
        </div>

        {/* Order Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">주문상태</label>
          <select
            value={orderStatusFilter}
            onChange={(e) => setOrderStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm h-8"
          >
            <option value="all">전체</option>
            <option value="pending">접수대기</option>
            <option value="scheduled">발송예약</option>
            <option value="delivered">발송완료</option>
          </select>
        </div>
      </div>
      
      {/* Sort Options */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">정렬:</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={sortOrder === 'latest' ? 'default' : 'outline'}
                onClick={() => setSortOrder('latest')}
                className="h-7 text-xs px-2"
              >
                최신순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'oldest' ? 'default' : 'outline'}
                onClick={() => setSortOrder('oldest')}
                className="h-7 text-xs px-2"
              >
                오래된순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'payment-status' ? 'default' : 'outline'}
                onClick={() => setSortOrder('payment-status')}
                className="h-7 text-xs px-2"
              >
                입금상태순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'order-status' ? 'default' : 'outline'}
                onClick={() => setSortOrder('order-status')}
                className="h-7 text-xs px-2"
              >
                주문상태순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'delivery-date' ? 'default' : 'outline'}
                onClick={() => setSortOrder('delivery-date')}
                className="h-7 text-xs px-2"
              >
                발송일순
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-600">
              검색결과: <span className="font-medium text-gray-900">{allOrders.length}건</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearAllFilters}
              className="text-xs text-gray-500 hover:text-gray-700 h-6 px-2"
            >
              초기화
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

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
        <div className="hidden lg:block overflow-x-auto bg-white rounded-lg border">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="w-8 py-2 px-2 text-center">
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
                <th className="text-left py-2 px-2 font-medium text-gray-700 text-xs">주문번호</th>
                <th className="text-left py-2 px-2 font-medium text-gray-700 text-xs">주문자</th>
                <th className="text-left py-2 px-2 font-medium text-gray-700 text-xs">예금자</th>
                <th className="text-left py-2 px-2 font-medium text-gray-700 text-xs">주문내역</th>
                <th className="text-left py-2 px-2 font-medium text-gray-700 text-xs">연락처</th>
                <th className="text-left py-2 px-2 font-medium text-gray-700 text-xs">배송주소</th>
                <th className="text-left py-2 px-2 font-medium text-gray-700 text-xs">매출/입금정보</th>
                <th className="text-center py-2 px-2 font-medium text-gray-700 text-xs">입금상태</th>
                <th className="text-center py-2 px-2 font-medium text-gray-700 text-xs">주문상태</th>
                <th className="text-center py-2 px-2 font-medium text-gray-700 text-xs">발송일</th>
                <th className="text-center py-2 px-2 font-medium text-gray-700 text-xs">관리</th>
              </tr>
            </thead>
            <tbody>
              {ordersList.map((order: Order) => {
                const StatusIcon = statusIcons[order.status as keyof typeof statusIcons];
                return (
                  <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50" data-order-id={order.id}>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedOrderItems.has(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <div className="font-medium text-gray-900 text-xs">#{order.orderNumber}</div>
                      <div className="text-xs text-gray-500">
                        <div>{new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
                        <div>{new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      {order.scheduledDate && (
                        <div className="text-red-600 font-bold text-xs">
                          예약: {new Date(order.scheduledDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                        </div>
                      )}
                      {order.status === 'scheduled' && !order.scheduledDate && (
                        <div className="text-orange-600 font-bold text-xs">예약 대기</div>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <div className="font-medium text-gray-900 text-xs">{order.customerName}</div>
                      {order.recipientName && order.recipientName !== order.customerName && (
                        <div className="text-xs text-blue-600">받는분: {order.recipientName}</div>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <div className="font-medium text-xs">
                        {order.isDifferentDepositor && order.depositorName ? (
                          <span className="text-red-600">{order.depositorName}</span>
                        ) : (
                          <span className="text-gray-500">{order.customerName}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 min-w-[80px]">
                      <div className="text-xs space-y-1">
                        {order.smallBoxQuantity > 0 && (
                          <div>한과1호×{order.smallBoxQuantity}개</div>
                        )}
                        {order.largeBoxQuantity > 0 && (
                          <div>한과2호×{order.largeBoxQuantity}개</div>
                        )}
                        {order.wrappingQuantity > 0 && (
                          <div className="text-eden-brown">보자기×{order.wrappingQuantity}개</div>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <div className="text-xs text-gray-900">{order.customerPhone}</div>
                    </td>
                    <td className="py-2 px-2 max-w-xs">
                      <Dialog>
                        <DialogTrigger asChild>
                          <div 
                            className="text-xs text-gray-900 cursor-pointer hover:bg-blue-50 px-1 py-1 rounded border border-transparent hover:border-blue-200 truncate"
                            title="클릭하여 전체 주소 보기"
                          >
                            {order.address1.length > 15 ? `${order.address1.substring(0, 15)}...` : order.address1}
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>배송 주소</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-2">
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-sm font-medium text-gray-700 mb-1">우편번호</div>
                              <div className="text-sm text-gray-900">{order.zipCode}</div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-sm font-medium text-gray-700 mb-1">기본 주소</div>
                              <div className="text-sm text-gray-900">{order.address1}</div>
                            </div>
                            {order.address2 && (
                              <div className="p-3 bg-gray-50 rounded-lg">
                                <div className="text-sm font-medium text-gray-700 mb-1">상세 주소</div>
                                <div className="text-sm text-gray-900">{order.address2}</div>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center space-x-3 text-xs">
                        <div>
                          <span className="text-gray-500">매출:</span>
                          <span className="font-medium text-gray-900 ml-1">{formatPrice(order.totalAmount)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">실입금:</span>
                          {order.paymentStatus === 'confirmed' || order.paymentStatus === 'partial' ? (
                            <span
                              className="cursor-pointer hover:bg-blue-50 px-1 py-1 rounded border border-transparent hover:border-blue-200 ml-1 font-medium"
                              onClick={() => {
                                const currentAmount = order.actualPaidAmount || order.totalAmount;
                                const newAmount = prompt('실제 입금금액을 입력하세요:', currentAmount.toString());
                                if (newAmount && !isNaN(Number(newAmount))) {
                                  handlePaymentStatusChange(order.id, order.paymentStatus, Number(newAmount));
                                }
                              }}
                              title="클릭하여 실제 입금금액 수정"
                            >
                              {order.actualPaidAmount ? formatPrice(order.actualPaidAmount) : formatPrice(order.totalAmount)}
                            </span>
                          ) : (
                            <span className="text-gray-400 ml-1">-</span>
                          )}
                        </div>
                        <div>
                          {order.discountAmount && order.discountAmount > 0 ? (
                            <span className="text-blue-600">할인: -{formatPrice(Math.abs(order.discountAmount))}</span>
                          ) : order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && (order.totalAmount - order.actualPaidAmount) > 0 ? (
                            <span className="text-red-600">미입금: {formatPrice(Math.max(0, order.totalAmount - order.actualPaidAmount))}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Select
                        value={
                          order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && order.paymentStatus === 'confirmed'
                            ? 'partial'
                            : order.paymentStatus || 'pending'
                        }
                        onValueChange={(newPaymentStatus) => handlePaymentStatusChange(order.id, newPaymentStatus)}
                        disabled={updatePaymentMutation.isPending}
                      >
                        <SelectTrigger className="w-20 h-6 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">
                            <div className="flex items-center space-x-1">
                              <AlertCircle className="h-3 w-3 text-orange-500" />
                              <span>입금대기</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="confirmed">
                            <div className="flex items-center space-x-1">
                              <DollarSign className="h-3 w-3 text-green-500" />
                              <span>입금완료</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="partial">
                            <div className="flex items-center space-x-1">
                              <AlertCircle className="h-3 w-3 text-red-500" />
                              <span className="text-red-500">부분결제</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="refunded">
                            <div className="flex items-center space-x-1">
                              <AlertCircle className="h-3 w-3 text-red-500" />
                              <span>환불</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Select
                        value={order.status}
                        onValueChange={(newStatus) => handleStatusChange(order.id, newStatus)}
                        disabled={updateStatusMutation.isPending}
                      >
                        <SelectTrigger className="w-20 h-6 text-xs">
                          <SelectValue>
                            {order.scheduledDate && order.status === 'pending' ? "주문접수" : statusLabels[order.status as keyof typeof statusLabels]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3 text-yellow-500" />
                              <span>주문접수</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="scheduled">
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3 text-blue-500" />
                              <span>발송예약</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="delivered">
                            <div className="flex items-center space-x-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              <span>발송완료</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-2 text-center">
                      {order.status === 'delivered' && order.deliveredDate ? (
                        <div 
                          className="text-xs text-green-600 font-medium cursor-pointer hover:bg-green-50 px-1 py-1 rounded border border-transparent hover:border-green-200"
                          onClick={() => {
                            const deliveredDatePicker = document.querySelector(`[data-order-id="${order.id}"] .delivered-date-trigger`);
                            if (deliveredDatePicker) {
                              (deliveredDatePicker as HTMLElement).click();
                            }
                          }}
                          title="클릭하여 발송완료일 수정"
                        >
                          {new Date(order.deliveredDate).toLocaleDateString('ko-KR')}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <div className="flex flex-col gap-1">
                        <SmsDialog order={order} />
                        <ScheduledDatePicker order={order} />
                        <FinancialDialog order={order} />
                        <div className="hidden">
                          <DeliveredDatePicker order={order} />
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteOrder(order.id)}
                          disabled={deleteOrderMutation.isPending}
                          className="flex items-center gap-1 h-6 text-xs px-1"
                        >
                          <Trash2 className="h-3 w-3" />
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
                          <div>{new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
                          <div>{new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
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
                        {order.status === 'delivered' && order.deliveredDate && (
                          <div className="mt-1">
                            <div className="text-green-600 font-bold text-base">
                              ✅ 발송완료: {new Date(order.deliveredDate).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit', 
                                day: '2-digit',
                                weekday: 'short'
                              })}
                            </div>
                          </div>
                        )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        {StatusIcon && <StatusIcon className="h-5 w-5 text-blue-500" />}
                        <span className="text-sm font-medium text-blue-600">
                          {order.scheduledDate && order.status === 'pending' ? "주문접수" : statusLabels[order.status as keyof typeof statusLabels]}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500 mb-1">주문자</div>
                        <div className="font-medium">{order.customerName}</div>
                        
                        <div className="text-gray-500 mb-1 mt-2">예금자</div>
                        {order.isDifferentDepositor && order.depositorName ? (
                          <div className="font-medium text-red-600">{order.depositorName}</div>
                        ) : (
                          <div className="font-medium text-gray-500">{order.customerName}</div>
                        )}
                        
                        {order.recipientName && order.recipientName !== order.customerName && (
                          <>
                            <div className="text-gray-500 mb-1 mt-2">받는분</div>
                            <div className="font-medium text-blue-600">{order.recipientName}</div>
                          </>
                        )}
                      </div>
                      <div>
                        <div className="text-gray-500 mb-1">연락처</div>
                        <div className="font-medium">{order.customerPhone}</div>
                        {order.recipientPhone && order.recipientPhone !== order.customerPhone && (
                          <>
                            <div className="text-gray-500 mb-1 mt-2">받는분 연락처</div>
                            <div className="font-medium text-blue-600">{order.recipientPhone}</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-sm">
                      <div className="text-gray-500 mb-1">주문자 주소</div>
                      <div>
                        [{order.zipCode}] {order.address1} {order.address2}
                      </div>
                      {order.recipientAddress1 && (
                        <>
                          <div className="text-gray-500 mb-1 mt-2">받는분 주소</div>
                          <div className="text-blue-600">
                            [{order.recipientZipCode}] {order.recipientAddress1} {order.recipientAddress2}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500 mb-2">주문상품</div>
                        <div className="space-y-1">
                          {order.smallBoxQuantity > 0 && (
                            <div className="font-medium">한과1호×{order.smallBoxQuantity}개</div>
                          )}
                          {order.largeBoxQuantity > 0 && (
                            <div className="font-medium">한과2호×{order.largeBoxQuantity}개</div>
                          )}
                          {order.wrappingQuantity > 0 && (
                            <div className="font-medium text-eden-brown">보자기×{order.wrappingQuantity}개</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-2">매출현황</div>
                        <div className="text-sm text-gray-600">
                          주문금액: <span className="font-medium text-eden-brown">{formatPrice(order.totalAmount)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      <div>
                        <div className="text-gray-500 mb-2">실제입금</div>
                        {order.paymentStatus === 'confirmed' || order.paymentStatus === 'partial' ? (
                          <div
                            className="text-xs cursor-pointer hover:bg-blue-50 px-2 py-1 rounded border border-transparent hover:border-blue-200 text-center"
                            onClick={() => {
                              const currentAmount = order.actualPaidAmount || order.totalAmount;
                              const newAmount = prompt('실제 입금금액을 입력하세요:', currentAmount.toString());
                              if (newAmount && !isNaN(Number(newAmount))) {
                                handlePaymentStatusChange(order.id, order.paymentStatus, Number(newAmount));
                              }
                            }}
                            title="클릭하여 실제 입금금액 수정"
                          >
                            {order.actualPaidAmount ? formatPrice(order.actualPaidAmount) : formatPrice(order.totalAmount)}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 text-center py-1">-</div>
                        )}
                      </div>
                      <div>
                        <div className="text-gray-500 mb-2">할인/부분입금</div>
                        <div className="text-xs space-y-1">
                          {order.discountAmount && order.discountAmount > 0 && (
                            <div className="text-blue-600 text-center">
                              할인: -{formatPrice(Math.abs(order.discountAmount))}
                            </div>
                          )}
                          {order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && order.totalAmount - order.actualPaidAmount > 0 && (
                            <div className="text-red-600 text-center">
                              미입금: {formatPrice(Math.max(0, order.totalAmount - order.actualPaidAmount))}
                            </div>
                          )}
                          {!order.discountAmount && (!order.actualPaidAmount || order.actualPaidAmount >= order.totalAmount) && (
                            <div className="text-gray-400 text-center py-1">-</div>
                          )}
                        </div>
                      </div>
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
                          <SelectTrigger className="w-full text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">
                              <div className="flex items-center space-x-2">
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                                <span>입금대기</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="confirmed">
                              <div className="flex items-center space-x-2">
                                <DollarSign className="h-4 w-4 text-green-500" />
                                <span>입금완료</span>
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
                      <div>
                        <div className="text-gray-500 mb-2">발송일</div>
                        {order.status === 'delivered' && order.deliveredDate ? (
                          <div 
                            className="text-xs text-green-600 font-medium cursor-pointer hover:bg-green-50 px-2 py-1 rounded border border-transparent hover:border-green-200"
                            onClick={() => {
                              const deliveredDatePicker = document.querySelector(`[data-order-id="${order.id}"] .delivered-date-trigger`);
                              if (deliveredDatePicker) {
                                (deliveredDatePicker as HTMLElement).click();
                              }
                            }}
                            title="클릭하여 발송완료일 수정"
                          >
                            {new Date(order.deliveredDate).toLocaleDateString('ko-KR')}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex flex-col gap-3">
                        <SmsDialog order={order} />
                        <ScheduledDatePicker order={order} />
                        <FinancialDialog order={order} />
                        <div className="hidden">
                          <DeliveredDatePicker order={order} />
                        </div>
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

  const handlePaymentStatusChange = (orderId: number, newPaymentStatus: string, actualAmount?: number) => {
    if (actualAmount !== undefined) {
      // 실제 입금 금액이 제공된 경우 바로 업데이트
      updatePaymentMutation.mutate({ 
        id: orderId, 
        paymentStatus: newPaymentStatus,
        actualPaidAmount: actualAmount
      });
    } else if (newPaymentStatus === 'confirmed') {
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
    if (price === undefined || price === null || isNaN(price) || price < 0) return '0원';
    return `${Math.round(price).toLocaleString()}원`;
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
              <Button 
                onClick={() => setShowCustomerManagement(true)}
                variant="ghost" 
                className={`text-white hover:text-gray-200 p-2 sm:px-4 sm:py-2 ${showCustomerManagement ? 'bg-white/20' : ''}`}
              >
                <Users className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">고객관리</span>
              </Button>
              <Link href="/admin-settings">
                <Button 
                  variant="ghost" 
                  className="text-white hover:text-gray-200 p-2 sm:px-4 sm:py-2"
                >
                  <Cog className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">관리자 설정</span>
                </Button>
              </Link>
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
        {showCustomerManagement ? (
          <div className="bg-white rounded-lg p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">고객 관리</h3>
              <Button 
                variant="outline" 
                onClick={() => setShowCustomerManagement(false)}
              >
                <X className="h-4 w-4 mr-2" />
                닫기
              </Button>
            </div>
            <CustomerManagement />
          </div>
        ) : (
          <>

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
                  {renderOrderFilters()}
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
                  {renderOrderFilters()}
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
                  {renderOrderFilters()}
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
                  {renderOrderFilters()}
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
          </>
        )}
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
