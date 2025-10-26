import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Clock, CheckCircle, AlertCircle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SupportTicket, SupportMessage } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AdminSupportTickets() {
  const { toast } = useToast();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/admin/support-tickets"],
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<SupportMessage[]>({
    queryKey: ["/api/support-tickets", selectedTicket?.id, "messages"],
    enabled: !!selectedTicket,
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SupportTicket> }) => {
      return apiRequest("PATCH", `/api/admin/support-tickets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-tickets"] });
      toast({
        title: "Успех",
        description: "Статус тикета обновлен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить тикет",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: number; message: string }) => {
      return apiRequest("POST", `/api/support-tickets/${ticketId}/messages`, { message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-tickets", selectedTicket?.id, "messages"] });
      setNewMessage("");
      toast({
        title: "Успех",
        description: "Сообщение отправлено",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить сообщение",
        variant: "destructive",
      });
    },
  });

  const handleOpenChat = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status);
    setChatDialogOpen(true);
  };

  const handleSendMessage = () => {
    if (!selectedTicket || !newMessage.trim()) return;
    sendMessageMutation.mutate({
      ticketId: selectedTicket.id,
      message: newMessage.trim(),
    });
  };

  const handleUpdateStatus = () => {
    if (!selectedTicket) return;
    updateTicketMutation.mutate({
      id: selectedTicket.id,
      data: { status: newStatus as any },
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
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleOpenChat(ticket)}
                        data-testid={`button-chat-ticket-${ticket.id}`}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Открыть чат
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={chatDialogOpen} onOpenChange={setChatDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" data-testid="dialog-admin-chat">
          <DialogHeader>
            <DialogTitle>
              {selectedTicket && `Тикет #${selectedTicket.id}: ${selectedTicket.subject}`}
            </DialogTitle>
            <DialogDescription>
              Чат с пользователем ID: {selectedTicket?.user_id}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center gap-4 py-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Статус:</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="w-[180px]" data-testid="select-ticket-status">
                  <SelectValue placeholder="Выберите статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Открыт</SelectItem>
                  <SelectItem value="in_progress">В работе</SelectItem>
                  <SelectItem value="closed">Закрыт</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleUpdateStatus}
              disabled={updateTicketMutation.isPending}
              data-testid="button-update-status"
            >
              Обновить статус
            </Button>
          </div>

          <ScrollArea className="flex-1 h-[400px] border rounded-md p-4" data-testid="chat-messages">
            {messagesLoading ? (
              <div className="text-center text-muted-foreground">Загрузка сообщений...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground">Нет сообщений</div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.is_admin === 1 ? 'justify-end' : 'justify-start'}`}
                    data-testid={`message-${msg.id}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.is_admin === 1
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="text-xs opacity-70 mb-1">
                        {msg.is_admin === 1 ? 'Администратор' : 'Пользователь'} •{' '}
                        {new Date(msg.created_at).toLocaleString('ru-RU')}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{msg.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex gap-2 pt-4">
            <Textarea
              placeholder="Введите ваше сообщение..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
              data-testid="textarea-admin-message"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={sendMessageMutation.isPending || !newMessage.trim()}
              data-testid="button-send-message"
              className="self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
