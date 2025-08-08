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
                    <div className="text-sm text-gray-600">총 주문</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-gray-600">{stats.delivered}</div>
                    <div className="text-sm text-gray-600">배송 완료</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-gray-600">{stats.shipping}</div>
                    <div className="text-sm text-gray-600">배송 중</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
                    <div className="text-sm text-gray-600">대기 중</div>
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
                            <th className="px-6 py-3 text-left admin-text-xxs font-medium text-gray-500 uppercase tracking-wider">주문번호</th>
                            <th className="px-6 py-3 text-left admin-text-xxs font-medium text-gray-500 uppercase tracking-wider">고객정보</th>
                            <th className="px-6 py-3 text-left admin-text-xxs font-medium text-gray-500 uppercase tracking-wider">상품</th>
                            <th className="px-6 py-3 text-left admin-text-xxs font-medium text-gray-500 uppercase tracking-wider">금액</th>
                            <th className="px-6 py-3 text-left admin-text-xxs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                            <th className="px-6 py-3 text-left admin-text-xxs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {orders.map((order) => {
                            const StatusIcon = statusIcons[order.status as keyof typeof statusIcons];
                            return (
                              <tr key={order.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap admin-text-xxs font-medium text-gray-900">
                                  #{order.orderNumber}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="admin-text-xxs font-medium text-gray-900">{order.customerName}</div>
                                  <div className="admin-text-xxs text-gray-500">{order.customerPhone}</div>
                                  <div className="admin-text-xxs text-gray-500 truncate max-w-xs">
                                    {order.address1} {order.address2}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="admin-text-xxs text-gray-900">
                                    {order.boxSize === 'small' ? '소박스' : '대박스'} × {order.quantity}
                                  </div>
                                  <div className="admin-text-xxs text-gray-500">
                                    {order.hasWrapping === 'yes' ? '보자기 포장' : '보자기 없음'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap admin-text-xxs text-gray-900">
                                  {formatPrice(order.totalAmount)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <Select
                                    value={order.status}
                                    onValueChange={(newStatus) => handleStatusChange(order.id, newStatus)}
                                    disabled={updateStatusMutation.isPending}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">주문 접수</SelectItem>
                                      <SelectItem value="preparing">제작 중</SelectItem>
                                      <SelectItem value="shipping">배송 중</SelectItem>
                                      {/* 관리자는 발송완료로 변경할 수 없음 - 매니저만 가능 */}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap admin-text-xxs font-medium space-x-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSendSMS(order)}
                                    className="bg-green-500 text-white hover:bg-green-600"
                                  >
                                    <MessageSquare className="h-4 w-4 mr-1" />
                                    SMS
                                  </Button>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setSelectedOrder(order)}
                                        className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
                                      >
                                        <Eye className="h-4 w-4 mr-1" />
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
                                            <p className="text-sm text-gray-600">이름: {selectedOrder.customerName}</p>
                                            <p className="text-sm text-gray-600">전화번호: {selectedOrder.customerPhone}</p>
                                          </div>
                                          <div>
                                            <h4 className="font-semibold text-gray-900">배송 주소</h4>
                                            <p className="text-sm text-gray-600">
                                              {selectedOrder.zipCode && `${selectedOrder.zipCode} `}
                                              {selectedOrder.address1} {selectedOrder.address2}
                                            </p>
                                          </div>
                                          <div>
                                            <h4 className="font-semibold text-gray-900">주문 내용</h4>
                                            <p className="text-sm text-gray-600">
                                              {selectedOrder.boxSize === 'small' ? '소박스' : '대박스'} × {selectedOrder.quantity}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                              보자기: {selectedOrder.hasWrapping === 'yes' ? '있음' : '없음'}
                                            </p>
                                            <p className="text-sm font-semibold text-gray-900">
                                              총 금액: {formatPrice(selectedOrder.totalAmount)}
                                            </p>
                                          </div>
                                          {selectedOrder.specialRequests && (
                                            <div>
                                              <h4 className="font-semibold text-gray-900">요청사항</h4>
                                              <p className="text-sm text-gray-600">{selectedOrder.specialRequests}</p>
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
