import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Student, Attendance } from '@/src/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Calendar as CalendarIcon, CheckCircle2, XCircle, Clock, Search, HelpCircle, Lightbulb } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function AttendanceTracker({ classId, teacherId }: { classId: string, teacherId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenAttendanceTutorial');
    if (!hasSeen) {
      setShowTutorial(true);
    }
  }, []);

  const closeTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('hasSeenAttendanceTutorial', 'true');
  };

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
    }
  };

  const fetchAttendance = async (targetDate: Date) => {
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    try {
      const q = query(
        collection(db, 'attendance'), 
        where('classId', '==', classId),
        where('teacherId', '==', teacherId),
        where('date', '==', dateStr)
      );
      const snap = await getDocs(q);
      const records: Record<string, 'present' | 'absent' | 'late'> = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        records[data.studentId] = data.status;
      });
      setAttendance(records);
    } catch (error) {
       handleFirestoreError(error, OperationType.LIST, 'attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [classId, teacherId]);

  useEffect(() => {
    fetchAttendance(date);
  }, [classId, teacherId, date]);

  const filteredStudents = students.filter(s => 
    `${s.name} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const updateStatus = async (studentId: string, status: 'present' | 'absent' | 'late') => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const id = `${classId}_${studentId}_${dateStr}`;
    try {
      await setDoc(doc(db, 'attendance', id), {
        studentId,
        classId,
        teacherId,
        date: dateStr,
        status
      });
      setAttendance(prev => ({ ...prev, [studentId]: status }));
      toast.info(`Asistencia actualizada`, { duration: 1000 });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'absent': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'late': return <Clock className="w-4 h-4 text-orange-500" />;
      default: return null;
    }
  };

  return (
    <Card className="rounded-3xl border-border shadow-sm overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card border-b py-4 sm:py-6 px-4 sm:px-8 gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <CardTitle className="font-display font-bold text-xl">Control de Asistencia</CardTitle>
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
              className="pl-9 h-10 bg-muted border-border rounded-xl focus:bg-card transition-all text-sm"
            />
          </div>
        </div>
        
        <Popover>
          <PopoverTrigger 
            nativeButton={true}
            render={
              <Button variant="outline" className="w-full sm:w-auto rounded-full gap-2 border-border text-xs sm:text-sm h-9 sm:h-10" />
            }
          >
            <CalendarIcon className="w-4 h-4" />
            {format(date, "PPP", { locale: es })}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <Table className="min-w-[500px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="px-4 sm:px-8 py-3 sm:py-4 font-bold text-xs sm:text-sm sticky left-0 bg-muted z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Alumno</TableHead>
                <TableHead className="text-center font-bold text-xs sm:text-sm">Estado Actual</TableHead>
                <TableHead className="text-right px-4 sm:px-8 font-bold text-xs sm:text-sm">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-40 text-center text-muted-foreground italic">
                    No se encontraron alumnos.
                  </TableCell>
                </TableRow>
              ) : filteredStudents.map(student => (
                <TableRow key={student.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="px-4 sm:px-8 py-3 sm:py-4 font-medium text-sm sm:text-base sticky left-0 bg-card z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-muted">
                    {student.lastName ? `${student.lastName}, ${student.name}` : student.name}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      {attendance[student.id] ? (
                        <Badge 
                          variant="secondary" 
                          className={`gap-1 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs border-transparent ${
                            attendance[student.id] === 'present' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 
                            attendance[student.id] === 'absent' ? 'bg-red-500/10 text-red-700 dark:text-red-400' : 
                            'bg-orange-500/10 text-orange-700 dark:text-orange-400'
                          }`}
                        >
                          {getStatusIcon(attendance[student.id])}
                          <span className="capitalize">{attendance[student.id] === 'present' ? 'Presente' : attendance[student.id] === 'absent' ? 'Ausente' : 'Retraso'}</span>
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Sin marcar</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-4 sm:px-8">
                    <div className="flex justify-end gap-1 sm:gap-2">
                      <Button 
                        size="sm" 
                        variant={attendance[student.id] === 'present' ? 'default' : 'ghost'} 
                        className="rounded-full w-9 h-9 p-0"
                        onClick={() => updateStatus(student.id, 'present')}
                      >
                        P
                      </Button>
                      <Button 
                        size="sm" 
                        variant={attendance[student.id] === 'absent' ? 'destructive' : 'ghost'} 
                        className="rounded-full w-9 h-9 p-0"
                        onClick={() => updateStatus(student.id, 'absent')}
                      >
                        A
                      </Button>
                      <Button 
                        size="sm" 
                        variant={attendance[student.id] === 'late' ? 'secondary' : 'ghost'} 
                        className="rounded-full w-9 h-9 p-0"
                        onClick={() => updateStatus(student.id, 'late')}
                      >
                        R
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
      <Dialog open={showTutorial} onOpenChange={closeTutorial}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <span className="p-2 bg-primary/10 rounded-xl">
                <HelpCircle className="w-6 h-6 text-primary" />
              </span>
              Guía de Asistencia
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <p className="text-muted-foreground text-sm">
              Registra rápidamente el control de faltas día por día seleccionando el calendario.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-2 font-bold text-base">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Estado
                </div>
                <p className="text-xs text-muted-foreground">
                  Al marcar cualquier estado (presente/ausente/tarde) sobre un alumno, se actualizará y guardará automáticamente para la fecha mostrada.
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-2 font-bold text-base">
                  <CalendarIcon className="w-5 h-5 text-purple-500" />
                  Fechas Pasadas
                </div>
                <p className="text-xs text-muted-foreground">
                  Usa el selector de fecha y podrás ver, y editar si lo necesitas, las asistencias marcadas de días pasados de tus alumnos.
                </p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3">
              <Lightbulb className="w-6 h-6 text-primary shrink-0" />
              <div>
                <h4 className="font-bold text-sm mb-1 text-primary">Autoguardado inmediato</h4>
                <div className="text-xs text-muted-foreground space-y-2">
                  <p>La aplicación guarda instantáneamente cada opción que pulsas sobre un alumno, no necesitas buscar ningún botón de "Guardar Cambios".</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button className="w-full sm:w-auto" onClick={closeTutorial}>¡Entendido!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
