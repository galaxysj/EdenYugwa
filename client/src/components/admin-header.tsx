import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, DollarSign, Users, Cog, LogOut, Download, Package } from "lucide-react";

interface AdminHeaderProps {
  handleExcelDownload?: () => void;
  setActiveTab?: (tab: string) => void;
  activeTab?: string;
  costSettingsDialog?: React.ReactNode;
  passwordChangeDialog?: React.ReactNode;
}

export function AdminHeader({ handleExcelDownload, setActiveTab, activeTab, costSettingsDialog, passwordChangeDialog }: AdminHeaderProps) {
  const [location] = useLocation();

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6">
        {/* 헤더 상단 */}
        <div className="flex justify-between items-center py-4 border-b border-gray-100">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                홈으로
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-200"></div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center">
              <Settings className="h-5 w-5 mr-2 text-gray-600" />
              관리자 패널
            </h1>
          </div>
          <Button 
            onClick={async () => {
              try {
                const response = await fetch('/api/auth/logout', {
                  method: 'POST',
                  credentials: 'include'
                });
                if (response.ok) {
                  window.location.href = '/';
                }
              } catch (error) {
                console.error('로그아웃 실패:', error);
              }
            }}
            variant="outline"
            className="text-gray-600 hover:text-gray-900 border-gray-200 hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4 mr-2" />
            로그아웃
          </Button>
        </div>

        {/* 네비게이션 메뉴 */}
        <div className="py-3">
          <div className="flex items-center justify-between">
            {/* 메인 메뉴 */}
            <div className="flex items-center space-x-1">
              {/* 관리자 페이지 메뉴 */}
              {location === '/admin' && setActiveTab && (
                <>
                  <Button 
                    onClick={() => setActiveTab('revenue')}
                    variant="ghost" 
                    size="sm"
                    className={`px-4 py-2 rounded-md font-medium transition-colors ${
                      activeTab === 'revenue' 
                        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    매출관리
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('customers')}
                    variant="ghost" 
                    size="sm"
                    className={`px-4 py-2 rounded-md font-medium transition-colors ${
                      activeTab === 'customers'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    고객관리
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('users')}
                    variant="ghost" 
                    size="sm"
                    className={`px-4 py-2 rounded-md font-medium transition-colors ${
                      activeTab === 'users'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    회원관리
                  </Button>
                </>
              )}

              {/* 매니저 페이지 메뉴 */}
              {location === '/manager' && setActiveTab && (
                <>
                  <Button 
                    onClick={() => setActiveTab('orders')}
                    variant="ghost" 
                    size="sm"
                    className={`px-4 py-2 rounded-md font-medium transition-colors ${
                      activeTab === 'orders'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    주문관리
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('customers')}
                    variant="ghost" 
                    size="sm"
                    className={`px-4 py-2 rounded-md font-medium transition-colors ${
                      activeTab === 'customers'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    고객관리
                  </Button>
                </>
              )}

              {/* 설정 페이지 메뉴 */}
              {location === '/admin-settings' && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-md font-medium"
                >
                  <Cog className="h-4 w-4 mr-2" />
                  설정
                </Button>
              )}
            </div>

            {/* 설정 메뉴 */}
            <div className="flex items-center space-x-1">
              {(handleExcelDownload || costSettingsDialog || passwordChangeDialog || location === '/admin') && (
                <>
                  <Link href="/admin-settings">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2"
                    >
                      <Cog className="h-4 w-4 mr-2" />
                      설정
                    </Button>
                  </Link>
                  {costSettingsDialog && <div className="[&>button]:!bg-transparent [&>button]:!text-gray-600 [&>button]:hover:!text-gray-900 [&>button]:hover:!bg-gray-50 [&>button]:!border-0 [&>button]:!px-3 [&>button]:!py-2">{costSettingsDialog}</div>}
                  {passwordChangeDialog && <div className="[&>button]:!bg-transparent [&>button]:!text-gray-600 [&>button]:hover:!text-gray-900 [&>button]:hover:!bg-gray-50 [&>button]:!border-0 [&>button]:!px-3 [&>button]:!py-2">{passwordChangeDialog}</div>}
                  {handleExcelDownload && (
                    <Button 
                      onClick={handleExcelDownload}
                      variant="ghost" 
                      size="sm"
                      className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      엑셀
                    </Button>
                  )}
                  <div className="h-4 w-px bg-gray-200 mx-2"></div>
                </>
              )}
              
              {/* 권한 전환 */}
              <div className="flex items-center bg-gray-50 rounded-lg p-1">
                <Link href="/admin">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`h-7 px-3 text-xs font-medium transition-all ${
                      location === '/admin' 
                        ? 'bg-white text-gray-900 shadow-sm border border-gray-200' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    관리자
                  </Button>
                </Link>
                <Link href="/manager">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`h-7 px-3 text-xs font-medium transition-all ${
                      location === '/manager' 
                        ? 'bg-white text-gray-900 shadow-sm border border-gray-200' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    매니저
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}