import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
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
import { Plus, Trash2, UserPlus, Mail, Pencil, Fingerprint, Phone, MapPin, Search, HelpCircle, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';

import { useTutorial } from '@/src/lib/useTutorial';

export default function StudentsList({ classId, teacherId }: { classId: string, teacherId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const { showTutorial, closeTutorial, openTutorial: setShowTutorial } = useTutorial('students');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    lastName: '',
    dni: '',
    email: '', 
    parentName: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'students'), 
      where('classId', '==', classId),
      where('teacherId', '==', teacherId)
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const fetchedStudents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      // Sort alphabetically by last name, then name
      fetchedStudents.sort((a, b) => {
        const lastNameA = (a.lastName || '').toLowerCase();
        const lastNameB = (b.lastName || '').toLowerCase();
        if (lastNameA !== lastNameB) return lastNameA.localeCompare(lastNameB);
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
      setStudents(fetchedStudents);
      setLoading(false);
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, 'students');
       setLoading(false);
    });

    return () => unsubscribe();
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

      setFormData({ name: '', lastName: '', dni: '', email: '', parentName: '', phone: '', address: '' });
      setEditingId(null);
      setIsOpen(false);
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
      parentName: student.parentName || '',
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
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${deleteId}`);
    }
  };

  return (
    <Card className="rounded-2xl bg-card/40 backdrop-blur-md border-border shadow-xl overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card/20 border-b border-border/40 py-4 sm:py-6 px-4 sm:px-8 gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <CardTitle className="font-display font-bold text-xl sm:text-2xl text-foreground">Listado de Alumnos</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
              onClick={() => setShowTutorial(true)}
            >
              <HelpCircle className="w-5 h-5" />
            </Button>
          </div>
          <div className="relative mt-3 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar alumno..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-card/50 border-border/40 rounded-xl focus:bg-card transition-all text-sm"
            />
          </div>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setEditingId(null);
            setFormData({ name: '', lastName: '', dni: '', email: '', parentName: '', phone: '', address: '' });
          }
        }}>
          <DialogTrigger 
            nativeButton={true}
            render={
              <Button 
                size="sm" 
                className="w-full sm:w-auto rounded-xl bg-primary shadow-lg shadow-primary/20"
                onClick={() => {
                  setEditingId(null);
                  setFormData({ name: '', lastName: '', dni: '', email: '', parentName: '', phone: '', address: '' });
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
                <Label>Nombre del Tutor / Tutores legales</Label>
                <Input value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} placeholder="Ej: Maria García y Juan Pérez" />
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
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-4 sm:px-8 py-3 sm:py-4 font-bold text-foreground sticky left-0 bg-muted z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Alumno</TableHead>
                <TableHead className="font-bold text-foreground">DNI</TableHead>
                <TableHead className="font-bold text-foreground">Teléfono</TableHead>
                <TableHead className="font-bold text-foreground">Email Alumno</TableHead>
                <TableHead className="font-bold text-foreground">Tutor/es Legales</TableHead>
                <TableHead className="font-bold text-foreground">Dirección</TableHead>
                <TableHead className="text-right px-4 sm:px-8">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">No hay alumnos aún</TableCell>
                </TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground italic">
                    No se encontraron alumnos que coincidan con la búsqueda.
                  </TableCell>
                </TableRow>
              ) : filteredStudents.map((student, index) => (
                <motion.tr 
                  key={student.id} 
                  className="hover:bg-muted/30 transition-colors border-b border-border/50"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                >
                  <TableCell className="px-4 sm:px-8 py-3 sm:py-4 font-semibold text-sm sm:text-base border-l-4 border-transparent hover:border-primary/40 transition-all sticky left-0 bg-card z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-muted">
                    {student.lastName}, {student.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-[10px] sm:text-xs">{student.dni || '-'}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-[10px] sm:text-xs">{student.phone || '-'}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-[10px] sm:text-xs">{student.email || '-'}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-[10px] sm:text-xs">{student.parentName || '-'}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-[10px] sm:text-xs">
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
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
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
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </motion.tr>
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
          <div className="py-4 text-sm text-muted-foreground">
            ¿Estás seguro de que quieres eliminar a este alumno? Esta acción no se puede deshacer.
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showTutorial} onOpenChange={closeTutorial}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <span className="p-2 bg-primary/10 rounded-xl">
                <HelpCircle className="w-6 h-6 text-primary" />
              </span>
              Guía de Alumnos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <p className="text-muted-foreground text-sm">
              Esta pestaña te permite gestionar el listado de alumnos de tu clase.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-2 font-bold text-base">
                  <UserPlus className="w-5 h-5 text-blue-500" />
                  Añadir Alumno
                </div>
                <p className="text-xs text-muted-foreground">
                  Registra nuevos estudiantes. Podrás guardar sus datos de contacto y el nombre de los padres o tutores.
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-2 font-bold text-base">
                  <Fingerprint className="w-5 h-5 text-purple-500" />
                  Identificación
                </div>
                <p className="text-xs text-muted-foreground">
                  Registra un identificador único (DNI/NIE) para cruzar datos y evitar alumnos duplicados de forma cómoda.
                </p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3">
              <Lightbulb className="w-6 h-6 text-primary shrink-0" />
              <div>
                <h4 className="font-bold text-sm mb-1 text-primary">Consejo útil</h4>
                <div className="text-xs text-muted-foreground space-y-2">
                  <p>Mantén los datos de contacto actualizados para tener siempre a mano la información de los tutores legales.</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button className="w-full sm:w-auto" onClick={closeTutorial}>¡Entendido, empezar!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
