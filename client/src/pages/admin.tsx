import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { ArrowLeft, Settings, Package, Truck, CheckCircle, Clock, Eye, LogOut, DollarSign, AlertCircle, Download, Calendar, Trash2, Edit, Cog, RefreshCw, X, Users, Key, MessageSquare } from "lucide-react";
import { SmsDialog } from "@/components/sms-dialog";
import ScheduledDatePicker from "@/components/scheduled-date-picker";
import { DeliveredDatePicker } from "@/components/delivered-date-picker";
import { SellerShippedDatePicker } from "@/components/seller-shipped-date-picker";
import { CustomerManagement } from "@/components/customer-management";
import { UserManagement } from "@/components/user-management";
import PasswordChangeDialog from "@/components/PasswordChangeDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminHeader } from "@/components/admin-header";
import type { Order, Setting } from "@shared/schema";
import * as XLSX from 'xlsx';



const statusLabels = {
  pending: "주문접수",
  scheduled: "발송주문",
  delivered: "발송완료",
};

const statusIcons = {
  pending: Clock,
  scheduled: Calendar,
  delivered: CheckCircle,
};

// 제주도 및 도서산간지역 감지 함수
const checkRemoteArea = (address: string) => {
  if (!address) return false;
  
  // 울릉도(섬) 포함 - 경북 울릉군 포함
  if (address.includes('울릉도') || address.includes('울릉군')) {
    return true;
  }
  
  const remoteAreaKeywords = [
    '제주', '제주도', '제주시', '서귀포', '서귀포시',
    '독도',
    '강화', '강화도', '강화군',
    '백령', '백령도',
    '연평', '연평도',
    '흑산', '흑산도',
    '진도', '진도군',
    '가파리', '가파도',
    '영도', '영도구'
  ];
  
  return remoteAreaKeywords.some(keyword => address.includes(keyword));
};

// Payment Details Dialog Component
function PaymentDetailsDialog({ order, onUpdate, open, setOpen }: { order: Order; onUpdate: (orderId: number, paymentStatus: string, actualPaidAmount?: number, discountAmount?: number) => void; open: boolean; setOpen: (open: boolean) => void }) {
  const [actualPaidAmount, setActualPaidAmount] = useState(order.actualPaidAmount?.toString() || order.totalAmount.toString());
  const [discountAmount, setDiscountAmount] = useState(order.discountAmount?.toString() || "0");

  const formatPriceLocal = (price: number | undefined | null) => {
    if (price === undefined || price === null || isNaN(price) || price < 0) return '0원';
    return `${Math.round(price).toLocaleString()}원`;
  };

  const handleSubmit = () => {
    const paidAmount = Number(actualPaidAmount);
    const discount = Number(discountAmount);
    
    if (isNaN(paidAmount) || paidAmount < 0) {
      alert('올바른 입금액을 입력해주세요.');
      return;
    }
    
    if (isNaN(discount) || discount < 0) {
      alert('올바른 할인액을 입력해주세요.');
      return;
    }
    
    onUpdate(order.id, 'confirmed', paidAmount, discount);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>입금 내역 입력</DialogTitle>
          <DialogDescription>
            주문번호: {order.orderNumber} | 총 주문금액: {formatPriceLocal(order.totalAmount)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="actualPaidAmount">실제 입금액</Label>
            <Input
              id="actualPaidAmount"
              type="number"
              value={actualPaidAmount}
              onChange={(e) => setActualPaidAmount(e.target.value)}
              placeholder="실제 입금된 금액을 입력하세요"
            />
          </div>
          <div>
            <Label htmlFor="discountAmount">할인액 (선택사항)</Label>
            <Input
              id="discountAmount"
              type="number"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              placeholder="할인 금액이 있으면 입력하세요"
            />
          </div>
          <div className="text-sm text-gray-600">
            <div>실입금: {formatPriceLocal(Number(actualPaidAmount) || 0)}</div>
            <div>할인액: {formatPriceLocal(Number(discountAmount) || 0)}</div>
            <div className="font-medium">
              미입금: {formatPriceLocal(Math.max(0, order.totalAmount - (Number(actualPaidAmount) || 0) - (Number(discountAmount) || 0)))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="flex-1">
              확인
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              취소
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const [shippingFee, setShippingFee] = useState("");
  const [freeShippingThreshold, setFreeShippingThreshold] = useState("");
  
  // Load existing settings when dialog opens
  useEffect(() => {
    if (settings) {
      const smallCostSetting = settings.find(s => s.key === "smallBoxCost");
      const largeCostSetting = settings.find(s => s.key === "largeBoxCost");
      const wrappingCostSetting = settings.find(s => s.key === "wrappingCost");
      const shippingFeeSetting = settings.find(s => s.key === "shippingFee");
      const thresholdSetting = settings.find(s => s.key === "freeShippingThreshold");
      
      setSmallBoxCost(smallCostSetting?.value || "");
      setLargeBoxCost(largeCostSetting?.value || "");
      setWrappingCost(wrappingCostSetting?.value || "");
      setShippingFee(shippingFeeSetting?.value || "");
      setFreeShippingThreshold(thresholdSetting?.value || "");
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
    if (!smallBoxCost || !largeBoxCost || !wrappingCost || !shippingFee || !freeShippingThreshold) {
      toast({
        title: "입력 오류",
        description: "모든 설정 정보를 입력해주세요.",
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
      
      await updateCostMutation.mutateAsync({
        key: "shippingFee",
        value: shippingFee,
        description: "배송비 (6개 미만 주문 시)"
      });
      
      await updateCostMutation.mutateAsync({
        key: "freeShippingThreshold",
        value: freeShippingThreshold,
        description: "무료배송 최소 수량"
      });
    } catch (error) {
      console.error("Settings update error:", error);
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
          <DialogTitle>전역 원가 및 배송비 설정</DialogTitle>
          <DialogDescription>
            모든 주문에 적용할 기본 원가와 배송비 정책을 설정합니다.
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
          <div className="border-t border-gray-200 pt-4">
            <div className="mb-3">
              <h4 className="font-medium text-gray-900">배송비 설정</h4>
              <p className="text-sm text-gray-600">주문 폼의 배송비 계산에 적용됩니다</p>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="shippingFee">배송비</Label>
                <Input
                  id="shippingFee"
                  type="number"
                  value={shippingFee}
                  onChange={(e) => setShippingFee(e.target.value)}
                  placeholder="배송비 입력 (원)"
                />
              </div>
              <div>
                <Label htmlFor="freeShippingThreshold">무료배송 최소 수량</Label>
                <Input
                  id="freeShippingThreshold"
                  type="number"
                  value={freeShippingThreshold}
                  onChange={(e) => setFreeShippingThreshold(e.target.value)}
                  placeholder="개수 입력"
                />
              </div>
            </div>
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



export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("all");
  const [showCustomerManagement, setShowCustomerManagement] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [selectedTrashItems, setSelectedTrashItems] = useState<Set<number>>(new Set());
  const [selectedShippingItems, setSelectedShippingItems] = useState<Set<number>>(new Set());
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
  const [sellerShippedFilter, setSellerShippedFilter] = useState<string>('all');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [showPaymentDetailsDialog, setShowPaymentDetailsDialog] = useState(false);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'delivery-date' | 'scheduled-date' | 'order-status' | 'payment-status' | 'order-number'>('latest');

  // Clear selections when switching tabs
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setSelectedOrderItems(new Set());
    setSelectedTrashItems(new Set());
  };

  const handleLogout = () => {
    logout();
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
    setSelectedShippingItems(new Set());
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

  // Excel export function for admin
  const exportToExcel = (ordersList: Order[], fileName: string) => {
    const excelData = ordersList.map(order => {
      // Get global cost settings
      const smallCostSetting = settings?.find((s: Setting) => s.key === "smallBoxCost");
      const largeCostSetting = settings?.find((s: Setting) => s.key === "largeBoxCost");
      const wrappingCostSetting = settings?.find((s: Setting) => s.key === "wrappingCost");
      const smallCost = smallCostSetting ? parseInt(smallCostSetting.value) : 15000;
      const largeCost = largeCostSetting ? parseInt(largeCostSetting.value) : 16000;
      const wrappingCostValue = wrappingCostSetting ? parseInt(wrappingCostSetting.value) : 1000;
      
      // Calculate totals
      const smallBoxTotal = order.smallBoxQuantity * 19000;
      const largeBoxTotal = order.largeBoxQuantity * 21000;
      const wrappingTotal = order.wrappingQuantity * 1000;
      const totalItems = order.smallBoxQuantity + order.largeBoxQuantity;
      const shippingFee = totalItems >= 6 ? 0 : 4000;
      
      // Calculate costs
      const smallBoxesCost = order.smallBoxQuantity * smallCost;
      const largeBoxesCost = order.largeBoxQuantity * largeCost;
      const wrappingCost = order.wrappingQuantity * wrappingCostValue;
      const totalCost = smallBoxesCost + largeBoxesCost + wrappingCost;
      const netProfit = (order.actualPaidAmount || order.totalAmount) - totalCost;
      
      return {
        '주문번호': order.orderNumber,
        '주문일': new Date(order.createdAt).toLocaleDateString('ko-KR'),
        '주문시간': new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        '고객명': order.customerName,
        '받는분': order.recipientName || order.customerName,
        '전화번호': order.customerPhone,
        '주소': `${order.address1} ${order.address2 || ''}`.trim(),
        '상품': [
          order.smallBoxQuantity > 0 ? `한과1호×${order.smallBoxQuantity}개` : '',
          order.largeBoxQuantity > 0 ? `한과2호×${order.largeBoxQuantity}개` : '',
          order.wrappingQuantity > 0 ? `보자기×${order.wrappingQuantity}개` : ''
        ].filter(Boolean).join(', '),
        '주문금액': order.totalAmount,
        '실입금액': order.actualPaidAmount || order.totalAmount,
        '할인금액': order.discountAmount || 0,
        '입금상태': order.paymentStatus === 'confirmed' ? '입금완료' : 
                   order.paymentStatus === 'partial' ? '부분결제' :
                   order.paymentStatus === 'refunded' ? '환불' : '입금대기',
        '주문상태': statusLabels[order.status as keyof typeof statusLabels],
        '발송상태': order.sellerShipped ? '발송완료' : '발송대기',
        '예약발송일': order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('ko-KR') : '',
        '발송완료일': order.deliveredDate ? new Date(order.deliveredDate).toLocaleDateString('ko-KR') : '',
        '매니저발송일': order.sellerShippedDate ? new Date(order.sellerShippedDate).toLocaleDateString('ko-KR') : '',
        '원가합계': totalCost,
        '순수익': netProfit,
        '메모': order.specialRequests || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "주문목록");
    
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${fileName}_${today}.xlsx`);
    
    toast({
      title: "엑셀 다운로드 완료",
      description: `${ordersList.length}개 주문이 엑셀로 다운로드되었습니다.`,
    });
  };

  // Shipping selection functions
  const toggleShippingSelection = (orderId: number) => {
    const newSelection = new Set(selectedShippingItems);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedShippingItems(newSelection);
  };

  const selectAllShipping = (ordersList: Order[]) => {
    const eligibleOrders = ordersList.filter(order => !order.sellerShipped);
    const allIds = new Set(eligibleOrders.map(order => order.id));
    setSelectedShippingItems(allIds);
  };

  const handleBulkSellerShipped = () => {
    if (selectedShippingItems.size === 0) return;
    
    if (confirm(`선택된 ${selectedShippingItems.size}개 주문을 발송완료로 변경하시겠습니까?`)) {
      bulkSellerShippedMutation.mutate(Array.from(selectedShippingItems));
    }
  };

  // Filter orders by status
  const filterOrdersByStatus = (status: string) => {
    if (status === "all") return orders;
    if (status === "delivered") {
      // 발송완료: status가 delivered이거나 sellerShipped가 true인 주문
      return orders.filter((order: Order) => 
        order.status === status || (order.sellerShipped === true)
      );
    }
    return orders.filter((order: Order) => order.status === status);
  };

  // Helper function to get field value for sorting


  // Sort orders function
  const sortOrders = (ordersList: Order[]) => {
    const sorted = [...ordersList];
    
    // Universal sorting function that puts seller shipped orders at the bottom
    const sortWithSellerShippedAtBottom = (compareFn: (a: Order, b: Order) => number) => {
      return sorted.sort((a, b) => {
        // Seller shipped orders go to bottom
        if (a.sellerShipped && !b.sellerShipped) return 1;
        if (!a.sellerShipped && b.sellerShipped) return -1;
        
        // If both have same seller shipped status, use the provided compare function
        return compareFn(a, b);
      });
    };
    
    if (sortOrder === 'latest') {
      // Latest first
      return sortWithSellerShippedAtBottom((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sortOrder === 'oldest') {
      // Oldest first
      return sortWithSellerShippedAtBottom((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    } else if (sortOrder === 'delivery-date') {
      // Sort by delivery date: orders without delivery date first, then by delivery date (earliest first)
      return sortWithSellerShippedAtBottom((a, b) => {
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
    } else if (sortOrder === 'scheduled-date') {
      // Sort by scheduled date: orders without scheduled date first, then by scheduled date (earliest first)
      return sortWithSellerShippedAtBottom((a, b) => {
        // Orders without scheduled date go to top
        if (!a.scheduledDate && b.scheduledDate) return -1;
        if (a.scheduledDate && !b.scheduledDate) return 1;
        
        // Both have scheduled dates - sort by scheduled date (earliest first)
        if (a.scheduledDate && b.scheduledDate) {
          return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
        }
        
        // Neither has scheduled date - sort by creation date (latest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sortOrder === 'order-status') {
      // Sort by order status: pending -> scheduled -> delivered
      return sortWithSellerShippedAtBottom((a, b) => {
        const statusPriority = { 'pending': 1, 'scheduled': 2, 'delivered': 3 };
        const aPriority = statusPriority[a.status as keyof typeof statusPriority] || 999;
        const bPriority = statusPriority[b.status as keyof typeof statusPriority] || 999;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        // Same status - sort by creation date (latest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sortOrder === 'payment-status') {
      // Sort by payment status: pending -> partial -> confirmed -> refunded
      return sortWithSellerShippedAtBottom((a, b) => {
        const paymentPriority = { 'pending': 1, 'partial': 2, 'confirmed': 3, 'refunded': 4 };
        const aPriority = paymentPriority[a.paymentStatus as keyof typeof paymentPriority] || 999;
        const bPriority = paymentPriority[b.paymentStatus as keyof typeof paymentPriority] || 999;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        // Same payment status - sort by creation date (latest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sortOrder === 'order-number') {
      // Sort by order number (earliest first)
      return sortWithSellerShippedAtBottom((a, b) => {
        const aNum = parseInt(a.orderNumber.split('-')[1] || '0');
        const bNum = parseInt(b.orderNumber.split('-')[1] || '0');
        return aNum - bNum;
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

    // Seller shipped status filter
    if (sellerShippedFilter !== 'all') {
      if (sellerShippedFilter === 'shipped') {
        filtered = filtered.filter(order => order.sellerShipped === true);
      } else if (sellerShippedFilter === 'not_shipped') {
        filtered = filtered.filter(order => !order.sellerShipped);
      }
    }

    // Apply sorting
    return sortOrders(filtered);
  };

  const allOrders = getFilteredOrdersList(orders);
  const pendingOrders = getFilteredOrdersList(filterOrdersByStatus("pending"));
  const scheduledOrders = getFilteredOrdersList(filterOrdersByStatus("scheduled"));
  const sellerShippedOrders = getFilteredOrdersList(filterOrdersByStatus("seller_shipped"));
  const deliveredOrders = getFilteredOrdersList(filterOrdersByStatus("delivered"));
  const refundedOrders = getFilteredOrdersList(orders.filter((order: Order) => order.paymentStatus === "refunded"));

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
    // Exclude refunded orders from revenue calculation
    const paidOrders = orders.filter((order: Order) => 
      order.paymentStatus === 'confirmed'
    );
    
    // Count refunded orders separately
    const refundedOrders = orders.filter((order: Order) => 
      order.paymentStatus === 'refunded'
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
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4 text-center">
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
                  <div className="font-semibold text-blue-700 mb-1">택배건수</div>
                  <div className="text-lg font-bold text-blue-600">{filteredTotals.shippingOrders}건</div>
                </div>
                
                <div>
                  <div className="font-semibold text-red-700 mb-1">환불건수</div>
                  <div className="text-lg font-bold text-red-600">{refundedOrders.length}건</div>
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
                  <div className="font-semibold text-purple-700 mb-1">순수익</div>
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
                    <tr className="border-b-2 border-gray-300 bg-gray-50">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">주문번호</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">고객명</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">주문일</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">주문내역</th>
                      <th className="text-right py-3 px-4 font-semibold text-blue-700 bg-blue-50 text-sm">매출정보</th>
                      <th className="text-right py-3 px-4 font-semibold text-green-700 bg-green-50 text-sm">입금정보</th>
                      <th className="text-right py-3 px-4 font-semibold text-red-700 bg-red-50 text-sm">할인/미입금</th>
                      <th className="text-right py-3 px-4 font-semibold text-purple-700 bg-purple-50 text-sm">원가분석</th>
                      <th className="text-right py-3 px-4 font-semibold text-emerald-700 bg-emerald-50 text-sm">순수익</th>
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
                        <tr key={order.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="py-4 px-4 font-semibold text-gray-900 text-sm">#{order.orderNumber}</td>
                          <td className="py-4 px-4 font-medium text-gray-900 text-sm">{order.customerName}</td>
                          <td className="py-4 px-4 text-sm text-gray-700">
                            <div className="font-medium">{new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
                            <div className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td className="py-4 px-4 text-sm">
                            <div className="space-y-1">
                              {order.smallBoxQuantity > 0 && (
                                <div className="font-medium text-gray-800">한과1호×{order.smallBoxQuantity}개</div>
                              )}
                              {order.largeBoxQuantity > 0 && (
                                <div className="font-medium text-gray-800">한과2호×{order.largeBoxQuantity}개</div>
                              )}
                              {order.wrappingQuantity > 0 && (
                                <div className="font-medium text-gray-800">보자기×{order.wrappingQuantity}개</div>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right text-sm font-medium bg-blue-50 border-l-2 border-blue-300">
                            <div className="text-blue-700 font-semibold">
                              {formatPrice(order.totalAmount)}
                            </div>
                            <div className="text-xs text-blue-600 mt-1">
                              주문금액
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right text-sm font-medium bg-green-50 border-l-2 border-green-300">
                            <div className="text-green-700 font-semibold">
                              {order.actualPaidAmount ? formatPrice(order.actualPaidAmount) : formatPrice(order.totalAmount)}
                            </div>
                            <div className="text-xs text-green-600 mt-1">
                              실제입금액
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right text-sm bg-red-50 border-l-2 border-red-300">
                            {discountAmount > 0 ? (
                              <div>
                                <div className="text-blue-700 font-semibold">
                                  {formatPrice(discountAmount)}
                                </div>
                                <div className="text-xs text-blue-600 mt-1">
                                  할인금액
                                </div>
                              </div>
                            ) : unpaidAmount > 0 ? (
                              <div>
                                <div className="text-red-700 font-semibold">
                                  {formatPrice(unpaidAmount)}
                                </div>
                                <div className="text-xs text-red-600 mt-1">
                                  미입금액
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-gray-500 font-semibold">-</div>
                                <div className="text-xs text-gray-400 mt-1">완납</div>
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-xs bg-purple-50 border-l-2 border-purple-300">
                            <div className="space-y-1">
                              {order.smallBoxQuantity > 0 && (
                                <div className="text-purple-600">
                                  한과1호: {formatPrice(smallBoxesCost)}
                                </div>
                              )}
                              {order.largeBoxQuantity > 0 && (
                                <div className="text-purple-600">
                                  한과2호: {formatPrice(largeBoxesCost)}
                                </div>
                              )}
                              {order.wrappingQuantity > 0 && (
                                <div className="text-purple-600">
                                  보자기: {formatPrice(wrappingCost)}
                                </div>
                              )}
                              {shippingFee > 0 && (
                                <div className="text-purple-600">
                                  배송비: {formatPrice(shippingFee)}
                                </div>
                              )}
                              <div className="font-semibold text-purple-700 border-t border-purple-300 pt-1 mt-2">
                                총원가: {formatPrice(totalCost)}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right text-sm bg-emerald-50 border-l-2 border-emerald-300">
                            {(() => {
                              // 실제수익 = 주문가격 - 원가 - 배송비 - 할인/미입금
                              const actualProfit = order.totalAmount - totalCost - shippingFee - discountAmount - unpaidAmount;
                              return (
                                <div>
                                  <div className={`font-bold text-lg ${actualProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                                    {formatPrice(actualProfit)}
                                  </div>
                                  <div className="text-xs text-emerald-600 mt-1">
                                    순수익
                                  </div>
                                </div>
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
          <Card key={order.id} className={`border-red-200 ${
            selectedTrashItems.has(order.id) ? 'bg-red-100 border-red-300' : 
            order.status === 'seller_shipped' ? 'bg-blue-50 border-blue-200' : 
            'bg-red-50'
          }`}>
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
    setSellerShippedFilter('all');
    setSortOrder('latest');
  };

  // Render filter UI
  const renderOrderFilters = () => (
    <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
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
            onChange={(e) => {
              const newStatus = e.target.value;
              setOrderStatusFilter(newStatus);
              
              // 발송대기를 선택하면 자동으로 발송대기 탭으로 이동
              if (newStatus === 'seller_shipped') {
                setActiveTab('seller_shipped');
              }
            }}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm h-8"
          >
            <option value="all">전체</option>
            <option value="scheduled">발송주문</option>
            <option value="delivered">발송완료</option>
          </select>
        </div>

        {/* Seller Shipped Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">판매자발송</label>
          <select
            value={sellerShippedFilter}
            onChange={(e) => setSellerShippedFilter(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm h-8"
          >
            <option value="all">전체</option>
            <option value="shipped">발송완료</option>
            <option value="not_shipped">미발송</option>
          </select>
        </div>
      </div>
      
      {/* Sort Options */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">정렬:</span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={sortOrder === 'latest' ? 'default' : 'outline'}
                onClick={() => setSortOrder('latest')}
                className="h-7 text-xs"
              >
                최신순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'oldest' ? 'default' : 'outline'}
                onClick={() => setSortOrder('oldest')}
                className="h-7 text-xs"
              >
                오래된순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'delivery-date' ? 'default' : 'outline'}
                onClick={() => setSortOrder('delivery-date')}
                className="h-7 text-xs"
              >
                발송일순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'scheduled-date' ? 'default' : 'outline'}
                onClick={() => setSortOrder('scheduled-date')}
                className="h-7 text-xs"
              >
                예약발송일순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'order-status' ? 'default' : 'outline'}
                onClick={() => setSortOrder('order-status')}
                className="h-7 text-xs"
              >
                주문상태순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'payment-status' ? 'default' : 'outline'}
                onClick={() => setSortOrder('payment-status')}
                className="h-7 text-xs"
              >
                입금상태순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'order-number' ? 'default' : 'outline'}
                onClick={() => setSortOrder('order-number')}
                className="h-7 text-xs"
              >
                주문접수순
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
        <div className="hidden lg:block bg-white rounded-lg border">
          <table className="w-full admin-table">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="col-checkbox text-center">
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
                    className="rounded border-gray-300 w-4 h-4"
                    title="삭제용 선택"
                  />
                </th>

                <th className="col-order-number text-left">주문번호</th>
                <th className="col-scheduled-date text-left">예약발송</th>
                <th className="col-customer-name text-left">주문자</th>
                <th className="col-customer-name text-left">예금자</th>
                <th className="col-order-details text-left">주문내역</th>
                <th className="col-phone text-left">연락처</th>
                <th className="col-address text-left">배송주소</th>
                <th className="col-address text-left">메모</th>
                <th className="col-amount text-center text-blue-700">매출</th>
                <th className="col-amount text-center text-green-700">실입금</th>
                <th className="col-amount text-center text-red-700">할인/미입금</th>
                <th className="col-status text-center">입금상태</th>
                <th className="col-status text-center">주문상태</th>
                <th className="col-status text-center">판매자발송</th>
                <th className="col-actions text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {ordersList.map((order: Order) => {
                const StatusIcon = statusIcons[order.status as keyof typeof statusIcons];
                return (
                  <tr key={order.id} className={`border-b border-gray-100 ${
                    order.paymentStatus === 'pending' ? 'bg-red-100 hover:bg-red-100' : 
                    order.status === 'seller_shipped' ? 'bg-blue-50 hover:bg-blue-100' : 
                    'hover:bg-gray-50'
                  }`} data-order-id={order.id}>
                    <td className="col-checkbox text-center">
                      <input
                        type="checkbox"
                        checked={selectedOrderItems.has(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        className="rounded border-gray-300 w-4 h-4"
                        title="삭제용 선택"
                      />
                    </td>

                    <td className="col-order-number">
                      <div className="font-semibold text-gray-900 no-wrap">#{order.orderNumber}</div>
                      <div className="text-xs text-gray-500 no-wrap">
                        {new Date(order.createdAt).toLocaleDateString('ko-KR', { 
                          year: '2-digit', 
                          month: '2-digit', 
                          day: '2-digit' 
                        })}
                      </div>
                      <div className="text-xs text-gray-400 no-wrap">
                        {new Date(order.createdAt).toLocaleTimeString('ko-KR', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: false
                        })}시
                      </div>
                    </td>
                    <td className="col-scheduled-date">
                      {order.scheduledDate ? (
                        <div 
                          className="text-xs text-red-600 font-bold cursor-pointer hover:bg-red-50 px-1 py-1 rounded border border-transparent hover:border-red-200"
                          onClick={() => {
                            const scheduledDatePicker = document.querySelector(`[data-order-id="${order.id}"] .scheduled-date-trigger`);
                            if (scheduledDatePicker) {
                              (scheduledDatePicker as HTMLElement).click();
                            }
                          }}
                          title="클릭하여 예약발송일 수정"
                          style={{ whiteSpace: 'nowrap', minWidth: '70px' }}
                        >
                          {new Date(order.scheduledDate).toLocaleDateString('ko-KR', { 
                            year: '2-digit',
                            month: '2-digit', 
                            day: '2-digit' 
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400" style={{ whiteSpace: 'nowrap' }}>-</div>
                      )}
                    </td>

                    <td className="col-customer-name">
                      <div className="font-medium text-xs no-wrap">
                        {order.recipientName && order.recipientName !== order.customerName ? 
                          order.recipientName : order.customerName}
                      </div>
                    </td>
                    <td className="col-customer-name">
                      <div className="text-xs no-wrap">
                        {order.isDifferentDepositor && order.depositorName ? (
                          <span className="text-red-600">{order.depositorName}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="col-order-details">
                      <div className="text-xs space-y-0.5">
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
                    <td className="col-phone">
                      <div className="text-xs no-wrap">{order.customerPhone}</div>
                    </td>
                    <td className="col-address">
                      <Dialog>
                        <DialogTrigger asChild>
                          <div>
                            <div 
                              className="text-xs text-gray-900 cursor-pointer hover:bg-blue-50 px-1 py-1 rounded border border-transparent hover:border-blue-200 no-wrap"
                              title="클릭하여 전체 주소 보기"
                            >
                              {order.address1.length > 12 ? `${order.address1.substring(0, 12)}...` : order.address1}
                            </div>
                            {checkRemoteArea(order.address1) && (
                              <div className="text-xs text-red-600 font-bold">배송비추가</div>
                            )}
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
                    <td className="col-address">
                      <div className="text-xs text-gray-600 no-wrap">{order.specialRequests ? 
                        (order.specialRequests.length > 8 ? `${order.specialRequests.substring(0, 8)}...` : order.specialRequests) 
                        : '-'}</div>
                    </td>
                    {/* 매출 */}
                    <td className="col-amount text-center">
                      <div className="text-xs font-medium text-blue-700 no-wrap">
                        {formatPrice(order.totalAmount)}
                      </div>
                    </td>
                    {/* 실입금 */}
                    <td className="col-amount text-center">
                      {order.paymentStatus === 'confirmed' || order.paymentStatus === 'partial' ? (
                        <div
                          className="text-xs font-medium text-green-700 cursor-pointer hover:bg-green-50 px-1 py-1 rounded border border-transparent hover:border-green-200 no-wrap"
                          onClick={() => {
                            const currentAmount = order.actualPaidAmount || order.totalAmount;
                            const newAmount = prompt('실제 입금금액을 입력하세요:', currentAmount.toString());
                            if (newAmount && !isNaN(Number(newAmount))) {
                              handlePaymentStatusChange(order.id, order.paymentStatus, Number(newAmount));
                            }
                          }}
                          title="클릭하여 실제 입금금액 수정"
                        >
                          {formatPrice(order.actualPaidAmount || order.totalAmount)}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">-</div>
                      )}
                    </td>
                    {/* 할인/미입금 */}
                    <td className="col-amount text-center">
                      <div className="text-xs no-wrap">
                        {order.discountAmount && order.discountAmount > 0 ? (
                          <span className="text-blue-600 font-medium">
                            -{formatPrice(Math.abs(order.discountAmount))}
                          </span>
                        ) : order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && (order.totalAmount - order.actualPaidAmount) > 0 ? (
                          <span className="text-red-600 font-medium">
                            {formatPrice(Math.max(0, order.totalAmount - order.actualPaidAmount))}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="col-status text-center">
                      <Select
                        key={`payment-${order.id}-${order.paymentStatus}`}
                        value={
                          order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && order.paymentStatus === 'confirmed'
                            ? 'partial'
                            : order.paymentStatus || 'pending'
                        }
                        onValueChange={(newPaymentStatus) => {
                          setTimeout(() => {
                            handlePaymentStatusChange(order.id, newPaymentStatus);
                          }, 0);
                        }}
                        disabled={updatePaymentMutation.isPending}
                      >
                        <SelectTrigger className="w-24 h-6 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">입금대기</SelectItem>
                          <SelectItem value="confirmed">입금완료</SelectItem>
                          <SelectItem value="partial">부분결제</SelectItem>
                          <SelectItem value="refunded">환불</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="col-status text-center">
                      <Select
                        key={`status-${order.id}-${order.status}`}
                        value={order.status}
                        onValueChange={(newStatus) => {
                          setTimeout(() => {
                            handleStatusChange(order.id, newStatus);
                          }, 0);
                        }}
                        disabled={updateStatusMutation.isPending}
                      >
                        <SelectTrigger className="w-24 h-6 text-xs">
                          <SelectValue>
                            {statusLabels[order.status as keyof typeof statusLabels]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">주문접수</SelectItem>
                          <SelectItem value="seller_shipped">발송대기</SelectItem>
                          <SelectItem value="scheduled">발송주문</SelectItem>
                          <SelectItem value="delivered" disabled={!order.sellerShipped}>발송완료</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="col-status text-center">
                      <div className="text-xs no-wrap">
                        {order.sellerShipped ? (
                          <div className="text-green-600 font-medium">
                            완료
                            {order.sellerShippedDate && (
                              <div 
                                className="text-blue-600 cursor-pointer hover:bg-blue-50 px-1 py-1 rounded no-wrap"
                                onClick={() => {
                                  const sellerShippedDatePicker = document.querySelector(`[data-order-id="${order.id}"] .seller-shipped-date-trigger`);
                                  if (sellerShippedDatePicker) {
                                    (sellerShippedDatePicker as HTMLElement).click();
                                  }
                                }}
                                title="클릭하여 판매자발송일 수정"
                              >
                                {new Date(order.sellerShippedDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-400">미처리</div>
                        )}
                      </div>
                    </td>
                    <td className="col-actions text-center">
                      <div className="flex flex-col gap-1 items-center">
                        <SmsDialog order={order}>
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2">
                            SMS
                          </Button>
                        </SmsDialog>
                        <div className="hidden" data-order-id={order.id}>
                          <DeliveredDatePicker order={order} />
                          <SellerShippedDatePicker order={order} />
                          <ScheduledDatePicker order={order} />
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteOrder(order.id)}
                          disabled={deleteOrderMutation.isPending}
                          className="h-6 text-xs px-2"
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
              <Card key={order.id} className={`border ${
                order.paymentStatus === 'pending' ? 'border-red-400 bg-red-100' : 
                order.status === 'seller_shipped' ? 'border-blue-300 bg-blue-50' : 
                'border-gray-200'
              }`}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedOrderItems.has(order.id)}
                          onChange={() => toggleOrderSelection(order.id)}
                          className="rounded border-gray-300 mt-1"
                          title="삭제용 선택"
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
                      {checkRemoteArea(order.address1) && (
                        <div className="text-xs text-red-600 font-bold mt-1">배송비추가</div>
                      )}
                      {order.recipientAddress1 && (
                        <>
                          <div className="text-gray-500 mb-1 mt-2">받는분 주소</div>
                          <div className="text-blue-600">
                            [{order.recipientZipCode}] {order.recipientAddress1} {order.recipientAddress2}
                          </div>
                          {checkRemoteArea(order.recipientAddress1) && (
                            <div className="text-xs text-red-600 font-bold mt-1">배송비추가</div>
                          )}
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
                        <div className="text-gray-500 mb-2">매출정보</div>
                        <div className="text-xs space-y-1">
                          <div className="text-blue-700 font-medium">
                            매출: {formatPrice(order.totalAmount)}
                          </div>
                          <div className="text-green-700 font-medium">
                            실입금: 
                            {order.paymentStatus === 'confirmed' || order.paymentStatus === 'partial' ? (
                              <span
                                className="cursor-pointer hover:bg-green-50 px-1 py-1 rounded border border-transparent hover:border-green-200 ml-1"
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
                              <span className="text-blue-600 font-medium">
                                할인: -{formatPrice(Math.abs(order.discountAmount))}
                              </span>
                            ) : order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && (order.totalAmount - order.actualPaidAmount) > 0 ? (
                              <span className="text-red-600 font-medium">
                                미입금: {formatPrice(Math.max(0, order.totalAmount - order.actualPaidAmount))}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
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
                            <SelectItem value="seller_shipped">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-orange-500" />
                                <span>발송대기</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="scheduled">
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-blue-500" />
                                <span>발송주문</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="delivered" disabled={!order.sellerShipped}>
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span>발송완료</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-2">예약발송일</div>
                        {order.scheduledDate ? (
                          <div 
                            className="text-xs text-blue-600 font-medium cursor-pointer hover:bg-blue-50 px-2 py-1 rounded border border-transparent hover:border-blue-200"
                            onClick={() => {
                              const scheduledDatePicker = document.querySelector(`[data-order-id="${order.id}"] .scheduled-date-trigger`);
                              if (scheduledDatePicker) {
                                (scheduledDatePicker as HTMLElement).click();
                              }
                            }}
                            title="클릭하여 예약발송일 수정"
                          >
                            {new Date(order.scheduledDate).toLocaleDateString('ko-KR')}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 text-center py-1">-</span>
                        )}
                      </div>

                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex flex-col gap-3">
                        <SmsDialog order={order}>
                          <Button size="sm" variant="outline" className="flex items-center gap-1 w-full">
                            <MessageSquare className="h-3 w-3" />
                            SMS 발송
                          </Button>
                        </SmsDialog>
                        <ScheduledDatePicker order={order} />
                        
                        {/* 판매자발송 관리 */}
                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedShippingItems.has(order.id)}
                              onChange={() => toggleShippingSelection(order.id)}
                              className="rounded border-blue-300"
                              disabled={order.sellerShipped || false}
                              title={order.sellerShipped ? "이미 발송됨" : "발송용 선택"}
                            />
                            <span className="text-sm font-medium text-blue-700">발송 선택</span>
                          </div>
                          {!order.sellerShipped && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 flex-1"
                              onClick={() => handleSellerShipped(order.id)}
                            >
                              <Truck className="h-3 w-3 mr-1" />
                              발송하기
                            </Button>
                          )}
                          {order.sellerShipped && (
                            <div className="flex-1 text-sm text-green-600 font-medium">
                              ✅ 발송완료
                              {order.sellerShippedDate && (
                                <div className="text-xs text-gray-500">
                                  {new Date(order.sellerShippedDate).toLocaleDateString('ko-KR')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="hidden" data-order-id={order.id}>
                          <DeliveredDatePicker order={order} />
                          <SellerShippedDatePicker order={order} />
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

  // Seller shipped mutation
  const updateSellerShippedMutation = useMutation({
    mutationFn: (orderIds: number[]) => api.orders.updateSellerShipped(orderIds),
    onSuccess: async (updatedOrder, orderIds) => {
      // First update seller shipped status
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      
      // Then automatically update order status to delivered for each order
      if (Array.isArray(orderIds)) {
        orderIds.forEach(orderId => {
          updateStatusMutation.mutate({ id: orderId, status: 'delivered' });
        });
      }
      
      toast({
        title: "판매자 발송 완료",
        description: "판매자 발송이 완료되고 주문상태가 발송완료로 변경되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "업데이트 실패",
        description: "판매자 발송 상태 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const bulkSellerShippedMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      return api.patch('/api/orders/seller-shipped', { orderIds });
    },
    onSuccess: (data, orderIds) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setSelectedShippingItems(new Set());
      toast({
        title: "일괄 발송 완료",
        description: `${orderIds.length}개 주문이 발송완료로 변경되었습니다.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "일괄 발송 실패",
        description: error.message || "일괄 발송 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, paymentStatus, actualPaidAmount, discountAmount }: { id: number; paymentStatus: string; actualPaidAmount?: number; discountAmount?: number }) => 
      api.orders.updatePaymentStatus(id, paymentStatus, actualPaidAmount, discountAmount),
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
        discountAmount: 0 // Default value
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

  const handlePaymentStatusChange = (orderId: number, newPaymentStatus: string, actualAmount?: number, discountAmount?: number) => {
    if (actualAmount !== undefined) {
      // 실제 입금 금액이 제공된 경우 바로 업데이트
      updatePaymentMutation.mutate({ 
        id: orderId, 
        paymentStatus: newPaymentStatus,
        actualPaidAmount: actualAmount,
        discountAmount: discountAmount
      });
    } else if (newPaymentStatus === 'confirmed') {
      // 입금완료 선택시 PaymentDetailsDialog 열기
      const order = orders.find((o: Order) => o.id === orderId);
      if (order) {
        setSelectedOrderForPayment(order);
        setShowPaymentDetailsDialog(true);
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

  const handleSellerShipped = (orderId: number) => {
    updateSellerShippedMutation.mutate([orderId]);
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
      seller_shipped: 0,
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
      <AdminHeader 
        handleExcelDownload={handleExcelDownload}
        setActiveTab={setActiveTab}
        activeTab={activeTab}
        costSettingsDialog={<CostSettingsDialog />}
        passwordChangeDialog={<PasswordChangeDialog />}
      />

      <div className="container mx-auto p-2 sm:p-4 md:p-6">



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
                {/* 모바일에서는 2줄로 나누어 표시 */}
                <div className="block md:hidden">
                  <TabsList className="grid w-full grid-cols-4 mb-2">
                    <TabsTrigger value="all" className="text-xs px-1">전체 ({allOrders.length})</TabsTrigger>
                    <TabsTrigger value="pending" className="text-xs px-1">주문접수 ({pendingOrders.length})</TabsTrigger>
                    <TabsTrigger value="seller_shipped" className="text-xs px-1">발송대기 ({sellerShippedOrders.length})</TabsTrigger>
                    <TabsTrigger value="scheduled" className="text-xs px-1">발송주문 ({scheduledOrders.length})</TabsTrigger>
                  </TabsList>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="delivered" className="text-xs px-1">발송완료 ({deliveredOrders.length})</TabsTrigger>
                    <TabsTrigger value="refunded" className="text-red-600 text-xs px-1">
                      환불내역 ({refundedOrders.length})
                    </TabsTrigger>
                    <TabsTrigger value="revenue" className="text-purple-600 text-xs px-1">
                      <DollarSign className="h-3 w-3 mr-1" />
                      매출관리
                    </TabsTrigger>
                    <TabsTrigger value="trash" className="text-red-600 text-xs px-1">
                      <Trash2 className="h-3 w-3 mr-1" />
                      휴지통 ({deletedOrders.length})
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                {/* 데스크톱에서는 한 줄로 표시 */}
                <TabsList className="hidden md:grid w-full grid-cols-8">
                  <TabsTrigger value="all">전체 ({allOrders.length})</TabsTrigger>
                  <TabsTrigger value="pending">주문접수 ({pendingOrders.length})</TabsTrigger>
                  <TabsTrigger value="seller_shipped">발송대기 ({sellerShippedOrders.length})</TabsTrigger>
                  <TabsTrigger value="scheduled">발송주문 ({scheduledOrders.length})</TabsTrigger>
                  <TabsTrigger value="delivered">발송완료 ({deliveredOrders.length})</TabsTrigger>
                  <TabsTrigger value="refunded" className="text-red-600">
                    환불내역 ({refundedOrders.length})
                  </TabsTrigger>
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
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-600">
                      총 {allOrders.length}개 주문
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportToExcel(allOrders, "전체주문목록")}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      엑셀 다운로드
                    </Button>
                  </div>
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
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-600">
                      총 {pendingOrders.length}개 주문접수 주문
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportToExcel(pendingOrders, "주문접수목록")}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      엑셀 다운로드
                    </Button>
                  </div>
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
                
                <TabsContent value="seller_shipped" className="mt-6">
                  {renderOrderFilters()}
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-600">
                      총 {sellerShippedOrders.length}개 발송대기 주문
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportToExcel(sellerShippedOrders, "발송대기목록")}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      엑셀 다운로드
                    </Button>
                  </div>
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
                  {renderOrdersList(sellerShippedOrders)}
                </TabsContent>
                
                <TabsContent value="scheduled" className="mt-6">
                  {renderOrderFilters()}
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-600">
                      총 {scheduledOrders.length}개 발송주문
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportToExcel(scheduledOrders, "발송주문목록")}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      엑셀 다운로드
                    </Button>
                  </div>
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
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-600">
                      총 {deliveredOrders.length}개 발송완료 주문
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportToExcel(deliveredOrders, "발송완료목록")}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      엑셀 다운로드
                    </Button>
                  </div>
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

                <TabsContent value="refunded" className="mt-6">
                  {renderOrderFilters()}
                  {refundedOrders.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      환불된 주문이 없습니다.
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-sm text-gray-600">
                          총 {refundedOrders.length}개 환불 주문
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => exportToExcel(refundedOrders, "환불내역목록")}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          엑셀 다운로드
                        </Button>
                      </div>
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
                      {renderOrdersList(refundedOrders)}
                    </>
                  )}
                </TabsContent>
                
                <TabsContent value="revenue" className="mt-6">
                  {renderRevenueReport()}
                </TabsContent>
                
                <TabsContent value="customers" className="mt-6">
                  <CustomerManagement />
                </TabsContent>
                
                <TabsContent value="users" className="mt-6">
                  <UserManagement />
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
      
      {/* Payment Details Dialog - for confirmed payment */}
      {selectedOrderForPayment && (
        <PaymentDetailsDialog 
          order={selectedOrderForPayment} 
          open={showPaymentDetailsDialog}
          setOpen={setShowPaymentDetailsDialog}
          onUpdate={(orderId, paymentStatus, actualPaidAmount, discountAmount) => {
            handlePaymentStatusChange(orderId, paymentStatus, actualPaidAmount, discountAmount);
            setSelectedOrderForPayment(null);
            setShowPaymentDetailsDialog(false);
          }} 
        />
      )}
    </div>
  );
}
