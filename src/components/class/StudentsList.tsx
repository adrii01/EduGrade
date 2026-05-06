import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Student } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Plus, Trash2, UserPlus, Mail, Pencil, Fingerprint, Phone, MapPin, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentsList({ classId, teacherId }: { classId: string, teacherId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    lastName: '',
    dni: '',
    email: '', 
    parentEmail: '',
    phone: '',
    address: ''
  });

  const fetchStudents = async () => {
    try {
      const q = query(
        collection(db, 'students'), 
        where('classId', '==', classId),
        where('teacherId', '==', teacherId)
      );
      const snap = await getDocs(q);
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    } catch (error) {
       handleFirestoreError(error, OperationType.LIST, 'students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [classId, teacherId]);

  const filteredStudents = students.filter(s => 
    `${s.name} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!formData.name || !formData.lastName) return toast.error('El nombre y apellidos son obligatorios');
    try {
      const data = {
        ...formData,
        classId,
        teacherId,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'students', editingId), data);
        toast.success('Alumno actualizado');
      } else {
        await addDoc(collection(db, 'students'), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast.success('Alumno añadido');
      }

      setFormData({ name: '', lastName: '', dni: '', email: '', parentEmail: '', phone: '', address: '' });
      setEditingId(null);
      setIsOpen(false);
      fetchStudents();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'students');
    }
  };

  const handleEdit = (student: Student) => {
    setEditingId(student.id);
    setFormData({
      name: student.name,
      lastName: student.lastName || '',
      dni: student.dni || '',
      email: student.email || '',
      parentEmail: student.parentEmail || '',
      phone: student.phone || '',
      address: student.address || ''
    });
    setIsOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'students', deleteId));
      toast.success('Alumno eliminado');
      setDeleteId(null);
      fetchStudents();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${deleteId}`);
    }
  };

  return (
    <Card className="rounded-2xl bg-white/40 backdrop-blur-md border-white shadow-xl overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/20 border-b border-white/40 py-4 sm:py-6 px-4 sm:px-8 gap-4">
        <div className="flex-1">
          <CardTitle className="font-display font-bold text-xl sm:text-2xl text-slate-900">Listado de Alumnos</CardTitle>
          <div className="relative mt-3 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Buscar alumno..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-white/50 border-white/40 rounded-xl focus:bg-white transition-all text-sm"
            />
          </div>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setEditingId(null);
            setFormData({ name: '', lastName: '', dni: '', email: '', parentEmail: '', phone: '', address: '' });
          }
        }}>
          <DialogTrigger 
            nativeButton={true}
            render={
              <Button 
                size="sm" 
                className="w-full sm:w-auto rounded-xl bg-indigo-600 shadow-lg shadow-indigo-200"
                onClick={() => {
                  setEditingId(null);
                  setFormData({ name: '', lastName: '', dni: '', email: '', parentEmail: '', phone: '', address: '' });
                }}
              />
            }
          >
            <UserPlus className="w-4 h-4 mr-2" /> Añadir Alumno
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>{editingId ? 'Editar Alumno' : 'Nuevo Alumno'}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Juan" />
              </div>
              <div className="space-y-2">
                <Label>Apellidos</Label>
                <Input value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} placeholder="Ej: Pérez García" />
              </div>
              <div className="space-y-2">
                <Label>DNI / NIE</Label>
                <Input value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} placeholder="12345678X" />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="600 000 000" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Email Alumno (opcional)</Label>
                <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="estudiante@ejemplo.com" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Email Tutor/Padre (notificaciones)</Label>
                <Input value={formData.parentEmail} onChange={e => setFormData({...formData, parentEmail: e.target.value})} placeholder="tutor@ejemplo.com" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Dirección</Label>
                <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Calle Falsa 123" />
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit}>{editingId ? 'Actualizar' : 'Guardar'} Alumno</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="px-4 sm:px-8 py-3 sm:py-4 font-bold text-slate-700 sticky left-0 bg-slate-50 z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Alumno</TableHead>
                <TableHead className="font-bold text-slate-700">DNI</TableHead>
                <TableHead className="font-bold text-slate-700">Teléfono</TableHead>
                <TableHead className="font-bold text-slate-700">Email Alumno</TableHead>
                <TableHead className="font-bold text-slate-700">Tutor/Padre</TableHead>
                <TableHead className="font-bold text-slate-700">Dirección</TableHead>
                <TableHead className="text-right px-4 sm:px-8">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-slate-400">No hay alumnos aún</TableCell>
                </TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400 italic">
                    No se encontraron alumnos que coincidan con la búsqueda.
                  </TableCell>
                </TableRow>
              ) : filteredStudents.map(student => (
                <TableRow key={student.id} className="hover:bg-slate-50/30 transition-colors">
                  <TableCell className="px-4 sm:px-8 py-3 sm:py-4 font-semibold text-sm sm:text-base border-l-4 border-transparent hover:border-indigo-400 transition-all sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-slate-50">
                    {student.lastName}, {student.name}
                  </TableCell>
                  <TableCell className="text-slate-500 font-mono text-[10px] sm:text-xs">{student.dni || '-'}</TableCell>
                  <TableCell className="text-slate-500 font-mono text-[10px] sm:text-xs">{student.phone || '-'}</TableCell>
                  <TableCell className="text-slate-500 font-mono text-[10px] sm:text-xs">{student.email || '-'}</TableCell>
                  <TableCell className="text-slate-500 font-mono text-[10px] sm:text-xs">{student.parentEmail || '-'}</TableCell>
                  <TableCell className="text-slate-500 font-mono text-[10px] sm:text-xs">
                    <div className="max-w-[150px] truncate" title={student.address}>
                      {student.address || '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-4 sm:px-8">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(student);
                        }} 
                        className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(student.id);
                        }} 
                        className="h-8 w-8 p-0 text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>¿Confirmar eliminación?</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-slate-500">
            ¿Estás seguro de que quieres eliminar a este alumno? Esta acción no se puede deshacer.
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
