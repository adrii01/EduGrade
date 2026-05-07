import { useEffect, useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { Notification, Class, Student } from '@/src/types';
import Navbar from '@/src/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Users, 
  Calendar,
  MessageSquareQuote,
  BellRing,
  BellOff
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'motion/react';

export default function Reminders() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [classFilter, setClassFilter] = useState<string>('all');
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    classId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  const fetchData = async () => {
    if (!user) return;
    try {
      const qN = query(collection(db, 'notifications'), where('teacherId', '==', user.uid));
      const qC = query(collection(db, 'classes'), where('teacherId', '==', user.uid));

      const [snapN, snapC] = await Promise.all([getDocs(qN), getDocs(qC)]);

      setNotifications(snapN.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
      setClasses(snapC.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    } catch (error) {
       handleFirestoreError(error, OperationType.LIST, 'reminders_data');
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleCreate = async () => {
    if (!user || !formData.title || !formData.classId) return toast.error('Rellena los campos obligatorios');
    try {
      await addDoc(collection(db, 'notifications'), {
        ...formData,
        teacherId: user.uid,
        target: 'teacher',
        date: new Date(formData.date),
        sent: false,
        read: false,
        notify: true,
        createdAt: serverTimestamp()
      });
      toast.success('Recordatorio creado');
      setIsOpen(false);
      setFormData({ title: '', content: '', classId: '', date: format(new Date(), 'yyyy-MM-dd') });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'notifications', deleteId));
      toast.success('Notificación eliminada');
      setNotifications(prev => prev.filter(n => n.id !== deleteId));
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${deleteId}`);
    }
  };

  const markAsSent = async (id: string) => {
    try {
        await updateDoc(doc(db, 'notifications', id), { sent: true });
        toast.success('Marcada como completada/enviada', {
          duration: 10000,
          action: { label: 'Cerrar', onClick: () => {} }
        });
        fetchData();
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      toast.success('Recordatorio archivado', {
        duration: 10000,
        action: { label: 'Cerrar', onClick: () => {} }
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-6 mb-10 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-end gap-6 w-full md:w-auto">
            <div className="w-full md:w-auto">
              <p className="text-sm text-primary font-semibold uppercase tracking-wider">Centro de Avisos</p>
              <h1 className="text-3xl md:text-4xl font-display font-bold font-black text-foreground tracking-tight">Recordatorios</h1>
            </div>
            
            <div className="flex items-center gap-2 bg-card/40 p-1 rounded-xl border border-border/60">
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-[180px] bg-transparent border-none focus:ring-0 h-9 font-medium text-xs">
                    <SelectValue placeholder="Clase: Todas" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover/90 backdrop-blur-lg">
                    <SelectItem value="all">Todas las clases</SelectItem>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
            </div>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger 
              nativeButton={true}
              render={
                <Button className="rounded-xl px-6 bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/10">
                  <Plus className="w-4 h-4 mr-2" /> Nuevo Aviso
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[425px] bg-card/80 backdrop-blur-xl border-border/20 rounded-3xl">
              <DialogHeader><DialogTitle className="font-display font-bold text-2xl">Crear Notificación</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Título del recordatorio</Label>
                  <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ej: Corregir exámenes de 1ºA..." className="bg-card/50 border-border/40 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Comentarios (opcional)</Label>
                  <Textarea value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="Detalles de la tarea..." className="bg-card/50 border-border/40 rounded-xl min-h-[100px]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Clase asociada</Label>
                        <Select value={formData.classId} onValueChange={(v: any) => setFormData({...formData, classId: v})}>
                            <SelectTrigger className="bg-card/50 border-border/40 rounded-xl"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                            <SelectContent className="bg-card/90 backdrop-blur-lg border-border/20">
                                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Fecha límite</Label>
                        <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="bg-card/50 border-border/40 rounded-xl" />
                    </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} className="w-full rounded-xl py-6 font-bold shadow-lg shadow-primary/10">Guardar Nota Personal</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {notifications.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-card/40 backdrop-blur-md rounded-3xl border border-border shadow-xl">
                    <Bell className="w-12 h-12 text-indigo-300/50 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">No tienes recordatorios pendientes.</p>
                </div>
            ) : notifications
                .filter(n => classFilter === 'all' || n.classId === classFilter)
                .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                .map(notif => {
                  const className = classes.find(c => c.id === notif.classId)?.name || 'Sin clase';
                  return (
                    <Card key={notif.id} className={`rounded-2xl bg-card/40 backdrop-blur-md border-border shadow-xl overflow-hidden group transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:bg-card/50 ${notif.sent ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                    <CardHeader className={`flex flex-row items-start justify-between pb-2 bg-card/20 ${notif.read ? 'opacity-40' : ''}`}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl border bg-primary/10 text-primary border-indigo-500/20`}>
                                {notif.notify ? <BellRing className="w-4 h-4 animate-pulse" /> : <BellOff className="w-4 h-4" />}
                            </div>
                            <CardTitle className="font-display font-bold text-xl text-foreground flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  {notif.title}
                                  {notif.read && <Badge variant="outline" className="text-[9px]">Archivado</Badge>}
                                </div>
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-sans">
                                  Clase: {className}
                                </span>
                            </CardTitle>
                        </div>
                        <div className="flex items-center gap-1">
                            {!notif.read && (
                                <Button variant="ghost" size="icon" onClick={() => handleMarkAsRead(notif.id)} className="text-blue-500 hover:bg-blue-50 rounded-lg" title="Archivar">
                                    <BellOff className="w-4 h-4" />
                                </Button>
                            )}
                            {!notif.sent && (
                                <Button variant="ghost" size="icon" onClick={() => markAsSent(notif.id)} className="text-emerald-500 hover:bg-emerald-50 rounded-lg">
                                    <CheckCircle className="w-4 h-4" />
                                </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteId(notif.id);
                              }} 
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all rounded-lg"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        <p className="text-slate-600 text-sm font-medium leading-relaxed">{notif.content}</p>
                        <div className="flex flex-wrap gap-4 pt-4 border-t border-border/40 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                            <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{notif.date instanceof Timestamp ? format(notif.date.toDate(), 'PPP', { locale: es }) : notif.date}</span>
                            </div>
                        </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </main>
        <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>¿Eliminar recordatorio?</DialogTitle>
            </DialogHeader>
            <div className="py-4 text-sm text-muted-foreground">
              Esta acción eliminará el recordatorio permanentemente.
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
