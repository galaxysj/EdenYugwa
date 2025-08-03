import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Order } from "@shared/schema";

interface ScheduledDatePickerProps {
  order: Order;
}

export function ScheduledDatePicker({ order }: ScheduledDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    order.scheduledDate ? new Date(order.scheduledDate).toISOString().split('T')[0] : ''
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateScheduledDateMutation = useMutation({
    mutationFn: ({ id, scheduledDate }: { id: number; scheduledDate: string | null }) =>
      api.orders.updateScheduledDate(id, scheduledDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "발송예약 날짜 업데이트",
        description: "발송예약 날짜가 성공적으로 업데이트되었습니다.",
      });
      setIsOpen(false);
    },
    onError: () => {
      toast({
        title: "업데이트 실패",
        description: "발송예약 날짜 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateScheduledDateMutation.mutate({
      id: order.id,
      scheduledDate: selectedDate || null,
    });
  };

  const handleClear = () => {
    updateScheduledDateMutation.mutate({
      id: order.id,
      scheduledDate: null,
    });
    setSelectedDate('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          size="sm" 
          variant="outline" 
          className="ml-2 scheduled-date-trigger"
        >
          <Calendar className="h-4 w-4 mr-1" />
          {order.scheduledDate 
            ? new Date(order.scheduledDate).toLocaleDateString('ko-KR')
            : '날짜 선택'
          }
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>발송예약 날짜 설정</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              발송 예정일
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eden-brown focus:border-transparent"
            />
          </div>
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              disabled={updateScheduledDateMutation.isPending}
            >
              <X className="h-4 w-4 mr-1" />
              날짜 삭제
            </Button>
            <div className="space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={updateScheduledDateMutation.isPending}
              >
                {updateScheduledDateMutation.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ScheduledDatePicker;