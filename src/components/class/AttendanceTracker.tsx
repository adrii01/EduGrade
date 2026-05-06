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
import { Calendar as CalendarIcon, CheckCircle2, XCircle, Clock, Search } from 'lucide-react';
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
    <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border-b py-4 sm:py-6 px-4 sm:px-8 gap-4">
        <div className="flex-1">
          <CardTitle className="font-display font-bold text-xl">Control de Asistencia</CardTitle>
          <div className="relative mt-3 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Buscar alumno..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all text-sm"
            />
          </div>
        </div>
        
        <Popover>
          <PopoverTrigger 
            nativeButton={true}
            render={
              <Button variant="outline" className="w-full sm:w-auto rounded-full gap-2 border-slate-200 text-xs sm:text-sm h-9 sm:h-10" />
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
              <TableRow className="bg-slate-50/50">
                <TableHead className="px-4 sm:px-8 py-3 sm:py-4 font-bold text-xs sm:text-sm sticky left-0 bg-slate-50 z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Alumno</TableHead>
                <TableHead className="text-center font-bold text-xs sm:text-sm">Estado Actual</TableHead>
                <TableHead className="text-right px-4 sm:px-8 font-bold text-xs sm:text-sm">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-40 text-center text-slate-400 italic">
                    No se encontraron alumnos.
                  </TableCell>
                </TableRow>
              ) : filteredStudents.map(student => (
                <TableRow key={student.id} className="group hover:bg-slate-50/30 transition-colors">
                  <TableCell className="px-4 sm:px-8 py-3 sm:py-4 font-medium text-sm sm:text-base sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-slate-50">
                    {student.lastName ? `${student.lastName}, ${student.name}` : student.name}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      {attendance[student.id] ? (
                        <Badge variant="secondary" className="gap-1 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 bg-slate-100 rounded-full text-[10px] sm:text-xs">
                          {getStatusIcon(attendance[student.id])}
                          <span className="capitalize">{attendance[student.id] === 'present' ? 'Presente' : attendance[student.id] === 'absent' ? 'Ausente' : 'Retraso'}</span>
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-slate-400">Sin marcar</span>
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
    </Card>
  );
}
