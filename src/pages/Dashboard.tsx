import React, { useEffect, useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Class } from '@/src/types';
import Navbar from '@/src/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Plus, BookOpen, Users, Trash2, ArrowRight, HelpCircle, Lightbulb, Pencil, Target } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { usePlan } from '@/src/lib/usePlan';
import { useTutorial } from '@/src/lib/useTutorial';
import { StaggerContainer, StaggerItem } from '@/src/components/layout/FadeIn';

export default function Dashboard() {
  const { user } = useAuth();
  const { limits, plan } = usePlan();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { showTutorial, closeTutorial, openTutorial: setShowTutorial } = useTutorial('dashboard');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newWeights, setNewWeights] = useState<Record<number, number>>({ 1: 33.33, 2: 33.33, 3: 33.34 });
  const [editClassName, setEditClassName] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editWeights, setEditWeights] = useState<Record<number, number>>({ 1: 33.33, 2: 33.33, 3: 33.34 });

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'classes'), where('teacherId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedClasses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      setClasses(fetchedClasses);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'classes');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleEditSubmit = async () => {
    if (!editId || !editClassName || !editSubject) {
      toast.error('Por favor rellena todos los campos');
      return;
    }
    
    const totalW = (Object.values(editWeights) as number[]).reduce((a, b) => a + (b || 0), 0);
    if (Math.abs(totalW - 100) > 0.1) {
      toast.error('El porcentaje total de los trimestres debe sumar 100%');
      return;
    }

    try {
      await updateDoc(doc(db, 'classes', editId), {
        name: editClassName,
        subject: editSubject,
        trimesterWeights: editWeights,
      });
      toast.success('Clase actualizada correctamente');
      setEditId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `classes/${editId}`);
    }
  };

  const handleAddClass = async () => {
    if (classes.length >= limits.classLimit) {
      toast.error(`Has alcanzado el límite de ${limits.classLimit} clases en tu plan ${plan}. Mejora tu plan para añadir más.`);
      setIsAddDialogOpen(false);
      return;
    }
    if (!newClassName || !newSubject || !user) {
      toast.error('Por favor rellena todos los campos');
      return;
    }

    const totalW = (Object.values(newWeights) as number[]).reduce((a, b) => a + (b || 0), 0);
    if (Math.abs(totalW - 100) > 0.1) {
      toast.error('El porcentaje total de los trimestres debe sumar 100%');
      return;
    }

    try {
      await addDoc(collection(db, 'classes'), {
        name: newClassName,
        subject: newSubject,
        teacherId: user.uid,
        trimesters: 3,
        trimesterWeights: newWeights,
        createdAt: serverTimestamp(),
      });
      toast.success('Clase creada correctamente');
      setNewClassName('');
      setNewSubject('');
      setNewWeights({ 1: 33.33, 2: 33.33, 3: 33.34 });
      setIsAddDialogOpen(false);
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
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `classes/${deleteId}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <StaggerContainer className="max-w-7xl mx-auto px-4 py-12">
        <StaggerItem className="flex flex-col md:flex-row justify-between items-center md:items-end gap-6 mb-10 text-center md:text-left" variant="fadeUp">
          <div className="w-full md:w-auto">
            <p className="text-sm text-primary font-semibold uppercase tracking-wider">Escritorio de Gestión</p>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight">Tus Clases</h1>
              <Badge variant="outline" className="h-6 rounded-full border-border bg-muted/40 font-mono text-[10px] text-muted-foreground">
                {classes.length} / {limits.classLimit === Infinity ? '∞' : limits.classLimit}
              </Badge>
              <Button
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                onClick={() => setShowTutorial(true)}
              >
                <HelpCircle className="w-5 h-5" />
              </Button>
            </div>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger className="rounded-xl h-11 px-6 bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all border-none inline-flex items-center justify-center cursor-pointer">
              <Plus className="w-4 h-4 mr-2" /> Nueva Clase
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-popover/80 backdrop-blur-xl border-border rounded-3xl">
              <DialogHeader>
                <DialogTitle className="font-display font-bold text-2xl">Crear Nueva Clase</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="className">Nombre de la Clase</Label>
                  <Input id="className" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="Ej: 2º ESO A" className="bg-background/50 border-border rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="subject">Asignatura</Label>
                  <Input id="subject" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Ej: Matemáticas" className="bg-background/50 border-border rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Ponderación del Curso (%)
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map(t => (
                      <div key={t} className="space-y-1">
                        <Label htmlFor={`new-t${t}`} className="text-[10px] text-muted-foreground uppercase font-bold">Trimestre {t}</Label>
                        <Input 
                          id={`new-t${t}`}
                          type="number" 
                          value={newWeights[t]} 
                          onChange={(e) => setNewWeights(prev => ({ ...prev, [t]: parseFloat(e.target.value) }))}
                          className="bg-background/50 border-border rounded-xl h-9 text-xs" 
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    Total: {(Object.values(newWeights) as number[]).reduce((a, b) => a + (b || 0), 0).toFixed(2)}% (Debe sumar 100%)
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddClass} className="w-full rounded-xl py-6 font-bold">Crear Clase</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </StaggerItem>

        {loading ? (
          <StaggerItem className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" variant="fadeUp">
            {[1, 2, 3].map(i => <div key={i} className="h-48 bg-card/40 animate-pulse rounded-2xl border border-border" />)}
          </StaggerItem>
        ) : classes.length === 0 ? (
          <StaggerItem className="text-center py-20 bg-card/60 backdrop-blur-md border border-border rounded-3xl shadow-xl" variant="scaleIn">
            <BookOpen className="w-12 h-12 text-primary/50 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground">No hay clases aún</h3>
            <p className="text-muted-foreground max-w-xs mx-auto mt-2">Comienza creando tu primera clase para gestionar alumnos y evaluaciones.</p>
          </StaggerItem>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
              <StaggerItem key={cls.id} variant="scaleIn">
                <Link to={`/class/${cls.id}`}>
                  <Card className="group relative overflow-hidden flex flex-col h-full rounded-2xl bg-card/60 backdrop-blur-md border border-border shadow-xl hover:shadow-2xl hover:bg-card/80 active:scale-[0.98] hover:scale-[1.01] transition-all duration-300 cursor-pointer">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost" 
                            size="icon" 
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditClassName(cls.name);
                              setEditSubject(cls.subject);
                              setEditWeights(cls.trimesterWeights || { 1: 33.33, 2: 33.33, 3: 33.34 });
                              setEditId(cls.id);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost" 
                            size="icon" 
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteId(cls.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <CardTitle className="mt-4 font-display font-bold text-2xl tracking-tight text-foreground group-hover:text-primary transition-colors">{cls.name}</CardTitle>
                      <CardDescription className="font-semibold text-muted-foreground">{cls.subject}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2 relative flex-grow">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          <Users className="w-4 h-4" />
                          <span>Gestionar Alumnos</span>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <div className="w-8 h-8 rounded-full bg-card/60 flex items-center justify-center text-primary border border-border shadow-sm group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                <ArrowRight className="w-4 h-4" />
                            </div>
                        </div>
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </div>
        )}
      </StaggerContainer>
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>¿Eliminar clase?</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            ¿Estás seguro de eliminar esta clase? Se perderán todos los datos asociados. Esta acción no se puede deshacer.
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteClass}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent className="sm:max-w-[425px] bg-popover/80 backdrop-blur-xl border-border rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-2xl">Editar Clase</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editClassName">Nombre de la Clase</Label>
              <Input id="editClassName" value={editClassName} onChange={(e) => setEditClassName(e.target.value)} placeholder="Ej: 2º ESO A" className="bg-background/50 border-border rounded-xl" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editSubject">Asignatura</Label>
              <Input id="editSubject" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Ej: Matemáticas" className="bg-background/50 border-border rounded-xl" />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Ponderación del Curso (%)
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(t => (
                  <div key={t} className="space-y-1">
                    <Label htmlFor={`edit-t${t}`} className="text-[10px] text-muted-foreground uppercase font-bold">Trimestre {t}</Label>
                    <Input 
                      id={`edit-t${t}`}
                      type="number" 
                      value={editWeights[t] || 0} 
                      onChange={(e) => setEditWeights(prev => ({ ...prev, [t]: parseFloat(e.target.value) }))}
                      className="bg-background/50 border-border rounded-xl h-9 text-xs" 
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                Total: {(Object.values(editWeights) as number[]).reduce((a, b) => a + (b || 0), 0).toFixed(2)}% (Debe sumar 100%)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)} className="rounded-xl font-bold">Cancelar</Button>
            <Button onClick={handleEditSubmit} className="rounded-xl font-bold">Guardar Cambios</Button>
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
              Guía del Profesor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <p className="text-muted-foreground text-sm">
              Bienvenido a tu panel de control. Desde aquí podrás gestionar todas tus clases y grupos de forma sencilla y organizada.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-2 font-bold text-base">
                  <Plus className="w-5 h-5 text-blue-500" />
                  Crear Clases
                </div>
                <p className="text-xs text-muted-foreground">
                  Pulsa en "Nueva Clase" para empezar. Define el nombre del grupo y la asignatura que impartes.
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-2 font-bold text-base">
                  <ArrowRight className="w-5 h-5 text-purple-500" />
                  Acceso Rápido
                </div>
                <p className="text-xs text-muted-foreground">
                  Haz click en cualquier tarjeta de clase para entrar en su gestión: alumnos, notas, asistencia y analíticas.
                </p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3">
              <Lightbulb className="w-6 h-6 text-primary shrink-0" />
              <div>
                <h4 className="font-bold text-sm mb-1 text-primary">Consistencia en los datos</h4>
                <div className="text-xs text-muted-foreground space-y-2">
                  <p>Recuerda que cada clase es independiente. Dentro de cada una tendrás un cuaderno de notas y un listado de alumnos específico.</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button className="w-full sm:w-auto" onClick={closeTutorial}>¡Entendido, vamos allá!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
