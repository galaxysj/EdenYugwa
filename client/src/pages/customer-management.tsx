import { AdminHeader } from "@/components/admin-header";
import { CustomerManagement } from "@/components/customer-management";

export default function CustomerManagementPage() {
  return (
    <div className="min-h-screen bg-eden-cream">
      <AdminHeader />
      
      {/* Content */}
      <div className="container mx-auto p-4 sm:p-6">
        <CustomerManagement />
      </div>
    </div>
  );
}