import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// Manager page - read only version without Select components
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
  const { user } = useAuth();
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

  // 필터링 로직 (매니저용 - 발송주문과 발송완료만 표시)
  const filteredOrders = (orders as Order[]).filter(order => {
    // 매니저는 발송주문(scheduled)과 발송완료(delivered) 상태의 주문만 볼 수 있음
    if (order.status !== 'scheduled' && order.status !== 'delivered') {
      return false;
    }

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

  // 매니저는 주문 상태 변경 불가능

  // 판매자 발송 상태 변경 mutation
  const updateSellerShippedMutation = useMutation({
    mutationFn: async ({ id, sellerShipped }: { id: number; sellerShipped: boolean }) => {
      return api.patch(`/api/orders/${id}/seller-shipped`, { sellerShipped });
    },
    onSuccess: async (data, { id, sellerShipped }) => {
      // 서버에서 이미 상태를 처리하므로 별도 API 호출 제거
      queryClient.invalidateQueries({ queryKey: ["/api/manager/orders"] });
      toast({
        title: "발송 상태 변경",
        description: sellerShipped 
          ? "판매자 발송이 완료되고 주문상태가 발송완료로 변경되었습니다."
          : "판매자 발송 상태가 변경되었습니다.",
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

  // 매니저는 결제 상태 변경 불가능

  // 일괄 판매자 발송 mutation
  const bulkSellerShippedMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      return api.patch('/api/orders/seller-shipped', { orderIds });
    },
    onSuccess: async (data, orderIds) => {
      // 서버에서 이미 상태를 처리하므로 별도 API 호출 제거
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
      '메모': ''
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
      <AdminHeader />

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
                  <div className="flex flex-wrap items-center gap-4">
                    {/* 날짜 필터 */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium whitespace-nowrap">주문일:</label>
                      <div value={orderDateFilter} onValueChange={setOrderDateFilter}>
                        <div className="h-8 w-32 text-xs">
                          <span />
                        </div>
                        <div>
                          <div value="all">전체 기간</div>
                          <div value="today">오늘</div>
                          <div value="week">최근 7일</div>
                          <div value="month">최근 30일</div>
                          <div value="custom">사용자 지정</div>
                        </div>
                      </div>
                      
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
                      <div value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                        <div className="h-8 w-28 text-xs">
                          <span />
                        </div>
                        <div>
                          <div value="all">전체</div>
                          <div value="pending">입금대기</div>
                          <div value="confirmed">입금완료</div>
                          <div value="partial">부분결제</div>
                          <div value="refunded">환불</div>
                        </div>
                      </div>
                    </div>

                    {/* 주문 상태 필터 */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium whitespace-nowrap">주문상태:</label>
                      <div value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                        <div className="h-8 w-28 text-xs">
                          <span />
                        </div>
                        <div>
                          <div value="all">전체</div>
                          <div value="pending">주문접수</div>
                          <div value="scheduled">발송주문</div>
                          <div value="delivered">판매자발송</div>
                        </div>
                      </div>
                    </div>

                    {/* 판매자 발송 상태 필터 */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium whitespace-nowrap">판매자발송:</label>
                      <div value={sellerShippedFilter} onValueChange={setSellerShippedFilter}>
                        <div className="h-8 w-28 text-xs">
                          <span />
                        </div>
                        <div>
                          <div value="all">전체</div>
                          <div value="shipped">발송완료</div>
                          <div value="not_shipped">발송대기</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 주문 목록 테이블 */}
              <TabsContent value="전체보기" className="space-y-4">
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
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">주문번호</th>
                          <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[70px]">예약발송일</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[70px]">주문자</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">주문내역</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">연락처</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">배송지</th>
                          <th className="py-2 px-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[60px]">입금상태</th>
                          <th className="py-2 px-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[60px]">주문상태</th>
                          <th className="py-2 px-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">판매자발송</th>
                          <th className="py-2 px-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">작업</th>
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
                            <td className="py-2 px-2">
                              <div className="font-medium text-gray-900 text-xs">#{order.orderNumber}</div>
                              <div className="text-xs text-gray-500">
                                <div>{new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
                                <div>{new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
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
                              <div className="text-xs space-y-1">
                                {order.smallBoxQuantity > 0 && (
                                  <div className="text-gray-900">한과1호×{order.smallBoxQuantity}개</div>
                                )}
                                {order.largeBoxQuantity > 0 && (
                                  <div className="text-gray-900">한과2호×{order.largeBoxQuantity}개</div>
                                )}
                                {order.wrappingQuantity > 0 && (
                                  <div className="text-gray-900">보자기×{order.wrappingQuantity}개</div>
                                )}
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
                                {order.paymentStatus === 'confirmed' ? (
                                  <span className="text-green-600 font-medium">입금완료</span>
                                ) : order.paymentStatus === 'partial' ? (
                                  <span className="text-yellow-600 font-medium">부분결제</span>
                                ) : order.paymentStatus === 'refunded' ? (
                                  <span className="text-red-600 font-medium">환불</span>
                                ) : (
                                  <span className="text-red-600 font-medium">미입금</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div
                                value={order.status}
                                disabled={true}
                                disabled={true}
                              >
                                <div className="w-24 h-6 text-xs">
                                  <span />
                                </div>
                                <div>
                                  <div value="scheduled">
                                    <div className="flex items-center space-x-1">
                                      <Calendar className="h-3 w-3 text-blue-500" />
                                      <span>발송주문</span>
                                    </div>
                                  </div>
                                  <div value="delivered">
                                    <div className="flex items-center space-x-1">
                                      <CheckCircle className="h-3 w-3 text-green-500" />
                                      <span>발송완료</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
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
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-xs px-2 py-1 h-7"
                                >
                                  수정
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

              {/* 발송처리대기 탭 */}
              <TabsContent value="발송처리대기" className="space-y-4">
                <div className="bg-white border rounded-lg">
                  <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">발송처리대기 목록</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left p-3 font-medium text-gray-700 w-12">
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
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">주문번호</th>
                          <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[70px]">예약발송일</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[70px]">주문자</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">주문내역</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">연락처</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">배송지</th>
                          <th className="py-2 px-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[60px]">입금상태</th>
                          <th className="py-2 px-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[60px]">주문상태</th>
                          <th className="py-2 px-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">판매자발송</th>
                          <th className="py-2 px-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">작업</th>
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
                              <div className="text-xs space-y-1">
                                {order.smallBoxQuantity > 0 && (
                                  <div className="text-gray-900">한과1호×{order.smallBoxQuantity}개</div>
                                )}
                                {order.largeBoxQuantity > 0 && (
                                  <div className="text-gray-900">한과2호×{order.largeBoxQuantity}개</div>
                                )}
                                {order.wrappingQuantity > 0 && (
                                  <div className="text-gray-900">보자기×{order.wrappingQuantity}개</div>
                                )}
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
                                {order.paymentStatus === 'confirmed' ? (
                                  <span className="text-green-600 font-medium">입금완료</span>
                                ) : order.paymentStatus === 'partial' ? (
                                  <span className="text-orange-600 font-medium">부분결제</span>
                                ) : order.paymentStatus === 'refunded' ? (
                                  <span className="text-red-600 font-medium">환불</span>
                                ) : (
                                  <span className="text-red-600 font-medium">미입금</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div
                                value={order.status}
                                disabled={true}
                                disabled={true}
                              >
                                <div className="w-24 h-6 text-xs">
                                  <span />
                                </div>
                                <div>
                                  <div value="scheduled">
                                    <div className="flex items-center space-x-1">
                                      <Calendar className="h-3 w-3 text-blue-500" />
                                      <span>발송주문</span>
                                    </div>
                                  </div>
                                  <div value="delivered">
                                    <div className="flex items-center space-x-1">
                                      <CheckCircle className="h-3 w-3 text-green-500" />
                                      <span>발송완료</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
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
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-xs px-2 py-1 h-7"
                                >
                                  수정
                                </Button>
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
                </div>
              </TabsContent>

              {/* 매니저발송완료 탭 */}
              <TabsContent value="매니저발송완료" className="space-y-4">
                <div className="bg-white border rounded-lg">
                  <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">매니저발송완료 주문</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left p-3 font-medium text-gray-700 w-12">
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
                              className="rounded"
                            />
                          </th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">주문번호</th>
                          <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[70px]">예약발송일</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[70px]">주문자</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">주문내역</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">연락처</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">배송지</th>
                          <th className="py-2 px-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[60px]">입금상태</th>
                          <th className="py-2 px-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[60px]">주문상태</th>
                          <th className="py-2 px-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">판매자발송</th>
                          <th className="py-2 px-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">작업</th>
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
                              <div className="text-xs space-y-1">
                                {order.smallBoxQuantity > 0 && (
                                  <div className="text-gray-900">한과1호×{order.smallBoxQuantity}개</div>
                                )}
                                {order.largeBoxQuantity > 0 && (
                                  <div className="text-gray-900">한과2호×{order.largeBoxQuantity}개</div>
                                )}
                                {order.wrappingQuantity > 0 && (
                                  <div className="text-gray-900">보자기×{order.wrappingQuantity}개</div>
                                )}
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
                                {order.paymentStatus === 'confirmed' ? (
                                  <span className="text-green-600 font-medium">입금완료</span>
                                ) : order.paymentStatus === 'partial' ? (
                                  <span className="text-orange-600 font-medium">부분결제</span>
                                ) : order.paymentStatus === 'refunded' ? (
                                  <span className="text-red-600 font-medium">환불</span>
                                ) : (
                                  <span className="text-red-600 font-medium">미입금</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div
                                value={order.status}
                                disabled={true}
                                disabled={true}
                              >
                                <div className="w-24 h-6 text-xs">
                                  <span />
                                </div>
                                <div>
                                  <div value="scheduled">
                                    <div className="flex items-center space-x-1">
                                      <Calendar className="h-3 w-3 text-blue-500" />
                                      <span>발송주문</span>
                                    </div>
                                  </div>
                                  <div value="delivered">
                                    <div className="flex items-center space-x-1">
                                      <CheckCircle className="h-3 w-3 text-green-500" />
                                      <span>발송완료</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
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
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-xs px-2 py-1 h-7"
                                >
                                  수정
                                </Button>
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