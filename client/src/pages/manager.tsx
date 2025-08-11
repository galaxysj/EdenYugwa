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
import { ArrowLeft, Settings, Package, Truck, CheckCircle, Clock, Eye, LogOut, DollarSign, AlertCircle, Download, Calendar, Trash2, PiggyBank, Edit, Cog, RefreshCw, X, Users, Key, MessageSquare, List, Grid3x3 } from "lucide-react";
import { SmsDialog } from "@/components/sms-dialog";
import AdminHeader from "@/components/admin-header";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 상태 관리
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const [showBulkSMSDialog, setShowBulkSMSDialog] = useState(false);
  const [bulkSMSMessage, setBulkSMSMessage] = useState('');
  const [currentPage, setCurrentPage] = useState("orders");

  // 주문 확장/축소 토글
  const toggleOrderExpansion = (orderId: number) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // 필터 상태 (관리자와 동일)
  const [orderDateFilter, setOrderDateFilter] = useState("all");
  const [orderStartDate, setOrderStartDate] = useState("");
  const [orderEndDate, setOrderEndDate] = useState("");
  const [customerNameFilter, setCustomerNameFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [sellerShippedFilter, setSellerShippedFilter] = useState("all");

  // 매니저용 주문 데이터 가져오기
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["/api/manager/orders"],
  });

  const { data: adminSettings } = useQuery({
    queryKey: ["/api/admin-settings"],
  });

  // Fetch dashboard content for dynamic product names
  const { data: contentData, isLoading: isContentLoading, error: contentError } = useQuery({
    queryKey: ['/api/dashboard-content'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Convert array to object for easier access
  const dashboardContent = Array.isArray(contentData) ? contentData.reduce((acc: any, item: any) => {
    acc[item.key] = item.value;
    return acc;
  }, {}) : {};

  // Parse product names safely
  const getProductNames = () => {
    try {
      console.log('=== 상품명 로드 디버깅 ===');
      console.log('Content loading:', isContentLoading);
      console.log('Content error:', contentError);
      console.log('Raw content data:', contentData);
      console.log('Dashboard content:', dashboardContent);
      console.log('Product names raw:', dashboardContent.productNames);
      
      if (!dashboardContent.productNames) {
        console.log('No productNames found in dashboard content');
        return [];
      }
      if (typeof dashboardContent.productNames === 'string') {
        const parsed = JSON.parse(dashboardContent.productNames);
        console.log('Parsed product names:', parsed);
        return parsed;
      }
      return Array.isArray(dashboardContent.productNames) ? dashboardContent.productNames : [];
    } catch (error) {
      console.error('Error parsing product names:', error);
      return [];
    }
  };

  const productNames = getProductNames();

  // Get dynamic product name by index
  const getProductName = (index: number, fallback: string) => {
    if (productNames && productNames[index]) {
      return productNames[index].name;
    }
    return fallback;
  };

  // Dynamic product display component - 한 줄씩 표시를 위한 최적화
  const renderDynamicProducts = (order: Order) => {
    if (!order.dynamicProductQuantities) return null;
    
    try {
      const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
        ? JSON.parse(order.dynamicProductQuantities) 
        : order.dynamicProductQuantities;
      
      console.log('=== 동적 상품 디버깅 ===');
      console.log('Dynamic product data:', dynamicQty);
      console.log('Dashboard content:', dashboardContent);
      console.log('Product names parsed:', productNames);
      console.log('Product names length:', productNames?.length);
      
      return Object.entries(dynamicQty || {}).map(([index, quantity]) => {
        const productIndex = parseInt(index);
        const qty = Number(quantity);
        const productName = getProductName(productIndex, `상품${productIndex + 1}`);
        console.log(`Product index ${productIndex}: ${productName} x ${qty}`);
        console.log(`Available product at index ${productIndex}:`, productNames?.[productIndex]);
        
        return qty > 0 ? (
          <div key={productIndex} className="py-0.5 border-b border-gray-100 last:border-0">
            {productName}×{qty}개
          </div>
        ) : null;
      }).filter(Boolean);
    } catch (error) {
      console.error('Dynamic product quantities parse error:', error);
      return null;
    }
  };

  // 필터링 로직 (매니저용 - 관리자가 설정한 발송주문과 발송완료만 표시)
  const filteredOrders = (orders as Order[]).filter(order => {
    // 서버에서 이미 scheduled/delivered만 반환하므로 추가 필터링 불필요
    // 매니저는 관리자가 발송주문(scheduled) 또는 발송완료(delivered)로 설정한 주문만 볼 수 있음

    // 날짜 필터링
    if (orderDateFilter === 'today') {
      const today = new Date().toDateString();
      const orderDate = new Date(order.createdAt).toDateString();
      if (orderDate !== today) return false;
    } else if (orderDateFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      if (new Date(order.createdAt) < weekAgo) return false;
    } else if (orderDateFilter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      if (new Date(order.createdAt) < monthAgo) return false;
    } else if (orderDateFilter === 'custom' && orderStartDate && orderEndDate) {
      const start = new Date(orderStartDate);
      const end = new Date(orderEndDate);
      end.setHours(23, 59, 59, 999);
      const orderDate = new Date(order.createdAt);
      if (orderDate < start || orderDate > end) return false;
    }

    // 고객명 필터링
    if (customerNameFilter && !order.customerName.toLowerCase().includes(customerNameFilter.toLowerCase())) {
      return false;
    }

    // 결제 상태 필터링
    if (paymentStatusFilter !== 'all' && order.paymentStatus !== paymentStatusFilter) {
      return false;
    }

    // 주문 상태 필터링
    if (orderStatusFilter !== 'all' && order.status !== orderStatusFilter) {
      return false;
    }

    // 판매자 발송 필터링
    if (sellerShippedFilter === 'shipped' && !order.sellerShipped) {
      return false;
    }
    if (sellerShippedFilter === 'not_shipped' && order.sellerShipped) {
      return false;
    }

    return true;
  });

  // SMS 일괄 발송 mutation
  const sendBulkSMSMutation = useMutation({
    mutationFn: async ({ phones, message }: { phones: string[]; message: string }) => {
      return api.post('/api/sms/bulk', { phones, message });
    },
    onSuccess: () => {
      toast({
        title: "SMS 발송 완료",
        description: `${selectedOrders.size}명에게 SMS가 발송되었습니다.`,
      });
      setShowBulkSMSDialog(false);
      setBulkSMSMessage('');
      setSelectedOrders(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "SMS 발송 실패",
        description: error.message || "SMS 발송 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // Excel export function for manager - 매니저 전용 컬럼만 포함
  const exportToExcel = (ordersList: Order[], fileName: string) => {
    const excelData = ordersList.map(order => ({
      '주문번호': order.orderNumber,
      '예약발송일': order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('ko-KR') : '',
      '주문자': order.customerName,
      '주문내역': [
        order.smallBoxQuantity > 0 ? `${getProductName(0, '한과1호')}×${order.smallBoxQuantity}개` : '',
        order.largeBoxQuantity > 0 ? `${getProductName(1, '한과2호')}×${order.largeBoxQuantity}개` : '',
        order.wrappingQuantity > 0 ? `${getProductName(2, '보자기')}×${order.wrappingQuantity}개` : '',
        ...(order.dynamicProductQuantities ? (() => {
          try {
            const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
              ? JSON.parse(order.dynamicProductQuantities) 
              : order.dynamicProductQuantities;
            return Object.entries(dynamicQty || {}).map(([index, quantity]) => {
              const productIndex = parseInt(index);
              const qty = Number(quantity);
              const productName = getProductName(productIndex, `상품${productIndex + 1}`);
              return qty > 0 ? `${productName}×${qty}개` : '';
            }).filter(Boolean);
          } catch (error) {
            console.error('Dynamic product quantities parse error:', error);
            return [];
          }
        })() : [])
      ].filter(Boolean).join('\n'),
      '연락처': order.customerPhone,
      '배송지': `${order.address1} ${order.address2 || ''}`.trim(),
      '판매자발송': order.sellerShipped ? '발송완료' : '발송대기'
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // 주문내역 컬럼에 줄바꿈 적용을 위한 스타일 설정
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const orderDetailsCellAddress = XLSX.utils.encode_cell({ r: R, c: 3 }); // 주문내역은 4번째 컬럼 (D)
      if (ws[orderDetailsCellAddress] && ws[orderDetailsCellAddress].v) {
        // 줄바꿈 문자를 엑셀에서 인식할 수 있도록 수정
        ws[orderDetailsCellAddress].v = ws[orderDetailsCellAddress].v.toString();
        if (!ws[orderDetailsCellAddress].s) ws[orderDetailsCellAddress].s = {};
        ws[orderDetailsCellAddress].s.alignment = { 
          wrapText: true, 
          vertical: 'top',
          horizontal: 'left'
        };
      }
    }
    
    // 행 높이 설정 (줄바꿈된 내용이 보이도록)
    if (!ws['!rows']) ws['!rows'] = [];
    for (let R = 1; R <= range.e.r; ++R) { // 헤더 제외하고 데이터 행만
      ws['!rows'][R] = { hpt: 60 }; // 행 높이를 60으로 설정
    }
    
    // 컬럼 너비 설정
    ws['!cols'] = [
      { width: 15 }, // 주문번호
      { width: 15 }, // 예약발송일
      { width: 12 }, // 주문자
      { width: 35 }, // 주문내역 (더 넓게)
      { width: 15 }, // 연락처
      { width: 45 }, // 배송지 (더 넓게)
      { width: 12 }  // 판매자발송
    ];
    
    const wb = XLSX.utils.book_new();
    
    // 워크북에 스타일 정보 추가
    wb.Workbook = {
      Views: [{
        RTL: false
      }]
    };
    
    // 시트에 스타일 정보 추가
    ws['!margins'] = { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };
    
    XLSX.utils.book_append_sheet(wb, ws, "매니저_주문목록");
    
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${fileName}_${today}.xlsx`, {
      cellStyles: true,
      sheetStubs: false,
      bookType: 'xlsx'
    });
    
    toast({
      title: "엑셀 다운로드 완료",
      description: `${ordersList.length}개 주문이 엑셀로 다운로드되었습니다.`,
    });
  };

  // 주문 상태 변경 mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return api.patch(`/api/orders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/orders"] });
      toast({
        title: "주문 상태 변경",
        description: "주문 상태가 변경되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "상태 변경 실패",
        description: error.message || "주문 상태 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 판매자 발송 상태 변경 mutation
  const updateSellerShippedMutation = useMutation({
    mutationFn: async ({ id, sellerShipped }: { id: number; sellerShipped: boolean }) => {
      return api.patch(`/api/orders/${id}/seller-shipped`, { sellerShipped });
    },
    onSuccess: async (data, { id, sellerShipped }) => {
      // 판매자 발송 상태에 따라 주문 상태 변경
      if (sellerShipped) {
        // 발송 완료 시 자동으로 주문 상태를 delivered로 변경
        try {
          await api.patch(`/api/orders/${id}/status`, { status: 'delivered' });
        } catch (error) {
          console.error('주문 상태 업데이트 실패:', error);
        }
      } else {
        // 발송 취소 시 자동으로 주문 상태를 scheduled로 변경
        try {
          await api.patch(`/api/orders/${id}/status`, { status: 'scheduled' });
        } catch (error) {
          console.error('주문 상태 업데이트 실패:', error);
        }
      }
      
      // 캐시 무효화하여 UI 즉시 업데이트
      queryClient.invalidateQueries({ queryKey: ["/api/manager/orders"] });
      
      toast({
        title: "발송 상태 변경",
        description: sellerShipped 
          ? "판매자 발송이 완료되고 주문상태가 발송완료로 변경되었습니다."
          : "판매자 발송이 취소되고 주문상태가 발송주문으로 변경되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "상태 변경 실패", 
        description: error.message || "발송 상태 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 결제 상태 변경 mutation
  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ id, paymentStatus }: { id: number; paymentStatus: string }) => {
      return api.patch(`/api/orders/${id}/payment-status`, { paymentStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/orders"] });
      toast({
        title: "입금 상태 변경",
        description: "입금 상태가 변경되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "상태 변경 실패",
        description: error.message || "입금 상태 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 일괄 판매자 발송 mutation
  const bulkSellerShippedMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      return api.patch('/api/orders/seller-shipped', { orderIds });
    },
    onSuccess: async (data, orderIds) => {
      // 일괄 발송 완료 시 모든 주문의 상태를 delivered로 변경
      try {
        const statusUpdatePromises = orderIds.map(id => 
          api.patch(`/api/orders/${id}/status`, { status: 'delivered' })
        );
        await Promise.all(statusUpdatePromises);
      } catch (error) {
        console.error('일괄 주문 상태 업데이트 실패:', error);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/manager/orders"] });
      toast({
        title: "일괄 발송 처리 완료",
        description: `${selectedOrders.size}개 주문이 발송 처리되고 주문상태가 발송완료로 변경되었습니다.`,
      });
      setSelectedOrders(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "일괄 발송 처리 실패",
        description: error.message || "일괄 발송 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });



  const downloadExcel = () => {
    exportToExcel(filteredOrders, "전체주문목록");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-eden-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader 
        handleExcelDownload={downloadExcel}
        setActiveTab={() => {}}
        activeTab="all"
        costSettingsDialog={<></>}
        passwordChangeDialog={<></>}
      />
      <div className="container mx-auto p-4 space-y-6">
        {currentPage === "orders" && (
          <>
            {/* 주문 목록 */}
            <Tabs defaultValue="전체보기" className="space-y-4">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="전체보기">전체보기 ({filteredOrders.length})</TabsTrigger>
                  <TabsTrigger value="발송처리대기">
                    발송처리대기 ({filteredOrders.filter(o => !o.sellerShipped).length})
                  </TabsTrigger>
                  <TabsTrigger value="매니저발송완료">
                    매니저발송완료 ({filteredOrders.filter(o => o.sellerShipped).length})
                  </TabsTrigger>
                </TabsList>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={downloadExcel}>
                    <Download className="h-4 w-4 mr-2" />
                    엑셀
                  </Button>
                </div>
              </div>

              {/* 선택된 주문이 있을 때 일괄 작업 버튼 */}
              {selectedOrders.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedOrders.size}개 주문이 선택되었습니다
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
                      variant="outline"
                      onClick={() => bulkSellerShippedMutation.mutate(Array.from(selectedOrders))}
                      disabled={bulkSellerShippedMutation.isPending}
                      className="bg-white"
                    >
                      {bulkSellerShippedMutation.isPending ? '처리중...' : '일괄 발송처리'}
                    </Button>
                  </div>
                </div>
              )}

              {/* 필터링 UI */}
              <Card>
                <CardContent className="pt-4 pb-4">
                  {/* 데스크탑 필터 레이아웃 */}
                  <div className="hidden md:flex flex-wrap items-center gap-4">
                    {/* 날짜 필터 */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium whitespace-nowrap">주문일:</label>
                      <Select value={orderDateFilter} onValueChange={setOrderDateFilter}>
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체 기간</SelectItem>
                          <SelectItem value="today">오늘</SelectItem>
                          <SelectItem value="week">최근 7일</SelectItem>
                          <SelectItem value="month">최근 30일</SelectItem>
                          <SelectItem value="custom">사용자 지정</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {orderDateFilter === 'custom' && (
                        <div className="flex gap-1">
                          <Input
                            type="date"
                            value={orderStartDate}
                            onChange={(e) => setOrderStartDate(e.target.value)}
                            className="h-8 w-32 text-xs"
                            placeholder="시작일"
                          />
                          <Input
                            type="date"
                            value={orderEndDate}
                            onChange={(e) => setOrderEndDate(e.target.value)}
                            className="h-8 w-32 text-xs"
                            placeholder="종료일"
                          />
                        </div>
                      )}
                    </div>

                    {/* 고객명 필터 */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium whitespace-nowrap">고객명:</label>
                      <Input
                        placeholder="고객명 검색"
                        value={customerNameFilter}
                        onChange={(e) => setCustomerNameFilter(e.target.value)}
                        className="h-8 w-32 text-xs"
                      />
                    </div>

                    {/* 결제 상태 필터 */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium whitespace-nowrap">결제상태:</label>
                      <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체</SelectItem>
                          <SelectItem value="pending">입금대기</SelectItem>
                          <SelectItem value="confirmed">입금완료</SelectItem>
                          <SelectItem value="partial">부분결제</SelectItem>
                          <SelectItem value="refunded">환불</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 주문 상태 필터 */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium whitespace-nowrap">주문상태:</label>
                      <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체</SelectItem>
                          <SelectItem value="pending">주문접수</SelectItem>
                          <SelectItem value="scheduled">발송주문</SelectItem>
                          <SelectItem value="delivered">판매자발송</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 판매자 발송 상태 필터 */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium whitespace-nowrap">판매자발송:</label>
                      <Select value={sellerShippedFilter} onValueChange={setSellerShippedFilter}>
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체</SelectItem>
                          <SelectItem value="shipped">발송완료</SelectItem>
                          <SelectItem value="not_shipped">발송대기</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* 모바일 필터 레이아웃 */}
                  <div className="md:hidden space-y-3">
                    {/* 첫 번째 줄: 주문일, 고객명 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">주문일</label>
                        <Select value={orderDateFilter} onValueChange={setOrderDateFilter}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            <SelectItem value="today">오늘</SelectItem>
                            <SelectItem value="week">7일</SelectItem>
                            <SelectItem value="month">30일</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">고객명</label>
                        <Input
                          placeholder="검색"
                          value={customerNameFilter}
                          onChange={(e) => setCustomerNameFilter(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    {/* 두 번째 줄: 결제상태, 주문상태 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">결제상태</label>
                        <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            <SelectItem value="pending">미입금</SelectItem>
                            <SelectItem value="confirmed">입금완료</SelectItem>
                            <SelectItem value="partial">부분결제</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">판매자발송</label>
                        <Select value={sellerShippedFilter} onValueChange={setSellerShippedFilter}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            <SelectItem value="shipped">완료</SelectItem>
                            <SelectItem value="not_shipped">대기</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 주문 목록 테이블 */}
              <TabsContent value="전체보기" className="space-y-4">
                <div className="bg-white border rounded-lg">
                  <div className="p-2 md:p-4 border-b">
                    <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center">
                      <h2 className="text-sm md:text-lg font-semibold">주문 목록 (총 {filteredOrders.length}개)</h2>
                      <div className="flex items-center gap-2">
                        {/* 뷰 모드 전환 버튼 */}
                        <div className="flex border rounded-lg p-1">
                          <Button
                            variant={viewMode === 'list' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('list')}
                            className="h-7 px-2"
                            title="리스트 보기"
                          >
                            <List className="h-3 w-3" />
                          </Button>
                          <Button
                            variant={viewMode === 'card' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('card')}
                            className="h-7 px-2"
                            title="카드 보기"
                          >
                            <Grid3x3 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            // 발송완료되지 않은 모든 주문을 선택하고 일괄 발송처리
                            const unshippedOrders = filteredOrders.filter(o => !o.sellerShipped);
                            if (unshippedOrders.length === 0) {
                              toast({
                                title: "처리할 주문이 없습니다",
                                description: "발송처리가 필요한 주문이 없습니다.",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            // 일괄 발송처리 실행
                            const orderIds = unshippedOrders.map(o => o.id);
                            Promise.all(
                              orderIds.map(id => 
                                updateSellerShippedMutation.mutateAsync({ 
                                  id, 
                                  sellerShipped: true 
                                })
                              )
                            ).then(() => {
                              toast({
                                title: "일괄 발송처리 완료",
                                description: `${orderIds.length}건의 주문이 발송처리되었습니다.`,
                              });
                            }).catch(() => {
                              toast({
                                title: "일괄 발송처리 실패",
                                description: "일부 주문 처리 중 오류가 발생했습니다.",
                                variant: "destructive",
                              });
                            });
                          }}
                          className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-xs md:text-sm px-2 md:px-4 py-1 md:py-2 h-7 md:h-9"
                          disabled={updateSellerShippedMutation.isPending}
                        >
                          <Truck className="h-3 w-3 md:h-4 md:w-4" />
                          <span className="hidden md:inline">일괄발송처리 ({filteredOrders.filter(o => !o.sellerShipped).length})</span>
                          <span className="md:hidden">일괄처리({filteredOrders.filter(o => !o.sellerShipped).length})</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => exportToExcel(filteredOrders, "전체주문목록")}
                          className="flex items-center gap-1 text-xs md:text-sm px-2 md:px-4 py-1 md:py-2 h-7 md:h-9"
                        >
                          <Download className="h-3 w-3 md:h-4 md:w-4" />
                          <span className="hidden md:inline">엑셀 다운로드</span>
                          <span className="md:hidden">엑셀</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* 테이블 뷰 (리스트 모드) */}
                  {viewMode === 'list' && (
                    <div className="hidden md:block overflow-x-auto">
                    <table className="w-full manager-table">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="text-left p-4 font-semibold text-gray-800 w-12">
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
                                } else {
                                  setSelectedOrders(new Set());
                                }
                              }}
                              checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                              className="rounded w-4 h-4"
                            />
                          </th>
                          <th className="py-4 px-4 text-left font-semibold text-gray-800 min-w-[120px]">주문번호</th>
                          <th className="text-center py-4 px-4 font-semibold text-gray-800 min-w-[100px]">예약발송일</th>
                          <th className="py-4 px-4 text-left font-semibold text-gray-800 min-w-[100px]">주문자</th>
                          <th className="py-4 px-4 text-left font-semibold text-gray-800 min-w-[200px]">주문내역</th>
                          <th className="py-4 px-4 text-left font-semibold text-gray-800 min-w-[120px]">연락처</th>
                          <th className="py-4 px-4 text-left font-semibold text-gray-800 min-w-[160px]">배송지</th>
                          <th className="py-4 px-4 text-center font-semibold text-gray-800 min-w-[90px]">입금상태</th>
                          <th className="py-4 px-4 text-center font-semibold text-gray-800 min-w-[90px]">주문상태</th>
                          <th className="py-4 px-4 text-center font-semibold text-gray-800 min-w-[110px]">판매자발송</th>
                          <th className="py-4 px-4 text-center font-semibold text-gray-800 min-w-[110px]">작업</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order) => (
                          <tr key={order.id} className={`border-b border-gray-200 hover:bg-gray-50 ${
                            order.paymentStatus !== 'confirmed' ? 'bg-red-50' : ''
                          }`}>
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={selectedOrders.has(order.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedOrders);
                                  if (e.target.checked) {
                                    newSet.add(order.id);
                                  } else {
                                    newSet.delete(order.id);
                                  }
                                  setSelectedOrders(newSet);
                                }}
                                className="rounded"
                              />
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-semibold text-gray-900 text-xs">#{order.orderNumber}</div>
                              <div className="text-sm text-gray-600">
                                <div className="font-medium">{new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
                                <div className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
                              </div>
                              {order.scheduledDate ? (
                                <div 
                                  className="text-red-600 font-bold text-sm cursor-pointer hover:bg-red-50 px-2 py-1 rounded border border-transparent hover:border-red-200 mt-1"
                                  title="클릭하여 예약발송일 수정"
                                >
                                  {new Date(order.scheduledDate).toLocaleDateString('ko-KR')}
                                </div>
                              ) : null}
                            </td>
                            <td className="py-2 px-2">
                              {order.scheduledDate ? (
                                <div 
                                  className="text-xs text-blue-600 cursor-pointer hover:bg-blue-50 px-1 py-1 rounded border border-transparent hover:border-blue-200"
                                  title="클릭하여 예약발송일 수정"
                                >
                                  {new Date(order.scheduledDate).toLocaleDateString('ko-KR')}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              <div className="font-medium text-gray-900 text-xs">{order.customerName}</div>
                              {order.recipientName && order.recipientName !== order.customerName && (
                                <div className="text-xs text-blue-600">받는분: {order.recipientName}</div>
                              )}
                            </td>
                            <td className="py-2 px-2 min-w-[200px]">
                              <div className="text-xs space-y-1">
                                {order.smallBoxQuantity > 0 && (
                                  <div className="whitespace-nowrap">{getProductName(0, '한과1호')} × {order.smallBoxQuantity}개</div>
                                )}
                                {order.largeBoxQuantity > 0 && (
                                  <div className="whitespace-nowrap">{getProductName(1, '한과2호')} × {order.largeBoxQuantity}개</div>
                                )}
                                {order.wrappingQuantity > 0 && (
                                  <div className="whitespace-nowrap">{getProductName(2, '보자기')} × {order.wrappingQuantity}개</div>
                                )}
                                {/* 동적 상품들도 개별 줄로 표시 */}
                                {order.dynamicProductQuantities && (() => {
                                  try {
                                    const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
                                      ? JSON.parse(order.dynamicProductQuantities) 
                                      : order.dynamicProductQuantities;
                                    
                                    return Object.entries(dynamicQty || {}).map(([index, quantity]) => {
                                      const productIndex = parseInt(index);
                                      const qty = Number(quantity);
                                      if (qty > 0 && productNames && productNames[productIndex]) {
                                        return (
                                          <div key={index} className="whitespace-nowrap">
                                            {productNames[productIndex].name} × {qty}개
                                          </div>
                                        );
                                      }
                                      return null;
                                    }).filter(Boolean);
                                  } catch (error) {
                                    console.error('Dynamic product quantities parse error:', error);
                                    return null;
                                  }
                                })()}
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <div className="text-xs text-gray-900">{order.customerPhone}</div>
                            </td>
                            <td className="py-2 px-2 max-w-xs">
                              <div>
                                <div 
                                  className="text-xs text-gray-900 cursor-pointer hover:bg-blue-50 px-1 py-1 rounded border border-transparent hover:border-blue-200 truncate"
                                  title="클릭하여 전체 주소 보기"
                                >
                                  {order.address1.length > 15 ? `${order.address1.substring(0, 15)}...` : order.address1}
                                </div>
                                {checkRemoteArea(order.address1) && (
                                  <div className="text-xs text-red-600 font-bold mt-1">배송비추가</div>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div className="text-xs">
                                {order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && order.paymentStatus === 'confirmed' ? (
                                  <span className="text-yellow-600 font-medium">부분결제</span>
                                ) : order.paymentStatus === 'confirmed' ? (
                                  <span className="text-green-600 font-medium">입금완료</span>
                                ) : order.paymentStatus === 'partial' ? (
                                  <span className="text-yellow-600 font-medium">부분결제</span>
                                ) : order.paymentStatus === 'refunded' ? (
                                  <span className="text-red-600 font-medium">환불</span>
                                ) : (
                                  <span className="text-red-600 font-medium">입금대기</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <Select
                                value={order.status}
                                onValueChange={(value) => updateOrderStatusMutation.mutate({ id: order.id, status: value })}
                                disabled={updateOrderStatusMutation.isPending}
                              >
                                <SelectTrigger className="w-28 h-6 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="scheduled">
                                    <div className="flex items-center space-x-1">
                                      <Calendar className="h-3 w-3 text-blue-500" />
                                      <span>발송주문</span>
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
                              <div className="flex flex-col items-center gap-2">
                                {order.sellerShipped ? (
                                  <div className="text-center">
                                    <div 
                                      className="text-green-600 font-medium text-xs cursor-pointer hover:bg-green-50 px-2 py-1 rounded border border-transparent hover:border-green-200"
                                      onClick={() => updateSellerShippedMutation.mutate({ 
                                        id: order.id, 
                                        sellerShipped: false 
                                      })}
                                      title="클릭하여 발송 상태 취소"
                                    >
                                      매니저발송완료
                                    </div>
                                    <div className="text-gray-500 mt-1 text-xs">
                                      {order.sellerShippedDate ? 
                                        new Date(order.sellerShippedDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) :
                                        new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
                                      }
                                    </div>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateSellerShippedMutation.mutate({ 
                                      id: order.id, 
                                      sellerShipped: true 
                                    })}
                                    className="text-xs px-2 py-1 h-7"
                                  >
                                    발송처리
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div className="flex flex-col gap-1">
                                <SmsDialog order={order}>
                                  <Button size="sm" variant="outline" className="flex items-center gap-1 w-full">
                                    <MessageSquare className="h-3 w-3" />
                                    SMS
                                  </Button>
                                </SmsDialog>

                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {filteredOrders.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        주문이 없습니다.
                      </div>
                    )}
                    </div>
                  )}

                  {/* 카드 뷰 */}
                  {viewMode === 'card' && (
                    <div className="hidden md:block p-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {filteredOrders.map((order) => (
                          <div key={order.id} className={`border rounded-lg p-4 ${
                            order.paymentStatus !== 'confirmed' ? 'border-red-200 bg-red-50' : 'bg-white border-gray-200'
                          }`}>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedOrders.has(order.id)}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedOrders);
                                    if (e.target.checked) {
                                      newSet.add(order.id);
                                    } else {
                                      newSet.delete(order.id);
                                    }
                                    setSelectedOrders(newSet);
                                  }}
                                  className="rounded w-4 h-4"
                                />
                                <h3 className="font-semibold text-sm">#{order.orderNumber}</h3>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs ${
                                order.paymentStatus === 'confirmed' ? 'bg-green-100 text-green-700' :
                                order.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                order.paymentStatus === 'refunded' ? 'bg-red-100 text-red-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {order.paymentStatus === 'confirmed' ? '입금완료' :
                                 order.paymentStatus === 'partial' ? '부분결제' :
                                 order.paymentStatus === 'refunded' ? '환불' : '미입금'}
                              </span>
                            </div>

                            <div className="space-y-2">
                              <div className="text-sm"><strong>주문자:</strong> {order.customerName}</div>
                              <div className="text-sm"><strong>연락처:</strong> {order.customerPhone}</div>
                              <div className="text-sm">
                                <strong>주문내역:</strong>
                                <div className="mt-1 space-y-1">
                                  {order.smallBoxQuantity > 0 && (
                                    <div className="bg-gray-50 px-2 py-1 rounded text-xs">
                                      {getProductName(0, '한과1호')} × {order.smallBoxQuantity}개
                                    </div>
                                  )}
                                  {order.largeBoxQuantity > 0 && (
                                    <div className="bg-gray-50 px-2 py-1 rounded text-xs">
                                      {getProductName(1, '한과2호')} × {order.largeBoxQuantity}개
                                    </div>
                                  )}
                                  {order.wrappingQuantity > 0 && (
                                    <div className="bg-gray-50 px-2 py-1 rounded text-xs">
                                      {getProductName(2, '보자기')} × {order.wrappingQuantity}개
                                    </div>
                                  )}
                                  {/* 동적 상품들도 개별 줄로 표시 */}
                                  {order.dynamicQuantities && typeof order.dynamicQuantities === 'object' && 
                                    Object.entries(order.dynamicQuantities).map(([index, quantity]) => {
                                      const productIndex = parseInt(index);
                                      if (quantity > 0 && productNames && productNames[productIndex]) {
                                        return (
                                          <div key={index} className="bg-gray-50 px-2 py-1 rounded text-xs">
                                            {productNames[productIndex].name} × {quantity}개
                                          </div>
                                        );
                                      }
                                      return null;
                                    })
                                  }
                                </div>
                              </div>
                              <div className="text-sm"><strong>금액:</strong> {(order.totalAmount || 0).toLocaleString()}원</div>
                            </div>

                            <div className="flex justify-between items-center mt-4 pt-3 border-t">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    updateSellerShippedMutation.mutate({
                                      id: order.id,
                                      sellerShipped: !order.sellerShipped
                                    });
                                  }}
                                  className={`text-xs px-3 py-1 ${order.sellerShipped ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}
                                >
                                  {order.sellerShipped ? '발송완료' : '발송처리'}
                                </Button>
                                <SmsDialog order={order}>
                                  <Button size="sm" variant="outline" className="text-xs px-2">
                                    <MessageSquare className="h-3 w-3 mr-1" />
                                    SMS
                                  </Button>
                                </SmsDialog>
                              </div>
                              <span className="text-xs text-gray-500">
                                {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {filteredOrders.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          주문이 없습니다.
                        </div>
                      )}
                    </div>
                  )}

                  {/* 모바일 리스트 뷰 */}
                  <div className="md:hidden space-y-1 p-2">
                    {filteredOrders.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        주문이 없습니다.
                      </div>
                    ) : (
                      filteredOrders.map((order) => {
                        const isExpanded = expandedOrders.has(order.id);
                        return (
                          <div key={order.id} className={`border border-gray-200 rounded-lg bg-white ${
                            order.paymentStatus !== 'confirmed' ? 'border-red-200 bg-red-50' : ''
                          }`}>
                            {/* 간결한 리스트 뷰 - 확장되지 않았을 때만 표시 */}
                            {!isExpanded && (
                              <div 
                                className="p-3 cursor-pointer hover:bg-gray-50"
                                onClick={() => toggleOrderExpansion(order.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedOrders.has(order.id)}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        const newSet = new Set(selectedOrders);
                                        if (e.target.checked) {
                                          newSet.add(order.id);
                                        } else {
                                          newSet.delete(order.id);
                                        }
                                        setSelectedOrders(newSet);
                                      }}
                                      className="rounded w-4 h-4"
                                    />
                                    <span className="font-bold text-black text-xs">#{order.orderNumber}</span>
                                    <span className="text-black text-xs">{order.customerName}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      order.paymentStatus === 'confirmed' ? 'bg-green-100 text-green-700' :
                                      order.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                      order.paymentStatus === 'refunded' ? 'bg-red-100 text-red-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && order.paymentStatus === 'confirmed' ? '부분결제' :
                                       order.paymentStatus === 'confirmed' ? '입금완료' :
                                       order.paymentStatus === 'partial' ? '부분결제' :
                                       order.paymentStatus === 'refunded' ? '환불' : '미입금'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-blue-600 text-xs">{(order.totalAmount || 0).toLocaleString()}원</span>
                                    <span className="text-xs text-gray-400">
                                      ▼
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 확장형 상세 뷰 - 클릭시에만 표시 */}
                            {isExpanded && (
                              <div className="p-3">
                                {/* 헤더: 주문번호, 고객명, 뒤로가기 */}
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900 text-sm">#{order.orderNumber}</span>
                                    <span className="text-gray-700 text-sm">{order.customerName}</span>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleOrderExpansion(order.id);
                                    }}
                                    className="text-gray-400 hover:text-gray-600 text-sm"
                                  >
                                    ✕
                                  </button>
                                </div>
                                {/* 주문내역 */}
                                <div className="mb-2 pt-2">
                                  <div className="text-xs text-gray-700 mb-2 space-y-1">
                                    {order.smallBoxQuantity > 0 && (
                                      <div className="whitespace-nowrap">{getProductName(0, '한과1호')} × {order.smallBoxQuantity}개</div>
                                    )}
                                    {order.largeBoxQuantity > 0 && (
                                      <div className="whitespace-nowrap">{getProductName(1, '한과2호')} × {order.largeBoxQuantity}개</div>
                                    )}
                                    {order.wrappingQuantity > 0 && (
                                      <div className="whitespace-nowrap">{getProductName(2, '보자기')} × {order.wrappingQuantity}개</div>
                                    )}
                                    {/* 동적 상품들도 개별 줄로 표시 */}
                                    {order.dynamicProductQuantities && (() => {
                                      try {
                                        const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
                                          ? JSON.parse(order.dynamicProductQuantities) 
                                          : order.dynamicProductQuantities;
                                        
                                        return Object.entries(dynamicQty || {}).map(([index, quantity]) => {
                                          const productIndex = parseInt(index);
                                          const qty = Number(quantity);
                                          if (qty > 0 && productNames && productNames[productIndex]) {
                                            return (
                                              <div key={index} className="whitespace-nowrap">
                                                {productNames[productIndex].name} × {qty}개
                                              </div>
                                            );
                                          }
                                          return null;
                                        }).filter(Boolean);
                                      } catch (error) {
                                        console.error('Dynamic product quantities parse error:', error);
                                        return null;
                                      }
                                    })()}
                                  </div>
                                  
                                  {/* 입금상태와 주문상태 - 관리자와 동일한 표시 */}
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      order.paymentStatus === 'confirmed' ? 'bg-green-100 text-green-700' :
                                      order.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                      order.paymentStatus === 'refunded' ? 'bg-red-100 text-red-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && order.paymentStatus === 'confirmed' ? '부분결제' :
                                       order.paymentStatus === 'confirmed' ? '입금완료' :
                                       order.paymentStatus === 'partial' ? '부분결제' :
                                       order.paymentStatus === 'refunded' ? '환불' : '미입금'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      order.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                                      order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                      order.status === 'seller_shipped' ? 'bg-purple-100 text-purple-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {order.status === 'scheduled' ? '발송주문' :
                                       order.status === 'delivered' ? '발송완료' :
                                       order.status === 'seller_shipped' ? '발송대기' : '주문접수'}
                                    </span>
                                  </div>
                                </div>

                                {/* 발송 상태 및 일자 표시 - 주문 상태에 따라 동적 변경 */}
                                <div className="flex items-center gap-1 mb-2 text-xs">
                                  {order.status === 'scheduled' && order.scheduledDate && (
                                    <>
                                      <span className="text-gray-600">발송:</span>
                                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                        {new Date(order.scheduledDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                      </span>
                                    </>
                                  )}
                                  {order.status === 'delivered' && order.deliveredDate && (
                                    <>
                                      <span className="text-gray-600">발송완료:</span>
                                      <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">
                                        {new Date(order.deliveredDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                      </span>
                                    </>
                                  )}
                                  {order.sellerShipped && order.sellerShippedDate && (
                                    <>
                                      <span className="text-gray-600">매니저발송:</span>
                                      <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                                        {new Date(order.sellerShippedDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* 연락처, 주소 */}
                                <div className="text-xs text-gray-700 mb-2">
                                  <div>연락처: {order.customerPhone}</div>
                                  <div className="flex items-center justify-between">
                                    <span>배송지: {order.address1}</span>
                                    {checkRemoteArea(order.address1) && (
                                      <span className="text-red-600 font-bold">배송비추가</span>
                                    )}
                                  </div>
                                </div>

                                {/* 상태 변경 및 액션 버튼 */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Select
                                      value={order.status}
                                      onValueChange={(value) => updateOrderStatusMutation.mutate({ id: order.id, status: value })}
                                      disabled={updateOrderStatusMutation.isPending}
                                    >
                                      <SelectTrigger className="h-7 text-xs px-2 w-24">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="scheduled">발송주문</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div className="flex items-center gap-1">
                                    {order.sellerShipped ? (
                                      <div className="text-center">
                                        <div 
                                          className="text-black text-xs cursor-pointer hover:bg-gray-100 px-2 py-1 rounded border border-gray-300"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateSellerShippedMutation.mutate({ 
                                              id: order.id, 
                                              sellerShipped: false 
                                            });
                                          }}
                                          title="클릭하여 발송 상태 취소"
                                        >
                                          발송완료
                                        </div>
                                      </div>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateSellerShippedMutation.mutate({ 
                                            id: order.id, 
                                            sellerShipped: true 
                                          });
                                        }}
                                        className="text-xs px-2 py-1 h-7"
                                      >
                                        발송처리
                                      </Button>
                                    )}
                                    
                                    <SmsDialog order={order}>
                                      <Button size="sm" variant="outline" className="flex items-center gap-1 text-xs px-2 py-1 h-7">
                                        <MessageSquare className="h-3 w-3" />
                                        SMS
                                      </Button>
                                    </SmsDialog>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* 발송처리대기 탭 */}
              <TabsContent value="발송처리대기" className="space-y-4">
                <div className="bg-white border rounded-lg">
                  <div className="p-2 md:p-4 border-b">
                    <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center">
                      <h2 className="text-sm md:text-lg font-semibold">발송처리대기 목록 (총 {filteredOrders.filter(o => !o.sellerShipped).length}개)</h2>
                      <div className="flex gap-1 md:gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            const unshippedOrders = filteredOrders.filter(o => !o.sellerShipped);
                            if (unshippedOrders.length === 0) {
                              toast({
                                title: "처리할 주문이 없습니다",
                                description: "발송처리가 필요한 주문이 없습니다.",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            const orderIds = unshippedOrders.map(o => o.id);
                            Promise.all(
                              orderIds.map(id => 
                                updateSellerShippedMutation.mutateAsync({ 
                                  id, 
                                  sellerShipped: true 
                                })
                              )
                            ).then(() => {
                              toast({
                                title: "일괄 발송처리 완료",
                                description: `${orderIds.length}건의 주문이 발송처리되었습니다.`,
                              });
                            }).catch(() => {
                              toast({
                                title: "일괄 발송처리 실패",
                                description: "일부 주문 처리 중 오류가 발생했습니다.",
                                variant: "destructive",
                              });
                            });
                          }}
                          className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-xs md:text-sm px-2 md:px-4 py-1 md:py-2 h-7 md:h-9"
                          disabled={updateSellerShippedMutation.isPending}
                        >
                          <Truck className="h-3 w-3 md:h-4 md:w-4" />
                          <span className="hidden md:inline">일괄발송처리 ({filteredOrders.filter(o => !o.sellerShipped).length})</span>
                          <span className="md:hidden">일괄처리({filteredOrders.filter(o => !o.sellerShipped).length})</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => exportToExcel(filteredOrders.filter(o => !o.sellerShipped), "발송처리대기목록")}
                          className="flex items-center gap-1 text-xs md:text-sm px-2 md:px-4 py-1 md:py-2 h-7 md:h-9"
                        >
                          <Download className="h-3 w-3 md:h-4 md:w-4" />
                          <span className="hidden md:inline">엑셀 다운로드</span>
                          <span className="md:hidden">엑셀</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                  {/* 데스크탑 테이블 뷰 */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full manager-table">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="text-left p-3 font-semibold text-gray-700 w-12">
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                const pendingOrders = filteredOrders.filter(o => !o.sellerShipped);
                                if (e.target.checked) {
                                  setSelectedOrders(new Set(pendingOrders.map(o => o.id)));
                                } else {
                                  setSelectedOrders(new Set());
                                }
                              }}
                              checked={selectedOrders.size === filteredOrders.filter(o => !o.sellerShipped).length && filteredOrders.filter(o => !o.sellerShipped).length > 0}
                              className="rounded"
                            />
                          </th>
                          <th className="py-3 px-3 text-left text-sm font-semibold text-gray-700 min-w-[80px]">주문번호</th>
                          <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700 min-w-[70px]">예약발송일</th>
                          <th className="py-3 px-3 text-left text-sm font-semibold text-gray-700 min-w-[70px]">주문자</th>
                          <th className="py-3 px-3 text-left text-sm font-semibold text-gray-700 min-w-[80px]">주문내역</th>
                          <th className="py-3 px-3 text-left text-sm font-semibold text-gray-700 min-w-[80px]">연락처</th>
                          <th className="py-3 px-3 text-left text-sm font-semibold text-gray-700 min-w-[120px]">배송지</th>
                          <th className="py-3 px-3 text-center text-sm font-semibold text-gray-700 min-w-[60px]">입금상태</th>
                          <th className="py-3 px-3 text-center text-sm font-semibold text-gray-700 min-w-[60px]">주문상태</th>
                          <th className="py-3 px-3 text-center text-sm font-semibold text-gray-700 min-w-[80px]">판매자발송</th>
                          <th className="py-3 px-3 text-center text-sm font-semibold text-gray-700 min-w-[80px]">작업</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.filter(o => !o.sellerShipped).map((order) => (
                          <tr key={order.id} className={`border-b hover:bg-gray-50 ${
                            order.paymentStatus !== 'confirmed' ? 'bg-red-50' : ''
                          }`}>
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={selectedOrders.has(order.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedOrders);
                                  if (e.target.checked) {
                                    newSet.add(order.id);
                                  } else {
                                    newSet.delete(order.id);
                                  }
                                  setSelectedOrders(newSet);
                                }}
                                className="rounded"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <div className="font-medium text-gray-900 text-xs">#{order.orderNumber}</div>
                              <div className="text-xs text-gray-500">
                                <div>{new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
                                {order.paymentStatus !== 'confirmed' && (
                                  <div className="text-red-600 font-bold">미입금</div>
                                )}
                              </div>
                              {order.scheduledDate ? (
                                <div 
                                  className="text-red-600 font-bold text-xs cursor-pointer hover:bg-red-50 px-1 py-1 rounded border border-transparent hover:border-red-200"
                                  title="클릭하여 예약발송일 수정"
                                >
                                  {new Date(order.scheduledDate).toLocaleDateString('ko-KR')}
                                </div>
                              ) : null}
                            </td>
                            <td className="py-2 px-2">
                              {order.scheduledDate ? (
                                <div 
                                  className="text-xs text-blue-600 cursor-pointer hover:bg-blue-50 px-1 py-1 rounded border border-transparent hover:border-blue-200"
                                  title="클릭하여 예약발송일 수정"
                                >
                                  {new Date(order.scheduledDate).toLocaleDateString('ko-KR')}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              <div className="font-medium text-gray-900 text-xs">{order.customerName}</div>
                              {order.recipientName && order.recipientName !== order.customerName && (
                                <div className="text-xs text-blue-600">받는분: {order.recipientName}</div>
                              )}
                            </td>
                            <td className="py-2 px-2 min-w-[80px]">
                              <div className="text-xs space-y-0.5">
                                {order.smallBoxQuantity > 0 && (
                                  <div>{getProductName(0, '한과1호')}×{order.smallBoxQuantity}개</div>
                                )}
                                {order.largeBoxQuantity > 0 && (
                                  <div>{getProductName(1, '한과2호')}×{order.largeBoxQuantity}개</div>
                                )}
                                {order.wrappingQuantity > 0 && (
                                  <div>{getProductName(2, '보자기')}×{order.wrappingQuantity}개</div>
                                )}
                                {renderDynamicProducts(order)}
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <div className="text-xs text-gray-900">{order.customerPhone}</div>
                            </td>
                            <td className="py-2 px-2 max-w-xs">
                              <div>
                                <div 
                                  className="text-xs text-gray-900 cursor-pointer hover:bg-blue-50 px-1 py-1 rounded border border-transparent hover:border-blue-200 truncate"
                                  title="클릭하여 전체 주소 보기"
                                >
                                  {order.address1.length > 15 ? `${order.address1.substring(0, 15)}...` : order.address1}
                                </div>
                                {checkRemoteArea(order.address1) && (
                                  <div className="text-xs text-red-600 font-bold mt-1">배송비추가</div>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div className="text-xs">
                                {order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && order.paymentStatus === 'confirmed' ? (
                                  <span className="text-yellow-600 font-medium">부분결제</span>
                                ) : order.paymentStatus === 'confirmed' ? (
                                  <span className="text-green-600 font-medium">입금완료</span>
                                ) : order.paymentStatus === 'partial' ? (
                                  <span className="text-yellow-600 font-medium">부분결제</span>
                                ) : order.paymentStatus === 'refunded' ? (
                                  <span className="text-red-600 font-medium">환불</span>
                                ) : (
                                  <span className="text-red-600 font-medium">입금대기</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <Select
                                value={order.status}
                                onValueChange={(value) => updateOrderStatusMutation.mutate({ id: order.id, status: value })}
                                disabled={updateOrderStatusMutation.isPending}
                              >
                                <SelectTrigger className="w-28 h-6 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="scheduled">
                                    <div className="flex items-center space-x-1">
                                      <Calendar className="h-3 w-3 text-blue-500" />
                                      <span>발송주문</span>
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
                              <div className="flex flex-col items-center gap-2">
                                {order.sellerShipped ? (
                                  <div className="text-center">
                                    <div 
                                      className="text-green-600 font-medium text-xs cursor-pointer hover:bg-green-50 px-2 py-1 rounded border border-transparent hover:border-green-200"
                                      onClick={() => updateSellerShippedMutation.mutate({ 
                                        id: order.id, 
                                        sellerShipped: false 
                                      })}
                                      title="클릭하여 발송 상태 취소"
                                    >
                                      매니저발송완료
                                    </div>
                                    <div className="text-gray-500 mt-1 text-xs">
                                      {order.sellerShippedDate ? 
                                        new Date(order.sellerShippedDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) :
                                        new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
                                      }
                                    </div>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateSellerShippedMutation.mutate({ 
                                      id: order.id, 
                                      sellerShipped: true 
                                    })}
                                    className="text-xs px-2 py-1 h-7"
                                  >
                                    발송처리
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div className="flex flex-col gap-1">
                                <SmsDialog order={order}>
                                  <Button size="sm" variant="outline" className="flex items-center gap-1 w-full">
                                    <MessageSquare className="h-3 w-3" />
                                    SMS
                                  </Button>
                                </SmsDialog>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {filteredOrders.filter(o => !o.sellerShipped).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        발송처리대기 주문이 없습니다.
                      </div>
                    )}
                  </div>

                  {/* 모바일 리스트 뷰 */}
                  <div className="md:hidden space-y-2 p-2">
                    {filteredOrders.filter(o => !o.sellerShipped).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        발송처리대기 주문이 없습니다.
                      </div>
                    ) : (
                      filteredOrders.filter(o => !o.sellerShipped).map((order) => (
                        <div key={order.id} className={`border border-gray-200 rounded-lg p-3 bg-white ${
                          order.paymentStatus !== 'confirmed' ? 'border-red-200 bg-red-50' : ''
                        }`}>
                          {/* 상단: 주문번호, 이름, 날짜 */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedOrders.has(order.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedOrders);
                                  if (e.target.checked) {
                                    newSet.add(order.id);
                                  } else {
                                    newSet.delete(order.id);
                                  }
                                  setSelectedOrders(newSet);
                                }}
                                className="rounded w-4 h-4"
                              />
                              <span className="font-bold text-black text-xs">#{order.orderNumber}</span>
                              <span className="text-black text-xs">{order.customerName}</span>
                            </div>
                            <span className="text-xs text-gray-600">
                              {new Date(order.createdAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                            </span>
                          </div>

                          {/* 중간: 주문내역 */}
                          <div className="mb-2">
                            <div className="text-xs text-gray-700 space-y-0.5 mb-2">
                              {order.smallBoxQuantity > 0 && <div>{getProductName(0, '한과1호')}×{order.smallBoxQuantity}개</div>}
                              {order.largeBoxQuantity > 0 && <div>{getProductName(1, '한과2호')}×{order.largeBoxQuantity}개</div>}
                              {order.wrappingQuantity > 0 && <div>{getProductName(2, '보자기')}×{order.wrappingQuantity}개</div>}
                              {renderDynamicProducts(order)}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className={`px-2 py-0.5 rounded ${
                                order.paymentStatus === 'confirmed' ? 'bg-green-100 text-green-700' :
                                order.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                order.paymentStatus === 'refunded' ? 'bg-red-100 text-red-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && order.paymentStatus === 'confirmed' ? '부분결제' :
                                 order.paymentStatus === 'confirmed' ? '입금완료' :
                                 order.paymentStatus === 'partial' ? '부분결제' :
                                 order.paymentStatus === 'refunded' ? '환불' : '미입금'}
                              </span>
                              <span className={`px-2 py-0.5 rounded ${
                                order.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                                order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {order.status === 'scheduled' ? '발송주문' :
                                 order.status === 'delivered' ? '발송완료' : '주문접수'}
                              </span>
                            </div>
                          </div>

                          {/* 예약발송일 */}
                          {order.scheduledDate && (
                            <div className="flex items-center gap-1 mb-2 text-xs">
                              <span className="text-gray-600">예약발송일:</span>
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                {new Date(order.scheduledDate).toLocaleDateString('ko-KR')}
                              </span>
                            </div>
                          )}

                          {/* 하단: 연락처, 주소 */}
                          <div className="text-xs text-gray-700 mb-2">
                            <div>연락처: {order.customerPhone}</div>
                            <div className="flex items-center justify-between">
                              <span>배송지: {order.address1.length > 20 ? `${order.address1.substring(0, 20)}...` : order.address1}</span>
                              {checkRemoteArea(order.address1) && (
                                <span className="text-red-600 font-bold">배송비추가</span>
                              )}
                            </div>
                          </div>

                          {/* 하단: 발송처리 버튼 */}
                          <div className="flex items-center justify-between">
                            <Select
                              value={order.status}
                              onValueChange={(value) => updateOrderStatusMutation.mutate({ id: order.id, status: value })}
                              disabled={updateOrderStatusMutation.isPending}
                            >
                              <SelectTrigger className="h-7 text-xs px-2 w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="scheduled">발송주문</SelectItem>
                                <SelectItem value="delivered">발송완료</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateSellerShippedMutation.mutate({ 
                                  id: order.id, 
                                  sellerShipped: true 
                                })}
                                className="text-xs px-1.5 py-0.5 h-6"
                              >
                                발송처리
                              </Button>
                              
                              <SmsDialog order={order}>
                                <Button size="sm" variant="outline" className="flex items-center gap-1 text-xs px-1.5 py-0.5 h-6">
                                  <MessageSquare className="h-3 w-3" />
                                  SMS
                                </Button>
                              </SmsDialog>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* 매니저발송완료 탭 */}
              <TabsContent value="매니저발송완료" className="space-y-4">
                <div className="bg-white border rounded-lg">
                  <div className="p-2 md:p-4 border-b">
                    <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center">
                      <h2 className="text-sm md:text-lg font-semibold">매니저발송완료 주문 (총 {filteredOrders.filter(o => o.sellerShipped).length}개)</h2>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => exportToExcel(filteredOrders.filter(o => o.sellerShipped), "매니저발송완료목록")}
                        className="flex items-center gap-1 text-xs md:text-sm px-2 md:px-4 py-1 md:py-2 h-7 md:h-9"
                      >
                        <Download className="h-3 w-3 md:h-4 md:w-4" />
                        <span className="hidden md:inline">엑셀 다운로드</span>
                        <span className="md:hidden">엑셀</span>
                      </Button>
                    </div>
                  </div>
                  {/* 데스크탑 테이블 뷰 */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full manager-table">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="text-left p-4 font-semibold text-gray-800 w-12">
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                const shippedOrders = filteredOrders.filter(o => o.sellerShipped);
                                if (e.target.checked) {
                                  setSelectedOrders(new Set(shippedOrders.map(o => o.id)));
                                } else {
                                  setSelectedOrders(new Set());
                                }
                              }}
                              checked={selectedOrders.size === filteredOrders.filter(o => o.sellerShipped).length && filteredOrders.filter(o => o.sellerShipped).length > 0}
                              className="rounded w-4 h-4"
                            />
                          </th>
                          <th className="py-3 px-3 text-left text-sm font-semibold text-gray-700 min-w-[80px]">주문번호</th>
                          <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700 min-w-[70px]">예약발송일</th>
                          <th className="py-3 px-3 text-left text-sm font-semibold text-gray-700 min-w-[70px]">주문자</th>
                          <th className="py-3 px-3 text-left text-sm font-semibold text-gray-700 min-w-[80px]">주문내역</th>
                          <th className="py-3 px-3 text-left text-sm font-semibold text-gray-700 min-w-[80px]">연락처</th>
                          <th className="py-3 px-3 text-left text-sm font-semibold text-gray-700 min-w-[120px]">배송지</th>
                          <th className="py-3 px-3 text-center text-sm font-semibold text-gray-700 min-w-[60px]">입금상태</th>
                          <th className="py-3 px-3 text-center text-sm font-semibold text-gray-700 min-w-[60px]">주문상태</th>
                          <th className="py-3 px-3 text-center text-sm font-semibold text-gray-700 min-w-[80px]">판매자발송</th>
                          <th className="py-3 px-3 text-center text-sm font-semibold text-gray-700 min-w-[80px]">작업</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.filter(o => o.sellerShipped).map((order) => (
                          <tr key={order.id} className={`border-b hover:bg-gray-50 ${
                            order.paymentStatus !== 'confirmed' ? 'bg-red-50' : ''
                          }`}>
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={selectedOrders.has(order.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedOrders);
                                  if (e.target.checked) {
                                    newSet.add(order.id);
                                  } else {
                                    newSet.delete(order.id);
                                  }
                                  setSelectedOrders(newSet);
                                }}
                                className="rounded"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <div className="font-medium text-gray-900 text-xs">#{order.orderNumber}</div>
                              <div className="text-xs text-gray-500">
                                <div>{new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
                                {order.paymentStatus !== 'confirmed' && (
                                  <div className="text-red-600 font-bold">미입금</div>
                                )}
                              </div>
                              {order.scheduledDate ? (
                                <div 
                                  className="text-red-600 font-bold text-xs cursor-pointer hover:bg-red-50 px-1 py-1 rounded border border-transparent hover:border-red-200"
                                  title="클릭하여 예약발송일 수정"
                                >
                                  {new Date(order.scheduledDate).toLocaleDateString('ko-KR')}
                                </div>
                              ) : null}
                            </td>
                            <td className="py-2 px-2">
                              {order.scheduledDate ? (
                                <div 
                                  className="text-xs text-blue-600 cursor-pointer hover:bg-blue-50 px-1 py-1 rounded border border-transparent hover:border-blue-200"
                                  title="클릭하여 예약발송일 수정"
                                >
                                  {new Date(order.scheduledDate).toLocaleDateString('ko-KR')}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              <div className="font-medium text-gray-900 text-xs">{order.customerName}</div>
                              {order.recipientName && order.recipientName !== order.customerName && (
                                <div className="text-xs text-blue-600">받는분: {order.recipientName}</div>
                              )}
                            </td>
                            <td className="py-2 px-2 min-w-[80px]">
                              <div className="text-xs space-y-0.5">
                                {order.smallBoxQuantity > 0 && (
                                  <div>{getProductName(0, '한과1호')}×{order.smallBoxQuantity}개</div>
                                )}
                                {order.largeBoxQuantity > 0 && (
                                  <div>{getProductName(1, '한과2호')}×{order.largeBoxQuantity}개</div>
                                )}
                                {order.wrappingQuantity > 0 && (
                                  <div>{getProductName(2, '보자기')}×{order.wrappingQuantity}개</div>
                                )}
                                {renderDynamicProducts(order)}
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <div className="text-xs text-gray-900">{order.customerPhone}</div>
                            </td>
                            <td className="py-2 px-2 max-w-xs">
                              <div>
                                <div 
                                  className="text-xs text-gray-900 cursor-pointer hover:bg-blue-50 px-1 py-1 rounded border border-transparent hover:border-blue-200 truncate"
                                  title="클릭하여 전체 주소 보기"
                                >
                                  {order.address1.length > 15 ? `${order.address1.substring(0, 15)}...` : order.address1}
                                </div>
                                {checkRemoteArea(order.address1) && (
                                  <div className="text-xs text-red-600 font-bold mt-1">배송비추가</div>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div className="text-xs">
                                {order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && order.paymentStatus === 'confirmed' ? (
                                  <span className="text-yellow-600 font-medium">부분결제</span>
                                ) : order.paymentStatus === 'confirmed' ? (
                                  <span className="text-green-600 font-medium">입금완료</span>
                                ) : order.paymentStatus === 'partial' ? (
                                  <span className="text-yellow-600 font-medium">부분결제</span>
                                ) : order.paymentStatus === 'refunded' ? (
                                  <span className="text-red-600 font-medium">환불</span>
                                ) : (
                                  <span className="text-red-600 font-medium">입금대기</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <Select
                                value={order.status}
                                onValueChange={(value) => updateOrderStatusMutation.mutate({ id: order.id, status: value })}
                                disabled={updateOrderStatusMutation.isPending}
                              >
                                <SelectTrigger className="w-28 h-6 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="scheduled">
                                    <div className="flex items-center space-x-1">
                                      <Calendar className="h-3 w-3 text-blue-500" />
                                      <span>발송주문</span>
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
                              <div className="flex flex-col items-center gap-2">
                                {order.sellerShipped ? (
                                  <div className="text-center">
                                    <div 
                                      className="text-green-600 font-medium text-xs cursor-pointer hover:bg-green-50 px-2 py-1 rounded border border-transparent hover:border-green-200"
                                      onClick={() => updateSellerShippedMutation.mutate({ 
                                        id: order.id, 
                                        sellerShipped: false 
                                      })}
                                      title="클릭하여 발송 상태 취소"
                                    >
                                      매니저발송완료
                                    </div>
                                    <div className="text-gray-500 mt-1 text-xs">
                                      {order.sellerShippedDate ? 
                                        new Date(order.sellerShippedDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) :
                                        new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
                                      }
                                    </div>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateSellerShippedMutation.mutate({ 
                                      id: order.id, 
                                      sellerShipped: true 
                                    })}
                                    className="text-xs px-2 py-1 h-7"
                                  >
                                    발송처리
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div className="flex flex-col gap-1">
                                <SmsDialog order={order}>
                                  <Button size="sm" variant="outline" className="flex items-center gap-1 w-full">
                                    <MessageSquare className="h-3 w-3" />
                                    SMS
                                  </Button>
                                </SmsDialog>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {filteredOrders.filter(o => o.sellerShipped).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        매니저발송완료된 주문이 없습니다.
                      </div>
                    )}
                  </div>

                  {/* 모바일 리스트 뷰 */}
                  <div className="md:hidden space-y-2 p-2">
                    {filteredOrders.filter(o => o.sellerShipped).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        매니저발송완료된 주문이 없습니다.
                      </div>
                    ) : (
                      filteredOrders.filter(o => o.sellerShipped).map((order) => (
                        <div key={order.id} className={`border border-gray-200 rounded-lg p-3 bg-white ${
                          order.paymentStatus !== 'confirmed' ? 'border-red-200 bg-red-50' : ''
                        }`}>
                          {/* 상단: 주문번호, 이름, 날짜 */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedOrders.has(order.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedOrders);
                                  if (e.target.checked) {
                                    newSet.add(order.id);
                                  } else {
                                    newSet.delete(order.id);
                                  }
                                  setSelectedOrders(newSet);
                                }}
                                className="rounded w-4 h-4"
                              />
                              <span className="font-bold text-black text-xs">#{order.orderNumber}</span>
                              <span className="text-black text-xs">{order.customerName}</span>
                            </div>
                            <span className="text-xs text-gray-600">
                              {new Date(order.createdAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                            </span>
                          </div>

                          {/* 중간: 주문내역 */}
                          <div className="mb-2">
                            <div className="text-xs text-gray-700 space-y-0.5 mb-2">
                              {order.smallBoxQuantity > 0 && <div>{getProductName(0, '한과1호')}×{order.smallBoxQuantity}개</div>}
                              {order.largeBoxQuantity > 0 && <div>{getProductName(1, '한과2호')}×{order.largeBoxQuantity}개</div>}
                              {renderDynamicProducts(order)}
                              {order.wrappingQuantity > 0 && <div>{getProductName(2, '보자기')}×{order.wrappingQuantity}개</div>}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className={`px-2 py-0.5 rounded ${
                                order.paymentStatus === 'confirmed' ? 'bg-green-100 text-green-700' :
                                order.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                order.paymentStatus === 'refunded' ? 'bg-red-100 text-red-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && order.paymentStatus === 'confirmed' ? '부분결제' :
                                 order.paymentStatus === 'confirmed' ? '입금완료' :
                                 order.paymentStatus === 'partial' ? '부분결제' :
                                 order.paymentStatus === 'refunded' ? '환불' : '미입금'}
                              </span>
                              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                발송완료
                              </span>
                            </div>
                          </div>

                          {/* 예약발송일 */}
                          {order.scheduledDate && (
                            <div className="flex items-center gap-1 mb-2 text-xs">
                              <span className="text-gray-600">예약발송일:</span>
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                {new Date(order.scheduledDate).toLocaleDateString('ko-KR')}
                              </span>
                            </div>
                          )}

                          {/* 하단: 연락처, 주소 */}
                          <div className="text-xs text-gray-700 mb-2">
                            <div>연락처: {order.customerPhone}</div>
                            <div className="flex items-center justify-between">
                              <span>배송지: {order.address1.length > 20 ? `${order.address1.substring(0, 20)}...` : order.address1}</span>
                              {checkRemoteArea(order.address1) && (
                                <span className="text-red-600 font-bold">배송비추가</span>
                              )}
                            </div>
                            {order.sellerShippedDate && (
                              <div className="text-gray-600 mt-1">
                                발송일: {new Date(order.sellerShippedDate).toLocaleDateString('ko-KR')}
                              </div>
                            )}
                          </div>

                          {/* 하단: 상태 변경 및 액션 버튼 */}
                          <div className="flex items-center justify-between">
                            <Select
                              value={order.status}
                              onValueChange={(value) => updateOrderStatusMutation.mutate({ id: order.id, status: value })}
                              disabled={updateOrderStatusMutation.isPending}
                            >
                              <SelectTrigger className="h-7 text-xs px-2 w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="scheduled">발송주문</SelectItem>
                                <SelectItem value="delivered">발송완료</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <div className="flex items-center gap-1">
                              <div 
                                className="text-black text-xs cursor-pointer hover:bg-gray-100 px-2 py-1 rounded border border-gray-300"
                                onClick={() => updateSellerShippedMutation.mutate({ 
                                  id: order.id, 
                                  sellerShipped: false 
                                })}
                                title="클릭하여 발송 상태 취소"
                              >
                                발송완료
                              </div>
                              
                              <SmsDialog order={order}>
                                <Button size="sm" variant="outline" className="flex items-center gap-1 text-xs px-2 py-1 h-7">
                                  <MessageSquare className="h-3 w-3" />
                                  SMS
                                </Button>
                              </SmsDialog>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* SMS 일괄 발송 다이얼로그 */}
        <Dialog open={showBulkSMSDialog} onOpenChange={setShowBulkSMSDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>일괄 SMS 발송</DialogTitle>
              <DialogDescription>
                선택된 {selectedOrders.size}명의 고객에게 SMS를 발송합니다.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="smsMessage">SMS 내용</Label>
                <Textarea
                  id="smsMessage"
                  placeholder="SMS 메시지를 입력하세요..."
                  value={bulkSMSMessage}
                  onChange={(e) => setBulkSMSMessage(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowBulkSMSDialog(false)}>
                취소
              </Button>
              <Button 
                onClick={() => {
                  const selectedOrderList = filteredOrders.filter(o => selectedOrders.has(o.id));
                  const phones = selectedOrderList.map(o => o.customerPhone);
                  sendBulkSMSMutation.mutate({ phones, message: bulkSMSMessage });
                }}
                disabled={!bulkSMSMessage.trim() || sendBulkSMSMutation.isPending}
              >
                {sendBulkSMSMutation.isPending ? "발송 중..." : "SMS 발송"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}