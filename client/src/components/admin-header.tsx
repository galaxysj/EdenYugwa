import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, DollarSign, Users, Cog, LogOut, Download } from "lucide-react";

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
    <div className="bg-eden-red text-white p-4 sm:p-6">
      <div className="container mx-auto">
        {/* 첫 번째 줄: 홈으로 버튼과 제목 */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/">
              <Button variant="ghost" className="text-white hover:text-gray-200 p-2 sm:px-4 sm:py-2">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">홈으로</span>
              </Button>
            </Link>
            <h1 className="text-lg sm:text-2xl font-bold font-korean">
              <Settings className="inline mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6" />
              관리자 패널
            </h1>
          </div>
          <div className="flex items-center space-x-2">
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
              className="text-white hover:text-gray-200 p-2 sm:px-4 sm:py-2"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">로그아웃</span>
            </Button>
          </div>
        </div>

        {/* 두 번째 줄: 카테고리별 메뉴 */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* 관리 섹션 */}
          <div className="flex flex-col">
            <div className="text-sm font-bold mb-2 text-white/80">관리</div>
            <div className="flex flex-wrap gap-2">
              {setActiveTab && (
                <Button 
                  onClick={() => setActiveTab('revenue')}
                  variant="ghost" 
                  size="sm"
                  className={`text-white hover:text-gray-200 ${activeTab === 'revenue' ? 'bg-white/20' : 'bg-white/10'}`}
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  매출관리
                </Button>
              )}
              <Link href="/customer-management">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={`text-white hover:text-gray-200 ${location === '/customer-management' ? 'bg-white/20' : 'bg-white/10'}`}
                >
                  <Users className="h-4 w-4 mr-1" />
                  고객관리
                </Button>
              </Link>
              <Link href="/user-management">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={`text-white hover:text-gray-200 ${location === '/user-management' ? 'bg-white/20' : 'bg-white/10'}`}
                >
                  <Users className="h-4 w-4 mr-1" />
                  회원관리
                </Button>
              </Link>
            </div>
          </div>

          {/* 설정 섹션 */}
          {(handleExcelDownload || costSettingsDialog || passwordChangeDialog || location === '/admin') && (
            <div className="flex flex-col">
              <div className="text-sm font-bold mb-2 text-white/80">설정</div>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin-settings">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-white hover:text-gray-200 bg-white/10"
                  >
                    <Cog className="h-4 w-4 mr-1" />
                    관리자 설정
                  </Button>
                </Link>
                {costSettingsDialog}
                {passwordChangeDialog}
                {handleExcelDownload && (
                  <Button 
                    onClick={handleExcelDownload}
                    variant="ghost" 
                    size="sm"
                    className="text-white hover:text-gray-200 bg-white/10"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    엑셀 다운로드
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* 권한 섹션 */}
          <div className="flex flex-col">
            <div className="text-sm font-bold mb-2 text-white/80">권한</div>
            <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
              <Link href="/admin">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`h-8 text-xs ${location === '/admin' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/20 hover:text-white'}`}
                >
                  관리자
                </Button>
              </Link>
              <Link href="/manager">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs text-white/70 hover:bg-white/20 hover:text-white"
                >
                  매니저
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}