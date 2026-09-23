import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { Class } from '@/src/types';
import Navbar from '@/src/components/layout/Navbar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, ClipboardList, PenTool, BarChart2, TrendingUp } from 'lucide-react';
import { StaggerContainer, StaggerItem } from '@/src/components/layout/FadeIn';

// Sub-components
import StudentsList from '@/src/components/class/StudentsList';
import AttendanceTracker from '@/src/components/class/AttendanceTracker';
import AssessmentManager from '@/src/components/class/AssessmentManager';
import Gradebook from '@/src/components/class/Gradebook';
import Analytics from '@/src/components/class/Analytics';

export default function ClassDetail() {
  const { classId } = useParams();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [classData, setClassData] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const currentTab = searchParams.get('tab') || 'students';

  useEffect(() => {
    if (!classId || !user?.uid) return;
    setLoading(true);
    const docRef = doc(db, 'classes', classId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Class;
        if (data.teacherId !== user.uid) {
          navigate('/dashboard');
          return;
        }
        setClassData({ id: docSnap.id, ...data });
      } else {
        navigate('/dashboard');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `classes/${classId}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [classId, user?.uid, navigate]);

  if (loading) return null;
  if (!classData) return <div>No encontrada</div>;

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <StaggerContainer>
        <StaggerItem variant="fadeUp">
          <header className="bg-card/40 backdrop-blur-md border-b border-border py-8 text-center sm:text-left">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center justify-center sm:justify-start gap-4 text-xs font-bold text-primary uppercase tracking-widest mb-1">
                <span>{classData.subject}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-display font-black text-foreground tracking-tight underline underline-offset-8 decoration-primary/30">{classData.name}</h1>
            </div>
          </header>
        </StaggerItem>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-8">
            <StaggerItem variant="stagger" className="flex justify-start overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
              <TabsList className="bg-card/40 backdrop-blur-md p-1 border border-border rounded-2xl h-12 shadow-sm flex-none">
                <TabsTrigger value="students" className="rounded-xl px-6 gap-2 transition-all duration-300 active:scale-95 hover:scale-[1.02] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Users className="w-4 h-4" /> Alumnos
                </TabsTrigger>
                <TabsTrigger value="attendance" className="rounded-xl px-6 gap-2 transition-all duration-300 active:scale-95 hover:scale-[1.02] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <ClipboardList className="w-4 h-4" /> Asistencia
                </TabsTrigger>
                <TabsTrigger value="assessments" className="rounded-xl px-6 gap-2 transition-all duration-300 active:scale-95 hover:scale-[1.02] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <PenTool className="w-4 h-4" /> Evaluaciones
                </TabsTrigger>
                <TabsTrigger value="grades" className="rounded-xl px-6 gap-2 transition-all duration-300 active:scale-95 hover:scale-[1.02] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <BarChart2 className="w-4 h-4" /> Notas
                </TabsTrigger>
                <TabsTrigger value="analytics" className="rounded-xl px-6 gap-2 transition-all duration-300 active:scale-95 hover:scale-[1.02] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <TrendingUp className="w-4 h-4" /> Analíticas
                </TabsTrigger>
              </TabsList>
            </StaggerItem>

            <StaggerItem variant="fadeUp">
              <TabsContent value="students">
                <StudentsList classId={classData.id} teacherId={user!.uid} />
              </TabsContent>
              
              <TabsContent value="attendance">
                <AttendanceTracker classId={classData.id} teacherId={user!.uid} />
              </TabsContent>

              <TabsContent value="assessments">
                <AssessmentManager classId={classData.id} teacherId={user!.uid} />
              </TabsContent>

              <TabsContent value="grades">
                <Gradebook classId={classData.id} teacherId={user!.uid} />
              </TabsContent>

              <TabsContent value="analytics">
                <Analytics classId={classData.id} teacherId={user!.uid} />
              </TabsContent>
            </StaggerItem>
          </Tabs>
        </main>
      </StaggerContainer>
    </div>
  );
}
