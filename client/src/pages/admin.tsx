import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { ArrowLeft, Settings, Package, Truck, CheckCircle, Clock, MessageSquare, Eye, LogOut } from "lucide-react";
import type { Order } from "@shared/schema";

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

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    toast({
      title: "로그아웃",
      description: "관리자 페이지에서 로그아웃되었습니다.",
    });
    setLocation("/admin/login");
  };

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['/api/orders'],
    queryFn: () => api.orders.getAll(),
  });

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

  const sendSMSMutation = useMutation({
    mutationFn: api.sms.send,
    onSuccess: () => {
      toast({
        title: "SMS 발송 완료",
        description: "고객에게 SMS가 성공적으로 발송되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "SMS 발송 실패",
        description: "SMS 발송 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateStatusMutation.mutate({ id: orderId, status: newStatus });
  };

  const handleSendSMS = (order: Order) => {
    const statusMessage = getStatusMessage(order.status);
    sendSMSMutation.mutate({
      orderId: order.id,
      phoneNumber: order.customerPhone,
      message: `[에덴한과] ${order.customerName}님, 주문번호 ${order.orderNumber} ${statusMessage}`,
    });
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
      {/* Header */}
      <div className="bg-eden-red text-white p-6">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" className="text-white hover:text-gray-200">
                <ArrowLeft className="mr-2 h-4 w-4" />
                홈으로
              </Button>
            </Link>
            <h1 className="text-2xl font-bold font-korean">
              <Settings className="inline mr-3 h-6 w-6" />
              관리자 패널
            </h1>
          </div>
          <Button 
            onClick={handleLogout}
            variant="ghost" 
            className="text-white hover:text-gray-200"
          >
            <LogOut className="mr-2 h-4 w-4" />
            로그아웃
          </Button>
        </div>
      </div>

      <div className="container mx-auto p-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600">총 주문</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-yellow-50">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-gray-600">주문 접수</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-blue-50">
              <div className="text-2xl font-bold text-blue-600">{stats.preparing}</div>
              <div className="text-sm text-gray-600">제작 중</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-orange-50">
              <div className="text-2xl font-bold text-orange-600">{stats.shipping}</div>
              <div className="text-sm text-gray-600">배송 중</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-green-50">
              <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
              <div className="text-sm text-gray-600">배송 완료</div>
            </CardContent>
          </Card>
        </div>

        {/* Orders Table */}
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">주문번호</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">고객정보</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">상품</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">금액</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">상태</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const StatusIcon = statusIcons[order.status as keyof typeof statusIcons];
                      return (
                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <div className="font-medium text-gray-900">#{order.orderNumber}</div>
                            <div className="text-xs text-gray-500">
                              {order.createdAt.toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-medium text-gray-900">{order.customerName}</div>
                            <div className="text-sm text-gray-500">{order.customerPhone}</div>
                            <div className="text-xs text-gray-500 truncate max-w-xs">
                              {order.address1} {order.address2}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm text-gray-900">
                              {order.boxSize === 'small' ? '소박스' : '대박스'} × {order.quantity}
                            </div>
                            <div className="text-xs text-gray-500">
                              {order.hasWrapping === 'yes' ? '보자기 포장' : '보자기 없음'}
                            </div>
                          </td>
                          <td className="py-4 px-4 font-medium text-gray-900">
                            {formatPrice(order.totalAmount)}
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
                                    <Clock className="h-4 w-4" />
                                    <span>주문 접수</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="preparing">
                                  <div className="flex items-center space-x-2">
                                    <Package className="h-4 w-4" />
                                    <span>제작 중</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="shipping">
                                  <div className="flex items-center space-x-2">
                                    <Truck className="h-4 w-4" />
                                    <span>배송 중</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="delivered">
                                  <div className="flex items-center space-x-2">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>배송 완료</span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => handleSendSMS(order)}
                                disabled={sendSMSMutation.isPending}
                                className="bg-green-500 hover:bg-green-600"
                              >
                                <MessageSquare className="h-4 w-4 mr-1" />
                                SMS
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  // TODO: Implement order detail modal
                                  toast({
                                    title: "주문 상세",
                                    description: `${order.orderNumber} 주문 상세보기 기능은 추후 구현될 예정입니다.`,
                                  });
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                상세
                              </Button>
                            </div>
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
      </div>
    </div>
  );
}
