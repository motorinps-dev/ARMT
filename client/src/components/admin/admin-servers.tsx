import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Server as ServerIcon, Globe } from "lucide-react";
import type { Server } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminServers() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: servers = [], isLoading } = useQuery<Server[]>({
    queryKey: ["/api/admin/servers"],
  });

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Серверы 3X-UI</CardTitle>
              <CardDescription>Управление VPN серверами</CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-server">
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить сервер
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Добавить новый сервер</DialogTitle>
                  <DialogDescription>
                    Заполните данные для подключения к панели 3X-UI
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Название сервера</Label>
                      <Input placeholder="Сервер 1" data-testid="input-server-name" />
                    </div>
                    <div className="space-y-2">
                      <Label>URL панели</Label>
                      <Input placeholder="https://panel.example.com" data-testid="input-panel-url" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Имя пользователя</Label>
                      <Input placeholder="admin" data-testid="input-panel-username" />
                    </div>
                    <div className="space-y-2">
                      <Label>Пароль</Label>
                      <Input type="password" placeholder="••••••••" data-testid="input-panel-password" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>VLESS адрес</Label>
                      <Input placeholder="example.com" data-testid="input-vless-address" />
                    </div>
                    <div className="space-y-2">
                      <Label>VLESS порт</Label>
                      <Input type="number" placeholder="443" data-testid="input-vless-port" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Inbound ID</Label>
                      <Input type="number" placeholder="1" data-testid="input-inbound-id" />
                    </div>
                    <div className="space-y-2">
                      <Label>SNI</Label>
                      <Input placeholder="example.com" data-testid="input-sni" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Flow</Label>
                      <Input placeholder="xtls-rprx-vision" data-testid="input-flow" />
                    </div>
                    <div className="space-y-2">
                      <Label>Public Key</Label>
                      <Input placeholder="public_key" data-testid="input-public-key" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Short ID</Label>
                    <Input placeholder="short_id" data-testid="input-short-id" />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" data-testid="button-save-server">
                      Сохранить сервер
                    </Button>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Отмена
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {servers.length === 0 ? (
          <Card className="md:col-span-2">
            <CardContent className="py-12 text-center text-muted-foreground">
              Нет добавленных серверов
            </CardContent>
          </Card>
        ) : (
          servers.map((server) => (
            <Card key={server.id} className="hover-elevate transition-all" data-testid={`server-card-${server.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ServerIcon className="h-5 w-5 text-primary" />
                      {server.name}
                    </CardTitle>
                    <CardDescription>ID: {server.id}</CardDescription>
                  </div>
                  {server.is_active === 1 ? (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                      Активен
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Неактивен</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{server.vless_address}:{server.vless_port}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Panel: {server.panel_url}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Inbound ID</div>
                    <div className="font-mono font-semibold">{server.vless_inbound_id}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Flow</div>
                    <div className="font-mono text-xs">{server.vless_flow}</div>
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <Button size="sm" variant="outline" data-testid={`button-edit-server-${server.id}`}>
                    Редактировать
                  </Button>
                  <Button size="sm" variant="outline" data-testid={`button-test-server-${server.id}`}>
                    Тест подключения
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
