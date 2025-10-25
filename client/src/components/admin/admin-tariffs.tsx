import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Database } from "lucide-react";
import type { Tariff } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminTariffs() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: tariffs = [], isLoading } = useQuery<Tariff[]>({
    queryKey: ["/api/admin/tariffs"],
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
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Ключ (уникальный идентификатор)</Label>
                    <Input placeholder="6_months" data-testid="input-tariff-key" />
                  </div>
                  <div className="space-y-2">
                    <Label>Название</Label>
                    <Input placeholder="6 Месяцев" data-testid="input-tariff-name" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Цена (₽)</Label>
                      <Input type="number" placeholder="500" data-testid="input-tariff-price" />
                    </div>
                    <div className="space-y-2">
                      <Label>Количество дней</Label>
                      <Input type="number" placeholder="186" data-testid="input-tariff-days" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Трафик (ГБ)</Label>
                    <Input type="number" placeholder="6000" data-testid="input-tariff-gb" />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" data-testid="button-save-tariff">
                      Создать тариф
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
                  <Button size="sm" variant="outline" className="flex-1" data-testid={`button-edit-tariff-${tariff.id}`}>
                    Редактировать
                  </Button>
                  <Button size="sm" variant="outline" data-testid={`button-toggle-tariff-${tariff.id}`}>
                    {tariff.is_active === 1 ? "Деактивировать" : "Активировать"}
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
