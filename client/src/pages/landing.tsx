import { Shield, Zap, Lock, Globe, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export default function Landing() {
  const [, setLocation] = useLocation();
  const { data: user } = useQuery<User>({
    queryKey: ["/api/user/me"],
    retry: false,
  });

  const handleSelectPlan = (e: React.MouseEvent) => {
    if (user) {
      e.preventDefault();
      setLocation("/dashboard?tab=tariffs");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" data-testid="link-home">
            <div className="flex items-center gap-3 cursor-pointer hover-elevate rounded-md px-2 py-1">
              <Shield className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">ARMT VPN</span>
            </div>
          </Link>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Возможности
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Цены
              </a>
              <Link href="/download" data-testid="link-download">
                <span className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                  Скачать
                </span>
              </Link>
              <a href="#contacts" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Контакты
              </a>
            </div>
            <ThemeToggle />
            {user ? (
              <Link href="/dashboard" data-testid="link-dashboard">
                <Button size="sm" data-testid="button-dashboard-nav">
                  Личный кабинет
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login" data-testid="link-login">
                  <Button variant="outline" size="sm" data-testid="button-login-nav">
                    Войти
                  </Button>
                </Link>
                <Link href="/register" data-testid="link-register">
                  <Button size="sm" data-testid="button-register-nav">
                    Регистрация
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="min-h-screen flex items-center justify-center pt-24 pb-12 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Безопасный и быстрый VPN
              </h1>
              <p className="text-lg text-muted-foreground">
                Защитите свою конфиденциальность и получите доступ к любому контенту без ограничений
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href={user ? "/dashboard?tab=tariffs" : "/register"} onClick={handleSelectPlan} data-testid="link-hero-register">
                  <Button size="lg" className="w-full sm:w-auto group" data-testid="button-hero-register">
                    Выбрать тариф
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <a href="#contacts">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto" data-testid="button-hero-support">
                    Поддержка
                  </Button>
                </a>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
                <Shield className="h-64 w-64 text-primary relative" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-6">
        <div className="container mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold text-center mb-12">Наши преимущества</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 text-center hover-elevate transition-all">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">Высокая скорость</h3>
              <p className="text-muted-foreground">
                Оптимизированные серверы обеспечивают минимальные задержки и максимальную скорость соединения
              </p>
            </Card>
            <Card className="p-6 text-center hover-elevate transition-all">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">Полная анонимность</h3>
              <p className="text-muted-foreground">
                Ваши данные надежно защищены современными алгоритмами шифрования
              </p>
            </Card>
            <Card className="p-6 text-center hover-elevate transition-all">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <Globe className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">Глобальный доступ</h3>
              <p className="text-muted-foreground">
                Серверы в разных странах позволяют обходить географические ограничения и цензуру
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 px-6 bg-card/50">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">Наши тарифы</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 hover-elevate transition-all">
              <h3 className="text-2xl font-bold mb-2">1 Месяц</h3>
              <p className="text-muted-foreground mb-6">Идеально для тестирования</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">130₽</span>
                <span className="text-muted-foreground">/мес</span>
              </div>
              <ul className="space-y-3 mb-6 text-sm">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                  <span>1000 ГБ трафика</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                  <span>До 5 устройств</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                  <span>24/7 поддержка</span>
                </li>
              </ul>
              <Link href={user ? "/dashboard?tab=tariffs" : "/register"} onClick={handleSelectPlan} data-testid="link-pricing-1month">
                <Button className="w-full" data-testid="button-pricing-1month">Выбрать</Button>
              </Link>
            </Card>

            <Card className="p-6 border-primary hover-elevate transition-all relative">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-bl-md rounded-tr-md">
                Популярный
              </div>
              <h3 className="text-2xl font-bold mb-2">3 Месяца</h3>
              <p className="text-muted-foreground mb-6">Оптимальный выбор</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">390₽</span>
                <span className="text-muted-foreground">/3мес</span>
              </div>
              <ul className="space-y-3 mb-6 text-sm">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                  <span>3000 ГБ трафика</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                  <span>До 5 устройств</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                  <span>24/7 поддержка</span>
                </li>
              </ul>
              <Link href={user ? "/dashboard?tab=tariffs" : "/register"} onClick={handleSelectPlan} data-testid="link-pricing-3months">
                <Button className="w-full" data-testid="button-pricing-3months">Выбрать</Button>
              </Link>
            </Card>

            <Card className="p-6 hover-elevate transition-all">
              <h3 className="text-2xl font-bold mb-2">1 Год</h3>
              <p className="text-muted-foreground mb-6">Максимальная выгода</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">1000₽</span>
                <span className="text-muted-foreground">/год</span>
              </div>
              <ul className="space-y-3 mb-6 text-sm">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                  <span>12000 ГБ трафика</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                  <span>До 5 устройств</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                  <span>24/7 поддержка</span>
                </li>
              </ul>
              <Link href={user ? "/dashboard?tab=tariffs" : "/register"} onClick={handleSelectPlan} data-testid="link-pricing-12months">
                <Button className="w-full" data-testid="button-pricing-12months">Выбрать</Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      <section id="contacts" className="py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">Свяжитесь с нами</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8 text-center hover-elevate transition-all">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <svg className="h-12 w-12 text-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.67-.52.36-.99.53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.37-.48 1.03-.73 4.04-1.76 6.73-2.92 8.08-3.49 3.85-1.61 4.65-1.89 5.17-1.9.11 0 .37.03.54.17.14.11.18.26.2.37-.01.06.01.24 0 .38z"/>
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">Поддержка</h3>
              <p className="text-sm text-muted-foreground mb-4">Свяжитесь с нашей службой поддержки</p>
              <Button
                onClick={() => window.open('https://t.me/armt_robot', '_blank')}
                className="w-full"
                data-testid="button-support-telegram"
              >
                Открыть
              </Button>
            </Card>

            <Card className="p-8 text-center hover-elevate transition-all">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <svg className="h-12 w-12 text-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.67-.52.36-.99.53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.37-.48 1.03-.73 4.04-1.76 6.73-2.92 8.08-3.49 3.85-1.61 4.65-1.89 5.17-1.9.11 0 .37.03.54.17.14.11.18.26.2.37-.01.06.01.24 0 .38z"/>
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">Канал</h3>
              <p className="text-sm text-muted-foreground mb-4">Новости и обновления</p>
              <Button
                onClick={() => window.open('https://t.me/armt_vpn', '_blank')}
                className="w-full"
                data-testid="button-channel-telegram"
              >
                Открыть
              </Button>
            </Card>
          </div>
        </div>
      </section>

      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border">
        <div className="container mx-auto px-6">
          © 2025 ARMT VPN. Все права защищены.
        </div>
      </footer>
    </div>
  );
}
