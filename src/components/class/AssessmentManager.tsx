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
  ChevronRight
} from 'lucide-react';
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
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AssessmentManager({ classId, teacherId }: { classId: string, teacherId: string }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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
          <h2 className="text-xl sm:text-2xl font-display font-bold font-black text-slate-900 tracking-tight">Plan de Evaluación</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium tracking-tight">Define exámenes y trabajos para cada trimestre.</p>
        </div>
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
                className="w-full sm:w-auto rounded-xl bg-indigo-600 shadow-lg shadow-indigo-200" 
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
              <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <Checkbox 
                  id="isCategory" 
                  checked={formData.isCategory} 
                  disabled={!!editingId} // Disable changing category status on edit
                  onCheckedChange={(checked) => setFormData({...formData, isCategory: !!checked, parentId: ''})} 
                />
                <Label htmlFor="isCategory" className={`text-sm font-bold cursor-pointer ${editingId ? 'opacity-50' : ''}`}>
                  Es una Categoría (Agrupa otras pruebas)
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Título / Descripción</Label>
                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder={formData.isCategory ? "Ej: Exámenes" : "Ej: Examen Unidad 1"} />
              </div>
              
              {!formData.isCategory && (
                <div className="space-y-2">
                  <Label>Categoría Padre (Opcional)</Label>
                  <Select value={formData.parentId} onValueChange={(v) => setFormData({...formData, parentId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ninguna (Prueba independiente)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin categoría</SelectItem>
                      {assessments
                        .filter(a => a.isCategory && a.trimester === Number(formData.trimester))
                        .map(cat => {
                          const currentWeightUsed = assessments
                            .filter(child => child.parentId === cat.id)
                            .reduce((sum, child) => sum + (child.weight * 100), 0);
                          const remaining = (cat.weight * 100) - currentWeightUsed;
                          
                          return (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.title} (Cupo: {cat.weight * 100}% - Queda: {remaining.toFixed(1)}%)
                            </SelectItem>
                          );
                        })
                      }
                    </SelectContent>
                  </Select>
                  {formData.parentId && formData.parentId !== 'none' && (
                    <p className="text-[10px] text-indigo-600 font-medium">
                      * Esta prueba restará porcentaje del total de la categoría seleccionada.
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(t => (
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
              {(grouped[t] || [])
                .filter(a => !a.parentId || a.parentId === 'none') // Show top level first
                .sort((a, b) => (a.isCategory === b.isCategory) ? 0 : a.isCategory ? -1 : 1)
                .map(assessment => {
                  const children = assessments.filter(child => child.parentId === assessment.id);
                  const childrenWeightSum = children.reduce((sum, child) => sum + (child.weight * 100), 0);
                  const isFull = Math.abs(childrenWeightSum - (assessment.weight * 100)) < 0.1;

                  return (
                    <div key={assessment.id} className="space-y-2">
                      <Card className={`relative group overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-shadow ${assessment.isCategory ? 'bg-indigo-50/30 border-dashed border-indigo-200' : ''}`}>
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex justify-between items-start mb-1 sm:mb-2 text-xs sm:text-sm">
                            <div className="flex items-center gap-2">
                              {assessment.isCategory ? (
                                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                              ) : (
                                assessment.type === 'exam' ? <Target className="w-3.5 h-3.5 text-primary" /> : <BookOpenCheck className="w-3.5 h-3.5 text-green-500" />
                              )}
                              <span className={`font-bold tracking-tight line-clamp-1 ${assessment.isCategory ? 'text-indigo-900 uppercase text-[10px]' : ''}`}>
                                {assessment.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 shrink-0 transition-colors"
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
                                className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/10 shrink-0 transition-colors"
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
                              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-400">
                                  <CalendarDays className="w-3 h-3" />
                                  <span>{assessment.date instanceof Timestamp ? format(assessment.date.toDate(), 'dd/MM/yyyy') : '-'}</span>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${assessment.isCategory ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-50'}`}>
                                    {assessment.weight * 100}%
                                </Badge>
                                {assessment.isCategory && (
                                  <span className={`text-[9px] font-bold ${isFull ? 'text-green-600' : 'text-amber-600'}`}>
                                    {childrenWeightSum.toFixed(0)}% / {(assessment.weight * 100).toFixed(0)}% ocupado
                                  </span>
                                )}
                              </div>
                          </div>
                        </CardContent>
                      </Card>

                      {children.length > 0 && (
                        <div className="pl-6 space-y-2 border-l-2 border-slate-100 ml-4">
                          {children.map(child => (
                            <Card key={child.id} className="relative group overflow-hidden border-slate-100 shadow-none hover:bg-white/50 transition-colors">
                              <CardContent className="p-2 sm:p-3">
                                <div className="flex justify-between items-start mb-1 text-[11px] sm:text-xs">
                                  <div className="flex items-center gap-2">
                                    <ChevronRight className="w-3 h-3 text-slate-300" />
                                    {child.type === 'exam' ? <Target className="w-3 h-3 text-primary/70" /> : <BookOpenCheck className="w-3 h-3 text-green-500/70" />}
                                    <span className="font-medium tracking-tight line-clamp-1">{child.title}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 shrink-0 transition-colors"
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
                                      className="h-7 w-7 text-slate-400 hover:text-destructive hover:bg-destructive/10 shrink-0 transition-colors"
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
                                    <span className="text-[8px] text-slate-400">
                                      {child.date instanceof Timestamp ? format(child.date.toDate(), 'dd/MM') : '-'}
                                    </span>
                                    <Badge variant="secondary" className="text-[8px] h-4 px-1 bg-slate-100 text-slate-500">
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
                })}
              {(grouped[t] || []).length === 0 && (
                <div className="h-20 border border-dashed rounded-xl flex items-center justify-center text-slate-400 text-xs">
                  Sin evaluaciones
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>¿Confirmar eliminación?</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-slate-500">
            Esta acción no se puede deshacer. Los datos de notas asociados pueden quedar huérfanos.
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
