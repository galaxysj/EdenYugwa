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
import { 
  ArrowLeft, Settings, Package, Truck, CheckCircle, Clock, Eye, LogOut, 
  AlertCircle, Download, Calendar, Trash2, Edit, Cog, RefreshCw, X, 
  Users, FileSpreadsheet, Key 
} from "lucide-react";
import * as XLSX from "xlsx";
import { SmsDialog } from "@/components/sms-dialog";
import ScheduledDatePicker from "@/components/scheduled-date-picker";
import { DeliveredDatePicker } from "@/components/delivered-date-picker";
import { SellerShippedDatePicker } from "@/components/seller-shipped-date-picker";
import { CustomerManagement } from "@/components/customer-management";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PasswordChangeDialog from "@/components/PasswordChangeDialog";
import { AdminHeader } from "@/components/admin-header";
import type { Order } from "@shared/schema";

const statusLabels = {
  pending: "주문접수",
  seller_shipped: "발송대기",
  scheduled: "발송주문",
  delivered: "발송완료",
};

const statusIcons = {
  pending: Clock,
  scheduled: Calendar,
  seller_shipped: Truck,
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

export default function Manager() {
  const [activeTab, setActiveTab] = useState<"orders" | "customers">("orders");
  const [orderViewTab, setOrderViewTab] = useState("all"); // all, scheduled, delivered
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logout, isAdmin, isManagerOrAdmin, user } = useAuth();

  // 매니저 권한 체크
  if (!isManagerOrAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-8">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">접근 권한이 없습니다</h2>
            <p className="text-gray-600 mb-4">
              매니저 페이지는 관리자가 지정한 매니저만 접근할 수 있습니다.
            </p>
            <button
              onClick={() => setLocation('/')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Filter states  
  const [orderDateFilter, setOrderDateFilter] = useState<string>('all');
  const [orderStartDate, setOrderStartDate] = useState<string>('');
  const [orderEndDate, setOrderEndDate] = useState<string>('');
  const [customerNameFilter, setCustomerNameFilter] = useState<string>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all'); // Manager can see all payment statuses
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [sellerShippedFilter, setSellerShippedFilter] = useState<string>('all');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // States for order operations
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [selectedOrdersForBulkSMS, setSelectedOrdersForBulkSMS] = useState<Order[]>([]);
  const [bulkSMSMessage, setBulkSMSMessage] = useState<string>('');
  const [showBulkSMSDialog, setShowBulkSMSDialog] = useState(false);

  // Bulk selection for SMS
  const [selectedOrderItems, setSelectedOrderItems] = useState<Set<number>>(new Set());

  // 주문 데이터 가져오기
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["/api/manager/orders"],
  });

  const { data: adminSettings } = useQuery({
    queryKey: ["/api/admin-settings"],
  });

  // 확인된 결제 주문만 매니저에게 표시
  const allConfirmedOrders = (orders as Order[]).filter(order => order.paymentStatus === 'confirmed');

  // 매니저 주문 정렬 함수 - 발송주문(scheduled) 상태를 맨 아래로
  const managerSortedOrders = [...allConfirmedOrders].sort((a, b) => {
    // scheduled 상태를 맨 아래로
    if (a.status === 'scheduled' && b.status !== 'scheduled') return 1;
    if (b.status === 'scheduled' && a.status !== 'scheduled') return -1;
    
    // 나머지는 날짜순으로 정렬 (최신순)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // 탭별 필터링
  const filteredOrders = managerSortedOrders.filter(order => {
    if (orderViewTab === 'scheduled') return order.status === 'scheduled';
    if (orderViewTab === 'delivered') return order.status === 'delivered';
    return true; // 'all'
  });

  // SMS 일괄 발송 mutation
  const sendBulkSMSMutation = useMutation({
    mutationFn: async ({ phones, message }: { phones: string[]; message: string }) => {
      return api.post('/api/sms/bulk', { phones, message });
    },
    onSuccess: () => {
      toast({
        title: "SMS 발송 완료",
        description: `${selectedOrderItems.size}명에게 SMS가 발송되었습니다.`,
      });
      setShowBulkSMSDialog(false);
      setBulkSMSMessage('');
      setSelectedOrderItems(new Set());
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

  // Excel 다운로드 함수
  const exportToExcel = () => {
    const excelData = filteredOrders.map(order => ({
      '주문번호': order.orderNumber,
      '주문일': new Date(order.createdAt).toLocaleDateString('ko-KR'),
      '고객명': order.customerName,
      '전화번호': order.customerPhone,
      '주소': `${order.address1} ${order.address2}`,
      '상품': [
        order.smallBoxQuantity > 0 ? `한과1호×${order.smallBoxQuantity}개` : '',
        order.largeBoxQuantity > 0 ? `한과2호×${order.largeBoxQuantity}개` : '',
        order.wrappingQuantity > 0 ? `보자기×${order.wrappingQuantity}개` : ''
      ].filter(Boolean).join(', '),
      '총금액': `${order.totalAmount?.toLocaleString() || 0}원`,
      '입금상태': order.paymentStatus === 'confirmed' ? '입금완료' : 
                 order.paymentStatus === 'partial' ? '부분결제' :
                 order.paymentStatus === 'refunded' ? '환불' : '입금대기',
      '주문상태': statusLabels[order.status as keyof typeof statusLabels],
      '발송상태': order.sellerShipped ? '발송완료' : '발송대기',
      '발송예정일': order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('ko-KR') : '',
      '실제발송일': order.deliveredDate ? new Date(order.deliveredDate).toLocaleDateString('ko-KR') : '',
      '판매자발송일': order.sellerShippedDate ? new Date(order.sellerShippedDate).toLocaleDateString('ko-KR') : '',
      '메모': (order as any).memo || ''
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "매니저_주문목록");
    
    const fileName = `매니저_주문목록_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "Excel 다운로드 완료",
      description: `${fileName} 파일이 다운로드되었습니다.`,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-eden-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <AdminHeader 
          handleExcelDownload={exportToExcel}
          setActiveTab={(tab: string) => setActiveTab(tab as "orders" | "customers")}
          activeTab={activeTab}
          passwordChangeDialog={
            <PasswordChangeDialog 
              triggerComponent={
                <Button variant="ghost" size="sm" className="gap-2">
                  <Key className="h-4 w-4" />
                  비밀번호 변경
                </Button>
              }
            />
          }
        />

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            {activeTab === 'orders' && (
              <div className="space-y-6">
                {/* Bulk Actions */}
                {selectedOrderItems.size > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-900">
                        {selectedOrderItems.size}개 주문이 선택되었습니다
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
                          variant="ghost"
                          onClick={() => setSelectedOrderItems(new Set())}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Order View Tabs */}
                <div className="flex items-center gap-2 border-b pb-2">
                  <Button
                    variant={orderViewTab === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setOrderViewTab('all')}
                    className="h-8 text-xs"
                  >
                    전체보기 ({allConfirmedOrders.length})
                  </Button>
                  <Button
                    variant={orderViewTab === 'scheduled' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setOrderViewTab('scheduled')}
                    className="h-8 text-xs"
                  >
                    발송주문 ({allConfirmedOrders.filter(o => o.status === 'scheduled').length})
                  </Button>
                  <Button
                    variant={orderViewTab === 'delivered' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setOrderViewTab('delivered')}
                    className="h-8 text-xs"
                  >
                    발송완료 ({allConfirmedOrders.filter(o => o.status === 'delivered').length})
                  </Button>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {orderViewTab === 'all' ? '전체 주문 목록' : 
                       orderViewTab === 'scheduled' ? '발송주문 목록' : '발송완료 목록'} ({filteredOrders.length}건)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="space-y-4 p-4">
                      {filteredOrders.map((order) => {
                        const StatusIcon = statusIcons[order.status as keyof typeof statusIcons] || Clock;
                        return (
                          <Card key={order.id} className="border-l-4 border-l-blue-500">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedOrderItems.has(order.id)}
                                    onChange={(e) => {
                                      const newSet = new Set(selectedOrderItems);
                                      if (e.target.checked) {
                                        newSet.add(order.id);
                                      } else {
                                        newSet.delete(order.id);
                                      }
                                      setSelectedOrderItems(newSet);
                                    }}
                                    className="rounded"
                                  />
                                  <h3 className="font-semibold text-lg">{order.customerName}</h3>
                                  <span className="text-sm text-gray-500">#{order.orderNumber}</span>
                                  <span className="text-sm text-gray-500">
                                    {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold text-eden-primary">
                                    {order.totalAmount?.toLocaleString() || 0}원
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {order.customerPhone}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-2 mb-3">
                                <div>
                                  <span className="text-sm font-medium text-gray-700">주문내용: </span>
                                  <div className="text-sm">
                                    {order.smallBoxQuantity > 0 && <div>한과1호×{order.smallBoxQuantity}개</div>}
                                    {order.largeBoxQuantity > 0 && <div>한과2호×{order.largeBoxQuantity}개</div>}
                                    {order.wrappingQuantity > 0 && <div className="text-eden-brown">보자기×{order.wrappingQuantity}개</div>}
                                  </div>
                                </div>
                                
                                <div>
                                  <span className="text-sm font-medium text-gray-700">배송주소: </span>
                                  <span className="text-sm">
                                    {order.address1} {order.address2}
                                  </span>
                                  {checkRemoteArea(order.address1) && (
                                    <div className="text-xs text-red-600 font-bold mt-1">배송비추가</div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-2 mb-3">
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
                                
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  order.status === 'delivered' 
                                    ? 'bg-green-100 text-green-800' 
                                    : order.status === 'scheduled'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusLabels[order.status as keyof typeof statusLabels]}
                                </span>
                              </div>
                              
                              <div className="flex gap-2">
                                <Select
                                  value={order.status}
                                  onValueChange={(value) => updateOrderStatusMutation.mutate({ id: order.id, status: value })}
                                >
                                  <SelectTrigger className="flex-1 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">주문접수</SelectItem>
                                    <SelectItem value="scheduled">발송주문</SelectItem>
                                    <SelectItem value="delivered">발송완료</SelectItem>
                                  </SelectContent>
                                </Select>
                                
                                <Button
                                  size="sm"
                                  variant={order.sellerShipped ? "default" : "outline"}
                                  className={`h-8 text-xs ${order.sellerShipped ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                  onClick={() => updateSellerShippedMutation.mutate({ 
                                    id: order.id, 
                                    sellerShipped: !order.sellerShipped 
                                  })}
                                  disabled={updateSellerShippedMutation.isPending}
                                >
                                  {order.sellerShipped ? '발송완료' : '발송하기'}
                                </Button>
                                
                                <SmsDialog order={order}>
                                  <Button variant="outline" size="sm" className="h-8 text-xs">
                                    SMS
                                  </Button>
                                </SmsDialog>
                              </div>

                              <div className="mt-3 space-y-2">
                                <ScheduledDatePicker order={order} />
                                <DeliveredDatePicker order={order} />
                                <SellerShippedDatePicker order={order} />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="space-y-6">
                <CustomerManagement />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk SMS Dialog */}
      <Dialog open={showBulkSMSDialog} onOpenChange={setShowBulkSMSDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>일괄 SMS 발송</DialogTitle>
            <DialogDescription>
              선택된 {selectedOrderItems.size}명의 고객에게 SMS를 발송합니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk-sms-message">메시지</Label>
              <Textarea
                id="bulk-sms-message"
                value={bulkSMSMessage}
                onChange={(e) => setBulkSMSMessage(e.target.value)}
                placeholder="발송할 메시지를 입력하세요..."
                rows={4}
                maxLength={1000}
              />
              <div className="text-xs text-gray-500 mt-1">
                {bulkSMSMessage.length}/1000자
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowBulkSMSDialog(false)}>
              취소
            </Button>
            <Button 
              onClick={() => {
                const selectedOrders = filteredOrders.filter(order => selectedOrderItems.has(order.id));
                const phones = selectedOrders.map(order => order.customerPhone);
                sendBulkSMSMutation.mutate({ phones, message: bulkSMSMessage });
              }}
              disabled={!bulkSMSMessage.trim() || sendBulkSMSMutation.isPending}
            >
              {sendBulkSMSMutation.isPending ? "발송 중..." : "발송"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}