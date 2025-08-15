import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Send, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Order, AdminSettings } from "@shared/schema";

const smsSchema = z.object({
  message: z.string().min(1, "메시지를 입력해주세요").max(200, "SMS는 200자 이내로 입력해주세요"),
});

type SmsFormData = z.infer<typeof smsSchema>;

interface SmsDialogProps {
  order: Order;
  children: React.ReactNode;
}

export function SmsDialog({ order, children }: SmsDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Check admin settings
  const { data: adminSettings } = useQuery<AdminSettings>({
    queryKey: ['/api/admin-settings'],
    retry: false,
  });

  const getStatusMessage = (status: string, paymentStatus?: string) => {
    const now = new Date();
    const timeStr = now.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    if (paymentStatus === 'confirmed') {
      return `입금이 확인되었습니다. (확인시간: ${timeStr})`;
    }
    
    const messages = {
      pending: `주문이 접수되었습니다. (주문시간: ${timeStr})`,
      scheduled: `발송이 예약되었습니다. (예약시간: ${timeStr})`,
      seller_shipped: `상품이 발송되었습니다. (발송시간: ${timeStr})`,
      delivered: `상품이 배송완료되었습니다. (배송완료시간: ${timeStr})`,
    };
    
    return messages[status as keyof typeof messages] || `상태가 업데이트되었습니다. (업데이트시간: ${timeStr})`;
  };

  const form = useForm<SmsFormData>({
    resolver: zodResolver(smsSchema),
    defaultValues: {
      message: '',
    },
  });

  // 다이얼로그가 열릴 때 주문접수 메시지로 초기화
  const initializeMessage = () => {
    const now = new Date();
    const timeStr = now.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    form.setValue('message', `[에덴한과] ${order.customerName}님, 주문이 접수되었습니다. (주문시간: ${timeStr}) 감사합니다.`);
  };

  // iOS 단축어 링크로 SMS 발송하는 함수
  const sendSMSViaShortcut = (phoneNumber: string, message: string) => {
    const input = `${phoneNumber}/${message}`;
    console.log('전화번호:', phoneNumber);
    console.log('메시지:', message);
    console.log('입력값:', input);
    
    // 개선된 단축어 실행 방법
    const executeShortcut = () => {
      // 방법 1: 기본 shortcuts URL scheme
      const shortcutUrl = `shortcuts://run-shortcut?name=eden&input=${encodeURIComponent(input)}`;
      console.log('단축어 실행 시도:', shortcutUrl);
      
      // 새 창에서 열기 시도
      const newWindow = window.open(shortcutUrl, '_blank');
      
      // 새 창이 막혔거나 안 열렸으면 직접 location 변경
      setTimeout(() => {
        if (!newWindow || newWindow.closed) {
          console.log('새 창 열기 실패, location.href로 시도');
          window.location.href = shortcutUrl;
        }
      }, 100);
      
      // 백업 방법들
      setTimeout(() => {
        console.log('기본 방법 실패, x-callback-url 시도');
        const callbackUrl = `shortcuts://x-callback-url/run-shortcut?name=eden&input=${encodeURIComponent(input)}`;
        window.location.href = callbackUrl;
      }, 2000);
      
      // 최종 백업
      setTimeout(() => {
        console.log('x-callback-url 실패, 직접 링크 복사 제안');
        copyToClipboardFallback(shortcutUrl);
      }, 4000);
    };
    
    const copyToClipboardFallback = (url: string) => {
      navigator.clipboard?.writeText(url).then(() => {
        toast({
          title: "단축어 URL 복사됨",
          description: "단축어가 자동 실행되지 않아 URL을 클립보드에 복사했습니다. Safari 주소창에 붙여넣기 후 실행해주세요.",
          duration: 10000,
        });
      }).catch(() => {
        // 클립보드 복사도 실패한 경우
        toast({
          title: "수동 실행 필요",
          description: `다음 URL을 Safari에서 실행해주세요: ${url}`,
          variant: "destructive",
          duration: 15000,
        });
      });
    };
    
    try {
      executeShortcut();
      
      toast({
        title: "단축어 실행 중",
        description: "iOS 단축어 앱으로 연결 중입니다. 단축어가 'eden'이라는 이름으로 저장되어 있는지 확인해주세요.",
        duration: 5000,
      });
      
      setOpen(false);
      form.reset();
    } catch (error) {
      console.error('단축어 실행 오류:', error);
      const finalUrl = `shortcuts://run-shortcut?name=eden&input=${encodeURIComponent(input)}`;
      copyToClipboardFallback(finalUrl);
    }
  };

  const onSubmit = (data: SmsFormData) => {
    sendSMSViaShortcut(order.customerPhone, data.message);
  };

  const handlePresetMessage = (type: 'status' | 'payment' | 'shipping' | 'custom') => {
    const now = new Date();
    const timeStr = now.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    if (type === 'status') {
      // 주문상태 알림은 항상 "주문접수"로 표시
      const finalMessage = `[에덴한과] ${order.customerName}님, 주문이 접수되었습니다. (주문시간: ${timeStr}) 감사합니다.`;
      form.setValue('message', finalMessage);
    } else if (type === 'payment') {
      const paymentMessage = getStatusMessage(order.status, order.paymentStatus);
      form.setValue('message', `[에덴한과] ${order.customerName}님, ${paymentMessage} 감사합니다.`);
    } else if (type === 'shipping') {
      form.setValue('message', `[에덴한과] ${order.customerName}님, 상품이 발송되었습니다. 3일이내 미 도착 시 반드시 연락주세요. 감사합니다. ^^`);
    } else {
      form.setValue('message', `[에덴한과] ${order.customerName}님께 개별 안내드립니다.`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) {
        initializeMessage();
      }
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>SMS 발송</DialogTitle>
          <DialogDescription>
            {order.customerName}님 ({order.customerPhone})에게 SMS를 발송합니다.
            {adminSettings?.adminPhone && (
              <div className="text-sm text-gray-600 mt-1">
                발신번호: {adminSettings.adminPhone}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Admin Settings Check */}
        {!adminSettings?.adminPhone && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              SMS 발송을 위해 관리자 설정에서 전화번호를 입력해주세요. 
              <a href="/admin-settings" className="text-blue-600 hover:underline ml-1">
                관리자 설정 페이지로 이동
              </a>
            </AlertDescription>
          </Alert>
        )}

        {/* 단축어 설정 안내 */}
        <Alert className="mb-4 bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>단축어 설정 확인:</strong> iOS 단축어 앱에서 'eden'이라는 이름으로 SMS 발송 단축어가 만들어져 있는지 확인해주세요. 
            단축어는 전화번호와 메시지를 '/' 구분자로 받아서 SMS를 발송하도록 설정되어야 합니다.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 프리셋 메시지 버튼들 */}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handlePresetMessage('status')}
                className="text-xs"
              >
                주문접수 안내
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handlePresetMessage('payment')}
                className="text-xs"
              >
                입금확인 안내
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handlePresetMessage('shipping')}
                className="text-xs"
              >
                발송완료 안내
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handlePresetMessage('custom')}
                className="text-xs"
              >
                개별 안내
              </Button>
            </div>

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>메시지 내용</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="SMS 메시지를 입력하세요" 
                      rows={4}
                      className="resize-none"
                    />
                  </FormControl>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>SMS는 200자 이내로 입력해주세요</span>
                    <span>{field.value?.length || 0}/200</span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="bg-eden-brown hover:bg-eden-dark"
              >
                <Send className="mr-2 h-4 w-4" />
                발송하기
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}