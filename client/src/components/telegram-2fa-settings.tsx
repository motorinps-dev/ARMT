import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, Link as LinkIcon, Loader2 } from "lucide-react";
import type { User } from "@shared/schema";

interface Telegram2FASettingsProps {
  user: User | undefined;
}

export function Telegram2FASettings({ user }: Telegram2FASettingsProps) {
  const { toast } = useToast();
  const [linkCode, setLinkCode] = useState("");

  const linkMutation = useMutation({
    mutationFn: async (linkCode: string) => {
      return apiRequest("POST", "/api/telegram/link", { linkCode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
      toast({
        title: "Успешно",
        description: "Аккаунт успешно связан с Telegram",
      });
      setLinkCode("");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось связать аккаунт",
        variant: "destructive",
      });
    },
  });

  const enable2FAMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/telegram/enable-2fa", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
      toast({
        title: "Успешно",
        description: "Двухфакторная аутентификация включена",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось включить 2FA",
        variant: "destructive",
      });
    },
  });

  const disable2FAMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/telegram/disable-2fa", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
      toast({
        title: "Успешно",
        description: "Двухфакторная аутентификация отключена",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отключить 2FA",
        variant: "destructive",
      });
    },
  });

  const handleLink = () => {
    if (!linkCode.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите код связывания",
        variant: "destructive",
      });
      return;
    }
    linkMutation.mutate(linkCode.trim());
  };

  const isLinked = !!user?.telegram_id;
  const is2FAEnabled = user?.telegram_2fa_enabled === 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            <CardTitle>Связывание с Telegram</CardTitle>
          </div>
          <CardDescription>
            Свяжите аккаунт с Telegram для использования двухфакторной аутентификации
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLinked ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                  Связан
                </Badge>
                {user.telegram_username && (
                  <span className="text-sm text-muted-foreground">
                    @{user.telegram_username}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Ваш аккаунт успешно связан с Telegram
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="link-code">Код связывания</Label>
                <div className="flex gap-2">
                  <Input
                    id="link-code"
                    placeholder="Введите код из бота"
                    value={linkCode}
                    onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    data-testid="input-telegram-link-code"
                  />
                  <Button
                    onClick={handleLink}
                    disabled={linkMutation.isPending}
                    data-testid="button-link-telegram"
                  >
                    {linkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Связать
                  </Button>
                </div>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Как получить код:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Откройте Telegram и найдите бот ARMT VPN</li>
                  <li>Отправьте команду /link</li>
                  <li>Скопируйте полученный код</li>
                  <li>Вставьте код в поле выше</li>
                </ol>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Двухфакторная аутентификация</CardTitle>
          </div>
          <CardDescription>
            Защитите свой аккаунт с помощью кодов из Telegram
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Статус 2FA</p>
              <p className="text-sm text-muted-foreground">
                {is2FAEnabled ? "Включена" : "Отключена"}
              </p>
            </div>
            <Badge variant={is2FAEnabled ? "default" : "secondary"}>
              {is2FAEnabled ? "Включена" : "Отключена"}
            </Badge>
          </div>

          {!isLinked && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Сначала свяжите аккаунт с Telegram для использования 2FA
              </p>
            </div>
          )}

          {isLinked && (
            <div className="space-y-3">
              {is2FAEnabled ? (
                <Button
                  variant="destructive"
                  onClick={() => disable2FAMutation.mutate()}
                  disabled={disable2FAMutation.isPending}
                  data-testid="button-disable-2fa"
                >
                  {disable2FAMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Отключить 2FA
                </Button>
              ) : (
                <Button
                  onClick={() => enable2FAMutation.mutate()}
                  disabled={enable2FAMutation.isPending}
                  data-testid="button-enable-2fa"
                >
                  {enable2FAMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Включить 2FA
                </Button>
              )}

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Как работает 2FA:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>При входе вам будет отправлен код в Telegram</li>
                  <li>Введите этот код для завершения входа</li>
                  <li>Код действителен 5 минут</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
