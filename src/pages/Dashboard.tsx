import React, { useEffect, useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { Class } from '@/src/types';
import Navbar from '@/src/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Plus, BookOpen, Users, Trash2, ArrowRight } from 'lucide-react';
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
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

export default function Dashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newSubject, setNewSubject] = useState('');

  const fetchClasses = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'classes'), where('teacherId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const fetchedClasses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      setClasses(fetchedClasses);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'classes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [user]);

  const handleAddClass = async () => {
    if (!newClassName || !newSubject || !user) {
      toast.error('Por favor rellena todos los campos');
      return;
    }

    try {
      await addDoc(collection(db, 'classes'), {
        name: newClassName,
        subject: newSubject,
        teacherId: user.uid,
        trimesters: 3,
        createdAt: serverTimestamp(),
      });
      toast.success('Clase creada correctamente');
      setNewClassName('');
      setNewSubject('');
      setIsAddDialogOpen(false);
      fetchClasses();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'classes');
    }
  };

  const handleDeleteClass = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'classes', deleteId));
      toast.success('Clase eliminada');
      setDeleteId(null);
      fetchClasses();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `classes/${deleteId}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-6 mb-10 text-center md:text-left">
          <div className="w-full md:w-auto">
            <p className="text-sm text-indigo-600 font-semibold uppercase tracking-wider">Escritorio de Gestión</p>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-900 tracking-tight">Tus Clases</h1>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger 
              nativeButton={true}
              render={
                <Button className="rounded-xl px-6 bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all border-none" />
              }
            >
              <Plus className="w-4 h-4 mr-2" /> Nueva Clase
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-white/80 backdrop-blur-xl border-white/20 rounded-3xl">
              <DialogHeader>
                <DialogTitle className="font-display font-bold text-2xl">Crear Nueva Clase</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="className">Nombre de la Clase</Label>
                  <Input id="className" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="Ej: 2º ESO A" className="bg-white/50 border-white/40 rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="subject">Asignatura</Label>
                  <Input id="subject" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Ej: Matemáticas" className="bg-white/50 border-white/40 rounded-xl" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddClass} className="w-full rounded-xl py-6 font-bold">Crear Clase</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-48 bg-white/30 animate-pulse rounded-2xl border border-white/20" />)}
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-20 bg-white/40 backdrop-blur-md border border-white rounded-3xl shadow-xl">
            <BookOpen className="w-12 h-12 text-indigo-400/50 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800">No hay clases aún</h3>
            <p className="text-slate-500 max-w-xs mx-auto mt-2">Comienza creando tu primera clase para gestionar alumnos y evaluaciones.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
              <motion.div key={cls.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Link to={`/class/${cls.id}`}>
                  <Card className="group relative overflow-hidden flex flex-col h-full rounded-2xl bg-white/40 backdrop-blur-md border-white shadow-xl hover:shadow-2xl hover:bg-white/50 transition-all cursor-pointer">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-500/20 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <Button
                          variant="ghost" 
                          size="icon" 
                          className="text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-all"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeleteId(cls.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <CardTitle className="mt-4 font-display font-bold text-2xl tracking-tight text-slate-900 group-hover:text-indigo-700 transition-colors">{cls.name}</CardTitle>
                      <CardDescription className="font-semibold text-slate-500">{cls.subject}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2 relative flex-grow">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                          <Users className="w-4 h-4" />
                          <span>Gestionar Alumnos</span>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <div className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center text-indigo-600 border border-white shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                <ArrowRight className="w-4 h-4" />
                            </div>
                        </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>¿Eliminar clase?</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-slate-500">
            ¿Estás seguro de eliminar esta clase? Se perderán todos los datos asociados. Esta acción no se puede deshacer.
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteClass}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
