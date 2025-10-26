import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Server,
  Tag,
  Gift,
  Settings,
  LogOut,
  TrendingUp,
  DollarSign,
  UserPlus,
  Activity,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Stats } from "@shared/schema";
import { AdminUsers } from "@/components/admin/admin-users";
import { AdminServers } from "@/components/admin/admin-servers";
import { AdminTariffs } from "@/components/admin/admin-tariffs";
import { AdminPromocodes } from "@/components/admin/admin-promocodes";
import { AdminSupportTickets } from "@/components/admin/admin-support-tickets";

type AdminTab = "overview" | "users" | "servers" | "tariffs" | "promocodes" | "support" | "settings";

export default function Admin() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  const { data: stats, isLoading, error } = useQuery<Stats>({
    queryKey: ["/api/admin/stats"],
  });

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setLocation("/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Доступ запрещен</CardTitle>
            <CardDescription>У вас нет прав для доступа к админ-панели</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/dashboard")} className="w-full" data-testid="button-back-dashboard">
              Вернуться в личный кабинет
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <aside className="w-64 min-h-screen border-r border-border bg-card/50 p-6">
          <div className="mb-8">
            <h2 className="text-xl font-bold">Админ-панель</h2>
            <p className="text-sm text-muted-foreground">ARMT VPN</p>
          </div>

          <nav className="space-y-2">
            <Button
              variant={activeTab === "overview" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("overview")}
              data-testid="button-tab-overview"
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Обзор
            </Button>
            <Button
              variant={activeTab === "users" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("users")}
              data-testid="button-tab-users"
            >
              <Users className="mr-2 h-4 w-4" />
              Пользователи
            </Button>
            <Button
              variant={activeTab === "servers" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("servers")}
              data-testid="button-tab-servers"
            >
              <Server className="mr-2 h-4 w-4" />
              Серверы
            </Button>
            <Button
              variant={activeTab === "tariffs" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("tariffs")}
              data-testid="button-tab-tariffs"
            >
              <Tag className="mr-2 h-4 w-4" />
              Тарифы
            </Button>
            <Button
              variant={activeTab === "promocodes" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("promocodes")}
              data-testid="button-tab-promocodes"
            >
              <Gift className="mr-2 h-4 w-4" />
              Промокоды
            </Button>
            <Button
              variant={activeTab === "support" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("support")}
              data-testid="button-tab-support"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Поддержка
            </Button>
            <Button
              variant={activeTab === "settings" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("settings")}
              data-testid="button-tab-settings"
            >
              <Settings className="mr-2 h-4 w-4" />
              Настройки
            </Button>
          </nav>

          <Separator className="my-6" />

          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Выйти
          </Button>
        </aside>

        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold">
                {activeTab === "overview" && "Обзор"}
                {activeTab === "users" && "Пользователи"}
                {activeTab === "servers" && "Серверы"}
                {activeTab === "tariffs" && "Тарифы"}
                {activeTab === "promocodes" && "Промокоды"}
                {activeTab === "support" && "Поддержка"}
                {activeTab === "settings" && "Настройки"}
              </h1>
              <ThemeToggle />
            </div>

            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Всего пользователей
                      </CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-users">
                        {stats?.total_users || 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        +{stats?.new_users_today || 0} сегодня
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Активные подписки
                      </CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-active-subs">
                        {stats?.active_subscriptions || 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Из {stats?.total_users || 0} пользователей
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Общий доход
                      </CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-revenue">
                        {stats?.total_revenue || 0}₽
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        +{stats?.revenue_today || 0}₽ сегодня
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Активные серверы
                      </CardTitle>
                      <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-active-servers">
                        {stats?.active_servers || 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Онлайн и готовы
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Быстрые действия</CardTitle>
                      <CardDescription>Часто используемые операции</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={() => setActiveTab("users")}
                        data-testid="button-quick-users"
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Управление пользователями
                      </Button>
                      <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={() => setActiveTab("servers")}
                        data-testid="button-quick-servers"
                      >
                        <Server className="mr-2 h-4 w-4" />
                        Добавить сервер
                      </Button>
                      <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={() => setActiveTab("promocodes")}
                        data-testid="button-quick-promocodes"
                      >
                        <Gift className="mr-2 h-4 w-4" />
                        Создать промокод
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Система</CardTitle>
                      <CardDescription>Статус системы</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">База данных</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500"></div>
                          <span className="text-sm font-medium">Онлайн</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Telegram Bot</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500"></div>
                          <span className="text-sm font-medium">Активен</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">CryptoBot API</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500"></div>
                          <span className="text-sm font-medium">Подключен</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === "users" && <AdminUsers />}
            {activeTab === "servers" && <AdminServers />}
            {activeTab === "tariffs" && <AdminTariffs />}
            {activeTab === "promocodes" && <AdminPromocodes />}
            {activeTab === "support" && <AdminSupportTickets />}

            {activeTab === "settings" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Настройки системы</CardTitle>
                    <CardDescription>
                      Конфигурация платформы
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Telegram Bot</div>
                      <div className="font-mono text-sm bg-muted p-2 rounded">
                        Подключен
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">CryptoBot API</div>
                      <div className="font-mono text-sm bg-muted p-2 rounded">
                        Подключен
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">База данных</div>
                      <div className="font-mono text-sm bg-muted p-2 rounded">
                        SQLite3
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
