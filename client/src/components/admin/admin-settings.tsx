import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, Bot, Loader2, Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SITE_MODES, BOT_MODES } from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AdminSettings() {
  const { toast } = useToast();
  const [siteMode, setSiteMode] = useState<string>("");
  const [profilesPerPurchase, setProfilesPerPurchase] = useState<string>("5");
  const [botSettings, setBotSettings] = useState<Record<string, string>>({});

  const { data: siteSettings, isLoading: siteLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/settings"],
  });

  const { data: botSettingsData, isLoading: botLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/bot-settings"],
  });

  useEffect(() => {
    if (siteSettings) {
      setSiteMode(siteSettings.site_mode || "demo");
      setProfilesPerPurchase(siteSettings.profiles_per_purchase || "5");
    }
  }, [siteSettings]);

  useEffect(() => {
    if (botSettingsData) {
      setBotSettings(botSettingsData);
    }
  }, [botSettingsData]);

  const updateSiteSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return await apiRequest("PUT", "/api/admin/settings", { key, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: "Успех",
        description: "Настройка успешно обновлена",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить настройку",
        variant: "destructive",
      });
    },
  });

  const updateBotSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return await apiRequest("PUT", "/api/admin/bot-settings", { key, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-settings"] });
      toast({
        title: "Успех",
        description: "Настройка бота успешно обновлена",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить настройку бота",
        variant: "destructive",
      });
    },
  });

  const handleSaveSiteMode = () => {
    updateSiteSettingMutation.mutate({ key: "site_mode", value: siteMode });
  };

  const handleSaveProfilesPerPurchase = () => {
    updateSiteSettingMutation.mutate({ key: "profiles_per_purchase", value: profilesPerPurchase });
  };

  const handleSaveBotSetting = (key: string, value: string) => {
    updateBotSettingMutation.mutate({ key, value });
  };

  const handleBotSettingChange = (key: string, value: string) => {
    setBotSettings(prev => ({ ...prev, [key]: value }));
  };

  if (siteLoading || botLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="heading-admin-settings">Настройки системы</h2>
        <p className="text-muted-foreground">
          Управление режимами работы сайта и настройками Telegram бота
        </p>
      </div>

      <Tabs defaultValue="site" className="space-y-4">
        <TabsList>
          <TabsTrigger value="site" data-testid="tab-site-settings">
            <SettingsIcon className="h-4 w-4 mr-2" />
            Настройки сайта
          </TabsTrigger>
          <TabsTrigger value="bot" data-testid="tab-bot-settings">
            <Bot className="h-4 w-4 mr-2" />
            Настройки бота
          </TabsTrigger>
        </TabsList>

        <TabsContent value="site" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Режим работы сайта</CardTitle>
              <CardDescription>
                Выберите режим работы платформы
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Demo:</strong> пополнение баланса без реальных платежей<br />
                  <strong>Maintenance:</strong> сайт недоступен для пользователей<br />
                  <strong>Production:</strong> рабочий режим с реальными платежами
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="site-mode">Текущий режим</Label>
                <Select value={siteMode} onValueChange={setSiteMode}>
                  <SelectTrigger id="site-mode" data-testid="select-site-mode">
                    <SelectValue placeholder="Выберите режим" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SITE_MODES.DEMO}>Demo (Демонстрационный)</SelectItem>
                    <SelectItem value={SITE_MODES.MAINTENANCE}>Maintenance (Технические работы)</SelectItem>
                    <SelectItem value={SITE_MODES.PRODUCTION}>Production (Рабочий)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleSaveSiteMode}
                disabled={updateSiteSettingMutation.isPending}
                data-testid="button-save-site-mode"
              >
                {updateSiteSettingMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Сохранить режим
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>VPN профили</CardTitle>
              <CardDescription>
                Настройка количества профилей при покупке
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profiles-per-purchase">Количество профилей на покупку</Label>
                <Input
                  id="profiles-per-purchase"
                  type="number"
                  min="1"
                  max="10"
                  value={profilesPerPurchase}
                  onChange={(e) => setProfilesPerPurchase(e.target.value)}
                  data-testid="input-profiles-per-purchase"
                />
              </div>

              <Button 
                onClick={handleSaveProfilesPerPurchase}
                disabled={updateSiteSettingMutation.isPending}
                data-testid="button-save-profiles"
              >
                {updateSiteSettingMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Сохранить
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bot" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Режим работы бота</CardTitle>
              <CardDescription>
                Управление состоянием Telegram бота
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bot-mode">Режим бота</Label>
                <Select 
                  value={botSettings.bot_mode || "active"} 
                  onValueChange={(value) => handleBotSettingChange("bot_mode", value)}
                >
                  <SelectTrigger id="bot-mode" data-testid="select-bot-mode">
                    <SelectValue placeholder="Выберите режим" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={BOT_MODES.ACTIVE}>Активен</SelectItem>
                    <SelectItem value={BOT_MODES.DISABLED}>Отключен</SelectItem>
                    <SelectItem value={BOT_MODES.MAINTENANCE}>Технические работы</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={() => handleSaveBotSetting("bot_mode", botSettings.bot_mode || "active")}
                disabled={updateBotSettingMutation.isPending}
                data-testid="button-save-bot-mode"
              >
                {updateBotSettingMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Сохранить режим бота
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Токены и авторизация</CardTitle>
              <CardDescription>
                Настройка токенов для Telegram бота
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bot-token">Telegram Bot Token</Label>
                <Input
                  id="bot-token"
                  type="password"
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  value={botSettings.bot_token || ""}
                  onChange={(e) => handleBotSettingChange("bot_token", e.target.value)}
                  data-testid="input-bot-token"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-ids">Admin IDs (через запятую)</Label>
                <Input
                  id="admin-ids"
                  placeholder="123456789,987654321"
                  value={botSettings.admin_ids || ""}
                  onChange={(e) => handleBotSettingChange("admin_ids", e.target.value)}
                  data-testid="input-admin-ids"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="group-id">Group ID для поддержки</Label>
                <Input
                  id="group-id"
                  placeholder="-1001234567890"
                  value={botSettings.group_id || ""}
                  onChange={(e) => handleBotSettingChange("group_id", e.target.value)}
                  data-testid="input-group-id"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="crypto-bot-token">CryptoBot Token</Label>
                <Input
                  id="crypto-bot-token"
                  type="password"
                  placeholder="1234:AABBCCDDEEFFGGHHIIJJKKLLMMNNOOPPQQRRSSTTu"
                  value={botSettings.crypto_bot_token || ""}
                  onChange={(e) => handleBotSettingChange("crypto_bot_token", e.target.value)}
                  data-testid="input-crypto-bot-token"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  placeholder="https://yourdomain.com/api/telegram/webhook"
                  value={botSettings.webhook_url || ""}
                  onChange={(e) => handleBotSettingChange("webhook_url", e.target.value)}
                  data-testid="input-webhook-url"
                />
              </div>

              <Button 
                onClick={() => {
                  handleSaveBotSetting("bot_token", botSettings.bot_token || "");
                  handleSaveBotSetting("admin_ids", botSettings.admin_ids || "");
                  handleSaveBotSetting("group_id", botSettings.group_id || "");
                  handleSaveBotSetting("crypto_bot_token", botSettings.crypto_bot_token || "");
                  handleSaveBotSetting("webhook_url", botSettings.webhook_url || "");
                }}
                disabled={updateBotSettingMutation.isPending}
                data-testid="button-save-bot-tokens"
              >
                {updateBotSettingMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Сохранить токены
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Параметры бота</CardTitle>
              <CardDescription>
                Настройка лимитов и параметров работы бота
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="min-rub-deposit">Минимальный депозит (RUB)</Label>
                <Input
                  id="min-rub-deposit"
                  type="number"
                  min="1"
                  value={botSettings.min_rub_deposit || "130"}
                  onChange={(e) => handleBotSettingChange("min_rub_deposit", e.target.value)}
                  data-testid="input-min-rub-deposit"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="referral-bonus">Процент реферального бонуса</Label>
                <Input
                  id="referral-bonus"
                  type="number"
                  min="0"
                  max="100"
                  value={botSettings.referral_bonus_percent || "10"}
                  onChange={(e) => handleBotSettingChange("referral_bonus_percent", e.target.value)}
                  data-testid="input-referral-bonus"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trial-days">Пробный период (дни)</Label>
                <Input
                  id="trial-days"
                  type="number"
                  min="0"
                  value={botSettings.trial_days || "1"}
                  onChange={(e) => handleBotSettingChange("trial_days", e.target.value)}
                  data-testid="input-trial-days"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trial-gb">Лимит трафика в пробном периоде (GB)</Label>
                <Input
                  id="trial-gb"
                  type="number"
                  min="0"
                  value={botSettings.trial_gb || "1"}
                  onChange={(e) => handleBotSettingChange("trial_gb", e.target.value)}
                  data-testid="input-trial-gb"
                />
              </div>

              <Button 
                onClick={() => {
                  handleSaveBotSetting("min_rub_deposit", botSettings.min_rub_deposit || "130");
                  handleSaveBotSetting("referral_bonus_percent", botSettings.referral_bonus_percent || "10");
                  handleSaveBotSetting("trial_days", botSettings.trial_days || "1");
                  handleSaveBotSetting("trial_gb", botSettings.trial_gb || "1");
                }}
                disabled={updateBotSettingMutation.isPending}
                data-testid="button-save-bot-params"
              >
                {updateBotSettingMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Сохранить параметры
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
