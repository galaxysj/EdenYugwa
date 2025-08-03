import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { type InsertOrder } from "@shared/schema";
import { Loader2, Package, MapPin, User, Phone, Calendar, Gift } from "lucide-react";

// Public order form schema
const publicOrderSchema = z.object({
  customerName: z.string().min(1, "고객명을 입력해주세요"),
  customerPhone: z.string().min(1, "연락처를 입력해주세요"),
  zipCode: z.string().optional(),
  address1: z.string().min(1, "주소를 입력해주세요"),
  address2: z.string().optional(),
  // 받는 분 정보
  recipientName: z.string().optional(),
  recipientPhone: z.string().optional(),
  recipientZipCode: z.string().optional(),
  recipientAddress1: z.string().optional(),
  recipientAddress2: z.string().optional(),
  // 예금자 정보
  isDifferentDepositor: z.boolean().default(false),
  depositorName: z.string().optional(),
  smallBoxQuantity: z.number().min(0).default(0),
  largeBoxQuantity: z.number().min(0).default(0),
  wrappingQuantity: z.number().min(0).default(0),
  specialRequests: z.string().optional(),
  scheduledDate: z.string().optional(),
});

type PublicOrderForm = z.infer<typeof publicOrderSchema>;

export default function PublicOrder() {
  const { toast } = useToast();
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string>("");

  const form = useForm<PublicOrderForm>({
    resolver: zodResolver(publicOrderSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      zipCode: "",
      address1: "",
      address2: "",
      recipientName: "",
      recipientPhone: "",
      recipientZipCode: "",
      recipientAddress1: "",
      recipientAddress2: "",
      isDifferentDepositor: false,
      depositorName: "",
      smallBoxQuantity: 0,
      largeBoxQuantity: 0,
      wrappingQuantity: 0,
      specialRequests: "",
      scheduledDate: "",
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: (data: InsertOrder) => api.orders.create(data),
    onSuccess: (newOrder) => {
      // Invalidate customers cache to refresh the customer management
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      
      setOrderNumber(newOrder.orderNumber);
      setOrderComplete(true);
      toast({
        title: "주문이 완료되었습니다",
        description: `주문번호: ${newOrder.orderNumber}`,
      });
    },
    onError: (error) => {
      console.error("Order creation error:", error);
      toast({
        title: "주문 실패",
        description: "주문 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PublicOrderForm) => {
    // Calculate total amount
    const smallBoxPrice = 30000;
    const largeBoxPrice = 50000;
    const wrappingPrice = 2000;
    
    const totalAmount = 
      (data.smallBoxQuantity * smallBoxPrice) +
      (data.largeBoxQuantity * largeBoxPrice) +
      (data.wrappingQuantity * wrappingPrice);

    const orderData: InsertOrder = {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      zipCode: data.zipCode || null,
      address1: data.address1,
      address2: data.address2 || null,
      // 받는 분 정보
      recipientName: data.recipientName || null,
      recipientPhone: data.recipientPhone || null,
      recipientZipCode: data.recipientZipCode || null,
      recipientAddress1: data.recipientAddress1 || null,
      recipientAddress2: data.recipientAddress2 || null,
      // 입금자 정보
      isDifferentDepositor: data.isDifferentDepositor,
      depositorName: data.isDifferentDepositor ? data.depositorName || null : null,
      smallBoxQuantity: data.smallBoxQuantity,
      largeBoxQuantity: data.largeBoxQuantity,
      wrappingQuantity: data.wrappingQuantity,
      specialRequests: data.specialRequests || null,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
      totalAmount,
      status: "pending",
      paymentStatus: "pending",
    };

    createOrderMutation.mutate(orderData);
  };

  const calculateTotal = () => {
    const smallBoxPrice = 30000;
    const largeBoxPrice = 50000;
    const wrappingPrice = 2000;
    
    const smallBoxQuantity = form.watch("smallBoxQuantity") || 0;
    const largeBoxQuantity = form.watch("largeBoxQuantity") || 0;
    const wrappingQuantity = form.watch("wrappingQuantity") || 0;
    
    return (smallBoxQuantity * smallBoxPrice) + 
           (largeBoxQuantity * largeBoxPrice) + 
           (wrappingQuantity * wrappingPrice);
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString() + "원";
  };

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-eden-cream via-white to-eden-cream/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-eden-brown/20 shadow-lg">
          <CardHeader className="text-center bg-eden-brown text-white rounded-t-lg">
            <CardTitle className="text-2xl font-korean flex items-center justify-center gap-2">
              <Gift className="h-6 w-6" />
              주문 완료
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 text-center space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="text-green-800 font-semibold text-lg mb-2">
                주문이 성공적으로 접수되었습니다
              </div>
              <div className="text-green-700">
                주문번호: <span className="font-bold">#{orderNumber}</span>
              </div>
            </div>
            
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2">
                <Phone className="h-4 w-4" />
                <span>주문 확인 연락을 드릴 예정입니다</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>배송일정은 별도 안내드립니다</span>
              </div>
            </div>

            <div className="pt-4">
              <Button 
                onClick={() => {
                  setOrderComplete(false);
                  setOrderNumber("");
                  form.reset();
                }}
                className="w-full bg-eden-brown hover:bg-eden-brown/90"
              >
                새 주문하기
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-eden-cream via-white to-eden-cream/30 py-8">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-korean font-bold text-eden-brown mb-2">
            에덴한과
          </h1>
          <p className="text-gray-600 text-lg">
            전통의 맛을 담은 정성스러운 한과
          </p>
        </div>

        <Card className="border-eden-brown/20 shadow-lg">
          <CardHeader className="bg-eden-brown text-white">
            <CardTitle className="text-2xl font-korean flex items-center gap-2">
              <Package className="h-6 w-6" />
              주문하기
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Customer Information */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                    <User className="h-5 w-5 text-eden-brown" />
                    <h3 className="text-lg font-semibold text-gray-900">주문자 정보</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>주문자 이름 *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="홍길동" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="isDifferentDepositor"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-1 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="flex items-center gap-0.5 text-xs">
                            <span className="mr-1">←</span>
                            <span>입금자가 다르면 체크표시 클릭 후 입금자 입력해주세요</span>
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch("isDifferentDepositor") && (
                    <FormField
                      control={form.control}
                      name="depositorName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>입금자 이름 *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="홍길동" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>주문자 연락처 *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="010-1234-5678" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>주문자 우편번호</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="12345" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name="address1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>주문자 주소 *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="서울시 강남구 테헤란로 123" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="address2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>주문자 상세주소</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="101동 502호" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Recipient Information */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                    <MapPin className="h-5 w-5 text-eden-brown" />
                    <h3 className="text-lg font-semibold text-gray-900">받는 분 정보</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="recipientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>받는 분 이름</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="김받는분" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="recipientPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>받는 분 연락처</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="010-9876-5432" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="recipientZipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>받는 분 우편번호</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="12345" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name="recipientAddress1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>받는 분 주소</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="부산시 해운대구 센텀시티로 456" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="recipientAddress2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>받는 분 상세주소</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="202동 1005호" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>



                {/* Product Selection */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                    <Gift className="h-5 w-5 text-eden-brown" />
                    <h3 className="text-lg font-semibold text-gray-900">상품 선택</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                      <div className="text-center">
                        <h4 className="font-semibold text-gray-900">한과1호 (소박스)</h4>
                        <p className="text-2xl font-bold text-eden-brown">30,000원</p>
                      </div>
                      <FormField
                        control={form.control}
                        name="smallBoxQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>수량</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                      <div className="text-center">
                        <h4 className="font-semibold text-gray-900">한과2호 (대박스)</h4>
                        <p className="text-2xl font-bold text-eden-brown">50,000원</p>
                      </div>
                      <FormField
                        control={form.control}
                        name="largeBoxQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>수량</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                      <div className="text-center">
                        <h4 className="font-semibold text-gray-900">보자기 포장</h4>
                        <p className="text-2xl font-bold text-eden-brown">2,000원</p>
                      </div>
                      <FormField
                        control={form.control}
                        name="wrappingQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>수량</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Special Requests */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="specialRequests"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>특별 요청사항</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field}
                            value={field.value || ""}
                            placeholder="배송 관련 요청사항이나 기타 문의사항을 적어주세요"
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Scheduled Date */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>희망 배송일 (선택사항)</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field}
                            value={field.value || ""}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Order Summary */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">주문 요약</h3>
                  <div className="space-y-2 text-sm">
                    {(form.watch("smallBoxQuantity") || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>한과1호×{form.watch("smallBoxQuantity") || 0}개</span>
                        <span>{formatPrice((form.watch("smallBoxQuantity") || 0) * 30000)}</span>
                      </div>
                    )}
                    {(form.watch("largeBoxQuantity") || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>한과2호×{form.watch("largeBoxQuantity") || 0}개</span>
                        <span>{formatPrice((form.watch("largeBoxQuantity") || 0) * 50000)}</span>
                      </div>
                    )}
                    {(form.watch("wrappingQuantity") || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>보자기×{form.watch("wrappingQuantity") || 0}개</span>
                        <span>{formatPrice((form.watch("wrappingQuantity") || 0) * 2000)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 mt-4">
                      <div className="flex justify-between text-lg font-semibold text-eden-brown">
                        <span>총 주문금액</span>
                        <span>{formatPrice(calculateTotal())}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  disabled={createOrderMutation.isPending || calculateTotal() === 0}
                  className="w-full bg-eden-brown hover:bg-eden-brown/90 text-lg py-6"
                >
                  {createOrderMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      주문 처리 중...
                    </>
                  ) : (
                    "주문하기"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}