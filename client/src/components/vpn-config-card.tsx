import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Copy, QrCode as QrCodeIcon, Check, FileText, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { VpnProfile } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface VpnConfigCardProps {
  profile: VpnProfile;
  deviceNumber: number;
}

export function VpnConfigCard({ profile, deviceNumber }: VpnConfigCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deleteDeviceMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/vpn/profiles/${profile.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/profiles"] });
      toast({
        title: "Устройство удалено",
        description: "Ключ подключения был успешно удален",
      });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить устройство",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Скопировано",
      description: "Конфигурация скопирована в буфер обмена",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <CardTitle className="text-lg">Устройство #{deviceNumber}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {new Date(profile.created_at).toLocaleDateString('ru-RU')}
            </Badge>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  data-testid={`button-delete-device-${profile.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Удалить устройство?
                  </DialogTitle>
                  <DialogDescription>
                    Это действие нельзя отменить. Ключ подключения будет удален и больше не будет работать на этом устройстве.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-2 justify-end mt-4">
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => deleteDeviceMutation.mutate()}
                    disabled={deleteDeviceMutation.isPending}
                    data-testid={`button-confirm-delete-${profile.id}`}
                  >
                    {deleteDeviceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Удалить
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <CardDescription>
          VPN конфигурация для подключения
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted p-3 rounded border border-border overflow-x-auto font-mono">
            {profile.config_link}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(profile.config_link)}
            data-testid={`button-copy-config-${profile.id}`}
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1" data-testid={`button-show-qr-${profile.id}`}>
                <QrCodeIcon className="mr-2 h-4 w-4" />
                QR код
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>QR код для подключения</DialogTitle>
                <DialogDescription>
                  Отсканируйте код в приложении v2rayNG, v2raytun или других VPN клиентах
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center p-6">
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeSVG
                    value={profile.config_link}
                    size={256}
                    level="M"
                    includeMargin={true}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => copyToClipboard(profile.config_link)}
              >
                <Copy className="mr-2 h-4 w-4" />
                Скопировать ключ
              </Button>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1" data-testid={`button-show-instructions-${profile.id}`}>
                <FileText className="mr-2 h-4 w-4" />
                Инструкции
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Инструкции по подключению</DialogTitle>
                <DialogDescription>
                  Выберите вашу платформу и следуйте инструкциям
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="v2raytun" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="v2raytun">v2raytun</TabsTrigger>
                  <TabsTrigger value="v2rayng">v2rayNG</TabsTrigger>
                  <TabsTrigger value="other">Другие</TabsTrigger>
                </TabsList>
                
                <TabsContent value="v2raytun" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold">Подключение через v2raytun</h4>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Метод 1: QR код</p>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                        <li>Скачайте и установите v2raytun из App Store (iOS) или Google Play (Android)</li>
                        <li>Откройте приложение v2raytun</li>
                        <li>Нажмите кнопку "+" или "Добавить сервер"</li>
                        <li>Выберите "Сканировать QR код"</li>
                        <li>Отсканируйте QR код выше</li>
                        <li>Нажмите "Подключиться" или переключите тумблер включения VPN</li>
                      </ol>
                    </div>

                    <div className="space-y-2 mt-4">
                      <p className="text-sm font-medium">Метод 2: Ручная вставка ключа</p>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                        <li>Откройте приложение v2raytun</li>
                        <li>Нажмите кнопку "+" или "Добавить сервер"</li>
                        <li>Выберите "Импорт из буфера обмена" или "Вставить конфигурацию"</li>
                        <li>Скопируйте ключ конфигурации (кнопка "Скопировать" выше)</li>
                        <li>Вставьте скопированный ключ в приложение</li>
                        <li>Нажмите "Добавить" или "Сохранить"</li>
                        <li>Нажмите "Подключиться"</li>
                      </ol>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-4">
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        <strong>Совет:</strong> Убедитесь, что в настройках приложения включен режим "Глобальный" или "VPN", а не "Прокси"
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="v2rayng" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold">Подключение через v2rayNG (Android)</h4>
                    
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                      <li>Скачайте и установите v2rayNG из Google Play</li>
                      <li>Откройте приложение</li>
                      <li>Нажмите кнопку "+" в правом верхнем углу</li>
                      <li>Выберите "Импорт конфигурации из QR кода" или "Импорт из буфера обмена"</li>
                      <li>Для QR кода: отсканируйте QR код выше</li>
                      <li>Для буфера обмена: скопируйте ключ и выберите импорт из буфера</li>
                      <li>Выберите добавленный сервер</li>
                      <li>Нажмите кнопку "V" в правом нижнем углу для подключения</li>
                    </ol>
                  </div>
                </TabsContent>

                <TabsContent value="other" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold">Другие клиенты</h4>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Поддерживаемые клиенты:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li><strong>Windows:</strong> v2rayN, Clash for Windows</li>
                        <li><strong>macOS:</strong> V2RayX, Clash for macOS, Qv2ray</li>
                        <li><strong>iOS:</strong> Shadowrocket, Quantumult X, v2raytun</li>
                        <li><strong>Android:</strong> v2rayNG, Clash for Android, v2raytun</li>
                      </ul>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <p className="text-sm font-medium">Общие шаги:</p>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li>Установите один из поддерживаемых клиентов</li>
                        <li>Скопируйте ключ конфигурации или отсканируйте QR код</li>
                        <li>Импортируйте конфигурацию в клиент</li>
                        <li>Подключитесь к серверу</li>
                      </ol>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
