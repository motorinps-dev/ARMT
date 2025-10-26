import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Shield, Loader2, RotateCw } from "lucide-react";
import { useLocation } from "wouter";

export function Verify2FA() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState("");

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      return apiRequest("POST", "/api/telegram/verify-2fa", { code });
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Вход выполнен",
      });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Неверный код",
        variant: "destructive",
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/telegram/send-code", {});
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Новый код отправлен в Telegram",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить код",
        variant: "destructive",
      });
    },
  });

  const handleVerify = () => {
    if (!code.trim() || code.length !== 6) {
      toast({
        title: "Ошибка",
        description: "Введите 6-значный код",
        variant: "destructive",
      });
      return;
    }
    verifyMutation.mutate(code.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle>Двухфакторная аутентификация</CardTitle>
          <CardDescription>
            Введите код из Telegram для завершения входа
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="2fa-code">Код из Telegram</Label>
            <Input
              id="2fa-code"
              type="text"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleVerify();
                }
              }}
              maxLength={6}
              data-testid="input-2fa-code"
              className="text-center text-2xl tracking-wider"
            />
            <p className="text-xs text-muted-foreground text-center">
              Код был отправлен в ваш Telegram
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleVerify}
            disabled={verifyMutation.isPending || code.length !== 6}
            data-testid="button-verify-2fa"
          >
            {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Подтвердить
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => resendMutation.mutate()}
            disabled={resendMutation.isPending}
            data-testid="button-resend-code"
          >
            {resendMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <RotateCw className="mr-2 h-4 w-4" />
                Отправить новый код
              </>
            )}
          </Button>

          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setLocation("/login")}
              data-testid="button-back-to-login"
            >
              Вернуться к входу
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
