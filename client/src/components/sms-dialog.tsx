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
    const shortcutUrl = `shortcuts://run-shortcut?name=eden&input=${encodeURIComponent(phoneNumber + '/' + message)}`;
    
    try {
      window.open(shortcutUrl, '_self');
      toast({
        title: "SMS 앱 열기 완료",
        description: "iOS 단축어로 SMS를 발송합니다.",
      });
      setOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: "SMS 앱 열기 실패",
        description: "iOS 단축어를 실행할 수 없습니다.",
        variant: "destructive",
      });
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