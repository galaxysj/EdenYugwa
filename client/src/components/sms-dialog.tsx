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
import { MessageSquare, Send } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Order } from "@shared/schema";

const smsSchema = z.object({
  message: z.string().min(1, "메시지를 입력해주세요").max(90, "SMS는 90자 이내로 입력해주세요"),
});

type SmsFormData = z.infer<typeof smsSchema>;

interface SmsDialogProps {
  order: Order;
}

export function SmsDialog({ order }: SmsDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SmsFormData>({
    resolver: zodResolver(smsSchema),
    defaultValues: {
      message: `[에덴한과] ${order.customerName}님, 주문번호 ${order.orderNumber} 상품이 곧 발송예정입니다.`,
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
      pending: `주문이 접수되었습니다. (접수시간: ${timeStr})`,
      scheduled: `발송이 예약되었습니다. (예약시간: ${timeStr})`,
      delivered: `상품이 발송완료되었습니다. (발송시간: ${timeStr})`,
    };
    return messages[status as keyof typeof messages] || `상태가 업데이트되었습니다. (업데이트시간: ${timeStr})`;
  };

  const handlePresetMessage = (type: 'status' | 'payment' | 'shipping' | 'custom') => {
    if (type === 'status') {
      const statusMessage = getStatusMessage(order.status);
      form.setValue('message', `[에덴한과] ${order.customerName}님, 주문번호 ${order.orderNumber} ${statusMessage}`);
    } else if (type === 'payment') {
      const paymentMessage = getStatusMessage(order.status, order.paymentStatus);
      form.setValue('message', `[에덴한과] ${order.customerName}님, 주문번호 ${order.orderNumber} ${paymentMessage}`);
    } else if (type === 'shipping') {
      const shippingDate = order.scheduledDate ? 
        new Date(order.scheduledDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : 
        '곧';
      form.setValue('message', `[에덴한과] ${order.customerName}님, 주문번호 ${order.orderNumber} 상품이 ${shippingDate} 발송예정입니다.`);
    } else {
      form.setValue('message', `[에덴한과] ${order.customerName}님께 개별 안내드립니다.`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs">
          <MessageSquare className="mr-1 h-3 w-3" />
          SMS
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>SMS 발송</DialogTitle>
          <DialogDescription>
            {order.customerName}님 ({order.customerPhone})에게 SMS를 발송합니다.
          </DialogDescription>
        </DialogHeader>

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
                      placeholder="발송할 메시지를 입력해주세요..."
                      className="min-h-[100px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <div className="text-xs text-gray-500">
                    {field.value?.length || 0}/90자
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
                disabled={sendSMSMutation.isPending}
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