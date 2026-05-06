import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Student, Assessment, Grade } from '@/src/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import ExcelJS from 'exceljs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BarChart3, CheckCircle2, GraduationCap, Search, Download } from 'lucide-react';

function GradeInput({ 
  studentId, 
  assessmentId, 
  initialValue, 
  onSave 
}: { 
  studentId: string, 
  assessmentId: string, 
  initialValue: number | undefined, 
  onSave: (val: string) => void 
}) {
  const [val, setVal] = useState(initialValue?.toString() ?? '');

  useEffect(() => {
    setVal(initialValue?.toString() ?? '');
  }, [initialValue]);

  return (
    <Input 
      type="number"
      className="w-12 sm:w-16 h-7 sm:h-8 text-center text-[10px] sm:text-xs font-mono rounded-md border-slate-200"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (val !== (initialValue?.toString() ?? '')) {
          onSave(val);
        }
      }}
    />
  );
}

export default function Gradebook({ classId, teacherId }: { classId: string, teacherId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [grades, setGrades] = useState<Record<string, number>>({}); // key: studentId_assessmentId
  const [loading, setLoading] = useState(true);
  const [trimester, setTrimester] = useState('1');

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

      const [snapS, snapA, snapG] = await Promise.all([getDocs(qS), getDocs(qA), getDocs(qG)]);

      setStudents(snapS.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setAssessments(snapA.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assessment)));

      const gradeMap: Record<string, number> = {};
      snapG.docs.forEach(doc => {
        const data = doc.data() as Grade;
        gradeMap[`${data.studentId}_${data.assessmentId}`] = data.score;
      });
      setGrades(gradeMap);
    } catch (error) {
       handleFirestoreError(error, OperationType.LIST, 'gradebook_data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [classId, teacherId]);

  const updateGrade = async (studentId: string, assessmentId: string, score: string) => {
    const numScore = parseFloat(score);
    if (isNaN(numScore) || numScore < 0 || numScore > 100) return;

    const id = `${studentId}_${assessmentId}`;
    try {
      await setDoc(doc(db, 'grades', id), {
        studentId,
        assessmentId,
        classId,
        teacherId,
        score: numScore,
        updatedAt: serverTimestamp()
      });
      setGrades(prev => ({ ...prev, [id]: numScore }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'grades');
    }
  };

  const filteredAssessments = React.useMemo(() => {
    return assessments
      .filter(a => trimester !== 'all' && a.trimester === Number(trimester))
      .sort((a,b) => {
        // Sort: Parents first, then their children
        if (a.id === b.parentId) return -1;
        if (b.id === a.parentId) return 1;
        if (a.parentId && !b.parentId) {
          if (a.parentId === b.id) return 1;
          return a.parentId.localeCompare(b.id);
        }
        if (!a.parentId && b.parentId) {
          if (b.parentId === a.id) return -1;
          return a.id.localeCompare(b.parentId);
        }
        return 0;
      });
  }, [assessments, trimester]);

  const studentGrades = React.useMemo(() => {
    const map: Record<string, number | null> = {};

    const getScore = (studentId: string, assessmentId: string, path: string[] = []): number | null => {
      const key = `${studentId}_${assessmentId}`;
      if (map[key] !== undefined) return map[key];
      
      if (path.includes(assessmentId)) return null;

      const assessment = assessments.find(a => a.id === assessmentId);
      if (!assessment) return null;

      let score: number | null = null;
      if (assessment.isCategory) {
        const children = assessments.filter(child => child.parentId === assessment.id);
        if (children.length > 0) {
          let earned = 0;
          let hasAnyGrade = false;
          
          children.forEach(child => {
            const s = getScore(studentId, child.id, [...path, assessmentId]);
            if (s !== null) {
              earned += s * child.weight;
              hasAnyGrade = true;
            }
          });
          
          // Use the category weight as the anchor denominator
          // This way, if children sum to less than category weight, the missing parts count as 0/pending
          // If children sum to the exact category weight, it acts as a standard average
          score = hasAnyGrade ? earned / assessment.weight : null;
        }
      } else {
        score = grades[key] ?? null;
      }

      map[key] = score;
      return score;
    };

    students.forEach(s => {
      assessments.forEach(a => {
        getScore(s.id, a.id);
      });
    });

    return map;
  }, [students, assessments, grades]);

  const calculateAssessmentScore = (studentId: string, assessmentId: string): number | null => {
    return studentGrades[`${studentId}_${assessmentId}`] ?? null;
  };

  const trimesterAvgs = React.useMemo(() => {
    const map: Record<string, number | null> = {};

    [1, 2, 3].forEach(tri => {
      const list = assessments.filter(a => a.trimester === tri);
      // ONLY Top-level assessments (either categories or independent ones)
      const topLevel = list.filter(a => !a.parentId || a.parentId === 'none');

      students.forEach(s => {
        let totalWeight = 0;
        let earnedWeight = 0;
        let hasAnyGrade = false;

        topLevel.forEach(a => {
          const g = calculateAssessmentScore(s.id, a.id);
          if (g !== null) {
            earnedWeight += g * a.weight;
            hasAnyGrade = true;
          }
          totalWeight += a.weight;
        });
        
        // Trimester average: Base it on the sum of top-level weights (should ideally be 1.0 or 100%)
        map[`${s.id}_${tri}`] = (hasAnyGrade && totalWeight > 0) ? earnedWeight / totalWeight : null;
      });
    });

    return map;
  }, [students, assessments, studentGrades]);

  const calculateTrimesterAvg = (studentId: string, tri: number) => {
    return trimesterAvgs[`${studentId}_${tri}`] ?? null;
  };

  const calculateFinal = (studentId: string) => {
    if (trimester !== 'all') {
      const avg = calculateTrimesterAvg(studentId, Number(trimester));
      return avg !== null ? avg.toFixed(2) : '-';
    }

    const t1 = calculateTrimesterAvg(studentId, 1);
    const t2 = calculateTrimesterAvg(studentId, 2);
    const t3 = calculateTrimesterAvg(studentId, 3);
    
    const grades_list = [t1, t2, t3].filter(g => g !== null) as number[];
    if (grades_list.length === 0) return '-';
    
    const final = grades_list.reduce((a, b) => a + b, 0) / grades_list.length;
    return final.toFixed(2);
  };

  const filteredStudents = students.filter(s => 
    `${s.name} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Notas_Generales');

      // Header row
      const columns = [
        { header: 'Alumno', key: 'name', width: 35 },
      ];

      if (trimester === 'all') {
        columns.push(
          { header: '1º Trimestre', key: 't1', width: 15 },
          { header: '2º Trimestre', key: 't2', width: 15 },
          { header: '3º Trimestre', key: 't3', width: 15 },
          { header: 'Nota Final Anual', key: 'final', width: 20 }
        );
      } else {
        filteredAssessments.forEach(a => {
          columns.push({ 
            header: `${a.title} (${(a.weight * 100).toFixed(0)}%)`, 
            key: a.id, 
            width: 25 
          });
        });
        columns.push({ 
          header: `Media ${trimester}º Trim.`, 
          key: 'final', 
          width: 20 
        });
      }

      worksheet.columns = columns;

      // Style Header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' } // Indigo-600
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Add Data
      filteredStudents.forEach(student => {
        const studentName = student.lastName ? `${student.lastName}, ${student.name}` : student.name;
        const rowData: any = { name: studentName };

        if (trimester === 'all') {
          rowData.t1 = calculateTrimesterAvg(student.id, 1)?.toFixed(2) || '-';
          rowData.t2 = calculateTrimesterAvg(student.id, 2)?.toFixed(2) || '-';
          rowData.t3 = calculateTrimesterAvg(student.id, 3)?.toFixed(2) || '-';
          rowData.final = calculateFinal(student.id);
        } else {
          filteredAssessments.forEach(a => {
            const score = calculateAssessmentScore(student.id, a.id);
            rowData[a.id] = score !== null ? score.toFixed(2) : '-';
          });
          rowData.final = calculateFinal(student.id);
        }
        
        const row = worksheet.addRow(rowData);
        
        // Conditional coloring for final column
        const finalCell = row.getCell('final');
        const finalVal = parseFloat(finalCell.value as string);
        if (!isNaN(finalVal)) {
          finalCell.font = { bold: true, color: { argb: finalVal < 5 ? 'FFFF0000' : 'FF059669' } };
        }
      });

      // Borders for all cells
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      });

      // Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Notas_Clase_${trimester === 'all' ? 'Anual' : trimester + 'Trim'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Archivo Excel general generado');
    } catch (error) {
      console.error(error);
      toast.error('Error al generar el archivo Excel');
    }
  };

  const exportStudentExcel = async (student: Student) => {
    try {
      const studentName = student.lastName ? `${student.lastName}, ${student.name}` : student.name;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Boletín de Notas');

      // Helper for adding styled headers
      const addStyledHeader = (text: string, rowNum: number, bgColor = 'FFF1F5F9', textColor = 'FF1E293B') => {
        const row = worksheet.getRow(rowNum);
        row.values = [text];
        worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
        row.font = { bold: true, size: 12, color: { argb: textColor } };
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        row.alignment = { horizontal: 'center' };
      };

      // Header Section
      addStyledHeader('INFORME ACADÉMICO INDIVIDUAL', 1, 'FF4F46E5', 'FFFFFFFF');
      
      worksheet.addRow([]);
      worksheet.addRow(['ESTUDIANTE:', '', studentName.toUpperCase()]).font = { bold: true };
      worksheet.getRow(3).getCell(3).font = { bold: true, color: { argb: 'FF4F46E5' } };
      
      worksheet.addRow(['FECHA REPORTE:', '', new Date().toLocaleDateString('es-ES')]);
      worksheet.addRow([]);

      let currentRow = 6;
      addStyledHeader('DETALLE DE CALIFICACIONES POR TRIMESTRE', currentRow, 'FF6366F1', 'FFFFFFFF');
      currentRow++;

      [1, 2, 3].forEach(tri => {
        worksheet.addRow([]);
        currentRow++;
        
        const triRow = worksheet.getRow(currentRow);
        triRow.values = [`${tri}º TRIMESTRE`, '', '---'];
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        triRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        triRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        triRow.alignment = { horizontal: 'center' };
        currentRow++;

        const headerRow = worksheet.addRow(['Evaluación / Criterio', 'Peso', 'Nota']);
        headerRow.font = { bold: true, size: 10 };
        headerRow.eachCell(c => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          c.border = { bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } } };
        });
        currentRow++;

        // Get top-level assessments for this trimester
        const topLevel = assessments.filter(a => a.trimester === tri && !a.parentId);

        topLevel.forEach(parent => {
          const children = assessments.filter(a => a.parentId === parent.id);
          const hasChildren = children.length > 0;
          const score = calculateAssessmentScore(student.id, parent.id);
          const scoreVal = score !== null ? score.toFixed(2) : '---';

          // Add Category Row
          const r = worksheet.addRow([
            hasChildren ? `📂 ${parent.title.toUpperCase()}` : parent.title,
            `${(parent.weight * 100).toFixed(0)}%`,
            scoreVal
          ]);
          
          if (hasChildren) {
            r.font = { bold: true };
            r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            r.getCell(1).font = { bold: true, color: { argb: 'FF1E293B' } };
          }
          
          if (score !== null) {
            r.getCell(3).font = { color: { argb: score < 5 ? 'FFFF0000' : 'FF059669' }, bold: true };
          }
          currentRow++;

          // Add Sub-items
          children.forEach(child => {
            const childScore = calculateAssessmentScore(student.id, child.id);
            const childScoreVal = childScore !== null ? childScore.toFixed(2) : '---';
            const cr = worksheet.addRow([
                `      └─ ${child.title}`,
                `${(child.weight * 100).toFixed(0)}%`,
                childScoreVal
            ]);
            cr.getCell(1).font = { italic: true, color: { argb: 'FF64748B' }, size: 9 };
            cr.getCell(2).font = { color: { argb: 'FF94A3B8' }, size: 9 };
            
            if (childScore !== null) {
                cr.getCell(3).font = { color: { argb: childScore < 5 ? 'FFFCA5A5' : 'FF6EE7B7' }, size: 9 };
            }
            currentRow++;
          });
        });
        
        const triAvg = calculateTrimesterAvg(student.id, tri);
        const avgRow = worksheet.addRow(['MEDIA TOTAL TRIMESTRE', '', triAvg !== null ? triAvg.toFixed(2) : "---"]);
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        avgRow.font = { bold: true };
        avgRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
        avgRow.getCell(3).font = { bold: true, size: 12, color: { argb: 'FF4F46E5' } };
        avgRow.height = 20;
        currentRow++;
      });

      worksheet.addRow([]);
      currentRow++;
      addStyledHeader('RESUMEN FINAL ANUAL', currentRow, 'FF1E293B', 'FFFFFFFF');
      currentRow++;

      const final1 = calculateTrimesterAvg(student.id, 1)?.toFixed(2) || "---";
      const final2 = calculateTrimesterAvg(student.id, 2)?.toFixed(2) || "---";
      const final3 = calculateTrimesterAvg(student.id, 3)?.toFixed(2) || "---";
      const finalAnual = calculateFinal(student.id);

      const res1 = worksheet.addRow(['1º Trimestre', '', final1]);
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      currentRow++;

      const res2 = worksheet.addRow(['2º Trimestre', '', final2]);
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      currentRow++;

      const res3 = worksheet.addRow(['3º Trimestre', '', final3]);
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      currentRow++;

      const resFinal = worksheet.addRow(['CALIFICACIÓN FINAL', '', finalAnual]);
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      resFinal.font = { bold: true, size: 12 };
      resFinal.getCell(3).font = { bold: true, size: 14, color: { argb: parseFloat(finalAnual) < 5 ? 'FFFF0000' : 'FF059669' } };
      resFinal.height = 25;
      resFinal.alignment = { vertical: 'middle' };

      // Column Widths
      worksheet.getColumn(1).width = 40;
      worksheet.getColumn(2).width = 15;
      worksheet.getColumn(3).width = 15;
      worksheet.getColumn(3).alignment = { horizontal: 'center' };

      // Global Borders
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 0) {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            });
        }
      });

      // Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const safeName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      anchor.href = url;
      anchor.download = `Reporte_${safeName}_${new Date().getFullYear()}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Boletín generado para ${student.name}`);
    } catch (error) {
      console.error(error);
      toast.error('Error al generar el reporte individual');
    }
  };

  const stats = React.useMemo(() => {
    if (students.length === 0) return null;
    
    const finalGrades = students.map(s => {
      const val = calculateFinal(s.id);
      return val === '-' ? null : parseFloat(val);
    }).filter(g => g !== null) as number[];

    if (finalGrades.length === 0) return null;

    const avg = finalGrades.reduce((a, b) => a + b, 0) / finalGrades.length;
    const passRate = (finalGrades.filter(g => g >= 5).length / finalGrades.length) * 100;
    
    const currentAssessmentIds = assessments
      .filter(a => trimester === 'all' || a.trimester === Number(trimester))
      .map(a => a.id);
    
    let maxGrade = 0;
    students.forEach(s => {
      currentAssessmentIds.forEach(aId => {
        const score = grades[`${s.id}_${aId}`];
        if (score !== undefined && score > maxGrade) {
          maxGrade = score;
        }
      });
    });
    
    return { avg, passRate, max: maxGrade };
  }, [students, assessments, trimester, trimesterAvgs, grades]);

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-white/60 backdrop-blur-sm border-slate-200">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Media Clase</p>
                <p className="text-xl font-display font-bold text-slate-900">{stats.avg.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/60 backdrop-blur-sm border-slate-200">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tasa Aprobados</p>
                <p className="text-xl font-display font-bold text-slate-900">{stats.passRate.toFixed(0)}%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/60 backdrop-blur-sm border-amber-200 shadow-lg shadow-amber-500/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
            <CardContent className="p-4 flex items-center gap-4 relative z-10">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shadow-inner shadow-amber-200/50">
                <GraduationCap className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600/70">Mejor Puntuación</p>
                <p className="text-xl font-display font-bold text-slate-900">{stats.max.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white border-b py-4 sm:py-6 px-4 sm:px-8 gap-4">
          <div className="flex-1 w-full">
            <CardTitle className="font-display font-bold text-xl">Cuaderno de Notas</CardTitle>
            <div className="relative mt-3 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Buscar alumno..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all text-sm w-full"
              />
            </div>
          </div>
          <div className="flex gap-2 sm:gap-4 items-center w-full lg:w-auto overflow-x-auto no-scrollbar py-1">
              <Button 
                onClick={exportToExcel}
                variant="outline"
                className="rounded-full gap-2 text-xs border-indigo-200 text-indigo-600 hover:bg-white hover:border-indigo-400 transition-all font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                Planilla General
              </Button>
              <Label className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 font-bold whitespace-nowrap">Ver:</Label>
              <Select value={trimester} onValueChange={setTrimester}>
                  <SelectTrigger className="w-full sm:w-[180px] rounded-full h-8 sm:h-10 text-xs sm:text-sm">
                      <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="1">1º Trimestre</SelectItem>
                      <SelectItem value="2">2º Trimestre</SelectItem>
                      <SelectItem value="3">3º Trimestre</SelectItem>
                      <SelectItem value="all">Resumen Final (Anual)</SelectItem>
                  </SelectContent>
              </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="px-4 sm:px-8 font-bold border-r w-[130px] sm:w-[250px] sticky left-0 bg-slate-50 z-20 text-xs sm:text-sm shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Alumno</TableHead>
                  {trimester === 'all' ? (
                    <>
                      <TableHead className="text-center font-bold">1º Trim</TableHead>
                      <TableHead className="text-center font-bold">2º Trim</TableHead>
                      <TableHead className="text-center font-bold">3º Trim</TableHead>
                    </>
                  ) : (
                    filteredAssessments.map(a => (
                      <TableHead key={a.id} className={`text-center min-w-[120px] ${a.isCategory ? 'bg-indigo-50/50' : 'bg-slate-50/50'} ${a.parentId ? 'border-l border-slate-100' : ''}`}>
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            {(a.weight * 100).toFixed(0)}% {a.parentId ? '(Peso rel.)' : '(Peso total)'}
                          </span>
                          <span className={`text-xs font-bold leading-tight ${a.isCategory ? 'text-indigo-700' : ''}`}>
                            {a.title}
                          </span>
                        </div>
                      </TableHead>
                    ))
                  )}
                  <TableHead className="text-center font-bold bg-indigo-50 text-indigo-700 sm:sticky sm:right-0 sm:z-20 w-[80px] sm:w-[120px]">
                    {trimester === 'all' ? 'Nota Final' : 'Media Trim.'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={trimester === 'all' ? 5 : filteredAssessments.length + 2} className="h-40 text-center text-slate-400 italic">
                      No se encontraron alumnos.
                    </TableCell>
                  </TableRow>
                ) : filteredStudents.map(student => (
                  <TableRow key={student.id} className="hover:bg-slate-50/30 transition-colors group">
                    <TableCell className="px-4 sm:px-8 font-medium border-r sticky left-0 bg-white group-hover:bg-slate-50 z-10 text-xs sm:text-sm max-w-[130px] sm:max-w-none truncate shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => exportStudentExcel(student)}
                          className="h-7 w-7 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 shrink-0"
                          title="Descargar boletín Excel"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <span className="truncate">
                          {student.lastName ? `${student.lastName}, ${student.name}` : student.name}
                        </span>
                      </div>
                    </TableCell>
                    
                    {trimester === 'all' ? (
                      <>
                        <TableCell className="text-center font-mono text-[10px] sm:text-sm border-r">
                          {calculateTrimesterAvg(student.id, 1)?.toFixed(2) || '-'}
                        </TableCell>
                        <TableCell className="text-center font-mono text-[10px] sm:text-sm border-r">
                          {calculateTrimesterAvg(student.id, 2)?.toFixed(2) || '-'}
                        </TableCell>
                        <TableCell className="text-center font-mono text-[10px] sm:text-sm border-r">
                          {calculateTrimesterAvg(student.id, 3)?.toFixed(2) || '-'}
                        </TableCell>
                      </>
                    ) : (
                      filteredAssessments.map(a => {
                        const score = calculateAssessmentScore(student.id, a.id);
                        const hasChildren = assessments.some(child => child.parentId === a.id);
                        
                        return (
                          <TableCell key={a.id} className={`p-1 sm:p-2 border-r ${a.isCategory ? 'bg-indigo-50/20' : ''}`}>
                              <div className="flex justify-center">
                                {hasChildren ? (
                                  <div className="text-center">
                                    <span className="text-[10px] font-mono font-bold text-indigo-600">
                                      {score !== null ? score.toFixed(1) : '-'}
                                    </span>
                                  </div>
                                ) : (
                                  <GradeInput 
                                    studentId={student.id}
                                    assessmentId={a.id}
                                    initialValue={grades[`${student.id}_${a.id}`]}
                                    onSave={(val) => updateGrade(student.id, a.id, val)}
                                  />
                                )}
                              </div>
                          </TableCell>
                        );
                      })
                    )}
                    
                    <TableCell className="text-center font-bold bg-indigo-50/30 sm:sticky sm:right-0 sm:z-10 w-[80px] sm:w-[120px]">
                      <Badge 
                        variant={Number(calculateFinal(student.id)) < 5 ? 'destructive' : 'secondary'} 
                        className={`rounded-md px-1 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs ${Number(calculateFinal(student.id)) >= 5 ? 'bg-green-100 text-green-700' : ''}`}
                      >
                        {calculateFinal(student.id)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

}
