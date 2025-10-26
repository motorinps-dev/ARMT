import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Wallet,
  Users,
  Settings,
  LogOut,
  Copy,
  QrCode,
  Check,
  Calendar,
  Database,
  CreditCard,
  MessageSquare,
  Send,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import { Telegram2FASettings } from "@/components/telegram-2fa-settings";
import { VpnConfigCard } from "@/components/vpn-config-card";
import { AccountSecurity } from "@/components/account-security";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, VpnProfile, Tariff, Referral, Transaction, SupportTicket, SupportMessage, InsertSupportTicket } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get("tab") as "overview" | "balance" | "referrals" | "settings" | "tariffs" | "support" | null;
  
  const [activeTab, setActiveTab] = useState<"overview" | "balance" | "referrals" | "settings" | "tariffs" | "support">(
    tabFromUrl || "overview"
  );
  
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/user/me"],
  });

  useEffect(() => {
    if (user?.nickname) {
      setNickname(user.nickname);
    }
  }, [user?.nickname]);

  const { data: vpnProfiles = [] } = useQuery<VpnProfile[]>({
    queryKey: ["/api/vpn/profiles"],
    enabled: !!user,
  });

  const { data: referrals = [] } = useQuery<Referral[]>({
    queryKey: ["/api/referrals"],
    enabled: !!user,
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    enabled: !!user,
  });

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setLocation("/login");
  };

  const depositMutation = useMutation({
    mutationFn: async (amount: number) => {
      return apiRequest("POST", "/api/balance/deposit", { amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Баланс пополнен",
        description: "Средства успешно зачислены на ваш счёт",
      });
      setDepositDialogOpen(false);
      setDepositAmount("");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось пополнить баланс",
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { nickname: string }) => {
      return apiRequest("PATCH", "/api/user/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
      toast({
        title: "Профиль обновлен",
        description: "Никнейм успешно изменен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить профиль",
        variant: "destructive",
      });
    },
  });

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Ошибка",
        description: "Введите корректную сумму пополнения",
        variant: "destructive",
      });
      return;
    }
    depositMutation.mutate(amount);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedConfig(true);
    toast({
      title: "Скопировано",
      description: "Конфигурация скопирована в буфер обмена",
    });
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  const daysRemaining = user?.expires_at 
    ? Math.max(0, Math.ceil((new Date(user.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isSubscriptionActive = user?.expires_at && new Date(user.expires_at) > new Date();

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <aside className="w-64 min-h-screen border-r border-border bg-card/50 p-6">
          <div className="mb-8">
            <h2 className="text-xl font-bold">ARMT VPN</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
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
              variant={activeTab === "tariffs" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("tariffs")}
              data-testid="button-tab-tariffs"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Тарифы
            </Button>
            <Button
              variant={activeTab === "balance" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("balance")}
              data-testid="button-tab-balance"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Баланс
            </Button>
            <Button
              variant={activeTab === "referrals" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("referrals")}
              data-testid="button-tab-referrals"
            >
              <Users className="mr-2 h-4 w-4" />
              Рефералы
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

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Основной баланс</span>
              <span className="font-bold" data-testid="text-main-balance">{user?.main_balance || 0}₽</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Реферальный баланс</span>
              <span className="font-bold" data-testid="text-referral-balance">{user?.referral_balance || 0}₽</span>
            </div>
          </div>

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
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold">
                {activeTab === "overview" && "Обзор"}
                {activeTab === "tariffs" && "Выбор тарифа"}
                {activeTab === "balance" && "Баланс"}
                {activeTab === "referrals" && "Реферальная программа"}
                {activeTab === "support" && "Поддержка"}
                {activeTab === "settings" && "Настройки"}
              </h1>
              <ThemeToggle />
            </div>

            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Статус подписки
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {isSubscriptionActive ? (
                          <>
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                              Активна
                            </Badge>
                            <span className="text-sm text-muted-foreground" data-testid="text-subscription-status">
                              {daysRemaining} дней
                            </span>
                          </>
                        ) : (
                          <Badge variant="secondary">Неактивна</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        VPN конфигурации
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-vpn-count">
                        {vpnProfiles.length}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Приглашено друзей
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-referrals-count">
                        {referrals.length}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {isSubscriptionActive && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Активная подписка
                      </CardTitle>
                      <CardDescription>
                        Истекает: {user?.expires_at ? new Date(user.expires_at).toLocaleDateString('ru-RU') : '—'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Осталось дней</span>
                            <span className="font-medium">{daysRemaining} / ~30</span>
                          </div>
                          <Progress value={(daysRemaining / 30) * 100} className="h-2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {vpnProfiles.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      <h3 className="text-lg font-semibold">VPN Конфигурации</h3>
                    </div>
                    <div className="grid gap-4">
                      {vpnProfiles.map((profile) => (
                        <VpnConfigCard key={profile.id} profile={profile} />
                      ))}
                    </div>
                  </div>
                )}

                {vpnProfiles.length === 0 && !isSubscriptionActive && (
                  <Card>
                    <CardHeader>
                      <CardTitle>У вас нет активной подписки</CardTitle>
                      <CardDescription>
                        Выберите тариф и начните использовать VPN
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => setActiveTab("tariffs")} data-testid="button-choose-tariff">
                        Выбрать тариф
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === "tariffs" && (
              <div className="space-y-6">
                <TariffsTab user={user} />
              </div>
            )}

            {activeTab === "balance" && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Основной баланс</CardTitle>
                      <CardDescription>
                        Используется для покупки подписок
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold mb-4" data-testid="text-balance-main">
                        {user?.main_balance || 0}₽
                      </div>
                      <Button 
                        className="w-full" 
                        data-testid="button-deposit"
                        onClick={() => setDepositDialogOpen(true)}
                      >
                        Пополнить баланс
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Реферальный баланс</CardTitle>
                      <CardDescription>
                        Заработано с рефералов
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold mb-4" data-testid="text-balance-referral">
                        {user?.referral_balance || 0}₽
                      </div>
                      <Button variant="outline" className="w-full" disabled data-testid="button-transfer">
                        Перевести на основной
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>История транзакций</CardTitle>
                    <CardDescription>Последние операции с балансом</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {transactions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        История транзакций пуста
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {transactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                            data-testid={`transaction-${tx.id}`}
                          >
                            <div>
                              <div className="font-medium">{tx.description}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(tx.created_at).toLocaleDateString('ru-RU')}
                              </div>
                            </div>
                            <div className="font-bold">{tx.amount > 0 ? '+' : ''}{tx.amount}₽</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "referrals" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Ваша реферальная ссылка</CardTitle>
                    <CardDescription>
                      Приглашайте друзей и получайте бонусы
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm bg-muted p-3 rounded border border-border">
                        {window.location.origin}/register?ref={user?.id}
                      </code>
                      <Button
                        onClick={() => copyToClipboard(`${window.location.origin}/register?ref=${user?.id}`)}
                        data-testid="button-copy-referral"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Приглашено друзей</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold" data-testid="text-total-referrals">
                        {referrals.length}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Заработано</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold" data-testid="text-total-earned">
                        {user?.referral_balance || 0}₽
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Ваши рефералы</CardTitle>
                    <CardDescription>Список приглашенных пользователей</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {referrals.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        У вас пока нет рефералов
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {referrals.map((referral) => (
                          <div
                            key={referral.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                            data-testid={`referral-${referral.id}`}
                          >
                            <div>
                              <div className="font-medium">Пользователь #{referral.referred_id}</div>
                              <div className="text-xs text-muted-foreground">
                                Присоединился: {new Date(referral.created_at).toLocaleDateString('ru-RU')}
                              </div>
                            </div>
                            <div className="font-bold text-green-500">+{referral.bonus_earned}₽</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "support" && <SupportTab user={user} />}

            {activeTab === "settings" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Информация об аккаунте</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Email</div>
                      <div className="font-medium" data-testid="text-account-email">{user?.email}</div>
                    </div>
                    {user?.telegram_username && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Telegram</div>
                        <div className="font-medium" data-testid="text-telegram-username">@{user.telegram_username}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Дата регистрации</div>
                      <div className="font-medium">
                        {user?.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : '—'}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Редактировать профиль</CardTitle>
                    <CardDescription>
                      Укажите никнейм для отображения в системе
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="nickname" className="text-sm font-medium">
                        Никнейм
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            id="nickname"
                            type="text"
                            placeholder="Введите никнейм"
                            value={nickname}
                            onChange={(e) => {
                              const value = e.target.value;
                              setNickname(value);
                              setNicknameError("");
                              
                              if (value.trim().length > 0 && value.trim().length < 3) {
                                setNicknameError("Минимум 3 символа");
                              } else if (value.length > 20) {
                                setNicknameError("Максимум 20 символов");
                              }
                            }}
                            minLength={3}
                            maxLength={20}
                            data-testid="input-nickname"
                            className={nicknameError ? "border-destructive" : ""}
                          />
                          {nicknameError && (
                            <p className="text-xs text-destructive mt-1">{nicknameError}</p>
                          )}
                        </div>
                        <Button 
                          onClick={() => {
                            const trimmed = nickname.trim();
                            if (trimmed.length < 3) {
                              setNicknameError("Никнейм должен содержать минимум 3 символа");
                              return;
                            }
                            if (trimmed.length > 20) {
                              setNicknameError("Никнейм не должен превышать 20 символов");
                              return;
                            }
                            if (trimmed === user?.nickname) {
                              toast({
                                title: "Информация",
                                description: "Никнейм не изменился",
                              });
                              return;
                            }
                            updateProfileMutation.mutate({ nickname: trimmed });
                          }}
                          disabled={updateProfileMutation.isPending || !nickname.trim() || nicknameError.length > 0}
                          data-testid="button-save-nickname"
                        >
                          {updateProfileMutation.isPending ? "Сохранение..." : "Сохранить"}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Никнейм должен содержать от 3 до 20 символов
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <AccountSecurity />

                <Telegram2FASettings user={user} />
              </div>
            )}
          </div>
        </main>
      </div>

      <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пополнить баланс</DialogTitle>
            <DialogDescription>
              Введите сумму для пополнения основного баланса. Это демо-версия для тестирования.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              placeholder="Сумма в рублях"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleDeposit();
                }
              }}
              data-testid="input-deposit-amount"
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDepositDialogOpen(false)}
              data-testid="button-cancel-deposit"
            >
              Отмена
            </Button>
            <Button 
              onClick={handleDeposit}
              disabled={depositMutation.isPending}
              data-testid="button-confirm-deposit"
            >
              {depositMutation.isPending ? "Пополнение..." : "Пополнить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TariffsTab({ user }: { user: User | undefined }) {
  const { toast } = useToast();
  const [promoCode, setPromoCode] = useState("");
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  
  const { data: tariffs = [], isLoading } = useQuery<Tariff[]>({
    queryKey: ["/api/tariffs"],
    enabled: !!user,
  });
  
  const purchaseMutation = useMutation({
    mutationFn: async ({ tariffId, promoCode }: { tariffId: number; promoCode?: string }) => {
      return apiRequest("POST", "/api/subscription/purchase", { tariffId, promoCode });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Подписка активирована",
        description: response.message || "Подписка успешно активирована",
      });
      setPurchaseDialogOpen(false);
      setPromoCode("");
      setSelectedTariff(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось приобрести подписку",
        variant: "destructive",
      });
    },
  });

  const handlePurchase = (tariff: Tariff) => {
    if (!user) return;
    
    if (user.main_balance < tariff.price) {
      toast({
        title: "Недостаточно средств",
        description: "Пополните баланс для покупки подписки",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedTariff(tariff);
    setPurchaseDialogOpen(true);
  };

  const confirmPurchase = () => {
    if (!selectedTariff) return;
    purchaseMutation.mutate({ 
      tariffId: selectedTariff.id, 
      promoCode: promoCode.trim() || undefined 
    });
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Загрузка тарифов...</div>
      </div>
    );
  }
  
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Доступные тарифы</CardTitle>
          <CardDescription>
            Выберите подходящий тариф для активации VPN
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-2">
            Ваш баланс: <span className="font-bold text-foreground">{user?.main_balance || 0}₽</span>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid md:grid-cols-3 gap-6">
        {tariffs.map((tariff, index) => (
          <Card key={tariff.id} className={index === 1 ? "border-primary" : ""} data-testid={`card-tariff-${tariff.id}`}>
            {index === 1 && (
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-bl-md rounded-tr-md">
                Популярный
              </div>
            )}
            <CardHeader>
              <CardTitle>{tariff.name}</CardTitle>
              <CardDescription>
                {tariff.days} {tariff.days === 30 ? "дней" : tariff.days === 90 ? "дней" : "дней"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-4xl font-bold" data-testid={`text-price-${tariff.id}`}>{tariff.price}₽</span>
                <span className="text-muted-foreground">
                  {tariff.days === 30 ? "/мес" : tariff.days === 90 ? "/3мес" : "/год"}
                </span>
              </div>
              
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                  <span>{tariff.gb} ГБ трафика</span>
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
              
              <Button 
                className="w-full"
                onClick={() => handlePurchase(tariff)}
                disabled={purchaseMutation.isPending || !user || user.main_balance < tariff.price}
                data-testid={`button-purchase-${tariff.id}`}
              >
                {purchaseMutation.isPending ? "Обработка..." : 
                 !user || user.main_balance < tariff.price ? "Недостаточно средств" : 
                 "Купить"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent data-testid="dialog-purchase-confirm">
          <DialogHeader>
            <DialogTitle>Подтверждение покупки</DialogTitle>
            <DialogDescription>
              {selectedTariff && `Вы покупаете тариф "${selectedTariff.name}" за ${selectedTariff.price}₽`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Промокод (необязательно)
              </label>
              <Input
                placeholder="Введите промокод"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                data-testid="input-promo-code"
              />
            </div>
            {selectedTariff && (
              <div className="text-sm text-muted-foreground">
                <p>Ваш баланс: {user?.main_balance || 0}₽</p>
                <p>Стоимость: {selectedTariff.price}₽</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setPurchaseDialogOpen(false)}
              disabled={purchaseMutation.isPending}
              data-testid="button-cancel-purchase"
            >
              Отмена
            </Button>
            <Button 
              onClick={confirmPurchase}
              disabled={purchaseMutation.isPending}
              data-testid="button-confirm-purchase"
            >
              {purchaseMutation.isPending ? "Обработка..." : "Подтвердить покупку"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SupportTab({ user }: { user: User | undefined }) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support-tickets"],
    enabled: !!user,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<SupportMessage[]>({
    queryKey: ["/api/support-tickets", selectedTicket?.id, "messages"],
    enabled: !!selectedTicket,
  });

  const createTicketMutation = useMutation<SupportTicket, Error, { subject: string }>({
    mutationFn: async (data: { subject: string }) => {
      const response = await apiRequest("POST", "/api/support-tickets", data);
      return response.json();
    },
    onSuccess: (newTicket) => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-tickets"] });
      
      if (initialMessage.trim()) {
        sendMessageMutation.mutate({
          ticketId: newTicket.id,
          message: initialMessage.trim(),
        });
      }
      
      toast({
        title: "Тикет создан",
        description: "Ваш запрос в поддержку отправлен. Мы ответим в ближайшее время.",
      });
      setCreateDialogOpen(false);
      setSubject("");
      setInitialMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать тикет",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: number; message: string }) => {
      return apiRequest("POST", `/api/support-tickets/${ticketId}/messages`, { message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-tickets", selectedTicket?.id, "messages"] });
      setNewMessage("");
      toast({
        title: "Успех",
        description: "Сообщение отправлено",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить сообщение",
        variant: "destructive",
      });
    },
  });

  const handleCreateTicket = () => {
    if (!subject.trim()) {
      toast({
        title: "Ошибка",
        description: "Заполните тему тикета",
        variant: "destructive",
      });
      return;
    }
    createTicketMutation.mutate({ subject: subject.trim() });
  };

  const handleOpenChat = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setChatDialogOpen(true);
  };

  const handleSendMessage = () => {
    if (!selectedTicket || !newMessage.trim()) return;
    sendMessageMutation.mutate({
      ticketId: selectedTicket.id,
      message: newMessage.trim(),
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="default">Открыт</Badge>;
      case "in_progress":
        return <Badge variant="secondary">В работе</Badge>;
      case "closed":
        return <Badge variant="outline">Закрыт</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">Высокий</Badge>;
      case "medium":
        return <Badge variant="secondary">Средний</Badge>;
      case "low":
        return <Badge variant="outline">Низкий</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Загрузка тикетов...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Тикеты поддержки</CardTitle>
              <CardDescription>Создавайте запросы и общайтесь с поддержкой</CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-ticket">
                <Send className="mr-2 h-4 w-4" />
                Создать тикет
              </Button>
              <DialogContent data-testid="dialog-create-ticket">
                <DialogHeader>
                  <DialogTitle>Создать запрос в поддержку</DialogTitle>
                  <DialogDescription>
                    Опишите вашу проблему или вопрос
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Тема</label>
                    <Input
                      placeholder="Краткое описание проблемы"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      data-testid="input-ticket-subject"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Первое сообщение (необязательно)</label>
                    <Textarea
                      placeholder="Подробное описание вашего вопроса или проблемы"
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      rows={5}
                      data-testid="textarea-ticket-message"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setCreateDialogOpen(false)}
                    disabled={createTicketMutation.isPending}
                    data-testid="button-cancel-ticket"
                  >
                    Отмена
                  </Button>
                  <Button 
                    onClick={handleCreateTicket}
                    disabled={createTicketMutation.isPending}
                    data-testid="button-submit-ticket"
                  >
                    {createTicketMutation.isPending ? "Отправка..." : "Отправить"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              У вас пока нет тикетов
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <Card key={ticket.id} data-testid={`ticket-${ticket.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <MessageSquare className="h-5 w-5" />
                          {ticket.subject}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Создан: {new Date(ticket.created_at).toLocaleString('ru-RU')}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.priority)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      size="sm"
                      onClick={() => handleOpenChat(ticket)}
                      data-testid={`button-open-chat-${ticket.id}`}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Открыть чат
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={chatDialogOpen} onOpenChange={setChatDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" data-testid="dialog-user-chat">
          <DialogHeader>
            <DialogTitle>
              {selectedTicket && `Тикет #${selectedTicket.id}: ${selectedTicket.subject}`}
            </DialogTitle>
            <DialogDescription>
              {selectedTicket && `Статус: ${selectedTicket.status === 'open' ? 'Открыт' : selectedTicket.status === 'in_progress' ? 'В работе' : 'Закрыт'}`}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 h-[400px] border rounded-md p-4" data-testid="user-chat-messages">
            {messagesLoading ? (
              <div className="text-center text-muted-foreground">Загрузка сообщений...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground">Нет сообщений. Начните диалог!</div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.is_admin === 1 ? 'justify-start' : 'justify-end'}`}
                    data-testid={`user-message-${msg.id}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.is_admin === 1
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="text-xs opacity-70 mb-1">
                        {msg.is_admin === 1 ? 'Поддержка' : 'Вы'} •{' '}
                        {new Date(msg.created_at).toLocaleString('ru-RU')}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{msg.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {selectedTicket?.status !== 'closed' && (
            <div className="flex gap-2 pt-4">
              <Textarea
                placeholder="Введите ваше сообщение..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={3}
                data-testid="textarea-user-message"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={sendMessageMutation.isPending || !newMessage.trim()}
                data-testid="button-send-user-message"
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
