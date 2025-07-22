import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { History, MessageCircle } from "lucide-react";
import type { Order, SmsNotification } from "@shared/schema";

interface SmsHistoryProps {
  order: Order;
}

export function SmsHistory({ order }: SmsHistoryProps) {
  const [open, setOpen] = useState(false);

  const { data: smsHistory = [], isLoading } = useQuery({
    queryKey: ['/api/orders', order.id, 'sms'],
    queryFn: async (): Promise<SmsNotification[]> => {
      const response = await fetch(`/api/orders/${order.id}/sms`);
      if (!response.ok) throw new Error('Failed to fetch SMS history');
      return response.json();
    },
    enabled: open, // Only fetch when dialog is open
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-500">
          <History className="mr-1 h-3 w-3" />
          이력
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>SMS 발송 이력</DialogTitle>
          <DialogDescription>
            {order.customerName}님 ({order.orderNumber}) SMS 발송 내역
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-eden-brown"></div>
              <span className="ml-2 text-sm text-gray-500">불러오는 중...</span>
            </div>
          ) : smsHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>발송된 SMS가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {smsHistory.map((sms) => (
                <Card key={sms.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm text-gray-500">
                        {new Date(sms.sentAt).toLocaleString('ko-KR')}
                      </span>
                      <span className="text-xs text-eden-brown bg-eden-cream px-2 py-1 rounded">
                        발송 완료
                      </span>
                    </div>
                    <div className="text-sm bg-gray-50 p-3 rounded border-l-4 border-eden-sage">
                      {sms.message}
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      수신: {sms.phoneNumber}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}