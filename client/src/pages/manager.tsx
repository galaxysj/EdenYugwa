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
import { ArrowLeft, Settings, Package, Truck, CheckCircle, Clock, Eye, LogOut, DollarSign, AlertCircle, Download, Calendar, Trash2, PiggyBank, Edit, Cog, RefreshCw, X, Users, Key, MessageSquare } from "lucide-react";
import { SmsDialog } from "@/components/sms-dialog";
import { AdminHeader } from "@/components/admin-header";
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
  const [showBulkSMSDialog, setShowBulkSMSDialog] = useState(false);
  const [bulkSMSMessage, setBulkSMSMessage] = useState('');
  const [currentPage, setCurrentPage] = useState("orders");

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

  // 필터링 로직 (관리자와 동일)
  const filteredOrders = (orders as Order[]).filter(order => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/orders"] });
      toast({
        title: "발송 상태 변경",
        description: "판매자 발송 상태가 변경되었습니다.",
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/orders"] });
      toast({
        title: "일괄 발송 처리 완료",
        description: `${selectedOrders.size}개 주문이 발송 처리되었습니다.`,
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

  // Excel 다운로드 함수 (매니저용 - 금액 정보 제외)
  const downloadExcel = () => {
    const data = filteredOrders.map(order => ({
      '주문번호': order.orderNumber,
      '고객명': order.customerName,
      '연락처': order.customerPhone,
      '주문일': new Date(order.createdAt).toLocaleDateString('ko-KR'),
      '상품': [
        order.smallBoxQuantity > 0 ? `한과1호×${order.smallBoxQuantity}개` : '',
        order.largeBoxQuantity > 0 ? `한과2호×${order.largeBoxQuantity}개` : '',
        order.wrappingQuantity > 0 ? `보자기×${order.wrappingQuantity}개` : ''
      ].filter(Boolean).join(', '),
      '입금상태': order.paymentStatus === 'confirmed' ? '입금완료' : 
                 order.paymentStatus === 'partial' ? '부분결제' :
                 order.paymentStatus === 'refunded' ? '환불' : '입금대기',
      '주문상태': statusLabels[order.status as keyof typeof statusLabels],
      '배송주소': `${order.address1} ${order.address2}`,
      '판매자발송': order.sellerShipped ? '발송완료' : '발송대기',
      '발송일정': order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('ko-KR') : '',
      '발송완료일': order.deliveredDate ? new Date(order.deliveredDate).toLocaleDateString('ko-KR') : '',
      '판매자발송일': order.sellerShippedDate ? new Date(order.sellerShippedDate).toLocaleDateString('ko-KR') : '',
      '메모': order.memo || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "주문목록");
    XLSX.writeFile(wb, `주문목록_${new Date().toLocaleDateString('ko-KR')}.xlsx`);
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
        user={user} 
        adminSettings={adminSettings}
        isManager={true}
      />

      <div className="container mx-auto p-4 space-y-6">
        {currentPage === "orders" && (
          <>
            {/* 상단 통계 카드들 (금액 제외) */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{orders.length}</div>
                  <div className="text-sm text-gray-600">총 주문수</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {(orders as Order[]).filter(o => o.paymentStatus === 'pending').length}
                  </div>
                  <div className="text-sm text-gray-600">입금대기</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {(orders as Order[]).filter(o => o.status === 'pending').length}
                  </div>
                  <div className="text-sm text-gray-600">주문접수</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {(orders as Order[]).filter(o => o.status === 'scheduled').length}
                  </div>
                  <div className="text-sm text-gray-600">발송예정</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {(orders as Order[]).filter(o => o.status === 'delivered').length}
                  </div>
                  <div className="text-sm text-gray-600">발송완료</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {(orders as Order[]).filter(o => o.sellerShipped).length}
                  </div>
                  <div className="text-sm text-gray-600">판매자발송</div>
                </CardContent>
              </Card>
            </div>

            {/* 주문 목록 */}
            <Tabs defaultValue="전체(6)" className="space-y-4">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="전체(6)">전체 ({filteredOrders.length})</TabsTrigger>
                  <TabsTrigger value="입금대기(0)">
                    입금대기 ({filteredOrders.filter(o => o.paymentStatus === 'pending').length})
                  </TabsTrigger>
                  <TabsTrigger value="발송예정(1)">
                    발송예정 ({filteredOrders.filter(o => o.status === 'scheduled').length})
                  </TabsTrigger>
                  <TabsTrigger value="발송완료(0)">
                    발송완료 ({filteredOrders.filter(o => o.status === 'delivered').length})
                  </TabsTrigger>
                  <TabsTrigger value="환불내역(1)">
                    환불내역 ({filteredOrders.filter(o => o.paymentStatus === 'refunded').length})
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
                <CardHeader>
                  <CardTitle className="text-lg">주문 필터링</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 날짜 필터 */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">주문일</label>
                      <Select value={orderDateFilter} onValueChange={setOrderDateFilter}>
                        <SelectTrigger className="h-9">
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
                        <div className="mt-2 space-y-2">
                          <Input
                            type="date"
                            value={orderStartDate}
                            onChange={(e) => setOrderStartDate(e.target.value)}
                            className="h-8 text-sm"
                            placeholder="시작일"
                          />
                          <Input
                            type="date"
                            value={orderEndDate}
                            onChange={(e) => setOrderEndDate(e.target.value)}
                            className="h-8 text-sm"
                            placeholder="종료일"
                          />
                        </div>
                      )}
                    </div>

                    {/* 고객명 필터 */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">고객명</label>
                      <Input
                        placeholder="고객명 검색"
                        value={customerNameFilter}
                        onChange={(e) => setCustomerNameFilter(e.target.value)}
                        className="h-9"
                      />
                    </div>

                    {/* 결제 상태 필터 */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">결제 상태</label>
                      <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                        <SelectTrigger className="h-9">
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
                    <div>
                      <label className="text-sm font-medium mb-2 block">주문 상태</label>
                      <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체</SelectItem>
                          <SelectItem value="pending">주문접수</SelectItem>
                          <SelectItem value="scheduled">발송주문</SelectItem>
                          <SelectItem value="delivered">발송완료</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 판매자 발송 상태 필터 */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">판매자 발송</label>
                      <Select value={sellerShippedFilter} onValueChange={setSellerShippedFilter}>
                        <SelectTrigger className="h-9">
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
                </CardContent>
              </Card>

              {/* 주문 목록 테이블 */}
              <TabsContent value="전체(6)" className="space-y-4">
                <div className="bg-white border rounded-lg">
                  <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">주문 목록</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left p-3 font-medium text-gray-700 w-12">
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
                              className="rounded"
                            />
                          </th>
                          <th className="text-left p-3 font-medium text-gray-700">주문번호</th>
                          <th className="text-left p-3 font-medium text-gray-700">고객정보</th>
                          <th className="text-left p-3 font-medium text-gray-700">주문일</th>
                          <th className="text-left p-3 font-medium text-gray-700">제품</th>
                          <th className="text-left p-3 font-medium text-gray-700">연락처</th>
                          <th className="text-left p-3 font-medium text-gray-700">배송지</th>
                          <th className="text-left p-3 font-medium text-gray-700">메모</th>
                          <th className="text-left p-3 font-medium text-gray-700">입금상태</th>
                          <th className="text-left p-3 font-medium text-gray-700">주문상태</th>
                          <th className="text-left p-3 font-medium text-gray-700">입금확인</th>
                          <th className="text-left p-3 font-medium text-gray-700">발송상태</th>
                          <th className="text-left p-3 font-medium text-gray-700">판매자발송</th>
                          <th className="text-left p-3 font-medium text-gray-700">관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order) => (
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
                            <td className="p-3">
                              <div className="font-medium">{order.orderNumber}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="font-medium">{order.customerName}</div>
                            </td>
                            <td className="p-3">
                              {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                            </td>
                            <td className="p-3">
                              <div className="space-y-1">
                                {order.smallBoxQuantity > 0 && <div>한과1호×{order.smallBoxQuantity}</div>}
                                {order.largeBoxQuantity > 0 && <div>한과2호×{order.largeBoxQuantity}</div>}
                                {order.wrappingQuantity > 0 && <div className="text-eden-brown">보자기×{order.wrappingQuantity}</div>}
                              </div>
                            </td>
                            <td className="p-3">{order.customerPhone}</td>
                            <td className="p-3">
                              <div className="max-w-xs">
                                <div className="truncate">{order.address1} {order.address2}</div>
                                {checkRemoteArea(order.address1) && (
                                  <div className="text-xs text-red-600 font-bold">배송비추가</div>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="max-w-xs">
                                <div className="text-xs text-gray-600 truncate">{order.memo || '-'}</div>
                              </div>
                            </td>
                            <td className="p-3">
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
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                order.status === 'delivered' 
                                  ? 'bg-green-100 text-green-800' 
                                  : order.status === 'scheduled'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {statusLabels[order.status as keyof typeof statusLabels]}
                              </span>
                            </td>
                            <td className="p-3">
                              <Select
                                value={order.paymentStatus}
                                onValueChange={(value) => updatePaymentStatusMutation.mutate({ id: order.id, paymentStatus: value })}
                              >
                                <SelectTrigger className="w-24 h-8 text-xs">
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
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                order.sellerShipped 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {order.sellerShipped ? '발송완료' : '발송대기'}
                              </span>
                            </td>
                            <td className="p-3">
                              <Button
                                size="sm"
                                variant={order.sellerShipped ? "default" : "outline"}
                                onClick={() => updateSellerShippedMutation.mutate({ 
                                  id: order.id, 
                                  sellerShipped: !order.sellerShipped 
                                })}
                                className="text-xs px-2 py-1 h-7"
                              >
                                {order.sellerShipped ? "발송완료" : "발송처리"}
                              </Button>
                            </td>
                            <td className="p-3">
                              <div className="flex gap-1">
                                <SmsDialog order={order}>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="text-xs px-2 py-1 h-7"
                                  >
                                    SMS
                                  </Button>
                                </SmsDialog>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-xs px-2 py-1 h-7"
                                >
                                  상세 관리
                                </Button>
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