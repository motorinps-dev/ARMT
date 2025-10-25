import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Percent, Hash } from "lucide-react";
import type { Promocode } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminPromocodes() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: promocodes = [], isLoading } = useQuery<Promocode[]>({
    queryKey: ["/api/admin/promocodes"],
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
              <CardTitle>Промокоды</CardTitle>
              <CardDescription>Создание и управление промокодами</CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-promocode">
                  <Plus className="mr-2 h-4 w-4" />
                  Создать промокод
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Новый промокод</DialogTitle>
                  <DialogDescription>
                    Создайте промокод для скидки
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Код промокода</Label>
                    <Input placeholder="SUMMER2025" data-testid="input-promo-code" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Скидка (%)</Label>
                      <Input type="number" placeholder="20" min="1" max="100" data-testid="input-discount" />
                    </div>
                    <div className="space-y-2">
                      <Label>Максимум использований</Label>
                      <Input type="number" placeholder="100" data-testid="input-max-uses" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" data-testid="button-save-promocode">
                      Создать промокод
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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {promocodes.length === 0 ? (
          <Card className="md:col-span-3">
            <CardContent className="py-12 text-center text-muted-foreground">
              Нет созданных промокодов
            </CardContent>
          </Card>
        ) : (
          promocodes.map((promo) => (
            <Card key={promo.code} className="hover-elevate transition-all" data-testid={`promo-card-${promo.code}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-mono">{promo.code}</CardTitle>
                    <CardDescription>Промокод на скидку</CardDescription>
                  </div>
                  {promo.is_active === 1 ? (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                      Активен
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Неактивен</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-md">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Percent className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">{promo.discount_percent}%</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Скидка</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-md">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">{promo.uses_count}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Использований</div>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Лимит использований</span>
                    <span className="font-medium">{promo.uses_count} / {promo.max_uses}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, (promo.uses_count / promo.max_uses) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <Button size="sm" variant="outline" className="flex-1" data-testid={`button-edit-promo-${promo.code}`}>
                    Редактировать
                  </Button>
                  <Button size="sm" variant="outline" data-testid={`button-toggle-promo-${promo.code}`}>
                    {promo.is_active === 1 ? "Деактивировать" : "Активировать"}
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
