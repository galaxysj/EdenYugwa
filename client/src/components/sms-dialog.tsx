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
import { MessageSquare, Send, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
  const queryClient = useQueryClient();

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
      seller_shipped: `상품이 발송완료되었습니다. (발송시간: ${timeStr})`,
      delivered: `상품이 발송완료되었습니다. (발송시간: ${timeStr})`,
    };
    return messages[status as keyof typeof messages] || `상태가 업데이트되었습니다. (업데이트시간: ${timeStr})`;
  };

  const form = useForm<SmsFormData>({
    resolver: zodResolver(smsSchema),
    defaultValues: {
      message: `[에덴한과] ${order.customerName}님, ${getStatusMessage(order.status)} 감사합니다.`,
    },
  });

  const sendSMSMutation = useMutation({
    mutationFn: (data: { orderId: number; phoneNumber: string; message: string }) =>
      api.sms.send(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "SMS 발송 완료",
        description: "고객에게 SMS가 성공적으로 발송되었습니다.",
      });
      setOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "SMS 발송 실패",
        description: "SMS 발송 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SmsFormData) => {
    sendSMSMutation.mutate({
      orderId: order.id,
      phoneNumber: order.customerPhone,
      message: data.message,
    });
  };

  const handlePresetMessage = (type: 'status' | 'payment' | 'shipping' | 'custom') => {
    if (type === 'status') {
      const statusMessage = getStatusMessage(order.status);
      form.setValue('message', `[에덴한과] ${order.customerName}님, ${statusMessage}`);
    } else if (type === 'payment') {
      const paymentMessage = getStatusMessage(order.status, order.paymentStatus);
      form.setValue('message', `[에덴한과] ${order.customerName}님, ${paymentMessage}`);
    } else if (type === 'shipping') {
      form.setValue('message', `[에덴한과] ${order.customerName}님, 상품이 발송되었습니다. 3일이내 미 도착 시 반드시 연락주세요. 감사합니다. ^^`);
    } else {
      form.setValue('message', `[에덴한과] ${order.customerName}님께 개별 안내드립니다.`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handlePresetMessage('status')}
                className="text-xs"
              >
                주문상태 알림
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handlePresetMessage('shipping')}
                className="text-xs bg-blue-50 border-blue-200"
              >
                발송안내
              </Button>
              {order.paymentStatus === 'confirmed' && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handlePresetMessage('payment')}
                  className="text-xs bg-green-50 border-green-200"
                >
                  입금확인 알림
                </Button>
              )}
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
                disabled={sendSMSMutation.isPending}
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={sendSMSMutation.isPending || !adminSettings?.adminPhone}
                className="bg-eden-brown hover:bg-eden-dark"
              >
                {sendSMSMutation.isPending ? (
                  "발송 중..."
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    발송하기
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}