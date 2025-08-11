import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Order } from "@shared/schema";
import { 
  Truck, 
  Download, 
  MessageSquare, 
  CheckCircle, 
  Calendar,
  Phone,
  MapPin,
  Package,
  User,
  Clock
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AdminHeader from "@/components/admin-header";
import { SmsDialog } from "@/components/sms-dialog";
import * as XLSX from 'xlsx';

export default function ManagerOptimized() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());

  // 필터 상태
  const [orderDateFilter, setOrderDateFilter] = useState("all");
  const [customerNameFilter, setCustomerNameFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [sellerShippedFilter, setSellerShippedFilter] = useState("all");

  // 매니저용 주문 데이터
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["/api/manager/orders"],
  });

  const { data: adminSettings } = useQuery({
    queryKey: ["/api/admin-settings"],
  });

  const { data: contentData } = useQuery({
    queryKey: ['/api/dashboard-content'],
    staleTime: 1000 * 60 * 5,
  });

  // 대시보드 콘텐츠 파싱
  const dashboardContent = Array.isArray(contentData) ? contentData.reduce((acc: any, item: any) => {
    acc[item.key] = item.value;
    return acc;
  }, {}) : {};

  // 상품명 파싱
  const getProductNames = () => {
    try {
      if (!dashboardContent.productNames) return [];
      if (typeof dashboardContent.productNames === 'string') {
        return JSON.parse(dashboardContent.productNames);
      }
      return Array.isArray(dashboardContent.productNames) ? dashboardContent.productNames : [];
    } catch (error) {
      console.error('Error parsing product names:', error);
      return [];
    }
  };

  const productNames = getProductNames();

  const getProductName = (index: number, fallback: string) => {
    if (productNames && productNames[index]) {
      return productNames[index].name;
    }
    return fallback;
  };

  // 주문 상태 업데이트 뮤테이션
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update order status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/orders"] });
      toast({ title: "주문 상태가 업데이트되었습니다." });
    },
  });

  // 판매자 발송 상태 업데이트
  const updateSellerShippedMutation = useMutation({
    mutationFn: async ({ id, sellerShipped }: { id: number; sellerShipped: boolean }) => {
      const response = await fetch(`/api/orders/${id}/seller-shipped`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerShipped }),
      });
      if (!response.ok) throw new Error("Failed to update seller shipped status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/orders"] });
    },
  });

  // 주문내역 렌더링 - 상품별 한 줄씩
  const renderOrderItems = (order: Order) => {
    const items = [];
    
    if (order.smallBoxQuantity > 0) {
      items.push(
        <div key="small" className="py-1 px-2 bg-blue-50 rounded-sm mb-1">
          <span className="text-sm font-medium">{getProductName(0, '한과1호')}</span>
          <span className="ml-2 text-sm">×{order.smallBoxQuantity}개</span>
        </div>
      );
    }
    
    if (order.largeBoxQuantity > 0) {
      items.push(
        <div key="large" className="py-1 px-2 bg-green-50 rounded-sm mb-1">
          <span className="text-sm font-medium">{getProductName(1, '한과2호')}</span>
          <span className="ml-2 text-sm">×{order.largeBoxQuantity}개</span>
        </div>
      );
    }
    
    if (order.wrappingQuantity > 0) {
      items.push(
        <div key="wrapping" className="py-1 px-2 bg-purple-50 rounded-sm mb-1">
          <span className="text-sm font-medium">{getProductName(2, '보자기')}</span>
          <span className="ml-2 text-sm">×{order.wrappingQuantity}개</span>
        </div>
      );
    }

    // 동적 상품 처리
    if (order.dynamicProductQuantities) {
      try {
        const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
          ? JSON.parse(order.dynamicProductQuantities) 
          : order.dynamicProductQuantities;
        
        Object.entries(dynamicQty || {}).forEach(([index, quantity]) => {
          const productIndex = parseInt(index);
          const qty = Number(quantity);
          
          if (qty > 0) {
            const productName = getProductName(productIndex, `상품${productIndex + 1}`);
            items.push(
              <div key={`dynamic-${productIndex}`} className="py-1 px-2 bg-yellow-50 rounded-sm mb-1">
                <span className="text-sm font-medium">{productName}</span>
                <span className="ml-2 text-sm">×{qty}개</span>
              </div>
            );
          }
        });
      } catch (error) {
        console.error('Dynamic product quantities parse error:', error);
      }
    }

    return items.length > 0 ? items : <span className="text-gray-400">주문 없음</span>;
  };

  // 원격지 확인
  const checkRemoteArea = (address: string) => {
    const remoteKeywords = ['제주도', '울릉도', '독도', '강화도', '백령도', '연평도', '흑산도', '진도', '가파리', '영도'];
    return remoteKeywords.some(keyword => address.includes(keyword));
  };

  // 필터링된 주문 목록
  const filteredOrders = (orders as Order[]).filter(order => {
    if (customerNameFilter && !order.customerName.toLowerCase().includes(customerNameFilter.toLowerCase())) {
      return false;
    }
    if (paymentStatusFilter !== 'all' && order.paymentStatus !== paymentStatusFilter) {
      return false;
    }
    if (sellerShippedFilter === 'shipped' && !order.sellerShipped) {
      return false;
    }
    if (sellerShippedFilter === 'not_shipped' && order.sellerShipped) {
      return false;
    }
    return true;
  });

  // 엑셀 다운로드
  const exportToExcel = (ordersList: Order[], fileName: string) => {
    const excelData = ordersList.map(order => ({
      '주문번호': order.orderNumber,
      '예약발송일': order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('ko-KR') : '',
      '주문자': order.customerName,
      '주문내역': [
        order.smallBoxQuantity > 0 ? `${getProductName(0, '한과1호')}×${order.smallBoxQuantity}개` : '',
        order.largeBoxQuantity > 0 ? `${getProductName(1, '한과2호')}×${order.largeBoxQuantity}개` : '',
        order.wrappingQuantity > 0 ? `${getProductName(2, '보자기')}×${order.wrappingQuantity}개` : '',
      ].filter(Boolean).join('\n'),
      '연락처': order.customerPhone,
      '배송지': `${order.address1} ${order.address2 || ''}`.trim(),
      '판매자발송': order.sellerShipped ? '발송완료' : '발송대기'
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // 스타일 설정
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const orderDetailsCellAddress = XLSX.utils.encode_cell({ r: R, c: 3 });
      if (ws[orderDetailsCellAddress] && ws[orderDetailsCellAddress].v) {
        ws[orderDetailsCellAddress].v = ws[orderDetailsCellAddress].v.toString();
        if (!ws[orderDetailsCellAddress].s) ws[orderDetailsCellAddress].s = {};
        ws[orderDetailsCellAddress].s.alignment = { 
          wrapText: true, 
          vertical: 'top',
          horizontal: 'left'
        };
      }
    }

    // 행 높이 및 컬럼 너비 설정
    if (!ws['!rows']) ws['!rows'] = [];
    for (let R = 1; R <= range.e.r; ++R) {
      ws['!rows'][R] = { hpt: 60 };
    }

    ws['!cols'] = [
      { width: 15 }, // 주문번호
      { width: 15 }, // 예약발송일
      { width: 12 }, // 주문자
      { width: 35 }, // 주문내역
      { width: 15 }, // 연락처
      { width: 45 }, // 배송지
      { width: 12 }  // 판매자발송
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "매니저_주문목록");
    
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${fileName}_${today}.xlsx`, {
      cellStyles: true,
      bookType: 'xlsx'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader user={user} onLogout={logout} />
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {user?.role === 'manager' ? '매니저 패널' : '관리자 패널'}
          </h1>
          <p className="text-gray-600 mt-2">주문 관리 및 발송 처리</p>
        </div>

        {/* 필터 섹션 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">필터</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">고객명</label>
                <Input
                  placeholder="검색"
                  value={customerNameFilter}
                  onChange={(e) => setCustomerNameFilter(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">결제상태</label>
                <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="pending">입금대기</SelectItem>
                    <SelectItem value="confirmed">입금완료</SelectItem>
                    <SelectItem value="partial">부분결제</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">발송상태</label>
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
              <div className="flex items-end">
                <Button
                  onClick={() => exportToExcel(filteredOrders, "매니저_주문목록")}
                  className="h-9"
                >
                  <Download className="h-4 w-4 mr-2" />
                  엑셀 다운로드
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 주문 목록 */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">
                주문 목록 (총 {filteredOrders.length}개)
              </CardTitle>
              {filteredOrders.filter(o => !o.sellerShipped).length > 0 && (
                <Button
                  onClick={() => {
                    const unshippedOrders = filteredOrders.filter(o => !o.sellerShipped);
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
                    });
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  일괄발송처리 ({filteredOrders.filter(o => !o.sellerShipped).length})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className={`border rounded-lg p-4 ${
                    order.paymentStatus !== 'confirmed' ? 'border-red-200 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  {/* 상단 정보 */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3">
                    <div className="flex items-center gap-4 mb-2 md:mb-0">
                      <div className="font-semibold text-lg">#{order.orderNumber}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                      </div>
                      {order.scheduledDate && (
                        <Badge variant="outline" className="text-blue-600">
                          <Clock className="h-3 w-3 mr-1" />
                          {new Date(order.scheduledDate).toLocaleDateString('ko-KR')}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={order.paymentStatus === 'confirmed' ? 'default' : 'destructive'}
                      >
                        {order.paymentStatus === 'confirmed' ? '입금완료' : '입금대기'}
                      </Badge>
                      
                      {order.sellerShipped ? (
                        <Badge variant="default" className="bg-green-600">발송완료</Badge>
                      ) : (
                        <Badge variant="outline">발송대기</Badge>
                      )}
                    </div>
                  </div>

                  {/* 주문자 정보 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{order.customerName}</span>
                      {order.recipientName && order.recipientName !== order.customerName && (
                        <span className="text-blue-600 text-sm">→ {order.recipientName}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{order.customerPhone}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="truncate">{order.address1}</span>
                      {checkRemoteArea(order.address1) && (
                        <span className="text-red-600 font-bold text-sm">배송비추가</span>
                      )}
                    </div>
                  </div>

                  {/* 주문내역 - 상품별 한 줄씩 */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">주문내역</span>
                    </div>
                    <div className="ml-6 space-y-1">
                      {renderOrderItems(order)}
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Select
                        value={order.status}
                        onValueChange={(value) => updateOrderStatusMutation.mutate({ id: order.id, status: value })}
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">발송주문</SelectItem>
                          <SelectItem value="delivered">발송완료</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {!order.sellerShipped ? (
                        <Button
                          size="sm"
                          onClick={() => updateSellerShippedMutation.mutate({ 
                            id: order.id, 
                            sellerShipped: true 
                          })}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Truck className="h-3 w-3 mr-1" />
                          발송처리
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateSellerShippedMutation.mutate({ 
                            id: order.id, 
                            sellerShipped: false 
                          })}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          처리완료
                        </Button>
                      )}
                      
                      <SmsDialog order={order}>
                        <Button size="sm" variant="outline">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          SMS
                        </Button>
                      </SmsDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}