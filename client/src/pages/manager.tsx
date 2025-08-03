import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { ArrowLeft, Settings, Package, Truck, CheckCircle, Clock, Eye, LogOut, AlertCircle, Download, Calendar, Trash2, Edit, Cog, RefreshCw, X, Users, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { SmsDialog } from "@/components/sms-dialog";
import ScheduledDatePicker from "@/components/scheduled-date-picker";
import { DeliveredDatePicker } from "@/components/delivered-date-picker";
import { CustomerManagement } from "@/components/customer-management";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Order } from "@shared/schema";

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

function AdminSettingsDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: settings } = useQuery({
    queryKey: ["/api/admin-settings"],
  });
  
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [bankInfo, setBankInfo] = useState("");
  
  useEffect(() => {
    if (settings) {
      setAdminName(settings?.adminName || "");
      setAdminPhone(settings?.adminPhone || "");
      setBankInfo(settings?.bankInfo || "");
    }
  }, [settings]);
  
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { adminName: string; adminPhone: string; bankInfo: string }) => {
      return await api.patch("/api/admin-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin-settings"] });
      toast({
        title: "설정 저장 완료",
        description: "관리자 설정이 업데이트되었습니다.",
      });
      setOpen(false);
    },
    onError: () => {
      toast({
        title: "설정 저장 실패",
        description: "설정 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    },
  });
  
  const handleSave = () => {
    updateSettingsMutation.mutate({
      adminName,
      adminPhone,
      bankInfo,
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          관리자 설정
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>관리자 설정</DialogTitle>
          <DialogDescription>
            관리자 정보와 계좌 정보를 설정합니다.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="admin-name">관리자명</Label>
            <Input
              id="admin-name"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="관리자 이름"
            />
          </div>
          
          <div>
            <Label htmlFor="admin-phone">연락처</Label>
            <Input
              id="admin-phone"
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              placeholder="010-0000-0000"
            />
          </div>
          
          <div>
            <Label htmlFor="bank-info">계좌 정보</Label>
            <Textarea
              id="bank-info"
              value={bankInfo}
              onChange={(e) => setBankInfo(e.target.value)}
              placeholder="예: 농협 123-456-789012 홍길동"
              rows={3}
            />
          </div>
        </div>
        
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={updateSettingsMutation.isPending}>
            {updateSettingsMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Manager() {
  const [activeTab, setActiveTab] = useState("orders");
  const [orderViewTab, setOrderViewTab] = useState("all"); // all, scheduled, delivered
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Filter states
  const [orderDateFilter, setOrderDateFilter] = useState<string>('all');
  const [orderStartDate, setOrderStartDate] = useState<string>('');
  const [orderEndDate, setOrderEndDate] = useState<string>('');
  const [customerNameFilter, setCustomerNameFilter] = useState<string>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('confirmed'); // Manager always sees confirmed payments only
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'delivery-date' | 'scheduled-date' | 'order-status' | 'payment-status' | 'order-number'>('latest');

  // Clear selections when switching tabs
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setSelectedOrderItems(new Set());
    setSelectedTrashItems(new Set());
  };

  // Bulk selection states
  const [selectedOrderItems, setSelectedOrderItems] = useState<Set<number>>(new Set());
  const [selectedTrashItems, setSelectedTrashItems] = useState<Set<number>>(new Set());

  // Bulk action states
  const [showBulkActionsDialog, setShowBulkActionsDialog] = useState(false);
  const [showBulkSMSDialog, setShowBulkSMSDialog] = useState(false);
  const [bulkSMSMessage, setBulkSMSMessage] = useState("");

  const { data: allOrders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    refetchInterval: 5000,
  });

  // Filter orders to show only confirmed payments with scheduled or delivered status for manager
  const orders = allOrders.filter(order => 
    order.paymentStatus === 'confirmed' && (order.status === 'scheduled' || order.status === 'delivered')
  );

  const { data: deletedOrders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders/trash"],
  });

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

    // Payment status filter - Manager only sees confirmed payments, but we still apply filter for consistency
    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(order => order.paymentStatus === paymentStatusFilter);
    }

    // Order status filter
    if (orderStatusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === orderStatusFilter);
    }

    return filtered;
  };

  // Sort orders function
  const sortOrders = (ordersList: Order[]) => {
    const sorted = [...ordersList];
    
    if (sortOrder === 'latest') {
      // Latest first
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortOrder === 'oldest') {
      // Oldest first
      return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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
    } else if (sortOrder === 'scheduled-date') {
      // Sort by scheduled date: orders without scheduled date first, then by scheduled date (earliest first)
      return sorted.sort((a, b) => {
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
      return sorted.sort((a, b) => {
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
      return sorted.sort((a, b) => {
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
      return sorted.sort((a, b) => {
        const aNum = parseInt(a.orderNumber.split('-')[1] || '0');
        const bNum = parseInt(b.orderNumber.split('-')[1] || '0');
        return aNum - bNum;
      });
    }
    
    return sorted;
  };

  // Apply filters and sorting
  const filteredOrders = getFilteredOrdersList(orders);
  const sortedOrders = sortOrders(filteredOrders);
  
  // Get all confirmed payment orders with scheduled or delivered status for tab filtering
  const allConfirmedOrders = allOrders.filter(order => 
    order.paymentStatus === 'confirmed' && (order.status === 'scheduled' || order.status === 'delivered')
  );
  
  // Filter by tab selection
  const getOrdersByTab = () => {
    switch (orderViewTab) {
      case 'scheduled':
        return allConfirmedOrders.filter(order => order.status === 'scheduled');
      case 'delivered':
        return allConfirmedOrders.filter(order => order.status === 'delivered');
      default:
        return allConfirmedOrders;
    }
  };
  
  const tabFilteredOrders = getOrdersByTab();
  const tabFilteredAndSorted = getFilteredOrdersList(tabFilteredOrders);
  const tabSortedOrders = sortOrders(tabFilteredAndSorted);
  
  // Manager-specific sorting: move scheduled orders to bottom for 'all' tab
  const managerSortedOrders = orderViewTab === 'all' 
    ? [...tabSortedOrders].sort((a, b) => {
        if (a.status === 'scheduled' && b.status !== 'scheduled') return 1;
        if (a.status !== 'scheduled' && b.status === 'scheduled') return -1;
        return 0;
      })
    : tabSortedOrders;

  // Excel export function
  const exportToExcel = () => {
    const exportData = managerSortedOrders.map(order => ({
      '주문번호': order.orderNumber,
      '주문자': order.customerName,
      '연락처': order.customerPhone,
      '주문내용': [
        order.smallBoxQuantity > 0 ? `한과1호×${order.smallBoxQuantity}개` : '',
        order.largeBoxQuantity > 0 ? `한과2호×${order.largeBoxQuantity}개` : '',
        order.wrappingQuantity > 0 ? `보자기×${order.wrappingQuantity}개` : ''
      ].filter(Boolean).join(', '),
      '배송주소': `${order.address1} ${order.address2 || ''}`.trim(),
      '주문상태': statusLabels[order.status as keyof typeof statusLabels],

      '발송일': order.deliveredDate ? new Date(order.deliveredDate).toLocaleDateString('ko-KR') : '-',
      '판매자발송': order.sellerShipped ? '발송완료' : '미발송',
      '판매자발송일': order.sellerShippedDate ? new Date(order.sellerShippedDate).toLocaleDateString('ko-KR') : '-',
      '주문일시': new Date(order.createdAt).toLocaleString('ko-KR')
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '매니저 주문목록');
    
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `매니저_주문목록_${today}.xlsx`);
    
    toast({
      title: "엑셀 내보내기 완료",
      description: "주문 목록이 엑셀 파일로 저장되었습니다.",
    });
  };

  // SMS mutation
  const sendSMSMutation = useMutation({
    mutationFn: ({ phone, message }: { phone: string; message: string }) =>
      api.post("/api/sms/send", { phone, message }),
    onSuccess: () => {
      toast({
        title: "SMS 발송 완료",
        description: "메시지가 성공적으로 발송되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "SMS 발송 실패",
        description: "메시지 발송에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Bulk SMS mutation
  const sendBulkSMSMutation = useMutation({
    mutationFn: ({ phones, message }: { phones: string[]; message: string }) =>
      api.post("/api/sms/bulk-send", { phones, message }),
    onSuccess: () => {
      toast({
        title: "일괄 SMS 발송 완료",
        description: "선택된 고객들에게 메시지가 발송되었습니다.",
      });
      setShowBulkSMSDialog(false);
      setBulkSMSMessage("");
      setSelectedOrderItems(new Set());
    },
    onError: () => {
      toast({
        title: "일괄 SMS 발송 실패",
        description: "메시지 발송에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Order status mutations
  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/api/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "주문 상태 변경 완료",
        description: "주문 상태가 성공적으로 변경되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "주문 상태 변경 실패",
        description: "주문 상태 변경에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const updateScheduledDateMutation = useMutation({
    mutationFn: ({ id, scheduledDate }: { id: number; scheduledDate: string | null }) =>
      api.patch(`/api/orders/${id}/scheduled-date`, { scheduledDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "예약 발송일 변경 완료",
        description: "예약 발송일이 성공적으로 변경되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "예약 발송일 변경 실패",
        description: "예약 발송일 변경에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const updateDeliveredDateMutation = useMutation({
    mutationFn: ({ id, deliveredDate }: { id: number; deliveredDate: string | null }) =>
      api.patch(`/api/orders/${id}/delivered-date`, { deliveredDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "발송일 변경 완료",
        description: "발송일이 성공적으로 변경되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "발송일 변경 실패",
        description: "발송일 변경에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const updateSellerShippedMutation = useMutation({
    mutationFn: ({ id, sellerShipped }: { id: number; sellerShipped: boolean }) =>
      api.patch(`/api/orders/${id}/seller-shipped`, { 
        sellerShipped, 
        sellerShippedDate: sellerShipped ? new Date().toISOString() : null 
      }),
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      
      // If seller shipped is true, also update order status to delivered
      if (updatedOrder.sellerShipped) {
        updateOrderStatusMutation.mutate({ id: updatedOrder.id, status: 'delivered' });
      }
      
      toast({
        title: "판매자 발송 완료",
        description: "판매자 발송이 완료되어 발송완료 상태로 변경되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "판매자 발송 상태 변경 실패",
        description: "판매자 발송 상태 변경에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Logout function
  const logout = () => {
    // Clear any stored authentication data
    localStorage.removeItem('manager-auth');
    // Redirect to login
    setLocation('/manager-login');
  };

  // Bulk selection functions
  const toggleOrderSelection = (orderId: number) => {
    const newSelected = new Set(selectedOrderItems);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrderItems(newSelected);
  };

  const selectAllOrders = (ordersList: Order[]) => {
    const allIds = new Set(ordersList.map(order => order.id));
    setSelectedOrderItems(allIds);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setOrderDateFilter('all');
    setOrderStartDate('');
    setOrderEndDate('');
    setCustomerNameFilter('');
    setPaymentStatusFilter('confirmed'); // Manager always sees confirmed payments only
    setOrderStatusFilter('all');
    setSortOrder('latest');
  };

  // Render filter UI
  const renderOrderFilters = () => (
    <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
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

        {/* Payment Status - Hidden for Manager */}
        <div style={{ display: 'none' }}>
          <label className="block text-sm font-medium text-gray-700 mb-1">입금상태</label>
          <select
            value="confirmed"
            disabled
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm h-8"
          >
            <option value="confirmed">입금완료</option>
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
              {orderViewTab === 'all' ? '전체' : 
               orderViewTab === 'scheduled' ? '발송주문' : '발송완료'}: <span className="font-medium text-gray-900">{managerSortedOrders.length}건</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={exportToExcel}
              className="h-7 text-xs"
            >
              <FileSpreadsheet className="h-3 w-3 mr-1" />
              엑셀 내보내기
            </Button>
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
                <th className="text-left py-2 px-2 font-medium text-gray-700 text-xs">주문내역</th>
                <th className="text-left py-2 px-2 font-medium text-gray-700 text-xs">연락처</th>
                <th className="text-left py-2 px-2 font-medium text-gray-700 text-xs">배송주소</th>
                <th className="text-center py-2 px-2 font-medium text-gray-700 text-xs">입금상태</th>
                <th className="text-center py-2 px-2 font-medium text-gray-700 text-xs">주문상태</th>
                <th className="text-center py-2 px-2 font-medium text-gray-700 text-xs">발송일</th>
                <th className="text-center py-2 px-2 font-medium text-gray-700 text-xs">판매자발송</th>
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

                    </td>
                    <td className="py-2 px-2">
                      <div className="font-medium text-gray-900 text-xs">{order.customerName}</div>
                      {order.recipientName && order.recipientName !== order.customerName && (
                        <div className="text-xs text-blue-600">받는분: {order.recipientName}</div>
                      )}
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
                          <Button variant="ghost" size="sm" className="p-0 h-auto text-xs text-left justify-start max-w-[150px] truncate">
                            {order.address1} {order.address2}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>주문 #{order.orderNumber} 배송 주소</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-2">
                            <div>
                              <strong>우편번호:</strong> {order.zipCode}
                            </div>
                            <div>
                              <strong>주소:</strong> {order.address1}
                            </div>
                            <div>
                              <strong>상세주소:</strong> {order.address2}
                            </div>

                          </div>
                        </DialogContent>
                      </Dialog>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        order.paymentStatus === 'confirmed' 
                          ? 'bg-green-100 text-green-800' 
                          : order.paymentStatus === 'partial'
                          ? 'bg-yellow-100 text-yellow-800'
                          : order.paymentStatus === 'refunded'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {order.paymentStatus === 'confirmed' ? '입금완료' :
                         order.paymentStatus === 'partial' ? '부분결제' :
                         order.paymentStatus === 'refunded' ? '환불' : '입금대기'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Select
                        value={order.status}
                        onValueChange={(value) => updateOrderStatusMutation.mutate({ id: order.id, status: value })}
                      >
                        <SelectTrigger className="w-24 h-7 text-xs">
                          <div className="flex items-center gap-1">
                            <StatusIcon className="h-3 w-3" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">주문접수</SelectItem>
                          <SelectItem value="scheduled">발송주문</SelectItem>
                          <SelectItem value="delivered">발송완료</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>

                    <td className="py-2 px-2 text-center">
                      <DeliveredDatePicker
                        order={order}
                        onDateChange={(date: string | null) => 
                          updateDeliveredDateMutation.mutate({ 
                            id: order.id, 
                            deliveredDate: date 
                          })
                        }
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Button
                        size="sm"
                        variant={order.sellerShipped ? "default" : "outline"}
                        className={`h-7 text-xs ${order.sellerShipped ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        onClick={() => updateSellerShippedMutation.mutate({ 
                          id: order.id, 
                          sellerShipped: !order.sellerShipped 
                        })}
                        disabled={updateSellerShippedMutation.isPending}
                      >
                        {order.sellerShipped ? '발송완료' : '발송하기'}
                      </Button>
                      {order.sellerShippedDate && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(order.sellerShippedDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <div className="flex gap-1">
                        <SmsDialog order={order}>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <span className="text-xs">SMS</span>
                          </Button>
                        </SmsDialog>
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
              <Card key={order.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-gray-900">#{order.orderNumber}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('ko-KR')} {new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedOrderItems.has(order.id)}
                      onChange={() => toggleOrderSelection(order.id)}
                      className="rounded border-gray-300"
                    />
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700">주문자: </span>
                      <span className="text-sm">{order.customerName}</span>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-gray-700">연락처: </span>
                      <span className="text-sm">{order.customerPhone}</span>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-gray-700">주문내역: </span>
                      <div className="text-sm">
                        {order.smallBoxQuantity > 0 && <div>한과1호×{order.smallBoxQuantity}개</div>}
                        {order.largeBoxQuantity > 0 && <div>한과2호×{order.largeBoxQuantity}개</div>}
                        {order.wrappingQuantity > 0 && <div className="text-eden-brown">보자기×{order.wrappingQuantity}개</div>}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-gray-700">배송주소: </span>
                      <span className="text-sm">{order.address1} {order.address2}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      order.paymentStatus === 'confirmed' 
                        ? 'bg-green-100 text-green-800' 
                        : order.paymentStatus === 'partial'
                        ? 'bg-yellow-100 text-yellow-800'
                        : order.paymentStatus === 'refunded'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {order.paymentStatus === 'confirmed' ? '입금완료' :
                       order.paymentStatus === 'partial' ? '부분결제' :
                       order.paymentStatus === 'refunded' ? '환불' : '입금대기'}
                    </span>
                    
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      order.status === 'delivered' 
                        ? 'bg-green-100 text-green-800' 
                        : order.status === 'scheduled'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusLabels[order.status as keyof typeof statusLabels]}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Select
                      value={order.status}
                      onValueChange={(value) => updateOrderStatusMutation.mutate({ id: order.id, status: value })}
                    >
                      <SelectTrigger className="flex-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">주문접수</SelectItem>
                        <SelectItem value="scheduled">발송주문</SelectItem>
                        <SelectItem value="delivered">발송완료</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <SmsDialog order={order}>
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        SMS
                      </Button>
                    </SmsDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-eden-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">에덴한과 매니저</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-blue-50 rounded-lg p-1">
                <Link href="/admin">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    관리자
                  </Button>
                </Link>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                >
                  매니저
                </Button>
              </div>
              <AdminSettingsDialog />
              <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
                <LogOut className="h-4 w-4" />
                로그아웃
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              주문 관리
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              고객 관리
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-6">
            {/* Bulk Actions */}
            {selectedOrderItems.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedOrderItems.size}개 주문이 선택되었습니다
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowBulkSMSDialog(true)}
                      className="bg-white"
                    >
                      일괄 SMS 발송
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedOrderItems(new Set())}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            {renderOrderFilters()}

            {/* Orders List */}
            <div className="space-y-4">
              {/* Order View Tabs */}
              <div className="flex items-center gap-2 border-b pb-2">
                <Button
                  variant={orderViewTab === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setOrderViewTab('all')}
                  className="h-8 text-xs"
                >
                  전체보기 ({allConfirmedOrders.length})
                </Button>
                <Button
                  variant={orderViewTab === 'scheduled' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setOrderViewTab('scheduled')}
                  className="h-8 text-xs"
                >
                  발송주문 ({allConfirmedOrders.filter(o => o.status === 'scheduled').length})
                </Button>
                <Button
                  variant={orderViewTab === 'delivered' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setOrderViewTab('delivered')}
                  className="h-8 text-xs"
                >
                  발송완료 ({allConfirmedOrders.filter(o => o.status === 'delivered').length})
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {orderViewTab === 'all' ? '전체 주문 목록' : 
                     orderViewTab === 'scheduled' ? '발송주문 목록' : '발송완료 목록'} ({managerSortedOrders.length}건)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {renderOrdersList(managerSortedOrders)}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="customers">
            <CustomerManagement />
          </TabsContent>
        </Tabs>
      </div>

      {/* Bulk SMS Dialog */}
      <Dialog open={showBulkSMSDialog} onOpenChange={setShowBulkSMSDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>일괄 SMS 발송</DialogTitle>
            <DialogDescription>
              선택된 {selectedOrderItems.size}명의 고객에게 SMS를 발송합니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk-sms-message">메시지</Label>
              <Textarea
                id="bulk-sms-message"
                value={bulkSMSMessage}
                onChange={(e) => setBulkSMSMessage(e.target.value)}
                placeholder="발송할 메시지를 입력하세요..."
                rows={4}
                maxLength={1000}
              />
              <div className="text-xs text-gray-500 mt-1">
                {bulkSMSMessage.length}/1000자
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowBulkSMSDialog(false)}>
              취소
            </Button>
            <Button 
              onClick={() => {
                const selectedOrders = managerSortedOrders.filter(order => selectedOrderItems.has(order.id));
                const phones = selectedOrders.map(order => order.customerPhone);
                sendBulkSMSMutation.mutate({ phones, message: bulkSMSMessage });
              }}
              disabled={!bulkSMSMessage.trim() || sendBulkSMSMutation.isPending}
            >
              {sendBulkSMSMutation.isPending ? "발송 중..." : "발송"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Manager;