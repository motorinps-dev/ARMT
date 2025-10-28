import { useState } from "react";
import { Shield, Download, CheckCircle2, Smartphone, Monitor, Apple, Chrome, Laptop } from "lucide-react";
import { SiApple, SiLinux, SiAndroid } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Installer() {
  const [downloadStarted, setDownloadStarted] = useState<string | null>(null);

  const handleDownload = (platform: string, url: string) => {
    setDownloadStarted(platform);
    window.open(url, '_blank');
    setTimeout(() => setDownloadStarted(null), 3000);
  };

  const platforms = [
    {
      id: "windows",
      name: "Windows",
      icon: Laptop,
      version: "10/11",
      size: "25 MB",
      downloadUrl: "#",
      description: "Поддержка Windows 10 и Windows 11 (64-bit)"
    },
    {
      id: "macos",
      name: "macOS",
      icon: SiApple,
      version: "11+",
      size: "30 MB",
      downloadUrl: "#",
      description: "Для macOS Big Sur и новее (Intel и Apple Silicon)"
    },
    {
      id: "linux",
      name: "Linux",
      icon: SiLinux,
      version: "Ubuntu/Debian",
      size: "20 MB",
      downloadUrl: "#",
      description: "Совместимо с Ubuntu 20.04+, Debian 11+"
    },
    {
      id: "android",
      name: "Android",
      icon: SiAndroid,
      version: "8.0+",
      size: "15 MB",
      downloadUrl: "#",
      description: "Android 8.0 (Oreo) и выше"
    },
    {
      id: "ios",
      name: "iOS",
      icon: Smartphone,
      version: "14+",
      size: "18 MB",
      downloadUrl: "#",
      description: "iPhone и iPad с iOS 14 и новее"
    }
  ];

  const installSteps = {
    windows: [
      "Скачайте установщик ARMT-VPN-Setup.exe",
      "Запустите установочный файл от имени администратора",
      "Следуйте инструкциям мастера установки",
      "После установки войдите в свою учетную запись",
      "Нажмите 'Подключиться' для активации VPN"
    ],
    macos: [
      "Скачайте файл ARMT-VPN.dmg",
      "Откройте DMG-образ и перетащите приложение в папку Applications",
      "Запустите ARMT VPN из папки Applications",
      "Разрешите системе установить VPN-профиль",
      "Войдите в аккаунт и подключитесь"
    ],
    linux: [
      "Скачайте .deb или .rpm пакет в зависимости от дистрибутива",
      "Установите пакет: sudo dpkg -i armt-vpn.deb (для Ubuntu/Debian)",
      "Или: sudo rpm -i armt-vpn.rpm (для Fedora/RedHat)",
      "Запустите: armt-vpn или найдите в меню приложений",
      "Авторизуйтесь и подключитесь к серверу"
    ],
    android: [
      "Скачайте APK-файл или установите через Google Play",
      "Откройте файл и разрешите установку из неизвестных источников",
      "Установите приложение",
      "Откройте ARMT VPN и войдите в аккаунт",
      "Выберите сервер и нажмите 'Подключиться'"
    ],
    ios: [
      "Скачайте приложение из App Store",
      "Откройте ARMT VPN на вашем устройстве",
      "Войдите используя свои учетные данные",
      "Разрешите добавление VPN-конфигурации",
      "Выберите сервер и активируйте защищенное соединение"
    ]
  };

  const features = [
    { icon: CheckCircle2, title: "Простая установка", description: "Установка за 2 минуты" },
    { icon: Shield, title: "Безопасность", description: "AES-256 шифрование" },
    { icon: Monitor, title: "Все платформы", description: "Windows, macOS, Linux, iOS, Android" },
    { icon: Chrome, title: "Автозапуск", description: "Автоматическое подключение при запуске системы" }
  ];

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
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/login" data-testid="link-login">
              <Button variant="outline" size="sm" data-testid="button-login">
                Войти
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge className="mb-4" data-testid="badge-version">
              Версия 2.0.1
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="heading-installer">
              Скачать ARMT VPN
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto" data-testid="text-description">
              Безопасный VPN-клиент для всех ваших устройств. 
              Защитите свою конфиденциальность одним кликом.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/50" data-testid={`card-feature-${index}`}>
                <CardContent className="pt-6">
                  <feature.icon className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mb-12" data-testid="card-downloads">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Выберите вашу платформу
              </CardTitle>
              <CardDescription>
                Скачайте клиент для вашей операционной системы
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {platforms.map((platform) => (
                  <Card 
                    key={platform.id} 
                    className="border-2 hover:border-primary/50 transition-all cursor-pointer group"
                    data-testid={`card-platform-${platform.id}`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <platform.icon className="h-12 w-12 text-primary" />
                        <Badge variant="outline" data-testid={`badge-version-${platform.id}`}>
                          {platform.version}
                        </Badge>
                      </div>
                      <h3 className="text-xl font-bold mb-1" data-testid={`text-platform-${platform.id}`}>
                        {platform.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {platform.description}
                      </p>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs text-muted-foreground" data-testid={`text-size-${platform.id}`}>
                          Размер: {platform.size}
                        </span>
                      </div>
                      <Button
                        className="w-full group-hover:bg-primary group-hover:text-primary-foreground"
                        variant={downloadStarted === platform.id ? "default" : "outline"}
                        onClick={() => handleDownload(platform.id, platform.downloadUrl)}
                        data-testid={`button-download-${platform.id}`}
                      >
                        {downloadStarted === platform.id ? (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Скачивается...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Скачать
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-installation">
            <CardHeader>
              <CardTitle>Инструкция по установке</CardTitle>
              <CardDescription>
                Пошаговое руководство для каждой платформы
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="windows" data-testid="tabs-installation">
                <TabsList className="grid grid-cols-5 w-full max-w-3xl">
                  <TabsTrigger value="windows" data-testid="tab-windows">
                    <Laptop className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Windows</span>
                  </TabsTrigger>
                  <TabsTrigger value="macos" data-testid="tab-macos">
                    <Monitor className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">macOS</span>
                  </TabsTrigger>
                  <TabsTrigger value="linux" data-testid="tab-linux">
                    <SiLinux className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Linux</span>
                  </TabsTrigger>
                  <TabsTrigger value="android" data-testid="tab-android">
                    <Smartphone className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Android</span>
                  </TabsTrigger>
                  <TabsTrigger value="ios" data-testid="tab-ios">
                    <Smartphone className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">iOS</span>
                  </TabsTrigger>
                </TabsList>

                {Object.entries(installSteps).map(([platform, steps]) => (
                  <TabsContent key={platform} value={platform} className="mt-6" data-testid={`content-${platform}`}>
                    <div className="space-y-4">
                      {steps.map((step, index) => (
                        <div key={index} className="flex gap-4" data-testid={`step-${platform}-${index}`}>
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1 pt-1">
                            <p className="text-sm">{step}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          <Card className="mt-12 bg-primary/5 border-primary/20" data-testid="card-support">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-xl font-bold mb-2">Нужна помощь?</h3>
                <p className="text-muted-foreground mb-4">
                  Наша служба поддержки готова помочь вам с установкой и настройкой
                </p>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Link href="/register" data-testid="link-register">
                    <Button variant="default" data-testid="button-register">
                      Создать аккаунт
                    </Button>
                  </Link>
                  <Link href="/#contacts" data-testid="link-support">
                    <Button variant="outline" data-testid="button-support">
                      Связаться с поддержкой
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator className="my-12" />

          <div className="text-center text-sm text-muted-foreground">
            <p data-testid="text-requirements">
              <strong>Системные требования:</strong> Минимум 100 МБ свободного места на диске, 
              активное интернет-соединение
            </p>
            <p className="mt-2" data-testid="text-compatibility">
              Все наши приложения регулярно обновляются и совместимы с последними версиями операционных систем
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
