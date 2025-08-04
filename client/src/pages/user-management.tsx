import { AdminHeader } from "@/components/admin-header";
import { UserManagement } from "@/components/user-management";

export default function UserManagementPage() {
  return (
    <div className="min-h-screen bg-eden-cream">
      <AdminHeader />
      
      {/* Content */}
      <div className="container mx-auto p-4 sm:p-6">
        <UserManagement />
      </div>
    </div>
  );
}