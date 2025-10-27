import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Server as ServerIcon, Globe, Loader2 } from "lucide-react";
import type { Server, InsertServer } from "@shared/schema";
import { insertServerSchema } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function AdminServers() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const { toast } = useToast();

  const { data: servers = [], isLoading } = useQuery<Server[]>({
    queryKey: ["/api/admin/servers"],
  });

  const form = useForm<InsertServer>({
    resolver: zodResolver(insertServerSchema),
    defaultValues: {
      name: "",
      panel_url: "",
      panel_username: "",
      panel_password: "",
      vless_address: "",
      vless_port: 443,
      vless_inbound_id: 1,
      vless_sni: "",
      vless_flow: "xtls-rprx-vision",
      vless_public_key: "",
      vless_short_id: "",
      is_active: 1,
    },
  });

  const editForm = useForm<InsertServer>({
    resolver: zodResolver(insertServerSchema),
    defaultValues: {
      name: "",
      panel_url: "",
      panel_username: "",
      panel_password: "",
      vless_address: "",
      vless_port: 443,
      vless_inbound_id: 1,
      vless_sni: "",
      vless_flow: "xtls-rprx-vision",
      vless_public_key: "",
      vless_short_id: "",
      is_active: 1,
    },
  });

  const createServerMutation = useMutation({
    mutationFn: async (data: InsertServer) => {
      return await apiRequest("POST", "/api/admin/servers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/servers"] });
      toast({
        title: "Успех",
        description: "Сервер успешно добавлен",
      });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить сервер",
        variant: "destructive",
      });
    },
  });

  const updateServerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertServer> }) => {
      return await apiRequest("PATCH", `/api/admin/servers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/servers"] });
      toast({
        title: "Успех",
        description: "Сервер успешно обновлен",
      });
      setIsEditDialogOpen(false);
      setEditingServer(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить сервер",
        variant: "destructive",
      });
    },
  });

  const toggleServerMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: number }) => {
      return await apiRequest("PATCH", `/api/admin/servers/${id}`, { is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/servers"] });
      toast({
        title: "Успех",
        description: "Статус сервера изменен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось изменить статус сервера",
        variant: "destructive",
      });
    },
  });

  const handleEditServer = (server: Server) => {
    setEditingServer(server);
    editForm.reset({
      name: server.name,
      panel_url: server.panel_url,
      panel_username: server.panel_username,
      panel_password: server.panel_password,
      vless_address: server.vless_address,
      vless_port: server.vless_port,
      vless_inbound_id: server.vless_inbound_id,
      vless_sni: server.vless_sni,
      vless_flow: server.vless_flow,
      vless_public_key: server.vless_public_key,
      vless_short_id: server.vless_short_id,
      is_active: server.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const handleToggleServer = (server: Server) => {
    toggleServerMutation.mutate({
      id: server.id,
      is_active: server.is_active === 1 ? 0 : 1,
    });
  };

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
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => createServerMutation.mutate(data))} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Название сервера</FormLabel>
                            <FormControl>
                              <Input placeholder="Сервер 1" data-testid="input-server-name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="panel_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL панели</FormLabel>
                            <FormControl>
                              <Input placeholder="https://panel.example.com" data-testid="input-panel-url" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="panel_username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Имя пользователя</FormLabel>
                            <FormControl>
                              <Input placeholder="admin" data-testid="input-panel-username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="panel_password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Пароль</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" data-testid="input-panel-password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="vless_address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VLESS адрес</FormLabel>
                            <FormControl>
                              <Input placeholder="example.com" data-testid="input-vless-address" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="vless_port"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VLESS порт</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="443" data-testid="input-vless-port" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="vless_inbound_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Inbound ID</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="1" data-testid="input-inbound-id" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="vless_sni"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SNI</FormLabel>
                            <FormControl>
                              <Input placeholder="example.com" data-testid="input-sni" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="vless_flow"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Flow</FormLabel>
                            <FormControl>
                              <Input placeholder="xtls-rprx-vision" data-testid="input-flow" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="vless_public_key"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Public Key</FormLabel>
                            <FormControl>
                              <Input placeholder="public_key" data-testid="input-public-key" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="vless_short_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Short ID</FormLabel>
                          <FormControl>
                            <Input placeholder="short_id" data-testid="input-short-id" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1" disabled={createServerMutation.isPending} data-testid="button-save-server">
                        {createServerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Сохранить сервер
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Отмена
                      </Button>
                    </div>
                  </form>
                </Form>
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
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => handleEditServer(server)}
                    data-testid={`button-edit-server-${server.id}`}
                  >
                    Редактировать
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleToggleServer(server)}
                    disabled={toggleServerMutation.isPending}
                    data-testid={`button-toggle-server-${server.id}`}
                  >
                    {server.is_active === 1 ? "Деактивировать" : "Активировать"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактировать сервер</DialogTitle>
            <DialogDescription>
              Изменить данные для подключения к панели 3X-UI
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => {
              if (editingServer) {
                updateServerMutation.mutate({ id: editingServer.id, data });
              }
            })} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название сервера</FormLabel>
                      <FormControl>
                        <Input placeholder="Сервер 1" data-testid="input-edit-server-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="panel_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL панели</FormLabel>
                      <FormControl>
                        <Input placeholder="https://panel.example.com" data-testid="input-edit-panel-url" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="panel_username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Имя пользователя</FormLabel>
                      <FormControl>
                        <Input placeholder="admin" data-testid="input-edit-panel-username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="panel_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Пароль</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" data-testid="input-edit-panel-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="vless_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VLESS адрес</FormLabel>
                      <FormControl>
                        <Input placeholder="example.com" data-testid="input-edit-vless-address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="vless_port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VLESS порт</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="443" data-testid="input-edit-vless-port" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="vless_inbound_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inbound ID</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="1" data-testid="input-edit-inbound-id" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="vless_sni"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SNI</FormLabel>
                      <FormControl>
                        <Input placeholder="example.com" data-testid="input-edit-sni" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="vless_flow"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Flow</FormLabel>
                      <FormControl>
                        <Input placeholder="xtls-rprx-vision" data-testid="input-edit-flow" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="vless_public_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Public Key</FormLabel>
                      <FormControl>
                        <Input placeholder="public_key" data-testid="input-edit-public-key" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="vless_short_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short ID</FormLabel>
                    <FormControl>
                      <Input placeholder="short_id" data-testid="input-edit-short-id" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={updateServerMutation.isPending} data-testid="button-update-server">
                  {updateServerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Сохранить изменения
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Отмена
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
