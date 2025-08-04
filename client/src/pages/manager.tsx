import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { ArrowLeft, Settings, Package, Truck, Eye, LogOut, Download, MessageSquare } from "lucide-react";
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

  // 주문 데이터 조회 (매니저용 API 사용)
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['/api/manager/orders'],
  });

  // Seller shipped mutation
  const updateSellerShippedMutation = useMutation({
    mutationFn: ({ id, sellerShipped }: { id: number; sellerShipped: boolean }) => 
      api.orders.updateSellerShipped(id, sellerShipped),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manager/orders'] });
      toast({
        title: "발송 상태 업데이트",
        description: "매니저 발송 상태가 업데이트되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "업데이트 실패",
        description: "발송 상태 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // 일괄 판매자 발송 처리
  const bulkUpdateSellerShippedMutation = useMutation({
    mutationFn: ({ orderIds, sellerShipped }: { orderIds: number[]; sellerShipped: boolean }) =>
      api.orders.bulkUpdateSellerShipped(orderIds, sellerShipped),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manager/orders'] });
      setSelectedOrders(new Set());
      toast({
        title: "일괄 발송처리 완료",
        description: "선택된 주문들의 매니저 발송 상태가 업데이트되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "일괄 발송처리 실패",
        description: "일괄 발송처리에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(filteredOrders.map(order => order.id)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  // 개별 선택/해제
  const toggleOrderSelection = (orderId: number) => {
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedOrders(newSelection);
  };

  // 필터링된 주문 목록
  const filteredOrders = orders;

  // 발송 대기 및 완료 주문 분류
  const pendingShipmentOrders = filteredOrders.filter(order => !order.sellerShipped);
  const completedShipmentOrders = filteredOrders.filter(order => order.sellerShipped);

  // 일괄 발송처리
  const handleBulkSellerShipped = () => {
    if (selectedOrders.size === 0) return;
    
    bulkUpdateSellerShippedMutation.mutate({
      orderIds: Array.from(selectedOrders),
      sellerShipped: true
    });
  };

  // Excel 다운로드
  const downloadExcel = () => {
    const data = filteredOrders.map(order => ({
      '주문번호': order.orderNumber,
      '고객명': order.customerName,
      '고객연락처': order.customerPhone,
      '주문일': new Date(order.createdAt).toLocaleDateString('ko-KR'),
      '주문시간': new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      '한과1호': order.smallBoxQuantity,
      '한과2호': order.largeBoxQuantity,
      '보자기': order.wrappingQuantity,
      '총금액': order.totalAmount,
      '배송방법': [
        order.smallBoxQuantity + order.largeBoxQuantity >= 6 ? '무료배송' : '택배배송',
        order.pickupLocation && order.pickupLocation !== '택배배송' ? `(${order.pickupLocation})` : ''
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
                    발송처리대기 ({pendingShipmentOrders.length})
                  </TabsTrigger>
                  <TabsTrigger value="매니저발송완료">
                    매니저발송완료 ({completedShipmentOrders.length})
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
                      onClick={handleBulkSellerShipped}
                      disabled={bulkUpdateSellerShippedMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Truck className="h-3 w-3 mr-1" />
                      일괄 매니저발송처리
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedOrders(new Set())}
                    >
                      선택 해제
                    </Button>
                  </div>
                </div>
              )}

              <TabsContent value="전체보기">
                {renderOrdersTable(filteredOrders)}
              </TabsContent>

              <TabsContent value="발송처리대기">
                {renderOrdersTable(pendingShipmentOrders)}
              </TabsContent>

              <TabsContent value="매니저발송완료">
                {renderOrdersTable(completedShipmentOrders)}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* SMS 다이얼로그 */}
      <SmsDialog 
        isOpen={showBulkSMSDialog}
        onClose={() => setShowBulkSMSDialog(false)}
        onSend={(message) => {
          console.log('Sending SMS to selected orders:', message);
          setShowBulkSMSDialog(false);
        }}
        recipientCount={selectedOrders.size}
      />
    </div>
  );

  function renderOrdersTable(ordersList: Order[]) {
    if (ordersList.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          해당하는 주문이 없습니다.
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Header with select all */}
        <div className="bg-gray-50 border-b px-4 py-3 flex items-center gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedOrders.size === ordersList.length && ordersList.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              전체 선택 ({selectedOrders.size}/{ordersList.length})
            </span>
          </label>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr className="text-xs text-gray-600">
                <th className="py-2 px-2 text-left w-8"></th>
                <th className="py-2 px-2 text-left">주문번호</th>
                <th className="py-2 px-2 text-left">고객명</th>
                <th className="py-2 px-2 text-left">연락처</th>
                <th className="py-2 px-2 text-left">주소</th>
                <th className="py-2 px-2 text-center">입금상태</th>
                <th className="py-2 px-2 text-center">주문상태</th>
                <th className="py-2 px-2 text-center">매니저발송</th>
                <th className="py-2 px-2 text-center">SMS</th>
              </tr>
            </thead>
            <tbody>
              {ordersList.map((order) => (
                <tr key={order.id} className={`border-b hover:bg-gray-50 ${
                  selectedOrders.has(order.id) ? 'bg-blue-50' : ''
                } ${order.paymentStatus === 'pending' || order.paymentStatus === 'partial' ? 'text-red-600' : ''}`}>
                  <td className="py-2 px-2">
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleOrderSelection(order.id)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <div className="text-xs font-medium text-gray-900">{order.orderNumber}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="text-xs text-gray-900">{order.customerName}</div>
                    <div className="text-xs text-gray-500">
                      한과1호 {order.smallBoxQuantity}개, 한과2호 {order.largeBoxQuantity}개
                      {order.wrappingQuantity > 0 && `, 보자기 ${order.wrappingQuantity}개`}
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="text-xs text-gray-900">{order.customerPhone}</div>
                  </td>
                  <td className="py-2 px-2 max-w-xs">
                    <div>
                      <div className="text-xs text-gray-900 truncate">
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
                    <div className="text-xs">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status === 'scheduled' ? '발송주문' :
                         order.status === 'delivered' ? '발송완료' :
                         order.status === 'cancelled' ? '취소' :
                         order.status}
                      </span>
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
                              new Date(order.sellerShippedDate).toLocaleDateString('ko-KR') : ''}
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => updateSellerShippedMutation.mutate({ 
                            id: order.id, 
                            sellerShipped: true 
                          })}
                          disabled={updateSellerShippedMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-700 text-white h-6 px-2 text-xs"
                        >
                          <Truck className="h-3 w-3 mr-1" />
                          매니저발송
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                    >
                      <MessageSquare className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}