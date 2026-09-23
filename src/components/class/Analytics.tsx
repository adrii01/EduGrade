import { useEffect, useState, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Student, Assessment, Grade, Class, Attendance } from '@/src/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogTrigger 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  Award, 
  AlertTriangle, 
  Target, 
  BookOpen, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Sparkles,
  Loader2,
  RefreshCw,
  Users,
  ChevronRight,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { HelpCircle, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTutorial } from '@/src/lib/useTutorial';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Analytics({ classId, teacherId }: { classId: string, teacherId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [className, setClassName] = useState<string>('');
  const [classData, setClassData] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const { showTutorial, closeTutorial, openTutorial: setShowTutorial } = useTutorial('analytics');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [attendanceTrimester, setAttendanceTrimester] = useState<'all' | '1' | '2' | '3'>('all');
  const [attendanceFilterType, setAttendanceFilterType] = useState<'issues' | 'all' | 'absent' | 'late' | 'present'>('issues');

  const getTrimesterFromDate = (dateStr: string): number => {
    if (!dateStr) return 1;
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const month = parseInt(parts[1], 10);
      if (month >= 9 && month <= 12) return 1;
      if (month >= 1 && month <= 3) return 2;
      return 3;
    }
    return 1;
  };

  useEffect(() => {
    setLoading(true);
    const qS = query(
      collection(db, 'students'), 
      where('classId', '==', classId),
      where('teacherId', '==', teacherId)
    );
    const qA = query(
      collection(db, 'assessments'), 
      where('classId', '==', classId),
      where('teacherId', '==', teacherId)
    );
    const qG = query(
      collection(db, 'grades'), 
      where('classId', '==', classId),
      where('teacherId', '==', teacherId)
    );
    const qAtt = query(
      collection(db, 'attendance'), 
      where('classId', '==', classId),
      where('teacherId', '==', teacherId)
    );

    let studentsLoaded = false;
    let assessmentsLoaded = false;
    let gradesLoaded = false;
    let classLoaded = false;
    let attendanceLoaded = false;

    const checkLoading = () => {
      if (studentsLoaded && assessmentsLoaded && gradesLoaded && classLoaded && attendanceLoaded) {
        setLoading(false);
      }
    };

    const unsubC = onSnapshot(doc(db, 'classes', classId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Class;
        setClassName(data.name);
        setClassData(data);
      }
      classLoaded = true;
      checkLoading();
    }, (error) => handleFirestoreError(error, OperationType.GET, `classes/${classId}`));

    const unsubS = onSnapshot(qS, (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      studentsLoaded = true;
      checkLoading();
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'analytics_data'));

    const unsubA = onSnapshot(qA, (snap) => {
      setAssessments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assessment)));
      assessmentsLoaded = true;
      checkLoading();
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'analytics_data'));

    const unsubG = onSnapshot(qG, (snap) => {
      const gradeMap: Record<string, number> = {};
      snap.docs.forEach(doc => {
        const data = doc.data() as Grade;
        gradeMap[`${data.studentId}_${data.assessmentId}`] = data.score;
      });
      setGrades(gradeMap);
      gradesLoaded = true;
      checkLoading();
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'analytics_data'));

    const unsubAtt = onSnapshot(qAtt, (snap) => {
      setAttendances(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
      attendanceLoaded = true;
      checkLoading();
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendance'));

    return () => {
      unsubC();
      unsubS();
      unsubA();
      unsubG();
      unsubAtt();
    };
  }, [classId, teacherId]);

  const getStudentAnalysis = (studentId: string) => {
    const studentRecords = attendances.filter(a => a.studentId === studentId);
    const stats = getDetailedStats(studentId, studentRecords);
    return {
      summary: stats.summary,
      recommendation: stats.recommendation
    };
  };

  const getStudentAverage = (studentId: string) => {
    const weights = classData?.trimesterWeights || { 1: 33.33, 2: 33.33, 3: 33.34 };
    let totalContribution = 0;
    let totalWeightUsed = 0;

    [1, 2, 3].forEach(t => {
      const trimesterAssessments = assessments.filter(a => a.trimester === t);
      let tTotalWeight = 0;
      let tEarnedWeight = 0;
      
      trimesterAssessments.forEach(a => {
        const g = grades[`${studentId}_${a.id}`];
        if (g !== undefined) {
          tEarnedWeight += g * a.weight;
          tTotalWeight += a.weight;
        }
      });

      if (tTotalWeight > 0) {
        const trimesterAvg = tEarnedWeight / tTotalWeight;
        const trimesterWeight = (weights[t as keyof typeof weights] || 33.33) / 100;
        totalContribution += trimesterAvg * trimesterWeight;
        totalWeightUsed += trimesterWeight;
      }
    });

    if (totalWeightUsed === 0) return 0;
    // Normalize if not all trimesters have grades yet
    return parseFloat((totalContribution / totalWeightUsed).toFixed(2));
  };

  const getDetailedStats = (studentId: string, studentAttendanceRecords?: Attendance[]) => {
    const studentGrades = assessments.map(a => ({
      ...a,
      score: grades[`${studentId}_${a.id}`]
    })).filter(g => g.score !== undefined);

    const attRecs = studentAttendanceRecords || attendances.filter(a => a.studentId === studentId);
    const totalSessions = attRecs.length;
    const absentsCount = attRecs.filter(a => a.status === 'absent').length;
    const latesCount = attRecs.filter(a => a.status === 'late').length;
    const presentsCount = attRecs.filter(a => a.status === 'present').length;
    const attendanceRate = totalSessions > 0 ? Math.round(((presentsCount + latesCount * 0.5) / totalSessions) * 100) : 100;

    const trimesterAvgs = [1, 2, 3].map(t => {
      const tGrades = studentGrades.filter(g => g.trimester === t);
      const totalW = tGrades.reduce((sum, g) => sum + g.weight, 0);
      const earnedW = tGrades.reduce((sum, g) => sum + (g.score || 0) * g.weight, 0);
      return {
        trimester: `T${t}`,
        avg: totalW === 0 ? null : parseFloat((earnedW / totalW).toFixed(2))
      };
    });

    const strongPoints = studentGrades.filter(g => (g.score || 0) >= 8).sort((a, b) => (b.score || 0) - (a.score || 0));
    const mediumPoints = studentGrades.filter(g => (g.score || 0) >= 5 && (g.score || 0) < 8).sort((a, b) => (b.score || 0) - (a.score || 0));
    const weakPoints = studentGrades.filter(g => (g.score || 0) < 5).sort((a, b) => (a.score || 0) - (b.score || 0));

    const scores = studentGrades.map(g => g.score || 0);
    const max = scores.length > 0 ? Math.max(...scores) : 0;
    const min = scores.length > 0 ? Math.min(...scores) : 0;
    const labels = studentGrades.map(g => g.title);

    const typeStats = {
      exam: studentGrades.filter(g => g.type === 'exam'),
      work: studentGrades.filter(g => g.type === 'work')
    };

    const examAvg = typeStats.exam.length > 0 
      ? typeStats.exam.reduce((sum, g) => sum + (g.score || 0), 0) / typeStats.exam.length 
      : 0;
    const workAvg = typeStats.work.length > 0 
      ? typeStats.work.reduce((sum, g) => sum + (g.score || 0), 0) / typeStats.work.length 
      : 0;

    const getPerformanceSummary = (
      avg: number, 
      allGrades: any[], 
      trimesters: any[], 
      strongPoints: any[], 
      weakPoints: any[],
      attData: { total: number, absents: number, lates: number, rate: number }
    ) => {
      if (allGrades.length === 0 && attData.total === 0) {
        return "No hay suficientes datos registrados para elaborar un análisis completo de rendimiento ni asistencia. A medida que se añadan evaluaciones y registros de aula, se generará una visión integral del estudiante.";
      }
      
      let base = "";
      if (avg >= 9) base = `Rendimiento global sobresaliente (${avg.toFixed(1)}). El estudiante demuestra una asimilación excelente de los contenidos, destacando por su solvencia intelectual y dedicación en el aula.`;
      else if (avg >= 7) base = `Buen desempeño general (${avg.toFixed(1)}). El estudiante sigue satisfactoriamente el ritmo del currículo y muestra un entendimiento sólido de las competencias fundamentales.`;
      else if (avg >= 5) base = `Aprobado ajustado (${avg.toFixed(1)}). Se aprecian las competencias mínimas de la materia, aunque los resultados presentan oscilaciones que indican conceptos clave aún por consolidar.`;
      else if (allGrades.length > 0) base = `Rendimiento actualmente insuficiente (${avg.toFixed(1)}). El progreso académico no alcanza los objetivos mínimos previstos, requiriendo un plan de apoyo y seguimiento prioritario.`;
      else base = "Aún no se dispone de calificaciones cuantitativas registradas para este alumno/a.";

      // Trayectoria de trimestres
      const validTrimesters = trimesters.filter(t => t.avg !== null);
      if (validTrimesters.length >= 2) {
        const first = validTrimesters[0].avg;
        const last = validTrimesters[validTrimesters.length - 1].avg;
        const diff = last - first;
        
        if (diff > 1) {
          base += ` La evolución académica es claramente positiva a lo largo del curso, con una marcada capacidad de superación.`;
        } else if (diff > 0) {
          base += ` La trayectoria trimestral mantiene una curva de mejora continua y progresiva.`;
        } else if (diff > -1) {
          base += ` La progresión se mantiene estable con ligeras fluctuaciones normales dentro del año escolar.`;
        } else {
          base += ` Sin embargo, se observa una tendencia negativa entre trimestres, con una pérdida de rendimiento respecto al inicio del curso.`;
        }
      } else if (validTrimesters.length === 1 && allGrades.length >= 3) {
        const recentScores = allGrades.slice(-3).map(g => g.score || 0);
        const isImproving = recentScores[recentScores.length - 1] > recentScores[0];
        if (isImproving) base += " Se detecta en el corto plazo una tendencia de mejora a través de las evaluaciones más recientes.";
        else base += " Se observa cierto estancamiento en las últimas evaluaciones del trimestre.";
      }

      // Strongest points
      if (strongPoints.length > 0) {
        const best = strongPoints[0];
        base += ` Destaca especialmente su nivel en "${best.title}" con una nota de ${best.score}.`;
      }

      // Integración de asistencia en el resumen pedagógico
      if (attData.total > 0) {
        if (attData.rate >= 95 && attData.absents === 0 && attData.lates === 0) {
          base += ` En cuanto a la asistencia y compromiso presencial, presenta una regularidad impecable (${attData.rate}% de asistencia, sin faltas ni retrasos), lo que favorece enormemente la continuidad del aprendizaje.`;
        } else if (attData.rate >= 90) {
          if (attData.lates > 0) {
            base += ` Su asistencia es buena (${attData.rate}%), aunque acumula ${attData.lates} retraso${attData.lates > 1 ? 's' : ''} que conviene corregir para no interrumpir el arranque de las sesiones.`;
          } else {
            base += ` Mantiene un buen compromiso de asistencia (${attData.rate}%) con un ritmo continuado en las clases.`;
          }
        } else if (attData.rate >= 80) {
          base += ` En la vertiente de asistencia presenta cierta intermitencia (${attData.rate}%), acumulando ${attData.absents} ausencia${attData.absents > 1 ? 's' : ''}${attData.lates > 0 ? ` y ${attData.lates} retraso${attData.lates > 1 ? 's' : ''}` : ''}, factor que incide de manera directa en el seguimiento de explicaciones y entregas.`;
        } else {
          base += ` A nivel de asistencia se detecta una situación preocupante (${attData.rate}% de asistencia global) con ${attData.absents} falta${attData.absents > 1 ? 's' : ''} registrada${attData.absents > 1 ? 's' : ''}. Este elevado absentismo está condicionando gravemente su progresión curricular.`;
        }
      }

      return base;
    };

    const getImprovementText = (
      eAvg: number, 
      wAvg: number, 
      wPoints: any[], 
      mPoints: any[],
      attData: { total: number, absents: number, lates: number, rate: number }
    ) => {
      const tips = [];
      
      // Attendance & punctuality recommendations
      if (attData.total > 0) {
        if (attData.rate < 85 || attData.absents >= 4) {
          tips.push(`Prioridad de asistencia: Resulta imprescindible reducir las ${attData.absents} ausencias acumuladas (índice actual del ${attData.rate}%). Las faltas reiteradas provocan desconexión con los contenidos diarios y dificultades para preparar exámenes.`);
        }
        if (attData.lates >= 3) {
          tips.push(`Puntualidad en el aula: Acumula ${attData.lates} retrasos. Se recomienda establecer una rutina de llegada más rigurosa para no perder el planteamiento inicial de las sesiones ni la explicación de pautas.`);
        }
      }

      if (eAvg > 0 && wAvg > 0) {
        if (eAvg < wAvg - 1.5) {
          tips.push("Se observa un desempeño más bajo en pruebas escritas y exámenes frente al trabajo diario o de clase. Se sugiere fomentar dinámicas de repaso activo, autoevaluaciones previas y pautas para gestionar los nervios ante exámenes.");
        } else if (wAvg < eAvg - 1.5) {
          tips.push("El rendimiento en exámenes es bueno, pero las tareas y actividades diarias obtienen resultados inferiores. Conviene reforzar la disciplina de entrega en fecha y la profundidad en los trabajos de clase.");
        } else {
          tips.push("Mantiene un perfil equilibrado entre exámenes y trabajo continuo, reflejando constancia en el proceso formativo.");
        }
      }

      if (wPoints.length > 0) {
        const weakest = wPoints[0];
        tips.push(`Refuerzo temático: Es prioritario repasar los contenidos correspondientes a "${weakest.title}" (calificación: ${weakest.score}), dado que representa la mayor área de mejora curricular.`);
      } else if (mPoints.length > 0) {
        const medium = mPoints[0];
        tips.push(`Consolidación de aprobados: Para dar el salto a notas superiores, se aconseja afianzar materias intermedias como "${medium.title}" (nota: ${medium.score}).`);
      }

      if (tips.length === 0) {
        if (attData.rate >= 90) {
          return "El estudiante mantiene unos hábitos de trabajo, asistencia y rendimiento muy equilibrados. Se sugiere mantener este nivel de rigor y ofrecer actividades de ampliación o retos voluntarios para potenciar aún más sus capacidades.";
        }
        return "El alumno/a se encuentra en un punto en que no se detectan lagunas conceptuales críticas. Se aconseja mantener y reforzar la constancia diaria en el aula.";
      }

      return tips.join(" ");
    };

    const overallAvg = getStudentAverage(studentId);
    const attData = {
      total: totalSessions,
      absents: absentsCount,
      lates: latesCount,
      rate: attendanceRate
    };

    return { 
      trimesterAvgs, 
      strongPoints, 
      mediumPoints, 
      weakPoints, 
      examAvg, 
      workAvg,
      summary: getPerformanceSummary(overallAvg, studentGrades, trimesterAvgs, strongPoints, weakPoints, attData),
      recommendation: getImprovementText(examAvg, workAvg, weakPoints, mediumPoints, attData),
      max,
      min,
      labels,
      attendance: attData
    };
  };

  const chartData = students.map(s => ({
    id: s.id,
    name: s.lastName ? `${s.lastName}, ${s.name}` : s.name,
    avg: getStudentAverage(s.id),
    student: s
  })).sort((a, b) => b.avg - a.avg);

  const averageClass = chartData.length > 0 
    ? (chartData.reduce((sum, s) => sum + s.avg, 0) / chartData.length).toFixed(2)
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground tracking-tight">Rendimiento y Estadística</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
              onClick={() => setShowTutorial(true)}
            >
              <HelpCircle className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium tracking-tight">Análisis global de la clase y perfiles individuales.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-2xl bg-card/60 backdrop-blur-sm border-border shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Media de la Clase</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-display font-black text-primary">{averageClass}</div>
                <p className="text-xs text-muted-foreground italic mt-1">Tendencia estable</p>
            </CardContent>
          </Card>
      </div>

      <Card className="rounded-2xl bg-card/40 backdrop-blur-md border-border shadow-xl overflow-hidden">
        <CardHeader className="bg-card/20 border-b border-border/40 px-4 sm:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="font-display font-bold text-foreground text-lg sm:text-xl">Rendimiento por Alumno</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Haz clic en una barra del gráfico o selecciona un alumno en el desplegable para ver su ficha pedagógica.</p>
            </div>
            {students.length > 0 && (
              <div className="w-full sm:w-[260px]">
                <Select 
                  value={selectedStudent?.id || ''} 
                  onValueChange={(val) => {
                    const found = students.find(s => s.id === val);
                    if (found) setSelectedStudent(found);
                  }}
                >
                  <SelectTrigger className="w-full h-10 bg-card/70 border-border rounded-xl text-xs sm:text-sm font-medium">
                    <SelectValue placeholder="Ver ficha de alumno...">
                      {selectedStudent ? (selectedStudent.lastName ? `${selectedStudent.lastName}, ${selectedStudent.name}` : selectedStudent.name) : 'Ver ficha de alumno...'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.lastName ? `${s.lastName}, ${s.name}` : s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 sm:pt-10 px-2 sm:px-6">
          <div className="h-[300px] sm:h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#CBD5E1" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: '#64748B', fontWeight: 600 }} 
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} domain={[0, 10]} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.2)' }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255,255,255,0.9)', 
                    backdropFilter: 'blur(8px)',
                    borderRadius: '12px', 
                    border: '1px solid white', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '10px'
                  }}
                />
                <Bar 
                  dataKey="avg" 
                  radius={[4, 4, 0, 0]} 
                  barSize={Math.max(24, Math.min(40, 100 / chartData.length))}
                  className="cursor-pointer touch-manipulation"
                  onClick={(data) => {
                    if (data && data.payload) {
                      setSelectedStudent(data.payload.student);
                    }
                  }}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.avg < 5 ? '#EF4444' : '#4F46E5'} 
                      fillOpacity={0.8} 
                      className="hover:fill-opacity-100 transition-all cursor-pointer" 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {selectedStudent && (() => {
        // Attendance calculations for the selected student
        const studentRecords = attendances
          .filter(a => a.studentId === selectedStudent.id)
          .sort((a, b) => b.date.localeCompare(a.date));

        const stats = getDetailedStats(selectedStudent.id, studentRecords);
        const overallAvg = getStudentAverage(selectedStudent.id);
        const analysis = {
          summary: stats.summary,
          recommendation: stats.recommendation
        };

        const getTrimesterStats = (tri: number | 'all') => {
          const recs = tri === 'all' 
            ? studentRecords 
            : studentRecords.filter(a => getTrimesterFromDate(a.date) === tri);
          const presents = recs.filter(a => a.status === 'present').length;
          const absents = recs.filter(a => a.status === 'absent').length;
          const lates = recs.filter(a => a.status === 'late').length;
          const total = recs.length;
          const rate = total > 0 ? Math.round(((presents + lates * 0.5) / total) * 100) : 100;
          return { recs, presents, absents, lates, total, rate };
        };

        const allAttStats = getTrimesterStats('all');
        const t1AttStats = getTrimesterStats(1);
        const t2AttStats = getTrimesterStats(2);
        const t3AttStats = getTrimesterStats(3);

        const currentAttStats = attendanceTrimester === 'all' ? allAttStats :
                               attendanceTrimester === '1' ? t1AttStats :
                               attendanceTrimester === '2' ? t2AttStats : t3AttStats;

        const filteredDays = currentAttStats.recs.filter(a => {
          if (attendanceFilterType === 'issues') return a.status === 'absent' || a.status === 'late';
          if (attendanceFilterType === 'absent') return a.status === 'absent';
          if (attendanceFilterType === 'late') return a.status === 'late';
          if (attendanceFilterType === 'present') return a.status === 'present';
          return true;
        });

        const formatSpanishDate = (dateStr: string) => {
          try {
            const d = new Date(dateStr + 'T00:00:00');
            const formatted = format(d, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
            return formatted.charAt(0).toUpperCase() + formatted.slice(1);
          } catch (e) {
            return dateStr;
          }
        };

        return (
          <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
            <DialogContent className="sm:max-w-[760px] w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto sm:rounded-3xl p-0 border-none shadow-2xl bg-card flex flex-col">
              <div className="bg-primary p-6 sm:p-8 text-white relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-card/10 rounded-full -mr-20 -mt-20 blur-3xl animate-pulse" />
                
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="absolute top-4 right-4 sm:hidden p-2 hover:bg-card/10 rounded-full transition-colors"
                >
                  <ChevronRight className="w-6 h-6 rotate-180" />
                </button>
                <DialogHeader className="space-y-0 text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className="bg-card/20 border-border/20 text-white hover:bg-card/30 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider">
                      Perfil del Alumno
                    </Badge>
                  </div>
                  <DialogTitle className="text-2xl sm:text-3xl font-display font-black tracking-tight text-white line-clamp-1 pr-10">
                    {selectedStudent.lastName ? `${selectedStudent.lastName}, ${selectedStudent.name}` : selectedStudent.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="mt-6 flex flex-wrap gap-4 items-center">
                  <div className="bg-card/20 backdrop-blur-md rounded-2xl p-4 flex items-center gap-4 border border-border/20">
                    <div className="w-12 h-12 rounded-xl bg-card text-primary flex items-center justify-center font-black text-xl shadow-lg ring-4 ring-white/10 shrink-0">
                      {overallAvg}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-white/70 tracking-widest leading-tight">Media Global</div>
                      <div className="text-sm font-bold text-white font-mono">{overallAvg >= 5 ? 'Aprobado' : 'Suspenso'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-8 flex-1">
                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-muted p-4 rounded-2xl border border-border">
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Nota Media</div>
                    <div className={`text-2xl font-black ${overallAvg >= 5 ? 'text-primary' : 'text-rose-500'}`}>
                      {overallAvg.toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-muted p-4 rounded-2xl border border-border">
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Nota Máxima</div>
                    <div className="text-2xl font-black text-emerald-500">{stats.max.toFixed(1)}</div>
                  </div>
                  <div className="bg-muted p-4 rounded-2xl border border-border">
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Nota Mínima</div>
                    <div className="text-2xl font-black text-rose-400">{stats.min.toFixed(1)}</div>
                  </div>
                </div>

                {/* Trimester chart */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Trayectoria Académica
                  </h3>
                  <div className="h-[200px] w-full bg-card rounded-3xl p-4 shadow-sm border border-border">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.trimesterAvgs}>
                        <defs>
                          <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="trimester" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94A3B8' }} />
                        <YAxis hide domain={[0, 10]} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="avg" 
                          stroke="#4F46E5" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorAvg)" 
                          connectNulls={true}
                          dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: 'white' }}
                          activeDot={{ r: 6, fill: '#4F46E5', stroke: 'white', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Attendance and Absences by Trimester */}
                <div className="space-y-4 pt-2 border-t border-border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">
                          Asistencia y Faltas por Trimestre
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                          Control de ausencias, retrasos y fechas exactas de faltas.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`font-mono text-xs px-2.5 py-1 rounded-lg ${
                        allAttStats.rate >= 90 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' :
                        allAttStats.rate >= 75 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' :
                        'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                      }`}>
                        {allAttStats.rate}% Asistencia Global
                      </Badge>
                    </div>
                  </div>

                  {/* Quick Trimester Breakdown Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: '1º Trimestre', tri: '1' as const, data: t1AttStats },
                      { label: '2º Trimestre', tri: '2' as const, data: t2AttStats },
                      { label: '3º Trimestre', tri: '3' as const, data: t3AttStats }
                    ].map(({ label, tri, data }) => (
                      <button
                        key={tri}
                        type="button"
                        onClick={() => setAttendanceTrimester(tri)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          attendanceTrimester === tri
                            ? 'bg-primary/10 border-primary ring-2 ring-primary/20'
                            : 'bg-muted/40 border-border hover:bg-muted/70'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-foreground">{label}</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-card border border-border">
                            {data.total} sesiones
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-center">
                          <div className="bg-emerald-500/10 rounded-lg py-1 border border-emerald-500/20">
                            <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Asist.</div>
                            <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">{data.presents}</div>
                          </div>
                          <div className="bg-rose-500/10 rounded-lg py-1 border border-rose-500/20">
                            <div className="text-[9px] text-rose-600 dark:text-rose-400 font-bold uppercase">Faltas</div>
                            <div className="text-xs font-black text-rose-600 dark:text-rose-400">{data.absents}</div>
                          </div>
                          <div className="bg-amber-500/10 rounded-lg py-1 border border-amber-500/20">
                            <div className="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase">Retrasos</div>
                            <div className="text-xs font-black text-amber-600 dark:text-amber-400">{data.lates}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Trimester Tabs and Detailed Day Inspection */}
                  <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
                      <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
                        {[
                          { id: 'all', label: 'Todo el Curso' },
                          { id: '1', label: '1º Trimestre' },
                          { id: '2', label: '2º Trimestre' },
                          { id: '3', label: '3º Trimestre' }
                        ].map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setAttendanceTrimester(t.id as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              attendanceTrimester === t.id
                                ? 'bg-card text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      <div className="text-xs text-muted-foreground font-medium">
                        {currentAttStats.total} fechas registradas
                      </div>
                    </div>

                    {/* Filter chips */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAttendanceFilterType('issues')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                          attendanceFilterType === 'issues'
                            ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 shadow-xs ring-1 ring-rose-500/30'
                            : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        Ausencias y Retrasos ({currentAttStats.absents + currentAttStats.lates})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendanceFilterType('absent')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                          attendanceFilterType === 'absent'
                            ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                            : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Solo Faltas ({currentAttStats.absents})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendanceFilterType('late')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                          attendanceFilterType === 'late'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Solo Retrasos ({currentAttStats.lates})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendanceFilterType('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                          attendanceFilterType === 'all'
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        Ver Todos ({currentAttStats.total})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendanceFilterType('present')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                          attendanceFilterType === 'present'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Solo Asistencias ({currentAttStats.presents})
                      </button>
                    </div>

                    {/* Detailed List of Days */}
                    <div className="pt-2">
                      {filteredDays.length > 0 ? (
                        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                          {filteredDays.map((rec, idx) => {
                            const tri = getTrimesterFromDate(rec.date);
                            const isAbsent = rec.status === 'absent';
                            const isLate = rec.status === 'late';
                            const isPresent = rec.status === 'present';

                            return (
                              <div
                                key={`${rec.date}_${idx}`}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                  isAbsent
                                    ? 'bg-rose-500/10 border-rose-500/30'
                                    : isLate
                                    ? 'bg-amber-500/10 border-amber-500/30'
                                    : 'bg-card border-border/80 hover:bg-muted/40'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                      isAbsent
                                        ? 'bg-rose-500 text-white'
                                        : isLate
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                    }`}
                                  >
                                    {isAbsent && <XCircle className="w-4 h-4" />}
                                    {isLate && <Clock className="w-4 h-4" />}
                                    {isPresent && <CheckCircle2 className="w-4 h-4" />}
                                  </div>
                                  <div>
                                    <div className="text-xs sm:text-sm font-bold text-foreground">
                                      {formatSpanishDate(rec.date)}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                      Fecha: {rec.date}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] font-bold border-border/80">
                                    {tri}º Trimestre
                                  </Badge>
                                  {isAbsent && (
                                    <Badge className="bg-rose-500 text-white hover:bg-rose-600 text-[11px] font-bold px-2.5 py-1">
                                      Falta / Ausencia
                                    </Badge>
                                  )}
                                  {isLate && (
                                    <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[11px] font-bold px-2.5 py-1">
                                      Retraso
                                    </Badge>
                                  )}
                                  {isPresent && (
                                    <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-bold px-2.5 py-1">
                                      Asistencia
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-6 text-center rounded-xl bg-muted/30 border border-dashed border-border space-y-2">
                          {attendanceFilterType === 'issues' && (currentAttStats.absents + currentAttStats.lates === 0) ? (
                            <div className="flex flex-col items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-8 h-8 stroke-[2]" />
                              <div className="text-sm font-bold">¡Sin faltas ni retrasos registrados!</div>
                              <p className="text-xs text-muted-foreground max-w-sm">
                                Este alumno no tiene ausencias ni llegadas tarde registradas en el periodo seleccionado ({attendanceTrimester === 'all' ? 'Todo el Curso' : `${attendanceTrimester}º Trimestre`}).
                              </p>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground italic">
                              No hay registros que coincidan con el filtro seleccionado para este periodo.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Strengths, Meds and Weaknesses */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-500" />
                      Fuertes
                    </h3>
                    <div className="space-y-2">
                      {stats.strongPoints.length > 0 ? stats.strongPoints.slice(0, 3).map((g, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {g.score}
                            </div>
                            <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 line-clamp-2 leading-snug">{g.title}</div>
                          </div>
                        </div>
                      )) : <div className="text-xs text-muted-foreground italic p-4 text-center bg-card rounded-xl border border-dashed">Sin evaluaciones excelentes</div>}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" />
                      Intermedios
                    </h3>
                    <div className="space-y-2">
                      {stats.mediumPoints.length > 0 ? stats.mediumPoints.slice(0, 3).map((g, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-primary/10 rounded-xl border border-primary/10">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/100 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {g.score}
                            </div>
                            <div className="text-xs font-semibold text-primary line-clamp-2 leading-snug">{g.title}</div>
                          </div>
                        </div>
                      )) : <div className="text-xs text-muted-foreground italic p-4 text-center bg-card rounded-xl border border-dashed">Sin evaluaciones medias</div>}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      A Mejorar
                    </h3>
                    <div className="space-y-2">
                      {stats.weakPoints.length > 0 ? stats.weakPoints.slice(0, 3).map((g, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {g.score}
                            </div>
                            <div className="text-xs font-semibold text-rose-800 dark:text-rose-300 line-clamp-2 leading-snug">{g.title}</div>
                          </div>
                        </div>
                      )) : <div className="text-xs text-muted-foreground italic p-4 text-center bg-card rounded-xl border border-dashed">Sin insuficientes</div>}
                    </div>
                  </div>
                </div>

                {/* Pedagogical Insights - MOVED TO THE BOTTOM */}
                <div className="space-y-4 pt-6 border-t border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-display font-bold text-foreground">Conclusiones y Recomendaciones</h3>
                  </div>
                  
                  <div className="grid gap-4">
                    <div className="group bg-muted p-5 rounded-2xl border border-border transition-all">
                      <div className="text-muted-foreground font-black text-[10px] uppercase tracking-widest mb-1 flex items-center gap-2">
                        <Activity className="w-3 h-3 text-primary" /> Puntos Clave del Periodo
                      </div>
                      <p className="text-foreground text-xs leading-relaxed font-medium">
                        {analysis.summary}
                      </p>
                    </div>
                    
                    <div className="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/20">
                      <div className="text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest mb-1 flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> Sugerencias de Mejora
                      </div>
                      <p className="text-emerald-700 dark:text-emerald-400 text-xs leading-relaxed font-bold">
                        {analysis.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      <Dialog open={showTutorial} onOpenChange={closeTutorial}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <span className="p-2 bg-primary/10 rounded-xl">
                <HelpCircle className="w-6 h-6 text-primary" />
              </span>
              Guía de Analíticas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <p className="text-muted-foreground text-sm">
              Aquí puedes visualizar los resultados globales y la progresión de tus estudiantes a lo largo del curso.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-2 font-bold text-base">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Rendimiento Global
                </div>
                <p className="text-xs text-muted-foreground">
                  Compara la nota media general con gráficos interactivos y visualiza estadísticas demográficas de los aprobados vs suspensos.
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-2 font-bold text-base">
                  <Target className="w-5 h-5 text-purple-500" />
                  Perfiles Individuales
                </div>
                <p className="text-xs text-muted-foreground">
                  Haz click en cualquier alumno del ránking para abrir una tarjeta detallada de su rendimiento, con puntos fuertes y débiles.
                </p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3">
              <Lightbulb className="w-6 h-6 text-primary shrink-0" />
              <div>
                <h4 className="font-bold text-sm mb-1 text-primary">Interpretaciones IA</h4>
                <div className="text-xs text-muted-foreground space-y-2">
                  <p>En el perfil individual de un alumno, la aplicación calcula y sugiere planes de acción automatizados que te pueden ahorrar tiempo a la hora de informar a los padres sobre debilidades en el rendimiento.</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button className="w-full sm:w-auto" onClick={closeTutorial}>¡Entendido!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
