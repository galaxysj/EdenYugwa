import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { ArrowLeft, Settings, Package, Truck, CheckCircle, Clock, Eye, LogOut, DollarSign, AlertCircle, Download } from "lucide-react";
import { SmsDialog } from "@/components/sms-dialog";
import { SmsHistory } from "@/components/sms-history";
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

export default function Manager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['/api/orders'],
    queryFn: () => api.orders.getAll(),
    refetchInterval: 5000, // Refetch every 5 seconds
    refetchIntervalInBackground: true,
  });

  // Calculate stats (excluding payment-related stats)
  const stats = {
    total: orders.length,
    pending: orders.filter(order => order.status === 'pending').length,
    preparing: orders.filter(order => order.status === 'preparing').length,
    shipping: orders.filter(order => order.status === 'shipping').length,
    delivered: orders.filter(order => order.status === 'delivered').length,
  };

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

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateStatusMutation.mutate({ id: orderId, status: newStatus });
  };

  const handleExcelDownload = async () => {
    try {
      const response = await fetch('/api/orders/export/excel');
      if (!response.ok) {
        throw new Error('엑셀 파일 다운로드에 실패했습니다');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `에덴한과_주문목록_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "다운로드 완료",
        description: "엑셀 파일이 성공적으로 다운로드되었습니다.",
      });
    } catch (error) {
      toast({
        title: "다운로드 실패",
        description: "엑셀 파일 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'text-yellow-600 bg-yellow-50',
      preparing: 'text-blue-600 bg-blue-50',
      shipping: 'text-orange-600 bg-orange-50',
      delivered: 'text-green-600 bg-green-50',
    };
    return colors[status as keyof typeof colors] || 'text-gray-600 bg-gray-50';
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-6 max-w-md">
          <CardContent className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">오류가 발생했습니다</h2>
            <p className="text-gray-600 mb-4">주문 목록을 불러올 수 없습니다.</p>
            <Button onClick={() => window.location.reload()}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-eden-cream">
      {/* Header */}
      <div className="bg-eden-red text-white p-4 sm:p-6">
        <div className="container mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/">
                <Button variant="ghost" className="text-white hover:text-gray-200 p-2 sm:px-4 sm:py-2">
                  <ArrowLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">홈으로</span>
                </Button>
              </Link>
              <h1 className="text-lg sm:text-2xl font-bold font-korean">
                <Settings className="inline mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6" />
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <Card>
            <CardContent className="p-2 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-xs sm:text-sm text-gray-600">총 주문</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2 sm:p-4 text-center bg-yellow-50">
              <div className="text-lg sm:text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-xs sm:text-sm text-gray-600">주문 접수</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2 sm:p-4 text-center bg-blue-50">
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.preparing}</div>
              <div className="text-xs sm:text-sm text-gray-600">제작 중</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2 sm:p-4 text-center bg-orange-50">
              <div className="text-lg sm:text-2xl font-bold text-orange-600">{stats.shipping}</div>
              <div className="text-xs sm:text-sm text-gray-600">배송 중</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2 sm:p-4 text-center bg-green-50">
              <div className="text-lg sm:text-2xl font-bold text-green-600">{stats.delivered}</div>
              <div className="text-xs sm:text-sm text-gray-600">배송 완료</div>
            </CardContent>
          </Card>
        </div>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle className="font-korean">주문 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-eden-brown mx-auto mb-4"></div>
                <div className="text-gray-500">주문 목록을 불러오는 중...</div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                <div className="mb-2">주문 목록을 불러오는 중 오류가 발생했습니다.</div>
                <div className="text-sm text-gray-500">{error.message}</div>
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline" 
                  className="mt-4"
                >
                  다시 시도
                </Button>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                아직 주문이 없습니다.
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">주문번호</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">고객정보</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">상품</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">주문상태</th>
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
                                {new Date(order.createdAt).toLocaleDateString()}
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
                                소박스 × {order.smallBoxQuantity}, 대박스 × {order.largeBoxQuantity}
                              </div>
                              <div className={order.wrappingQuantity > 0 ? "text-sm text-gray-900" : "text-xs text-gray-500"}>
                                {order.wrappingQuantity > 0 ? `보자기 × ${order.wrappingQuantity}` : '보자기 없음'}
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
                              <div className="flex items-center space-x-2">
                                <SmsDialog 
                                  order={order} 
                                  onSuccess={() => queryClient.invalidateQueries({ queryKey: ['/api/orders'] })}
                                />
                                <SmsHistory order={order} />
                                <Link href={`/order-edit/${order.id}`}>
                                  <Button size="sm" variant="outline">
                                    <Eye className="h-4 w-4" />
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
                  {orders.map((order) => {
                    const StatusIcon = statusIcons[order.status as keyof typeof statusIcons];
                    return (
                      <Card key={order.id} className="border border-gray-200">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="font-medium text-gray-900">#{order.orderNumber}</div>
                              <div className="text-sm text-gray-500">{formatDate(order.createdAt)}</div>
                            </div>
                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                              <StatusIcon className="h-3 w-3 inline mr-1" />
                              {statusLabels[order.status as keyof typeof statusLabels]}
                            </div>
                          </div>

                          <div className="space-y-2 mb-4">
                            <div>
                              <span className="text-sm font-medium text-gray-700">고객: </span>
                              <span className="text-sm text-gray-900">{order.customerName}</span>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-700">전화: </span>
                              <span className="text-sm text-gray-900">{order.customerPhone}</span>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-700">상품: </span>
                              <span className="text-sm text-gray-900">
                                소박스 × {order.smallBoxQuantity}, 대박스 × {order.largeBoxQuantity}
                                {order.wrappingQuantity > 0 && ` (보자기 × ${order.wrappingQuantity})`}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <Select
                              value={order.status || 'pending'}
                              onValueChange={(newStatus) => handleStatusChange(order.id, newStatus)}
                              disabled={updateStatusMutation.isPending}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">주문 접수</SelectItem>
                                <SelectItem value="preparing">제작 중</SelectItem>
                                <SelectItem value="shipping">배송 중</SelectItem>
                                <SelectItem value="delivered">배송 완료</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <div className="flex space-x-2">
                              <SmsDialog 
                                order={order} 
                                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['/api/orders'] })}
                              />
                              <SmsHistory order={order} />
                              <Link href={`/order-edit/${order.id}`}>
                                <Button size="sm" variant="outline">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}