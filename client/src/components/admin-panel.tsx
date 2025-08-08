import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { X, Settings, Package, Truck, CheckCircle, Clock, MessageSquare, Eye } from "lucide-react";
import type { Order } from "@shared/schema";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const statusLabels = {
  pending: "주문 접수",
  preparing: "제작 중", 
  shipping: "배송 중",
  delivered: "배송 완료",
};

const statusIcons = {
  pending: Clock,
  preparing: Package,
  shipping: Truck,
  delivered: CheckCircle,
};

export default function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['/api/orders'],
    queryFn: () => api.orders.getAll(),
    enabled: isOpen,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => 
      api.orders.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/manager/orders'] }); // 매니저 캐시도 함께 업데이트
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

  const handleStatusChange = (orderId: number, newStatus: string) => {
    // 관리자는 발송완료(delivered) 상태로 변경할 수 없음 - 매니저만 가능
    if (newStatus === 'delivered') {
      toast({
        title: "권한 없음", 
        description: "발송완료 처리는 매니저만 할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }
    updateStatusMutation.mutate({ id: orderId, status: newStatus });
  };

  // iOS 단축어 링크로 SMS 발송하는 함수
  const handleSendSMS = (order: Order) => {
    const statusMessage = getStatusMessage(order.status);
    const message = `[에덴한과] ${order.customerName}님, ${statusMessage}`;
    const input = `${order.customerPhone}/${message}`;
    const shortcutUrl = `shortcuts://run-shortcut?name=eden&input=${encodeURIComponent(input)}`;
    
    console.log('관리자 단축어 URL:', shortcutUrl);
    console.log('전화번호:', order.customerPhone);
    console.log('메시지:', message);
    console.log('입력값:', input);
    
    try {
      // 모바일에서는 location.href가 더 잘 작동할 수 있음
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        window.location.href = shortcutUrl;
      } else {
        window.open(shortcutUrl, '_blank');
      }
      
      toast({
        title: "단축어 실행",
        description: "iOS 단축어 앱을 열고 있습니다.",
      });
    } catch (error) {
      console.error('단축어 실행 오류:', error);
      toast({
        title: "단축어 실행 실패",
        description: "iOS 단축어를 실행할 수 없습니다. 단축어 앱이 설치되어 있는지 확인해주세요.",
        variant: "destructive",
      });
    }
  };

  const getStatusMessage = (status: string) => {
    const messages = {
      pending: "주문이 접수되었습니다.",
      preparing: "상품을 준비 중입니다.",
      shipping: "상품이 배송 중입니다.",
      delivered: "상품이 배송 완료되었습니다.",
    };
    return messages[status as keyof typeof messages] || "상태가 업데이트되었습니다.";
  };

  const formatPrice = (price: number) => `${price.toLocaleString()}원`;

  // Calculate stats
  const stats = orders.reduce(
    (acc, order) => {
      acc.total++;
      acc[order.status as keyof typeof acc]++;
      return acc;
    },
    { total: 0, pending: 0, preparing: 0, shipping: 0, delivered: 0 }
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Admin Header */}
        <div className="bg-eden-red text-white p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold font-korean">
            <Settings className="inline mr-3 h-6 w-6" />
            관리자 패널
          </h2>
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-white hover:text-gray-200 hover:bg-transparent"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-eden-brown mx-auto mb-4"></div>
              <p className="text-eden-dark">주문 목록을 불러오는 중...</p>
            </div>
          ) : (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card className="bg-gray-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-gray-600">{stats.total}</div>
                    <div className="admin-text-xs text-gray-600">총 주문</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-gray-600">{stats.delivered}</div>
                    <div className="admin-text-xs text-gray-600">배송 완료</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-gray-600">{stats.shipping}</div>
                    <div className="admin-text-xs text-gray-600">배송 중</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
                    <div className="admin-text-xs text-gray-600">대기 중</div>
                  </CardContent>
                </Card>
              </div>

              {/* Orders Table */}
              <Card>
                <CardHeader className="bg-gray-50">
                  <CardTitle className="font-korean">주문 목록</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {orders.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      아직 주문이 없습니다.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-4 px-4 text-left font-semibold text-gray-800 min-w-[100px]">주문번호</th>
                            <th className="text-center py-4 px-4 font-semibold text-gray-800 min-w-[90px]">예약발송</th>
                            <th className="py-4 px-4 text-left font-semibold text-gray-800 min-w-[90px]">주문자</th>
                            <th className="py-4 px-4 text-left font-semibold text-gray-800 min-w-[90px]">예금자</th>
                            <th className="py-4 px-4 text-left font-semibold text-gray-800 min-w-[100px]">주문내역</th>
                            <th className="py-4 px-4 text-left font-semibold text-gray-800 min-w-[100px]">연락처</th>
                            <th className="py-4 px-4 text-left font-semibold text-gray-800 min-w-[140px]">배송주소</th>
                            <th className="py-4 px-4 text-left font-semibold text-gray-800 min-w-[80px]">메모</th>
                            <th className="py-4 px-4 text-center font-semibold text-gray-800 min-w-[80px]">매출</th>
                            <th className="py-4 px-4 text-center font-semibold text-gray-800 min-w-[80px]">실입금</th>
                            <th className="py-4 px-4 text-center font-semibold text-gray-800 min-w-[80px]">할인/미결제</th>
                            <th className="py-4 px-4 text-center font-semibold text-gray-800 min-w-[80px]">입금상태</th>
                            <th className="py-4 px-4 text-center font-semibold text-gray-800 min-w-[80px]">주문상태</th>
                            <th className="py-4 px-4 text-center font-semibold text-gray-800 min-w-[100px]">판매자발송</th>
                            <th className="py-4 px-4 text-center font-semibold text-gray-800 min-w-[100px]">관리</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {orders.map((order) => {
                            const StatusIcon = statusIcons[order.status as keyof typeof statusIcons];
                            const formatPrice = (price: number) => new Intl.NumberFormat('ko-KR').format(price) + '원';
                            const getProductName = (index: number, defaultName: string) => {
                              // 여기서는 간단히 기본 이름을 사용
                              return defaultName;
                            };
                            const checkRemoteArea = (address: string) => {
                              const remoteKeywords = ['제주', '울릉', '독도', '강화', '백령', '연평', '흑산', '진도', '가파', '영도'];
                              return remoteKeywords.some(keyword => address.includes(keyword));
                            };
                            
                            return (
                              <tr key={order.id} className={`border-b border-gray-200 hover:bg-gray-50 ${
                                order.paymentStatus !== 'confirmed' ? 'bg-red-50' : ''
                              }`}>
                                {/* 주문번호 */}
                                <td className="py-4 px-4">
                                  <div className="font-semibold text-gray-900 admin-text-xxs">#{order.orderNumber}</div>
                                  <div className="admin-text-xxs text-gray-600">
                                    <div className="font-medium">{new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
                                    <div className="admin-text-xxs text-gray-500">{new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
                                  </div>
                                </td>
                                
                                {/* 예약발송 */}
                                <td className="py-2 px-2 text-center">
                                  {order.scheduledDate ? (
                                    <div className="admin-text-xxs text-blue-600">
                                      {new Date(order.scheduledDate).toLocaleDateString('ko-KR')}
                                    </div>
                                  ) : (
                                    <span className="admin-text-xxs text-gray-400">-</span>
                                  )}
                                </td>
                                
                                {/* 주문자 */}
                                <td className="py-2 px-2">
                                  <div className="font-medium text-gray-900 admin-text-xxs">{order.customerName}</div>
                                  {order.recipientName && order.recipientName !== order.customerName && (
                                    <div className="admin-text-xxs text-blue-600">받는분: {order.recipientName}</div>
                                  )}
                                </td>
                                
                                {/* 예금자 */}
                                <td className="py-2 px-2">
                                  <div className="admin-text-xxs text-gray-900">
                                    {order.depositorName || order.customerName}
                                  </div>
                                </td>
                                
                                {/* 주문내역 */}
                                <td className="py-2 px-2 min-w-[80px]">
                                  <div className="admin-text-xxs space-y-0.5">
                                    {order.smallBoxQuantity > 0 && (
                                      <div>{getProductName(0, '한과1호')}×{order.smallBoxQuantity}개</div>
                                    )}
                                    {order.largeBoxQuantity > 0 && (
                                      <div>{getProductName(1, '한과2호')}×{order.largeBoxQuantity}개</div>
                                    )}
                                    {order.wrappingQuantity > 0 && (
                                      <div>{getProductName(2, '보자기')}×{order.wrappingQuantity}개</div>
                                    )}
                                  </div>
                                </td>
                                
                                {/* 연락처 */}
                                <td className="py-2 px-2">
                                  <div className="admin-text-xxs text-gray-900">{order.customerPhone}</div>
                                </td>
                                
                                {/* 배송주소 */}
                                <td className="py-2 px-2 max-w-xs">
                                  <div>
                                    <div className="admin-text-xxs text-gray-900 truncate">
                                      {order.address1.length > 15 ? `${order.address1.substring(0, 15)}...` : order.address1}
                                    </div>
                                    {checkRemoteArea(order.address1) && (
                                      <div className="admin-text-xxs text-red-600 font-bold mt-1">배송비추가</div>
                                    )}
                                  </div>
                                </td>
                                
                                {/* 메모 */}
                                <td className="py-2 px-2">
                                  <div className="admin-text-xxs text-gray-900 truncate max-w-20">
                                    {order.specialRequests || '-'}
                                  </div>
                                </td>
                                
                                {/* 매출 */}
                                <td className="py-2 px-2 text-center">
                                  <div className="admin-text-xxs font-medium text-gray-900">
                                    {formatPrice(order.totalAmount)}
                                  </div>
                                </td>
                                
                                {/* 실입금 */}
                                <td className="py-2 px-2 text-center">
                                  <div className="admin-text-xxs text-gray-900">
                                    {formatPrice(order.actualPaidAmount || order.totalAmount)}
                                  </div>
                                </td>
                                
                                {/* 할인/미결제 */}
                                <td className="py-2 px-2 text-center">
                                  <div className="admin-text-xxs">
                                    {order.discountAmount ? (
                                      <span className="text-blue-600">-{formatPrice(order.discountAmount)}</span>
                                    ) : order.actualPaidAmount && order.actualPaidAmount < order.totalAmount ? (
                                      <span className="text-red-600">{formatPrice(order.totalAmount - order.actualPaidAmount)}</span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </div>
                                </td>
                                
                                {/* 입금상태 */}
                                <td className="py-2 px-2 text-center">
                                  <div className="admin-text-xxs">
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
                                
                                {/* 주문상태 */}
                                <td className="py-2 px-2 text-center">
                                  <Select
                                    value={order.status}
                                    onValueChange={(newStatus) => handleStatusChange(order.id, newStatus)}
                                    disabled={updateStatusMutation.isPending}
                                  >
                                    <SelectTrigger className="w-28 h-6 admin-text-xxs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">주문접수</SelectItem>
                                      <SelectItem value="scheduled">발송주문</SelectItem>
                                      <SelectItem value="preparing">제작중</SelectItem>
                                      <SelectItem value="shipping">배송중</SelectItem>
                                      {/* 관리자는 발송완료로 변경할 수 없음 - 매니저만 가능 */}
                                    </SelectContent>
                                  </Select>
                                </td>
                                
                                {/* 판매자발송 */}
                                <td className="py-2 px-2 text-center">
                                  <div className="admin-text-xxs">
                                    {order.sellerShipped ? (
                                      <span className="text-green-600 font-medium">발송완료</span>
                                    ) : (
                                      <span className="text-gray-400">발송대기</span>
                                    )}
                                  </div>
                                </td>
                                
                                {/* 관리 */}
                                <td className="py-2 px-2 text-center">
                                  <div className="flex flex-col gap-1">
                                    <Button
                                      size="sm"
                                      onClick={() => handleSendSMS(order)}
                                      className="bg-green-500 text-white hover:bg-green-600 admin-text-xxs px-2 py-1 h-6"
                                    >
                                      SMS
                                    </Button>
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setSelectedOrder(order)}
                                          className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white admin-text-xxs px-2 py-1 h-6"
                                        >
                                          상세
                                        </Button>
                                      </DialogTrigger>
                                    <DialogContent className="max-w-md">
                                      <DialogHeader>
                                        <DialogTitle className="font-korean">
                                          주문 상세 - #{order.orderNumber}
                                        </DialogTitle>
                                      </DialogHeader>
                                      {selectedOrder && (
                                        <div className="space-y-4">
                                          <div>
                                            <h4 className="font-semibold text-gray-900">고객 정보</h4>
                                            <p className="admin-text-xs text-gray-600">이름: {selectedOrder.customerName}</p>
                                            <p className="admin-text-xs text-gray-600">전화번호: {selectedOrder.customerPhone}</p>
                                          </div>
                                          <div>
                                            <h4 className="font-semibold text-gray-900">배송 주소</h4>
                                            <p className="admin-text-xs text-gray-600">
                                              {selectedOrder.zipCode && `${selectedOrder.zipCode} `}
                                              {selectedOrder.address1} {selectedOrder.address2}
                                            </p>
                                          </div>
                                          <div>
                                            <h4 className="font-semibold text-gray-900">주문 내용</h4>
                                            <p className="admin-text-xs text-gray-600">
                                              {selectedOrder.boxSize === 'small' ? '소박스' : '대박스'} × {selectedOrder.quantity}
                                            </p>
                                            <p className="admin-text-xs text-gray-600">
                                              보자기: {selectedOrder.hasWrapping === 'yes' ? '있음' : '없음'}
                                            </p>
                                            <p className="admin-text-xs font-semibold text-gray-900">
                                              총 금액: {new Intl.NumberFormat('ko-KR').format(selectedOrder.totalAmount)}원
                                            </p>
                                          </div>
                                          {selectedOrder.specialRequests && (
                                            <div>
                                              <h4 className="font-semibold text-gray-900">요청사항</h4>
                                              <p className="admin-text-xs text-gray-600">{selectedOrder.specialRequests}</p>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </DialogContent>
                                  </Dialog>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
