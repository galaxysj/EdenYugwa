import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Search, Package, MapPin, User, Calendar, Edit, RotateCcw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { Order } from "@shared/schema";
import { useLocation } from "wouter";

const lookupSchema = z.object({
  phoneNumber: z.string().optional(),
  customerName: z.string().optional(),
}).refine(data => data.phoneNumber || data.customerName, {
  message: "전화번호 또는 이름 중 하나는 입력해주세요",
  path: ["phoneNumber"],
});

type LookupFormData = z.infer<typeof lookupSchema>;

// 재주문 스키마
const reorderSchema = z.object({
  customerName: z.string().min(1, "이름을 입력해주세요"),
  customerPhone: z.string().min(1, "전화번호를 입력해주세요"),
  zipCode: z.string().optional(),
  address1: z.string().min(1, "주소를 입력해주세요"),
  address2: z.string().optional(),
  specialRequests: z.string().optional(),
  smallBoxQuantity: z.number().min(0, "소박스 수량은 0개 이상이어야 합니다"),
  largeBoxQuantity: z.number().min(0, "대박스 수량은 0개 이상이어야 합니다"),
  wrappingQuantity: z.number().min(0, "보자기 포장 수량은 0개 이상이어야 합니다"),
  isDifferentDepositor: z.boolean().default(false),
  depositorName: z.string().optional(),
}).refine((data) => data.smallBoxQuantity + data.largeBoxQuantity >= 1, {
  message: "최소 1개 이상의 상품을 선택해주세요",
  path: ["smallBoxQuantity"],
}).refine((data) => data.wrappingQuantity <= data.smallBoxQuantity + data.largeBoxQuantity, {
  message: "보자기 포장 수량은 전체 수량보다 클 수 없습니다",
  path: ["wrappingQuantity"],
}).refine((data) => !data.isDifferentDepositor || data.depositorName, {
  message: "입금자 이름을 입력해주세요",
  path: ["depositorName"],
});

type ReorderFormData = z.infer<typeof reorderSchema>;

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('ko-KR').format(price) + '원';
};

const prices = {
  small: 19000, // 한과1호
  large: 21000, // 한과2호
  wrapping: 1000,
  shipping: 4000,
};

const statusLabels = {
  pending: "주문접수",
  seller_shipped: "발송대기",
  scheduled: "발송주문",
  delivered: "발송완료",
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  scheduled: "bg-blue-100 text-blue-800",
  seller_shipped: "bg-orange-100 text-orange-800",
  delivered: "bg-green-100 text-green-800",
};

const paymentStatusLabels = {
  pending: "입금 대기",
  confirmed: "입금 완료",
  refunded: "환불",
};

const paymentStatusColors = {
  pending: "bg-red-100 text-red-800",
  confirmed: "bg-green-100 text-green-800",
  refunded: "bg-gray-100 text-gray-800",
};

export default function OrderLookup() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const form = useForm<LookupFormData>({
    resolver: zodResolver(lookupSchema),
    defaultValues: {
      phoneNumber: "",
      customerName: "",
    },
  });

  // 로그인된 사용자의 정보를 폼에 미리 채우고 자동으로 주문 조회
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('자동 주문 조회 시작 - 사용자 정보:', { 
        userId: user.id,
        phoneNumber: user.phoneNumber, 
        name: user.name 
      });
      
      // 폼에 사용자 정보 미리 입력 (있다면)
      if (user.phoneNumber) form.setValue('phoneNumber', user.phoneNumber);
      if (user.name) form.setValue('customerName', user.name);
      
      // 로그인된 사용자의 주문을 직접 조회
      const autoSearch = async () => {
        setIsLoading(true);
        try {
          const response = await fetch('/api/my-orders', {
            credentials: 'include'
          });
          
          console.log('내 주문 조회 응답 상태:', response.status);
          
          if (response.status === 404) {
            console.log('주문 내역 없음 (404)');
            setOrders([]);
            setHasSearched(true);
            return;
          }
          
          if (!response.ok) {
            throw new Error('주문 조회에 실패했습니다');
          }
          
          const foundOrders = await response.json();
          console.log('찾은 주문 수:', foundOrders.length);
          setOrders(foundOrders);
          setHasSearched(true);
          
        } catch (error) {
          console.error('자동 주문 조회 실패:', error);
          setOrders([]);
          setHasSearched(true);
        } finally {
          setIsLoading(false);
        }
      };
      
      autoSearch();
    } else {
      console.log('자동 조회 조건 미충족:', { 
        isAuthenticated, 
        hasUser: !!user
      });
    }
  }, [isAuthenticated, user, form]);

  const onSubmit = async (data: LookupFormData) => {
    setIsLoading(true);

    try {
      const queryParams = new URLSearchParams();
      if (data.phoneNumber) queryParams.append('phone', data.phoneNumber);
      if (data.customerName) queryParams.append('name', data.customerName);
      
      const response = await fetch(`/api/orders/lookup?${queryParams.toString()}`);
      
      if (response.status === 404) {
        // 404인 경우 주문 내역이 없음
        setOrders([]);
        setHasSearched(true);
        return;
      }
      
      if (!response.ok) {
        throw new Error('주문 조회에 실패했습니다');
      }
      
      const foundOrders = await response.json();
      setOrders(foundOrders);
      setHasSearched(true);
      
    } catch (error) {
      toast({
        title: "조회 실패",
        description: "주문 조회 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setOrders([]);
      setHasSearched(false);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => `${price.toLocaleString()}원`;

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // 배송주소 마스킹 함수 (시/구까지만 표시)
  const maskAddress = (address: string) => {
    // 예: "서울특별시 강남구 테헤란로 123 건물명 101호" → "서울 강남구 ***"
    const parts = address.split(' ');
    if (parts.length >= 2) {
      let city = parts[0];
      let district = parts[1];
      
      // "서울특별시" → "서울", "경기도" → "경기" 등으로 축약
      city = city.replace(/특별시|광역시|도$/g, '');
      
      return `${city} ${district} ***`;
    }
    return address.substring(0, Math.min(10, address.length)) + ' ***';
  };

  // 전화번호 마스킹 함수 (앞 4자리만 표시)
  const maskPhoneNumber = (phone: string) => {
    // 예: "010-1234-5678" → "010-1***"
    // 또는 "01012345678" → "0101***"
    if (phone.length >= 4) {
      return phone.substring(0, 4) + '***';
    }
    return phone;
  };

  // 가격 마스킹 함수
  const maskPrice = () => {
    return "***원";
  };

  // 재주문하기 함수
  const handleReorder = (order: Order) => {
    setSelectedOrder(order);
    setReorderDialogOpen(true);
  };

  // 재주문 폼
  const reorderForm = useForm<ReorderFormData>({
    resolver: zodResolver(reorderSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      zipCode: "",
      address1: "",
      address2: "",
      specialRequests: "",
      smallBoxQuantity: 0,
      largeBoxQuantity: 0,
      wrappingQuantity: 0,
      isDifferentDepositor: false,
      depositorName: "",
    },
  });

  // 선택된 주문이 변경될 때 폼 데이터 업데이트
  useEffect(() => {
    if (selectedOrder) {
      reorderForm.reset({
        customerName: selectedOrder.customerName,
        customerPhone: selectedOrder.customerPhone,
        zipCode: selectedOrder.zipCode || "",
        address1: selectedOrder.address1,
        address2: selectedOrder.address2 || "",
        specialRequests: selectedOrder.specialRequests || "",
        smallBoxQuantity: selectedOrder.smallBoxQuantity,
        largeBoxQuantity: selectedOrder.largeBoxQuantity,
        wrappingQuantity: selectedOrder.wrappingQuantity,
        isDifferentDepositor: selectedOrder.isDifferentDepositor || false,
        depositorName: selectedOrder.depositorName || "",
      });
    }
  }, [selectedOrder, reorderForm]);

  // 재주문 제출
  const onReorderSubmit = async (data: ReorderFormData) => {
    try {
      const totalQuantity = data.smallBoxQuantity + data.largeBoxQuantity;
      const shippingFee = totalQuantity >= 6 ? 0 : prices.shipping;
      
      const orderData = {
        ...data,
        shippingFee,
        totalAmount: (data.smallBoxQuantity * prices.small) + 
                     (data.largeBoxQuantity * prices.large) + 
                     (data.wrappingQuantity * prices.wrapping) + 
                     shippingFee,
      };

      const newOrder = await api.orders.create(orderData);
      
      toast({
        title: "재주문 완료",
        description: `주문번호 ${newOrder.orderNumber}로 접수되었습니다. 감사합니다!`,
      });
      
      setReorderDialogOpen(false);
      setSelectedOrder(null);
      reorderForm.reset();
      
      // 주문 목록 새로고침
      if (isAuthenticated) {
        // 내 주문 목록을 다시 불러오기
        const response = await fetch('/api/my-orders', {
          credentials: 'include'
        });
        if (response.ok) {
          const userOrders = await response.json();
          setOrders(userOrders);
        }
      }
    } catch (error: any) {
      toast({
        title: "재주문 실패",
        description: error.message || "재주문 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };



  return (
    <div className="min-h-screen bg-eden-cream">
      {/* Header */}
      <div className="bg-eden-red text-white p-6">
        <div className="container mx-auto">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" className="text-white hover:text-gray-200">
                <ArrowLeft className="mr-2 h-4 w-4" />
                홈으로
              </Button>
            </Link>
            <h1 className="text-2xl font-bold font-korean">주문 조회</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        {/* Search Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="font-korean">주문 조회하기</CardTitle>
            {isAuthenticated && user ? (
              <p className="text-green-600 font-medium">
                {user.name}님의 주문 내역을 자동으로 조회하고 있습니다.
              </p>
            ) : (
              <p className="text-gray-600">주문 시 입력하신 전화번호 또는 이름으로 주문 내역을 조회할 수 있습니다.</p>
            )}
          </CardHeader>
          {!isAuthenticated && (
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>전화번호</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="010-1234-5678"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>주문자 이름</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="홍길동"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="text-sm text-gray-500 mt-2">
                    * 전화번호 또는 이름 중 하나만 입력해도 조회 가능합니다.
                  </div>
                  
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-eden-brown hover:bg-eden-dark text-white w-full md:w-auto"
                  >
                    {isLoading ? (
                      "조회 중..."
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        주문 조회
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          )}
        </Card>

        {/* Loading State for Auto Search */}
        {isAuthenticated && isLoading && !hasSearched && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-eden-brown"></div>
                <p className="text-gray-600">주문 내역을 조회하고 있습니다...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Orders Results */}
        {hasSearched && (
          <div className="space-y-6">
            {orders.length === 0 ? (
              <Card className="border-2 border-dashed border-gray-300">
                <CardContent className="p-12 text-center">
                  <Package className="mx-auto h-16 w-16 text-gray-300 mb-6" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-3">주문 내역이 없습니다</h3>
                  <p className="text-gray-500 mb-4">
                    입력하신 전화번호로 등록된 주문을 찾을 수 없습니다.
                  </p>
                  <div className="text-sm text-gray-400 space-y-1">
                    <p>• 전화번호를 정확히 입력했는지 확인해 주세요</p>
                    <p>• 주문 시 사용한 번호와 동일한지 확인해 주세요</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              orders.map((order) => (
                <Card key={order.id} className="border border-gray-200">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl font-korean">주문번호 #{order.orderNumber}</CardTitle>
                          <div className="text-gray-500 mt-1">
                            <div className="flex items-center">
                              <Calendar className="mr-1 h-4 w-4" />
                              {formatDate(order.createdAt)}
                            </div>
                            <div className="text-xs ml-5">
                              {new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {order.scheduledDate && (
                              <div className="text-xs ml-5 mt-1 text-blue-600 font-medium">
                                예약발송일: {formatDate(order.scheduledDate)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <div>
                            <Badge className={statusColors[order.status as keyof typeof statusColors]}>
                              {statusLabels[order.status as keyof typeof statusLabels]}
                            </Badge>
                            {order.status === 'delivered' && order.deliveredDate && (
                              <div className="text-xs text-gray-500 mt-1">
                                발송일: {formatDate(order.deliveredDate)}
                              </div>
                            )}
                          </div>
                          <Badge className={paymentStatusColors[order.paymentStatus as keyof typeof paymentStatusColors]}>
                            {paymentStatusLabels[order.paymentStatus as keyof typeof paymentStatusLabels]}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Customer Info */}
                      <div>
                        <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                          <User className="mr-2 h-4 w-4" />
                          주문자 정보
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">이름: </span>
                            <span className="font-medium">{order.customerName}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">전화번호: </span>
                            <span className="font-medium">{isAuthenticated ? order.customerPhone : maskPhoneNumber(order.customerPhone)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Delivery Info */}
                      <div>
                        <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                          <MapPin className="mr-2 h-4 w-4" />
                          배송 정보
                        </h3>
                        <div className="text-sm space-y-2">
                          <div>
                            <span className="text-gray-600">주소: </span>
                            <span className="font-medium">
                              {isAuthenticated ? `${order.address1} ${order.address2}` : maskAddress(`${order.address1} ${order.address2}`)}
                            </span>
                          </div>

                          {order.specialRequests && (
                            <div>
                              <span className="text-gray-600">배송 요청사항: </span>
                              <span className="font-medium">{order.specialRequests}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Product Info */}
                      <div>
                        <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                          <Package className="mr-2 h-4 w-4" />
                          주문 상품
                        </h3>
                        <div className="bg-gray-50 p-4 rounded border text-sm">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              {order.smallBoxQuantity > 0 && (
                                <div className="font-medium">
                                  한과1호(약 1.1kg) × {order.smallBoxQuantity}개
                                </div>
                              )}
                              {order.largeBoxQuantity > 0 && (
                                <div className="font-medium">
                                  한과2호(약 1.3kg) × {order.largeBoxQuantity}개
                                </div>
                              )}
                              {order.wrappingQuantity > 0 && (
                                <div className="text-gray-600">
                                  보자기 수량 × {order.wrappingQuantity}개 (+{isAuthenticated ? `${(order.wrappingQuantity * 1000).toLocaleString()}원` : maskPrice()})
                                </div>
                              )}
                              {order.shippingFee > 0 && (
                                <div className="text-gray-600">
                                  배송비: +{isAuthenticated ? `${order.shippingFee.toLocaleString()}원` : maskPrice()}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-eden-brown">
                                {isAuthenticated ? `${order.totalAmount.toLocaleString()}원` : maskPrice()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>



                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-2 pt-4 border-t">
                        {isAuthenticated && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleReorder(order)}
                            className="text-eden-brown border-eden-brown hover:bg-eden-cream"
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            재주문하기
                          </Button>
                        )}
                        {isAuthenticated && order.status === 'pending' && order.paymentStatus === 'pending' && (
                          <Link href={`/order-edit/${order.id}`}>
                            <Button variant="outline" size="sm">
                              <Edit className="mr-2 h-4 w-4" />
                              주문 수정
                            </Button>
                          </Link>
                        )}
                        {!isAuthenticated && order.status === 'pending' && order.paymentStatus === 'pending' && (
                          <div className="text-sm text-gray-500 italic">
                            주문 수정은 로그인 후 가능합니다
                          </div>
                        )}
                      </div>
                    </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* 재주문 팝업 */}
      <Dialog open={reorderDialogOpen} onOpenChange={setReorderDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-korean">재주문하기</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <Form {...reorderForm}>
              <form onSubmit={reorderForm.handleSubmit(onReorderSubmit)} className="space-y-6">
                {/* 고객 정보 */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">주문자 정보</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={reorderForm.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>이름</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={reorderForm.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>전화번호</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* 배송 정보 */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">배송 정보</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={reorderForm.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>우편번호</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="우편번호" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={reorderForm.control}
                      name="address1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>주소</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="주소" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={reorderForm.control}
                      name="address2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>상세 주소</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="상세 주소" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* 상품 선택 */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">상품 선택</h3>
                  <div className="space-y-4">
                    {/* 한과1호 */}
                    <div className="flex justify-between items-center p-4 border rounded">
                      <div>
                        <h4 className="font-medium">한과1호(약 1.1kg)</h4>
                        <p className="text-sm text-gray-600">{formatPrice(prices.small)}</p>
                      </div>
                      <FormField
                        control={reorderForm.control}
                        name="smallBoxQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="flex items-center space-x-2">
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => field.onChange(Math.max(0, field.value - 1))}
                                  className="w-8 h-8 p-0"
                                >
                                  -
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  className="w-16 text-center"
                                />
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => field.onChange(field.value + 1)}
                                  className="w-8 h-8 p-0"
                                >
                                  +
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* 한과2호 */}
                    <div className="flex justify-between items-center p-4 border rounded">
                      <div>
                        <h4 className="font-medium">한과2호(약 1.3kg)</h4>
                        <p className="text-sm text-gray-600">{formatPrice(prices.large)}</p>
                      </div>
                      <FormField
                        control={reorderForm.control}
                        name="largeBoxQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="flex items-center space-x-2">
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => field.onChange(Math.max(0, field.value - 1))}
                                  className="w-8 h-8 p-0"
                                >
                                  -
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  className="w-16 text-center"
                                />
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => field.onChange(field.value + 1)}
                                  className="w-8 h-8 p-0"
                                >
                                  +
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* 보자기 포장 */}
                    <div className="flex justify-between items-center p-4 border rounded">
                      <div>
                        <h4 className="font-medium">보자기 포장</h4>
                        <p className="text-sm text-gray-600">{formatPrice(prices.wrapping)}</p>
                      </div>
                      <FormField
                        control={reorderForm.control}
                        name="wrappingQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="flex items-center space-x-2">
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => field.onChange(Math.max(0, field.value - 1))}
                                  className="w-8 h-8 p-0"
                                >
                                  -
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  className="w-16 text-center"
                                />
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => field.onChange(field.value + 1)}
                                  className="w-8 h-8 p-0"
                                >
                                  +
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* 입금자 정보 */}
                <div className="space-y-4">
                  <FormField
                    control={reorderForm.control}
                    name="isDifferentDepositor"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          예금자가 다릅니다
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  {reorderForm.watch("isDifferentDepositor") && (
                    <FormField
                      control={reorderForm.control}
                      name="depositorName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>입금자 이름</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="입금자 이름" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* 배송 요청사항 */}
                <FormField
                  control={reorderForm.control}
                  name="specialRequests"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>배송 요청사항</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="배송 시 요청사항이 있으시면 입력해주세요" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 가격 정보 */}
                <div className="bg-gray-50 p-4 rounded">
                  <div className="space-y-2">
                    {reorderForm.watch("smallBoxQuantity") > 0 && (
                      <div className="flex justify-between">
                        <span>한과1호 × {reorderForm.watch("smallBoxQuantity")}</span>
                        <span>{formatPrice(reorderForm.watch("smallBoxQuantity") * prices.small)}</span>
                      </div>
                    )}
                    {reorderForm.watch("largeBoxQuantity") > 0 && (
                      <div className="flex justify-between">
                        <span>한과2호 × {reorderForm.watch("largeBoxQuantity")}</span>
                        <span>{formatPrice(reorderForm.watch("largeBoxQuantity") * prices.large)}</span>
                      </div>
                    )}
                    {reorderForm.watch("wrappingQuantity") > 0 && (
                      <div className="flex justify-between">
                        <span>보자기 × {reorderForm.watch("wrappingQuantity")}</span>
                        <span>{formatPrice(reorderForm.watch("wrappingQuantity") * prices.wrapping)}</span>
                      </div>
                    )}
                    {(() => {
                      const total = reorderForm.watch("smallBoxQuantity") + reorderForm.watch("largeBoxQuantity");
                      const shippingFee = total >= 6 ? 0 : prices.shipping;
                      if (shippingFee > 0) {
                        return (
                          <div className="flex justify-between">
                            <span>배송비</span>
                            <span>{formatPrice(shippingFee)}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <div className="border-t pt-2 flex justify-between font-bold text-lg">
                      <span>총 금액</span>
                      <span className="text-eden-brown">
                        {(() => {
                          const smallTotal = reorderForm.watch("smallBoxQuantity") * prices.small;
                          const largeTotal = reorderForm.watch("largeBoxQuantity") * prices.large;
                          const wrappingTotal = reorderForm.watch("wrappingQuantity") * prices.wrapping;
                          const totalQuantity = reorderForm.watch("smallBoxQuantity") + reorderForm.watch("largeBoxQuantity");
                          const shippingFee = totalQuantity >= 6 ? 0 : (totalQuantity > 0 ? prices.shipping : 0);
                          const total = smallTotal + largeTotal + wrappingTotal + shippingFee;
                          return formatPrice(total);
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 버튼 */}
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setReorderDialogOpen(false)}>
                    취소
                  </Button>
                  <Button type="submit" className="bg-eden-brown hover:bg-eden-brown/90">
                    재주문하기
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}