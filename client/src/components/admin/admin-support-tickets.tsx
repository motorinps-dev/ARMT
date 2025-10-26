import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SupportTicket } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AdminSupportTickets() {
  const { toast } = useToast();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [adminReply, setAdminReply] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/admin/support-tickets"],
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SupportTicket> }) => {
      return apiRequest("PATCH", `/api/admin/support-tickets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-tickets"] });
      toast({
        title: "Успех",
        description: "Тикет обновлен",
      });
      setReplyDialogOpen(false);
      setSelectedTicket(null);
      setAdminReply("");
      setNewStatus("");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить тикет",
        variant: "destructive",
      });
    },
  });

  const handleReplyToTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setAdminReply(ticket.admin_reply || "");
    setNewStatus(ticket.status);
    setReplyDialogOpen(true);
  };

  const handleSaveReply = () => {
    if (!selectedTicket) return;

    const updateData: Partial<SupportTicket> = {
      admin_reply: adminReply.trim() || null,
      status: newStatus as any,
    };

    updateTicketMutation.mutate({
      id: selectedTicket.id,
      data: updateData,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return (
          <Badge variant="default" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Открыт
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            В работе
          </Badge>
        );
      case "closed":
        return (
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Закрыт
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">Высокий</Badge>;
      case "medium":
        return <Badge variant="secondary">Средний</Badge>;
      case "low":
        return <Badge variant="outline">Низкий</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Загрузка...</div>;
  }

  const openTickets = tickets.filter(t => t.status === "open");
  const inProgressTickets = tickets.filter(t => t.status === "in_progress");
  const closedTickets = tickets.filter(t => t.status === "closed");

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Открытые
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openTickets.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              В работе
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{inProgressTickets.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Закрытые
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{closedTickets.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Тикеты поддержки</CardTitle>
          <CardDescription>Управление запросами пользователей</CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет тикетов
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <Card key={ticket.id} data-testid={`admin-ticket-${ticket.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <MessageSquare className="h-5 w-5" />
                          {ticket.subject}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Пользователь ID: {ticket.user_id} • Создан: {new Date(ticket.created_at).toLocaleString('ru-RU')}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.priority)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm font-medium mb-1">Сообщение пользователя:</div>
                      <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                        {ticket.message}
                      </div>
                    </div>
                    {ticket.admin_reply && (
                      <div>
                        <div className="text-sm font-medium mb-1 text-primary">Ваш ответ:</div>
                        <div className="text-sm bg-primary/10 p-3 rounded-md">
                          {ticket.admin_reply}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleReplyToTicket(ticket)}
                        data-testid={`button-reply-ticket-${ticket.id}`}
                      >
                        {ticket.admin_reply ? "Редактировать ответ" : "Ответить"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent data-testid="dialog-admin-reply">
          <DialogHeader>
            <DialogTitle>Ответить на тикет</DialogTitle>
            <DialogDescription>
              {selectedTicket && `Тикет #${selectedTicket.id}: ${selectedTicket.subject}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Статус</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid="select-ticket-status">
                  <SelectValue placeholder="Выберите статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Открыт</SelectItem>
                  <SelectItem value="in_progress">В работе</SelectItem>
                  <SelectItem value="closed">Закрыт</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Ответ</label>
              <Textarea
                placeholder="Введите ответ пользователю"
                value={adminReply}
                onChange={(e) => setAdminReply(e.target.value)}
                rows={5}
                data-testid="textarea-admin-reply"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReplyDialogOpen(false)}
              disabled={updateTicketMutation.isPending}
              data-testid="button-cancel-reply"
            >
              Отмена
            </Button>
            <Button
              onClick={handleSaveReply}
              disabled={updateTicketMutation.isPending}
              data-testid="button-save-reply"
            >
              {updateTicketMutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
