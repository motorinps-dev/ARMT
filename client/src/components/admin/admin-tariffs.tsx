import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Database, Loader2 } from "lucide-react";
import type { Tariff, InsertTariff } from "@shared/schema";
import { insertTariffSchema } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function AdminTariffs() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const { toast } = useToast();

  const { data: tariffs = [], isLoading } = useQuery<Tariff[]>({
    queryKey: ["/api/admin/tariffs"],
  });

  const form = useForm<InsertTariff>({
    resolver: zodResolver(insertTariffSchema),
    defaultValues: {
      key: "",
      name: "",
      price: 0,
      days: 30,
      gb: 1000,
      is_active: 1,
    },
  });

  const editForm = useForm<InsertTariff>({
    resolver: zodResolver(insertTariffSchema),
    defaultValues: {
      key: "",
      name: "",
      price: 0,
      days: 30,
      gb: 1000,
      is_active: 1,
    },
  });

  const createTariffMutation = useMutation({
    mutationFn: async (data: InsertTariff) => {
      return await apiRequest("POST", "/api/admin/tariffs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs"] });
      toast({
        title: "Успех",
        description: "Тариф успешно создан",
      });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать тариф",
        variant: "destructive",
      });
    },
  });

  const updateTariffMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertTariff> }) => {
      return await apiRequest("PATCH", `/api/admin/tariffs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs"] });
      toast({
        title: "Успех",
        description: "Тариф успешно обновлен",
      });
      setIsEditDialogOpen(false);
      setEditingTariff(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить тариф",
        variant: "destructive",
      });
    },
  });

  const toggleTariffMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: number }) => {
      return await apiRequest("PATCH", `/api/admin/tariffs/${id}`, { is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs"] });
      toast({
        title: "Успех",
        description: "Статус тарифа изменен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось изменить статус тарифа",
        variant: "destructive",
      });
    },
  });

  const handleEditTariff = (tariff: Tariff) => {
    setEditingTariff(tariff);
    editForm.reset({
      key: tariff.key,
      name: tariff.name,
      price: tariff.price,
      days: tariff.days,
      gb: tariff.gb,
      is_active: tariff.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const handleToggleTariff = (tariff: Tariff) => {
    toggleTariffMutation.mutate({
      id: tariff.id,
      is_active: tariff.is_active === 1 ? 0 : 1,
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
              <CardTitle>Тарифные планы</CardTitle>
              <CardDescription>Управление тарифами подписок</CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-tariff">
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить тариф
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Создать новый тариф</DialogTitle>
                  <DialogDescription>
                    Укажите параметры тарифного плана
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => createTariffMutation.mutate(data))} className="space-y-4 py-4">
                    <FormField
                      control={form.control}
                      name="key"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ключ (уникальный идентификатор)</FormLabel>
                          <FormControl>
                            <Input placeholder="6_months" data-testid="input-tariff-key" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Название</FormLabel>
                          <FormControl>
                            <Input placeholder="6 Месяцев" data-testid="input-tariff-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Цена (₽)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="500" data-testid="input-tariff-price" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="days"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Количество дней</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="186" data-testid="input-tariff-days" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="gb"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Трафик (ГБ)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="6000" data-testid="input-tariff-gb" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1" disabled={createTariffMutation.isPending} data-testid="button-save-tariff">
                        {createTariffMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Создать тариф
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

      <div className="grid md:grid-cols-3 gap-6">
        {tariffs.length === 0 ? (
          <Card className="md:col-span-3">
            <CardContent className="py-12 text-center text-muted-foreground">
              Нет созданных тарифов
            </CardContent>
          </Card>
        ) : (
          tariffs.map((tariff) => (
            <Card key={tariff.id} className="hover-elevate transition-all" data-testid={`tariff-card-${tariff.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{tariff.name}</CardTitle>
                    <CardDescription className="font-mono text-xs">{tariff.key}</CardDescription>
                  </div>
                  {tariff.is_active === 1 ? (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                      Активен
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Неактивен</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-4 border-y border-border">
                  <div className="text-3xl font-bold">{tariff.price}₽</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {tariff.days} дней
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{tariff.days} дней подписки</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{tariff.gb} ГБ трафика</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1" 
                    onClick={() => handleEditTariff(tariff)}
                    data-testid={`button-edit-tariff-${tariff.id}`}
                  >
                    Редактировать
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleToggleTariff(tariff)}
                    disabled={toggleTariffMutation.isPending}
                    data-testid={`button-toggle-tariff-${tariff.id}`}
                  >
                    {tariff.is_active === 1 ? "Деактивировать" : "Активировать"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать тариф</DialogTitle>
            <DialogDescription>
              Изменить параметры тарифного плана
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => {
              if (editingTariff) {
                updateTariffMutation.mutate({ id: editingTariff.id, data });
              }
            })} className="space-y-4 py-4">
              <FormField
                control={editForm.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ключ (уникальный идентификатор)</FormLabel>
                    <FormControl>
                      <Input placeholder="6_months" data-testid="input-edit-tariff-key" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название</FormLabel>
                    <FormControl>
                      <Input placeholder="6 Месяцев" data-testid="input-edit-tariff-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Цена (₽)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="500" data-testid="input-edit-tariff-price" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Количество дней</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="186" data-testid="input-edit-tariff-days" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="gb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Трафик (ГБ)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="6000" data-testid="input-edit-tariff-gb" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={updateTariffMutation.isPending} data-testid="button-update-tariff">
                  {updateTariffMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
