import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserManagement } from "@/components/user-management";

export default function UserManagementPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-red-600 text-white p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-white hover:bg-red-700">
                <ArrowLeft className="h-4 w-4 mr-2" />
                관리자 페이지로 돌아가기
              </Button>
            </Link>
            <h1 className="text-xl font-bold">회원 관리</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        <UserManagement />
      </div>
    </div>
  );
}