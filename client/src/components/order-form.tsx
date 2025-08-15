import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ShoppingCart, Box, Calculator, Search, Calendar, AlertTriangle, User, RotateCcw, Info } from "lucide-react";
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
  wrappingQuantity: z.number().min(0, "보자기 수량은 0개 이상이어야 합니다"),
  scheduledDate: z.date().optional(),
  isDifferentDepositor: z.boolean().default(false),
  depositorName: z.string().optional(),
}).refine((data) => data.smallBoxQuantity + data.largeBoxQuantity + data.wrappingQuantity >= 1, {
  message: "최소 1개 이상의 상품을 선택해주세요",
  path: ["smallBoxQuantity"],
}).refine((data) => !data.isDifferentDepositor || data.depositorName, {
  message: "입금자 이름을 입력해주세요",
  path: ["depositorName"],
});

type OrderFormData = z.infer<typeof orderSchema>;

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('ko-KR').format(price) + '원';
};

// 전화번호 자동 포맷팅 함수
const formatPhoneNumber = (value: string) => {
  // 숫자만 추출
  const numbers = value.replace(/[^\d]/g, '');
  
  // 길이에 따라 포맷 적용
  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 7) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  } else if (numbers.length <= 11) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  } else {
    // 11자리 초과시 11자리까지만
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  }
};

// Dynamic prices will be loaded from admin settings



export default function OrderForm() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const queryClient = useQueryClient();

  // Fetch dashboard content for dynamic product names
  const { data: contentData } = useQuery({
    queryKey: ['/api/dashboard-content'],
    staleTime: 1000 * 60 * 2, // 2 minutes for better responsiveness
  });

  // Convert array to object for easier access
  const dashboardContent = Array.isArray(contentData) ? contentData.reduce((acc: any, item: any) => {
    acc[item.key] = item.value;
    return acc;
  }, {}) : {};

  // State for product names with updated prices
  const [productNames, setProductNames] = useState<any[]>([]);
  const [dynamicQuantities, setDynamicQuantities] = useState<{[key: number]: number}>({});
  const [isProductsInitialized, setIsProductsInitialized] = useState(false);

  // 동적 상품 수량 변경 추적 (디버깅용)
  useEffect(() => {
    console.log('=== dynamicQuantities 상태 변경 ===');
    console.log('현재 상태:', dynamicQuantities);
    Object.entries(dynamicQuantities).forEach(([index, quantity]) => {
      console.log(`상품 ${index}: ${quantity}`);
    });
  }, [dynamicQuantities]);

  // Parse product names safely and load prices
  const parseProductNames = () => {
    try {
      if (!dashboardContent.productNames) return [];
      if (typeof dashboardContent.productNames === 'string') {
        return JSON.parse(dashboardContent.productNames);
      }
      return Array.isArray(dashboardContent.productNames) ? dashboardContent.productNames : [];
    } catch (error) {
      console.error('Error parsing product names:', error);
      return [];
    }
  };
  const [totalAmount, setTotalAmount] = useState(0);
  const [showShippingAlert, setShowShippingAlert] = useState(false);
  const [shippingFee, setShippingFee] = useState(0);
  const [shippingSettings, setShippingSettings] = useState({
    shippingFee: 4000,
    freeShippingThreshold: 6,
    freeShippingType: 'quantity' as 'quantity' | 'amount',
    freeShippingMinAmount: 50000
  });
  const [prices, setPrices] = useState({
    small: 19000, // 한과1호
    large: 21000, // 한과2호
    wrapping: 1000,
  });
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

  // 배송비 설정 및 상품 가격 로드 (dashboard-content 연동)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [shippingFeeResponse, thresholdResponse, settingsResponse] = await Promise.all([
          fetch("/api/settings/shippingFee"),
          fetch("/api/settings/freeShippingThreshold"),
          fetch("/api/settings")
        ]);

        const shippingFeeSetting = await shippingFeeResponse.json();
        const thresholdSetting = await thresholdResponse.json();
        const allSettings = await settingsResponse.json();

        // 무료배송 타입과 최소 금액 설정 로드
        const freeShippingTypeSetting = allSettings.find((s: any) => s.key === "freeShippingType");
        const freeShippingMinAmountSetting = allSettings.find((s: any) => s.key === "freeShippingMinAmount");

        setShippingSettings({
          shippingFee: parseInt(shippingFeeSetting.value) || 4000,
          freeShippingThreshold: parseInt(thresholdSetting.value) || 6,
          freeShippingType: freeShippingTypeSetting?.value || 'quantity',
          freeShippingMinAmount: parseInt(freeShippingMinAmountSetting?.value) || 50000
        });

        // 기본 가격 설정
        let priceData = {
          small: 19000,
          large: 21000,
          wrapping: 1000,
        };

        // 새로운 가격 설정 시스템에서 가격 로드
        const product0PriceSetting = allSettings.find((s: any) => s.key === "product_0Price");
        const product1PriceSetting = allSettings.find((s: any) => s.key === "product_1Price");
        const product2PriceSetting = allSettings.find((s: any) => s.key === "product_2Price");
        const product3PriceSetting = allSettings.find((s: any) => s.key === "product_3Price");

        // 폴백: 기존 settings 사용
        const smallBoxPriceSetting = allSettings.find((s: any) => s.key === "smallBoxPrice");
        const largeBoxPriceSetting = allSettings.find((s: any) => s.key === "largeBoxPrice");
        const wrappingPriceSetting = allSettings.find((s: any) => s.key === "wrappingPrice");

        priceData = {
          small: product0PriceSetting ? parseInt(product0PriceSetting.value) : 
                 (smallBoxPriceSetting ? parseInt(smallBoxPriceSetting.value) : 19000),
          large: product1PriceSetting ? parseInt(product1PriceSetting.value) : 
                 (largeBoxPriceSetting ? parseInt(largeBoxPriceSetting.value) : 21000),
          wrapping: product2PriceSetting ? parseInt(product2PriceSetting.value) : 
                   (product3PriceSetting ? parseInt(product3PriceSetting.value) : 
                   (wrappingPriceSetting ? parseInt(wrappingPriceSetting.value) : 1000)),
        };

        setPrices(priceData);

      } catch (error) {
        console.error('설정 로드 실패:', error);
        // 기본값 유지
      }
    };

    loadSettings();
  }, []);

  // Fetch settings data for pricing with shorter cache for real-time updates
  const { data: settingsData } = useQuery({
    queryKey: ['/api/settings'],
    staleTime: 1000 * 30, // 30 seconds for real-time price updates
    refetchInterval: 1000 * 30, // Poll every 30 seconds
  });

  // Fetch dashboard content for dynamic product names
  const { data: dashboardData } = useQuery({
    queryKey: ['/api/dashboard-content'],
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Helper function to get product name from dashboard content
  const getProductName = (index: number, fallback: string) => {
    if (!dashboardData || !Array.isArray(dashboardData)) return fallback;
    
    try {
      const productNamesData = dashboardData.find((item: any) => item.key === 'productNames');
      if (!productNamesData) return fallback;
      
      const productNames = typeof productNamesData.value === 'string' 
        ? JSON.parse(productNamesData.value) 
        : productNamesData.value;
      
      if (Array.isArray(productNames) && productNames[index]) {
        return productNames[index].name || fallback;
      }
    } catch (error) {
      console.error('Error parsing product names:', error);
    }
    
    return fallback;
  };

  // Update product names with prices from settings when data changes - Real-time sync
  useEffect(() => {
    if (settingsData && Array.isArray(settingsData)) {
      // 실시간 가격 업데이트 - settings 데이터가 변경될 때마다 즉시 반영
      const updatedPrices = {
        small: (() => {
          const setting = settingsData.find((s: any) => s.key === "product_0Price");
          return setting ? parseInt(setting.value) : prices.small;
        })(),
        large: (() => {
          const setting = settingsData.find((s: any) => s.key === "product_1Price");
          return setting ? parseInt(setting.value) : prices.large;
        })(),
        wrapping: (() => {
          const setting = settingsData.find((s: any) => s.key === "product_2Price");
          return setting ? parseInt(setting.value) : prices.wrapping;
        })(),
      };

      setPrices(updatedPrices);
      console.log('=== 실시간 가격 업데이트 ===');
      console.log('업데이트된 가격:', updatedPrices);
    }
    
    if (dashboardContent && dashboardContent.productNames && settingsData) {
      try {
        const productNamesData = parseProductNames();
        
        // 각 상품에 대해 설정에서 가격 로드 및 업데이트
        const updatedProductNames = productNamesData.map((product: any, index: number) => {
          const productKey = product.key || `product_${index}`;
          const priceSetting = Array.isArray(settingsData) ? settingsData.find((s: any) => s.key === `${productKey}Price`) : null;
          
          return {
            ...product,
            price: priceSetting ? priceSetting.value : (product.price || "0")
          };
        });
        
        setProductNames(updatedProductNames);
        
        // 동적 상품 수량 초기화 - 모든 상품을 0으로 설정
        if (!isProductsInitialized) {
          const initialQuantities: {[key: number]: number} = {};
          updatedProductNames.forEach((_, index) => {
            initialQuantities[index] = 0;
          });
          console.log('=== 동적 상품 수량 초기화 ===');
          console.log('초기화된 수량:', initialQuantities);
          console.log('Stack trace:', new Error().stack);
          setDynamicQuantities(initialQuantities);
          setIsProductsInitialized(true);
        }
        
      } catch (error) {
        console.error('상품 가격 로드 실패:', error);
        // Fallback to basic product names without price updates
        const basicProductNames = parseProductNames();
        setProductNames(basicProductNames);
        
        // 동적 상품 수량 초기화
        if (!isProductsInitialized) {
          const initialQuantities: {[key: number]: number} = {};
          basicProductNames.forEach((_, index) => {
            initialQuantities[index] = 0;
          });
          setDynamicQuantities(initialQuantities);
          setIsProductsInitialized(true);
        }
      }
    } else if (dashboardContent) {
      const basicProductNames = parseProductNames();
      setProductNames(basicProductNames);
      
      // 동적 상품 수량 초기화
      if (!isProductsInitialized) {
        const initialQuantities: {[key: number]: number} = {};
        basicProductNames.forEach((_, index) => {
          initialQuantities[index] = 0;
        });
        setDynamicQuantities(initialQuantities);
        setIsProductsInitialized(true);
      }
    }
  }, [dashboardContent?.productNames, settingsData]);

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
      // 동적 상품 수량도 함께 초기화
      if (productNames && productNames.length > 0) {
        const resetQuantities: {[key: number]: number} = {};
        productNames.forEach((_, index) => {
          resetQuantities[index] = 0;
        });
        console.log('주문 완료 후 동적 상품 수량 초기화:', resetQuantities);
        setDynamicQuantities(resetQuantities);
      }
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
    
    // 모든 동적 상품의 총액 계산
    let productsTotal = 0;
    if (productNames && productNames.length > 0) {
      productNames.forEach((product: any, index: number) => {
        productsTotal += calculateProductTotal(index, product.name);
      });
    } else {
      // 폴백: 기본 상품들 계산
      const smallBoxTotal = getCurrentPrice(0, prices.small) * smallBoxQuantity;
      const largeBoxTotal = getCurrentPrice(1, prices.large) * largeBoxQuantity;
      const wrappingTotal = wrappingQuantity * getCurrentPrice(2, prices.wrapping);
      productsTotal = smallBoxTotal + largeBoxTotal + wrappingTotal;
    }
    
    const currentTotalQuantity = getTotalQuantity();
    
    // 배송비 계산: 수량 기준 또는 금액 기준
    let calculatedShippingFee = shippingSettings.shippingFee;
    
    if (currentTotalQuantity === 0) {
      calculatedShippingFee = 0; // 상품이 없으면 배송비 없음
    } else if (shippingSettings.freeShippingType === 'quantity') {
      // 수량 기준 무료배송
      calculatedShippingFee = currentTotalQuantity >= shippingSettings.freeShippingThreshold ? 0 : shippingSettings.shippingFee;
    } else {
      // 금액 기준 무료배송 (배송비 제외한 상품 총액)
      calculatedShippingFee = productsTotal >= shippingSettings.freeShippingMinAmount ? 0 : shippingSettings.shippingFee;
    }
    setShippingFee(calculatedShippingFee);
    
    const total = productsTotal + calculatedShippingFee;
    setTotalAmount(total);
  }, [watchedValues, prices, shippingSettings, productNames]);

  const onSubmit = (data: OrderFormData) => {
    // 배송비 계산을 위한 총 수량 (상품별 제외 설정 반영)
    const totalQuantity = getTotalQuantity();
    let calculatedShippingFee = shippingSettings.shippingFee;
    
    if (totalQuantity === 0) {
      calculatedShippingFee = 0;
    } else if (shippingSettings.freeShippingType === 'quantity') {
      calculatedShippingFee = totalQuantity >= shippingSettings.freeShippingThreshold ? 0 : shippingSettings.shippingFee;
    } else {
      calculatedShippingFee = totalAmount - shippingFee >= shippingSettings.freeShippingMinAmount ? 0 : shippingSettings.shippingFee;
    }
    
    const orderData = {
      ...data,
      shippingFee: calculatedShippingFee,
      totalAmount,
      scheduledDate: data.scheduledDate ? data.scheduledDate.toISOString() : null,
      status: data.scheduledDate ? 'scheduled' : 'pending',
      dynamicProductQuantities: Object.keys(dynamicQuantities).length > 0 ? dynamicQuantities : null,
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
  
  // 동적 상품 수량 계산
  const getDynamicProductQuantity = (productIndex: number, productName: string) => {
    if (productIndex === 0) return smallBoxQuantity;
    if (productIndex === 1) return largeBoxQuantity;
    if (productIndex === 2 || productName?.includes('보자기')) return wrappingQuantity;
    
    // 새로 추가된 상품들은 독립적인 수량 상태 사용
    const quantity = dynamicQuantities[productIndex] || 0;
    console.log(`getDynamicProductQuantity: index=${productIndex}, name=${productName}, quantity=${quantity}`);
    return quantity;
  };
  
  // 전체 수량 계산 (배송비 제외 설정을 반영한 상품들만 포함)
  const getTotalQuantity = () => {
    if (!productNames || productNames.length === 0) {
      // 기본 상품 시스템 - 보자기만 제외하던 기존 로직 유지
      return smallBoxQuantity + largeBoxQuantity + wrappingQuantity;
    }
    
    let total = 0;
    productNames.forEach((product: any, index: number) => {
      const productKey = product.key || `product_${index}`;
      
      // 개별 상품의 배송비 제외 설정 확인 (settings에서 로드)
      const excludeFromShippingSetting = settingsData?.find((s: any) => s.key === `${productKey}ExcludeFromShipping`);
      const isExcludedFromShipping = excludeFromShippingSetting?.value === 'true';
      
      // 배송비 제외 설정이 되어있지 않은 상품만 수량에 포함
      if (!isExcludedFromShipping) {
        total += getDynamicProductQuantity(index, product.name);
      }
    });
    return total;
  };
  
  const totalQuantity = getTotalQuantity();
  
  // 동적 상품 가격을 사용하여 총액 계산
  const getCurrentPrice = (index: number, fallbackPrice: number) => {
    if (productNames && productNames[index] && productNames[index].price) {
      return parseInt(productNames[index].price) || fallbackPrice;
    }
    return fallbackPrice;
  };
  
  // 모든 동적 상품의 총액 계산
  const calculateProductTotal = (productIndex: number, productName: string) => {
    const quantity = getDynamicProductQuantity(productIndex, productName);
    const price = getCurrentPrice(productIndex, 0);
    return quantity * price;
  };
  
  const smallBoxTotal = getCurrentPrice(0, prices.small) * smallBoxQuantity;
  const largeBoxTotal = getCurrentPrice(1, prices.large) * largeBoxQuantity;
  const wrappingTotal = wrappingQuantity * getCurrentPrice(2, prices.wrapping);
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
                
                {/* Dynamic Product List */}
                {productNames && productNames.length > 0 ? (
                  <div className="space-y-4">
                    {productNames.map((product: any, index: number) => (
                      <div key={index} className="bg-gradient-to-br from-eden-sage/5 to-eden-brown/5 rounded-lg p-4 border border-eden-beige/30 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h5 className="font-semibold text-gray-900 text-sm md:text-base mb-1">
                              {product.name}
                            </h5>
                            {product.size && (
                              <p className="text-xs text-gray-600 mb-1">
                                크기: {product.size}
                              </p>
                            )}
                            {product.weight && (
                              <p className="text-xs text-gray-600 mb-1">
                                무게: {product.weight}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-base md:text-lg font-bold text-gray-900">
                              {formatPrice(parseInt(product.price) || 0)}
                            </div>
                          </div>
                        </div>
                        
                        {index <= 2 ? (
                          <FormField
                          control={form.control}
                          name={
                            index === 0 ? "smallBoxQuantity" : 
                            index === 1 ? "largeBoxQuantity" : 
                            "wrappingQuantity"
                          }
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-sm font-medium text-gray-700">수량 선택</FormLabel>
                                <FormControl>
                                  <div className="flex items-center space-x-2">
                                    <Button 
                                      type="button"
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => field.onChange(Math.max(0, field.value - 1))}
                                      className="w-8 h-8 p-0 rounded-full hover:bg-eden-sage/10"
                                    >
                                      -
                                    </Button>
                                    <Input
                                      type="number"
                                      min="0"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                      className="w-16 h-8 text-center text-sm font-medium border-eden-beige/50"
                                    />
                                    <Button 
                                      type="button"
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => field.onChange(field.value + 1)}
                                      className="w-8 h-8 p-0 rounded-full hover:bg-eden-sage/10"
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
                        ) : (
                          <div>
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium text-gray-700">수량 선택</label>
                              <div className="flex items-center space-x-2">
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    const newQuantity = Math.max(0, (dynamicQuantities[index] || 0) - 1);
                                    console.log(`감소 버튼 클릭: 인덱스 ${index}, 기존값 ${dynamicQuantities[index] || 0}, 새값 ${newQuantity}`);
                                    setDynamicQuantities(prev => ({...prev, [index]: newQuantity}));
                                  }}
                                  className="w-8 h-8 p-0 rounded-full hover:bg-eden-sage/10"
                                >
                                  -
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  value={dynamicQuantities[index] || 0}
                                  onChange={(e) => {
                                    const newQuantity = parseInt(e.target.value) || 0;
                                    console.log(`수량 입력 변경: 인덱스 ${index}, 기존값 ${dynamicQuantities[index] || 0}, 새값 ${newQuantity}`);
                                    setDynamicQuantities(prev => ({...prev, [index]: newQuantity}));
                                  }}
                                  className="w-16 h-8 text-center text-sm font-medium border-eden-beige/50"
                                />
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    const newQuantity = (dynamicQuantities[index] || 0) + 1;
                                    console.log(`증가 버튼 클릭: 인덱스 ${index}, 기존값 ${dynamicQuantities[index] || 0}, 새값 ${newQuantity}`);
                                    setDynamicQuantities(prev => ({...prev, [index]: newQuantity}));
                                  }}
                                  className="w-8 h-8 p-0 rounded-full hover:bg-eden-sage/10"
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">등록된 상품이 없습니다.</p>
                    <p className="text-xs">관리자가 상품을 등록하면 여기에 표시됩니다.</p>
                  </div>
                )}

                {/* Scheduled Delivery Date */}
                <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>예약발송</FormLabel>
                        <p className="text-xs text-gray-600 mb-1">순차적으로 발송하며, 미리 주문 시 예약 발송 지정 가능</p>
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
                              onChange={(e) => {
                                const formatted = formatPhoneNumber(e.target.value);
                                field.onChange(formatted);
                              }}
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
                        <FormItem className="text-[17px]">
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
                        {/* 동적 상품 목록을 기반으로 주문 요약 생성 */}
                        {productNames && productNames.length > 0 ? (
                          productNames.map((product: any, index: number) => {
                            const quantity = getDynamicProductQuantity(index, product.name);
                            
                            if (quantity > 0) {
                              const total = calculateProductTotal(index, product.name);
                              
                              return (
                                <div key={index} className="flex justify-between">
                                  <span>{product.name} × {quantity}:</span>
                                  <span className="whitespace-nowrap">{formatPrice(total)}</span>
                                </div>
                              );
                            }
                            return null;
                          })
                        ) : (
                          <>
                            {smallBoxQuantity > 0 && (
                              <div className="flex justify-between">
                                <span>{getProductName(0, '한과1호')} × {smallBoxQuantity}:</span>
                                <span className="whitespace-nowrap">{formatPrice(smallBoxTotal)}</span>
                              </div>
                            )}
                            {largeBoxQuantity > 0 && (
                              <div className="flex justify-between">
                                <span>{getProductName(1, '한과2호')} × {largeBoxQuantity}:</span>
                                <span className="whitespace-nowrap">{formatPrice(largeBoxTotal)}</span>
                              </div>
                            )}
                            {wrappingTotal > 0 && (
                              <div className="flex justify-between">
                                <span>{getProductName(2, '보자기')} × {wrappingQuantity}:</span>
                                <span className="whitespace-nowrap">{formatPrice(wrappingTotal)}</span>
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex justify-between">
                          <span>배송비:</span>
                          <div className="text-right">
                            <span className="whitespace-nowrap">{shippingFee === 0 ? "무료" : formatPrice(shippingFee)}</span>
                            {addressValue && checkRemoteArea(addressValue) && (
                              <div className="text-gray-600 text-xs mt-1">
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
                      <div className="hidden md:block bg-gray-50 p-4 rounded-lg">
                        <h5 className="font-medium text-gray-900 mb-2">배송비 안내</h5>
                        <p className="text-sm text-gray-800">
                          <span className="font-medium">총 {totalQuantity}개 선택</span>
                        </p>
                        <div className="text-sm text-gray-800 space-y-1">
                          <p>{shippingSettings.freeShippingThreshold}개 이상: <span className="text-gray-600 font-semibold">무료배송</span></p>
                          <p>{shippingSettings.freeShippingThreshold}개 미만: <span className="text-gray-600 font-semibold">배송비 {formatPrice(shippingSettings.shippingFee)}</span></p>
                        </div>
                        <p className="text-xs text-gray-600 mt-2 font-medium">
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
                      <div className="md:hidden bg-gray-50 p-4 rounded-lg mt-4">
                        <h5 className="font-medium text-gray-900 mb-2">배송비 안내</h5>
                        <p className="text-sm text-gray-800">
                          <span className="font-medium">총 {totalQuantity}개 선택</span>
                        </p>
                        <div className="text-sm text-gray-800 space-y-1">
                          <p>{shippingSettings.freeShippingThreshold}개 이상: <span className="text-gray-600 font-semibold">무료배송</span></p>
                          <p>{shippingSettings.freeShippingThreshold}개 미만: <span className="text-gray-600 font-semibold">배송비 {formatPrice(shippingSettings.shippingFee)}</span></p>
                        </div>
                        <p className="text-xs text-gray-600 mt-2 font-medium">
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
            <p className="text-eden-dark text-[13px]">물건은 입금 확인 후 1~2일 이내 발송합니다.</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-eden-brown font-bold">•</span>
            <p className="text-eden-dark text-[13px]">설 명절 1~2주 전은 택배사의 과부하로 배송이 늦어질 수 있습니다.</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-eden-brown font-bold">•</span>
            <p className="text-eden-dark text-[13px]">주문 접수 후 3일 이내 미도착시 반드시 연락주세요.</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-eden-red font-bold">•</span>
            <p className="text-eden-dark text-[13px]">설날 명절 2주 전에는 미리 주문 부탁드려요.</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-eden-red font-bold">•</span>
            <p className="text-eden-dark text-[13px]">미리 주문 시 예약발송 가능합니다.</p>
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