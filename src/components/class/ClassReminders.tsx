import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { Notification } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Calendar,
  BellRing,
  BellOff,
  Search
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ClassReminders({ classId, teacherId }: { classId: string, teacherId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  const fetchData = async () => {
    try {
      const qN = query(
        collection(db, 'notifications'), 
        where('teacherId', '==', teacherId),
        where('classId', '==', classId)
      );

      const snapN = await getDocs(qN);
      setNotifications(snapN.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    } catch (error) {
       handleFirestoreError(error, OperationType.LIST, 'class_reminders');
    }
  };

  useEffect(() => {
    fetchData();
  }, [classId, teacherId]);

  const handleCreate = async () => {
    if (!formData.title) return toast.error('El título es obligatorio');
    try {
      await addDoc(collection(db, 'notifications'), {
        ...formData,
        teacherId,
        classId,
        target: 'teacher', // Always teacher
        date: new Date(formData.date),
        sent: false,
        read: false,
        notify: true,
        createdAt: serverTimestamp()
      });
      toast.success('Recordatorio guardado');
      setIsOpen(false);
      setFormData({ title: '', content: '', date: format(new Date(), 'yyyy-MM-dd') });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'notifications', deleteId));
      toast.success('Eliminado');
      setNotifications(prev => prev.filter(n => n.id !== deleteId));
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${deleteId}`);
    }
  };

  const markAsDone = async (id: string, currentSent: boolean) => {
    try {
        await updateDoc(doc(db, 'notifications', id), { sent: !currentSent });
        fetchData();
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  }

  const filteredNotifications = notifications.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl bg-white/40 backdrop-blur-md border-white shadow-xl overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/20 border-b border-white/40 py-4 sm:py-6 px-4 sm:px-8 gap-4">
          <div className="flex-1">
            <CardTitle className="font-display font-bold text-xl sm:text-2xl text-slate-900">Mis Recordatorios</CardTitle>
            <div className="relative mt-3 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Buscar nota..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-white/50 border-white/40 rounded-xl focus:bg-white transition-all text-sm"
              />
            </div>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger 
              nativeButton={true}
              render={
                <Button className="rounded-xl px-6 bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100">
                  <Plus className="w-4 h-4 mr-2" /> Nueva Nota
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader><DialogTitle className="font-display font-bold text-2xl">Añadir Recordatorio</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>¿Qué quieres recordar?</Label>
                  <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ej: Corregir exámenes, Traer material..." className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Detalles adicionales (opcional)</Label>
                  <Textarea value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="Más información..." className="rounded-xl min-h-[100px]" />
                </div>
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="rounded-xl" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} className="w-full rounded-xl py-6 font-bold">Guardar Recordatorio</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotifications.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No hay recordatorios registrados para esta clase</p>
              </div>
            ) : filteredNotifications
                .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                .map(notif => (
                  <Card key={notif.id} className={`rounded-xl border-slate-100 shadow-sm transition-all hover:shadow-md ${notif.sent ? 'bg-slate-50 opacity-60' : 'bg-white'}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <h4 className={`font-bold text-sm ${notif.sent ? 'line-through text-slate-400' : 'text-slate-800'}`}>{notif.title}</h4>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">{notif.content}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => markAsDone(notif.id, notif.sent || false)} 
                            className={`h-7 w-7 rounded-lg ${notif.sent ? 'text-emerald-500 bg-emerald-50' : 'text-slate-300'}`}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeleteId(notif.id)} 
                            className="h-7 w-7 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                        <Calendar className="w-3 h-3 text-indigo-400" />
                        <span>{notif.date instanceof Timestamp ? format(notif.date.toDate(), 'PPP', { locale: es }) : notif.date}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>¿Eliminar recordatorio?</DialogTitle></DialogHeader>
          <div className="py-4 text-sm text-slate-500">¿Estás seguro de que quieres eliminar esta nota?</div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
