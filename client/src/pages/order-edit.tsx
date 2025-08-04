import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Save, AlertTriangle, Lock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { insertOrderSchema, type Order } from "@shared/schema";
import { z } from "zod";

const editOrderSchema = insertOrderSchema.pick({
  customerName: true,
  customerPhone: true,
  zipCode: true,
  address1: true,
  address2: true,
  specialRequests: true,
  smallBoxQuantity: true,
  largeBoxQuantity: true,
  wrappingQuantity: true,
}).extend({
  customerName: z.string().min(1, "이름을 입력해주세요"),
  customerPhone: z.string().min(1, "전화번호를 입력해주세요"),
  address1: z.string().min(1, "주소를 입력해주세요"),
  smallBoxQuantity: z.number().min(0, "소박스 수량은 0개 이상이어야 합니다"),
  largeBoxQuantity: z.number().min(0, "대박스 수량은 0개 이상이어야 합니다"),
  wrappingQuantity: z.number().min(0, "보자기 포장 수량은 0개 이상이어야 합니다"),
  orderPassword: z.string().optional(), // 비로그인 사용자를 위한 비밀번호
}).refine((data) => data.smallBoxQuantity + data.largeBoxQuantity >= 1, {
  message: "최소 1개 이상의 상품을 선택해주세요",
  path: ["smallBoxQuantity"],
});

type EditOrderFormData = z.infer<typeof editOrderSchema>;

const prices = {
  small: 19000,
  large: 21000,
  wrapping: 1000,
  shipping: 4000,
};

export default function OrderEdit() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  const form = useForm<EditOrderFormData>({
    resolver: zodResolver(editOrderSchema),
  });

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/orders/${id}`);
        if (!response.ok) {
          throw new Error('주문을 찾을 수 없습니다');
        }
        const orderData = await response.json();
        setOrder(orderData);
        
        // Check if order can be edited
        if (orderData.status !== 'pending' || orderData.paymentStatus !== 'pending') {
          toast({
            title: "수정 불가",
            description: "이미 처리된 주문은 수정할 수 없습니다.",
            variant: "destructive",
          });
          setLocation('/order-lookup');
          return;
        }

        // 비로그인 사용자이고 주문에 비밀번호가 있으면 비밀번호 입력 필요
        if (!isAuthenticated && orderData.orderPassword) {
          setNeedsPassword(true);
        }

        // Set form values
        form.reset({
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          zipCode: orderData.zipCode ?? '',
          address1: orderData.address1,
          address2: orderData.address2 ?? '',
          specialRequests: orderData.specialRequests ?? '',
          smallBoxQuantity: orderData.smallBoxQuantity || 0,
          largeBoxQuantity: orderData.largeBoxQuantity || 0,
          wrappingQuantity: orderData.wrappingQuantity || 0,
          orderPassword: '',
        });
      } catch (error) {
        toast({
          title: "오류",
          description: error instanceof Error ? error.message : "주문 정보를 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
        setLocation('/order-lookup');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchOrder();
    }
  }, [id, toast, setLocation, form, isAuthenticated]);

  const onSubmit = async (data: EditOrderFormData) => {
    console.log('onSubmit 함수 호출됨');
    console.log('form 데이터:', data);
    console.log('order 정보:', order);
    
    if (!order) {
      console.error('order가 없음');
      return;
    }
    
    setIsSaving(true);
    try {
      const totalQuantity = data.smallBoxQuantity + data.largeBoxQuantity;
      const shippingFee = totalQuantity >= 6 ? 0 : prices.shipping;
      const totalAmount = 
        (data.smallBoxQuantity * prices.small) +
        (data.largeBoxQuantity * prices.large) +
        (data.wrappingQuantity * prices.wrapping) +
        shippingFee;

      const updateData = {
        ...data,
        totalAmount,
        shippingFee,
      };

      console.log('주문 수정 요청 데이터:', updateData);
      console.log('인증 상태:', isAuthenticated);
      
      // Use different API endpoint based on authentication status
      const apiUrl = isAuthenticated ? `/api/my-orders/${order.id}` : `/api/orders/${order.id}`;
      console.log('사용할 API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      console.log('응답 상태:', response.status);
      console.log('응답 헤더:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json();
        console.error('수정 실패:', errorData);
        throw new Error(errorData.message || '주문 수정에 실패했습니다');
      }

      const responseData = await response.json();
      console.log('응답 데이터:', responseData);
      console.log('주문 수정 성공, 팝업 표시 시도');
      
      // 성공 팝업 표시
      console.log('showSuccessDialog 상태 변경 전:', showSuccessDialog);
      setShowSuccessDialog(true);
      console.log('showSuccessDialog 상태 변경 후 - setShowSuccessDialog(true) 호출됨');
    } catch (error) {
      toast({
        title: "수정 실패",
        description: error instanceof Error ? error.message : "주문 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const calculateTotal = () => {
    const smallBoxQuantity = form.watch("smallBoxQuantity") || 0;
    const largeBoxQuantity = form.watch("largeBoxQuantity") || 0;
    const wrappingQuantity = form.watch("wrappingQuantity") || 0;
    
    const totalQuantity = smallBoxQuantity + largeBoxQuantity;
    const shippingFee = totalQuantity >= 6 ? 0 : (totalQuantity > 0 ? prices.shipping : 0);
    
    return smallBoxQuantity * prices.small + 
           largeBoxQuantity * prices.large + 
           wrappingQuantity * prices.wrapping + 
           shippingFee;
  };

  const formatPrice = (price: number) => `${price.toLocaleString()}원`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-eden-cream flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-eden-brown mx-auto mb-4"></div>
          <p className="text-eden-dark">주문 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-eden-cream flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">주문을 찾을 수 없습니다.</p>
          <Link href="/order-lookup">
            <Button>주문 조회로 돌아가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-eden-cream py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-6">
          <Link href="/order-lookup">
            <Button variant="ghost" className="text-eden-brown hover:text-eden-dark">
              <ArrowLeft className="mr-2 h-4 w-4" />
              뒤로 가기
            </Button>
          </Link>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="bg-eden-sage text-white">
            <CardTitle className="text-xl font-korean">
              주문 수정 - #{order.orderNumber}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                console.error('폼 검증 실패:', errors);
              })} className="space-y-8">
                {/* Customer Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">고객 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>이름 *</FormLabel>
                          <FormControl>
                            <Input placeholder="성함을 입력해주세요" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>전화번호 *</FormLabel>
                          <FormControl>
                            <Input placeholder="010-0000-0000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>우편번호</FormLabel>
                          <FormControl>
                            <Input placeholder="12345" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address1"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>주소 *</FormLabel>
                          <FormControl>
                            <Input placeholder="기본 주소" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>상세 주소</FormLabel>
                        <FormControl>
                          <Input placeholder="상세 주소" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 비로그인 사용자를 위한 주문 비밀번호 입력 */}
                  {needsPassword && (
                    <FormField
                      control={form.control}
                      name="orderPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            주문 비밀번호 *
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="주문 시 설정한 비밀번호를 입력해주세요"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          <div className="text-sm text-gray-600">
                            주문을 수정하려면 주문 시 설정한 비밀번호가 필요합니다.
                          </div>
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="specialRequests"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>배송 요청사항</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="배송 시 요청사항이 있으시면 입력해주세요"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Product Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">상품 정보</h3>
                  
                  {/* Small Box */}
                  <div className="border-2 border-eden-beige rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-eden-brown">소박스 - 한과1호</h4>
                        <p className="text-sm text-eden-sage">전통유과 15개입 (약 1.2kg)</p>
                        <p className="text-xs text-eden-dark">약 35.5×21×11.2cm</p>
                      </div>
                      <span className="text-xl font-bold text-eden-brown">{formatPrice(prices.small)}</span>
                    </div>
                    <FormField
                      control={form.control}
                      name="smallBoxQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>수량</FormLabel>
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
                                className="w-20 text-center"
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

                  {/* Large Box */}
                  <div className="border-2 border-eden-beige rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-eden-brown">대박스 - 한과2호</h4>
                        <p className="text-sm text-eden-sage">전통유과 25개입 (약 1.3kg)</p>
                        <p className="text-xs text-eden-dark">약 37×23×11.5cm</p>
                      </div>
                      <span className="text-xl font-bold text-eden-brown">{formatPrice(prices.large)}</span>
                    </div>
                    <FormField
                      control={form.control}
                      name="largeBoxQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>수량</FormLabel>
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
                                className="w-20 text-center"
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

                  {/* Wrapping */}
                  <FormField
                    control={form.control}
                    name="wrappingQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>보자기 포장 수량</FormLabel>
                        <p className="text-xs text-gray-600 mb-2">개당 +1,000원</p>
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
                              className="w-20 text-center"
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

                  {/* Order Summary */}
                  <div className="bg-eden-cream p-6 rounded-lg border-2 border-eden-beige">
                    <h4 className="text-lg font-semibold text-eden-brown mb-4">주문 요약</h4>
                    <div className="space-y-3">
                      {/* Product items */}
                      {form.watch("smallBoxQuantity") > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">
                            한과1호(약 1.1kg) × {form.watch("smallBoxQuantity")}개
                          </span>
                          <span className="font-medium">
                            {formatPrice(form.watch("smallBoxQuantity") * prices.small)}
                          </span>
                        </div>
                      )}
                      
                      {form.watch("largeBoxQuantity") > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">
                            한과2호(약 1.3kg) × {form.watch("largeBoxQuantity")}개
                          </span>
                          <span className="font-medium">
                            {formatPrice(form.watch("largeBoxQuantity") * prices.large)}
                          </span>
                        </div>
                      )}
                      
                      {form.watch("wrappingQuantity") > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">
                            보자기 포장 × {form.watch("wrappingQuantity")}개
                          </span>
                          <span className="font-medium">
                            {formatPrice(form.watch("wrappingQuantity") * prices.wrapping)}
                          </span>
                        </div>
                      )}
                      
                      {/* Shipping fee */}
                      {(() => {
                        const totalQuantity = (form.watch("smallBoxQuantity") || 0) + (form.watch("largeBoxQuantity") || 0);
                        const shippingFee = totalQuantity >= 6 ? 0 : (totalQuantity > 0 ? prices.shipping : 0);
                        
                        if (shippingFee > 0) {
                          return (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-700">배송비</span>
                              <span className="font-medium">{formatPrice(shippingFee)}</span>
                            </div>
                          );
                        } else if (totalQuantity >= 6) {
                          return (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-700">배송비</span>
                              <span className="font-medium text-green-600">무료배송</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Divider */}
                      <hr className="border-eden-sage" />
                      
                      {/* Total */}
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span className="text-eden-brown">총 주문 금액</span>
                        <span className="text-eden-brown">{formatPrice(calculateTotal())}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex-1 bg-eden-brown hover:bg-eden-dark text-white"
                    onClick={(e) => {
                      console.log('수정 완료 버튼 클릭됨');
                      console.log('폼 상태:', form.formState);
                      console.log('폼 에러:', form.formState.errors);
                      // Let the form handle the submit
                    }}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? "저장 중..." : "수정 완료"}
                  </Button>
                  <Link href="/order-lookup">
                    <Button type="button" variant="outline" className="text-eden-brown border-eden-brown">
                      취소
                    </Button>
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      
      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <DialogTitle className="text-center text-2xl font-bold text-eden-brown">
              수정이 완료되었습니다!
            </DialogTitle>
            <DialogDescription className="text-center text-gray-600 mt-2">
              주문 정보가 성공적으로 수정되었습니다.
              <br />
              주문 조회 페이지로 이동하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              onClick={() => {
                setShowSuccessDialog(false);
                setLocation('/order-lookup');
              }}
              className="bg-eden-brown hover:bg-eden-dark text-white flex-1"
            >
              주문 조회로 이동
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSuccessDialog(false)}
              className="text-eden-brown border-eden-brown flex-1"
            >
              여기서 계속
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}