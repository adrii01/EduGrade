import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Student, Assessment, Grade } from '@/src/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
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

export default function Analytics({ classId, teacherId }: { classId: string, teacherId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [className, setClassName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

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

    const getPerformanceSummary = (avg: number, allGrades: any[]) => {
      if (allGrades.length === 0) return "No hay suficientes datos para evaluar el rendimiento todavía.";
      
      const recentScores = allGrades.slice(-3).map(g => g.score || 0);
      const isImproving = recentScores.length > 1 && recentScores[recentScores.length - 1] > recentScores[0];
      
      let base = "";
      if (avg >= 9) base = `Rendimiento excelente (${avg.toFixed(1)}). El estudiante demuestra un dominio sobresaliente de los contenidos evaluados hasta la fecha.`;
      else if (avg >= 7) base = `Buen desempeño (${avg.toFixed(1)}). El estudiante sigue adecuadamente el ritmo de la asignatura y asimila los conceptos clave.`;
      else if (avg >= 5) base = `Aprobado justo (${avg.toFixed(1)}). Se observa un conocimiento básico de la materia, aunque con irregularidades en los resultados.`;
      else base = `Rendimiento insuficiente (${avg.toFixed(1)}). El estudiante no está alcanzando los objetivos mínimos planteados en las evaluaciones actuales.`;

      if (isImproving && avg < 9) base += " Se aprecia una ligera tendencia de mejora en las evaluaciones más recientes.";
      
      return base;
    };

    const getImprovementText = (eAvg: number, wAvg: number, wPoints: any[]) => {
      const tips = [];
      
      if (eAvg > 0 && wAvg > 0) {
        if (eAvg < wAvg - 1.5) {
          tips.push("Se observa un desempeño significativamente inferior en los exámenes respecto a los trabajos. Convendría trabajar en la preparación de pruebas objetivas.");
        } else if (wAvg < eAvg - 1.5) {
          tips.push("Las calificaciones en los trabajos son inferiores a las de los exámenes. Sería positivo prestar más atención al detalle y ejecución de las tareas diarias.");
        }
      }

      if (wPoints.length > 0) {
        const weakest = wPoints[0];
        tips.push(`Es recomendable revisar los contenidos de "${weakest.title}" para reforzar los conceptos donde se obtuvo la nota más baja (${weakest.score}).`);
      }

      if (tips.length === 0) {
        return "Mantener la dinámica de trabajo actual para consolidar el nivel de competencia alcanzado.";
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
      summary: getPerformanceSummary(overallAvg, studentGrades),
      recommendation: getImprovementText(examAvg, workAvg, weakPoints),
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-2xl bg-white/60 backdrop-blur-sm border-white shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">Media de la Clase</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-display font-black text-indigo-700">{averageClass}</div>
                <p className="text-[10px] text-slate-500 italic mt-1">Tendencia estable</p>
            </CardContent>
          </Card>
      </div>

      <Card className="rounded-2xl bg-white/40 backdrop-blur-md border-white shadow-xl overflow-hidden">
        <CardHeader className="bg-white/20 border-b border-white/40 px-4 sm:px-8 py-4 sm:py-6">
          <CardTitle className="font-display font-bold text-slate-800 text-lg sm:text-xl">Rendimiento por Alumno</CardTitle>
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
            <DialogContent className="sm:max-w-[700px] w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto sm:rounded-3xl p-0 border-none shadow-2xl bg-white flex flex-col">
              <div className="bg-indigo-600 p-6 sm:p-8 text-white relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl animate-pulse" />
                
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="absolute top-4 right-4 sm:hidden p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <ChevronRight className="w-6 h-6 rotate-180" />
                </button>
                <DialogHeader className="space-y-0 text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className="bg-white/20 border-white/20 text-white hover:bg-white/30 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider">
                      Perfil del Alumno
                    </Badge>
                  </div>
                  <DialogTitle className="text-2xl sm:text-3xl font-display font-black tracking-tight text-white line-clamp-1 pr-10">
                    {selectedStudent.lastName ? `${selectedStudent.lastName}, ${selectedStudent.name}` : selectedStudent.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="mt-6 flex flex-wrap gap-4 items-center">
                  <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 flex items-center gap-4 border border-white/20">
                    <div className="w-12 h-12 rounded-xl bg-white text-indigo-600 flex items-center justify-center font-black text-xl shadow-lg ring-4 ring-white/10 shrink-0">
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
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Nota Media</div>
                    <div className={`text-2xl font-black ${overallAvg >= 5 ? 'text-indigo-600' : 'text-rose-500'}`}>
                      {overallAvg.toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Nota Máxima</div>
                    <div className="text-2xl font-black text-emerald-500">{stats.max.toFixed(1)}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Nota Mínima</div>
                    <div className="text-2xl font-black text-rose-400">{stats.min.toFixed(1)}</div>
                  </div>
                </div>

                {/* Trimester chart */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    Trayectoria Académica
                  </h3>
                  <div className="h-[200px] w-full bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
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
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-500" />
                      Fuertes
                    </h3>
                    <div className="space-y-2">
                      {stats.strongPoints.length > 0 ? stats.strongPoints.slice(0, 3).map((g, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {g.score}
                            </div>
                            <div className="text-[10px] font-bold text-emerald-900 line-clamp-1">{g.title}</div>
                          </div>
                        </div>
                      )) : <div className="text-[10px] text-slate-400 italic p-4 text-center bg-white rounded-xl border border-dashed">Sin evaluaciones excelentes</div>}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Target className="w-4 h-4 text-indigo-500" />
                      Intermedios
                    </h3>
                    <div className="space-y-2">
                      {stats.mediumPoints.length > 0 ? stats.mediumPoints.slice(0, 3).map((g, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {g.score}
                            </div>
                            <div className="text-[10px] font-bold text-indigo-900 line-clamp-1">{g.title}</div>
                          </div>
                        </div>
                      )) : <div className="text-[10px] text-slate-400 italic p-4 text-center bg-white rounded-xl border border-dashed">Sin evaluaciones medias</div>}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      A Mejorar
                    </h3>
                    <div className="space-y-2">
                      {stats.weakPoints.length > 0 ? stats.weakPoints.slice(0, 3).map((g, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {g.score}
                            </div>
                            <div className="text-[10px] font-bold text-rose-900 line-clamp-1">{g.title}</div>
                          </div>
                        </div>
                      )) : <div className="text-[10px] text-slate-400 italic p-4 text-center bg-white rounded-xl border border-dashed">Sin insuficientes</div>}
                    </div>
                  </div>
                </div>

                {/* Pedagogical Insights - MOVED TO THE BOTTOM */}
                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h3 className="font-display font-bold text-slate-800">Conclusiones y Recomendaciones</h3>
                  </div>
                  
                  <div className="grid gap-4">
                    <div className="group bg-slate-50 p-5 rounded-2xl border border-slate-100 transition-all">
                      <div className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1 flex items-center gap-2">
                        <Activity className="w-3 h-3 text-indigo-500" /> Puntos Clave del Periodo
                      </div>
                      <p className="text-slate-700 text-xs leading-relaxed font-medium">
                        {analysis.summary}
                      </p>
                    </div>
                    
                    <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
                      <div className="text-emerald-600 font-black text-[10px] uppercase tracking-widest mb-1 flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> Sugerencias de Mejora
                      </div>
                      <p className="text-emerald-900 text-xs leading-relaxed font-bold">
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
    </div>
  );
}
