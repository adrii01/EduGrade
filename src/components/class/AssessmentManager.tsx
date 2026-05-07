import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';
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

export default function AssessmentManager({ classId, teacherId }: { classId: string, teacherId: string }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenAssessmentTutorial');
    if (!hasSeen) {
      setShowTutorial(true);
    }
  }, []);

  const closeTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('hasSeenAssessmentTutorial', 'true');
  };
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

  const fetchAssessments = async () => {
    try {
      const q = query(
        collection(db, 'assessments'), 
        where('classId', '==', classId),
        where('teacherId', '==', teacherId)
      );
      const snap = await getDocs(q);
      setAssessments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assessment)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'assessments');
    }
  };

  useEffect(() => {
    fetchAssessments();
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
      fetchAssessments();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'assessments');
    }
  };

  const handleEdit = (assessment: Assessment) => {
    setEditingId(assessment.id);
    setFormData({
      title: assessment.title,
      type: assessment.type,
      weight: (assessment.weight * 100).toString(),
      trimester: assessment.trimester.toString(),
      date: assessment.date instanceof Timestamp 
        ? format(assessment.date.toDate(), 'yyyy-MM-dd') 
        : format(new Date(), 'yyyy-MM-dd'),
      isCategory: assessment.isCategory,
      parentId: assessment.parentId || 'none'
    });
    setIsOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'assessments', deleteId));
      toast.success('Evaluación eliminada');
      setDeleteId(null);
      fetchAssessments();
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
            <h2 className="text-xl sm:text-2xl font-display font-bold font-black text-foreground tracking-tight">Plan de Evaluación</h2>
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
            <SelectTrigger className="w-full sm:w-[200px] h-9">
              <SelectValue placeholder="Filtrar por categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ver Todas</SelectItem>
              <SelectGroup>
                <SelectLabel className="text-xs font-bold text-muted-foreground">Por Trimestre</SelectLabel>
                <SelectItem value="tri_1">Solo 1º Trimestre</SelectItem>
                <SelectItem value="tri_2">Solo 2º Trimestre</SelectItem>
                <SelectItem value="tri_3">Solo 3º Trimestre</SelectItem>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Ninguna (Prueba independiente)" />
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
                              {cat.title} (Cupo: {cat.weight * 100}% - Disponible: {remaining.toFixed(1)}%)
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
                    <SelectTrigger>
                      <SelectValue />
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
                    <SelectTrigger>
                      <SelectValue />
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
                  .filter(a => !a.parentId || a.parentId === 'none')
                  .filter(a => {
                    if (categoryFilter === 'all' || categoryFilter.startsWith('tri_')) return true;
                    return a.id === categoryFilter;
                  })
                  .sort((a, b) => (a.isCategory === b.isCategory) ? 0 : a.isCategory ? -1 : 1);

                if (filteredList.length === 0) {
                  return (
                    <div className="h-20 border border-dashed rounded-xl flex items-center justify-center text-muted-foreground text-xs">
                      Sin evaluaciones {categoryFilter !== 'all' ? 'que coincidan con el filtro' : ''}
                    </div>
                  );
                }

                return filteredList.map(assessment => {
                  const children = assessments.filter(child => child.parentId === assessment.id);
                  const childrenWeightSum = children.reduce((sum, child) => sum + (child.weight * 100), 0);
                  const isFull = Math.abs(childrenWeightSum - (assessment.weight * 100)) < 0.1;

                  return (
                    <div key={assessment.id} className="space-y-2">
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
                                    {assessment.weight * 100}%
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
                                <div className="flex justify-between items-start mb-1 text-[11px] sm:text-xs">
                                  <div className="flex items-center gap-2">
                                    <ChevronRight className="w-3 h-3 text-muted-foreground/70" />
                                    {child.type === 'exam' ? <Target className="w-3 h-3 text-primary/70" /> : <BookOpenCheck className="w-3 h-3 text-green-500/70" />}
                                    <span className="font-medium tracking-tight line-clamp-1">{child.title}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(child);
                                      }}
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteId(child.id);
                                      }}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-[8px] text-muted-foreground">
                                      {child.date instanceof Timestamp ? format(child.date.toDate(), 'dd/MM') : '-'}
                                    </span>
                                    <Badge variant="secondary" className="text-[8px] h-4 px-1 bg-slate-100 text-muted-foreground">
                                        {child.weight * 100}%
                                    </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <span className="p-2 bg-primary/10 rounded-xl">
                <HelpCircle className="w-6 h-6 text-primary" />
              </span>
              Guía de Evaluaciones
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <p className="text-muted-foreground text-sm">
              Bienvenido a la sección de configuración de notas. Aquí puedes estructurar cómo se evaluará cada trimestre. Hay dos tipos principales de elementos que puedes crear:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-2 font-bold text-base">
                  <Target className="w-5 h-5 text-blue-500" />
                  Prueba Individual
                </div>
                <p className="text-xs text-muted-foreground">
                  Son las tareas, exámenes o controles específicos (ej. "Examen Tema 1", "Trabajo en grupo"). Tienen una fecha y un tipo (Examen o Trabajo).
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-2 font-bold text-base">
                  <Layers className="w-5 h-5 text-purple-500" />
                  Categoría
                </div>
                <p className="text-xs text-muted-foreground">
                  Son agrupadores lógicos (ej. "Exámenes", "Trabajos diarios", "Actitud"). No tienen notas por sí mismas, pero agrupan varias Pruebas Individuales.
                </p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3">
              <Lightbulb className="w-6 h-6 text-primary shrink-0" />
              <div>
                <h4 className="font-bold text-sm mb-1 text-primary">¿Cómo configurar el peso (%)?</h4>
                <div className="text-xs text-muted-foreground space-y-2">
                  <p>Si una Prueba está <strong>suelta</strong>, su porcentaje se calcula sobre el total del trimestre.</p>
                  <p>Si metes varias pruebas <strong>dentro de una Categoría</strong>, primero le das un peso a la categoría (ej. 60% Exámenes), y luego decides cuánto vale cada prueba dentro de ese 100% interno de la categoría.</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button className="w-full sm:w-auto" onClick={closeTutorial}>¡Entendido, empezar!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
