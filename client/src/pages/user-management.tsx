import { AdminHeader } from "@/components/admin-header";
import { UserManagement } from "@/components/user-management";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function UserManagementPage() {
  const [, setLocation] = useLocation();
  
  return (
    <div className="min-h-screen bg-eden-cream">
      <AdminHeader />
      
      {/* Content */}
      <div className="container mx-auto p-4 sm:p-6">
        {/* 뒤로가기 버튼 */}
        <div className="flex justify-end mb-4">
          <Button 
            variant="outline" 
            onClick={() => setLocation('/admin')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            뒤로가기
          </Button>
        </div>
        
        <UserManagement />
      </div>
    </div>
  );
}