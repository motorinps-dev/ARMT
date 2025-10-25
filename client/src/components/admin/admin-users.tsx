import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Mail, Calendar, Wallet } from "lucide-react";
import { useState } from "react";
import type { User } from "@shared/schema";

export function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.telegram_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(user.id).includes(searchQuery)
  );

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Поиск пользователей</CardTitle>
          <CardDescription>Найдите пользователя по email, Telegram или ID</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-users"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Пользователи не найдены
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((user) => (
            <Card key={user.id} className="hover-elevate transition-all" data-testid={`user-card-${user.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {user.email || `Пользователь #${user.id}`}
                      {user.is_admin === 1 && (
                        <Badge variant="destructive" className="text-xs">Админ</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>ID: {user.id}</CardDescription>
                  </div>
                  <div className="text-right space-y-1">
                    {user.subscription_type ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        Активна
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Неактивна</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  {user.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground truncate">{user.email}</span>
                    </div>
                  )}
                  {user.telegram_username && (
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.67-.52.36-.99.53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.37-.48 1.03-.73 4.04-1.76 6.73-2.92 8.08-3.49 3.85-1.61 4.65-1.89 5.17-1.9.11 0 .37.03.54.17.14.11.18.26.2.37-.01.06.01.24 0 .38z"/>
                      </svg>
                      <span className="text-muted-foreground">@{user.telegram_username}</span>
                    </div>
                  )}
                  {user.created_at && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-3 gap-4 pt-3 border-t border-border">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Основной баланс</div>
                    <div className="font-semibold" data-testid={`user-${user.id}-main-balance`}>
                      {user.main_balance || 0}₽
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Реферальный баланс</div>
                    <div className="font-semibold" data-testid={`user-${user.id}-ref-balance`}>
                      {user.referral_balance || 0}₽
                    </div>
                  </div>
                  {user.expires_at && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Истекает</div>
                      <div className="font-semibold">
                        {new Date(user.expires_at).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-3">
                  <Button size="sm" variant="outline" data-testid={`button-edit-user-${user.id}`}>
                    Редактировать
                  </Button>
                  <Button size="sm" variant="outline" data-testid={`button-message-user-${user.id}`}>
                    Отправить сообщение
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
