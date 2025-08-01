import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Clock, Calendar, CheckCircle, Download, Eye } from "lucide-react";
import ScheduledDatePicker from "@/components/scheduled-date-picker";
import { api } from "@/lib/api";
import { Order } from "@shared/schema";
import * as XLSX from 'xlsx';

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

export default function Manager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("all");

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['/api/orders'],
    queryFn: () => api.orders.getAll(),
    refetchInterval: 5000, // Refetch every 5 seconds
    refetchIntervalInBackground: true,
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      return apiRequest(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "주문 상태 업데이트 완료",
        description: "주문 상태가 성공적으로 변경되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "상태 변경 실패",
        description: `오류: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateStatusMutation.mutate({ orderId, status: newStatus });
  };

  // Stats calculation
  const stats = {
    total: orders.length,
    pending: orders.filter((order: Order) => order.status === 'pending').length,
    scheduled: orders.filter((order: Order) => order.status === 'scheduled').length,
    delivered: orders.filter((order: Order) => order.status === 'delivered').length,
  };

  // Excel export function (no financial data)
  const handleExcelDownload = () => {
    // Group orders by status
    const ordersByStatus = {
      pending: orders.filter((order: Order) => order.status === 'pending'),
      scheduled: orders.filter((order: Order) => order.status === 'scheduled'),
      delivered: orders.filter((order: Order) => order.status === 'delivered')
    };

    // Function to format order data (without financial information)
    const formatOrderData = (orderList: Order[]) => {
      return orderList.map((order: Order) => ({
        '주문번호': order.orderNumber,
        '주문일시': new Date(order.createdAt).toLocaleString('ko-KR'),
        '고객명': order.customerName,
        '연락처': order.customerPhone,
        '우편번호': order.zipCode,
        '주소': `${order.address1} ${order.address2 || ''}`.trim(),
        '소박스수량': order.smallBoxQuantity,
        '대박스수량': order.largeBoxQuantity,
        '보자기수량': order.wrappingQuantity,
        '주문상태': statusLabels[order.status as keyof typeof statusLabels],
        '예약발송일': order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('ko-KR') : '-',
        '특별요청': order.specialRequests || '',
      }));
    };

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Add all orders sheet
    const allOrdersData = formatOrderData(orders);
    const allOrdersWs = XLSX.utils.json_to_sheet(allOrdersData);
    XLSX.utils.book_append_sheet(wb, allOrdersWs, '전체주문');
    
    // Add individual status sheets
    if (ordersByStatus.pending.length > 0) {
      const pendingData = formatOrderData(ordersByStatus.pending);
      const pendingWs = XLSX.utils.json_to_sheet(pendingData);
      XLSX.utils.book_append_sheet(wb, pendingWs, '주문접수');
    }
    
    if (ordersByStatus.scheduled.length > 0) {
      const scheduledData = formatOrderData(ordersByStatus.scheduled);
      const scheduledWs = XLSX.utils.json_to_sheet(scheduledData);
      XLSX.utils.book_append_sheet(wb, scheduledWs, '발송예약');
    }
    
    if (ordersByStatus.delivered.length > 0) {
      const deliveredData = formatOrderData(ordersByStatus.delivered);
      const deliveredWs = XLSX.utils.json_to_sheet(deliveredData);
      XLSX.utils.book_append_sheet(wb, deliveredWs, '발송완료');
    }
    
    const fileName = `에덴한과_배송목록_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "엑셀 다운로드 완료",
      description: "주문목록이 상태별 시트로 다운로드되었습니다.",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-eden-cream via-white to-eden-cream/30">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-eden-brown mx-auto mb-4"></div>
            <div className="text-gray-600">주문 목록을 불러오는 중...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-eden-cream via-white to-eden-cream/30">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-red-500 mb-4">오류가 발생했습니다</div>
            <div className="text-gray-600 mb-4">{(error as Error).message}</div>
            <Button onClick={() => window.location.reload()}>다시 시도</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-eden-cream via-white to-eden-cream/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-eden-brown to-eden-brown/90 text-white shadow-lg">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center py-4 sm:py-6">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/">
                <Button variant="ghost" className="text-white hover:text-gray-200 p-2">
                  ← 홈으로
                </Button>
              </Link>
              <h1 className="text-xl sm:text-3xl font-bold font-korean">
                매니저 관리
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                onClick={handleExcelDownload}
                variant="ghost" 
                className="text-white hover:text-gray-200 p-2 sm:px-4 sm:py-2"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">엑셀 다운로드</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 sm:p-6">
        {/* Stats Overview (excluding payment stats) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <Card>
            <CardContent className="p-2 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-xs sm:text-sm text-gray-600">총 주문</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2 sm:p-4 text-center bg-yellow-50">
              <div className="text-lg sm:text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-xs sm:text-sm text-gray-600">주문접수</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2 sm:p-4 text-center bg-blue-50">
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.scheduled}</div>
              <div className="text-xs sm:text-sm text-gray-600">발송예약</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2 sm:p-4 text-center bg-green-50">
              <div className="text-lg sm:text-2xl font-bold text-green-600">{stats.delivered}</div>
              <div className="text-xs sm:text-sm text-gray-600">발송완료</div>
            </CardContent>
          </Card>
        </div>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle className="font-korean">주문 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                아직 주문이 없습니다.
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">전체 ({allOrders.length})</TabsTrigger>
                  <TabsTrigger value="pending">주문접수 ({pendingOrders.length})</TabsTrigger>
                  <TabsTrigger value="scheduled">예약발송 ({scheduledOrders.length})</TabsTrigger>
                  <TabsTrigger value="delivered">발송완료 ({deliveredOrders.length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="mt-6">
                  <OrdersList ordersList={allOrders} handleStatusChange={handleStatusChange} updateStatusMutation={updateStatusMutation} />
                </TabsContent>
                
                <TabsContent value="pending" className="mt-6">
                  <OrdersList ordersList={pendingOrders} handleStatusChange={handleStatusChange} updateStatusMutation={updateStatusMutation} />
                </TabsContent>
                
                <TabsContent value="scheduled" className="mt-6">
                  <OrdersList ordersList={scheduledOrders} handleStatusChange={handleStatusChange} updateStatusMutation={updateStatusMutation} />
                </TabsContent>
                
                <TabsContent value="delivered" className="mt-6">
                  <OrdersList ordersList={deliveredOrders} handleStatusChange={handleStatusChange} updateStatusMutation={updateStatusMutation} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OrdersList({ ordersList, handleStatusChange, updateStatusMutation }: { 
  ordersList: Order[], 
  handleStatusChange: (orderId: number, newStatus: string) => void,
  updateStatusMutation: any 
}) {
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
              <th className="text-left py-3 px-4 font-medium text-gray-600">고객명</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">연락처</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">배송주소</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">상품</th>
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
                    {order.scheduledDate && (
                      <div className="mt-1">
                        <div className="text-red-600 font-bold text-sm">
                          예약발송 {new Date(order.scheduledDate).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit', 
                            day: '2-digit',
                            weekday: 'short'
                          })}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">{order.customerName}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-sm text-gray-900">{order.customerPhone}</div>
                  </td>
                  <td className="py-4 px-4 max-w-xs">
                    <div className="text-sm text-gray-900">
                      <div className="mb-1">[{order.zipCode}]</div>
                      <div className="mb-1">{order.address1}</div>
                      <div>{order.address2}</div>
                    </div>
                  </td>
                  <td className="py-4 px-4 min-w-max">
                    <div className="text-sm whitespace-nowrap">
                      <span className="font-medium text-gray-900">소박스 × {order.smallBoxQuantity}개</span>
                      <span className="mx-2 text-gray-400">|</span>
                      <span className="font-medium text-gray-900">대박스 × {order.largeBoxQuantity}개</span>
                      <span className="mx-2 text-gray-400">|</span>
                      <span className={order.wrappingQuantity > 0 ? "font-medium text-eden-brown" : "text-gray-500"}>
                        보자기 × {order.wrappingQuantity}개
                      </span>
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
                      <ScheduledDatePicker order={order} />
                      <Link href={`/order-edit/${order.id}`}>
                        <Button size="sm" variant="outline" className="w-full">
                          <Eye className="h-4 w-4 mr-1" />
                          상세보기
                        </Button>
                      </Link>
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
                      <div className="font-medium text-gray-900">#{order.orderNumber}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                      </div>
                      {order.scheduledDate && (
                        <div className="mt-1">
                          <div className="text-red-600 font-bold text-base">
                            예약발송 {new Date(order.scheduledDate).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit', 
                              day: '2-digit',
                              weekday: 'short'
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <StatusIcon className="h-5 w-5 text-blue-500" />
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
                    <div className="space-y-1">
                      <div>[{order.zipCode}]</div>
                      <div>{order.address1}</div>
                      <div>{order.address2}</div>
                    </div>
                  </div>

                  <div className="text-sm">
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

                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex flex-col gap-3">
                      <ScheduledDatePicker order={order} />
                      <Link href={`/order-edit/${order.id}`}>
                        <Button size="sm" variant="outline" className="w-full">
                          <Eye className="h-4 w-4 mr-2" />
                          상세보기
                        </Button>
                      </Link>
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
}