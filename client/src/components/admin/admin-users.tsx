import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Mail, Calendar, Wallet, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { User } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const editUserSchema = z.object({
  main_balance: z.coerce.number().min(0),
  referral_balance: z.coerce.number().min(0),
  is_admin: z.coerce.number().min(0).max(1),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

export function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      main_balance: 0,
      referral_balance: 0,
      is_admin: 0,
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<EditUserFormData> }) => {
      return await apiRequest("PATCH", `/api/admin/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Успех",
        description: "Пользователь успешно обновлен",
      });
      setIsEditDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить пользователя",
        variant: "destructive",
      });
    },
  });

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    editForm.reset({
      main_balance: user.main_balance || 0,
      referral_balance: user.referral_balance || 0,
      is_admin: user.is_admin,
    });
    setIsEditDialogOpen(true);
  };

  const handleSendMessage = (user: User) => {
    if (user.telegram_id) {
      toast({
        title: "Отправка сообщения",
        description: `Отправка сообщения пользователю ${user.email}...`,
      });
    } else {
      toast({
        title: "Ошибка",
        description: "У пользователя не привязан Telegram",
        variant: "destructive",
      });
    }
  };

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
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleEditUser(user)}
                    data-testid={`button-edit-user-${user.id}`}
                  >
                    Редактировать
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleSendMessage(user)}
                    data-testid={`button-message-user-${user.id}`}
                  >
                    Отправить сообщение
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
            <DialogTitle>Редактировать пользователя</DialogTitle>
            <DialogDescription>
              Изменить балансы и права пользователя
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => {
              if (editingUser) {
                updateUserMutation.mutate({ id: editingUser.id, data });
              }
            })} className="space-y-4 py-4">
              <FormField
                control={editForm.control}
                name="main_balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Основной баланс (₽)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        data-testid="input-edit-main-balance" 
                        {...field} 
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="referral_balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Реферальный баланс (₽)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        data-testid="input-edit-ref-balance" 
                        {...field} 
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="is_admin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Права администратора</FormLabel>
                    <FormControl>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                        value={field.value}
                        data-testid="select-is-admin"
                      >
                        <option value="0">Обычный пользователь</option>
                        <option value="1">Администратор</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={updateUserMutation.isPending} data-testid="button-save-user">
                  {updateUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
