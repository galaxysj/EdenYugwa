import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Leaf, Heart, BicepsFlexed, Sprout, Church, Phone, Mail, MapPin, Facebook, Instagram, Youtube, ShoppingCart, Info } from "lucide-react";
import OrderForm from "@/components/order-form";
import edenHangwaImage from "@assets/image_1753160591635.png";
import edenHangwaImage2 from "@assets/image_1753160530604.png";

export default function Home() {
  const [showOrderForm, setShowOrderForm] = useState(false);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-eden-cream">
      {/* Navigation */}
      <header className="bg-white shadow-sm border-b border-eden-beige sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Leaf className="text-eden-sage text-2xl" />
              <h1 className="text-2xl font-bold text-eden-brown font-korean">에덴한과</h1>
            </div>
            <nav className="hidden md:flex space-x-8">
              <button 
                onClick={() => scrollToSection('home')}
                className="text-eden-dark hover:text-eden-brown transition-colors"
              >
                홈
              </button>
              <button 
                onClick={() => scrollToSection('about')}
                className="text-eden-dark hover:text-eden-brown transition-colors"
              >
                소개
              </button>
              <button 
                onClick={() => scrollToSection('order')}
                className="text-eden-dark hover:text-eden-brown transition-colors"
              >
                주문하기
              </button>
              <Link href="/admin">
                <Button variant="ghost" className="text-eden-red hover:text-eden-brown">
                  관리자
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-90"></div>
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <h2 className="text-4xl md:text-5xl font-bold text-eden-brown mb-6 leading-tight font-korean">
                진안에서 온<br />
                <span className="text-eden-red">정성 가득</span> 유과
              </h2>
              <p className="text-lg text-eden-dark mb-8 leading-relaxed">
                부모님이 직접 만드시는 수제 유과로<br />
                달지 않고 고소한 맛이 일품입니다.<br />
                교회 선물로도 완벽한 에덴한과를 만나보세요.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button 
                  onClick={() => scrollToSection('order')}
                  className="bg-eden-brown text-white px-8 py-3 hover:bg-eden-dark transition-colors"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  지금 주문하기
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => scrollToSection('about')}
                  className="border-2 border-eden-brown text-eden-brown hover:bg-eden-brown hover:text-white transition-colors"
                >
                  자세히 알아보기
                </Button>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                <img 
                  src={edenHangwaImage} 
                  alt="에덴한과 유과 상품" 
                  className="rounded-2xl shadow-2xl w-full max-w-md"
                />
                <div className="absolute -bottom-4 -right-4 bg-eden-red text-white px-4 py-2 rounded-lg font-semibold shadow-lg">
                  <Heart className="inline mr-1 h-4 w-4" />
                  수제 한과
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-eden-brown mb-4 font-korean">에덴한과 이야기</h3>
            <p className="text-eden-dark max-w-2xl mx-auto">
              하나님의 은혜로 시작된 에덴한과는 진안 지역에서 부모님이 정성껏 만드시는 전통 유과입니다.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <Card className="text-center p-6 bg-eden-cream">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-eden-sage rounded-full flex items-center justify-center mx-auto mb-4">
                  <BicepsFlexed className="text-white text-2xl" />
                </div>
                <h4 className="text-xl font-semibold text-eden-brown mb-3">정성스런 수제</h4>
                <p className="text-eden-dark">
                  진안에 계신 부모님이 하나하나 정성껏 손으로 만드는 전통 유과입니다.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 bg-eden-cream">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-eden-brown rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sprout className="text-white text-2xl" />
                </div>
                <h4 className="text-xl font-semibold text-eden-brown mb-3">자연스런 맛</h4>
                <p className="text-eden-dark">
                  과하게 달지 않고 고소한 맛으로 남녀노소 누구나 좋아하는 건강한 간식입니다.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 bg-eden-cream">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-eden-red rounded-full flex items-center justify-center mx-auto mb-4">
                  <Church className="text-white text-2xl" />
                </div>
                <h4 className="text-xl font-semibold text-eden-brown mb-3">교회 선물</h4>
                <p className="text-eden-dark">
                  기독교적 의미가 담긴 에덴한과는 교회 행사나 선물용으로 완벽합니다.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Product Showcase */}
          <div className="gradient-card rounded-2xl p-8 md:p-12">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <img 
                  src={edenHangwaImage2} 
                  alt="전통 한과 재료" 
                  className="rounded-xl shadow-lg w-full"
                />
              </div>
              <div>
                <h4 className="text-2xl font-bold text-eden-brown mb-6">우리 유과의 특별함</h4>
                <ul className="space-y-4">
                  <li className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-eden-sage rounded-full flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span className="text-eden-dark">엄선된 국산 재료만을 사용하여 건강하고 안전합니다</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-eden-sage rounded-full flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span className="text-eden-dark">전통 제조 방식을 고수하여 깊은 맛과 향을 자랑합니다</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-eden-sage rounded-full flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span className="text-eden-dark">과도하지 않은 단맛으로 부담 없이 즐길 수 있습니다</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-eden-sage rounded-full flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span className="text-eden-dark">아름다운 포장으로 선물용으로도 완벽합니다</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Order Section */}
      <section id="order" className="py-16 bg-eden-cream">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-eden-brown mb-4 font-korean">주문하기</h3>
            <p className="text-eden-dark">신선하고 정성스런 에덴한과를 주문해보세요</p>
          </div>

          <OrderForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-eden-dark text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <Leaf className="text-eden-sage text-2xl" />
                <h3 className="text-xl font-bold font-korean">에덴한과</h3>
              </div>
              <p className="text-gray-300 mb-4">
                하나님의 은혜로 시작된 진안의 정성스런 수제 유과
              </p>
              <div className="flex space-x-4">
                <Facebook className="text-eden-sage cursor-pointer hover:text-eden-cream transition-colors" />
                <Instagram className="text-eden-sage cursor-pointer hover:text-eden-cream transition-colors" />
                <Youtube className="text-eden-sage cursor-pointer hover:text-eden-cream transition-colors" />
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">연락처</h4>
              <div className="space-y-2 text-gray-300">
                <p><Phone className="inline mr-2 h-4 w-4" /> 063-123-4567</p>
                <p><Mail className="inline mr-2 h-4 w-4" /> eden@hansik.co.kr</p>
                <p><MapPin className="inline mr-2 h-4 w-4" /> 전라북도 진안군</p>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">운영시간</h4>
              <div className="space-y-2 text-gray-300">
                <p>평일: 09:00 - 18:00</p>
                <p>토요일: 09:00 - 15:00</p>
                <p>일요일: 휴무</p>
                <p className="text-sm text-eden-sage mt-4">
                  <Info className="inline mr-1 h-4 w-4" />
                  주문 후 3-5일 소요됩니다
                </p>
              </div>
            </div>
          </div>
          
          <hr className="border-gray-600 my-8" />
          
          <div className="text-center text-gray-400">
            <p>&copy; 2024 에덴한과. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
