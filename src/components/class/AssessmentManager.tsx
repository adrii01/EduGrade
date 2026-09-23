import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, Timestamp, updateDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { Assessment } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Trash2, 
  Pencil,
  Target, 
  BookOpenCheck,
  CalendarDays,
  Layers,
  ChevronRight,
  HelpCircle,
  Lightbulb
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  SelectGroup,
  SelectLabel
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTutorial } from '@/src/lib/useTutorial';
import { motion } from 'motion/react';

export default function AssessmentManager({ classId, teacherId }: { classId: string, teacherId: string }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { showTutorial, closeTutorial, openTutorial: setShowTutorial } = useTutorial('assessment');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formData, setFormData] = useState({
    title: '',
    type: 'exam' as 'exam' | 'work',
    weight: '20',
    trimester: '1',
    date: format(new Date(), 'yyyy-MM-dd'),
    isCategory: false,
    parentId: 'none'
  });

  useEffect(() => {
    const q = query(
      collection(db, 'assessments'), 
      where('classId', '==', classId),
      where('teacherId', '==', teacherId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAssessments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assessment)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'assessments');
    });
    return () => unsub();
  }, [classId, teacherId]);

  const handleAdd = async () => {
    if (!formData.title) return toast.error('El título es obligatorio');
    
    const weightVal = Number(formData.weight);
    
    // Validation for children
    if (formData.parentId && formData.parentId !== 'none') {
      const parent = assessments.find(a => a.id === formData.parentId);
      if (parent) {
        const parentWeightPercent = parent.weight * 100;
        // If editing, exclude the current assessment from the sum
        const currentChildrenWeight = assessments
          .filter(a => a.parentId === parent.id && a.id !== editingId)
          .reduce((sum, a) => sum + (a.weight * 100), 0);
        
        if (currentChildrenWeight + weightVal > parentWeightPercent) {
          return toast.error(`Error: El peso total de los elementos de "${parent.title}" (${currentChildrenWeight + weightVal}%) superaría el límite de la categoría (${parentWeightPercent}%).`);
        }
      }
    }

    try {
      const data = {
        title: formData.title,
        type: formData.type,
        weight: Number(formData.weight) / 100,
        trimester: Number(formData.trimester),
        date: new Date(formData.date),
        isCategory: formData.isCategory,
        parentId: (formData.parentId === 'none' || !formData.parentId) ? null : formData.parentId,
        classId,
        teacherId,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'assessments', editingId), data);
        toast.success('Actualizado correctamente');
      } else {
        await addDoc(collection(db, 'assessments'), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast.success(formData.isCategory ? 'Categoría creada' : 'Prueba creada');
      }

      setIsOpen(false);
      setEditingId(null);
      setFormData({ 
        title: '', 
        type: 'exam', 
        weight: '20', 
        trimester: '1', 
        date: format(new Date(), 'yyyy-MM-dd'),
        isCategory: false,
        parentId: 'none'
      });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'assessments');
    }
  };

  const handleEdit = (assessment: Assessment) => {
    setEditingId(assessment.id);
    let formattedDate = format(new Date(), 'yyyy-MM-dd');
    if (assessment.date) {
      if (typeof (assessment.date as any)?.toDate === 'function') {
        formattedDate = format((assessment.date as any).toDate(), 'yyyy-MM-dd');
      } else if (assessment.date instanceof Date) {
        formattedDate = format(assessment.date, 'yyyy-MM-dd');
      } else if (typeof assessment.date === 'string' && assessment.date.includes('-')) {
        formattedDate = assessment.date.substring(0, 10);
      } else if ((assessment.date as any)?.seconds) {
        formattedDate = format(new Date((assessment.date as any).seconds * 1000), 'yyyy-MM-dd');
      }
    }

    setFormData({
      title: assessment.title,
      type: assessment.type,
      weight: Math.round(assessment.weight * 100).toString(),
      trimester: assessment.trimester.toString(),
      date: formattedDate,
      isCategory: assessment.isCategory,
      parentId: assessment.parentId || 'none'
    });
    setIsOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const getAllDescendants = (id: string, list: Assessment[]): string[] => {
        const children = list.filter(a => a.parentId === id);
        let results = children.map(c => c.id);
        children.forEach(c => {
          results = [...results, ...getAllDescendants(c.id, list)];
        });
        return results;
      };

      const descendants = getAllDescendants(deleteId, assessments);
      const allToDelete = [deleteId, ...descendants];
      
      const batch = writeBatch(db);
      allToDelete.forEach(id => {
        batch.delete(doc(db, 'assessments', id));
      });
      await batch.commit();

      toast.success(allToDelete.length > 1 ? 'Categoría y sus elementos eliminados' : 'Evaluación eliminada');
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `assessments/${deleteId}`);
    }
  };

  const grouped = assessments.reduce((acc, curr) => {
    const t = curr.trimester;
    if (!acc[t]) acc[t] = [];
    acc[t].push(curr);
    return acc;
  }, {} as Record<number, Assessment[]>);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground tracking-tight">Plan de Evaluaciones</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
              onClick={() => setShowTutorial(true)}
            >
              <HelpCircle className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium tracking-tight">Define exámenes y trabajos para cada trimestre.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[220px] h-10">
              <SelectValue>
                {categoryFilter === 'all' ? 'Todas' : 
                 categoryFilter === 'tri_1' ? '1º Trimestre' :
                 categoryFilter === 'tri_2' ? '2º Trimestre' :
                 categoryFilter === 'tri_3' ? '3º Trimestre' :
                 (assessments.find(a => a.id === categoryFilter)?.title || 'Filtrar...')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectGroup>
                <SelectLabel className="text-xs font-bold text-muted-foreground">Por Trimestre</SelectLabel>
                <SelectItem value="tri_1">1º Trimestre</SelectItem>
                <SelectItem value="tri_2">2º Trimestre</SelectItem>
                <SelectItem value="tri_3">3º Trimestre</SelectItem>
              </SelectGroup>
              {[1, 2, 3].map(tri => {
                const cats = assessments.filter(a => a.isCategory && a.trimester === tri);
                if (cats.length === 0) return null;
                return (
                  <SelectGroup key={tri}>
                    <SelectLabel className="text-xs font-bold text-muted-foreground">{tri}º Trimestre - Categorías</SelectLabel>
                    {cats.sort((a, b) => a.title.localeCompare(b.title)).map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
  
          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) {
              setEditingId(null);
              setFormData({ 
                title: '', 
                type: 'exam', 
                weight: '20', 
                trimester: '1', 
                date: format(new Date(), 'yyyy-MM-dd'),
                isCategory: false,
                parentId: 'none'
              });
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
                    setFormData({ 
                      title: '', 
                      type: 'exam', 
                      weight: '20', 
                      trimester: '1', 
                      date: format(new Date(), 'yyyy-MM-dd'),
                      isCategory: false,
                      parentId: 'none'
                    });
                  }}
                />
              }
            >
              <Plus className="w-4 h-4 mr-2" /> Nueva Evaluación
            </DialogTrigger>
            <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? 'Editar Evaluación' : 'Configurar Evaluación'}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              {!editingId ? (
                <Tabs value={formData.isCategory ? "category" : "assessment"} onValueChange={(val) => setFormData({...formData, isCategory: val === 'category', parentId: 'none'})}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="assessment">Prueba Individual</TabsTrigger>
                    <TabsTrigger value="category">Categoría (Agrupador)</TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : (
                <div className="flex justify-center">
                  <Badge variant="outline" className="px-3 py-1 font-bold">
                    {formData.isCategory ? "Editando Categoría" : "Editando Prueba Individual"}
                  </Badge>
                </div>
              )}

              <div className="space-y-2">
                <Label>{formData.isCategory ? "Nombre de la Categoría" : "Nombre de la Prueba"}</Label>
                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder={formData.isCategory ? "Ej: Exámenes, Trabajos, Actitud..." : "Ej: Examen Tema 1, Proyecto Final..."} />
              </div>
              
              {!formData.isCategory && (
                <div className="space-y-2">
                  <Label>Agrupar dentro de (Opcional)</Label>
                  <Select value={formData.parentId} onValueChange={(v) => setFormData({...formData, parentId: v})}>
                    <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder="Ninguna (Prueba independiente)">
                        {(!formData.parentId || formData.parentId === 'none') 
                          ? 'Sin agrupar (Prueba independiente)' 
                          : (assessments.find(a => a.id === formData.parentId)?.title || 'Sin agrupar (Prueba independiente)')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin agrupar (Prueba independiente)</SelectItem>
                      {assessments
                        .filter(a => a.isCategory && a.trimester === Number(formData.trimester))
                        .map(cat => {
                          const currentWeightUsed = assessments
                            .filter(child => child.parentId === cat.id && child.id !== editingId)
                            .reduce((sum, child) => sum + (child.weight * 100), 0);
                          const remaining = (cat.weight * 100) - currentWeightUsed;
                          
                          return (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.title} (Cupo: {Math.round(cat.weight * 100)}% - Disponible: {remaining.toFixed(1)}%)
                            </SelectItem>
                          );
                        })
                      }
                    </SelectContent>
                  </Select>
                  {formData.parentId && formData.parentId !== 'none' && (
                    <p className="text-[10px] text-primary font-medium">
                      * El peso de esta prueba se calculará sobre el total de la categoría seleccionada.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                    <SelectTrigger className="w-full h-10">
                      <SelectValue>
                        {formData.type === 'exam' ? 'Examen' : 'Trabajo / Proyecto'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exam">Examen</SelectItem>
                      <SelectItem value="work">Trabajo / Proyecto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Peso (%)</Label>
                  <Input type="number" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trimestre</Label>
                  <Select value={formData.trimester} onValueChange={(v: any) => setFormData({...formData, trimester: v})}>
                    <SelectTrigger className="w-full h-10">
                      <SelectValue>
                        {`${formData.trimester}º Trimestre`}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1º Trimestre</SelectItem>
                      <SelectItem value="2">2º Trimestre</SelectItem>
                      <SelectItem value="3">3º Trimestre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button onClick={handleAdd}>{editingId ? 'Actualizar' : 'Guardar'} Evaluación</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3]
          .filter(t => {
            if (categoryFilter === 'all') return true;
            if (categoryFilter === `tri_${t}`) return true;
            if (categoryFilter.startsWith('tri_')) return false;
            // It's a category
            const cat = assessments.find(a => a.id === categoryFilter);
            return cat && cat.trimester === t;
          })
          .map(t => (
          <div key={t} className="space-y-4">
            <h3 className="font-display font-bold text-lg flex items-center gap-2 border-l-4 border-primary pl-3">
              {t}º Trimestre
              <Badge variant="secondary" className="ml-2 font-mono">
                {assessments
                  .filter(a => a.trimester === t && (!a.parentId || a.parentId === 'none'))
                  .reduce((sum, a) => sum + (a.weight * 100), 0).toFixed(0)}% Total
              </Badge>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {(() => {
                const filteredList = (grouped[t] || [])
                  .filter(a => !a.parentId || a.parentId === 'none' || !assessments.some(p => p.id === a.parentId))
                  .filter(a => {
                    if (categoryFilter === 'all' || categoryFilter.startsWith('tri_')) return true;
                    // Always show the selected category
                    if (a.id === categoryFilter) return true;
                    // Also show assessments that are independent (no parent and not a category themselves)
                    return !a.isCategory && (!a.parentId || a.parentId === 'none' || !assessments.some(p => p.id === a.parentId));
                  })
                  .sort((a, b) => (a.isCategory === b.isCategory) ? 0 : a.isCategory ? -1 : 1);

                if (filteredList.length === 0) {
                  return (
                    <div className="h-20 border border-dashed rounded-xl flex items-center justify-center text-muted-foreground text-xs">
                      Sin evaluaciones {categoryFilter !== 'all' ? 'que coincidan con el filtro' : ''}
                    </div>
                  );
                }

                return filteredList.map((assessment, index) => {
                  const children = assessments.filter(child => child.parentId === assessment.id);
                  const childrenWeightSum = children.reduce((sum, child) => sum + (child.weight * 100), 0);
                  const isFull = Math.abs(childrenWeightSum - (assessment.weight * 100)) < 0.1;

                  return (
                    <motion.div 
                      key={assessment.id} 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <Card className={`relative group overflow-hidden border-border shadow-sm hover:shadow-md transition-shadow ${assessment.isCategory ? 'bg-primary/5 border-dashed border-primary/20' : ''}`}>
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex justify-between items-start mb-1 sm:mb-2 text-xs sm:text-sm">
                            <div className="flex items-center gap-2">
                              {assessment.isCategory ? (
                                <Layers className="w-3.5 h-3.5 text-primary" />
                              ) : (
                                assessment.type === 'exam' ? <Target className="w-3.5 h-3.5 text-primary" /> : <BookOpenCheck className="w-3.5 h-3.5 text-green-500" />
                              )}
                              <span className={`font-bold tracking-tight line-clamp-1 ${assessment.isCategory ? 'text-primary uppercase text-[10px]' : ''}`}>
                                {assessment.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(assessment);
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteId(assessment.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground">
                                  <CalendarDays className="w-3 h-3" />
                                  <span>{assessment.date instanceof Timestamp ? format(assessment.date.toDate(), 'dd/MM/yyyy') : '-'}</span>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${assessment.isCategory ? 'bg-primary/20 text-primary border-primary/20' : 'bg-muted'}`}>
                                    {Math.round(assessment.weight * 100)}%
                                </Badge>
                                {assessment.isCategory && (
                                  <span className={`text-[9px] font-bold ${isFull ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    {childrenWeightSum.toFixed(0)}% / {(assessment.weight * 100).toFixed(0)}% ocupado
                                  </span>
                                )}
                              </div>
                          </div>
                        </CardContent>
                      </Card>

                      {children.length > 0 && (
                        <div className="pl-6 space-y-2 border-l-2 border-border ml-4">
                          {children.map(child => (
                            <Card key={child.id} className="relative group overflow-hidden border-border shadow-none hover:bg-card/50 transition-colors">
                              <CardContent className="p-2 sm:p-3">
                                <div className="flex justify-between items-center mb-1 text-xs sm:text-sm">
                                  <div className="flex items-center gap-2.5">
                                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                                    {child.type === 'exam' ? <Target className="w-4 h-4 text-primary/80" /> : <BookOpenCheck className="w-4 h-4 text-emerald-500/80" />}
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 tracking-tight line-clamp-1">{child.title}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0 transition-colors rounded-lg"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(child);
                                      }}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 transition-colors rounded-lg"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteId(child.id);
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-1 ml-6">
                                    <div className="flex items-center gap-1.5">
                                      <CalendarDays className="w-3 h-3 text-muted-foreground/60" />
                                      <span className="text-[10px] text-muted-foreground font-medium">
                                        {child.date instanceof Timestamp ? format(child.date.toDate(), 'dd/MM') : '-'}
                                      </span>
                                    </div>
                                    <Badge variant="secondary" className="text-[10px] font-bold h-5 px-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-none">
                                        {Math.round(child.weight * 100)}%
                                    </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              })()}
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>¿Confirmar eliminación?</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Esta acción no se puede deshacer. Los datos de notas asociados pueden quedar huérfanos.
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showTutorial} onOpenChange={closeTutorial}>
        <DialogContent className="sm:max-w-[700px] bg-popover/80 backdrop-blur-xl border-border rounded-3xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-2xl font-display font-bold">
              <span className="p-2 bg-primary/10 rounded-xl">
                <HelpCircle className="w-6 h-6 text-primary" />
              </span>
              Entendiendo las Evaluaciones
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <p className="text-muted-foreground text-sm">
              Estructurar correctamente tu cuaderno es crucial. EduGrade utiliza un sistema jerárquico de pesos para calcular la nota final del trimestre con total precisión.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card p-5 rounded-2xl shadow-sm border border-border">
                <div className="flex items-center gap-3 mb-3 font-bold text-base">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-blue-500" />
                  </div>
                  La Prueba Individual
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Es un elemento calificable (un examen, un trabajo, un ejercicio). Si creas una prueba suelta, su peso (%) aplica directamente sobre la nota final del trimestre. Ejemplo: "Examen Final" (40%).
                </p>
              </div>
              <div className="bg-card p-5 rounded-2xl shadow-sm border border-border">
                <div className="flex items-center gap-3 mb-3 font-bold text-base">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-purple-500" />
                  </div>
                  La Categoría
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Es un "cajón" que agrupa varias pruebas. Le asignas un peso global para el trimestre (ej. "Actitud" = 10%). Todo lo que introduzcas dentro compartirá y se calculará según ese 10%.
                </p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl">
              <div className="flex gap-3 mb-3">
                <Lightbulb className="w-6 h-6 text-primary shrink-0" />
                <h4 className="font-bold text-base text-primary">El Sistema de Pesos: Un Caso Práctico</h4>
              </div>
              
              <div className="space-y-4 text-sm text-foreground ml-9">
                <p>
                  Imagina que quieres que la nota se divida en: <strong>Exámenes (60%)</strong> y <strong>Trabajos diarios (40%)</strong>.
                </p>
                <div className="space-y-3 bg-background/50 p-4 rounded-xl border border-primary/10">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</div>
                    <p>Creas la <strong>Categoría "Exámenes"</strong> y le pones un peso global del <strong>60%</strong>.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</div>
                    <div>
                      <p>Dentro de esa categoría creas dos pruebas (Ej: Examen T1 y Examen T2).</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        A cada prueba le debes dar su peso <strong>dentro de la categoría</strong>. Por ejemplo, 50% y 50% si valen lo mismo, o 30% y 70%. Al final, esa categoría completa siempre aportará el 60% a la nota final del trimestre.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  💡 Si intentas poner pruebas sueltas o categorías que no sumen exactamente el 100% en total, EduGrade te avisará en amarillo en las barras de progreso superiores.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button className="w-full rounded-xl font-bold" onClick={closeTutorial}>¡Entendido, vamos a configurar!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
