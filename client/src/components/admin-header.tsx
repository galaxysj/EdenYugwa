import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, DollarSign, Users, Cog, LogOut, Download, Package, Menu, X, Edit, Trash2, Shield } from "lucide-react";
import { useState } from "react";

interface AdminHeaderProps {
  handleExcelDownload?: () => void;
  setActiveTab?: (tab: string) => void;
  activeTab?: string;
  costSettingsDialog?: React.ReactNode;
  passwordChangeDialog?: React.ReactNode;
}

export function AdminHeader({ handleExcelDownload, setActiveTab, activeTab, costSettingsDialog, passwordChangeDialog }: AdminHeaderProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-[100]">
      <div className="container mx-auto px-3 md:px-4 sm:px-6">
        {/* 모바일 헤더 */}
        <div className="flex md:hidden justify-between items-center py-3">
          <div className="flex items-center space-x-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 p-1">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="admin-text-xs font-semibold text-gray-900 truncate">
              관리자 패널
            </h1>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
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
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 p-1"
            >
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* 데스크톱 헤더 */}
        <div className="hidden md:flex justify-between items-center py-4 border-b border-gray-100">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 admin-text-xs">
                <ArrowLeft className="h-4 w-4 mr-2" />
                홈으로
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-200"></div>
            <h1 className="admin-text font-semibold text-gray-900 flex items-center">
              <Settings className="h-5 w-5 mr-2 text-gray-600" />
              관리자 패널
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <Link href="/security-settings">
              <Button variant="ghost" className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 admin-text-xs">
                <Shield className="h-4 w-4 mr-2" />
                보안 설정
              </Button>
            </Link>
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
              className="text-gray-600 hover:text-gray-900 border-gray-200 hover:bg-gray-50 admin-text-xs"
            >
              <LogOut className="h-4 w-4 mr-2" />
              로그아웃
            </Button>
          </div>
        </div>

        {/* 모바일 드롭다운 메뉴 */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 py-3 space-y-2 bg-white">
            {(location === '/admin' || location === '/admin-settings') && setActiveTab && (
              <>
                <Button 
                  onClick={() => {
                    setActiveTab('revenue');
                    setIsMobileMenuOpen(false);
                  }}
                  variant="ghost" 
                  size="sm"
                  className={`w-full justify-start admin-text-xs ${
                    activeTab === 'revenue' 
                      ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  매출관리
                </Button>
                <Button 
                  onClick={() => {
                    setActiveTab('orders');
                    setIsMobileMenuOpen(false);
                  }}
                  variant="ghost" 
                  size="sm"
                  className={`w-full justify-start admin-text-xs ${
                    activeTab === 'orders' 
                      ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Package className="h-4 w-4 mr-2" />
                  주문목록
                </Button>
                <Button 
                  onClick={() => {
                    setActiveTab('customers');
                    setIsMobileMenuOpen(false);
                  }}
                  variant="ghost" 
                  size="sm"
                  className={`w-full justify-start admin-text-xs ${
                    activeTab === 'customers' 
                      ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Users className="h-4 w-4 mr-2" />
                  고객관리
                </Button>
                <Button 
                  onClick={() => {
                    setActiveTab('members');
                    setIsMobileMenuOpen(false);
                  }}
                  variant="ghost" 
                  size="sm"
                  className={`w-full justify-start admin-text-xs ${
                    activeTab === 'members' 
                      ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Users className="h-4 w-4 mr-2" />
                  회원관리
                </Button>

                <Button 
                  onClick={() => {
                    setActiveTab('settings');
                    setIsMobileMenuOpen(false);
                  }}
                  variant="ghost" 
                  size="sm"
                  className={`w-full justify-start admin-text-xs ${
                    activeTab === 'settings' 
                      ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Cog className="h-4 w-4 mr-2" />
                  설정
                </Button>
                <Button 
                  onClick={() => {
                    setActiveTab('content');
                    setIsMobileMenuOpen(false);
                  }}
                  variant="ghost" 
                  size="sm"
                  className={`w-full justify-start admin-text-xs ${
                    activeTab === 'content' 
                      ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  콘텐츠 관리
                </Button>
                <Button 
                  onClick={() => {
                    setActiveTab('trash');
                    setIsMobileMenuOpen(false);
                  }}
                  variant="ghost" 
                  size="sm"
                  className={`w-full justify-start admin-text-xs ${
                    activeTab === 'trash' 
                      ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  휴지통
                </Button>
              </>
            )}
            
            {/* 보안 설정 링크 */}
            <Link href="/security-settings">
              <Button 
                onClick={() => setIsMobileMenuOpen(false)}
                variant="ghost" 
                size="sm"
                className="w-full justify-start admin-text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              >
                <Shield className="h-4 w-4 mr-2" />
                보안 설정
              </Button>
            </Link>
            
            {location === '/admin' && setActiveTab && (
              <>
                {/* 여기에 기존 버튼들이 있었음 */}
              </>
            )}
            {handleExcelDownload && (
              <Button 
                onClick={() => {
                  handleExcelDownload();
                  setIsMobileMenuOpen(false);
                }}
                variant="ghost" 
                size="sm"
                className="w-full justify-start admin-text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              >
                <Download className="h-4 w-4 mr-2" />
                엑셀 다운로드
              </Button>
            )}
            <div className="border-t pt-2">
              {passwordChangeDialog}
              {costSettingsDialog}
            </div>
          </div>
        )}

        {/* 데스크톱 네비게이션 메뉴 */}
        <div className="hidden sm:block py-3">
          <div className="flex items-center justify-between">
            {/* 메인 메뉴 */}
            <div className="flex items-center space-x-1">
              {/* 관리자 페이지 메뉴 */}
              {(location === '/admin' || location === '/admin-settings') && setActiveTab && (
                <>
                  <Button 
                    onClick={() => setActiveTab('revenue')}
                    variant="ghost" 
                    size="sm"
                    className={`px-2 lg:px-4 py-1 lg:py-2 rounded-md font-medium transition-colors admin-menu-text ${
                      activeTab === 'revenue' 
                        ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <DollarSign className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
                    매출관리
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('customers')}
                    variant="ghost" 
                    size="sm"
                    className={`px-2 lg:px-4 py-1 lg:py-2 rounded-md font-medium transition-colors admin-text-xs ${
                      activeTab === 'customers'
                        ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Users className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
                    고객관리
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('members')}
                    variant="ghost" 
                    size="sm"
                    className={`px-2 lg:px-4 py-1 lg:py-2 rounded-md font-medium transition-colors admin-menu-text ${
                      activeTab === 'members'
                        ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Users className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
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
                    className={`px-2 lg:px-4 py-1 lg:py-2 rounded-md font-medium transition-colors admin-menu-text ${
                      activeTab === 'orders'
                        ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Package className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
                    주문관리
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('customers')}
                    variant="ghost" 
                    size="sm"
                    className={`px-2 lg:px-4 py-1 lg:py-2 rounded-md font-medium transition-colors admin-menu-text ${
                      activeTab === 'customers'
                        ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Users className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
                    고객관리
                  </Button>
                </>
              )}

              {/* 설정 페이지 메뉴 */}
              {location === '/admin-settings' && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="bg-gray-100 text-gray-900 border border-gray-300 px-2 lg:px-4 py-1 lg:py-2 rounded-md font-medium admin-menu-text"
                >
                  <Cog className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
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
                      className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-2 lg:px-3 py-1 lg:py-2 admin-menu-text"
                    >
                      <Cog className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
                      설정
                    </Button>
                  </Link>
                  {setActiveTab && (
                    <Button 
                      onClick={() => setActiveTab('content')}
                      variant="ghost" 
                      size="sm"
                      className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-2 lg:px-3 py-1 lg:py-2 admin-menu-text"
                    >
                      <Edit className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
                      콘텐츠
                    </Button>
                  )}
                  {setActiveTab && (
                    <Button 
                      onClick={() => setActiveTab('trash')}
                      variant="ghost" 
                      size="sm"
                      className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-2 lg:px-3 py-1 lg:py-2 admin-menu-text"
                    >
                      <Trash2 className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
                      휴지통
                    </Button>
                  )}
                  {costSettingsDialog && <div className="[&>button]:!bg-transparent [&>button]:!text-gray-600 [&>button]:hover:!text-gray-900 [&>button]:hover:!bg-gray-50 [&>button]:!border-0 [&>button]:!px-3 [&>button]:!py-2">{costSettingsDialog}</div>}
                  {passwordChangeDialog && <div className="[&>button]:!bg-transparent [&>button]:!text-gray-600 [&>button]:hover:!text-gray-900 [&>button]:hover:!bg-gray-50 [&>button]:!border-0 [&>button]:!px-3 [&>button]:!py-2">{passwordChangeDialog}</div>}
                  {handleExcelDownload && (
                    <Button 
                      onClick={handleExcelDownload}
                      variant="ghost" 
                      size="sm"
                      className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-2 lg:px-3 py-1 lg:py-2 admin-menu-text"
                    >
                      <Download className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
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
                    className={`h-6 lg:h-7 px-2 lg:px-3 admin-menu-text font-medium transition-all ${
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
                    className={`h-6 lg:h-7 px-2 lg:px-3 admin-menu-text font-medium transition-all ${
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