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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ShoppingCart, Box, Calculator, Search, Calendar, AlertTriangle, User, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";  
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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

type OrderFormData = z.infer<typeof orderSchema>;

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('ko-KR').format(price) + '원';
};

const prices = {
  small: 19000, // 한과1호
  large: 21000, // 한과2호
  wrapping: 1000,
  shipping: 4000,
};



export default function OrderForm() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const queryClient = useQueryClient();
  const [totalAmount, setTotalAmount] = useState(0);
  const [showShippingAlert, setShowShippingAlert] = useState(false);
  const [shippingFee, setShippingFee] = useState(0);
  const [selectedAddress, setSelectedAddress] = useState<{
    zipCode: string;
    address: string;
    buildingName: string;
  } | null>(null);

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
      isDifferentDepositor: false,
      depositorName: "",
    },
  });

  // 로그인된 사용자의 정보로 폼 초기화
  useEffect(() => {
    if (isAuthenticated && user) {
      form.setValue("customerName", user.name || "");
      form.setValue("customerPhone", user.phoneNumber || "");
    }
  }, [isAuthenticated, user, form]);

  // 재주문 데이터 로드
  useEffect(() => {
    const reorderData = localStorage.getItem('reorderData');
    if (reorderData) {
      try {
        const data = JSON.parse(reorderData);
        console.log('재주문 데이터 로드:', data);
        
        // 기존 주문 정보로 폼 초기화
        form.reset(data);
        
        // 주소 검색 관련 상태 업데이트
        if (data.address1) {
          setSelectedAddress({
            zipCode: data.zipCode,
            address: data.address1,
            buildingName: ""
          });
        }
        
        // 원격지역 배송 확인
        if (data.address1 && checkRemoteArea(data.address1)) {
          setShowShippingAlert(true);
        }
        
        // 재주문 데이터 제거
        localStorage.removeItem('reorderData');
        
        toast({
          title: "재주문 정보 불러오기 완료",
          description: "기존 주문 정보를 불러왔습니다. 상품을 선택해주세요.",
        });
      } catch (error) {
        console.error('재주문 데이터 로드 실패:', error);
        localStorage.removeItem('reorderData');
      }
    }
  }, [form, toast]);

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
  const addressValue = form.watch("address1");

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

  // 주소가 변경될 때 제주도/도서산간지역 체크
  useEffect(() => {
    if (addressValue && checkRemoteArea(addressValue)) {
      setShowShippingAlert(true);
    }
  }, [addressValue]);

  useEffect(() => {
    const [smallBoxQuantity, largeBoxQuantity, wrappingQuantity] = watchedValues;
    const smallBoxTotal = prices.small * smallBoxQuantity;
    const largeBoxTotal = prices.large * largeBoxQuantity;
    const wrappingTotal = wrappingQuantity * prices.wrapping;
    const totalQuantity = smallBoxQuantity + largeBoxQuantity;
    
    // 배송비 계산: 6개 이상이면 무료, 미만이면 4000원
    const calculatedShippingFee = totalQuantity >= 6 ? 0 : (totalQuantity > 0 ? prices.shipping : 0);
    setShippingFee(calculatedShippingFee);
    
    const total = smallBoxTotal + largeBoxTotal + wrappingTotal + calculatedShippingFee;
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
      status: data.scheduledDate ? 'scheduled' : 'pending',
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
        
        // 제주도/도서산간지역 체크
        if (checkRemoteArea(addr + extraAddr)) {
          setShowShippingAlert(true);
        }
        
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
  // 배송비는 state에서 관리되므로 shippingFee 사용

  return (
    <div className="max-w-4xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-12">
            {/* Product Selection */}
            <Card className="shadow-lg">
              <CardContent className="p-4 md:p-6 lg:p-8">
                <h4 className="text-lg md:text-xl font-semibold section-title mb-4 md:mb-6 font-korean">
                  <Box className="inline mr-2 h-4 w-4 md:h-5 md:w-5" />
                  상품 선택
                </h4>
                
                <div className="space-y-3 md:space-y-4">
                  {/* Product Selection - All in One Interface */}
                  <div className="border-2 border-eden-beige rounded-lg p-3 md:p-4">
                    <div className="space-y-3 md:space-y-4">
                      {/* 한과1호 Selection */}
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h5 className="font-semibold text-black text-sm md:text-base">한과1호(약 1.1kg)</h5>
                            <p className="text-xs text-black mt-1">약 35.5×21×11.2cm</p>
                          </div>
                          <span className="text-lg md:text-xl font-bold text-black whitespace-nowrap">{formatPrice(prices.small)}</span>
                        </div>
                        <FormField
                          control={form.control}
                          name="smallBoxQuantity"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center space-x-2">
                                <FormLabel className="text-sm font-medium">수량</FormLabel>
                                <FormControl>
                                  <div className="flex items-center space-x-1">
                                    <Button 
                                      type="button"
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => field.onChange(Math.max(0, field.value - 1))}
                                      className="w-7 h-7 p-0 text-xs"
                                    >
                                      -
                                    </Button>
                                    <Input
                                      type="number"
                                      min="0"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                      className="w-12 h-7 text-center text-xs px-1"
                                    />
                                    <Button 
                                      type="button"
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => field.onChange(field.value + 1)}
                                      className="w-7 h-7 p-0 text-xs"
                                    >
                                      +
                                    </Button>
                                  </div>
                                </FormControl>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Divider */}
                      <div className="border-t border-eden-beige/50"></div>

                      {/* 한과2호 Selection */}
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h5 className="font-semibold text-black text-sm md:text-base">한과2호(약 1.3kg)</h5>
                            <p className="text-xs text-black mt-1">약 37×23×11.5cm</p>
                          </div>
                          <span className="text-lg md:text-xl font-bold text-black whitespace-nowrap">{formatPrice(prices.large)}</span>
                        </div>
                        <FormField
                          control={form.control}
                          name="largeBoxQuantity"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center space-x-2">
                                <FormLabel className="text-sm font-medium">수량</FormLabel>
                                <FormControl>
                                  <div className="flex items-center space-x-1">
                                    <Button 
                                      type="button"
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => field.onChange(Math.max(0, field.value - 1))}
                                      className="w-7 h-7 p-0 text-xs"
                                    >
                                      -
                                    </Button>
                                    <Input
                                      type="number"
                                      min="0"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                      className="w-12 h-7 text-center text-xs px-1"
                                    />
                                    <Button 
                                      type="button"
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => field.onChange(field.value + 1)}
                                      className="w-7 h-7 p-0 text-xs"
                                    >
                                      +
                                    </Button>
                                  </div>
                                </FormControl>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Divider */}
                      <div className="border-t border-eden-beige/50"></div>

                      {/* 보자기 Selection */}
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h5 className="font-semibold text-black text-sm md:text-base">보자기</h5>
                            <p className="text-xs text-black mt-1">개당 +1,000원</p>
                          </div>
                          <span className="text-lg md:text-xl font-bold text-black whitespace-nowrap">{formatPrice(prices.wrapping)}</span>
                        </div>
                        <FormField
                          control={form.control}
                          name="wrappingQuantity"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center space-x-2">
                                <FormLabel className="text-sm font-medium">수량</FormLabel>
                                <FormControl>
                                  <div className="flex items-center space-x-1">
                                    <Button 
                                      type="button"
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => field.onChange(Math.max(0, field.value - 1))}
                                      className="w-7 h-7 p-0 text-xs"
                                    >
                                      -
                                    </Button>
                                    <Input
                                      type="number"
                                      min="0"
                                      max={totalQuantity}
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                      className="w-12 h-7 text-center text-xs px-1"
                                    />
                                    <Button 
                                      type="button"
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => field.onChange(field.value + 1)}
                                      className="w-7 h-7 p-0 text-xs"
                                    >
                                      +
                                    </Button>
                                  </div>
                                </FormControl>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Scheduled Delivery Date */}
                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>예약발송</FormLabel>
                        <p className="text-xs text-gray-600 mb-1">발송은 순차적으로 진행하며, 미리 주문시 예약발송 지정 가능</p>
                        <p className="text-xs text-gray-500 mb-2 border-l-2 border-gray-300 pl-2">예약 발송날짜 지정(선택사항)</p>
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

                  {/* 배송 안내 - 데스크톱에서만 표시 */}
                  <div className="hidden md:block mt-3 p-3 md:p-4 bg-gradient-to-r from-eden-cream/40 to-eden-beige/20 rounded-lg border border-eden-brown/10">
                    <h4 className="text-base md:text-lg font-bold section-title mb-2 md:mb-3 text-center font-korean">에덴한과 배송</h4>
                    <div className="space-y-2">
                      <div className="flex items-start space-x-3">
                        <span className="text-eden-brown font-bold">•</span>
                        <p className="text-sm text-eden-dark leading-relaxed">물건은 입금 확인 후 1~2일 이내 발송합니다.</p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <span className="text-eden-brown font-bold">•</span>
                        <p className="text-sm text-eden-dark leading-relaxed">설 명절 1~2주 전은 택배사의 과부하로 배송이 늦어질 수 있습니다.</p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <span className="text-eden-brown font-bold">•</span>
                        <p className="text-sm text-eden-dark leading-relaxed">주문 접수 후 3일 이내 미도착시 반드시 연락주세요.</p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <span className="text-eden-red font-bold">•</span>
                        <p className="text-sm text-eden-dark leading-relaxed">설날 명절 2주 전에는 미리 주문 부탁드려요.</p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <span className="text-eden-red font-bold">•</span>
                        <p className="text-sm text-eden-dark leading-relaxed">미리 주문 시 예약발송 가능합니다.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Information & Order Summary */}
            <div className="space-y-4">
              {/* Customer Info */}
              <Card className="shadow-lg">
                <CardContent className="p-4 md:p-6 lg:p-8">
                  <h4 className="text-lg md:text-xl font-semibold section-title mb-3 md:mb-4 font-korean">
                    고객 정보
                  </h4>
                  
                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>주문자 이름 *</FormLabel>
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

                    <FormField
                      control={form.control}
                      name="isDifferentDepositor"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-1 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="leading-none">
                            <FormLabel className="flex items-center gap-0.5 text-[10px] sm:text-xs">
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
                <CardContent className="p-4 md:p-6 lg:p-8">
                  <h4 className="text-lg md:text-xl font-semibold section-title mb-4 md:mb-6 font-korean">
                    <Calculator className="inline mr-2 h-4 w-4 md:h-5 md:w-5" />
                    주문 요약
                  </h4>

                  <div className="space-y-4">
                    {/* Price Summary */}
                    <div className="bg-eden-cream p-3 md:p-4 rounded-lg">
                      <div className="space-y-2 text-sm">
                        {smallBoxQuantity > 0 && (
                          <div className="flex justify-between">
                            <span>한과1호 × {smallBoxQuantity}:</span>
                            <span className="whitespace-nowrap">{formatPrice(smallBoxTotal)}</span>
                          </div>
                        )}
                        {largeBoxQuantity > 0 && (
                          <div className="flex justify-between">
                            <span>한과2호 × {largeBoxQuantity}:</span>
                            <span className="whitespace-nowrap">{formatPrice(largeBoxTotal)}</span>
                          </div>
                        )}
                        {wrappingTotal > 0 && (
                          <div className="flex justify-between">
                            <span>보자기 × {wrappingQuantity}:</span>
                            <span className="whitespace-nowrap">{formatPrice(wrappingTotal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>배송비:</span>
                          <div className="text-right">
                            <span className="whitespace-nowrap">{shippingFee === 0 ? "무료" : formatPrice(shippingFee)}</span>
                            {addressValue && checkRemoteArea(addressValue) && (
                              <div className="text-red-600 text-xs mt-1">
                                <div>제주/도서산간 추가요금 발생</div>
                                <div className="mt-0.5">판매자에게 문의해주세요</div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="border-t border-eden-sage pt-2 mt-2">
                          <div className="flex justify-between font-bold text-base md:text-lg text-eden-brown">
                            <span>총 주문금액:</span>
                            <span className="whitespace-nowrap">{formatPrice(totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Shipping Info - Hidden on mobile, will be moved to bottom */}
                    {totalQuantity > 0 && (
                      <div className="hidden md:block bg-blue-50 p-4 rounded-lg">
                        <h5 className="font-medium text-blue-900 mb-2">배송비 안내</h5>
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">총 {totalQuantity}개 선택</span>
                        </p>
                        <div className="text-sm text-blue-800 space-y-1">
                          <p>6개 이상: <span className="text-green-600 font-semibold">무료배송</span></p>
                          <p>6개 미만: <span className="text-orange-600 font-semibold">배송비 4,000원</span></p>
                        </div>
                        <p className="text-xs text-red-600 mt-2 font-medium">
                          * 제주도, 도서산간지역은 추가비용 발생<br/>
                          &nbsp;&nbsp;판매자에게 문의해주세요
                        </p>
                      </div>
                    )}

                    {totalQuantity === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        상품을 선택해주세요
                      </div>
                    )}

                    {/* Bank Account Info */}
                    <div className="text-center py-2">
                      <p className="text-xs md:text-sm text-gray-600 break-keep">
                        입금계좌: <span className="font-medium text-eden-brown whitespace-nowrap">농협 352-1701-3342-63 (손*진)</span>
                      </p>
                    </div>

                    <Button 
                      type="submit" 
                      size="lg" 
                      className="w-full bg-eden-brown hover:bg-eden-dark text-white font-semibold py-3"
                      disabled={createOrderMutation.isPending || totalQuantity === 0}
                    >
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      {createOrderMutation.isPending ? "주문 중..." : "주문하기"}
                    </Button>

                    {/* Mobile Shipping Info - Only visible on mobile */}
                    {totalQuantity > 0 && (
                      <div className="md:hidden bg-blue-50 p-4 rounded-lg mt-4">
                        <h5 className="font-medium text-blue-900 mb-2">배송비 안내</h5>
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">총 {totalQuantity}개 선택</span>
                        </p>
                        <div className="text-sm text-blue-800 space-y-1">
                          <p>6개 이상: <span className="text-green-600 font-semibold">무료배송</span></p>
                          <p>6개 미만: <span className="text-orange-600 font-semibold">배송비 4,000원</span></p>
                        </div>
                        <p className="text-xs text-red-600 mt-2 font-medium">
                          * 제주도, 도서산간지역은 추가비용 발생<br/>
                          &nbsp;&nbsp;판매자에게 문의해주세요
                        </p>
                      </div>
                    )}

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
      
      {/* 모바일용 배송 안내 - 하단에 표시 */}
      <div className="md:hidden mt-6 p-3 bg-gradient-to-r from-eden-cream/40 to-eden-beige/20 rounded-lg border border-eden-brown/10 mx-2">
        <h4 className="text-base font-bold text-eden-brown mb-2 text-center font-korean">에덴한과 배송</h4>
        <div className="space-y-2">
          <div className="flex items-start space-x-3">
            <span className="text-eden-brown font-bold">•</span>
            <p className="text-sm text-eden-dark leading-relaxed">물건은 입금 확인 후 1~2일 이내 발송합니다.</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-eden-brown font-bold">•</span>
            <p className="text-sm text-eden-dark leading-relaxed">설 명절 1~2주 전은 택배사의 과부하로 배송이 늦어질 수 있습니다.</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-eden-brown font-bold">•</span>
            <p className="text-sm text-eden-dark leading-relaxed">주문 접수 후 3일 이내 미도착시 반드시 연락주세요.</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-eden-red font-bold">•</span>
            <p className="text-sm text-eden-dark leading-relaxed">설날 명절 2주 전에는 미리 주문 부탁드려요.</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-eden-red font-bold">•</span>
            <p className="text-sm text-eden-dark leading-relaxed">미리 주문 시 예약발송 가능합니다.</p>
          </div>
        </div>
      </div>
      {/* 제주도/도서산간지역 추가배송비 안내 팝업 */}
      <AlertDialog open={showShippingAlert} onOpenChange={setShowShippingAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              추가배송비 안내
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-600">
              고객정보에서 주소지가 제주도이거나 도서산간지역일 경우에는 추가배송비가 예상됩니다. 판매자에게 문의해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowShippingAlert(false)}>
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}