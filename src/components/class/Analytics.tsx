import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Student, Assessment, Grade } from '@/src/types';
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
  ChevronRight
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { HelpCircle, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Analytics({ classId, teacherId }: { classId: string, teacherId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [className, setClassName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenAnalyticsTutorial');
    if (!hasSeen) {
      setShowTutorial(true);
    }
  }, []);

  const closeTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('hasSeenAnalyticsTutorial', 'true');
  };

  const fetchData = async () => {
    try {
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

      const [snapS, snapA, snapG, snapC] = await Promise.all([
        getDocs(qS), 
        getDocs(qA), 
        getDocs(qG),
        getDoc(doc(db, 'classes', classId))
      ]);

      if (snapC.exists()) {
        setClassName(snapC.data().name);
      }

      setStudents(snapS.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setAssessments(snapA.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assessment)));

      const gradeMap: Record<string, number> = {};
      snapG.docs.forEach(doc => {
        const data = doc.data() as Grade;
        gradeMap[`${data.studentId}_${data.assessmentId}`] = data.score;
      });
      setGrades(gradeMap);
    } catch (error) {
       handleFirestoreError(error, OperationType.LIST, 'analytics_data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [classId, teacherId]);

  const getStudentAnalysis = (studentId: string) => {
    const stats = getDetailedStats(studentId);
    return {
      summary: stats.summary,
      recommendation: stats.recommendation
    };
  };

  const getStudentAverage = (studentId: string) => {
    let totalWeight = 0;
    let earnedWeight = 0;
    assessments.forEach(a => {
      const g = grades[`${studentId}_${a.id}`];
      if (g !== undefined) {
        earnedWeight += g * a.weight;
        totalWeight += a.weight;
      }
    });
    return totalWeight === 0 ? 0 : parseFloat((earnedWeight / totalWeight).toFixed(2));
  };

  const getDetailedStats = (studentId: string) => {
    const studentGrades = assessments.map(a => ({
      ...a,
      score: grades[`${studentId}_${a.id}`]
    })).filter(g => g.score !== undefined);

    const trimesterAvgs = [1, 2, 3].map(t => {
      const tGrades = studentGrades.filter(g => g.trimester === t);
      const totalW = tGrades.reduce((sum, g) => sum + g.weight, 0);
      const earnedW = tGrades.reduce((sum, g) => sum + (g.score || 0) * g.weight, 0);
      return {
        trimester: `T${t}`,
        avg: totalW === 0 ? 0 : parseFloat((earnedW / totalW).toFixed(2))
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

    const getPerformanceSummary = (avg: number, allGrades: any[], trimesters: any[], strongPoints: any[], weakPoints: any[]) => {
      if (allGrades.length === 0) return "No hay suficientes datos registrados para elaborar un análisis completo de rendimiento. A medida que se añadan evaluaciones, se generará una visión detallada de la progresión del estudiante.";
      
      let base = "";
      if (avg >= 9) base = `Rendimiento global sobresaliente (${avg.toFixed(1)}). El estudiante demuestra una excelente asimilación de los conceptos planificados, destacando especialmente por su capacidad resolutiva y compromiso con la asignatura.`;
      else if (avg >= 7) base = `Buen desempeño general (${avg.toFixed(1)}). El estudiante sigue de forma satisfactoria el ritmo del currículo, mostrando un entendimiento sólido de las competencias fundamentales.`;
      else if (avg >= 5) base = `Aprobado ajustado (${avg.toFixed(1)}). Se aprecian las asimilaciones básicas de la materia, aunque los resultados presentan cierta inestabilidad que indica que hay conceptos aún no afianzados completamente.`;
      else base = `Rendimiento actualmente insuficiente (${avg.toFixed(1)}). El progreso académico no está alcanzando los objetivos mínimos. Se requiere intervenir y apoyar para evitar lagunas significativas.`;

      // Trayectoria de trimestres
      const validTrimesters = trimesters.filter(t => t.avg > 0);
      if (validTrimesters.length >= 2) {
        const first = validTrimesters[0].avg;
        const last = validTrimesters[validTrimesters.length - 1].avg;
        const diff = last - first;
        
        if (diff > 1) {
          base += ` La evolución es claramente positiva a lo largo del curso, mostrando una gran capacidad de superación tras los primeros resultados.`;
        } else if (diff > 0) {
          base += ` La trayectoria trimestral mantiene una curva de mejora constante y ascendente de trimestre en trimestre.`;
        } else if (diff > -1) {
          base += ` La trayectoria de progreso se mantiene relativamente estable, si bien con ligeras fluctuaciones normales dentro del curso.`;
        } else {
          base += ` Sin embargo, se observa una tendencia negativa en la trayectoria a lo largo de los trimestres, con una pérdida de rendimiento notable respecto al inicio del curso.`;
        }
      } else if (validTrimesters.length === 1 && allGrades.length >= 3) {
        const recentScores = allGrades.slice(-3).map(g => g.score || 0);
        const isImproving = recentScores[recentScores.length - 1] > recentScores[0];
        if (isImproving) base += " Se puede apreciar en el corto plazo una tendencia de mejora a través de las evaluaciones más recientes del trimestre en curso.";
        else base += " Se observa cierto estancamiento en las últimas evaluaciones respecto al principio de este mismo trimestre.";
      }

      // Strongest points
      if (strongPoints.length > 0) {
        const best = strongPoints[0];
        base += ` Cabe destacar especialmente el excelente nivel demostrado en "${best.title}" con una calificación de ${best.score}.`;
      }

      return base;
    };

    const getImprovementText = (eAvg: number, wAvg: number, wPoints: any[], mPoints: any[]) => {
      const tips = [];
      
      if (eAvg > 0 && wAvg > 0) {
        if (eAvg < wAvg - 1.5) {
          tips.push("Se observa un desempeño más bajo en las pruebas objetivas (exámenes) frente al trabajo diario o de investigación. Se sugiere fomentar dinámicas de repaso activo y técnicas de estudio para el control de nervios en exámenes.");
        } else if (wAvg < eAvg - 1.5) {
          tips.push("El rendimiento en exámenes es bueno pero los resultados en trabajos y tareas diarias son inferiores. Es sumamente recomendable mejorar la planificación, la entrega en tiempo oportuno y el enfoque general en las actividades evaluables.");
        } else {
          tips.push("Mantiene un perfil de evaluación bastante equilibrado entre pruebas escritas y actividades regulares, lo cual demuestra una competencia estable.");
        }
      }

      if (wPoints.length > 0) {
        const weakest = wPoints[0];
        tips.push(`Como aspecto prioritario de refuerzo, es altamente recomendable revisar y afianzar la materia relativa a "${weakest.title}" (nota actual: ${weakest.score}). Esta evaluación supone actualmente la mayor debilidad curricular del alumno/a, y subsanarla ayudará enormemente al progreso académico.`);
      } else if (mPoints.length > 0) {
        const medium = mPoints[0];
        tips.push(`Para aspirar a la excelencia, sería de gran utilidad repasar y consolidar temas donde se ha obtenido un aprobado modesto, como "${medium.title}" (calificación de ${medium.score}).`);
      }

      if (tips.length === 0) {
        return "El alumno/a se encuentra en un punto en que no se detectan lagunas conceptuales críticas. La principal sugerencia es mantener y reforzar los actuales hábitos de estudio, introduciendo posibles retos o actividades extra de ampliación para fortalecer sus fortalezas.";
      }

      return tips.join(" ");
    };

    const overallAvg = getStudentAverage(studentId);

    return { 
      trimesterAvgs, 
      strongPoints, 
      mediumPoints, 
      weakPoints, 
      examAvg, 
      workAvg,
      summary: getPerformanceSummary(overallAvg, studentGrades, trimesterAvgs, strongPoints, weakPoints),
      recommendation: getImprovementText(examAvg, workAvg, weakPoints, mediumPoints),
      max,
      min,
      labels
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
            <h2 className="text-xl sm:text-2xl font-display font-bold font-black text-foreground tracking-tight">Rendimiento y Estadística</h2>
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
                <p className="text-[10px] text-muted-foreground italic mt-1">Tendencia estable</p>
            </CardContent>
          </Card>
      </div>

      <Card className="rounded-2xl bg-card/40 backdrop-blur-md border-border shadow-xl overflow-hidden">
        <CardHeader className="bg-card/20 border-b border-border/40 px-4 sm:px-8 py-4 sm:py-6">
          <CardTitle className="font-display font-bold text-foreground text-lg sm:text-xl">Rendimiento por Alumno</CardTitle>
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
        const stats = getDetailedStats(selectedStudent.id);
        const overallAvg = getStudentAverage(selectedStudent.id);
        const analysis = getStudentAnalysis(selectedStudent.id);
        
        return (
          <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
            <DialogContent className="sm:max-w-[700px] w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto sm:rounded-3xl p-0 border-none shadow-2xl bg-card flex flex-col">
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
                        <Area type="monotone" dataKey="avg" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorAvg)" />
                      </AreaChart>
                    </ResponsiveContainer>
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
                            <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 line-clamp-1">{g.title}</div>
                          </div>
                        </div>
                      )) : <div className="text-[10px] text-muted-foreground italic p-4 text-center bg-card rounded-xl border border-dashed">Sin evaluaciones excelentes</div>}
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
                            <div className="text-[10px] font-bold text-primary line-clamp-1">{g.title}</div>
                          </div>
                        </div>
                      )) : <div className="text-[10px] text-muted-foreground italic p-4 text-center bg-card rounded-xl border border-dashed">Sin evaluaciones medias</div>}
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
                            <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 line-clamp-1">{g.title}</div>
                          </div>
                        </div>
                      )) : <div className="text-[10px] text-muted-foreground italic p-4 text-center bg-card rounded-xl border border-dashed">Sin insuficientes</div>}
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
