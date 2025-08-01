import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ShoppingCart, Box, Calculator, Search, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";  
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { z } from "zod";

// Daum 우편번호 서비스 타입 정의
declare global {
  interface Window {
    daum: any;
  }
}

const orderSchema = z.object({
  customerName: z.string().min(1, "이름을 입력해주세요"),
  customerPhone: z.string().min(1, "전화번호를 입력해주세요"),
  zipCode: z.string().optional(),
  address1: z.string().min(1, "주소를 입력해주세요"),
  address2: z.string().optional(),
  specialRequests: z.string().optional(),
  smallBoxQuantity: z.number().min(0, "소박스 수량은 0개 이상이어야 합니다"),
  largeBoxQuantity: z.number().min(0, "대박스 수량은 0개 이상이어야 합니다"),
  wrappingQuantity: z.number().min(0, "보자기 포장 수량은 0개 이상이어야 합니다"),
  scheduledDate: z.date().optional(),
}).refine((data) => data.smallBoxQuantity + data.largeBoxQuantity >= 1, {
  message: "최소 1개 이상의 상품을 선택해주세요",
  path: ["smallBoxQuantity"],
}).refine((data) => data.wrappingQuantity <= data.smallBoxQuantity + data.largeBoxQuantity, {
  message: "보자기 포장 수량은 전체 수량보다 클 수 없습니다",
  path: ["wrappingQuantity"],
});

type OrderFormData = z.infer<typeof orderSchema>;

const prices = {
  small: 19000, // 한과1호
  large: 21000, // 한과2호
  wrapping: 1000,
  shipping: 4000,
};

export default function OrderForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [totalAmount, setTotalAmount] = useState(0);

  // Daum 우편번호 서비스 스크립트 로드
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    document.head.appendChild(script);
    
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
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
      scheduledDate: undefined,
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: api.orders.create,
    onSuccess: (order: any) => {
      // Invalidate orders cache so admin panel updates
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "주문 완료",
        description: `주문번호 ${order.orderNumber}로 접수되었습니다. 감사합니다!`,
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "주문 실패",
        description: error.message || "주문 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const watchedValues = form.watch(["smallBoxQuantity", "largeBoxQuantity", "wrappingQuantity"]);

  useEffect(() => {
    const [smallBoxQuantity, largeBoxQuantity, wrappingQuantity] = watchedValues;
    const smallBoxTotal = prices.small * smallBoxQuantity;
    const largeBoxTotal = prices.large * largeBoxQuantity;
    const wrappingTotal = wrappingQuantity * prices.wrapping;
    const totalQuantity = smallBoxQuantity + largeBoxQuantity;
    
    // 배송비 계산: 6개 이상이면 무료, 미만이면 4000원
    const shippingFee = totalQuantity >= 6 ? 0 : (totalQuantity > 0 ? prices.shipping : 0);
    
    const total = smallBoxTotal + largeBoxTotal + wrappingTotal + shippingFee;
    setTotalAmount(total);
  }, [watchedValues]);

  const onSubmit = (data: OrderFormData) => {
    const totalQuantity = data.smallBoxQuantity + data.largeBoxQuantity;
    const shippingFee = totalQuantity >= 6 ? 0 : prices.shipping;
    
    const orderData = {
      ...data,
      shippingFee,
      totalAmount,
      scheduledDate: data.scheduledDate ? data.scheduledDate.toISOString() : null,
      status: data.scheduledDate ? 'scheduled' : 'pending', // 예약발송일이 있으면 자동으로 발송예약 상태로 설정
    };
    createOrderMutation.mutate(orderData);
  };

  const formatPrice = (price: number) => `${price.toLocaleString()}원`;

  // 주소 검색 기능
  const openAddressSearch = () => {
    if (!window.daum) {
      toast({
        title: "주소 검색 오류",
        description: "주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
      return;
    }

    new window.daum.Postcode({
      oncomplete: function(data: any) {
        // 팝업에서 검색결과 항목을 클릭했을때 실행할 코드를 작성하는 부분.
        let addr = ''; // 주소 변수
        let extraAddr = ''; // 참고항목 변수

        // 사용자가 선택한 주소 타입에 따라 해당 주소 값을 가져온다.
        if (data.userSelectedType === 'R') { // 사용자가 도로명 주소를 선택했을 경우
          addr = data.roadAddress;
        } else { // 사용자가 지번 주소를 선택했을 경우(J)
          addr = data.jibunAddress;
        }

        // 사용자가 선택한 주소가 도로명 타입일때 참고항목을 조합한다.
        if(data.userSelectedType === 'R'){
          // 법정동명이 있을 경우 추가한다. (법정리는 제외)
          // 법정동의 경우 마지막 문자가 "동/로/가"로 끝난다.
          if(data.bname !== '' && /[동|로|가]$/g.test(data.bname)){
            extraAddr += data.bname;
          }
          // 건물명이 있고, 공동주택일 경우 추가한다.
          if(data.buildingName !== '' && data.apartment === 'Y'){
            extraAddr += (extraAddr !== '' ? ', ' + data.buildingName : data.buildingName);
          }
          // 표시할 참고항목이 있을 경우, 괄호까지 추가한 최종 문자열을 만든다.
          if(extraAddr !== ''){
            extraAddr = ' (' + extraAddr + ')';
          }
        }

        // 우편번호와 주소 정보를 해당 필드에 넣는다.
        form.setValue('zipCode', data.zonecode);
        form.setValue('address1', addr + extraAddr);
        
        // 상세주소 입력 필드에 포커스
        const address2Input = document.querySelector('input[placeholder="상세 주소"]') as HTMLInputElement;
        if (address2Input) {
          address2Input.focus();
        }
      }
    }).open();
  };

  const smallBoxQuantity = form.watch("smallBoxQuantity");
  const largeBoxQuantity = form.watch("largeBoxQuantity");
  const wrappingQuantity = form.watch("wrappingQuantity");
  const totalQuantity = smallBoxQuantity + largeBoxQuantity;
  
  const smallBoxTotal = prices.small * smallBoxQuantity;
  const largeBoxTotal = prices.large * largeBoxQuantity;
  const wrappingTotal = wrappingQuantity * prices.wrapping;
  const shippingFee = totalQuantity >= 6 ? 0 : (totalQuantity > 0 ? prices.shipping : 0);

  return (
    <div className="max-w-4xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Product Selection */}
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <h4 className="text-xl font-semibold text-eden-brown mb-6 font-korean">
                  <Box className="inline mr-2 h-5 w-5" />
                  상품 선택
                </h4>
                
                <div className="space-y-6">
                  {/* Small Box Selection */}
                  <div className="border-2 border-eden-beige rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h5 className="text-lg font-semibold text-eden-brown">한과1호(약 1.1kg)</h5>
                        <p className="text-xs text-eden-dark mt-1">약 35.5×21×11.2cm</p>
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

                  {/* Large Box Selection */}
                  <div className="border-2 border-eden-beige rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h5 className="text-lg font-semibold text-eden-brown">한과2호(약 1.3kg)</h5>
                        <p className="text-xs text-eden-dark mt-1">약 37×23×11.5cm</p>
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

                  {/* Wrapping Selection */}
                  <FormField
                    control={form.control}
                    name="wrappingQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>보자기 수량</FormLabel>
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
                              max={totalQuantity}
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

                  {/* Scheduled Delivery Date */}
                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>예약발송</FormLabel>
                        <p className="text-xs text-gray-600 mb-2">원하는 발송일을 선택하세요 (선택사항)</p>
                        <p className="text-xs text-gray-500 mb-3 border-l-2 border-gray-300 pl-2">미리 주문 시 예약 발송 가능 (도착일이 아닌 발송일 기준)</p>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={`w-full justify-start text-left font-normal ${
                                  !field.value && "text-muted-foreground"
                                }`}
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                {field.value ? (
                                  format(field.value, "PPP", { locale: ko })
                                ) : (
                                  <span>날짜를 선택하세요</span>
                                )}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date() || date < new Date("1900-01-01")}
                              initialFocus
                              locale={ko}
                            />
                            {field.value && (
                              <div className="p-3 border-t">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => field.onChange(undefined)}
                                  className="w-full"
                                >
                                  날짜 선택 해제
                                </Button>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 배송 안내 */}
                  <div className="mt-6 p-4 bg-eden-cream/30 rounded-lg border border-eden-brown/20">
                    <h4 className="text-base font-semibold text-eden-brown mb-3">에덴한과 배송</h4>
                    <div className="text-sm text-gray-700 space-y-2 leading-relaxed">
                      <p>• 물건은 입금 확인 후 1~2일 이내 발송합니다.</p>
                      <p>• 설 명절 1~2주 전은 택배사의 과부하로 배송이 늦어질 수 있습니다.</p>
                      <p>• 주문 접수 후 3일 이내 미도착시 반드시 연락주세요.</p>
                      <p className="text-eden-brown font-medium">• 설날 명절 2주 전에는 미리 주문 부탁드려요.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Information & Order Summary */}
            <div className="space-y-6">
              {/* Customer Info */}
              <Card className="shadow-lg">
                <CardContent className="p-8">
                  <h4 className="text-xl font-semibold text-eden-brown mb-6 font-korean">
                    고객 정보
                  </h4>
                  
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>이름 *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="성함을 입력해주세요"
                              {...field}
                            />
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
                            <Input 
                              placeholder="010-0000-0000"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-2">
                      <FormField
                        control={form.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>우편번호</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="12345"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="col-span-2 flex items-end">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="w-full"
                          onClick={openAddressSearch}
                        >
                          <Search className="mr-2 h-4 w-4" />
                          주소 검색
                        </Button>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="address1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>주소 *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="기본 주소"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address2"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input 
                              placeholder="상세 주소"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="specialRequests"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>요청사항</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="배송 시 특별한 요청사항이 있으시면 적어주세요"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Order Summary */}
              <Card>
                <CardContent className="p-8">
                  <h4 className="text-xl font-semibold text-eden-brown mb-6 font-korean">
                    <Calculator className="inline mr-2 h-5 w-5" />
                    주문 요약
                  </h4>

                  <div className="space-y-4">
                    {/* Price Summary */}
                    <div className="bg-eden-cream p-4 rounded-lg">
                      <div className="space-y-2 text-sm">
                        {smallBoxQuantity > 0 && (
                          <div className="flex justify-between">
                            <span>소박스 × {smallBoxQuantity}:</span>
                            <span>{formatPrice(smallBoxTotal)}</span>
                          </div>
                        )}
                        {largeBoxQuantity > 0 && (
                          <div className="flex justify-between">
                            <span>대박스 × {largeBoxQuantity}:</span>
                            <span>{formatPrice(largeBoxTotal)}</span>
                          </div>
                        )}
                        {wrappingTotal > 0 && (
                          <div className="flex justify-between">
                            <span>보자기 × {wrappingQuantity}:</span>
                            <span>{formatPrice(wrappingTotal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>배송비:</span>
                          <span>{shippingFee === 0 ? "무료" : formatPrice(shippingFee)}</span>
                        </div>
                        <div className="border-t border-eden-sage pt-2 mt-2">
                          <div className="flex justify-between font-bold text-lg text-eden-brown">
                            <span>총 주문금액:</span>
                            <span>{formatPrice(totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Shipping Info */}
                    {totalQuantity > 0 && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h5 className="font-medium text-blue-900 mb-2">배송비 안내</h5>
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">총 {totalQuantity}개 선택</span>
                        </p>
                        <p className="text-sm text-blue-800">
                          6개 이상: <span className="text-green-600 font-semibold">무료배송</span>
                        </p>
                        <p className="text-xs text-eden-dark mt-2">
                          * 제주도, 도서산간지역은 추가비용 발생
                        </p>
                      </div>
                    )}

                    {totalQuantity === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        상품을 선택해주세요
                      </div>
                    )}

                    <Button 
                      type="submit" 
                      size="lg" 
                      className="w-full bg-eden-brown hover:bg-eden-dark text-white font-semibold py-3"
                      disabled={createOrderMutation.isPending || totalQuantity === 0}
                    >
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      {createOrderMutation.isPending ? "주문 중..." : "주문하기"}
                    </Button>

                    <div className="text-center pt-4">
                      <Link href="/order-lookup">
                        <Button variant="outline" className="text-eden-brown border-eden-brown hover:bg-eden-cream">
                          주문 조회하기
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}